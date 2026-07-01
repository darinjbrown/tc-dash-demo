/**
 * Acting scope == native scope (predicate equivalence).
 *
 * The cross-tenant *cache* leak the council warned about requires a tenant-blind
 * Data Cache; there is none today (no `unstable_cache`/`use cache`, all dashboard
 * routes are dynamic). So the meaningful guarantee locked in here is: an ACTING
 * effective scope for tenant X produces the IDENTICAL tenant predicate as a NATIVE
 * tenant-admin scope for tenant X — acting never widens or narrows scope vs. a real
 * admin — and a DIFFERENT acting tenant yields a DIFFERENT predicate. Pure (no DB).
 */
import { describe, it, expect, vi } from 'vitest';

// access.ts imports @/lib/auth (NextAuth -> next/server) and @/db/client (connects
// to Turso at import time). We only exercise its PURE tenantScopeCondition, so stub
// both server-only modules to load the module in plain Node.
vi.mock('@/lib/auth', () => ({ auth: vi.fn() }));
vi.mock('@/db/client', () => {
  const chain: Record<string, (...a: unknown[]) => unknown> = {};
  chain.select = () => chain;
  chain.from = () => chain;
  chain.where = () => chain;
  return { db: chain };
});

import { tenantScopeCondition, type ViewerScope } from './access';
import { transactions } from '@/db/schema';

// Drizzle SQL objects stringify to "[object Object]"; flatten the query chunks to
// the rendered predicate text — StringChunks, column names, AND bound param values
// (the tenant id) — so equality/inequality assertions compare real predicates.
function renderSql(sql: unknown): string {
  const chunks = (sql as { queryChunks?: unknown[] } | undefined)?.queryChunks ?? [];
  return chunks
    .map((c) => {
      const v = (c as { value?: unknown }).value;
      if (Array.isArray(v)) return v.join('');
      if (typeof v === 'string') return v; // bound Param value (e.g. the tenant id)
      const name = (c as { name?: unknown }).name;
      return typeof name === 'string' ? name : '';
    })
    .join('');
}

const native: ViewerScope = {
  userId: 'u-native', role: 'admin', tenantId: 'tenantA', isPlatformAdmin: false,
  agentIds: null, actingAs: null,
};
const acting: ViewerScope = {
  userId: 'admin1', role: 'admin', tenantId: 'tenantA', isPlatformAdmin: false,
  agentIds: null, actingAs: { realAdminId: 'admin1', tenantId: 'tenantA', expiresAt: 9 },
};

describe('acting scope equivalence', () => {
  it('acting tenant predicate equals the native tenant-admin predicate', () => {
    const a = renderSql(tenantScopeCondition(acting, transactions.tenantId));
    const n = renderSql(tenantScopeCondition(native, transactions.tenantId));
    expect(a).toBe(n);
    expect(a).toContain('tenant_id'); // a real eq() predicate, not the no-filter branch
  });

  it('a DIFFERENT acting tenant yields a different predicate (no cross-tenant widening)', () => {
    const actingB: ViewerScope = { ...acting, tenantId: 'tenantB',
      actingAs: { realAdminId: 'admin1', tenantId: 'tenantB', expiresAt: 9 } };
    const a = renderSql(tenantScopeCondition(acting, transactions.tenantId));
    const b = renderSql(tenantScopeCondition(actingB, transactions.tenantId));
    expect(a).not.toBe(b);
  });
});
