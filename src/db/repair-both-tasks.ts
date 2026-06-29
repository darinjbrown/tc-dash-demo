/**
 * Repair: copy 'both' tasks into the Listing template group.
 *
 * Background: the migrate-template-groups.ts script assigned tasks with
 * transaction_type = 'both' to the Purchase group only. They should also
 * exist in the Listing group. The original transaction_type column has since
 * been dropped, so we recover the list from the static source file.
 *
 * Run once with: npx tsx src/db/repair-both-tasks.ts
 *
 * Safe to re-run — skips any task name already present in the Listing group.
 */

import { createClient } from '@libsql/client';
import { config } from 'dotenv';
import { defaultTaskTemplates } from '../lib/task-templates';

config({ path: '.env.local' });

const client = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

async function run() {
  console.log('🔄 Repairing "both" tasks into Listing group...\n');

  // ── 1. Resolve group IDs ──────────────────────────────────────────────────
  const groupRows = await client.execute(
    `SELECT id, name, transaction_type, tenant_id FROM task_template_groups WHERE is_default = 1`,
  );

  // task_template_groups is tenant-scoped. This one-off operates within a single
  // tenant: it requires exactly one default Listing + Purchase group. For a
  // multi-tenant DB, run per tenant by filtering groupRows up front.
  const tenantIds = Array.from(
    new Set(groupRows.rows.map((r) => (r as unknown as { tenant_id: string }).tenant_id)),
  );
  if (tenantIds.length !== 1) {
    console.error(
      `❌ Found ${tenantIds.length} tenants. This one-off repair targets a single tenant; ` +
        'run it against a single-tenant DB or adapt it to loop per tenant. Aborting.',
    );
    process.exit(1);
  }
  const tenantId = tenantIds[0];

  const listingGroup = groupRows.rows.find(
    (r) => (r as unknown as { transaction_type: string }).transaction_type === 'listing',
  ) as { id: string; name: string } | undefined;

  const purchaseGroup = groupRows.rows.find(
    (r) => (r as unknown as { transaction_type: string }).transaction_type === 'purchase',
  ) as { id: string; name: string } | undefined;

  if (!listingGroup || !purchaseGroup) {
    console.error('❌ Could not find built-in Listing or Purchase groups. Aborting.');
    console.log('   Groups found:', groupRows.rows);
    process.exit(1);
  }

  console.log(`✅ Listing group:  ${listingGroup.id}`);
  console.log(`✅ Purchase group: ${purchaseGroup.id}\n`);

  // ── 2. Get the canonical 'both' task names from source ───────────────────
  const bothNames = new Set(
    defaultTaskTemplates
      .filter((t) => t.transactionType === 'both')
      .map((t) => t.name),
  );

  console.log(`📋 ${bothNames.size} tasks marked 'both' in source:`);
  bothNames.forEach((n) => console.log(`   - ${n}`));
  console.log();

  // ── 3. Fetch existing rows from the Purchase group matching those names ───
  const placeholders = Array.from(bothNames).map(() => '?').join(', ');
  const existingInPurchase = await client.execute({
    sql: `SELECT * FROM task_templates
          WHERE template_group_id = ?
            AND name IN (${placeholders})`,
    args: [purchaseGroup.id, ...Array.from(bothNames)],
  });

  if (existingInPurchase.rows.length === 0) {
    console.log('⚠️  No matching tasks found in the Purchase group. Nothing to copy.');
    process.exit(0);
  }

  console.log(`✅ Found ${existingInPurchase.rows.length} task(s) in Purchase group to copy.\n`);

  // ── 4. Check which names already exist in the Listing group ─────────────
  const existingInListing = await client.execute({
    sql: `SELECT name FROM task_templates WHERE template_group_id = ?`,
    args: [listingGroup.id],
  });

  const alreadyInListing = new Set(
    existingInListing.rows.map((r) => (r as unknown as { name: string }).name),
  );

  // ── 5. Insert missing tasks into Listing group ───────────────────────────
  let inserted = 0;
  let skipped = 0;

  type TaskRow = {
    name: string;
    description: string | null;
    category: string;
    relative_due_days: number;
    relative_to: string;
    sort_order: number;
    is_required: number;
    is_active: number;
    created_at: number | null;
  };

  for (const row of existingInPurchase.rows) {
    const r = row as unknown as TaskRow;

    if (alreadyInListing.has(r.name)) {
      console.log(`   ⏭  Skipping "${r.name}" — already in Listing group`);
      skipped++;
      continue;
    }

    const newId = crypto.randomUUID();
    await client.execute({
      sql: `INSERT INTO task_templates
              (id, tenant_id, template_group_id, name, description, category,
               relative_due_days, relative_to, sort_order,
               is_required, is_active, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        newId,
        tenantId,
        listingGroup.id,
        r.name,
        r.description ?? null,
        r.category,
        r.relative_due_days,
        r.relative_to,
        r.sort_order,
        r.is_required,
        r.is_active,
        r.created_at ?? Date.now(),
      ],
    });

    console.log(`   ✅ Inserted "${r.name}" into Listing group`);
    inserted++;
  }

  console.log(`\n✅ Done — ${inserted} task(s) inserted, ${skipped} skipped.`);
  console.log('   Verify at: npm run db:studio');
}

run().catch((err) => {
  console.error('Repair failed:', err.message ?? err);
  process.exit(1);
});
