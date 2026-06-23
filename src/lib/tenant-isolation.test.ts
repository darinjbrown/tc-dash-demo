/**
 * Phase 8 — cross-tenant isolation (integration).
 *
 * Spins up an in-memory libSQL DB, applies the real generated migration, seeds
 * TWO tenants with their own agents/transactions/tasks/templates, then proves
 * the isolation PROPERTY end-to-end: a viewer in tenant A, given tenant-B ids,
 * reads zero rows and writes zero rows. This is the test that gates any release
 * touching the data layer.
 *
 * It exercises the SAME predicates the actions use — tenantScopeCondition for
 * reads and `eq(table.tenantId, scope.tenantId)` for writes — against a real
 * SQLite engine, so a regression in the schema or predicate shape fails here.
 */
import { describe, it, expect, beforeAll, vi } from 'vitest';

// access.ts imports @/lib/auth (NextAuth -> next/server) and @/db/client (which
// connects to Turso at import time). We only use access.ts's PURE functions, so
// stub auth, and point @/db/client at our in-memory db (set in beforeAll).
vi.mock('@/lib/auth', () => ({ auth: vi.fn() }));
const holder: { db: unknown } = { db: undefined };
vi.mock('@/db/client', () => ({ get db() { return holder.db; } }));
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { createClient, type Client } from '@libsql/client';
import { drizzle, type LibSQLDatabase } from 'drizzle-orm/libsql';
import { and, eq } from 'drizzle-orm';
import * as schema from '@/db/schema';
import {
  agents,
  transactions,
  transactionAgents,
  transactionTasks,
  taskTemplates,
  taskTemplateGroups,
} from '@/db/schema';
import { computeViewerScope, tenantScopeCondition } from '@/lib/access';

let client: Client;
let db: LibSQLDatabase<typeof schema>;

const A = { tenantId: 'tenant-A' };
const B = { tenantId: 'tenant-B' };

async function applyMigrations() {
  const dir = join(process.cwd(), 'src/db/migrations');
  const files = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
  for (const f of files) {
    const sql = readFileSync(join(dir, f), 'utf8');
    // Drizzle separates statements with this marker.
    const statements = sql.split('--> statement-breakpoint');
    for (const stmt of statements) {
      const trimmed = stmt.trim();
      if (trimmed) await client.execute(trimmed);
    }
  }
}

async function seedTenant(t: { tenantId: string }, suffix: string) {
  const id = (p: string) => `${p}-${suffix}`;
  await db.insert(schema.tenants).values({
    id: t.tenantId, name: `Office ${suffix}`, slug: `office-${suffix}`,
    isActive: true, billingStatus: 'manual',
  });
  await db.insert(agents).values({
    id: id('agent'), tenantId: t.tenantId, name: `Agent ${suffix}`, email: `a-${suffix}@x.test`,
    isActive: true,
  });
  await db.insert(taskTemplateGroups).values({
    id: id('grp'), tenantId: t.tenantId, name: 'Listing', transactionType: 'listing',
    isDefault: true, isActive: true, sortOrder: 0,
  });
  await db.insert(taskTemplates).values({
    id: id('tpl'), tenantId: t.tenantId, templateGroupId: id('grp'), name: 'Task',
    category: 'opening', relativeDueDays: 1, relativeTo: 'acceptance_date', sortOrder: 0,
    isRequired: true, isActive: true,
  });
  await db.insert(transactions).values({
    id: id('tx'), tenantId: t.tenantId, address: `${suffix} Main St`, transactionType: 'listing',
    status: 'listed',
  });
  await db.insert(transactionAgents).values({
    id: id('ta'), tenantId: t.tenantId, transactionId: id('tx'), agentId: id('agent'),
    side: 'listing', isPrimary: true, sortOrder: 0,
  });
  await db.insert(transactionTasks).values({
    id: id('task'), tenantId: t.tenantId, transactionId: id('tx'), name: 'Stamped',
    category: 'opening', status: 'pending', priority: 'medium', sortOrder: 0,
  });
}

beforeAll(async () => {
  client = createClient({ url: ':memory:' });
  db = drizzle(client, { schema });
  holder.db = db;
  await applyMigrations();
  await seedTenant(A, 'A');
  await seedTenant(B, 'B');
});

// A privileged viewer (tc) bound to a tenant: unrestricted on the agent ring,
// but bound on the tenant ring.
function scopeFor(tenantId: string) {
  return computeViewerScope({
    role: 'tc', userId: 'u', tenantId, isPlatformAdmin: false, matchedAgentIds: [],
  });
}

describe('cross-tenant read isolation', () => {
  it('tenant A sees only its own transactions', async () => {
    const rows = await db
      .select()
      .from(transactions)
      .where(tenantScopeCondition(scopeFor(A.tenantId), transactions.tenantId));
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe('tx-A');
  });

  it('tenant A sees only its own agents / templates / tasks', async () => {
    const a = await db.select().from(agents).where(tenantScopeCondition(scopeFor(A.tenantId), agents.tenantId));
    const t = await db.select().from(taskTemplates).where(tenantScopeCondition(scopeFor(A.tenantId), taskTemplates.tenantId));
    const k = await db.select().from(transactionTasks).where(tenantScopeCondition(scopeFor(A.tenantId), transactionTasks.tenantId));
    expect(a.map((r) => r.tenantId)).toEqual(['tenant-A']);
    expect(t.map((r) => r.tenantId)).toEqual(['tenant-A']);
    expect(k.map((r) => r.tenantId)).toEqual(['tenant-A']);
  });

  it("a forged tenant-B id returns ZERO rows when read under tenant A's scope", async () => {
    // Mirrors the action read path: eq(id) AND tenantScopeCondition.
    const rows = await db
      .select()
      .from(transactions)
      .where(and(eq(transactions.id, 'tx-B'), tenantScopeCondition(scopeFor(A.tenantId), transactions.tenantId)));
    expect(rows).toHaveLength(0);
  });
});

describe('cross-tenant write isolation', () => {
  it("updating a forged tenant-B transaction under tenant A's scope affects ZERO rows", async () => {
    // Mirrors the action write path: .where(and(eq(id), eq(tenantId, scope.tenantId)))
    const res = await db
      .update(transactions)
      .set({ status: 'cancelled' })
      .where(and(eq(transactions.id, 'tx-B'), eq(transactions.tenantId, A.tenantId)));
    expect(res.rowsAffected).toBe(0);

    // Tenant B's row is untouched.
    const [b] = await db.select().from(transactions).where(eq(transactions.id, 'tx-B'));
    expect(b.status).toBe('listed');
  });

  it("deleting a forged tenant-B agent under tenant A's scope affects ZERO rows", async () => {
    const res = await db
      .delete(agents)
      .where(and(eq(agents.id, 'agent-B'), eq(agents.tenantId, A.tenantId)));
    expect(res.rowsAffected).toBe(0);
    const [b] = await db.select().from(agents).where(eq(agents.id, 'agent-B'));
    expect(b).toBeTruthy();
  });

  it('a legitimate same-tenant update DOES affect the row', async () => {
    const res = await db
      .update(transactions)
      .set({ notes: 'ok' })
      .where(and(eq(transactions.id, 'tx-A'), eq(transactions.tenantId, A.tenantId)));
    expect(res.rowsAffected).toBe(1);
  });
});

describe('fail-closed when no tenant', () => {
  it('a non-platform viewer with no tenant matches NOTHING (1=0)', async () => {
    const noTenant = computeViewerScope({
      role: 'tc', userId: 'u', tenantId: null, isPlatformAdmin: false, matchedAgentIds: [],
    });
    const rows = await db
      .select()
      .from(transactions)
      .where(tenantScopeCondition(noTenant, transactions.tenantId));
    expect(rows).toHaveLength(0);
  });

  it('a platform admin (no tenant) is UNFILTERED and sees every tenant', async () => {
    const platform = computeViewerScope({
      role: 'admin', userId: 'p', tenantId: null, isPlatformAdmin: true, matchedAgentIds: [],
    });
    // undefined predicate -> no filter -> all rows
    const cond = tenantScopeCondition(platform, transactions.tenantId);
    expect(cond).toBeUndefined();
    const rows = await db.select().from(transactions).where(cond);
    expect(rows.length).toBeGreaterThanOrEqual(2);
  });
});
