/**
 * Drop legacy columns that are no longer in the schema.
 *
 * Uses ALTER TABLE DROP COLUMN directly (SQLite 3.35+) rather than Drizzle-kit's
 * table-recreation approach, which was hitting an FK constraint check failure.
 *
 * Run once with: npx tsx src/db/drop-legacy-columns.ts
 */

import { createClient } from '@libsql/client';
import { config } from 'dotenv';

config({ path: '.env.local' });

const client = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

async function columnExists(table: string, column: string): Promise<boolean> {
  const result = await client.execute(`PRAGMA table_info(${table})`);
  return result.rows.some((r) => (r as unknown as { name: string }).name === column);
}

async function run() {
  console.log('🔄 Dropping legacy columns...\n');

  // Drop transaction_type from task_templates
  if (await columnExists('task_templates', 'transaction_type')) {
    await client.execute(`ALTER TABLE task_templates DROP COLUMN transaction_type`);
    console.log('✅ Dropped transaction_type from task_templates');
  } else {
    console.log('✅ transaction_type already absent from task_templates');
  }

  // Drop agent_id from transactions
  if (await columnExists('transactions', 'agent_id')) {
    await client.execute(`ALTER TABLE transactions DROP COLUMN agent_id`);
    console.log('✅ Dropped agent_id from transactions');
  } else {
    console.log('✅ agent_id already absent from transactions');
  }

  console.log('\n✅ Done. Run `npm run db:push` to confirm schema is fully in sync.');
}

run().catch((err) => {
  console.error('Failed:', err.message ?? err);
  process.exit(1);
});
