/**
 * Repair: populate the Dual Agency template group with all listing + purchase
 * tasks, deduplicated by name.
 *
 * Background: the current stamping logic inherited dual tasks from the listing
 * and purchase groups at runtime. Now that 'both' tasks exist in both groups,
 * dual transactions would stamp them twice. The fix is to make the Dual Agency
 * group self-contained — it owns a full merged copy of listing + purchase tasks.
 * The stamping logic is then updated to use ONLY the dual group for dual
 * transactions (no more cross-group inheritance).
 *
 * Run once with: npx tsx src/db/repair-dual-tasks.ts
 *
 * Safe to re-run — skips tasks already present in the Dual Agency group by name.
 */

import { createClient } from '@libsql/client';
import { config } from 'dotenv';

config({ path: '.env.local' });

const client = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

async function run() {
  console.log('🔄 Populating Dual Agency group with all listing + purchase tasks...\n');

  // ── 1. Resolve group IDs PER TENANT ───────────────────────────────────────
  // task_template_groups is now tenant-scoped: each office has its own built-in
  // listing/purchase/dual groups. Run the merge independently for every tenant.
  const groupRows = await client.execute(
    `SELECT id, name, transaction_type, tenant_id FROM task_template_groups WHERE is_default = 1`,
  );

  type GroupRow = { id: string; name: string; transaction_type: string; tenant_id: string };

  const tenantIds = Array.from(
    new Set(groupRows.rows.map((r) => (r as unknown as GroupRow).tenant_id)),
  );

  for (const tenantId of tenantIds) {
    await repairForTenant(tenantId, groupRows.rows as unknown as GroupRow[]);
  }

  console.log('\n✅ Dual-task repair complete for all tenants.');
  process.exit(0);
}

type GroupRow = { id: string; name: string; transaction_type: string; tenant_id: string };

async function repairForTenant(tenantId: string, allGroups: GroupRow[]) {
  console.log(`\n── Tenant ${tenantId} ──`);
  const tenantGroups = allGroups.filter((g) => g.tenant_id === tenantId);
  const listingGroup = tenantGroups.find((r) => r.transaction_type === 'listing');
  const purchaseGroup = tenantGroups.find((r) => r.transaction_type === 'purchase');
  const dualGroup = tenantGroups.find((r) => r.transaction_type === 'dual');

  if (!listingGroup || !purchaseGroup || !dualGroup) {
    console.warn('   ⚠️  Missing one of the three built-in groups for this tenant — skipping.');
    return;
  }

  console.log(`✅ Listing group:      ${listingGroup.id}`);
  console.log(`✅ Purchase group:     ${purchaseGroup.id}`);
  console.log(`✅ Dual Agency group:  ${dualGroup.id}\n`);

  // ── 2. Fetch all tasks from listing + purchase groups ─────────────────────
  const sourceTasks = await client.execute({
    sql: `SELECT * FROM task_templates
          WHERE template_group_id IN (?, ?)
          ORDER BY sort_order ASC`,
    args: [listingGroup.id, purchaseGroup.id],
  });

  console.log(`📋 ${sourceTasks.rows.length} total task rows across Listing + Purchase groups`);

  // Deduplicate by name — listing wins on conflict (first seen wins)
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

  const seen = new Map<string, TaskRow>();
  for (const row of sourceTasks.rows) {
    const r = row as unknown as TaskRow;
    if (!seen.has(r.name)) {
      seen.set(r.name, r);
    }
  }

  console.log(`📋 ${seen.size} unique task names after deduplication\n`);

  // ── 3. Fetch tasks already in the Dual Agency group ───────────────────────
  const existingDual = await client.execute({
    sql: `SELECT name FROM task_templates WHERE template_group_id = ?`,
    args: [dualGroup.id],
  });

  const alreadyInDual = new Set(
    existingDual.rows.map((r) => (r as unknown as { name: string }).name),
  );

  if (alreadyInDual.size > 0) {
    console.log(`ℹ️  ${alreadyInDual.size} task(s) already in Dual Agency group — will skip:`);
    alreadyInDual.forEach((n) => console.log(`   - ${n}`));
    console.log();
  }

  // ── 4. Insert missing tasks into Dual Agency group ────────────────────────
  let inserted = 0;
  let skipped = 0;

  for (const [name, r] of seen.entries()) {
    if (alreadyInDual.has(name)) {
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
        dualGroup.id,
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

    console.log(`   ✅ Inserted "${name}"`);
    inserted++;
  }

  console.log(`\n✅ Done — ${inserted} task(s) inserted, ${skipped} skipped.`);
  console.log('\n⚠️  Next step: update task-stamping.ts so dual transactions use');
  console.log('   only the dual group (not inherited listing+purchase groups).');
  console.log('   See: src/lib/task-stamping.ts → getApplicableGroupIds()');
}

run().catch((err) => {
  console.error('Repair failed:', err.message ?? err);
  process.exit(1);
});
