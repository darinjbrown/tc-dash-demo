# Multi-Agent Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace single-agent FK columns on `transactions` with a `transaction_agents` junction table supporting multiple in-house and outside agents per side, backed by a unified agent directory.

**Architecture:** New `transaction_agents` table joins agents to transactions with `side` ('listing'|'buyer'), `isPrimary`, and `sortOrder`. The `agents` table gains `isInHouse` flag. All agent CRUD on transactions goes through `src/actions/transaction-agents.ts`. The transaction form tracks agents in local state; the detail page saves immediately via server actions.

**Tech Stack:** Next.js 15 App Router, Drizzle ORM + Turso (libSQL), TypeScript strict, shadcn/ui, Zod, React Hook Form, `db:push` workflow (no migration files)

**Spec:** `docs/superpowers/specs/2026-04-18-multi-agent-refactor-design.md`

---

## File Map

**Create:**
- `src/actions/transaction-agents.ts` — add/remove/setPrimary for junction table
- `src/components/transactions/agent-picker-dialog.tsx` — searchable agent picker + create-new sub-form
- `src/db/migrate-to-multi-agent.ts` — one-time script to port existing agent FK data

**Modify:**
- `src/db/schema.ts` — add `isInHouse` to agents; add `transactionAgents` table; (last task) drop legacy agent columns from transactions
- `src/actions/agents.ts` — add `isInHouse` to types + schema; update `getAgents`, `getAgentsForSelect`, `deleteAgent`; add `toggleAgentInHouse`
- `src/actions/transactions.ts` — update `TransactionSummary`; rewrite `getTransactions` grouping; update `getTransactionDetail`; update `createTransaction`/`updateTransaction` signatures
- `src/lib/transaction-schema.ts` — remove all agent fields from Zod schema
- `src/components/agents/agent-form.tsx` — add `isInHouse` checkbox
- `src/app/(dashboard)/agents/page.tsx` — add In-House badge column; add `toggleAgentInHouse` handler
- `src/components/transactions/transaction-detail.tsx` — replace agent section with stacked agent cards
- `src/components/transactions/transaction-form.tsx` — replace `AgentPickerField` section with local-state agent list + picker dialog
- `src/components/transactions/agent-group.tsx` — update `TransactionCard` agent display to use `listingAgents`/`buyerAgents` arrays
- `src/components/dashboard/active-transactions-card.tsx` — update agent display to use primary/first from arrays
- `src/db/seed.ts` — add `isInHouse: true` to in-house agents; add `transaction_agents` rows

---

## Task 1: Add `isInHouse` to agents schema and push

**Files:**
- Modify: `src/db/schema.ts`

- [ ] **Step 1: Add `isInHouse` field to the agents table**

In `src/db/schema.ts`, add after `isActive`:
```typescript
export const agents = sqliteTable('agents', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull(),
  phone: text('phone'),
  broker: text('broker'),
  licenseNumber: text('license_number'),
  brokerageId: text('brokerage_id'),
  isActive: integer('is_active', { mode: 'boolean' }).default(true).notNull(),
  isInHouse: integer('is_in_house', { mode: 'boolean' }).default(false).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).$defaultFn(() => new Date()),
});
```

- [ ] **Step 2: Push schema**

```bash
npm run db:push
```
Expected: `[✓] Changes applied`

- [ ] **Step 3: Commit**

```bash
git add src/db/schema.ts
git commit -m "feat(schema): add isInHouse flag to agents table"
```

---

## Task 2: Add `transactionAgents` junction table and push

**Files:**
- Modify: `src/db/schema.ts`

- [ ] **Step 1: Add `transactionAgents` table after the `transactions` table definition**

```typescript
export const transactionAgents = sqliteTable('transaction_agents', {
  id: text('id').primaryKey(),
  transactionId: text('transaction_id')
    .notNull()
    .references(() => transactions.id, { onDelete: 'cascade' }),
  agentId: text('agent_id')
    .notNull()
    .references(() => agents.id),
  side: text('side', { enum: ['listing', 'buyer'] }).notNull(),
  isPrimary: integer('is_primary', { mode: 'boolean' }).default(false).notNull(),
  sortOrder: integer('sort_order').default(0).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).$defaultFn(() => new Date()),
});
```

- [ ] **Step 2: Add relations for the new table (after existing relations)**

```typescript
export const transactionAgentsRelations = relations(transactionAgents, ({ one }) => ({
  transaction: one(transactions, {
    fields: [transactionAgents.transactionId],
    references: [transactions.id],
  }),
  agent: one(agents, {
    fields: [transactionAgents.agentId],
    references: [agents.id],
  }),
}));
```

Also add `transactionAgents: many(transactionAgents)` to both `transactionsRelations` and `agentsRelations`.

- [ ] **Step 3: Export the new type**

At the bottom of `schema.ts` add:
```typescript
export type TransactionAgent = typeof transactionAgents.$inferSelect;
export type NewTransactionAgent = typeof transactionAgents.$inferInsert;
```

- [ ] **Step 4: Push schema**

```bash
npm run db:push
```
Expected: `[✓] Changes applied`

- [ ] **Step 5: Commit**

```bash
git add src/db/schema.ts
git commit -m "feat(schema): add transaction_agents junction table"
```

---

## Task 3: Update agents actions with `isInHouse` support

**Files:**
- Modify: `src/actions/agents.ts`

- [ ] **Step 1: Add `isInHouse` to `AgentFormValues` and the internal Zod schema**

```typescript
export type AgentFormValues = {
  name: string;
  email: string;
  phone?: string;
  broker?: string;
  licenseNumber?: string;
  brokerageId?: string;
  isInHouse?: boolean;
};

const agentSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Valid email required'),
  phone: z.string().optional(),
  broker: z.string().optional(),
  licenseNumber: z.string().optional(),
  brokerageId: z.string().optional(),
  isInHouse: z.boolean().optional(),
});
```

- [ ] **Step 2: Add `isInHouse` to `AgentWithStats` type and `getAgents` query**

```typescript
export type AgentWithStats = Agent & { transactionCount: number };
```

`Agent` type from the schema now includes `isInHouse`, so `AgentWithStats` automatically picks it up. Update `getAgents` to select `isInHouse`:

```typescript
export async function getAgents(): Promise<AgentWithStats[]> {
  const rows = await db
    .select({
      id: agents.id,
      name: agents.name,
      email: agents.email,
      phone: agents.phone,
      broker: agents.broker,
      licenseNumber: agents.licenseNumber,
      brokerageId: agents.brokerageId,
      isActive: agents.isActive,
      isInHouse: agents.isInHouse,
      createdAt: agents.createdAt,
      updatedAt: agents.updatedAt,
      transactionCount: sql<number>`count(distinct ${transactionAgents.transactionId})`,
    })
    .from(agents)
    .leftJoin(transactionAgents, eq(transactionAgents.agentId, agents.id))
    .groupBy(agents.id)
    .orderBy(asc(agents.name));

  return rows;
}
```

Add `transactionAgents` to imports from `@/db/schema`.

- [ ] **Step 3: Add `isInHouse` to `getAgentsForSelect` return type and query**

```typescript
export async function getAgentsForSelect(): Promise<{
  id: string;
  name: string;
  broker: string | null;
  email: string;
  phone: string | null;
  isInHouse: boolean;
}[]> {
  return db
    .select({
      id: agents.id,
      name: agents.name,
      broker: agents.broker,
      email: agents.email,
      phone: agents.phone,
      isInHouse: agents.isInHouse,
    })
    .from(agents)
    .where(eq(agents.isActive, true))
    .orderBy(asc(agents.name));
}
```

- [ ] **Step 4: Add `isInHouse` to `createAgent` and `updateAgent` insert/update calls**

In `createAgent`, add to the insert values:
```typescript
isInHouse: v.isInHouse ?? false,
```

In `updateAgent`, add to the update set:
```typescript
isInHouse: v.isInHouse ?? false,
```

- [ ] **Step 5: Update `deleteAgent` to check `transaction_agents` instead of old FK columns**

```typescript
export async function deleteAgent(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    const linked = await db
      .select({ id: transactionAgents.id })
      .from(transactionAgents)
      .where(eq(transactionAgents.agentId, id))
      .limit(1);

    if (linked.length > 0) {
      return { success: false, error: 'Agent has linked transactions. Deactivate instead.' };
    }

    await db.delete(agents).where(eq(agents.id, id));
    revalidatePath('/agents');
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to delete agent';
    return { success: false, error: message };
  }
}
```

- [ ] **Step 6: Add `toggleAgentInHouse` action**

```typescript
export async function toggleAgentInHouse(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    const [agent] = await db
      .select({ isInHouse: agents.isInHouse })
      .from(agents)
      .where(eq(agents.id, id));

    if (!agent) return { success: false, error: 'Agent not found' };

    await db
      .update(agents)
      .set({ isInHouse: !agent.isInHouse, updatedAt: new Date() })
      .where(eq(agents.id, id));

    revalidatePath('/agents');
    revalidatePath('/transactions');
    revalidatePath('/dashboard');
    return { success: true };
  } catch {
    return { success: false, error: 'Failed to update agent' };
  }
}
```

- [ ] **Step 7: Commit**

```bash
git add src/actions/agents.ts
git commit -m "feat(agents): add isInHouse support to agent actions"
```

---

## Task 4: Update agents form and page with `isInHouse`

**Files:**
- Modify: `src/components/agents/agent-form.tsx`
- Modify: `src/app/(dashboard)/agents/page.tsx`

- [ ] **Step 1: Read `agent-form.tsx`** to understand its current field structure before editing.

- [ ] **Step 2: Add `isInHouse` checkbox to `AgentForm`**

In `agent-form.tsx`, add `isInHouse` to the form's default values and fields. Near the broker field, add:

```tsx
<div className="flex items-center gap-2">
  <input
    type="checkbox"
    id="isInHouse"
    {...register('isInHouse')}
    className="size-4"
  />
  <Label htmlFor="isInHouse" className="text-sm font-normal cursor-pointer">
    In-House Agent (Bertolone Realty)
  </Label>
</div>
```

Add `isInHouse` to the Zod schema inside the form (or pass it through via `AgentFormValues`):
```typescript
isInHouse: z.boolean().optional(),
```

And in the default values:
```typescript
isInHouse: agent?.isInHouse ?? false,
```

- [ ] **Step 3: Add In-House badge and toggle to agents page**

In `src/app/(dashboard)/agents/page.tsx`:

Import `toggleAgentInHouse` alongside existing imports:
```typescript
import { getAgents, toggleAgentActive, deleteAgent, toggleAgentInHouse } from '@/actions/agents';
```

Add handler:
```typescript
function handleToggleInHouse(agent: AgentWithStats) {
  startTransition(async () => {
    const result = await toggleAgentInHouse(agent.id);
    if (result.success) {
      toast.success(agent.isInHouse ? 'Marked as outside agent' : 'Marked as in-house');
      handleFormSuccess();
    } else {
      toast.error(result.error ?? 'Failed to update agent');
    }
  });
}
```

Add a "Type" column to the table header:
```tsx
<TableHead className="hidden sm:table-cell">Type</TableHead>
```

Add the cell in each row (after the Name cell):
```tsx
<TableCell className="hidden sm:table-cell">
  <button
    type="button"
    onClick={() => handleToggleInHouse(agent)}
    title="Click to toggle in-house status"
  >
    <Badge variant={agent.isInHouse ? 'default' : 'outline'} className="text-xs cursor-pointer">
      {agent.isInHouse ? 'In-House' : 'Outside'}
    </Badge>
  </button>
</TableCell>
```

- [ ] **Step 4: Verify in browser**

Navigate to `/agents`. Confirm agents show "In-House" or "Outside" badge. Edit an agent and confirm the checkbox appears. Toggle in-house from the badge.

- [ ] **Step 5: Commit**

```bash
git add src/components/agents/agent-form.tsx src/app/(dashboard)/agents/page.tsx
git commit -m "feat(agents): add isInHouse badge and toggle to agents page"
```

---

## Task 5: Create `transaction-agents.ts` server actions

**Files:**
- Create: `src/actions/transaction-agents.ts`

- [ ] **Step 1: Create the file**

```typescript
'use server';

import { db } from '@/db/client';
import { transactionAgents, agents } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

export type TransactionAgentEntry = {
  id: string;
  agentId: string;
  name: string;
  phone: string | null;
  email: string;
  broker: string | null;
  isInHouse: boolean;
  isPrimary: boolean;
  sortOrder: number;
  side: 'listing' | 'buyer';
};

export async function getTransactionAgents(transactionId: string): Promise<{
  listing: TransactionAgentEntry[];
  buyer: TransactionAgentEntry[];
}> {
  const rows = await db
    .select({
      id: transactionAgents.id,
      agentId: transactionAgents.agentId,
      name: agents.name,
      phone: agents.phone,
      email: agents.email,
      broker: agents.broker,
      isInHouse: agents.isInHouse,
      isPrimary: transactionAgents.isPrimary,
      sortOrder: transactionAgents.sortOrder,
      side: transactionAgents.side,
    })
    .from(transactionAgents)
    .innerJoin(agents, eq(transactionAgents.agentId, agents.id))
    .where(eq(transactionAgents.transactionId, transactionId))
    .orderBy(transactionAgents.sortOrder);

  return {
    listing: rows.filter((r) => r.side === 'listing') as TransactionAgentEntry[],
    buyer: rows.filter((r) => r.side === 'buyer') as TransactionAgentEntry[],
  };
}

export async function addTransactionAgent(
  transactionId: string,
  agentId: string,
  side: 'listing' | 'buyer',
  isPrimary: boolean,
): Promise<{ success: boolean; error?: string }> {
  try {
    // Prevent duplicate
    const existing = await db
      .select({ id: transactionAgents.id })
      .from(transactionAgents)
      .where(
        and(
          eq(transactionAgents.transactionId, transactionId),
          eq(transactionAgents.agentId, agentId),
          eq(transactionAgents.side, side),
        ),
      )
      .limit(1);

    if (existing.length > 0) {
      return { success: false, error: 'Agent is already added to this side.' };
    }

    // If setting primary, clear existing primaries on this side
    if (isPrimary) {
      await db
        .update(transactionAgents)
        .set({ isPrimary: false })
        .where(
          and(
            eq(transactionAgents.transactionId, transactionId),
            eq(transactionAgents.side, side),
          ),
        );
    }

    await db.insert(transactionAgents).values({
      id: crypto.randomUUID(),
      transactionId,
      agentId,
      side,
      isPrimary,
      sortOrder: 0,
    });

    revalidatePath(`/transactions/${transactionId}`);
    revalidatePath('/transactions');
    revalidatePath('/dashboard');
    return { success: true };
  } catch {
    return { success: false, error: 'Failed to add agent.' };
  }
}

export async function removeTransactionAgent(
  transactionId: string,
  agentId: string,
  side: 'listing' | 'buyer',
): Promise<{ success: boolean; error?: string }> {
  try {
    await db
      .delete(transactionAgents)
      .where(
        and(
          eq(transactionAgents.transactionId, transactionId),
          eq(transactionAgents.agentId, agentId),
          eq(transactionAgents.side, side),
        ),
      );

    revalidatePath(`/transactions/${transactionId}`);
    revalidatePath('/transactions');
    revalidatePath('/dashboard');
    return { success: true };
  } catch {
    return { success: false, error: 'Failed to remove agent.' };
  }
}

export async function setTransactionAgentPrimary(
  transactionId: string,
  agentId: string,
  side: 'listing' | 'buyer',
): Promise<{ success: boolean; error?: string }> {
  try {
    // Clear all primaries on this side
    await db
      .update(transactionAgents)
      .set({ isPrimary: false })
      .where(
        and(
          eq(transactionAgents.transactionId, transactionId),
          eq(transactionAgents.side, side),
        ),
      );

    // Set the new primary
    await db
      .update(transactionAgents)
      .set({ isPrimary: true })
      .where(
        and(
          eq(transactionAgents.transactionId, transactionId),
          eq(transactionAgents.agentId, agentId),
          eq(transactionAgents.side, side),
        ),
      );

    revalidatePath(`/transactions/${transactionId}`);
    return { success: true };
  } catch {
    return { success: false, error: 'Failed to set primary agent.' };
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/actions/transaction-agents.ts
git commit -m "feat(actions): add transaction-agents CRUD actions"
```

---

## Task 6: Write and run the one-time data migration script

**Files:**
- Create: `src/db/migrate-to-multi-agent.ts`

- [ ] **Step 1: Create migration script**

```typescript
import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import * as schema from './schema';
import { isNotNull } from 'drizzle-orm';
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
      buyerAgentId: schema.transactions.buyerAgentId,
    })
    .from(schema.transactions)
    .where(
      schema.transactions.sellerAgentId
        ? isNotNull(schema.transactions.sellerAgentId)
        : undefined,
    );

  let inserted = 0;
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
    }
  }

  // Mark existing agents that were used as sellerAgentId as isInHouse
  const inHouseAgentIds = txs
    .filter((t) => t.sellerAgentId !== null)
    .map((t) => t.sellerAgentId as string);

  if (inHouseAgentIds.length > 0) {
    const uniqueIds = [...new Set(inHouseAgentIds)];
    for (const id of uniqueIds) {
      await db
        .update(schema.agents)
        .set({ isInHouse: true })
        .where(schema.agents.id ? require('drizzle-orm').eq(schema.agents.id, id) : undefined);
    }
    console.log(`  Marked ${uniqueIds.length} agents as in-house.`);
  }

  console.log(`  Inserted ${inserted} transaction_agents rows.`);
  console.log('Migration complete.');
  process.exit(0);
}

migrate().catch((e) => { console.error(e); process.exit(1); });
```

> **Note:** After running, manually verify the agents that were marked `isInHouse = true` on the Agents page. The script marks all former `sellerAgentId` agents as in-house as a starting point — adjust as needed via the UI toggle.

- [ ] **Step 2: Run the migration from your terminal** (not Claude's bash — needs npx tsx)

```bash
npx tsx src/db/migrate-to-multi-agent.ts
```

Expected output:
```
Migrating existing agent FKs to transaction_agents...
  Inserted N transaction_agents rows.
  Marked N agents as in-house.
Migration complete.
```

- [ ] **Step 3: Verify in Drizzle Studio**

```bash
npm run db:studio
```

Open the `transaction_agents` table and confirm rows exist for your transactions.

- [ ] **Step 4: Commit**

```bash
git add src/db/migrate-to-multi-agent.ts
git commit -m "chore(db): add one-time migration script for multi-agent refactor"
```

---

## Task 7: Update `TransactionSummary` type and `getTransactions` query

**Files:**
- Modify: `src/actions/transactions.ts`

- [ ] **Step 1: Add `TransactionAgentEntry` import and update `TransactionSummary` type**

Add import at top:
```typescript
import { transactionAgents } from '@/db/schema';
```

Replace the agent fields in `TransactionSummary` with arrays:
```typescript
export type TransactionAgentEntry = {
  agentId: string;
  name: string;
  phone: string | null;
  email: string;
  broker: string | null;
  isInHouse: boolean;
  isPrimary: boolean;
};

export type TransactionSummary = {
  id: string;
  address: string;
  city: string | null;
  state: string | null;
  zipCode: string | null;
  mlsNumber: string | null;
  transactionType: string;
  status: string;
  propertyType: string | null;
  buyerName: string | null;
  sellerName: string | null;
  expectedCloseDate: string | null;
  sellerTcName: string | null;
  sellerTcPhone: string | null;
  sellerTcEmail: string | null;
  buyerTcName: string | null;
  buyerTcPhone: string | null;
  buyerTcEmail: string | null;
  totalTasks: number;
  completedTasks: number;
  listingAgents: TransactionAgentEntry[];
  buyerAgents: TransactionAgentEntry[];
};
```

- [ ] **Step 2: Rewrite `getTransactions`**

```typescript
export async function getTransactions(): Promise<AgentTransactionGroup[]> {
  const rows = await db
    .select({
      id: transactions.id,
      address: transactions.address,
      city: transactions.city,
      state: transactions.state,
      zipCode: transactions.zipCode,
      mlsNumber: transactions.mlsNumber,
      transactionType: transactions.transactionType,
      status: transactions.status,
      propertyType: transactions.propertyType,
      buyerName: transactions.buyerName,
      sellerName: transactions.sellerName,
      expectedCloseDate: transactions.expectedCloseDate,
      sellerTcName: transactions.sellerTcName,
      sellerTcPhone: transactions.sellerTcPhone,
      sellerTcEmail: transactions.sellerTcEmail,
      buyerTcName: transactions.buyerTcName,
      buyerTcPhone: transactions.buyerTcPhone,
      buyerTcEmail: transactions.buyerTcEmail,
    })
    .from(transactions)
    .orderBy(desc(transactions.createdAt));

  if (rows.length === 0) return [];

  const txIds = rows.map((r) => r.id);

  const [taskCountRows, agentRows] = await Promise.all([
    db
      .select({
        transactionId: transactionTasks.transactionId,
        total: count(),
        completed: sql<number>`sum(case when ${transactionTasks.status} = 'completed' then 1 else 0 end)`,
      })
      .from(transactionTasks)
      .groupBy(transactionTasks.transactionId),

    db
      .select({
        transactionId: transactionAgents.transactionId,
        agentId: transactionAgents.agentId,
        side: transactionAgents.side,
        isPrimary: transactionAgents.isPrimary,
        sortOrder: transactionAgents.sortOrder,
        name: agents.name,
        phone: agents.phone,
        email: agents.email,
        broker: agents.broker,
        isInHouse: agents.isInHouse,
      })
      .from(transactionAgents)
      .innerJoin(agents, eq(transactionAgents.agentId, agents.id))
      .where(inArray(transactionAgents.transactionId, txIds))
      .orderBy(transactionAgents.sortOrder),
  ]);

  const countMap = new Map(
    taskCountRows.map((r) => [r.transactionId, { total: r.total, completed: r.completed ?? 0 }]),
  );

  // Build per-transaction agent map
  const agentMap = new Map<string, { listing: TransactionAgentEntry[]; buyer: TransactionAgentEntry[] }>();
  for (const a of agentRows) {
    if (!agentMap.has(a.transactionId)) {
      agentMap.set(a.transactionId, { listing: [], buyer: [] });
    }
    const entry: TransactionAgentEntry = {
      agentId: a.agentId,
      name: a.name,
      phone: a.phone,
      email: a.email,
      broker: a.broker,
      isInHouse: a.isInHouse,
      isPrimary: a.isPrimary,
    };
    agentMap.get(a.transactionId)![a.side === 'listing' ? 'listing' : 'buyer'].push(entry);
  }

  const summaries: TransactionSummary[] = rows.map((r) => {
    const counts = countMap.get(r.id) ?? { total: 0, completed: 0 };
    const txAgents = agentMap.get(r.id) ?? { listing: [], buyer: [] };
    return {
      ...r,
      totalTasks: counts.total,
      completedTasks: Number(counts.completed),
      listingAgents: txAgents.listing,
      buyerAgents: txAgents.buyer,
    };
  });

  // Group by in-house agents only
  const groupMap = new Map<string, AgentTransactionGroup>();
  const ungroupedKey = '__none__';

  for (const s of summaries) {
    const inHouseListingAgents = s.listingAgents.filter((a) => a.isInHouse);
    const inHouseBuyerAgents = s.buyerAgents.filter((a) => a.isInHouse);
    const inHouseAgents = [...inHouseListingAgents, ...inHouseBuyerAgents];

    if (inHouseAgents.length === 0) {
      if (!groupMap.has(ungroupedKey)) {
        groupMap.set(ungroupedKey, { agentId: null, agentName: null, transactions: [] });
      }
      groupMap.get(ungroupedKey)!.transactions.push(s);
    } else {
      for (const a of inHouseAgents) {
        if (!groupMap.has(a.agentId)) {
          groupMap.set(a.agentId, { agentId: a.agentId, agentName: a.name, transactions: [] });
        }
        groupMap.get(a.agentId)!.transactions.push(s);
      }
    }
  }

  return Array.from(groupMap.values());
}
```

Add `inArray` and `agents` to the imports from `drizzle-orm` and `@/db/schema`.

- [ ] **Step 3: Commit**

```bash
git add src/actions/transactions.ts
git commit -m "feat(transactions): rewrite getTransactions with multi-agent junction table"
```

---

## Task 8: Update `getTransactionDetail` to return agent arrays

**Files:**
- Modify: `src/actions/transactions.ts`

- [ ] **Step 1: Update `TransactionDetail` type**

```typescript
export type TransactionDetail = Transaction & {
  sellerAgentName: string | null;
  sellerInHouseEmail: string | null;
  sellerInHousePhone: string | null;
  sellerInHouseBroker: string | null;
  buyerAgentName: string | null;
  buyerInHouseEmail: string | null;
  buyerInHousePhone: string | null;
  buyerInHouseBroker: string | null;
  listingAgents: TransactionAgentEntry[];
  buyerAgents: TransactionAgentEntry[];
  tasks: TransactionTask[];
  activity: ActivityEntry[];
};
```

(Keep the legacy `sellerAgentName` etc. fields during the transition — they will be removed in Task 15.)

- [ ] **Step 2: Add agent query inside `getTransactionDetail`**

After fetching the transaction row, add:
```typescript
const agentRows = await db
  .select({
    agentId: transactionAgents.agentId,
    side: transactionAgents.side,
    isPrimary: transactionAgents.isPrimary,
    sortOrder: transactionAgents.sortOrder,
    name: agents.name,
    phone: agents.phone,
    email: agents.email,
    broker: agents.broker,
    isInHouse: agents.isInHouse,
  })
  .from(transactionAgents)
  .innerJoin(agents, eq(transactionAgents.agentId, agents.id))
  .where(eq(transactionAgents.transactionId, id))
  .orderBy(transactionAgents.sortOrder);

const listingAgents: TransactionAgentEntry[] = agentRows
  .filter((r) => r.side === 'listing')
  .map((r) => ({
    agentId: r.agentId,
    name: r.name,
    phone: r.phone,
    email: r.email,
    broker: r.broker,
    isInHouse: r.isInHouse,
    isPrimary: r.isPrimary,
  }));

const buyerAgents: TransactionAgentEntry[] = agentRows
  .filter((r) => r.side === 'buyer')
  .map((r) => ({
    agentId: r.agentId,
    name: r.name,
    phone: r.phone,
    email: r.email,
    broker: r.broker,
    isInHouse: r.isInHouse,
    isPrimary: r.isPrimary,
  }));
```

Add `listingAgents` and `buyerAgents` to the returned object.

- [ ] **Step 3: Commit**

```bash
git add src/actions/transactions.ts
git commit -m "feat(transactions): add listingAgents/buyerAgents to getTransactionDetail"
```

---

## Task 9: Update `createTransaction` to accept agents and remove agent form fields

**Files:**
- Modify: `src/actions/transactions.ts`
- Modify: `src/lib/transaction-schema.ts`

- [ ] **Step 1: Remove agent fields from `transaction-schema.ts`**

Delete these fields from the Zod schema:
```
sellerAgentId, sellerAgentIsInHouse, sellerAgentCompany, sellerAgentPhone, sellerAgentEmail,
buyerAgentId, buyerAgentIsInHouse, buyerAgentCompany, buyerAgentPhone, buyerAgentEmail,
sellerAgent, buyerAgent
```

The schema after removal retains all other fields (TC fields, dates, financials, etc.).

- [ ] **Step 2: Define `FormAgentInput` type in `transactions.ts`**

Add near the top of `src/actions/transactions.ts`:
```typescript
export type FormAgentInput = {
  agentId: string;
  side: 'listing' | 'buyer';
  isPrimary: boolean;
};
```

- [ ] **Step 3: Update `createTransaction` signature and body**

Change signature to:
```typescript
export async function createTransaction(
  values: TransactionFormValues,
  agentInputs: FormAgentInput[] = [],
): Promise<{ success: boolean; data?: { id: string }; error?: string }>
```

Remove all agent-related fields from the `db.insert(transactions)` call:
- Remove: `sellerAgentId`, `sellerAgentIsInHouse`, `sellerAgentCompany`, `sellerAgentPhone`, `sellerAgentEmail`
- Remove: `buyerAgentId`, `buyerAgentIsInHouse`, `buyerAgentCompany`, `buyerAgentPhone`, `buyerAgentEmail`
- Remove: `sellerAgent`, `buyerAgent`, `agentId`

After inserting the transaction, insert agents:
```typescript
if (agentInputs.length > 0) {
  // Clear primaries per side before inserting
  const sides = [...new Set(agentInputs.map((a) => a.side))];
  for (const s of agentInputs) {
    await db.insert(transactionAgents).values({
      id: crypto.randomUUID(),
      transactionId: id,
      agentId: s.agentId,
      side: s.side,
      isPrimary: s.isPrimary,
      sortOrder: 0,
    });
  }
}
```

- [ ] **Step 4: Update `updateTransaction` — remove agent fields from set()**

In `updateTransaction`, remove all agent fields from the `.set({})` call:
- Remove: `sellerAgentId`, `sellerAgentIsInHouse`, `sellerAgentCompany`, `sellerAgentPhone`, `sellerAgentEmail`
- Remove: `buyerAgentId`, `buyerAgentIsInHouse`, `buyerAgentCompany`, `buyerAgentPhone`, `buyerAgentEmail`
- Remove: `sellerAgent`, `buyerAgent`

Agent updates on existing transactions go through `transaction-agents.ts` actions directly.

- [ ] **Step 5: Commit**

```bash
git add src/actions/transactions.ts src/lib/transaction-schema.ts
git commit -m "feat(transactions): update create/update actions for multi-agent schema"
```

---

## Task 10: Build `AgentPickerDialog` component

**Files:**
- Create: `src/components/transactions/agent-picker-dialog.tsx`

- [ ] **Step 1: Create the component**

```tsx
'use client';

import { useState, useTransition } from 'react';
import { Search, Plus, Star } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { createAgent } from '@/actions/agents';
import type { AgentFormValues } from '@/actions/agents';

export type AgentOption = {
  id: string;
  name: string;
  broker: string | null;
  email: string;
  phone: string | null;
  isInHouse: boolean;
};

interface AgentPickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  side: 'listing' | 'buyer';
  existingAgentIds: string[];
  agents: AgentOption[];
  onAdd: (agentId: string, isPrimary: boolean) => void;
  onAgentCreated?: (agent: AgentOption) => void;
}

export function AgentPickerDialog({
  open,
  onOpenChange,
  side,
  existingAgentIds,
  agents,
  onAdd,
  onAgentCreated,
}: AgentPickerDialogProps) {
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isPrimary, setIsPrimary] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newAgent, setNewAgent] = useState<Partial<AgentFormValues>>({});
  const [isPending, startTransition] = useTransition();

  const filtered = agents
    .filter((a) => !existingAgentIds.includes(a.id))
    .filter((a) => {
      const q = search.toLowerCase();
      return (
        !q ||
        a.name.toLowerCase().includes(q) ||
        (a.broker ?? '').toLowerCase().includes(q) ||
        a.email.toLowerCase().includes(q)
      );
    });

  const inHouse = filtered.filter((a) => a.isInHouse);
  const outside = filtered.filter((a) => !a.isInHouse);

  function handleConfirm() {
    if (!selectedId) return;
    onAdd(selectedId, isPrimary);
    reset();
    onOpenChange(false);
  }

  function reset() {
    setSearch('');
    setSelectedId(null);
    setIsPrimary(false);
    setShowCreateForm(false);
    setNewAgent({});
  }

  function handleCreateAgent() {
    if (!newAgent.name || !newAgent.email) return;
    startTransition(async () => {
      const result = await createAgent(newAgent as AgentFormValues);
      if (result.success && result.data) {
        const created: AgentOption = {
          id: result.data.id,
          name: result.data.name,
          broker: result.data.broker,
          email: result.data.email,
          phone: result.data.phone,
          isInHouse: newAgent.isInHouse ?? false,
        };
        onAgentCreated?.(created);
        setSelectedId(created.id);
        setShowCreateForm(false);
        toast.success(`${created.name} added to agent directory`);
      } else {
        toast.error(result.error ?? 'Failed to create agent');
      }
    });
  }

  const sideLabel = side === 'listing' ? 'Listing Agent' : "Buyer's Agent";

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add {sideLabel}</DialogTitle>
        </DialogHeader>

        {!showCreateForm ? (
          <>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                placeholder="Search agents..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8"
              />
            </div>

            <div className="max-h-64 overflow-y-auto space-y-3">
              {inHouse.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide px-1 mb-1">In-House</p>
                  {inHouse.map((a) => (
                    <AgentRow key={a.id} agent={a} selected={selectedId === a.id} onSelect={setSelectedId} />
                  ))}
                </div>
              )}
              {outside.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide px-1 mb-1">Outside</p>
                  {outside.map((a) => (
                    <AgentRow key={a.id} agent={a} selected={selectedId === a.id} onSelect={setSelectedId} />
                  ))}
                </div>
              )}
              {filtered.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-6">No agents found</p>
              )}
            </div>

            <div className="flex items-center gap-2 pt-1">
              <Checkbox
                id="isPrimary"
                checked={isPrimary}
                onCheckedChange={(v) => setIsPrimary(!!v)}
              />
              <Label htmlFor="isPrimary" className="text-sm font-normal cursor-pointer flex items-center gap-1">
                <Star className="size-3 text-yellow-500" />
                Set as Primary
              </Label>
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowCreateForm(true)}
              >
                <Plus className="size-4 mr-1" />
                New Agent
              </Button>
              <Button size="sm" onClick={handleConfirm} disabled={!selectedId}>
                Add Agent
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <div className="space-y-3">
              <div className="grid gap-1.5">
                <Label htmlFor="newName">Name *</Label>
                <Input
                  id="newName"
                  value={newAgent.name ?? ''}
                  onChange={(e) => setNewAgent((p) => ({ ...p, name: e.target.value }))}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="newEmail">Email *</Label>
                <Input
                  id="newEmail"
                  type="email"
                  value={newAgent.email ?? ''}
                  onChange={(e) => setNewAgent((p) => ({ ...p, email: e.target.value }))}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="newPhone">Phone</Label>
                <Input
                  id="newPhone"
                  value={newAgent.phone ?? ''}
                  onChange={(e) => setNewAgent((p) => ({ ...p, phone: e.target.value }))}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="newBroker">Brokerage</Label>
                <Input
                  id="newBroker"
                  value={newAgent.broker ?? ''}
                  onChange={(e) => setNewAgent((p) => ({ ...p, broker: e.target.value }))}
                />
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="newIsInHouse"
                  checked={newAgent.isInHouse ?? false}
                  onCheckedChange={(v) => setNewAgent((p) => ({ ...p, isInHouse: !!v }))}
                />
                <Label htmlFor="newIsInHouse" className="text-sm font-normal cursor-pointer">
                  In-House Agent (Bertolone Realty)
                </Label>
              </div>
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" size="sm" onClick={() => setShowCreateForm(false)}>
                Back
              </Button>
              <Button
                size="sm"
                onClick={handleCreateAgent}
                disabled={isPending || !newAgent.name || !newAgent.email}
              >
                {isPending ? 'Saving...' : 'Save & Select'}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function AgentRow({
  agent,
  selected,
  onSelect,
}: {
  agent: AgentOption;
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(agent.id)}
      className={cn(
        'w-full text-left px-3 py-2 rounded-md text-sm transition-colors',
        selected ? 'bg-primary text-primary-foreground' : 'hover:bg-muted',
      )}
    >
      <div className="font-medium">{agent.name}</div>
      {agent.broker && <div className="text-xs opacity-70">{agent.broker}</div>}
    </button>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/transactions/agent-picker-dialog.tsx
git commit -m "feat(ui): add AgentPickerDialog component"
```

---

## Task 11: Update transaction detail — stacked agent cards

**Files:**
- Modify: `src/components/transactions/transaction-detail.tsx`

- [ ] **Step 1: Read the current Contacts section of transaction-detail.tsx** (around lines 385–430) to understand the existing `ContactCard` component structure.

- [ ] **Step 2: Add `AgentCard` component near the top of the file (after imports)**

```tsx
function AgentCard({
  agent,
  transactionId,
  side,
  onRemove,
  onSetPrimary,
}: {
  agent: import('@/actions/transactions').TransactionAgentEntry;
  transactionId: string;
  side: 'listing' | 'buyer';
  onRemove: (agentId: string) => void;
  onSetPrimary: (agentId: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1 p-3 rounded-md border bg-card text-sm">
      <div className="flex items-center justify-between gap-2">
        <span className={cn('font-semibold', agent.isPrimary && 'text-primary')}>
          {agent.name}
        </span>
        <div className="flex items-center gap-1 shrink-0">
          {agent.isPrimary && (
            <Badge className="text-[10px] px-1.5 py-0 h-4">Primary</Badge>
          )}
          {!agent.isPrimary && (
            <button
              type="button"
              className="text-xs text-muted-foreground hover:text-foreground underline"
              onClick={() => onSetPrimary(agent.agentId)}
            >
              Set primary
            </button>
          )}
          <button
            type="button"
            className="text-muted-foreground hover:text-destructive transition-colors ml-1"
            onClick={() => onRemove(agent.agentId)}
            aria-label="Remove agent"
          >
            <X className="size-3.5" />
          </button>
        </div>
      </div>
      {agent.broker && <div className="text-xs text-muted-foreground">{agent.broker}</div>}
      <div className="flex items-center gap-3 mt-0.5">
        {agent.phone && (
          <button
            type="button"
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            onClick={() => { navigator.clipboard.writeText(agent.phone!); toast.success('Phone copied'); }}
          >
            <Phone className="size-3" />
            {agent.phone}
          </button>
        )}
        {agent.email && (
          <button
            type="button"
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            onClick={() => { navigator.clipboard.writeText(agent.email); toast.success('Email copied'); }}
          >
            <Mail className="size-3" />
            <span className="truncate max-w-[160px]">{agent.email}</span>
          </button>
        )}
      </div>
    </div>
  );
}
```

Add `X`, `Phone`, `Mail` to lucide imports.

- [ ] **Step 3: Add state and handlers for agents in `TransactionDetail`**

```tsx
const [listingAgents, setListingAgents] = useState(tx.listingAgents);
const [buyerAgents, setBuyerAgents] = useState(tx.buyerAgents);
const [pickerOpen, setPickerOpen] = useState<'listing' | 'buyer' | null>(null);
const [allAgents, setAllAgents] = useState<AgentOption[]>([]);
const [, startAgentTransition] = useTransition();
```

Import `AgentOption` and `AgentPickerDialog` from `@/components/transactions/agent-picker-dialog`.
Import `addTransactionAgent`, `removeTransactionAgent`, `setTransactionAgentPrimary` from `@/actions/transaction-agents`.

Load agents for the picker on mount:
```tsx
useEffect(() => {
  getAgentsForSelect().then((data) => setAllAgents(data));
}, []);
```

Import `getAgentsForSelect` from `@/actions/agents`.

Handlers:
```tsx
function handleAddAgent(agentId: string, isPrimary: boolean) {
  const side = pickerOpen!;
  startAgentTransition(async () => {
    const result = await addTransactionAgent(tx.id, agentId, side, isPrimary);
    if (result.success) {
      const agent = allAgents.find((a) => a.id === agentId)!;
      const entry = { agentId, name: agent.name, phone: agent.phone, email: agent.email, broker: agent.broker, isInHouse: agent.isInHouse, isPrimary };
      if (side === 'listing') {
        setListingAgents((prev) => isPrimary ? prev.map((a) => ({ ...a, isPrimary: false })).concat(entry) : [...prev, entry]);
      } else {
        setBuyerAgents((prev) => isPrimary ? prev.map((a) => ({ ...a, isPrimary: false })).concat(entry) : [...prev, entry]);
      }
      toast.success('Agent added');
    } else {
      toast.error(result.error ?? 'Failed to add agent');
    }
  });
}

function handleRemoveAgent(agentId: string, side: 'listing' | 'buyer') {
  startAgentTransition(async () => {
    const result = await removeTransactionAgent(tx.id, agentId, side);
    if (result.success) {
      if (side === 'listing') setListingAgents((prev) => prev.filter((a) => a.agentId !== agentId));
      else setBuyerAgents((prev) => prev.filter((a) => a.agentId !== agentId));
      toast.success('Agent removed');
    } else {
      toast.error(result.error ?? 'Failed to remove agent');
    }
  });
}

function handleSetPrimary(agentId: string, side: 'listing' | 'buyer') {
  startAgentTransition(async () => {
    const result = await setTransactionAgentPrimary(tx.id, agentId, side);
    if (result.success) {
      const update = (prev: typeof listingAgents) =>
        prev.map((a) => ({ ...a, isPrimary: a.agentId === agentId }));
      if (side === 'listing') setListingAgents(update);
      else setBuyerAgents(update);
      toast.success('Primary agent updated');
    } else {
      toast.error(result.error ?? 'Failed to set primary');
    }
  });
}
```

- [ ] **Step 4: Replace the old Listing Agent / Buyer's Agent `ContactCard` blocks with the new stacked cards**

Find the Contacts section in the detail view and replace the `ContactCard` for agents with:

```tsx
{/* Listing Agents */}
<div>
  <div className="flex items-center justify-between mb-2">
    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Listing Agents</h4>
    <Button size="sm" variant="ghost" className="h-6 text-xs gap-1" onClick={() => setPickerOpen('listing')}>
      <Plus className="size-3" /> Add
    </Button>
  </div>
  <div className="space-y-2">
    {listingAgents.map((a) => (
      <AgentCard
        key={a.agentId}
        agent={a}
        transactionId={tx.id}
        side="listing"
        onRemove={(id) => handleRemoveAgent(id, 'listing')}
        onSetPrimary={(id) => handleSetPrimary(id, 'listing')}
      />
    ))}
    {listingAgents.length === 0 && (
      <p className="text-xs text-muted-foreground italic">No listing agents</p>
    )}
  </div>
</div>

{/* Buyer Agents */}
<div>
  <div className="flex items-center justify-between mb-2">
    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Buyer&apos;s Agents</h4>
    <Button size="sm" variant="ghost" className="h-6 text-xs gap-1" onClick={() => setPickerOpen('buyer')}>
      <Plus className="size-3" /> Add
    </Button>
  </div>
  <div className="space-y-2">
    {buyerAgents.map((a) => (
      <AgentCard
        key={a.agentId}
        agent={a}
        transactionId={tx.id}
        side="buyer"
        onRemove={(id) => handleRemoveAgent(id, 'buyer')}
        onSetPrimary={(id) => handleSetPrimary(id, 'buyer')}
      />
    ))}
    {buyerAgents.length === 0 && (
      <p className="text-xs text-muted-foreground italic">No buyer&apos;s agents</p>
    )}
  </div>
</div>

<AgentPickerDialog
  open={!!pickerOpen}
  onOpenChange={(v) => !v && setPickerOpen(null)}
  side={pickerOpen ?? 'listing'}
  existingAgentIds={pickerOpen === 'listing' ? listingAgents.map((a) => a.agentId) : buyerAgents.map((a) => a.agentId)}
  agents={allAgents}
  onAdd={handleAddAgent}
  onAgentCreated={(a) => setAllAgents((prev) => [...prev, a])}
/>
```

- [ ] **Step 5: Verify in browser**

Open a transaction detail page. Confirm listing and buyer agent cards render. Test Add, Remove, Set Primary.

- [ ] **Step 6: Commit**

```bash
git add src/components/transactions/transaction-detail.tsx
git commit -m "feat(ui): stacked agent cards with add/remove/primary on transaction detail"
```

---

## Task 12: Update transaction form — agent picker

**Files:**
- Modify: `src/components/transactions/transaction-form.tsx`

- [ ] **Step 1: Read `transaction-form.tsx`** fully to understand the `AgentPickerField` usage and form structure before editing.

- [ ] **Step 2: Add agent state tracking to the form**

Inside `TransactionForm`, add:
```tsx
const [listingAgents, setListingAgents] = useState<FormAgentInput[]>([]);
const [buyerAgents, setBuyerAgents] = useState<FormAgentInput[]>([]);
const [pickerSide, setPickerSide] = useState<'listing' | 'buyer' | null>(null);
const [allAgents, setAllAgents] = useState<AgentOption[]>([]);
```

Import `FormAgentInput` from `@/actions/transactions`.
Import `AgentOption`, `AgentPickerDialog` from `@/components/transactions/agent-picker-dialog`.

Load agents on mount (or when form opens):
```tsx
useEffect(() => {
  if (open) getAgentsForSelect().then(setAllAgents);
}, [open]);
```

When editing an existing transaction, pre-populate from `tx.listingAgents` / `tx.buyerAgents`:
```tsx
useEffect(() => {
  if (transaction) {
    setListingAgents(
      (transaction.listingAgents ?? []).map((a) => ({
        agentId: a.agentId,
        side: 'listing' as const,
        isPrimary: a.isPrimary,
      }))
    );
    setBuyerAgents(
      (transaction.buyerAgents ?? []).map((a) => ({
        agentId: a.agentId,
        side: 'buyer' as const,
        isPrimary: a.isPrimary,
      }))
    );
  } else {
    setListingAgents([]);
    setBuyerAgents([]);
  }
}, [transaction, open]);
```

- [ ] **Step 3: Add `handlePickerAdd` and agent display helpers**

```tsx
function handlePickerAdd(agentId: string, isPrimary: boolean) {
  const side = pickerSide!;
  const newEntry: FormAgentInput = { agentId, side, isPrimary };
  if (side === 'listing') {
    setListingAgents((prev) => {
      const cleared = isPrimary ? prev.map((a) => ({ ...a, isPrimary: false })) : prev;
      return [...cleared, newEntry];
    });
  } else {
    setBuyerAgents((prev) => {
      const cleared = isPrimary ? prev.map((a) => ({ ...a, isPrimary: false })) : prev;
      return [...cleared, newEntry];
    });
  }
  setPickerSide(null);
}

function removeFormAgent(agentId: string, side: 'listing' | 'buyer') {
  if (side === 'listing') setListingAgents((prev) => prev.filter((a) => a.agentId !== agentId));
  else setBuyerAgents((prev) => prev.filter((a) => a.agentId !== agentId));
}
```

- [ ] **Step 4: Update form `onSubmit` to pass agents**

In the submit handler, change `createTransaction(values)` to `createTransaction(values, [...listingAgents, ...buyerAgents])`.

For `updateTransaction`, agent changes are managed separately through the detail page, so no change needed to the update call.

- [ ] **Step 5: Replace `AgentPickerField` sections in the form JSX**

Find the Seller's Agent and Buyer's Agent form sections and replace with:

```tsx
{/* Listing Agents */}
<div className="space-y-2">
  <div className="flex items-center justify-between">
    <Label className="text-sm font-medium">Listing Agents</Label>
    <Button type="button" variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => setPickerSide('listing')}>
      <Plus className="size-3" /> Add
    </Button>
  </div>
  {listingAgents.map((a) => {
    const info = allAgents.find((ag) => ag.id === a.agentId);
    return (
      <div key={a.agentId} className="flex items-center justify-between text-sm border rounded px-3 py-2">
        <div>
          <span className="font-medium">{info?.name ?? a.agentId}</span>
          {a.isPrimary && <Badge className="ml-2 text-[10px] px-1.5 py-0 h-4">Primary</Badge>}
        </div>
        <Button type="button" variant="ghost" size="sm" className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive" onClick={() => removeFormAgent(a.agentId, 'listing')}>
          <X className="size-3" />
        </Button>
      </div>
    );
  })}
</div>

{/* Buyer Agents */}
<div className="space-y-2">
  <div className="flex items-center justify-between">
    <Label className="text-sm font-medium">Buyer&apos;s Agents</Label>
    <Button type="button" variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => setPickerSide('buyer')}>
      <Plus className="size-3" /> Add
    </Button>
  </div>
  {buyerAgents.map((a) => {
    const info = allAgents.find((ag) => ag.id === a.agentId);
    return (
      <div key={a.agentId} className="flex items-center justify-between text-sm border rounded px-3 py-2">
        <div>
          <span className="font-medium">{info?.name ?? a.agentId}</span>
          {a.isPrimary && <Badge className="ml-2 text-[10px] px-1.5 py-0 h-4">Primary</Badge>}
        </div>
        <Button type="button" variant="ghost" size="sm" className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive" onClick={() => removeFormAgent(a.agentId, 'buyer')}>
          <X className="size-3" />
        </Button>
      </div>
    );
  })}
</div>

<AgentPickerDialog
  open={!!pickerSide}
  onOpenChange={(v) => !v && setPickerSide(null)}
  side={pickerSide ?? 'listing'}
  existingAgentIds={pickerSide === 'listing' ? listingAgents.map((a) => a.agentId) : buyerAgents.map((a) => a.agentId)}
  agents={allAgents}
  onAdd={handlePickerAdd}
  onAgentCreated={(a) => setAllAgents((prev) => [...prev, a])}
/>
```

- [ ] **Step 6: Verify in browser**

Open "New Transaction". Confirm the agent picker appears. Add a listing and buyer agent. Submit the form. Confirm the transaction was created with agents.

- [ ] **Step 7: Commit**

```bash
git add src/components/transactions/transaction-form.tsx
git commit -m "feat(ui): replace AgentPickerField with multi-agent picker in transaction form"
```

---

## Task 13: Update `TransactionCard` in agent-group.tsx

**Files:**
- Modify: `src/components/transactions/agent-group.tsx`

- [ ] **Step 1: Update `TransactionCard` to display agents from `listingAgents`/`buyerAgents` arrays**

Replace the existing `ContactMini` blocks for agents with:

```tsx
{/* Listing Agents */}
{tx.listingAgents.map((a) => (
  <ContactMini
    key={a.agentId}
    label={a.isPrimary ? 'Listing Agent ★' : 'Listing Agent'}
    name={a.name}
    phone={a.phone}
    email={a.email}
  />
))}
{/* Buyer Agents */}
{tx.buyerAgents.map((a) => (
  <ContactMini
    key={a.agentId}
    label={a.isPrimary ? "Buyer's Agent ★" : "Buyer's Agent"}
    name={a.name}
    phone={a.phone}
    email={a.email}
  />
))}
```

Update `hasContacts` to use the new arrays:
```tsx
const hasContacts =
  tx.listingAgents.length > 0 ||
  tx.buyerAgents.length > 0 ||
  tx.sellerTcName || tx.sellerTcPhone || tx.sellerTcEmail ||
  tx.buyerTcName || tx.buyerTcPhone || tx.buyerTcEmail;
```

Remove the old `sellerAgentName/Phone/Email` and `buyerAgentName/Phone/Email` references.

- [ ] **Step 2: Commit**

```bash
git add src/components/transactions/agent-group.tsx
git commit -m "feat(ui): update transaction card to display multi-agent arrays"
```

---

## Task 14: Update `active-transactions-card` on dashboard

**Files:**
- Modify: `src/components/dashboard/active-transactions-card.tsx`
- Modify: `src/actions/transactions.ts`

- [ ] **Step 1: Update `ActiveTransactionRow` type in `transactions.ts`**

Replace the `sellerAgentName`/`buyerAgentName` scalar fields with:
```typescript
export type ActiveTransactionRow = {
  id: string;
  address: string;
  city: string | null;
  expectedCloseDate: string | null;
  transactionType: string;
  totalTasks: number;
  completedTasks: number;
  primaryListingAgent: string | null;
  primaryBuyerAgent: string | null;
};
```

- [ ] **Step 2: Update `getActiveTransactionsList` query**

Rewrite to use a subquery for primary agents:
```typescript
export async function getActiveTransactionsList(): Promise<ActiveTransactionRow[]> {
  const rows = await db
    .select({
      id: transactions.id,
      address: transactions.address,
      city: transactions.city,
      expectedCloseDate: transactions.expectedCloseDate,
      transactionType: transactions.transactionType,
    })
    .from(transactions)
    .where(notInArray(transactions.status, ['closed', 'cancelled']))
    .orderBy(asc(transactions.expectedCloseDate));

  if (rows.length === 0) return [];

  const txIds = rows.map((r) => r.id);

  const [taskRows, agentRows] = await Promise.all([
    db
      .select({
        transactionId: transactionTasks.transactionId,
        total: count(),
        completed: sql<number>`sum(case when ${transactionTasks.status} = 'completed' then 1 else 0 end)`,
      })
      .from(transactionTasks)
      .innerJoin(transactions, eq(transactionTasks.transactionId, transactions.id))
      .where(
        and(
          inArray(transactionTasks.transactionId, txIds),
          notInArray(transactions.status, ['closed', 'cancelled']),
        ),
      )
      .groupBy(transactionTasks.transactionId),

    db
      .select({
        transactionId: transactionAgents.transactionId,
        side: transactionAgents.side,
        isPrimary: transactionAgents.isPrimary,
        name: agents.name,
        sortOrder: transactionAgents.sortOrder,
      })
      .from(transactionAgents)
      .innerJoin(agents, eq(transactionAgents.agentId, agents.id))
      .where(inArray(transactionAgents.transactionId, txIds))
      .orderBy(transactionAgents.isPrimary, transactionAgents.sortOrder),
  ]);

  const countMap = new Map(
    taskRows.map((r) => [r.transactionId, { total: r.total, completed: r.completed ?? 0 }]),
  );

  // For each transaction, pick the primary (or first) agent per side
  const agentMap = new Map<string, { listing: string | null; buyer: string | null }>();
  for (const a of agentRows) {
    if (!agentMap.has(a.transactionId)) agentMap.set(a.transactionId, { listing: null, buyer: null });
    const entry = agentMap.get(a.transactionId)!;
    if (a.side === 'listing' && (entry.listing === null || a.isPrimary)) entry.listing = a.name;
    if (a.side === 'buyer' && (entry.buyer === null || a.isPrimary)) entry.buyer = a.name;
  }

  return rows.map((r) => {
    const counts = countMap.get(r.id) ?? { total: 0, completed: 0 };
    const agents = agentMap.get(r.id) ?? { listing: null, buyer: null };
    return {
      ...r,
      totalTasks: counts.total,
      completedTasks: Number(counts.completed),
      primaryListingAgent: agents.listing,
      primaryBuyerAgent: agents.buyer,
    };
  });
}
```

- [ ] **Step 3: Update `active-transactions-card.tsx`**

Replace the agent display line:
```tsx
// Old:
const agents = [tx.sellerAgentName, tx.buyerAgentName].filter(Boolean).join(' · ');
// New:
const agentDisplay = [tx.primaryListingAgent, tx.primaryBuyerAgent].filter(Boolean).join(' · ');
```

Update the JSX to use `agentDisplay` instead of `agents`.

- [ ] **Step 4: Commit**

```bash
git add src/actions/transactions.ts src/components/dashboard/active-transactions-card.tsx
git commit -m "feat(dashboard): update active transactions card for multi-agent"
```

---

## Task 15: Update seed for new schema

**Files:**
- Modify: `src/db/seed.ts`

- [ ] **Step 1: Add `isInHouse: true` to in-house agent inserts**

In the agents seed section, add `isInHouse: true` to the agents that belong to the brokerage (e.g. `agent1Id`, `agent2Id`).

- [ ] **Step 2: Add `transaction_agents` rows after transactions are seeded**

After inserting transactions, add agent links. Example:
```typescript
// Seed transaction_agents
console.log('  Seeding transaction agents...');
const txAgentRows = [];
// For each transaction that has a sellerAgentId or buyerAgentId in the seed data,
// insert a transaction_agents row
for (const tx of seededTransactions) {
  if (tx.sellerAgentId) {
    txAgentRows.push({
      id: uuid(),
      transactionId: tx.id,
      agentId: tx.sellerAgentId,
      side: 'listing' as const,
      isPrimary: true,
      sortOrder: 0,
    });
  }
  if (tx.buyerAgentId) {
    txAgentRows.push({
      id: uuid(),
      transactionId: tx.id,
      agentId: tx.buyerAgentId,
      side: 'buyer' as const,
      isPrimary: true,
      sortOrder: 0,
    });
  }
}
if (txAgentRows.length > 0) {
  await db.insert(schema.transactionAgents).values(txAgentRows);
}
```

- [ ] **Step 3: Verify seed runs cleanly from Windows terminal**

```bash
npm run db:seed
```

Expected: completes without errors, logs "Seeding transaction agents..."

- [ ] **Step 4: Commit**

```bash
git add src/db/seed.ts
git commit -m "chore(seed): add isInHouse and transaction_agents to seed data"
```

---

## Task 16: Drop legacy agent columns from transactions (final cleanup)

> **Prerequisites:** Tasks 1–15 complete and verified in the browser. All agent data is confirmed in `transaction_agents`.

**Files:**
- Modify: `src/db/schema.ts`

- [ ] **Step 1: Remove legacy columns from `transactions` table in schema.ts**

Delete these fields:
```
agentId, sellerAgentId, sellerAgentIsInHouse, sellerAgentCompany, sellerAgentPhone, sellerAgentEmail,
buyerAgentId, buyerAgentIsInHouse, buyerAgentCompany, buyerAgentPhone, buyerAgentEmail,
sellerAgent, buyerAgent
```

Also remove the `sellerAgent`/`buyerAgent` Drizzle relations from `transactionsRelations`.

- [ ] **Step 2: Remove legacy fields from `TransactionDetail` type in transactions.ts**

Remove: `sellerAgentName`, `sellerInHouseEmail`, `sellerInHousePhone`, `sellerInHouseBroker`, `buyerAgentName`, `buyerInHouseEmail`, `buyerInHousePhone`, `buyerInHouseBroker` from `TransactionDetail`.

- [ ] **Step 3: Push schema**

```bash
npm run db:push
```

Review the prompt carefully — confirm only the legacy agent columns are being dropped, not `transaction_agents`.

Expected: `[✓] Changes applied`

- [ ] **Step 4: Run `npm run build` to catch any remaining type errors**

```bash
npm run build
```

Fix any TypeScript errors that reference the dropped columns.

- [ ] **Step 5: Final browser verification**

- Transactions list loads and groups correctly by in-house agent
- Transaction cards show agent names
- Transaction detail shows stacked agent cards with contact info
- Add agent, remove agent, set primary all work
- Create new transaction with agents works
- Dashboard active transactions card shows agent names

- [ ] **Step 6: Final commit**

```bash
git add -A
git commit -m "feat: complete multi-agent refactor — drop legacy agent columns"
```
