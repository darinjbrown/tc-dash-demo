import { describe, it, expect } from 'vitest';
import { ACTING_TTL_MS, isActingActive } from './acting';

describe('acting helpers', () => {
  it('TTL is 60 minutes', () => {
    expect(ACTING_TTL_MS).toBe(60 * 60 * 1000);
  });
  it('active only when platform admin + tenant + unexpired', () => {
    const now = 1_000_000;
    expect(isActingActive({ isPlatformAdmin: true, actingTenantId: 't1', actingExpiresAt: now + 1 }, now)).toBe(true);
    expect(isActingActive({ isPlatformAdmin: true, actingTenantId: 't1', actingExpiresAt: now - 1 }, now)).toBe(false);
    expect(isActingActive({ isPlatformAdmin: false, actingTenantId: 't1', actingExpiresAt: now + 1 }, now)).toBe(false);
    expect(isActingActive({ isPlatformAdmin: true, actingTenantId: null, actingExpiresAt: now + 1 }, now)).toBe(false);
  });
});
