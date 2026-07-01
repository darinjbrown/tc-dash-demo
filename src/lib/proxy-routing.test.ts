import { describe, it, expect } from 'vitest';
import { isActingNow } from './proxy-routing';

const baseI = { pathname: '/dashboard', isPlatformAdmin: true, tenantId: null,
  actingTenantId: 't1', actingExpiresAt: 2, now: 1 };

describe('proxy acting decision', () => {
  it('acting platform admin is tenant-scoped', () => {
    expect(isActingNow(baseI)).toBe(true);
  });
  it('non-acting platform admin is not', () => {
    expect(isActingNow({ ...baseI, actingTenantId: null })).toBe(false);
  });
  it('expired acting is not active', () => {
    expect(isActingNow({ ...baseI, actingExpiresAt: 0 })).toBe(false);
  });
});
