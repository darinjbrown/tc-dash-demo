import { cache } from 'react';
import { auth } from '@/lib/auth';
import { db } from '@/db/client';
import { agents, transactions, transactionAgents } from '@/db/schema';
import { and, eq, inArray, sql, type SQL } from 'drizzle-orm';
import type { AnySQLiteColumn } from 'drizzle-orm/sqlite-core';
import { canManageAll, isReadOnlyRole } from '@/lib/roles';

// Re-exported so server callers can keep importing role predicates from one
// place. The Edge proxy imports them directly from '@/lib/roles' (Edge-safe).
export { canManageAll, isReadOnlyRole } from '@/lib/roles';

export type ViewerScope = {
  userId: string | null;
  role: string;
  // Tenant ring (OUTER). The office this viewer belongs to.
  //   string      -> bound to this tenant; reads/writes are scoped to it.
  //   null        -> NOT bound to a tenant. Allowed ONLY for platform admins
  //                  (who operate on /platform); for everyone else this is
  //                  fail-closed (sees/does nothing).
  tenantId: string | null;
  // True only for the d20web platform superadmin (acts across tenants via
  // the dedicated /platform surface, which is exempt from the tenant predicate).
  isPlatformAdmin: boolean;
  // Agent ring (INNER). UNCHANGED semantics, but now resolved WITHIN the tenant.
  //   null        -> unrestricted within the tenant (admin/broker/tc).
  //   string[]    -> restricted to these agent ids. Empty array = sees nothing.
  agentIds: string[] | null;
};

export function normalizeEmail(email: string | null | undefined): string {
  return (email ?? '').trim().toLowerCase();
}

export function computeViewerScope(input: {
  role: string;
  userId: string | null;
  tenantId: string | null;
  isPlatformAdmin: boolean;
  matchedAgentIds: string[];
}): ViewerScope {
  const base = {
    userId: input.userId,
    role: input.role,
    tenantId: input.tenantId,
    isPlatformAdmin: input.isPlatformAdmin,
  };
  // Privileged tenant roles are unrestricted on the AGENT ring (null). Tenant
  // isolation is enforced separately by the outer ring (tenantScopeCondition).
  if (input.isPlatformAdmin || canManageAll(input.role)) {
    return { ...base, agentIds: null };
  }
  return { ...base, agentIds: input.matchedAgentIds };
}

/**
 * Resolve the current viewer's scope. Tenant + platform-admin come straight off
 * the signed JWT (no DB round-trip). Email-match for the agent ring is isolated
 * HERE only and is now TENANT-SCOPED — two offices with an agent of the same
 * email never bleed into each other.
 *
 * Wrapped in React `cache()` so multiple reads in one server render share a
 * single auth() + agents lookup.
 */
export const getViewerScope = cache(async (): Promise<ViewerScope> => {
  const session = await auth();
  // Default to the most restricted role when unknown (fail-closed).
  const u = session?.user as
    | { role?: string; tenantId?: string | null; isPlatformAdmin?: boolean }
    | undefined;
  const role = u?.role ?? 'agent';
  const userId = session?.user?.id ?? null;
  const tenantId = u?.tenantId ?? null;
  const isPlatformAdmin = u?.isPlatformAdmin ?? false;
  const email = normalizeEmail(session?.user?.email);

  let matchedAgentIds: string[] = [];
  // Only resolve the agent ring for read-only tenant users that actually have a
  // tenant. A tenant-less, non-platform user is fail-closed below regardless.
  if (isReadOnlyRole(role) && email && tenantId) {
    const rows = await db
      .select({ id: agents.id })
      .from(agents)
      .where(and(eq(agents.tenantId, tenantId), sql`lower(${agents.email}) = ${email}`));
    matchedAgentIds = rows.map((r) => r.id);
  }

  return computeViewerScope({ role, userId, tenantId, isPlatformAdmin, matchedAgentIds });
});

/**
 * Guard for mutations. Returns the standard error object when the viewer is a
 * read-only role OR has no tenant (and is not a platform admin). Returns null to
 * proceed. Server actions never throw.
 */
export async function requireWriteAccess(): Promise<{ success: false; error: string } | null> {
  const scope = await getViewerScope();
  if (isReadOnlyRole(scope.role)) {
    return { success: false, error: 'You do not have permission to perform this action.' };
  }
  // Fail-closed: a writable role still needs a tenant to write into. Platform
  // admins do not write through tenant-scoped actions (they use /platform).
  if (!scope.tenantId) {
    return { success: false, error: 'You do not have permission to perform this action.' };
  }
  return null;
}

/**
 * Centralizes "this write belongs to my tenant." Every tenant-scoped insert
 * stamps the returned tenantId; the value comes from the SESSION, never from
 * client input. Returns a denial when there is no tenant to stamp.
 */
export async function requireTenantWrite(): Promise<
  { tenantId: string } | { success: false; error: string }
> {
  const scope = await getViewerScope();
  if (isReadOnlyRole(scope.role) || !scope.tenantId) {
    return { success: false, error: 'You do not have permission to perform this action.' };
  }
  return { tenantId: scope.tenantId };
}

/**
 * The TENANT predicate (outer ring). AND this into the WHERE of any query on a
 * tenant-owned table — uniform because every owned table carries `tenant_id`.
 *   - platform admin with no tenant  -> undefined (no tenant filter; /platform)
 *   - normal viewer bound to tenant  -> eq(column, scope.tenantId)
 *   - no tenant, not platform admin  -> sql`1 = 0` (fail-closed: matches nothing)
 */
export function tenantScopeCondition(
  scope: ViewerScope,
  tenantColumn: AnySQLiteColumn,
): SQL | undefined {
  if (scope.isPlatformAdmin && scope.tenantId === null) return undefined;
  if (!scope.tenantId) return sql`1 = 0`;
  return eq(tenantColumn, scope.tenantId);
}

/**
 * The AGENT predicate (inner ring) for the `transactions` table. UNCHANGED.
 * Compose with tenantScopeCondition via and() — tenant is the outer ring.
 *   - unrestricted viewer  -> undefined (no filter)
 *   - restricted, no agents -> `1 = 0` (matches nothing)
 *   - restricted            -> transactions.id IN (their transaction ids)
 */
export function transactionScopeCondition(scope: ViewerScope): SQL | undefined {
  if (scope.agentIds === null) return undefined;
  if (scope.agentIds.length === 0) return sql`1 = 0`;
  return inArray(
    transactions.id,
    db
      .select({ id: transactionAgents.transactionId })
      .from(transactionAgents)
      .where(inArray(transactionAgents.agentId, scope.agentIds)),
  );
}
