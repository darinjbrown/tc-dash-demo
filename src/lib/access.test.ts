import { describe, it, expect, vi } from 'vitest';

// Mock server-only modules so pure functions can be tested in Node without Next.js
vi.mock('@/lib/auth', () => ({ auth: vi.fn() }));
vi.mock('@/db/client', () => ({ db: {} }));

import { normalizeEmail, computeViewerScope, isReadOnlyRole } from '@/lib/access';

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
});

describe('isReadOnlyRole', () => {
  it('only agent is read-only', () => {
    expect(isReadOnlyRole('agent')).toBe(true);
    expect(isReadOnlyRole('admin')).toBe(false);
    expect(isReadOnlyRole('tc')).toBe(false);
  });
});
