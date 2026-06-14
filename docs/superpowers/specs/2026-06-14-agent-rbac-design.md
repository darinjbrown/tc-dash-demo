# Agent-Scoped RBAC (read-only) — Design

**Date:** 2026-06-14
**Status:** Approved (brainstorming) — ready for implementation plan
**Repo:** tc-dashboard (single repo; no fork)

## Context & Strategic Decisions

The product owner wants two capabilities:

1. **Agent RBAC** — an `agent` user should see only the transactions they are
   associated with.
2. **Multi-tenancy** — sell the app to multiple brokerages, each isolated to
   its own office's data.

### Decision 1 — One repo, no fork

Multi-tenancy is a strict superset of single-tenancy (a single office is
multi-tenant with one tenant). Forking into a separate repo would double
maintenance forever and risk security drift between codebases. We stay in one
repo. The existing customer is protected by **deployment** isolation (separate
database / feature gating) when the time comes, not by **code** isolation.

### Decision 2 — Defer real multi-tenancy to a Supabase migration

The product owner will keep the **free Turso** implementation until there is a
paying customer. If the product finds a market, the plan is to **refactor to
Supabase with a separate schema per office** (schema-per-tenant).

Consequence: an `organizationId`-on-every-row model would be **throwaway** work,
because in schema-per-tenant the schema *is* the tenant boundary. Therefore we
do **not** build shared-DB tenancy scaffolding now. The only "prep" is keeping
all data access funneled through the central `@/db/client` module (already the
case) so the future Supabase swap is contained.

### Decision 3 — This spec covers Phase 1 only

- **Phase 1 (now, free Turso, this repo):** Agent RBAC. Orthogonal to tenancy
  (it concerns which *agent* is on which *transaction*), so nothing here is
  wasted by the later migration.
- **Phase 2 (when first paying customer lands):** Migrate to Supabase,
  schema-per-office. Separate spec, separate plan. Out of scope here.

## Phase 1 Requirements

- A logged-in user with `role: 'agent'` sees **only** transactions they are an
  agent on (listing or buyer side, via `transactionAgents`).
- Agents are **read-only**: they may view their transactions, tasks, and dates,
  but cannot create, edit, delete, or change status of anything, and cannot see
  the Agents, Settings, Templates, or User Management areas.
- All other roles (`admin`, `broker`, `tc`) are **unaffected** — they continue
  to see and manage everything.
- Enforcement is **server-side** (queries + mutations). UI hiding is cosmetic
  convenience, never the security boundary.

### User ↔ Agent linkage: match by email

There is currently **no foreign key** between `users` (logins) and `agents`
(people on transactions). For Phase 1 we resolve the link by **email match**:
`lower(users.email) == lower(agents.email)`.

- Chosen for zero schema change and fastest delivery.
- Known risk: breaks if a login email differs from the agent record email, or an
  agent uses multiple emails. Mitigated by **fail-closed** behavior (below) and
  by isolating the match in one function so it can be swapped for an explicit
  `userId` FK later without touching call sites.

## Architecture

### A. Scope resolver — single source of truth

New module `src/lib/access.ts`:

- `getViewerScope(): Promise<{ userId: string | null; role: string; agentIds: string[] | null }>`
  - Calls `auth()`.
  - For `role === 'agent'`: query `agents WHERE lower(email) = lower(session.email)`
    and return their ids as `agentIds`.
  - For all other roles: return `agentIds: null`, meaning **unrestricted**.
  - **Fail-closed:** an `agent` with no matching agent record returns
    `agentIds: []` → sees nothing. Never falls through to "see everything."
- `requireWriteAccess(): Promise<{ success: false; error: string } | null>`
  - Returns the standard error object when the viewer is an `agent`; returns
    `null` (proceed) otherwise. Per project convention, server actions return
    `{ success, error }` and never throw.

The email match exists in exactly one place (`getViewerScope`), so switching to
an explicit `users.id → agents.userId` link later is a one-spot change.

### B. Scope the read queries

A helper converts a scope into a reusable Drizzle predicate:

- `agentIds === null` → no filter (admin/broker/tc).
- otherwise → `transactions.id IN (SELECT transactionId FROM transactionAgents WHERE agentId IN (agentIds))`.
  An empty `agentIds` array yields a predicate that matches nothing.

Apply to every read path:

- `src/actions/transactions.ts`: `getTransactions`, `getActiveTransactionsList`,
  `getTransactionById` (returns `null` when out of scope — this is the
  direct-URL guard).
- `src/actions/tasks.ts`: `getDashboardStats`, `getUpcomingTasks`,
  `getOverdueTasks`, `getUpcomingDeadlines` (each joins `transactionTasks` →
  `transactions`; add the scope predicate to the join's `WHERE`).

### C. Mutation guards (defense in depth)

Call `requireWriteAccess()` at the top of every mutation and short-circuit on a
non-null result:

- `transactions.ts`: `createTransaction`, `updateTransaction`,
  `updateTransactionStatus`, `updateTransactionNotes`, `deleteTransaction`.
- `tasks.ts`: `updateTaskStatus`, `createCustomTask`, `snoozeTask`,
  `reorderTransactionTasks`, and the template CRUD (already admin/TC territory).
- `agents.ts`, `users.ts`, template-group actions: guarded as well.

Even with UI controls hidden, the server rejects any agent write.

### D. Route + UI gating

- **New `src/middleware.ts`** — the currently-missing central guard. The
  `(dashboard)` layout is a client component with no `auth()` check and there is
  no middleware today, so dashboard routes are not server-side protected.
  Middleware will:
  - require a session for `(dashboard)` routes;
  - block `agent` from `/agents`, `/settings`, `/templates`, `/users`
    (redirect to `/dashboard`).
- **Sidebar (`app-sidebar.tsx`) and `mobile-nav.tsx`** — extend the existing
  `isAdmin` gating pattern so agents see only **Dashboard** and **Transactions**.
- **Transaction list/detail** — server components pass a `canEdit` flag
  (`false` for agents) to hide New / Edit / Delete / status / task controls and
  the "New Transaction" button.

### E. Testing

- Unit-test `getViewerScope`: email normalization (case/whitespace), no-match →
  fail-closed (`agentIds: []`), non-agent → `null`.
- Test scoped reads exclude other agents' transactions; `getTransactionById`
  returns `null` for a non-owned id.
- Test each mutation rejects the `agent` role.
- Principle: server-side enforcement is the security boundary; UI hiding is
  cosmetic.

## Out of Scope (Phase 1)

- Any `organizationId` columns, tenant routing, or DB/schema-per-office
  plumbing — deferred to the Phase 2 Supabase migration.
- Limited agent edits (e.g. marking own tasks complete). Agents are read-only.
- Changing the `users`/`agents` relationship to an explicit FK — revisit only if
  email matching proves fragile in practice.
