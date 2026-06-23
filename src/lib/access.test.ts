import { describe, it, expect, vi } from 'vitest';

// Mock server-only modules so pure functions can be tested in Node without Next.js
vi.mock('@/lib/auth', () => ({ auth: vi.fn() }));
vi.mock('@/db/client', () => ({ db: {} }));

import {
  normalizeEmail,
  computeViewerScope,
  isReadOnlyRole,
  canManageAll,
  transactionScopeCondition,
} from '@/lib/access';

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
  it('agent gets restricted to matched agent ids', () => {
    const scope = computeViewerScope({ role: 'agent', userId: 'u1', matchedAgentIds: ['a1', 'a2'] });
    expect(scope.agentIds).toEqual(['a1', 'a2']);
  });
  it('agent with no match is fail-closed (empty array, NOT null)', () => {
    const scope = computeViewerScope({ role: 'agent', userId: 'u1', matchedAgentIds: [] });
    expect(scope.agentIds).toEqual([]);
  });
  it('admin/broker/tc are unrestricted (null)', () => {
    for (const role of ['admin', 'broker', 'tc']) {
      expect(computeViewerScope({ role, userId: 'u1', matchedAgentIds: [] }).agentIds).toBeNull();
    }
  });
  it('an unknown role is fail-closed (restricted, never null)', () => {
    const scope = computeViewerScope({ role: 'superadmin', userId: 'u1', matchedAgentIds: [] });
    expect(scope.agentIds).toEqual([]);
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
  it('returns undefined (no filter) only for unrestricted viewers', () => {
    expect(
      transactionScopeCondition({ role: 'admin', userId: 'u1', agentIds: null }),
    ).toBeUndefined();
  });
  it('returns a real condition (NOT undefined) for a no-match agent — must see nothing', () => {
    const cond = transactionScopeCondition({ role: 'agent', userId: 'u1', agentIds: [] });
    expect(cond).toBeDefined();
  });
});

// ============================================================
// Multi-tenant scope (Phases 0/2/8). Phase 0 scaffolds the block;
// Phase 2 adds the resolver tests; Phase 8 adds isolation tests.
// ============================================================
describe('tenant scope (multi-tenant)', () => {
  it('scaffold present (filled in Phase 2)', () => {
    expect(true).toBe(true);
  });
});
