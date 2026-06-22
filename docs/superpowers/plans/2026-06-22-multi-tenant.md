# Multi-Tenant Platform — Architecture & Implementation Plan

> **Status:** DESIGN ONLY — for owner review. No schema surgery, no app-code
> changes, no migrations are performed by this document. It is the first
> deliverable of the multi-tenant phase. Implementation follows only after
> sign-off.

> **For agentic workers (later):** When this is approved and broken into PRs,
> use the same task-by-task, checkbox-tracked execution style as
> `docs/superpowers/plans/2026-06-14-agent-rbac.md`. Each phase below is scoped
> to a single PR.

**Goal:** Turn TC Dashboard from one-deploy-per-office (single-tenant per
codebase/DB/Vercel project) into **one shared platform** where every
broker/office is a **tenant** living on the same codebase and the same
database, fully data-isolated from every other tenant. This removes the
per-office build/deploy and makes onboarding a new office a row insert + a seed,
not a fork.

**Architecture (one sentence):** Add a `tenants` table; stamp a `tenantId` FK
onto every tenant-owned table; carry `tenantId` in the NextAuth JWT; and
**extend the existing `src/lib/access.ts` scope resolver** so that tenant
isolation ANDs into the same `WHERE` predicates and write guards that already
enforce agent-scoped RBAC. Tenant scope and agent scope **compose** — tenant is
the outer ring, agent scope the inner ring.

**Tech stack (unchanged):** Next.js 15+ (App Router), TypeScript strict,
Drizzle ORM (libSQL/Turso), NextAuth v5 (JWT sessions), shadcn/ui + Tailwind v4,
Vitest for the security-critical unit tests.

**Design principle that governs everything below:** *Do not reinvent isolation.*
The agent-RBAC work already established the right shape — a single resolver, a
reusable `SQL` condition ANDed into reads, a fail-closed write guard, Edge-safe
predicates in `roles.ts`, and Vitest tests on the pure logic. Multi-tenancy is
the **same pattern applied one level up**. The win is that there is exactly one
place to get isolation right, and it's already proven in production.

---

## Table of Contents

1. Tenant model (data shape)
2. Tenant resolution (which tenant is "current")
3. Data isolation (extending `access.ts`)
4. Per-tenant branding (compile-time -> runtime)
5. Per-tenant task templates
6. Auth changes (JWT carries `tenantId`)
7. Migration path (single-tenant instance -> platform)
   - 7.5 Migration-readiness — keep data portable to Postgres now
8. Phased rollout (PR-sized phases + testing strategy)
   - includes Phase 9 (DEFERRED): Turso/SQLite -> Supabase/Postgres
9. Risks & open questions for the owner

---

## 1. Tenant model

### 1.1 New table: `tenants`

A tenant is an **office/brokerage** — the unit of data isolation **and** the
unit of billing ($49/mo per office, unlimited seats). One row per paying office.

```
tenants
  id            text PK
  name          text NOT NULL          -- "Crestline Realty"
  slug          text NOT NULL UNIQUE    -- demo repo's initial tenant uses slug 'tenant'
                                        --   (a real onboarded office gets its own real
                                        --    slug, e.g. "crestline"); used for subdomain + URLs
  status        text NOT NULL           -- 'active' | 'suspended' | 'trialing' (default 'active')
  -- Billing attach point (integration OUT OF SCOPE; columns reserved so the
  -- model doesn't need re-migration when Stripe lands):
  billingCustomerId   text             -- e.g. Stripe customer id (nullable now)
  billingStatus       text             -- 'active'|'past_due'|'canceled' (nullable now)
  planSeatLimit       integer          -- null = unlimited (the $49 plan)
  createdAt     integer (timestamp_ms)
  updatedAt     integer (timestamp_ms)
```

Notes:
- `slug` is the white-label handle. It is the natural key for subdomain
  resolution (`<office-slug>.tcdash.app`, e.g. `crestline.tcdash.app`) and is
  immutable once issued (changing it
  would break bookmarks/SSO); renames are an admin operation, not user-editable.
- Billing columns are **reserved but inert** — they document where subscription
  state attaches so we never have to re-migrate the tenant table when billing is
  wired. No billing logic ships in this plan.
- A separate `tenant_branding` table (see Section 4) holds the per-tenant brand
  record, keyed by `tenantId`. Kept separate from `tenants` so branding can be
  edited/versioned without touching the billing/identity row, and so the brand
  payload (a JSON-ish color blob) doesn't bloat the hot `tenants` row.

### 1.2 Which existing tables get `tenantId`

**Every tenant-owned table** gets a non-null `tenantId text` FK ->
`tenants.id`. The list, with the isolation rationale:

| Table | Add `tenantId`? | Why |
|---|---|---|
| `agents` | **Yes** | Each office has its own agent roster. |
| `transactions` | **Yes** | The core isolated record. |
| `transaction_agents` | **Yes** (denormalized) | Join row; carrying `tenantId` lets the scope subquery filter without an extra join, and prevents a cross-tenant agent<->transaction link by construction. |
| `task_template_groups` | **Yes** | Templates become per-tenant (Section 5). |
| `task_templates` | **Yes** | Per-tenant; offices customize the CA pack. |
| `transaction_tasks` | **Yes** (denormalized) | Stamped per transaction; carrying `tenantId` avoids a join-through-transaction on every task read and closes a forged-`transactionId` hole at the row level. |
| `activity_log` | **Yes** | Audit trail is tenant-private. |
| `access_requests` | **Yes** (nullable — see below) | A request to join a specific office. |
| `users` | **Membership, see 1.3** | Users belong to a tenant. |

**NextAuth infra tables — do NOT add `tenantId`:**
`accounts`, `sessions`, `verification_tokens` stay tenant-agnostic. They key off
`users.id`; tenant scoping flows from the user's membership, not from the auth
session row. Adding `tenantId` there would fight the Auth.js adapter contract.

**Denormalization note (important):** `transaction_agents` and
`transaction_tasks` could derive their tenant from their parent `transactions`
row. We **still store `tenantId` directly** on them. Reasons: (1) it lets the
isolation predicate be a flat `eq(table.tenantId, currentTenant)` with no join,
keeping reads cheap and the scope condition uniform across all tables; (2) it
is defense-in-depth — even if a forged parent id slipped through, the row's own
`tenantId` still has to match. The cost is that inserts must set `tenantId`
(enforced centrally — see 3.4) and an invariant: child `tenantId` must equal
parent `tenantId`. We enforce that invariant in application code at
stamp/insert time, not in SQLite triggers.

### 1.3 How users map to tenants

**Recommendation: single-tenant membership per user (for now).** Add
`tenantId text` (FK -> `tenants.id`) directly to the `users` table. A user
belongs to exactly one office. This is the simplest model that fits the
business: a TC or agent works for one brokerage; a broker owns one office. It
also keeps the JWT trivial (one `tenantId` claim) and the resolver trivial (no
"active tenant" switching UI).

```
users
  ...existing...
  role      text  -- UNCHANGED enum: 'admin' | 'broker' | 'tc' | 'agent'
  tenantId  text  -- NEW, FK -> tenants.id, NOT NULL for tenant users,
                  --      NULL only for platform superadmins (see below)
```

- **Roles stay tenant-scoped.** `admin`/`broker`/`tc`/`agent` keep their exact
  current meaning, but now scoped *within* a tenant. A `broker` of tenant A has
  zero visibility into tenant B. The role enum does **not** change.
- **`email` uniqueness:** today `users.email` is globally `UNIQUE`. With one
  tenant per user that constraint can stay global (one human = one login =
  one office). **Keep it global** for v1 — it keeps Credentials login a simple
  email lookup (no tenant disambiguation at the login form). Revisit only if a
  future requirement lets the same human belong to two offices (see 1.4).

### 1.4 Platform superadmin (d20web)

**Recommendation: add a platform-level superadmin, but keep it minimal and
out-of-band.** d20web needs to create tenants, seed them, suspend a delinquent
office, and support across tenants. Two options:

- **Option A (recommended): a `platformRole` flag, not a new tenant role.** Add
  `users.isPlatformAdmin boolean default false`. A platform admin has
  `tenantId = NULL` (belongs to no office) and is allowed to act across tenants
  **only** through a dedicated `/platform/*` admin surface that is explicitly
  exempt from the tenant predicate. The normal app paths still apply tenant
  scope — platform admins use a separate console, so we never weaken the
  per-request isolation that protects real customer data.
- **Option B: a fifth role `superadmin` in the role enum.** Rejected for v1 —
  it muddies the per-tenant role semantics (every `canManageAll` check would
  have to special-case it) and risks a platform admin accidentally operating
  inside a tenant context with global powers. A separate flag + separate surface
  is safer and easier to reason about.

For v1 the platform-admin surface can be *very* thin (create tenant, seed
templates, suspend) — even a guarded server action set is acceptable. The point
is to keep cross-tenant power **off the normal request path**.

---

## 2. Tenant resolution

"Which tenant is this request for?" must be answered the **same way on every
request**, server-side, and must never be spoofable by the client.

### 2.1 Options

| Approach | URL shape | Pros | Cons |
|---|---|---|---|
| **Subdomain** | `crestline.tcdash.app` | Cleanest white-label; tenant is visible/brandable; natural for per-tenant logos; supports tenant-specific login pages | Needs wildcard DNS + wildcard TLS on Vercel; local dev needs `*.localhost` or host-header faking; cookie scoping across subdomains needs care |
| **Path prefix** | `tcdash.app/crestline/...` | No DNS/TLS changes; trivial local dev | Ugly for white-label; every route/link must carry the prefix; middleware rewrites everywhere; weakest "feels like our own app" story |
| **Session-derived** | `tcdash.app/...`, tenant from JWT | **Simplest to build**; no DNS/routing changes; impossible to forge (tenant comes from the signed JWT, not the URL) | No per-tenant URL/branding before login; one shared login page; can't deep-link a tenant pre-auth |

### 2.2 Recommendation

**Ship session-derived tenancy first; design for subdomain second.**

- **v1 — session-derived (JWT-carried `tenantId`).** It is the simplest correct
  thing and it is **unforgeable**: the tenant is a claim in the signed NextAuth
  JWT, set at login from `users.tenantId`, and read server-side. There is *no*
  client-supplied tenant input to validate, which eliminates an entire class of
  cross-tenant bugs. Login UX is unchanged: one login page, user enters
  email+password, the JWT they get back already binds them to their office.
  Every read/write derives `currentTenant` from the session — see Section 3.

- **v2 — subdomain (recommended end state for white-label).** Once the platform
  is proven, layer subdomains on top *without changing the isolation model*: the
  subdomain becomes a **convenience + branding** signal (which login page to
  show, which logo/colors to paint pre-auth), but the **authoritative**
  `tenantId` for data access is still the JWT claim. On login we assert that the
  JWT's `tenantId.slug` matches the host's subdomain; mismatch -> reject. This
  keeps the security property ("tenant comes from the signed token") while
  getting the white-label URL. Subdomain work is its own phase (and its own
  DNS/TLS decision) — explicitly **out of scope for the first implementation
  pass** but the model is built so it slots in.

**Why not subdomain-first:** it front-loads DNS, wildcard TLS, cross-subdomain
cookie config, and local-dev host trickery before any isolation logic is proven.
Session-derived lets us land and test the hard part (data isolation) with zero
infra risk, then add the pretty URL.

### 2.3 Login UX (v1)

- One `/login` page, unchanged. Credentials provider looks the user up by email
  (still globally unique), verifies the password, and the JWT callback attaches
  both `role` **and** `tenantId` (and `isPlatformAdmin`). See Section 6.
- A **suspended** tenant (`tenants.status != 'active'`) is rejected at login (or
  on the first authed request) with a clear "this account is inactive" message —
  this is also where billing-`past_due` enforcement would later hook in.
- Platform admins (`tenantId = NULL`, `isPlatformAdmin = true`) land on the
  `/platform` console instead of `/dashboard`.

---

## 3. Data isolation — extend `src/lib/access.ts`

This is the heart of the plan. **We extend the existing resolver; we do not add
a parallel one.** Today `access.ts` answers "which agent ids can this viewer
see?" We add "which tenant is this viewer in?" as the **outer** scope, and make
both apply on every read and write.

### 3.1 Extend `ViewerScope`

```ts
export type ViewerScope = {
  userId: string | null;
  role: string;
  tenantId: string | null;   // NEW. null ONLY for platform admins on /platform.
  isPlatformAdmin: boolean;  // NEW.
  agentIds: string[] | null; // UNCHANGED: agent-scope (null = all in tenant).
};
```

`getViewerScope()` already calls `auth()` and is wrapped in React `cache()`. We
add two reads from the session token (`tenantId`, `isPlatformAdmin`) — both come
from the JWT, so **no extra DB round-trip**. The existing email->agentIds lookup
stays, but it must now be **tenant-scoped** (only match agents within the
viewer's tenant), closing a subtle hole where two offices have an agent with the
same email:

```ts
// inside getViewerScope, when resolving agentIds for a read-only role:
const rows = await db
  .select({ id: agents.id })
  .from(agents)
  .where(and(
    eq(agents.tenantId, tenantId),                 // NEW: tenant-scope the match
    sql`lower(${agents.email}) = ${email}`,
  ));
```

### 3.2 Fail-closed tenant rule

Mirror the agent-scope fail-closed behavior exactly:

- Authenticated user, **no `tenantId`** in token, **not** a platform admin ->
  **sees nothing / can do nothing** (treat like the empty-agentIds case:
  `1 = 0` on reads, denied on writes). A user must be bound to a tenant.
- This is the tenant analog of "agent with no email match sees nothing."

### 3.3 The tenant predicate (reads)

Add a sibling to `transactionScopeCondition` that produces the tenant filter for
**any** tenant-owned table. Because every such table now has a `tenantId`
column, the condition is uniform:

```ts
/**
 * AND this into the WHERE of any query on a tenant-owned table.
 * - platform admin on the /platform surface -> undefined (no tenant filter)
 * - normal viewer                            -> eq(column, scope.tenantId)
 * - no tenant (fail-closed)                  -> sql`1 = 0`
 */
export function tenantScopeCondition(
  scope: ViewerScope,
  tenantColumn: AnySQLiteColumn,
): SQL | undefined {
  if (scope.isPlatformAdmin && scope.tenantId === null) return undefined;
  if (!scope.tenantId) return sql`1 = 0`;
  return eq(tenantColumn, scope.tenantId);
}
```

### 3.4 How tenant scope and agent scope compose

They **stack with `and()`** — tenant is the outer ring, agent scope the inner
ring. The existing `transactionScopeCondition` already restricts to the viewer's
transactions; we additionally AND the tenant predicate. Concretely, a read on
`transactions` becomes:

```ts
const scope = await getViewerScope();
.where(and(
  tenantScopeCondition(scope, transactions.tenantId),   // NEW outer ring
  transactionScopeCondition(scope),                      // existing inner ring
  ...query-specific conditions...,
))
```

Note `transactionScopeCondition`'s subquery (`transaction_agents` -> ids) is
**already** safe because those rows now carry `tenantId` too, but ANDing the
top-level tenant predicate makes the guarantee obvious and join-free. The two
rings are independent: a broker (agentIds = null) is unrestricted *within their
tenant* but still cannot see another tenant; an agent is restricted to their own
transactions *and* their own tenant.

### 3.5 Write guard (mutations)

Extend `requireWriteAccess()` into a tenant-aware guard. Today it only checks
read-only role. It must also:

1. Confirm the viewer has a `tenantId` (or is a platform admin acting on
   `/platform`). No tenant -> deny.
2. On **insert**, the `tenantId` is **never taken from client input** — it is
   stamped from `scope.tenantId` by the action. Add a helper so every insert
   path goes through it:

```ts
// returns the tenantId to stamp, or a denial. Centralizes "writes belong to my tenant".
export async function requireTenantWrite():
  Promise<{ tenantId: string } | { success: false; error: string }> { ... }
```

3. On **update/delete by id**, the `WHERE` must include
   `eq(table.tenantId, scope.tenantId)` so a forged id from another tenant
   updates **zero rows** (and the action treats 0-rows-affected as "not found /
   denied"). This is the write-side analog of ANDing the read predicate.

### 3.6 Every surface that must change

The list below is the authoritative checklist (derived from grepping every
`db.select/insert/update/delete` and scope/guard call site). Every read ANDs the
tenant predicate; every write goes through the tenant-aware guard and
stamps/scopes `tenantId`.

**`src/actions/transactions.ts`**
- Reads to scope: `getTransactions`, `getActiveTransactionsList`,
  `getTransactionById` — AND `tenantScopeCondition` into each `where`.
- Writes to guard + stamp/scope tenant: `createTransaction` (stamp `tenantId`
  on the `transactions` insert, the `transaction_agents` insert, the stamped
  `transaction_tasks`, and the `activity_log` insert), `updateTransaction`,
  `updateTransactionStatus`, `updateTransactionNotes`, `deleteTransaction`
  (scope the `where`).
- Template reads inside `createTransaction`/`updateTransaction` (the
  `taskTemplates` / `taskTemplateGroups` selects) must be tenant-scoped so a
  transaction is stamped from **its own office's** templates.

**`src/actions/tasks.ts`**
- Dashboard reads to scope: `getDashboardStats`, `getUpcomingTasks`,
  `getOverdueTasks`, `getUpcomingDeadlines` — these already pull
  `transactionScopeCondition`; add the tenant predicate. Where they read
  `transaction_tasks` directly, scope on `transactionTasks.tenantId`.
- Template reads to scope: `getTaskTemplateGroups`, `getTemplateGroupsForSelect`,
  `getTaskTemplates` — tenant-scope so Settings only shows this office's
  templates.
- Writes to guard + stamp/scope: `updateTaskStatus`, `createCustomTask` (stamp
  `tenantId`), `snoozeTask`, `createTaskTemplateGroup` (stamp; and the clone
  insert must clone *within* tenant), `updateTaskTemplateGroup`,
  `deleteTaskTemplateGroup`, `toggleTaskTemplateGroupActive`,
  `createTaskTemplatesMulti`/`createTaskTemplate` (stamp), `updateTaskTemplate`,
  `deleteTaskTemplate`, `reorderTaskTemplates`, `reorderTransactionTasks`,
  `toggleTaskTemplateActive` — every `where eq(id)` gains the tenant predicate.

**`src/actions/agents.ts`**
- Reads to scope: `getAgents`, `getAgentsForSelect` — AND tenant.
- Writes to guard + stamp/scope: `createAgent` (stamp `tenantId`),
  `updateAgent`, `deleteAgent`, `toggleAgentActive`, `toggleAgentInHouse`.

**`src/actions/transaction-agents.ts`**
- `getTransactionAgents` — scope (it already loads viewer scope); add tenant
  predicate, and verify the parent transaction is in-tenant.
- Writes: `addTransactionAgent` (stamp `tenantId`; verify both the transaction
  and the agent are in the viewer's tenant before linking — prevents a
  cross-tenant link), `removeTransactionAgent`, `setTransactionAgentPrimary`.

**`src/actions/users.ts`**
- `listUsers` — scope to tenant (a broker manages only their office's users);
  platform admin sees all only via `/platform`.
- Writes: `createUser` (stamp `tenantId` = creator's tenant; a tenant admin can
  only create users in their own office), `updateUser`, `deleteUser`,
  `resetUserPassword` — all scoped to tenant. `updateProfile`/`changePassword`
  stay self-scoped (unchanged).

**`src/actions/access-requests.ts`**
- `createAccessRequest` is **public/unauthenticated** (a prospect asking to
  join). With subdomains it can carry the tenant from the host; in v1
  session-derived it may be tenant-less until an admin routes it. Recommendation:
  keep `access_requests.tenantId` **nullable**, set it when the request targets a
  known office (subdomain) and otherwise leave null for the platform admin to
  assign on approval. `getPendingRequests`/`getPendingRequestCount` ->
  tenant-scope for tenant admins, all-for platform admin. `approveRequest`
  creates the user **with the resolved `tenantId`**.

**Read-path note:** any **Server Component** that queries the DB directly
(bypassing an action) must also call `getViewerScope()` and AND the tenant
predicate. Audit `src/app/(dashboard)/**/page.tsx` during implementation — the
RBAC pass already touched these, so the surface is known.

### 3.7 Edge predicates (`roles.ts`)

`roles.ts` stays Edge-safe and role-only. **No DB, no tenant lookup there** — the
middleware reads `tenantId`/`isPlatformAdmin` straight off the JWT (`req.auth`),
not from `roles.ts`. We add small Edge-safe helpers if needed (e.g.
`isPlatformPath(pathname)` to gate `/platform/*`), but the role allowlist logic
is untouched.

---

## 4. Per-tenant branding (compile-time -> runtime)

Today branding is **compile-time**: `activeBrand` is a constant in
`brand-config.ts`, and `ThemeProvider` injects `generateBrandCss(activeBrand)`
into a `<style>` tag in a `useEffect`. To rebrand you edit code and redeploy.
That is exactly what multi-tenant must eliminate.

### 4.1 New table: `tenant_branding`

Store the brand record per tenant, shaped to match the existing `BrandConfig`
interface so `generateBrandCss()` and `brand-utils.ts` can be reused nearly
verbatim.

```
tenant_branding
  tenantId        text PK, FK -> tenants.id   -- 1:1 with tenant
  name            text        -- display name ("Crestline Realty")
  tagline         text
  logoUrl         text        -- see asset storage note below
  logoDarkUrl     text
  logoIconUrl     text
  colors          text        -- JSON blob matching BrandConfig.colors (HSL triples)
  darkColors      text        -- JSON blob (partial overrides)
  borderRadius    text        -- "0.5rem"
  fontFamily      text
  updatedAt       integer
```

Keeping `colors`/`darkColors` as JSON blobs (not 25 columns) mirrors the
`BrandConfig` object 1:1 and lets us add a status color later without a
migration. Drizzle reads it as text; we `JSON.parse` into a `BrandConfig` at the
edge of the data layer.

### 4.2 Runtime resolution flow

1. The root layout (a Server Component) resolves the current tenant
   (`getViewerScope().tenantId`, or the subdomain in v2), loads
   `tenant_branding`, and parses it into a `BrandConfig`.
2. It passes that `BrandConfig` as `initialBrand` into `ThemeProvider` (the prop
   **already exists** — `ThemeProvider({ initialBrand })`). So the provider
   barely changes: it stops defaulting to the imported `activeBrand` constant
   and instead **requires** the brand to be passed in from the server.
3. **Better: render the brand CSS server-side to avoid a flash.** Today the
   `<style>` is written in a `useEffect`, which means a brief unstyled flash and
   no SSR brand. For multi-tenant, render `generateBrandCss(brand)` into a
   `<style>` tag in the server layout (so the correct colors are in the initial
   HTML) and keep the client provider only for in-session brand edits (Settings
   preview). `brand-utils.generateBrandCss` is already a pure string function —
   it works unchanged on the server.

### 4.3 What changes in code

- `brand-config.ts`: keep the `BrandConfig` **interface** and the **default CA
  brand object** (now used as the *seed* for new tenants, not as `activeBrand`).
  Retire `activeBrand` as the live source; `defaultBrand` becomes the "platform
  default" seed; `premiereBrand` becomes just sample data.
- `theme-provider.tsx`: require `initialBrand` from the server; drop the implicit
  `activeBrand` fallback (or keep it only as a last-resort default for the
  unauthenticated marketing/login shell).
- `brand-utils.ts`: **unchanged** — `generateBrandCss` already takes a
  `BrandConfig` and returns a string. Reused on the server.

### 4.4 Asset storage — FLAG THE GAP

The current MVP rule is **"no file uploads"** (per `CLAUDE.md`). But per-tenant
**logos** are inherently uploaded assets. This is a real gap and an owner
decision:

- **Interim (no uploads):** store `logoUrl` as a plain URL string. Onboarding,
  d20web pastes a hosted URL (the office emails us a logo, we drop it in
  `public/` or an existing CDN and paste the link). Zero new infra; manual.
- **Proper (later):** add object storage — `CLAUDE.md` already names the
  intended path: **Supabase Storage or Cloudflare R2**. A Settings "upload logo"
  flow writes there and stores the returned URL in `tenant_branding.logoUrl`.

Recommendation: ship the **URL-string interim** with the platform, and treat
logo upload as a fast-follow that does not block tenancy. The schema (`logoUrl`
text) is identical either way, so no re-migration.

---

## 5. Per-tenant task templates

Today there is **one** CA template set (`task-templates.ts` defaults seeded into
`task_template_groups` / `task_templates`). Multi-tenant requires each office to
own and customize its own templates.

### 5.1 Model

- `task_template_groups` and `task_templates` get `tenantId` (Section 1.2). All
  template reads/writes are tenant-scoped (Section 3.6).
- The CA 38-task pack in `task-templates.ts` becomes the **default seed pack**,
  not a singleton. It ships as the nationwide default; offices customize from
  there in Settings.

### 5.2 Seeding a new tenant

When a tenant is created (platform-admin action), seed it:

1. Insert the default `task_template_groups` for the new `tenantId`.
2. Insert `defaultTaskTemplates` (from `task-templates.ts`) as `task_templates`
   rows under those groups, all stamped with the new `tenantId`.

This makes "new office" = "tenant row + branding row + seeded template pack."
The seed is the existing default data; we're just parameterizing it by tenant.
Existing dual-agency repair logic (`repair-dual-tasks.ts`, referenced in
`task-stamping.ts`) must also become tenant-scoped when run.

### 5.3 Stamping

`task-stamping.ts` is **pure** (`stampTasks` takes templates+groups+transaction
and returns rows) — it does **not** change. The **caller** (`createTransaction`)
must (a) load templates/groups **scoped to the transaction's tenant** and (b)
stamp `tenantId` onto every produced `transaction_tasks` row. The `StampedTask`
type gains a `tenantId` field set by the caller.

---

## 6. Auth changes

### 6.1 JWT carries `tenantId`

`auth.ts` Credentials `authorize` already returns `{ id, email, name, role }`.
Add `tenantId` and `isPlatformAdmin` from the looked-up `users` row:

```ts
return {
  id: user.id,
  email: user.email,
  name: user.name ?? undefined,
  role: user.role,
  tenantId: user.tenantId,             // NEW
  isPlatformAdmin: user.isPlatformAdmin, // NEW
};
```

`auth.config.ts` `jwt` and `session` callbacks already thread `id` and `role`;
add `tenantId` and `isPlatformAdmin` alongside them so both end up on
`session.user`. This is the **only** place the tenant binding is established, and
it comes from the DB at login — never from the client.

### 6.2 Route protection

`proxy.ts` (the Edge instance, built from `authConfig`) already reads
`req.auth.user.role` and fail-closes. Add:
- Require a `tenantId` on the token for all `(dashboard)` routes; missing tenant
  + not platform admin -> redirect to `/login` (or an "no office assigned" page).
- Gate `/platform/*` to `isPlatformAdmin` only.
- (v2 subdomain) assert host-subdomain slug matches the token's tenant slug;
  mismatch -> sign out / reject.

### 6.3 Preventing cross-tenant access via forged params

This is the security crux. Three layers, all server-side:

1. **Tenant comes from the signed JWT, not the URL/body.** There is no
   client-supplied `tenantId` input in v1. Even in v2, the subdomain is only a
   hint; the JWT claim is authoritative.
2. **Every read ANDs the tenant predicate** (3.3-3.4). A forged
   `transactionId`/`agentId` from another tenant returns **zero rows** because
   the row's `tenantId` won't match — the user gets a 404/empty, not another
   office's data.
3. **Every write scopes its `WHERE` by tenant** and stamps `tenantId` from the
   session on insert (3.5). A forged id updates/deletes **zero rows**; a forged
   `tenantId` in a payload is ignored (we never read it from input).

These three together mean isolation does **not** depend on the UI hiding things —
it's enforced at the data layer, exactly like the existing RBAC.

---

## 7. Migration path (existing single-tenant instance -> platform)

Goal: lift an existing per-office deploy (e.g. the Crestline demo app) onto the
shared platform without data loss. **No SQL is written here** — this is the
high-level Drizzle sequence to execute later, per phase.

### 7.1 Schema migration (Drizzle)

1. `drizzle-kit generate` after adding: `tenants`, `tenant_branding`, and the
   `tenantId` columns. **Add the columns as nullable first** (SQLite can't add a
   NOT NULL column without a default to a non-empty table cleanly), backfill,
   then tighten.
2. Order of operations per migration:
   a. Create `tenants` + `tenant_branding`.
   b. Add `tenantId` (nullable) to every tenant-owned table + `users`.
   c. **Backfill** (7.2).
   d. A follow-up migration tightens `tenantId` to NOT NULL on the tenant-owned
      tables (users stays nullable to allow platform admins).

### 7.2 Backfilling an existing instance

For a single-tenant DB being absorbed:

1. Insert one `tenants` row for the office. In this `tc-dash-demo` line that
   first/backfilled tenant is the Crestline demo data, seeded with
   `name = 'Crestline Realty'`, **`slug = 'tenant'`**, `status = 'active'`. (A
   real onboarded office instead gets its own real slug, e.g. `crestline`.)
2. Insert its `tenant_branding` from the office's current compile-time
   `activeBrand` (copy the constant's values into the row).
3. `UPDATE` every tenant-owned table to set `tenantId = <that tenant id>` for
   **all existing rows** (they all belong to the one office). Same for `users`.
4. Move the office's current template set: existing `task_template_groups` /
   `task_templates` rows just get stamped with the tenant id (they were already
   that office's customized set — preserve them, don't reseed).
5. Designate the d20web account(s) as `isPlatformAdmin = true`,
   `tenantId = NULL`.
6. Tighten `tenantId` to NOT NULL (the follow-up migration).

### 7.3 Onboarding a brand-new office (the common case going forward)

A platform-admin action: insert `tenants` row -> insert `tenant_branding` (from
the default brand, or the office's pasted logo/colors) -> seed the default CA
template pack stamped with the new `tenantId` -> create the office's first
admin/broker user bound to the tenant. No deploy.

### 7.4 Data export/import (portability)

Because every owned row carries `tenantId`, a per-tenant export/import is a
`WHERE tenantId = ?` dump and a re-stamp on import. This also gives us a clean
"offboard an office" story (delete by `tenantId`) and a backup-per-tenant story.
Build this as a platform-admin utility in a later phase (not v1-blocking).

### 7.5 Migration-readiness — keep the data portable to Postgres NOW (without migrating)

The Supabase/Postgres move is **deferred** (see Phase 9), but every decision in
this plan should be made so that when it happens it is a **Drizzle dialect/driver
config swap, not a rewrite**. Do these now; they cost nothing extra on Turso and
they keep the door open. (`CLAUDE.md` already states the intent: *"Switching from
Turso (SQLite) to Supabase (Postgres) means changing the Drizzle driver config
and running a migration, not rewriting queries."*)

Concrete rules, all already aligned with current conventions:

- **All DDL lives in Drizzle migrations — no out-of-band / raw SQL.** Every
  table, column, FK, and index is declared in `src/db/schema.ts` and generated
  via `drizzle-kit generate`. The same schema then regenerates cleanly against
  the Postgres dialect. Never hand-edit the SQLite DB or run ad-hoc `ALTER`s that
  the schema file doesn't know about — drift is what makes a dialect swap a
  rewrite.
- **Portable column types only.** Avoid SQLite/libSQL-specific features and any
  `PRAGMA`-dependent behavior. Stick to types that have a clean Postgres
  equivalent (text, integer, the timestamp-as-integer-ms convention). Don't lean
  on SQLite's loose/dynamic typing — treat columns as strictly typed as Postgres
  would.
- **Text UUID primary keys.** Keep `id text PK` (generated with
  `crypto.randomUUID()`), not SQLite `INTEGER ... AUTOINCREMENT` rowids. Text
  UUIDs map 1:1 to Postgres `text`/`uuid` and carry no rowid semantics to unwind.
- **ISO-8601 date strings** (already the convention). Stored as ISO strings,
  displayed via `date-fns`. These move to Postgres `text`/`timestamptz` without
  reinterpretation. Where we use integer-ms timestamps (`createdAt`/`updatedAt`),
  keep them integer and consistent so the Postgres mapping is mechanical.
- **Integer cents for money** (already the convention). Never floats. Integer
  cents map straight to Postgres `integer`/`bigint`.
- **Booleans stored as integer 0/1.** SQLite has no native boolean; we store
  0/1. These map to Postgres `boolean` on migration — keep values strictly 0/1
  (never `'true'`/`'false'` strings or NULL-as-false) so the cast is trivial.
  Declare them as Drizzle `integer(... { mode: 'boolean' })` so the app type is
  already boolean and only the underlying dialect changes.
- **JSON stored as text blobs** — the `tenant_branding.colors` / `darkColors`
  brand blobs (Section 4.1). Target is Postgres **`jsonb`**. Keep them
  **parse-clean** (always valid JSON written via `JSON.stringify`, parsed via
  `JSON.parse` at the data-layer edge; no manual string concatenation, no
  trailing commas, no partial writes). A clean text-JSON column converts to
  `jsonb` with a single cast.
- **Declare all foreign keys + indexes in Drizzle.** Don't rely on
  SQLite-implicit behavior (e.g. implicit rowid, or FK enforcement that's off by
  default). Every `tenantId` FK and every index that the isolation predicates
  depend on (notably the `tenantId` columns we filter on constantly) is declared
  explicitly in `schema.ts` so it regenerates on Postgres and so query plans stay
  honest on both engines.
- **No raw `libsql` / `client.execute` SQL in app code.** All reads and writes go
  through Drizzle's query builder (the isolation predicates in Section 3 are
  already Drizzle `SQL` conditions). Raw libSQL calls would bypass the dialect
  abstraction and become per-call rewrites later. The one allowed `sql` usage is
  Drizzle's portable `sql` template helper for predicates like `sql\`1 = 0\``,
  which Drizzle renders per-dialect.
- **One switch point.** Keep the Turso->Postgres change confined to the single
  Drizzle **`dialect`/driver config** point (`drizzle.config.ts` + the
  `src/db/client.ts` driver). Nothing in `src/actions/**` or `src/lib/access.ts`
  should need to know which engine is underneath.

**Framing:** do these now so the deferred Supabase move (Phase 9) is a *config
swap*, not a rewrite. None of them add work today — they're mostly the
conventions `CLAUDE.md` already mandates; this section just makes "stay portable"
an explicit, checkable design constraint.

---

## 8. Phased rollout

Each phase is one PR, independently shippable, and mirrors the RBAC plan's
task-by-task structure. **Reads must be tenant-scoped before any tenant beyond
the first exists** — until then, the single backfilled tenant means the predicate
is a harmless no-op, so we can land schema + scoping safely before going
multi-tenant in production. Phases 0-8 are the deliverable multi-tenant work on
Turso/libSQL; **Phase 9 (the Supabase/Postgres migration) is DEFERRED and gated
on the first paying customer** — it is not part of this delivery.

- [ ] **Phase 0 — Test harness check.** Vitest already exists (from RBAC). Add a
  `tenant` describe block scaffold in `access.test.ts`. No behavior change.
  *Ship.*

- [ ] **Phase 1 — Schema + backfill (no behavior change).**
  - Add `tenants`, `tenant_branding`; add nullable `tenantId` to every
    tenant-owned table + `users`; add `users.isPlatformAdmin`.
  - `drizzle-kit generate` + `migrate`.
  - Backfill the existing instance into one tenant (7.2). In this `tc-dash-demo`
    line that first tenant is the Crestline demo data, seeded with
    **`slug = 'tenant'`** (display `name` = "Crestline Realty"); copy current
    `activeBrand` into its `tenant_branding`.
  - Tighten `tenantId` NOT NULL on owned tables.
  - `db/seed.ts` updated to create that demo tenant (`slug = 'tenant'`). A real
    onboarded office instead gets its own real slug.
  - *Ship — app still behaves exactly as today (one tenant, predicate is a
    no-op).*

- [ ] **Phase 2 — Auth + tenant resolver.**
  - `auth.ts`/`auth.config.ts`: JWT + session carry `tenantId` +
    `isPlatformAdmin` (6.1).
  - Extend `ViewerScope` + `getViewerScope()` (tenant from JWT, fail-closed,
    tenant-scoped email->agent match) (3.1-3.2).
  - Add `tenantScopeCondition()` + `requireTenantWrite()` to `access.ts`.
  - **Vitest:** tenant scope decisions (fail-closed when no tenant; platform
    admin unrestricted; predicate shape). *Ship.*

- [ ] **Phase 3 — Scope reads.** AND `tenantScopeCondition` into every read in
  `transactions.ts`, `tasks.ts`, `agents.ts`, `transaction-agents.ts`,
  `users.ts`, `access-requests.ts`, and any direct Server Component queries (3.6
  checklist). *Ship.*

- [ ] **Phase 4 — Guard writes.** Route every insert through `requireTenantWrite`
  (stamp `tenantId` from session); add `eq(table.tenantId, scope.tenantId)` to
  every update/delete `WHERE`; verify cross-entity links (transaction<->agent)
  are same-tenant. *Ship.*

- [ ] **Phase 5 — Per-tenant branding.** `tenant_branding` resolution in the root
  layout; server-rendered brand CSS; `ThemeProvider` takes `initialBrand` from
  the server; retire `activeBrand` as the live source. Logo = URL string interim
  (4.4). *Ship.*

- [ ] **Phase 6 — Per-tenant templates + seeding.** Tenant-scope all template
  reads/writes; default-pack seeding on tenant creation; `createTransaction`
  loads templates scoped to the transaction's tenant and stamps `tenantId` on
  stamped tasks. *Ship.*

- [ ] **Phase 7 — Settings/admin UI + platform console.** Settings: edit this
  office's branding + templates (already mostly built; just tenant-scoped now).
  Minimal `/platform` console for d20web: create tenant, seed, suspend. Route
  protection for `/platform`. *Ship.*

- [ ] **Phase 8 — Tests + hardening.** Cross-tenant isolation tests (a viewer in
  tenant A cannot read/write tenant B via forged ids), suspended-tenant login
  rejection, fail-closed-when-no-tenant. Optional: per-tenant export/import
  utility. *Ship.*

- [ ] **Phase 9 (DEFERRED) — Migrate Turso/SQLite -> Supabase/Postgres.**
  **Do NOT start this phase until d20web has a paying customer.** Until then the
  platform stays on **Turso/libSQL** — it is the cheapest, lowest-ops choice for
  the demo and early sales, and there is no reason to take on Postgres operations
  before revenue justifies it. This phase is intentionally last and gated.

  When a paying customer makes it worthwhile, the move should be a **Drizzle
  dialect/driver swap, not a rewrite** — because §7.5 (Migration-readiness) kept
  the schema and data portable from day one. Cross-reference the `CLAUDE.md`
  **"Supabase migration path"** note: *switching from Turso (SQLite) to Supabase
  (Postgres) means changing the Drizzle driver config and running a migration,
  not rewriting queries.* Sketch of the work when it lands:
  - Flip the single Drizzle **`dialect`/driver** config point (`drizzle.config.ts`
    + `src/db/client.ts`) from libSQL to Postgres.
  - Regenerate migrations on the Postgres dialect from the same `schema.ts`
    (integer-0/1 booleans -> `boolean`; text-JSON brand blobs -> `jsonb`; text
    UUID PKs and ISO date strings carry over as-is — see §7.5).
  - Migrate data per tenant (`WHERE tenantId = ?` export/import from §7.4).
  - Re-run the full Vitest + integration isolation suite against Postgres before
    cutover.

  *Deferred — not part of the initial multi-tenant delivery. Gated on first
  paying customer.*

### 8.1 Testing strategy

Mirror `access.test.ts` — **Vitest unit tests on the pure, security-critical
logic** (no DB needed):
- `computeViewerScope` now includes tenant: no `tenantId` -> fail-closed;
  platform admin -> unrestricted; normal user -> bound to their tenant.
- `tenantScopeCondition` returns `1=0` when no tenant, `undefined` for platform
  admin, `eq(...)` otherwise.
- Composition: tenant ring AND agent ring (assert both predicates are present).
- `requireTenantWrite` denies when no tenant; returns the session tenantId
  otherwise.

Plus a small **integration-style** test layer (can use an in-memory libSQL) for
the highest-value property: *a viewer in tenant A, given a tenant-B id, reads
zero rows and writes zero rows.* This is the one test that proves isolation end
to end and should gate every release touching the data layer.

---

## 9. Risks & open questions for the owner

1. **Tenant resolution — subdomain vs. session (DECISION NEEDED).** Plan
   recommends **session-derived first, subdomain second**. Confirm we ship v1
   without subdomains (one shared login, tenant from JWT). If white-label
   subdomains are a near-term sales requirement, we need a DNS/wildcard-TLS
   decision on Vercel up front and Phase 2 expands.

2. **Logo upload storage (DECISION NEEDED).** Current MVP rule is "no file
   uploads," but per-tenant logos are uploads. Plan recommends shipping with a
   **URL-string interim** (d20web pastes a hosted logo URL) and treating real
   upload (Supabase Storage / Cloudflare R2) as a fast-follow. OK? Or is
   self-serve logo upload required at launch?

3. **Platform superadmin tooling scope.** Plan recommends an `isPlatformAdmin`
   flag + a thin `/platform` console (create/seed/suspend), **not** a fifth
   role. How much console do you want at launch vs. doing tenant creation via a
   seed/CLI initially?

4. **Billing attach point.** Reserved columns on `tenants`
   (`billingCustomerId`, `billingStatus`, `planSeatLimit`) document where Stripe
   plugs in; **billing integration is out of scope** for this plan. Confirm
   $49/mo per office, unlimited seats (so `planSeatLimit = null`), tenant =
   billing boundary. When should we enforce `past_due` -> read-only/locked?

5. **Can agents/users span tenants? (DECISION NEEDED).** Plan recommends **one
   tenant per user** (simplest, fits the business) and keeps `users.email`
   globally unique. If the same human must work across two offices later, we'd
   need a `tenant_memberships` join table and tenant disambiguation at login —
   a bigger change. Confirm one-tenant-per-user is acceptable for v1.

6. **Cross-office agents.** Agents are tenant-scoped here. If a single licensed
   agent genuinely operates under two brokerages on the platform, they'd be two
   separate `agents` rows (one per tenant). Acceptable? (It keeps isolation
   clean; the alternative — shared agent identities — leaks data between tenants
   and is not recommended.)

7. **Suspended/delinquent tenant UX.** Where exactly do we block — at login, or
   allow login but show a "billing locked" read-only state? Plan assumes reject
   at login for `status != active`; confirm.

8. **Database engine — Turso now, Supabase/Postgres deferred (DECISION CONFIRMED-FOR-NOW).** The platform stays on **Turso/libSQL** through Phases 0-8. The Supabase/Postgres migration is **Phase 9 (DEFERRED)** and is explicitly **gated on d20web landing its first paying customer** — we do not take on Postgres ops before revenue justifies it. §7.5 (Migration-readiness) keeps the schema/data portable so that move stays a Drizzle dialect/driver config swap rather than a rewrite (per the `CLAUDE.md` "Supabase migration path" note). Confirm this gate; flag early if a near-term enterprise deal needs Postgres (e.g. RLS, `jsonb`, regional hosting) sooner.

---

## Appendix A — Files touched (implementation map)

*Create:* `tenants` + `tenant_branding` schema (in `src/db/schema.ts`),
migration files, `src/app/platform/*` (later phase), tenant-aware test blocks in
`src/lib/access.test.ts`.

*Modify:* `src/db/schema.ts` (add `tenantId` across owned tables + `users`),
`src/lib/access.ts` (extend `ViewerScope`, `getViewerScope`, add
`tenantScopeCondition` + `requireTenantWrite`), `src/lib/auth.ts` +
`src/lib/auth.config.ts` (JWT/session carry tenant), `src/proxy.ts` (route
protection), `src/lib/brand-config.ts` (retire `activeBrand` as live source),
`src/components/providers/theme-provider.tsx` (server-provided brand),
`src/app/(dashboard)/layout.tsx` (resolve + inject tenant brand),
`src/actions/transactions.ts`, `src/actions/tasks.ts`, `src/actions/agents.ts`,
`src/actions/transaction-agents.ts`, `src/actions/users.ts`,
`src/actions/access-requests.ts`, `src/db/seed.ts`.

*Unchanged (reused):* `src/lib/brand-utils.ts` (`generateBrandCss` is pure),
`src/lib/task-stamping.ts` (pure; caller stamps tenant), `src/lib/roles.ts`
(stays Edge-safe + role-only).

---

*End of plan. Design only — awaiting owner sign-off before any implementation.*
