'use server';

import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { tenants } from '@/db/schema';
import { requireRawPlatformAdmin } from '@/lib/access';
import { updateAuthSession } from '@/lib/auth';
import { ACTING_TTL_MS } from '@/lib/acting';
import { logActivity } from '@/lib/activity';

export async function enterTenant(tenantId: string): Promise<{ success: false; error: string } | void> {
  if (!(await requireRawPlatformAdmin())) return { success: false, error: 'Unauthorized' };

  const tenant = await db
    .select({ id: tenants.id })
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .get();
  if (!tenant) return { success: false, error: 'Office not found' };

  // The jwt callback reads these flat fields off the update payload (see
  // auth.config.ts). NextAuth types unstable_update's arg as Partial<Session>,
  // which nests these under `user`, so we assert the flat acting-claim shape.
  await updateAuthSession(
    { actingTenantId: tenantId, actingExpiresAt: Date.now() + ACTING_TTL_MS } as unknown as Parameters<typeof updateAuthSession>[0],
  );
  // Visible-to-tenant access record. getViewerScope now resolves the acting scope,
  // so logActivity attributes this to the platform admin "acting as office".
  await logActivity({ tenantId, action: 'platform_entered', details: null });
  redirect('/dashboard');
}

export async function exitTenant(): Promise<void> {
  await updateAuthSession(
    { actingTenantId: null, actingExpiresAt: null } as unknown as Parameters<typeof updateAuthSession>[0],
  );
  redirect('/platform');
}
