import { cache } from 'react';
import { auth } from '@/lib/auth';
import { db } from '@/db/client';
import { agents, transactions, transactionAgents } from '@/db/schema';
import { inArray, sql, type SQL } from 'drizzle-orm';
import { canManageAll, isReadOnlyRole } from '@/lib/roles';

// Re-exported so server callers can keep importing role predicates from one
// place. The Edge proxy imports them directly from '@/lib/roles' (Edge-safe).
export { canManageAll, isReadOnlyRole } from '@/lib/roles';

export type ViewerScope = {
  userId: string | null;
  role: string;
  // null = unrestricted (admin/broker/tc).
  // string[] = restricted to these agent ids. Empty array = sees nothing (fail-closed).
  agentIds: string[] | null;
};

export function normalizeEmail(email: string | null | undefined): string {
  return (email ?? '').trim().toLowerCase();
}

export function computeViewerScope(input: {
  role: string;
  userId: string | null;
  matchedAgentIds: string[];
}): ViewerScope {
  if (canManageAll(input.role)) {
    return { userId: input.userId, role: input.role, agentIds: null };
  }
  return { userId: input.userId, role: input.role, agentIds: input.matchedAgentIds };
}

/**
 * Resolve the current viewer's scope. Email-match is isolated HERE only —
 * swap to an explicit users.id -> agents.userId link later without touching callers.
 *
 * Wrapped in React `cache()` so multiple reads in one server render (e.g. the
 * dashboard's five scope-dependent queries) share a single auth() + agents lookup.
 */
export const getViewerScope = cache(async (): Promise<ViewerScope> => {
  const session = await auth();
  // Default to the most restricted role when unknown (fail-closed).
  const role = (session?.user as { role?: string } | undefined)?.role ?? 'agent';
  const userId = session?.user?.id ?? null;
  const email = normalizeEmail(session?.user?.email);

  let matchedAgentIds: string[] = [];
  if (isReadOnlyRole(role) && email) {
    // Assumes email is effectively unique in `agents` (no DB UNIQUE constraint
    // today). Duplicates would broaden this viewer's scope, never narrow it.
    // Revisit when switching to an explicit users.id -> agents.userId link.
    const rows = await db
      .select({ id: agents.id })
      .from(agents)
      .where(sql`lower(${agents.email}) = ${email}`);
    matchedAgentIds = rows.map((r) => r.id);
  }

  return computeViewerScope({ role, userId, matchedAgentIds });
});

/**
 * Guard for mutations. Returns the standard error object when the viewer is an
 * agent (read-only); returns null to proceed. Server actions never throw.
 */
export async function requireWriteAccess(): Promise<{ success: false; error: string } | null> {
  const scope = await getViewerScope();
  if (isReadOnlyRole(scope.role)) {
    return { success: false, error: 'You do not have permission to perform this action.' };
  }
  return null;
}

/**
 * A Drizzle condition to AND into a WHERE on the `transactions` table.
 * - unrestricted viewer  -> undefined (no filter; `and()` ignores undefined)
 * - restricted, no agents -> `1 = 0` (matches nothing)
 * - restricted            -> transactions.id IN (their transaction ids)
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
