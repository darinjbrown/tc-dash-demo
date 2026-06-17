// Edge-safe role predicates and route rules.
//
// This module imports NOTHING from auth or the database, so it is safe to use
// from the Edge proxy (proxy.ts) as well as from server code (access.ts).
//
// Allowlist, not denylist: any role NOT explicitly privileged (the `agent` role
// or an unrecognized/garbage role) is treated as a restricted, read-only viewer.
// Unknown roles are therefore fail-closed on the read, write, AND route paths.
const PRIVILEGED_ROLES = new Set(['admin', 'broker', 'tc']);

export function canManageAll(role: string): boolean {
  return PRIVILEGED_ROLES.has(role);
}

export function isReadOnlyRole(role: string): boolean {
  return !canManageAll(role);
}

// Route prefixes a read-only viewer may never reach.
export const AGENT_FORBIDDEN_PREFIXES = ['/agents', '/settings', '/templates', '/users'];

/**
 * Should a viewer with `role` be blocked from `pathname`?
 * Privileged roles are never blocked. Restricted roles are blocked from the
 * forbidden prefixes — matched as a full segment (`/users` or `/users/...`) so
 * a route like `/users-report` is not accidentally gated.
 */
export function isForbiddenForRole(pathname: string, role: string): boolean {
  if (canManageAll(role)) return false;
  return AGENT_FORBIDDEN_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + '/'));
}
