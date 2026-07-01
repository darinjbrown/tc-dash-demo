export const ACTING_TTL_MS = 60 * 60 * 1000; // 60 minutes, absolute

export function isActingActive(
  claims: { isPlatformAdmin?: boolean; actingTenantId?: string | null; actingExpiresAt?: number | null },
  now: number,
): boolean {
  return (
    claims.isPlatformAdmin === true &&
    !!claims.actingTenantId &&
    typeof claims.actingExpiresAt === 'number' &&
    claims.actingExpiresAt > now
  );
}

export const ACTOR_LABEL_PLATFORM = 'd20web (support)';
