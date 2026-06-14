import { describe, it, expect } from 'vitest';
// No mocks needed: roles.ts imports nothing from auth or the database.
import { canManageAll, isReadOnlyRole, isForbiddenForRole } from '@/lib/roles';

describe('canManageAll / isReadOnlyRole', () => {
  it('privileged roles can manage all', () => {
    for (const role of ['admin', 'broker', 'tc']) {
      expect(canManageAll(role)).toBe(true);
      expect(isReadOnlyRole(role)).toBe(false);
    }
  });
  it('agent and unrecognized roles are read-only (fail-closed)', () => {
    for (const role of ['agent', 'superadmin', '', 'garbage']) {
      expect(canManageAll(role)).toBe(false);
      expect(isReadOnlyRole(role)).toBe(true);
    }
  });
});

describe('isForbiddenForRole', () => {
  it('blocks read-only roles from admin route prefixes (incl. unknown roles)', () => {
    const paths = ['/agents', '/settings', '/templates', '/users', '/settings/profile', '/users/123'];
    for (const path of paths) {
      expect(isForbiddenForRole(path, 'agent')).toBe(true);
      expect(isForbiddenForRole(path, 'mystery')).toBe(true); // fail-closed
    }
  });
  it('never blocks privileged roles', () => {
    for (const path of ['/agents', '/settings', '/templates', '/users']) {
      expect(isForbiddenForRole(path, 'admin')).toBe(false);
      expect(isForbiddenForRole(path, 'tc')).toBe(false);
    }
  });
  it('allows read-only roles on their permitted routes', () => {
    for (const path of ['/dashboard', '/transactions', '/transactions/abc']) {
      expect(isForbiddenForRole(path, 'agent')).toBe(false);
    }
  });
  it('does not over-match similar path prefixes', () => {
    expect(isForbiddenForRole('/users-report', 'agent')).toBe(false);
    expect(isForbiddenForRole('/settingsx', 'agent')).toBe(false);
  });
});
