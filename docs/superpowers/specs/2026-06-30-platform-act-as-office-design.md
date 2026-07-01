# Design: Platform admin "act as office" + tenant-query chokepoint hardening

**Date:** 2026-06-30
**Status:** Approved for planning
**Branch context:** `multi-tenant`

## Context & goal

Power TC is a multi-tenant real-estate transaction-coordination SaaS (Next.js 15
App Router, Turso/libSQL, Drizzle, NextAuth v5). Today a **platform admin**
(d20web superuser, `isPlatformAdmin = true`, no tenant) can only create an office
and toggle it active/inactive from `/platform`. They cannot manage the individual
users, branding, templates, or transactions inside any office.

**Goal:** let a platform admin select an office and get the **full tenant-admin
surface** for it — everything a tenant admin can do — by reusing the existing,
isolation-hardened dashboard rather than rebuilding it.

This bundles two pieces of work, by decision:

1. **Tenant-query chokepoint hardening** — make tenant isolation a *structural*
   guarantee rather than a per-query convention, because the act-as feature sends
   a cross-tenant actor through every tenant query path and raises the blast
   radius of any missed predicate to "all tenants."
2. **Act-as-office (acting context)** — the impersonation feature itself.

## Decision & why (roast outcome)

The feature was pressure-tested with a 5-persona council. Verdict: **RESHAPE**.

- The direction (reuse the single `getViewerScope()` chokepoint; do not rebuild
  screens) is correct and high-leverage.
- The originally-proposed **cookie** carrier for the acting tenant is the wrong
  substrate in this architecture: the Edge proxy and any cache key read the JWT,
  not a cookie, creating a second source of truth that desyncs. Two council
  members independently recommended carrying the acting context in the **signed
  JWT** (fewest independent things that must agree).
- The acting scope must **not** be indistinguishable from a real tenant admin: it
  carries a non-droppable `actingAs` marker for audit and guards.
- Isolation must be enforced **structurally**, not by convention.

Chosen carrier: **JWT claim** (Approach B). Rejected: cookie (A — desync surface),
rebuilt screens (C — duplicate authz, the OWASP vertical-authz-bypass anti-pattern).

## Guiding principle

Acting context lives in the **signed JWT** — the single source of truth the Edge
proxy, `getViewerScope()`, and rendering already read. Authority comes from the
tamper-proof `isPlatformAdmin` claim; the acting tenant is a **validated target
selector**, never a grant. While acting, the platform admin is presented to the
data layer as exactly a tenant admin, but with a non-droppable `actingAs` marker.

---

## Part 1 — Tenant-query chokepoint hardening

### Problem

Every tenant-owned table carries `tenant_id`. Isolation today relies on each query
*remembering* to compose `tenantScopeCondition(scope, table.tenantId)` (reads) or
`requireTenantWrite()` → `eq(table.tenantId, …)` (writes), hand-written at dozens
of call sites. Nothing structurally prevents a new query from omitting the
predicate, which would expose all tenants' rows. `getViewerScope` is a single
*logical* source of tenant id but not a single *enforced* one.

### Design

1. **Single scoped read path.** Introduce a helper that produces a select already
   constrained to the viewer's effective tenant, e.g.
   `ownedSelect(scope, table, columns)` returning a Drizzle query with
   `where(tenantScopeCondition(scope, table.tenantId))` pre-applied; callers
   `and()` additional predicates. All reads of owned tables go through it.
2. **Single scoped write path.** All inserts of owned tables stamp `tenant_id`
   from `requireTenantWrite()`; all updates/deletes compose the tenant predicate.
   Keep these as the only sanctioned mutation entry points.
3. **Structural guard (CI test).** A test that statically scans `src/` and fails
   if any owned table is referenced in a `.from(...)` / `update(...)` /
   `delete(...)` outside the sanctioned helpers without an accompanying tenant
   predicate. This makes "unscoped owned-table access" un-mergeable. (Exact
   mechanism — AST scan vs. lint rule — is an implementation-plan detail.)
4. **Runtime fail-closed stays.** `tenantScopeCondition` already returns `1 = 0`
   for a tenant-less non-platform viewer; keep that as defense in depth.

### Migration

Enumerate every owned-table query in `src/actions/**` and `src/app/**` and route
it through the scoped read/write paths. Owned tables: `agents`, `transactions`,
`transactionAgents`, `taskTemplateGroups`, `taskTemplates`, `transactionTasks`,
`activityLog`, `users` (tenant-scoped portions), `tenantBranding`. The NextAuth
tables and `tenants`/`accessRequests` are handled separately (platform-scoped).

### Tests

- The static guard test above.
- Extend the existing cross-tenant isolation suite to assert the scoped helpers
  return `1 = 0` (nothing) for a tenant-less non-platform viewer.

---

## Part 2 — Act-as-office (acting context)

### 2.1 Acting context in the JWT

Add two claims, settable only via the NextAuth `trigger: 'update'` path (the `jwt`
callback currently sets claims only when `user` is present, i.e. at login):

- `actingTenantId: string | null`
- `actingExpiresAt: number | null` (epoch ms)

Two distinct guards are needed (do not conflate them):
- **`requireRawPlatformAdmin()`** — reads the *raw* `isPlatformAdmin` JWT claim
  (true even while acting). Gates `enterTenant`/`exitTenant` so an admin can enter,
  **switch directly between offices**, and exit regardless of acting state.
- **`requirePlatformAdmin()`** (existing, effective-scope) — returns **false**
  while acting, so it keeps gating the `/platform` CRUD actions
  (`createTenant`, `setTenantActive`), which are disabled until Exit.

**`enterTenant(tenantId)`** server action:
- Gated by `requireRawPlatformAdmin()`.
- Validates the tenant exists. Entering an **inactive** office is allowed
  (platform override — support may need to fix a deactivated office).
- Re-mints the token: `actingTenantId = tenantId`,
  `actingExpiresAt = now + TTL`.
- Writes an `activityLog` "entered office" event for that tenant.
- Redirects to `/dashboard`.

**`exitTenant()`** server action:
- Clears both claims. Redirects to `/platform`.

**TTL: 60 minutes**, absolute; re-entering resets it. On expiry the admin silently
reverts to a normal platform admin (tenant-less); the next navigation bounces to
`/platform`.

### 2.2 `getViewerScope` — effective scope

`ViewerScope` gains `actingAs: { realAdminId: string; tenantId: string; expiresAt: number } | null`.

Resolution: when `isPlatformAdmin && actingTenantId && now < actingExpiresAt`,
return the effective scope:

```
{
  userId:           <real admin id>,
  role:             'admin',
  tenantId:         actingTenantId,
  isPlatformAdmin:  false,          // effective only; raw JWT flag unchanged
  agentIds:         null,           // unrestricted within the tenant
  actingAs:         { realAdminId, tenantId, expiresAt },
}
```

Consequences (all desirable, all from existing logic):
- `tenantScopeCondition` returns `eq(tenant, actingTenantId)` — the no-filter
  branch (`isPlatformAdmin && tenantId === null`) **cannot** fire.
- `requireWriteAccess` / `requireTenantWrite` / `requireTenantAdmin` all pass as a
  normal tenant admin scoped to that office.
- `requirePlatformAdmin` returns **false** while acting → **platform actions
  (`createTenant`, `setTenantActive`) are disabled until Exit.** This resolves the
  "platform admin and tenant admin at once" contradiction.

The raw `isPlatformAdmin` claim remains true in the JWT for routing and re-entry;
only the *effective scope* drops it.

### 2.3 Edge proxy (`proxy.ts`)

Teach the proxy to read `actingTenantId` (Edge-safe — it's in the token):
- Platform admin **acting** (`isPlatformAdmin && actingTenantId && not expired`):
  allow `/dashboard/*`; keep `/platform` reachable (for Exit).
- Platform admin **not acting**: current behavior — `/dashboard/*` → `/platform`.
- Everyone else: unchanged. `/platform/*` stays platform-admin-only (raw flag).
- The existing fail-closed rule (`!isPlatformAdmin && !tenantId` → `/login` + cookie
  cleanup) is unchanged.

Same JWT, no second source of truth.

### 2.4 Audit & tenant-visible attribution

Add to `activityLog`:
- `actorIsPlatformAdmin: boolean` (default false)
- `actorLabel: text | null` — denormalized display for cross-tenant actors (the
  platform admin is not a tenant user, so the tenant's feed can't join `users` to
  resolve them).

While acting, every write records `userId = realAdminId`, `tenantId = actingTenant`,
`actorIsPlatformAdmin = true`, `actorLabel = 'd20web (support)'` (or similar). The
"entered office" event gives the tenant **after-the-fact visibility** that access
occurred. The tenant's own activity feed renders these rows in plain English, e.g.
"d20web (support) — created user jane@…". Append-only; no deletion path.

Sensitive-read logging (every read, not just writes) is **out of scope** for this
iteration; the per-session "entered office" event is the access record.

### 2.5 Cache safety

The app uses **no Data Cache** today (`unstable_cache` / `use cache` /
`revalidateTag` are absent; all dashboard routes render dynamically because
`auth()` opts them into dynamic). The cross-tenant cache-leak risk is therefore
low now. Guardrails to keep it that way:
- **Rule:** any future cached read of owned data must include the **effective**
  `tenantId` in its cache key.
- **Test:** an isolation test that renders a tenant-scoped list as Office A, then
  as Office B, and asserts no data bleed across the switch.

### 2.6 UX

- **Enter:** an "Enter office" action on each `/platform` office row.
- **In-office:** the dashboard already resolves and renders the **target tenant's
  branding** (because effective `tenantId` is that office), so the chrome takes
  over naturally. On top sits a distinct **Power TC acting-banner**
  ("Acting as <Office> · Exit to platform") styled in the platform's
  evergreen/mint so it is unmistakably the vendor overlay, not the tenant's UI.
- **Exit** returns to `/platform`.
- **Destructive writes while acting** (delete user, reset branding/templates) show
  a louder confirm naming the office. The client reads `actingAs` from the session
  to decide whether to escalate the confirm.

### 2.7 Security guardrails (summary)

- Power derives only from the signed `isPlatformAdmin` JWT claim; a forged
  `actingTenantId` on a non-admin session is inert.
- Acting tenant is validated server-side at `enterTenant`.
- 60-minute TTL auto-expiry.
- Platform actions disabled while acting (must Exit first).
- `enterTenant`/`exitTenant` are POST server actions (same-origin protected).
- Effective scope never hits the no-filter branch.

---

## Data model changes

`activityLog`: add `actor_is_platform_admin` (integer/boolean, default 0) and
`actor_label` (text, nullable). Drizzle migration via `db:generate` + `db:migrate`.

No other schema changes (acting context lives in the JWT, not the DB).

## Testing strategy

1. **Chokepoint:** static guard test (no unscoped owned-table access); helper
   fail-closed unit tests.
2. **Acting isolation:** while acting as A — only A's rows visible, B unreachable,
   no-filter branch never fires; proxy allows `/dashboard` only when acting; TTL
   expiry revokes; `exitTenant` clears; render-A-then-B cache test.
3. **Audit:** writes while acting are attributed to the real admin + acting marker
   and surface in the tenant feed; "entered office" event recorded.
4. Extend, do not replace, the existing cross-tenant isolation suite.

## Out of scope

- Full structural *type-level* enforcement of the chokepoint (the CI guard + scoped
  helpers are the chosen mechanism; a deeper type refactor is future work).
- Per-read (vs. per-write) sensitive-data audit logging.
- "Exit restores my exact scroll position / prior page" (Exit returns to
  `/platform`); nice-to-have, deferred.
- Real-time "vendor entered your office" notifications to tenants (after-the-fact
  audit visibility is the floor).
- **Non-engineering:** a client-financial-data access clause in the MSA/DPA.

## Defaults to confirm at spec review

- TTL = **60 minutes**.
- Platform actions **disabled while acting** (Exit to use `/platform`).
- `actorLabel` copy = **"d20web (support)"**.
