/**
 * Tenant backfill — run with: npx tsx src/db/backfill-tenant.ts
 *
 * Lifts an existing single-tenant DB onto the multi-tenant platform without
 * data loss (plan §7.2). Idempotent: safe to run repeatedly.
 *
 *   1. Ensure the demo tenant exists (name "Crestline Realty", slug "tenant").
 *   2. Ensure its tenant_branding row exists (copied from the compile-time
 *      defaultBrand constant).
 *   3. Stamp tenantId = <demo tenant id> onto every pre-existing owned row that
 *      is still NULL (agents, transactions, transaction_agents,
 *      task_template_groups, task_templates, transaction_tasks, activity_log,
 *      users, access_requests).
 *   4. Designate the d20web account(s) as platform admins (tenantId = NULL).
 *
 * The DEMO_TENANT_SLUG is the demo line's reserved slug; a real onboarded office
 * gets its own slug via the /platform console.
 */
import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import { eq, isNull, inArray } from 'drizzle-orm';
import * as schema from './schema';
import { defaultBrand } from '../lib/brand-config';
import { config } from 'dotenv';

config({ path: '.env.local' });

const DEMO_TENANT_SLUG = 'tenant';
const DEMO_TENANT_NAME = 'Crestline Realty';
// d20web accounts become platform superadmins (no tenant).
const PLATFORM_ADMIN_EMAILS = ['info@d20web.com'];

const client = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN,
});
const db = drizzle(client, { schema });

/**
 * Ensure the demo tenant + its branding exist, returning the tenant id.
 * Exported so seeds can reuse the exact same provisioning path.
 */
export async function ensureDemoTenant(database = db): Promise<string> {
  const [existing] = await database
    .select({ id: schema.tenants.id })
    .from(schema.tenants)
    .where(eq(schema.tenants.slug, DEMO_TENANT_SLUG));

  let tenantId: string;
  if (existing) {
    tenantId = existing.id;
  } else {
    tenantId = crypto.randomUUID();
    await database.insert(schema.tenants).values({
      id: tenantId,
      name: DEMO_TENANT_NAME,
      slug: DEMO_TENANT_SLUG,
      isActive: true,
      billingStatus: 'manual',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  // Upsert branding from the compile-time defaultBrand (parse-clean JSON blobs).
  const [branding] = await database
    .select({ tenantId: schema.tenantBranding.tenantId })
    .from(schema.tenantBranding)
    .where(eq(schema.tenantBranding.tenantId, tenantId));
  if (!branding) {
    await database.insert(schema.tenantBranding).values({
      tenantId,
      name: defaultBrand.name,
      tagline: defaultBrand.tagline ?? null,
      logoUrl: defaultBrand.logo,
      logoDarkUrl: defaultBrand.logoDark ?? null,
      logoIconUrl: defaultBrand.logoIcon,
      colors: JSON.stringify(defaultBrand.colors),
      darkColors: defaultBrand.darkColors ? JSON.stringify(defaultBrand.darkColors) : null,
      borderRadius: defaultBrand.borderRadius,
      fontFamily: defaultBrand.fontFamily ?? null,
      updatedAt: new Date(),
    });
  }

  return tenantId;
}

async function backfill() {
  console.log('🔧 Backfilling tenant onto existing data...\n');

  const tenantId = await ensureDemoTenant();
  console.log(`  Demo tenant: ${DEMO_TENANT_NAME} (slug "${DEMO_TENANT_SLUG}") → ${tenantId}`);

  // Stamp tenantId onto every owned row still NULL.
  const stamp = async (
    table: typeof schema.agents | typeof schema.transactions | typeof schema.transactionAgents |
      typeof schema.taskTemplateGroups | typeof schema.taskTemplates | typeof schema.transactionTasks |
      typeof schema.activityLog | typeof schema.accessRequests,
    label: string,
  ) => {
    const res = await db.update(table).set({ tenantId }).where(isNull(table.tenantId));
    console.log(`    stamped ${label}`);
    return res;
  };

  await stamp(schema.agents, 'agents');
  await stamp(schema.transactions, 'transactions');
  await stamp(schema.transactionAgents, 'transaction_agents');
  await stamp(schema.taskTemplateGroups, 'task_template_groups');
  await stamp(schema.taskTemplates, 'task_templates');
  await stamp(schema.transactionTasks, 'transaction_tasks');
  await stamp(schema.activityLog, 'activity_log');
  await stamp(schema.accessRequests, 'access_requests (where null)');

  // Users: bind all to the demo tenant first, then lift platform admins out.
  await db.update(schema.users).set({ tenantId }).where(isNull(schema.users.tenantId));
  await db
    .update(schema.users)
    .set({ tenantId: null, isPlatformAdmin: true })
    .where(inArray(schema.users.email, PLATFORM_ADMIN_EMAILS));
  console.log(`    bound users to tenant; promoted ${PLATFORM_ADMIN_EMAILS.join(', ')} to platform admin`);

  console.log('\n✅ Backfill complete.');
  process.exit(0);
}

// Only run when invoked directly (not when imported by a seed).
if (process.argv[1] && process.argv[1].endsWith('backfill-tenant.ts')) {
  backfill().catch((err) => {
    console.error('❌ Backfill failed:', err);
    process.exit(1);
  });
}
