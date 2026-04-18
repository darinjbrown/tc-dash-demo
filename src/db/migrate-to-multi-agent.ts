// One-time migration: run with `npx tsx src/db/migrate-to-multi-agent.ts`
// Safe to re-run — uses onConflictDoNothing for transaction_agents inserts.

import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import * as schema from './schema';
import { eq } from 'drizzle-orm';
import { config } from 'dotenv';

config({ path: '.env.local' });

const client = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN,
});
const db = drizzle(client, { schema });

async function migrate() {
  console.log('Migrating existing agent FKs to transaction_agents...');

  const txs = await db
    .select({
      id: schema.transactions.id,
      sellerAgentId: schema.transactions.sellerAgentId,
      sellerAgentIsInHouse: schema.transactions.sellerAgentIsInHouse,
      buyerAgentId: schema.transactions.buyerAgentId,
      buyerAgentIsInHouse: schema.transactions.buyerAgentIsInHouse,
    })
    .from(schema.transactions);

  let inserted = 0;
  const inHouseAgentIds = new Set<string>();

  for (const tx of txs) {
    if (tx.sellerAgentId) {
      await db
        .insert(schema.transactionAgents)
        .values({
          id: crypto.randomUUID(),
          transactionId: tx.id,
          agentId: tx.sellerAgentId,
          side: 'listing',
          isPrimary: true,
          sortOrder: 0,
        })
        .onConflictDoNothing();
      inserted++;
      if (tx.sellerAgentIsInHouse) {
        inHouseAgentIds.add(tx.sellerAgentId);
      }
    }
    if (tx.buyerAgentId) {
      await db
        .insert(schema.transactionAgents)
        .values({
          id: crypto.randomUUID(),
          transactionId: tx.id,
          agentId: tx.buyerAgentId,
          side: 'buyer',
          isPrimary: true,
          sortOrder: 0,
        })
        .onConflictDoNothing();
      inserted++;
      if (tx.buyerAgentIsInHouse) {
        inHouseAgentIds.add(tx.buyerAgentId);
      }
    }
  }

  if (inHouseAgentIds.size > 0) {
    for (const id of inHouseAgentIds) {
      await db
        .update(schema.agents)
        .set({ isInHouse: true })
        .where(eq(schema.agents.id, id));
    }
    console.log(`  Marked ${inHouseAgentIds.size} agent(s) as in-house.`);
  }

  console.log(`  Inserted ${inserted} transaction_agents row(s).`);
  console.log('Migration complete.');
  process.exit(0);
}

migrate().catch((e) => {
  console.error(e);
  process.exit(1);
});
