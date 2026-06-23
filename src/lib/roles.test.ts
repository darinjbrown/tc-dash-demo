import { describe, it, expect } from 'vitest';
// No mocks needed: roles.ts imports nothing from auth or the database.
import { canManageAll, isReadOnlyRole, isForbiddenForRole , isTenantLoginAllowed} from '@/lib/roles';

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

describe('isTenantLoginAllowed (inactive-tenant gate)', () => {
  it('platform admin always passes (no tenant)', () => {
    expect(isTenantLoginAllowed({ isPlatformAdmin: true, tenantId: null, tenantIsActive: null })).toBe(true);
  });
  it('active tenant user passes', () => {
    expect(isTenantLoginAllowed({ isPlatformAdmin: false, tenantId: 't1', tenantIsActive: true })).toBe(true);
  });
  it('INACTIVE tenant user is rejected', () => {
    expect(isTenantLoginAllowed({ isPlatformAdmin: false, tenantId: 't1', tenantIsActive: false })).toBe(false);
  });
  it('missing tenant row is rejected (fail-closed)', () => {
    expect(isTenantLoginAllowed({ isPlatformAdmin: false, tenantId: 't1', tenantIsActive: null })).toBe(false);
  });
  it('tenant user with no tenant id is rejected (fail-closed)', () => {
    expect(isTenantLoginAllowed({ isPlatformAdmin: false, tenantId: null, tenantIsActive: null })).toBe(false);
  });
});
