import { isActingActive } from '@/lib/acting';

export type RouteInput = {
  pathname: string;
  isPlatformAdmin: boolean;
  tenantId: string | null;
  actingTenantId: string | null;
  actingExpiresAt: number | null;
  now: number;
};

/** Returns true if a platform admin should be treated as tenant-scoped (acting). */
export function isActingNow(i: RouteInput): boolean {
  return isActingActive(
    { isPlatformAdmin: i.isPlatformAdmin, actingTenantId: i.actingTenantId, actingExpiresAt: i.actingExpiresAt },
    i.now,
  );
}
