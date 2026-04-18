/**
 * One-time script: drops the transactions table (and its child rows) so that
 * `db:push` can recreate it with the clean schema (no legacy agent columns).
 *
 * Run sequence:
 *   npx tsx src/db/drop-legacy-agent-columns.ts
 *   npm run db:push          ← recreates transactions with new schema
 *   npm run db:seed          ← repopulates all data
 */

import { createClient } from '@libsql/client';
import { config } from 'dotenv';
config({ path: '.env.local' });

const client = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

async function run() {
  console.log('Clearing child tables and dropping transactions...');

  // Delete in FK order (children first)
  await client.execute('DELETE FROM activity_log');
  await client.execute('DELETE FROM transaction_tasks');
  await client.execute('DELETE FROM transaction_agents');
  await client.execute('DROP TABLE transactions');

  console.log('Done. Run `npm run db:push` then `npm run db:seed`.');
  process.exit(0);
}

run().catch((err) => {
  console.error('Failed:', err);
  process.exit(1);
});
