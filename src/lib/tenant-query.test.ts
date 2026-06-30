import { describe, it, expect, vi } from 'vitest';

// Mock server-only modules so pure functions can be tested in Node without Next.js.
vi.mock('@/lib/auth', () => ({ auth: vi.fn() }));
vi.mock('@/db/client', () => {
  const chain: Record<string, (...a: unknown[]) => unknown> = {};
  chain.select = () => chain;
  chain.from = () => chain;
  chain.where = () => chain;
  return { db: chain };
});

import { tenantPredicate } from './tenant-query';
import { transactions } from '@/db/schema';
import type { ViewerScope } from './access';

const base: ViewerScope = {
  userId: 'u1', role: 'admin', tenantId: 't1', isPlatformAdmin: false,
  agentIds: null, actingAs: null,
};

// Drizzle SQL objects do not stringify their text via String(); flatten the
// query chunks to inspect the rendered predicate text (StringChunks + column names).
function render(sql: unknown): string {
  const chunks = (sql as { queryChunks?: unknown[] } | undefined)?.queryChunks ?? [];
  return chunks
    .map((c) => {
      const v = (c as { value?: unknown }).value;
      if (Array.isArray(v)) return v.join('');
      const name = (c as { name?: unknown }).name;
      return typeof name === 'string' ? name : '';
    })
    .join('');
}

describe('tenantPredicate', () => {
  it('scopes to the viewer tenant', () => {
    const sql = tenantPredicate(base, transactions.tenantId);
    expect(render(sql)).toContain('tenant_id');
  });
  it('fail-closed (1=0) for tenant-less non-platform viewer', () => {
    const sql = tenantPredicate({ ...base, tenantId: null }, transactions.tenantId);
    expect(render(sql)).toContain('1 = 0');
  });
});
