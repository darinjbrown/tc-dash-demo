# Agent-Scoped RBAC Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restrict `agent`-role users to a read-only view of only the transactions they are associated with, enforced server-side, without affecting `admin`/`broker`/`tc` users.

**Architecture:** A single scope resolver (`src/lib/access.ts`) maps the logged-in user to a set of agent ids by case-insensitive email match (fail-closed: no match → sees nothing). Read queries AND a scope condition into their `WHERE`; mutations short-circuit for agents; a new NextAuth split-config `middleware.ts` blocks agents from admin routes; the sidebar and a couple of UI controls hide write affordances cosmetically.

**Tech Stack:** Next.js 16 (App Router), TypeScript, Drizzle ORM (libSQL/Turso), NextAuth v5 (JWT sessions), Vitest (added here for unit tests).

**Reference spec:** `docs/superpowers/specs/2026-06-14-agent-rbac-design.md`

---

## File Structure

- `src/lib/access.ts` *(create)* — scope resolver + pure decision helpers + query-scope condition + write guard. One responsibility: "who can see/do what."
- `src/lib/access.test.ts` *(create)* — unit tests for the pure, security-critical logic.
- `src/lib/auth.config.ts` *(create)* — Edge-safe NextAuth config (callbacks, pages, session strategy; no adapter/bcrypt). Shared by the full auth instance and middleware.
- `src/lib/auth.ts` *(modify)* — spread `authConfig`, keep adapter + Credentials provider.
- `src/middleware.ts` *(create)* — route protection: require session, block agents from admin routes.
- `src/actions/transactions.ts` *(modify)* — scope reads, guard mutations.
- `src/actions/tasks.ts` *(modify)* — scope dashboard reads, guard mutations.
- `src/actions/agents.ts`, `src/actions/users.ts` *(modify)* — guard mutations.
- `src/components/layout/app-sidebar.tsx` *(modify)* — hide admin/TC nav for agents.
- `src/app/(dashboard)/transactions/page.tsx` *(modify)* — hide "New Transaction" for agents.
- `src/components/transactions/transaction-detail.tsx` *(modify)* — hide edit/delete/status controls for agents.
- `vitest.config.ts`, `package.json` *(create/modify)* — test harness.

---

## Task 0: Add a test harness (Vitest)

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`

- [ ] **Step 1: Install Vitest**

Run:
```bash
npm install -D vitest@^2
```
Expected: installs without error; `vitest` appears in `devDependencies`.

- [ ] **Step 2: Add the test script**

Modify `package.json` `scripts` — add this line after `"lint": "eslint",`:
```json
    "test": "vitest run",
```

- [ ] **Step 3: Create the Vitest config (resolves the `@/` alias)**

Create `vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
```

- [ ] **Step 4: Verify the runner works (no tests yet)**

Run: `npm test`
Expected: Vitest runs and reports "No test files found" (exit 0) or similar — confirms the harness is wired.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json vitest.config.ts
git commit -m "chore: add vitest test harness"
```

---

## Task 1: Pure scope-decision logic (TDD)

These pure functions carry the security-critical decisions and need no DB.

**Files:**
- Create: `src/lib/access.ts`
- Create: `src/lib/access.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/access.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { normalizeEmail, computeViewerScope, isReadOnlyRole } from '@/lib/access';

describe('normalizeEmail', () => {
  it('lowercases and trims', () => {
    expect(normalizeEmail('  Jane@Example.COM ')).toBe('jane@example.com');
  });
  it('returns empty string for null/undefined', () => {
    expect(normalizeEmail(null)).toBe('');
    expect(normalizeEmail(undefined)).toBe('');
  });
});

describe('computeViewerScope', () => {
  it('agent gets restricted to matched agent ids', () => {
    const scope = computeViewerScope({ role: 'agent', userId: 'u1', matchedAgentIds: ['a1', 'a2'] });
    expect(scope.agentIds).toEqual(['a1', 'a2']);
  });
  it('agent with no match is fail-closed (empty array, NOT null)', () => {
    const scope = computeViewerScope({ role: 'agent', userId: 'u1', matchedAgentIds: [] });
    expect(scope.agentIds).toEqual([]);
  });
  it('admin/broker/tc are unrestricted (null)', () => {
    for (const role of ['admin', 'broker', 'tc']) {
      expect(computeViewerScope({ role, userId: 'u1', matchedAgentIds: [] }).agentIds).toBeNull();
    }
  });
});

describe('isReadOnlyRole', () => {
  it('only agent is read-only', () => {
    expect(isReadOnlyRole('agent')).toBe(true);
    expect(isReadOnlyRole('admin')).toBe(false);
    expect(isReadOnlyRole('tc')).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — `Cannot find module '@/lib/access'` / exports undefined.

- [ ] **Step 3: Write the minimal pure implementation**

Create `src/lib/access.ts`:
```ts
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

export function isReadOnlyRole(role: string): boolean {
  return role === 'agent';
}

export function computeViewerScope(input: {
  role: string;
  userId: string | null;
  matchedAgentIds: string[];
}): ViewerScope {
  if (isReadOnlyRole(input.role)) {
    return { userId: input.userId, role: input.role, agentIds: input.matchedAgentIds };
  }
  return { userId: input.userId, role: input.role, agentIds: null };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS (all 7 assertions green).

- [ ] **Step 5: Commit**

```bash
git add src/lib/access.ts src/lib/access.test.ts
git commit -m "feat: pure scope-decision helpers for agent RBAC"
```

---

## Task 2: DB-wired resolver, write guard, and query-scope condition

**Files:**
- Modify: `src/lib/access.ts`

- [ ] **Step 1: Add the resolver, guard, and condition builder**

Append to `src/lib/access.ts` (keep the pure functions above):
```ts
import { auth } from '@/lib/auth';
import { db } from '@/db/client';
import { agents, transactions, transactionAgents } from '@/db/schema';
import { inArray, sql, type SQL } from 'drizzle-orm';

/**
 * Resolve the current viewer's scope. Email-match is isolated HERE only —
 * swap to an explicit users.id -> agents.userId link later without touching callers.
 */
export async function getViewerScope(): Promise<ViewerScope> {
  const session = await auth();
  // Default to the most restricted role when unknown (fail-closed).
  const role = (session?.user as { role?: string } | undefined)?.role ?? 'agent';
  const userId = session?.user?.id ?? null;
  const email = normalizeEmail(session?.user?.email);

  let matchedAgentIds: string[] = [];
  if (isReadOnlyRole(role) && email) {
    const rows = await db
      .select({ id: agents.id })
      .from(agents)
      .where(sql`lower(${agents.email}) = ${email}`);
    matchedAgentIds = rows.map((r) => r.id);
  }

  return computeViewerScope({ role, userId, matchedAgentIds });
}

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
```

- [ ] **Step 2: Verify it typechecks**

Run: `npm run build`
Expected: build succeeds with no TypeScript errors (the new exports compile; nothing consumes them yet).

- [ ] **Step 3: Commit**

```bash
git add src/lib/access.ts
git commit -m "feat: viewer-scope resolver, write guard, and tx scope condition"
```

---

## Task 3: Scope the transaction read queries

**Files:**
- Modify: `src/actions/transactions.ts`

- [ ] **Step 1: Import the scope helpers**

In `src/actions/transactions.ts`, the `auth` import already exists (line 16). Add below it:
```ts
import { getViewerScope, transactionScopeCondition } from '@/lib/access';
```
Confirm `and` is in the `drizzle-orm` import (it is, line 14).

- [ ] **Step 2: Scope `getTransactions` (line ~101)**

Replace the query that starts `const rows = await db.select({ ... }).from(transactions).orderBy(...)` so it filters by scope. Change:
```ts
    .from(transactions)
    .orderBy(desc(transactions.createdAt));
```
to:
```ts
    .from(transactions)
    .where(transactionScopeCondition(await getViewerScope()))
    .orderBy(desc(transactions.createdAt));
```
(`.where(undefined)` is a no-op in Drizzle, so unrestricted users are unaffected.)

- [ ] **Step 3: Scope `getActiveTransactionsList` (line ~232)**

Change:
```ts
    .from(transactions)
    .where(inArray(transactions.status, ['listed', 'in_escrow']))
    .orderBy(asc(transactions.expectedCloseDate));
```
to:
```ts
    .from(transactions)
    .where(and(inArray(transactions.status, ['listed', 'in_escrow']), transactionScopeCondition(await getViewerScope())))
    .orderBy(asc(transactions.expectedCloseDate));
```

- [ ] **Step 4: Scope `getTransactionById` (line ~300) — the direct-URL guard**

Change:
```ts
    .from(transactions)
    .where(eq(transactions.id, id));
```
to:
```ts
    .from(transactions)
    .where(and(eq(transactions.id, id), transactionScopeCondition(await getViewerScope())));
```
An agent requesting a transaction they're not on now gets no row → the function returns `null`.

- [ ] **Step 5: Verify build**

Run: `npm run build`
Expected: build succeeds, no TS errors.

- [ ] **Step 6: Commit**

```bash
git add src/actions/transactions.ts
git commit -m "feat: scope transaction reads to viewer's agent transactions"
```

---

## Task 4: Scope the dashboard read queries

**Files:**
- Modify: `src/actions/tasks.ts`

These four functions join `transactionTasks` → `transactions`, so the condition on `transactions.id` is valid in each `WHERE`.

- [ ] **Step 1: Import the scope helpers**

At the top of `src/actions/tasks.ts`, add:
```ts
import { getViewerScope, transactionScopeCondition } from '@/lib/access';
```
`and` is already imported from `drizzle-orm` (line 16).

- [ ] **Step 2: Scope `getDashboardStats` (line ~68)**

Resolve scope once at the top of the function body (before the `Promise.all`):
```ts
  const scope = await getViewerScope();
  const txScope = transactionScopeCondition(scope);
```
Then add `txScope` as the last argument to each of the four `and(...)` blocks in the `Promise.all`. For the first three (the task-count queries) add `txScope` inside their `and(...)`. For the fourth (`closingResult`, which is `from(transactions)`) add `txScope` inside its `and(...)`. Example for the first:
```ts
      .where(
        and(
          eq(transactionTasks.dueDate, today),
          notInArray(transactionTasks.status, ['completed', 'waived', 'not_applicable']),
          notInArray(transactions.status, ['closed', 'cancelled']),
          txScope,
        ),
      ),
```
Apply the same `txScope,` addition to the `dueWeekResult`, `overdueResult`, and `closingResult` `and(...)` blocks.

- [ ] **Step 3: Scope `getUpcomingTasks` (line ~144)**

Add at the top of the function body:
```ts
  const txScope = transactionScopeCondition(await getViewerScope());
```
Add `txScope,` as the final argument inside the `and(...)` of its `.where(...)`.

- [ ] **Step 4: Scope `getOverdueTasks` (line ~184)**

Add at the top of the function body:
```ts
  const txScope = transactionScopeCondition(await getViewerScope());
```
Add `txScope,` as the final argument inside the outer `and(...)` of its `.where(...)` (the one also containing the `or(...)`).

- [ ] **Step 5: Scope `getUpcomingDeadlines` (line ~230)**

Add at the top of the function body:
```ts
  const txScope = transactionScopeCondition(await getViewerScope());
```
Add `txScope,` as the final argument inside the `and(...)` of its `.where(...)`.

- [ ] **Step 6: Verify build**

Run: `npm run build`
Expected: build succeeds, no TS errors.

- [ ] **Step 7: Commit**

```bash
git add src/actions/tasks.ts
git commit -m "feat: scope dashboard task reads to viewer's transactions"
```

---

## Task 5: Guard all mutations (defense in depth)

Agents are read-only; every mutation must reject them server-side even though the UI hides controls.

**Files:**
- Modify: `src/actions/transactions.ts`, `src/actions/tasks.ts`, `src/actions/agents.ts`, `src/actions/users.ts`

- [ ] **Step 1: transactions.ts mutations**

Ensure the import from Task 3 includes `requireWriteAccess`:
```ts
import { getViewerScope, transactionScopeCondition, requireWriteAccess } from '@/lib/access';
```
At the very start of each function body — `createTransaction`, `updateTransaction`, `updateTransactionStatus`, `updateTransactionNotes`, `deleteTransaction` — add:
```ts
  const denied = await requireWriteAccess();
  if (denied) return denied;
```
Place it as the first statement (before schema parsing / `auth()` calls). The return type of each already matches `{ success: boolean; error?: string }`.

- [ ] **Step 2: tasks.ts mutations**

Add to the import added in Task 4:
```ts
import { getViewerScope, transactionScopeCondition, requireWriteAccess } from '@/lib/access';
```
Add the same two-line guard at the start of: `updateTaskStatus`, `createCustomTask`, `snoozeTask`, `reorderTransactionTasks`, `createTaskTemplateGroup`, `updateTaskTemplateGroup`, `deleteTaskTemplateGroup`, `toggleTaskTemplateGroupActive`, `createTaskTemplatesMulti`, `createTaskTemplate`, `updateTaskTemplate`, `deleteTaskTemplate`, `reorderTaskTemplates`, `toggleTaskTemplateActive`:
```ts
  const denied = await requireWriteAccess();
  if (denied) return denied;
```

- [ ] **Step 3: agents.ts and users.ts mutations**

Open each file and add `import { requireWriteAccess } from '@/lib/access';`. Add the same two-line guard at the start of every exported mutation (any function that inserts/updates/deletes — i.e. all exports whose name is not `get*`). Leave `get*` query functions unguarded (route gating + read scoping cover them; agents never reach these pages anyway).

- [ ] **Step 4: Verify build**

Run: `npm run build`
Expected: build succeeds, no TS errors.

- [ ] **Step 5: Commit**

```bash
git add src/actions/transactions.ts src/actions/tasks.ts src/actions/agents.ts src/actions/users.ts
git commit -m "feat: reject agent-role writes in all server-action mutations"
```

---

## Task 6: Route protection via NextAuth split config + middleware

The Credentials provider/bcrypt/Drizzle adapter are not Edge-safe, so middleware uses a separate Edge-safe instance built from a shared config.

**Files:**
- Create: `src/lib/auth.config.ts`
- Modify: `src/lib/auth.ts`
- Create: `src/middleware.ts`

- [ ] **Step 1: Create the Edge-safe shared config**

Create `src/lib/auth.config.ts`:
```ts
import type { NextAuthConfig } from 'next-auth';

export const authConfig = {
  session: { strategy: 'jwt' },
  pages: { signIn: '/login' },
  providers: [], // real providers are added in the full instance (auth.ts)
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = (user as { id?: string }).id;
        token.role = (user as { role?: string }).role;
      }
      return token;
    },
    session({ session, token }) {
      if (token) {
        session.user.id = token.id as string;
        (session.user as { id: string; role?: string }).role = token.role as string;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
```

- [ ] **Step 2: Refactor `src/lib/auth.ts` to spread the shared config**

Replace the file body so the callbacks/pages/session come from `authConfig` and only the adapter + Credentials provider remain here:
```ts
import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { DrizzleAdapter } from '@auth/drizzle-adapter';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { users } from '@/db/schema';
import { authConfig } from '@/lib/auth.config';

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: DrizzleAdapter(db),
  providers: [
    Credentials({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const user = await db
          .select()
          .from(users)
          .where(eq(users.email, credentials.email as string))
          .get();

        if (!user?.hashedPassword) return null;

        const valid = await bcrypt.compare(
          credentials.password as string,
          user.hashedPassword,
        );
        if (!valid) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name ?? undefined,
          role: user.role,
        };
      },
    }),
  ],
});
```

- [ ] **Step 3: Create the middleware**

Create `src/middleware.ts`:
```ts
import NextAuth from 'next-auth';
import { NextResponse } from 'next/server';
import { authConfig } from '@/lib/auth.config';

const { auth } = NextAuth(authConfig);

// Routes an agent (read-only) may never reach.
const AGENT_FORBIDDEN = ['/agents', '/settings', '/templates', '/users'];

export default auth((req) => {
  const { nextUrl } = req;
  const session = req.auth;
  const role = (session?.user as { role?: string } | undefined)?.role;

  if (!session) {
    return NextResponse.redirect(new URL('/login', nextUrl.origin));
  }

  if (role === 'agent' && AGENT_FORBIDDEN.some((p) => nextUrl.pathname.startsWith(p))) {
    return NextResponse.redirect(new URL('/dashboard', nextUrl.origin));
  }

  return NextResponse.next();
});

export const config = {
  // Run on everything except auth API, the login page, and static assets.
  matcher: ['/((?!api|login|_next/static|_next/image|favicon.ico|.*\\..*).*)'],
};
```

- [ ] **Step 4: Verify build**

Run: `npm run build`
Expected: build succeeds. (If the build complains that middleware imports Node-only code, confirm `auth.config.ts` has no `db`/`bcrypt`/adapter imports — it must not.)

- [ ] **Step 5: Manual smoke — login still works for a TC**

Run: `npm run dev`. Log in as an existing `tc`/`admin` user. Expected: dashboard loads; all nav items present; no redirect loop.

- [ ] **Step 6: Commit**

```bash
git add src/lib/auth.config.ts src/lib/auth.ts src/middleware.ts
git commit -m "feat: route protection middleware blocking agents from admin routes"
```

---

## Task 7: Hide admin/TC navigation for agents

**Files:**
- Modify: `src/components/layout/app-sidebar.tsx`

- [ ] **Step 1: Gate the nav items by role**

In `src/components/layout/app-sidebar.tsx`, the `NAV_ITEMS` array (line ~39) currently lists Dashboard, Transactions, Agents, Settings, Templates. Agents may only see Dashboard and Transactions. Replace the `isAdmin` line (~61) and the nav-render line (~108):

Add after `const isAdmin = session?.user?.role === 'admin';`:
```tsx
  const isAgent = session?.user?.role === 'agent';
  const AGENT_NAV_HREFS = new Set(['/dashboard', '/transactions']);
  const visibleNav = isAgent ? NAV_ITEMS.filter((i) => AGENT_NAV_HREFS.has(i.href)) : NAV_ITEMS;
```
Then change:
```tsx
              {[...NAV_ITEMS, ...(isAdmin ? ADMIN_NAV_ITEMS : [])].map(({ href, label, icon: Icon }) => (
```
to:
```tsx
              {[...visibleNav, ...(isAdmin ? ADMIN_NAV_ITEMS : [])].map(({ href, label, icon: Icon }) => (
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/components/layout/app-sidebar.tsx
git commit -m "feat: limit sidebar nav to Dashboard + Transactions for agents"
```

---

## Task 8: Hide write controls for agents (cosmetic)

The server already rejects agent writes; this removes confusing affordances.

**Files:**
- Modify: `src/app/(dashboard)/transactions/page.tsx`
- Modify: `src/components/transactions/transaction-detail.tsx`

- [ ] **Step 1: Hide "New Transaction" on the list page**

`src/app/(dashboard)/transactions/page.tsx` is a client component. Add the session hook import near the other imports:
```tsx
import { useSession } from 'next-auth/react';
```
Inside `TransactionsPage`, after the existing `useState` hooks (~line 41), add:
```tsx
  const { data: session } = useSession();
  const canEdit = (session?.user as { role?: string } | undefined)?.role !== 'agent';
```
Wrap the header "New Transaction" `<Button>` (lines ~123–126) so it only renders when `canEdit`:
```tsx
        {canEdit && (
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="size-4 mr-1.5" />
            New Transaction
          </Button>
        )}
```
Also wrap the empty-state "New Transaction" `<Button>` (lines ~236–239) in `{canEdit && ( ... )}` the same way.

- [ ] **Step 2: Hide edit/delete/status controls on the detail view**

Open `src/components/transactions/transaction-detail.tsx`. At the top of the component, add (if `useSession` is not already imported, import it from `next-auth/react`):
```tsx
  const { data: session } = useSession();
  const canEdit = (session?.user as { role?: string } | undefined)?.role !== 'agent';
```
Wrap each write affordance in `{canEdit && ( ... )}`: the Edit button, the Delete/archive button, the status-change control, and any "add task"/task-status controls rendered directly in this component. (Search the file for the buttons that call `updateTransaction*`, `deleteTransaction`, `updateTaskStatus`, `createCustomTask`, `snoozeTask` handlers and gate each.)

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(dashboard)/transactions/page.tsx" src/components/transactions/transaction-detail.tsx
git commit -m "feat: hide transaction write controls from agent users"
```

---

## Task 9: End-to-end manual verification

No automated integration test DB exists, so verify the security boundary manually with two accounts.

**Files:** none (verification only)

- [ ] **Step 1: Ensure an agent login exists that matches an agent record by email**

Confirm (via Drizzle Studio `npm run db:studio` or seed data) there is a row in `users` with `role = 'agent'` whose `email` equals (case-insensitively) an `agents.email` that is attached to at least one transaction via `transaction_agents`. If none exists, create/seed one.

- [ ] **Step 2: Verify scoped reads**

Run `npm run dev`, log in as that agent. Expected:
- Sidebar shows only Dashboard + Transactions.
- Transactions list shows ONLY transactions where this agent is on the listing/buyer side.
- Dashboard stats/lists reflect only those transactions.

- [ ] **Step 3: Verify the direct-URL guard**

While logged in as the agent, navigate to `/transactions/<id>` for a transaction they are NOT on (copy an id from an admin session). Expected: the page shows the not-found/empty state (because `getTransactionById` returns `null`), not another office's data.

- [ ] **Step 4: Verify route gating**

While logged in as the agent, manually visit `/settings`, `/agents`, `/templates`, `/users`. Expected: each redirects to `/dashboard`.

- [ ] **Step 5: Verify write rejection (defense in depth)**

Confirm no write buttons appear for the agent. (Optional deeper check: temporarily invoke a mutation server action from the agent session, e.g. via a transaction the agent can see, and confirm it returns `{ success: false, error: 'You do not have permission...' }`.)

- [ ] **Step 6: Verify no regression for privileged users**

Log in as `tc`/`admin`. Expected: full nav, all transactions visible, create/edit/delete all work as before.

- [ ] **Step 7: Final full check**

Run: `npm test && npm run build`
Expected: unit tests pass; production build succeeds.

- [ ] **Step 8: Commit any verification fixes**

If steps surfaced fixes, commit them with a descriptive message. Otherwise this task is complete.

---

## Out of Scope (deferred to Phase 2 — Supabase schema-per-office)

- `organizationId` columns, tenant routing, DB/schema-per-office plumbing.
- Explicit `users.id → agents.userId` foreign key (revisit only if email match proves fragile).
- Limited agent edits (agents remain fully read-only in Phase 1).
