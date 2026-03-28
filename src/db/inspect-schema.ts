import { createClient } from '@libsql/client';
import { config } from 'dotenv';

config({ path: '.env.local' });

const client = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

async function inspect() {
  const result = await client.execute(
    `SELECT name, sql FROM sqlite_master WHERE type='table' AND name IN ('transactions', 'task_templates', 'task_template_groups') ORDER BY name`,
  );

  for (const row of result.rows) {
    const r = row as unknown as { name: string; sql: string };
    console.log(`\n=== ${r.name} ===`);
    console.log(r.sql);
  }
}

inspect().catch((err) => { console.error(err); process.exit(1); });
