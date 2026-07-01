import { describe, it, expect, vi } from 'vitest';

// Mock server-only modules so pure functions can be tested in Node without Next.js
vi.mock('@/lib/auth', () => ({ auth: vi.fn() }));
vi.mock('@/db/client', () => {
  // Chainable stub so transactionScopeCondition's IN-subquery builds without a real DB.
  const chain: Record<string, (...a: unknown[]) => unknown> = {};
  chain.select = () => chain;
  chain.from = () => chain;
  chain.where = () => chain;
  return { db: chain };
});

import {
  normalizeEmail,
  computeViewerScope,
  isReadOnlyRole,
  canManageAll,
  transactionScopeCondition,
  tenantScopeCondition,
} from '@/lib/access';
import type { ViewerScope } from '@/lib/access';
import { tenants, transactions } from '@/db/schema';

describe('normalizeEmail', () => {
  it('lowercases and trims', () => {
    expect(normalizeEmail('  Jane@Example.COM ')).toBe('jane@example.com');
  });
  it('returns empty string for null/undefined', () => {
    expect(normalizeEmail(null)).toBe('');
    expect(normalizeEmail(undefined)).toBe('');
  });
});

describe('computeViewerScope', () => {
  const T = { tenantId: 't1', isPlatformAdmin: false } as const;
  it('agent gets restricted to matched agent ids', () => {
    const scope = computeViewerScope({ role: 'agent', userId: 'u1', ...T, matchedAgentIds: ['a1', 'a2'] });
    expect(scope.agentIds).toEqual(['a1', 'a2']);
  });
  it('agent with no match is fail-closed (empty array, NOT null)', () => {
    const scope = computeViewerScope({ role: 'agent', userId: 'u1', ...T, matchedAgentIds: [] });
    expect(scope.agentIds).toEqual([]);
  });
  it('admin/broker/tc are unrestricted on the agent ring (null)', () => {
    for (const role of ['admin', 'broker', 'tc']) {
      expect(
        computeViewerScope({ role, userId: 'u1', ...T, matchedAgentIds: [] }).agentIds,
      ).toBeNull();
    }
  });
  it('an unknown role is fail-closed (restricted, never null)', () => {
    const scope = computeViewerScope({ role: 'superadmin', userId: 'u1', ...T, matchedAgentIds: [] });
    expect(scope.agentIds).toEqual([]);
  });
  it('carries tenantId + isPlatformAdmin onto the scope', () => {
    const scope = computeViewerScope({ role: 'tc', userId: 'u1', tenantId: 't9', isPlatformAdmin: false, matchedAgentIds: [] });
    expect(scope.tenantId).toBe('t9');
    expect(scope.isPlatformAdmin).toBe(false);
  });
  it('platform admin is unrestricted on the agent ring even with a null tenant', () => {
    const scope = computeViewerScope({ role: 'agent', userId: 'p1', tenantId: null, isPlatformAdmin: true, matchedAgentIds: [] });
    expect(scope.agentIds).toBeNull();
  });
});

describe('acting effective scope', () => {
  it('acting input => effective tenant admin, no platform flag, actingAs preserved', () => {
    const s = computeViewerScope({
      role: 'admin', userId: 'admin1', tenantId: 't-target', isPlatformAdmin: false,
      matchedAgentIds: [], actingAs: { realAdminId: 'admin1', tenantId: 't-target', expiresAt: 9 },
    });
    expect(s.tenantId).toBe('t-target');
    expect(s.isPlatformAdmin).toBe(false);
    expect(s.agentIds).toBeNull();
    expect(s.actingAs).toEqual({ realAdminId: 'admin1', tenantId: 't-target', expiresAt: 9 });
  });
});

describe('canManageAll', () => {
  it('is an allowlist of privileged roles', () => {
    expect(canManageAll('admin')).toBe(true);
    expect(canManageAll('broker')).toBe(true);
    expect(canManageAll('tc')).toBe(true);
  });
  it('denies agent and unrecognized roles (fail-closed)', () => {
    expect(canManageAll('agent')).toBe(false);
    expect(canManageAll('superadmin')).toBe(false);
    expect(canManageAll('')).toBe(false);
  });
});

describe('isReadOnlyRole', () => {
  it('is the complement of canManageAll', () => {
    expect(isReadOnlyRole('agent')).toBe(true);
    expect(isReadOnlyRole('superadmin')).toBe(true);
    expect(isReadOnlyRole('admin')).toBe(false);
    expect(isReadOnlyRole('tc')).toBe(false);
  });
});

describe('transactionScopeCondition', () => {
  const tenantBound = { tenantId: 't1', isPlatformAdmin: false };
  it('returns undefined (no filter) only for unrestricted viewers', () => {
    expect(
      transactionScopeCondition({ role: 'admin', userId: 'u1', ...tenantBound, agentIds: null, actingAs: null }),
    ).toBeUndefined();
  });
  it('returns a real condition (NOT undefined) for a no-match agent — must see nothing', () => {
    const cond = transactionScopeCondition({ role: 'agent', userId: 'u1', ...tenantBound, agentIds: [], actingAs: null });
    expect(cond).toBeDefined();
  });
});

// ============================================================
// Multi-tenant scope (Phase 2 resolver logic; Phase 8 isolation properties)
// ============================================================

function scope(partial: Partial<ViewerScope>): ViewerScope {
  return {
    userId: 'u1',
    role: 'tc',
    tenantId: 't1',
    isPlatformAdmin: false,
    agentIds: null,
    actingAs: null,
    ...partial,
  };
}

describe('tenantScopeCondition', () => {
  it('returns undefined (no tenant filter) for a platform admin with no tenant', () => {
    const cond = tenantScopeCondition(
      scope({ isPlatformAdmin: true, tenantId: null }),
      tenants.id,
    );
    expect(cond).toBeUndefined();
  });

  it('returns a fail-closed condition (1=0, NOT undefined) when there is no tenant and not a platform admin', () => {
    const cond = tenantScopeCondition(scope({ tenantId: null, isPlatformAdmin: false }), tenants.id);
    // Must be defined so it can be ANDed in and match zero rows.
    expect(cond).toBeDefined();
  });

  it('returns an equality predicate for a normal tenant-bound viewer', () => {
    const cond = tenantScopeCondition(scope({ tenantId: 't42' }), transactions.tenantId);
    expect(cond).toBeDefined();
  });
});

describe('composition: tenant ring AND agent ring', () => {
  it('a tenant-bound broker is unrestricted on the agent ring but still tenant-scoped', () => {
    const s = computeViewerScope({
      role: 'broker',
      userId: 'u1',
      tenantId: 't1',
      isPlatformAdmin: false,
      matchedAgentIds: [],
    });
    // inner ring: unrestricted
    expect(transactionScopeCondition(s)).toBeUndefined();
    // outer ring: still bound to the tenant (real predicate, not undefined)
    expect(tenantScopeCondition(s, transactions.tenantId)).toBeDefined();
  });

  it('a tenant-bound agent is restricted on BOTH rings', () => {
    const s = computeViewerScope({
      role: 'agent',
      userId: 'u1',
      tenantId: 't1',
      isPlatformAdmin: false,
      matchedAgentIds: ['a1'],
    });
    expect(transactionScopeCondition(s)).toBeDefined(); // inner ring active
    expect(tenantScopeCondition(s, transactions.tenantId)).toBeDefined(); // outer ring active
  });
});
