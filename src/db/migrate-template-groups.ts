/**
 * Migration: introduce taskTemplateGroups and backfill templateGroupId on existing tasks.
 *
 * Run ONCE with: npx tsx src/db/migrate-template-groups.ts
 *
 * Steps performed:
 *   1. Create task_template_groups table (if it doesn't already exist via db:push)
 *   2. Insert the 3 built-in groups (Listing, Purchase, Dual Agency)
 *   3. Add template_group_id column to task_templates (if not already added)
 *   4. Backfill templateGroupId based on existing transactionType column
 *   5. Drop transaction_type column (via table recreate — db:push handles this)
 *
 * NOTE: Run `npm run db:push` first to apply the schema changes, then run this script
 * to backfill the data. The db:push will add the template_group_id column and create
 * the task_template_groups table, but won't populate data.
 */

import { createClient } from '@libsql/client';
import { config } from 'dotenv';

config({ path: '.env.local' });

const client = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

async function migrate() {
  console.log('🔄 Running template groups migration...\n');

  // Step 1: Create the task_template_groups table if it doesn't exist
  await client.execute(`
    CREATE TABLE IF NOT EXISTS task_template_groups (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      transaction_type TEXT NOT NULL,
      is_default INTEGER NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER
    )
  `);
  console.log('✅ task_template_groups table ready');

  // Step 2: Add template_group_id column to task_templates if missing
  const colCheck = await client.execute(`PRAGMA table_info(task_templates)`);
  const hasGroupId = colCheck.rows.some(
    (r) => (r as unknown as { name: string }).name === 'template_group_id',
  );
  if (!hasGroupId) {
    await client.execute(`ALTER TABLE task_templates ADD COLUMN template_group_id TEXT`);
    console.log('✅ Added template_group_id column to task_templates');
  } else {
    console.log('✅ template_group_id column already exists');
  }

  // Step 3: Insert built-in groups if not already present
  const existingGroups = await client.execute(
    'SELECT COUNT(*) as count FROM task_template_groups',
  );
  const groupCount = (existingGroups.rows[0] as unknown as { count: number }).count;

  if (groupCount > 0) {
    console.log('✅ Template groups already seeded — skipping insertion');
  } else {
    const listingId = crypto.randomUUID();
    const purchaseId = crypto.randomUUID();
    const dualId = crypto.randomUUID();

    await client.batch([
      {
        sql: `INSERT INTO task_template_groups (id, name, description, transaction_type, is_default, is_active, sort_order, created_at) VALUES (?, ?, ?, ?, 1, 1, 0, ?)`,
        args: [listingId, 'Listing Template', 'Tasks for listing transactions', 'listing', Date.now()],
      },
      {
        sql: `INSERT INTO task_template_groups (id, name, description, transaction_type, is_default, is_active, sort_order, created_at) VALUES (?, ?, ?, ?, 1, 1, 1, ?)`,
        args: [purchaseId, 'Purchase Template', 'Tasks for purchase transactions', 'purchase', Date.now()],
      },
      {
        sql: `INSERT INTO task_template_groups (id, name, description, transaction_type, is_default, is_active, sort_order, created_at) VALUES (?, ?, ?, ?, 1, 1, 2, ?)`,
        args: [dualId, 'Dual Agency Template', 'Additional tasks for dual agency', 'dual', Date.now()],
      },
      {
        sql: `UPDATE task_templates SET template_group_id = ? WHERE transaction_type = 'listing'`,
        args: [listingId],
      },
      {
        sql: `UPDATE task_templates SET template_group_id = ? WHERE transaction_type IN ('purchase', 'both', 'dual')`,
        args: [purchaseId],
      },
    ]);
    console.log('✅ Inserted 3 built-in groups and backfilled template_group_id on existing tasks');
  }

  console.log('\n✅ Migration complete!');
  console.log('   Now run: npm run db:push');
  console.log('   When prompted about data loss, select YES to drop the old columns.');
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
