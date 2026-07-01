# Platform "Act as Office" + Tenant-Query Chokepoint Hardening — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a d20web platform admin select an office and operate the full tenant-admin dashboard for it, by carrying the acting tenant in the signed JWT — and make tenant isolation a structural (test-enforced) guarantee.

**Architecture:** Acting context is two JWT claims (`actingTenantId`, `actingExpiresAt`) set via the NextAuth `update` trigger. `getViewerScope()` resolves an *effective* tenant-admin scope (with `isPlatformAdmin:false` so the no-filter branch can't fire) plus a non-droppable `actingAs` marker. The Edge proxy reads the same JWT. A CI guard test forbids unscoped owned-table queries.

**Tech Stack:** Next.js 15 (App Router), NextAuth v5 (JWT strategy), Drizzle + Turso/libSQL, vitest, TypeScript strict.

**Spec:** `docs/superpowers/specs/2026-06-30-platform-act-as-office-design.md`

**Conventions:**
- Tests are vitest: `npx vitest run <path>` for one file.
- Commit after every green step. Commit messages use the `feat:`/`test:`/`chore:` prefixes shown.
- Owned tables (carry `tenant_id`): `agents`, `transactions`, `transactionAgents`, `taskTemplateGroups`, `taskTemplates`, `transactionTasks`, `activityLog`, `tenantBranding`, plus tenant-scoped `users` access.

---

## Phase A — Foundations: types & schema

### Task 1: Add acting-context fields to auth types + `ViewerScope`

**Files:**
- Modify: `src/types/index.ts` (the `declare module 'next-auth'` / `next-auth/jwt` augmentation)
- Modify: `src/lib/access.ts` (`ViewerScope` type + `computeViewerScope` signature)

> Defining `ViewerScope.actingAs` here (Phase A foundations) means every later task
> that constructs a scope literal compiles. Task 7 only adds the *resolver* logic.

- [ ] **Step 1: Locate the augmentation.** Open `src/types/index.ts` and find the `declare module 'next-auth'` block (augments `Session['user']`) and the `declare module 'next-auth/jwt'` block (augments `JWT`). If a `next-auth/jwt` block does not exist, add one.

- [ ] **Step 2: Add fields.** In the `Session['user']` augmentation add:

```ts
    actingTenantId?: string | null;
    actingExpiresAt?: number | null;
```

In the `JWT` augmentation add the same two fields:

```ts
    actingTenantId?: string | null;
    actingExpiresAt?: number | null;
```

- [ ] **Step 3: Add `actingAs` to `ViewerScope`.** In `src/lib/access.ts`, add to the `ViewerScope` type:

```ts
  // Non-droppable impersonation marker. Set ONLY when a platform admin is acting
  // as a tenant; null otherwise. Reads identity; never grants scope by itself.
  actingAs: { realAdminId: string; tenantId: string; expiresAt: number } | null;
```

- [ ] **Step 4: Thread `actingAs` through `computeViewerScope`.** Update its signature and both returns:

```ts
export function computeViewerScope(input: {
  role: string;
  userId: string | null;
  tenantId: string | null;
  isPlatformAdmin: boolean;
  matchedAgentIds: string[];
  actingAs?: ViewerScope['actingAs'];
}): ViewerScope {
  const base = {
    userId: input.userId,
    role: input.role,
    tenantId: input.tenantId,
    isPlatformAdmin: input.isPlatformAdmin,
    actingAs: input.actingAs ?? null,
  };
  if (input.isPlatformAdmin || canManageAll(input.role)) {
    return { ...base, agentIds: null };
  }
  return { ...base, agentIds: input.matchedAgentIds };
}
```

- [ ] **Step 5: Update the existing `getViewerScope` return** (and any other `computeViewerScope` call) so the typecheck passes — its single `computeViewerScope({...})` call needs `actingAs: null` added (the full acting resolver comes in Task 7).

Run: `npx tsc --noEmit`
Expected: PASS (no errors).

- [ ] **Step 6: Commit.**

```bash
git add src/types/index.ts src/lib/access.ts
git commit -m "feat: add acting-context fields to auth types and ViewerScope"
```

---

### Task 2: Add actor-attribution columns to activityLog + migration

**Files:**
- Modify: `src/db/schema.ts` (the `activityLog` table, ~line 314)
- Create: migration via drizzle-kit

- [ ] **Step 1: Add columns.** In `activityLog` (`src/db/schema.ts`), after the `userId` column add:

```ts
  // Cross-tenant actor attribution. True when a platform admin wrote this row
  // while "acting as" the office. actorLabel is denormalized because the
  // platform admin is not a user of this tenant (the feed can't join to resolve).
  actorIsPlatformAdmin: integer('actor_is_platform_admin', { mode: 'boolean' })
    .default(false)
    .notNull(),
  actorLabel: text('actor_label'),
```

- [ ] **Step 2: Generate the migration.**

Run: `npm run db:generate`
Expected: a new file under `src/db/migrations/` adding `actor_is_platform_admin` and `actor_label` to `activity_log`.

- [ ] **Step 3: Apply the migration.**

Run: `npm run db:migrate`
Expected: applies cleanly against the Turso DB in `.env.local`.

- [ ] **Step 4: Typecheck.**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit.**

```bash
git add src/db/schema.ts src/db/migrations
git commit -m "feat: add actor attribution columns to activity_log"
```

---

## Phase B — Chokepoint hardening

### Task 3: Structural guard test for unscoped owned-table access

**Files:**
- Create: `src/lib/tenant-chokepoint.test.ts`

- [ ] **Step 1: Write the guard test.** This scans server source for raw owned-table queries that lack a tenant predicate in the same statement. It is allowed to fail at first (it documents the current debt), then drives the migration.

```ts
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

// Owned tables that MUST be tenant-scoped in every query.
const OWNED = [
  'agents',
  'transactions',
  'transactionAgents',
  'taskTemplateGroups',
  'taskTemplates',
  'transactionTasks',
  'activityLog',
  'tenantBranding',
];

// Files allowed to query owned tables without the runtime tenant predicate:
// seeds (offline), the scoped-helper module itself, and tests.
const ALLOWLIST = [
  'src/db/seed.ts',
  'src/db/demo-seed.ts',
  'src/lib/tenant-query.ts',
];

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(p) && !/\.test\.tsx?$/.test(p)) out.push(p);
  }
  return out;
}

// A query is considered "scoped" if the same file references the tenant predicate
// helpers. This is a coarse safety net, not a type-level proof.
const SCOPE_MARKERS = ['tenantScopeCondition', 'requireTenantWrite', 'tenantPredicate'];

describe('tenant chokepoint', () => {
  it('no owned-table query without a tenant predicate', () => {
    const offenders: string[] = [];
    for (const file of walk('src')) {
      const rel = file.replace(/\\/g, '/');
      if (ALLOWLIST.some((a) => rel.endsWith(a))) continue;
      const src = readFileSync(file, 'utf8');
      const touchesOwned = OWNED.some((t) =>
        new RegExp(`\\.from\\(\\s*${t}\\b|insert\\(\\s*${t}\\b|update\\(\\s*${t}\\b|delete\\(\\s*${t}\\b`).test(src),
      );
      if (!touchesOwned) continue;
      const scoped = SCOPE_MARKERS.some((m) => src.includes(m));
      if (!scoped) offenders.push(rel);
    }
    expect(offenders, `Unscoped owned-table access in:\n${offenders.join('\n')}`).toEqual([]);
  });
});
```

- [ ] **Step 2: Run it to see the current debt.**

Run: `npx vitest run src/lib/tenant-chokepoint.test.ts`
Expected: FAIL, listing every file that queries an owned table without a scope marker. **Record this list** — it is the Task 5 worklist.

- [ ] **Step 3: Commit (red test is intentional, but keep CI green by skipping until migrated).** Mark the test `it.skip` for now with a TODO referencing Task 5, so the commit is green:

Change `it('no owned-table query...` to `it.skip('no owned-table query...` and add a comment `// Un-skip in Task 5 once all sites are migrated.`

Run: `npx vitest run src/lib/tenant-chokepoint.test.ts`
Expected: PASS (skipped).

```bash
git add src/lib/tenant-chokepoint.test.ts
git commit -m "test: add (skipped) tenant chokepoint guard"
```

---

### Task 4: Scoped read helper `ownedSelect`

**Files:**
- Create: `src/lib/tenant-query.ts`
- Test: `src/lib/tenant-query.test.ts`

- [ ] **Step 1: Write the failing test.**

```ts
import { describe, it, expect } from 'vitest';
import { tenantPredicate } from './tenant-query';
import { transactions } from '@/db/schema';
import type { ViewerScope } from './access';

const base: ViewerScope = {
  userId: 'u1', role: 'admin', tenantId: 't1', isPlatformAdmin: false,
  agentIds: null, actingAs: null,
};

describe('tenantPredicate', () => {
  it('scopes to the viewer tenant', () => {
    const sql = tenantPredicate(base, transactions.tenantId);
    expect(String(sql)).toContain('tenant_id');
  });
  it('fail-closed (1=0) for tenant-less non-platform viewer', () => {
    const sql = tenantPredicate({ ...base, tenantId: null }, transactions.tenantId);
    expect(String(sql)).toContain('1 = 0');
  });
});
```

- [ ] **Step 2: Run to verify it fails.**

Run: `npx vitest run src/lib/tenant-query.test.ts`
Expected: FAIL ("Cannot find module './tenant-query'").

- [ ] **Step 3: Implement the helper.** It re-exports the existing predicate under the chokepoint module so call sites import from one place.

```ts
import type { SQL } from 'drizzle-orm';
import type { AnySQLiteColumn } from 'drizzle-orm/sqlite-core';
import { tenantScopeCondition, type ViewerScope } from './access';

/**
 * The single sanctioned tenant predicate for owned-table reads. Thin wrapper over
 * tenantScopeCondition so every scoped query imports from one chokepoint module.
 */
export function tenantPredicate(
  scope: ViewerScope,
  tenantColumn: AnySQLiteColumn,
): SQL | undefined {
  return tenantScopeCondition(scope, tenantColumn);
}
```

- [ ] **Step 4: Run to verify it passes.**

Run: `npx vitest run src/lib/tenant-query.test.ts`
Expected: PASS. (`ViewerScope.actingAs` already exists from Task 1, so the `base` literal compiles.)

- [ ] **Step 5: Commit.**

```bash
git add src/lib/tenant-query.ts src/lib/tenant-query.test.ts
git commit -m "feat: add tenantPredicate chokepoint helper"
```

---

### Task 5: Migrate all owned-table queries onto the chokepoint, un-skip the guard

**Files:**
- Modify: every file in the Task 3 Step 2 offender list (typically `src/actions/*.ts`, `src/app/**/page.tsx`, `src/lib/tenant-branding.ts`)
- Modify: `src/lib/tenant-chokepoint.test.ts` (un-skip)

**Migration recipe (apply per offender):**

*Reads* — ensure the query AND-composes the predicate from the chokepoint:

```ts
// before
const rows = await db.select().from(transactions).where(eq(transactions.id, id));
// after
import { tenantPredicate } from '@/lib/tenant-query';
import { getViewerScope } from '@/lib/access';
const scope = await getViewerScope();
const rows = await db.select().from(transactions)
  .where(and(tenantPredicate(scope, transactions.tenantId), eq(transactions.id, id)));
```

*Inserts* — stamp tenant from `requireTenantWrite()` (already the pattern in `users.ts`/`transactions.ts`):

```ts
const w = await requireTenantWrite();
if ('success' in w) return w;            // denial object
await db.insert(transactions).values({ ...data, tenantId: w.tenantId });
```

*Updates/deletes* — compose the predicate in the WHERE:

```ts
await db.update(transactions).set(data)
  .where(and(tenantPredicate(scope, transactions.tenantId), eq(transactions.id, id)));
```

- [ ] **Step 1: Migrate one offender, run the guard.** Pick the first file from the offender list, apply the recipe, then:

Run: `npx vitest run src/lib/tenant-chokepoint.test.ts` (temporarily un-skip locally to check)
Expected: that file drops out of the offender list.

- [ ] **Step 2: Repeat for every offender.** After each file, run the full suite to catch regressions:

Run: `npx vitest run`
Expected: PASS (no behavior change — same tenant scoping, now uniform).

- [ ] **Step 3: Un-skip the guard test.** Change `it.skip(` back to `it(` in `src/lib/tenant-chokepoint.test.ts`.

Run: `npx vitest run src/lib/tenant-chokepoint.test.ts`
Expected: PASS (offenders == []).

- [ ] **Step 4: Full build.**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 5: Commit.**

```bash
git add -A
git commit -m "feat: route all owned-table queries through the tenant chokepoint"
```

---

## Phase C — Acting context core

### Task 6: Acting constants (Edge-safe)

**Files:**
- Create: `src/lib/acting.ts`
- Test: `src/lib/acting.test.ts`

- [ ] **Step 1: Write the failing test.**

```ts
import { describe, it, expect } from 'vitest';
import { ACTING_TTL_MS, isActingActive } from './acting';

describe('acting helpers', () => {
  it('TTL is 60 minutes', () => {
    expect(ACTING_TTL_MS).toBe(60 * 60 * 1000);
  });
  it('active only when platform admin + tenant + unexpired', () => {
    const now = 1_000_000;
    expect(isActingActive({ isPlatformAdmin: true, actingTenantId: 't1', actingExpiresAt: now + 1 }, now)).toBe(true);
    expect(isActingActive({ isPlatformAdmin: true, actingTenantId: 't1', actingExpiresAt: now - 1 }, now)).toBe(false);
    expect(isActingActive({ isPlatformAdmin: false, actingTenantId: 't1', actingExpiresAt: now + 1 }, now)).toBe(false);
    expect(isActingActive({ isPlatformAdmin: true, actingTenantId: null, actingExpiresAt: now + 1 }, now)).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify it fails.**

Run: `npx vitest run src/lib/acting.test.ts`
Expected: FAIL ("Cannot find module './acting'").

- [ ] **Step 3: Implement (no imports — Edge-safe so proxy can use it).**

```ts
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
```

- [ ] **Step 4: Run to verify it passes.**

Run: `npx vitest run src/lib/acting.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit.**

```bash
git add src/lib/acting.ts src/lib/acting.test.ts
git commit -m "feat: add acting constants and isActingActive predicate"
```

---

### Task 7: Effective scope in `getViewerScope` + `actingAs`

**Files:**
- Modify: `src/lib/access.ts` (`getViewerScope` only — the type + `computeViewerScope` landed in Task 1)
- Test: `src/lib/access.test.ts`

> Task 1 already added `ViewerScope.actingAs` and the `computeViewerScope` passthrough.
> This task adds only the **resolver** in `getViewerScope`.

- [ ] **Step 1: Add a pure test for the effective-scope mapping** (covers the `computeViewerScope` acting case). Add to `src/lib/access.test.ts`:

```ts
import { computeViewerScope } from './access';

describe('acting effective scope', () => {
  it('acting input => effective tenant admin, no platform flag, actingAs preserved', () => {
    const s = computeViewerScope({
      role: 'admin', userId: 'admin1', tenantId: 't-target', isPlatformAdmin: false,
      matchedAgentIds: [], actingAs: { realAdminId: 'admin1', tenantId: 't-target', expiresAt: 9 },
    });
    expect(s.tenantId).toBe('t-target');
    expect(s.isPlatformAdmin).toBe(false);
    expect(s.agentIds).toBeNull();
    expect(s.actingAs).toEqual({ realAdminId: 'admin1', tenantId: 't-target', expiresAt: 9 });
  });
});
```

Run: `npx vitest run src/lib/access.test.ts`
Expected: PASS (the mapping already exists from Task 1 — this locks it in).

- [ ] **Step 2: Resolve acting in `getViewerScope`.** Replace the body that reads claims with acting-aware resolution:

```ts
import { isActingActive } from '@/lib/acting';
// ...
export const getViewerScope = cache(async (): Promise<ViewerScope> => {
  const session = await auth();
  const u = session?.user as
    | { role?: string; tenantId?: string | null; isPlatformAdmin?: boolean;
        actingTenantId?: string | null; actingExpiresAt?: number | null }
    | undefined;
  const rawRole = u?.role ?? 'agent';
  const userId = session?.user?.id ?? null;
  const rawTenantId = u?.tenantId ?? null;
  const rawIsPlatformAdmin = u?.isPlatformAdmin ?? false;

  // Acting-as: a platform admin with a live acting claim becomes an EFFECTIVE
  // tenant admin for that office. The platform flag is dropped in effective scope
  // so the no-filter branch can never fire; a non-droppable actingAs marker is set.
  if (isActingActive(
    { isPlatformAdmin: rawIsPlatformAdmin, actingTenantId: u?.actingTenantId, actingExpiresAt: u?.actingExpiresAt },
    Date.now(),
  )) {
    const tenantId = u!.actingTenantId as string;
    return computeViewerScope({
      role: 'admin', userId, tenantId, isPlatformAdmin: false, matchedAgentIds: [],
      actingAs: { realAdminId: userId as string, tenantId, expiresAt: u!.actingExpiresAt as number },
    });
  }

  const email = normalizeEmail(session?.user?.email);
  let matchedAgentIds: string[] = [];
  if (isReadOnlyRole(rawRole) && email && rawTenantId) {
    const rows = await db
      .select({ id: agents.id })
      .from(agents)
      .where(and(eq(agents.tenantId, rawTenantId), sql`lower(${agents.email}) = ${email}`));
    matchedAgentIds = rows.map((r) => r.id);
  }
  return computeViewerScope({
    role: rawRole, userId, tenantId: rawTenantId, isPlatformAdmin: rawIsPlatformAdmin,
    matchedAgentIds, actingAs: null,
  });
});
```

- [ ] **Step 3: Typecheck** (any remaining scope literals must include `actingAs`, but Task 1 covered them).

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 4: Run tests.**

Run: `npx vitest run src/lib/access.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit.**

```bash
git add src/lib/access.ts src/lib/access.test.ts
git commit -m "feat: resolve acting-as effective scope in getViewerScope"
```

---

### Task 8: `requireRawPlatformAdmin` guard

**Files:**
- Modify: `src/lib/access.ts`
- Test: `src/lib/access.test.ts`

- [ ] **Step 1: Write the failing test.**

```ts
import { rawPlatformAdminFromSession } from './access';

describe('rawPlatformAdminFromSession', () => {
  it('true only when the raw JWT flag is set', () => {
    expect(rawPlatformAdminFromSession({ user: { isPlatformAdmin: true } })).toBe(true);
    expect(rawPlatformAdminFromSession({ user: { isPlatformAdmin: false } })).toBe(false);
    expect(rawPlatformAdminFromSession(null)).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify it fails.**

Run: `npx vitest run src/lib/access.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement** (pure extractor + an async guard that reads `auth()`):

```ts
export function rawPlatformAdminFromSession(
  session: { user?: { isPlatformAdmin?: boolean } } | null,
): boolean {
  return session?.user?.isPlatformAdmin === true;
}

/** Reads the RAW platform flag (true even while acting). Gates enter/exit. */
export async function requireRawPlatformAdmin(): Promise<boolean> {
  const session = await auth();
  return rawPlatformAdminFromSession(session);
}
```

- [ ] **Step 4: Run to verify it passes.**

Run: `npx vitest run src/lib/access.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit.**

```bash
git add src/lib/access.ts src/lib/access.test.ts
git commit -m "feat: add requireRawPlatformAdmin guard"
```

---

### Task 9: JWT update plumbing (set/clear acting claims)

**Files:**
- Modify: `src/lib/auth.config.ts` (jwt + session callbacks)
- Modify: `src/lib/auth.ts` (export the update function)

- [ ] **Step 1: Handle the `update` trigger in the jwt callback.** Replace the `jwt` callback in `src/lib/auth.config.ts`:

```ts
    jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = (user as { id?: string }).id;
        token.role = (user as { role?: string }).role;
        token.tenantId = (user as { tenantId?: string | null }).tenantId ?? null;
        token.isPlatformAdmin = (user as { isPlatformAdmin?: boolean }).isPlatformAdmin ?? false;
      }
      // Acting-as is mutated via unstable_update({ actingTenantId, actingExpiresAt }).
      if (trigger === 'update' && session) {
        const s = session as { actingTenantId?: string | null; actingExpiresAt?: number | null };
        token.actingTenantId = s.actingTenantId ?? null;
        token.actingExpiresAt = s.actingExpiresAt ?? null;
      }
      return token;
    },
```

- [ ] **Step 2: Expose acting claims on the session.** In the `session` callback, after the existing assignments add:

```ts
        (u as { actingTenantId?: string | null }).actingTenantId =
          (token.actingTenantId as string | null) ?? null;
        (u as { actingExpiresAt?: number | null }).actingExpiresAt =
          (token.actingExpiresAt as number | null) ?? null;
```

- [ ] **Step 3: Export the update function.** In `src/lib/auth.ts`, add `unstable_update` to the destructure and re-export it under a clear name:

```ts
export const { handlers, auth, signIn, signOut, unstable_update } = NextAuth({ /* ...unchanged... */ });
export { unstable_update as updateAuthSession };
```

- [ ] **Step 4: Typecheck.**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit.**

```bash
git add src/lib/auth.config.ts src/lib/auth.ts
git commit -m "feat: plumb acting claims through the JWT update trigger"
```

---

## Phase D — Edge proxy

### Task 10: Proxy honors the acting claim

**Files:**
- Modify: `src/proxy.ts`
- Test: `src/lib/proxy-routing.test.ts` (pure decision function extracted for testability)

- [ ] **Step 1: Extract a pure routing decision and test it.** Create `src/lib/proxy-routing.ts`:

```ts
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
```

Create `src/lib/proxy-routing.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { isActingNow } from './proxy-routing';

const baseI = { pathname: '/dashboard', isPlatformAdmin: true, tenantId: null,
  actingTenantId: 't1', actingExpiresAt: 2, now: 1 };

describe('proxy acting decision', () => {
  it('acting platform admin is tenant-scoped', () => {
    expect(isActingNow(baseI)).toBe(true);
  });
  it('non-acting platform admin is not', () => {
    expect(isActingNow({ ...baseI, actingTenantId: null })).toBe(false);
  });
  it('expired acting is not active', () => {
    expect(isActingNow({ ...baseI, actingExpiresAt: 0 })).toBe(false);
  });
});
```

Run: `npx vitest run src/lib/proxy-routing.test.ts`
Expected: PASS.

- [ ] **Step 2: Use it in `proxy.ts`.** Read the acting claims and compute `acting`, then gate the platform-admin redirect on NOT acting. In `src/proxy.ts`, extend the user destructure and add the decision:

```ts
import { isActingNow } from '@/lib/proxy-routing';
// ...
  const user = req.auth?.user as
    | { role?: string; tenantId?: string | null; isPlatformAdmin?: boolean;
        actingTenantId?: string | null; actingExpiresAt?: number | null }
    | undefined;
  const role = user?.role ?? 'agent';
  const tenantId = user?.tenantId ?? null;
  const isPlatformAdmin = user?.isPlatformAdmin ?? false;
  const acting = isActingNow({
    pathname: nextUrl.pathname, isPlatformAdmin, tenantId,
    actingTenantId: user?.actingTenantId ?? null,
    actingExpiresAt: user?.actingExpiresAt ?? null,
    now: Date.now(),
  });
```

- [ ] **Step 3: Gate the `/dashboard` bounce on `!acting`.** Change the platform-admin dashboard redirect (currently line ~75):

```ts
  // A non-acting platform admin has no tenant; keep them on /platform. When
  // ACTING, they ARE tenant-scoped, so let them into the dashboard.
  if (isPlatformAdmin && !acting && nextUrl.pathname.startsWith('/dashboard')) {
    return NextResponse.redirect(new URL('/platform', nextUrl.origin));
  }
```

`/platform/*` stays reachable for the acting admin (the `isPlatformPath` block already allows `isPlatformAdmin`), so Exit works.

- [ ] **Step 4: Build (proxy is Edge — verify it compiles in the Edge bundle).**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 5: Commit.**

```bash
git add src/proxy.ts src/lib/proxy-routing.ts src/lib/proxy-routing.test.ts
git commit -m "feat: proxy lets acting platform admins into the dashboard"
```

---

## Phase E — Audit attribution

### Task 11: `logActivity` helper with acting attribution

**Files:**
- Create: `src/lib/activity.ts`
- Test: `src/lib/activity.test.ts`

- [ ] **Step 1: Write the failing test** (pure attribution builder):

```ts
import { describe, it, expect } from 'vitest';
import { buildActorAttribution } from './activity';
import { ACTOR_LABEL_PLATFORM } from './acting';

describe('buildActorAttribution', () => {
  it('marks platform-admin acting writes', () => {
    const a = buildActorAttribution({
      userId: 'admin1', role: 'admin', tenantId: 't1', isPlatformAdmin: false,
      agentIds: null, actingAs: { realAdminId: 'admin1', tenantId: 't1', expiresAt: 9 },
    });
    expect(a).toEqual({ userId: 'admin1', actorIsPlatformAdmin: true, actorLabel: ACTOR_LABEL_PLATFORM });
  });
  it('normal writes are unmarked', () => {
    const a = buildActorAttribution({
      userId: 'u2', role: 'admin', tenantId: 't1', isPlatformAdmin: false,
      agentIds: null, actingAs: null,
    });
    expect(a).toEqual({ userId: 'u2', actorIsPlatformAdmin: false, actorLabel: null });
  });
});
```

- [ ] **Step 2: Run to verify it fails.**

Run: `npx vitest run src/lib/activity.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement.**

```ts
import { db } from '@/db/client';
import { activityLog } from '@/db/schema';
import { getViewerScope, type ViewerScope } from '@/lib/access';
import { ACTOR_LABEL_PLATFORM } from '@/lib/acting';

export function buildActorAttribution(scope: ViewerScope): {
  userId: string | null; actorIsPlatformAdmin: boolean; actorLabel: string | null;
} {
  const acting = scope.actingAs !== null;
  return {
    userId: scope.userId,
    actorIsPlatformAdmin: acting,
    actorLabel: acting ? ACTOR_LABEL_PLATFORM : null,
  };
}

/** Writes one tenant-scoped activity row, attributed from the current scope. */
export async function logActivity(input: {
  tenantId: string;
  action: string;
  transactionId?: string | null;
  details?: string | null;
}): Promise<void> {
  const scope = await getViewerScope();
  const actor = buildActorAttribution(scope);
  await db.insert(activityLog).values({
    id: crypto.randomUUID(),
    tenantId: input.tenantId,
    transactionId: input.transactionId ?? null,
    userId: actor.userId,
    action: input.action,
    details: input.details ?? null,
    actorIsPlatformAdmin: actor.actorIsPlatformAdmin,
    actorLabel: actor.actorLabel,
  });
}
```

- [ ] **Step 4: Run to verify it passes.**

Run: `npx vitest run src/lib/activity.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit.**

```bash
git add src/lib/activity.ts src/lib/activity.test.ts
git commit -m "feat: add logActivity helper with acting attribution"
```

---

### Task 12: Route existing activity writes through `logActivity`

**Files:**
- Modify: `src/actions/transactions.ts` (the three `db.insert(activityLog).values({...})` sites, ~lines 550/662/699)

- [ ] **Step 1: Replace each inline insert** with a `logActivity(...)` call, preserving the existing `action`, `tenantId`, `transactionId`, and `details`. Example for the create-transaction site:

```ts
// before
await db.insert(activityLog).values({ id: crypto.randomUUID(), tenantId, transactionId: tx.id, userId, action: 'created', details });
// after
import { logActivity } from '@/lib/activity';
await logActivity({ tenantId, transactionId: tx.id, action: 'created', details });
```

- [ ] **Step 2: Run the suite.**

Run: `npx vitest run`
Expected: PASS.

- [ ] **Step 3: Build.**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 4: Commit.**

```bash
git add src/actions/transactions.ts
git commit -m "refactor: write activity through logActivity"
```

---

### Task 12b: Surface acting attribution in the activity feed

**Files:**
- Modify: `src/actions/transactions.ts` (the activity-feed `select` ~line 375 and its row mapping)
- Modify: the component that renders that feed's `userName` (the transaction-detail activity list — locate via the field name `userName` in `src/app/(dashboard)/transactions/**` or `src/components/transactions/**`)

- [ ] **Step 1: Select the attribution columns.** In the activity-feed `select` add the two new columns and keep `userName`:

```ts
      .select({
        id: activityLog.id,
        action: activityLog.action,
        details: activityLog.details,
        createdAt: activityLog.createdAt,
        userName: sql<string | null>`(select name from users where users.id = ${activityLog.userId})`,
        actorIsPlatformAdmin: activityLog.actorIsPlatformAdmin,
        actorLabel: activityLog.actorLabel,
      })
```

- [ ] **Step 2: Compute the display name.** Where these rows are mapped before being returned/rendered, derive a single `actorName` so acting writes read as the support label rather than the platform admin's real name:

```ts
const activity = activityRows.map((r) => ({
  ...r,
  actorName: r.actorIsPlatformAdmin ? (r.actorLabel ?? 'd20web (support)') : r.userName,
}));
```

- [ ] **Step 3: Render `actorName`.** In the feed component, replace the rendered `userName` with `actorName`. Update the row type to include `actorName: string | null`.

- [ ] **Step 4: Typecheck + build.**

Run: `npx tsc --noEmit && npm run build`
Expected: PASS.

- [ ] **Step 5: Commit.**

```bash
git add src/actions/transactions.ts "src/app/(dashboard)/transactions"
git commit -m "feat: show 'd20web (support)' for acting writes in the activity feed"
```

---

## Phase F — Enter/exit actions + platform UI

### Task 13: `enterTenant` / `exitTenant` server actions

**Files:**
- Create: `src/actions/acting.ts`

- [ ] **Step 1: Implement the actions.** (These mutate the JWT; logic is integration-tested via the UI + manual run. No unit test for the redirect itself.)

```ts
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

  await updateAuthSession({ actingTenantId: tenantId, actingExpiresAt: Date.now() + ACTING_TTL_MS });
  // Visible-to-tenant access record. getViewerScope now resolves the acting scope,
  // so logActivity attributes this to the platform admin "acting as office".
  await logActivity({ tenantId, action: 'platform_entered', details: null });
  redirect('/dashboard');
}

export async function exitTenant(): Promise<void> {
  await updateAuthSession({ actingTenantId: null, actingExpiresAt: null });
  redirect('/platform');
}
```

- [ ] **Step 2: Typecheck + build.**

Run: `npx tsc --noEmit && npm run build`
Expected: PASS.

- [ ] **Step 3: Commit.**

```bash
git add src/actions/acting.ts
git commit -m "feat: enterTenant/exitTenant acting actions"
```

---

### Task 14: "Enter office" button on the platform console

**Files:**
- Modify: `src/app/platform/_components/platform-console.tsx`

- [ ] **Step 1: Add an Enter action per office row.** Import `enterTenant` and add a button before the Activate/Deactivate button:

```tsx
import { enterTenant } from '@/actions/acting';
// ...inside the row, left of the activate button:
<button
  type="button"
  className="ptc-btn ptc-btn-sm ptc-btn-outline"
  disabled={pending}
  onClick={() => startTransition(async () => {
    const res = await enterTenant(t.id);
    if (res && !res.success) toast.error(res.error);
    // success path redirects server-side; no client nav needed.
  })}
>
  <LogIn className="size-4" /> Enter
</button>
```

Add `LogIn` to the existing `lucide-react` import.

- [ ] **Step 2: Build.**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 3: Manual verify.** With the dev server running, sign in as `info@d20web.com` / `Conor222`, go to `/platform`, click **Enter** on Crestline Realty.
Expected: redirected to `/dashboard`, scoped to Crestline (its branding shows), no redirect back to `/platform`.

- [ ] **Step 4: Commit.**

```bash
git add src/app/platform/_components/platform-console.tsx
git commit -m "feat: Enter office button on platform console"
```

---

## Phase G — Acting banner + destructive confirms

### Task 15: Acting banner in the dashboard shell

**Files:**
- Create: `src/components/layout/acting-banner.tsx`
- Modify: `src/app/(dashboard)/layout.tsx`

- [ ] **Step 1: Create the banner (client; calls exitTenant).**

```tsx
'use client';
import { useTransition } from 'react';
import { exitTenant } from '@/actions/acting';

export function ActingBanner({ officeName }: { officeName: string }) {
  const [pending, start] = useTransition();
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
      padding: '8px 16px', background: '#0A2620', color: '#F6F3EA', fontSize: 13.5,
    }}>
      <span>
        Acting as <strong style={{ color: '#3FE0A0' }}>{officeName}</strong> — you are operating this office as d20web.
      </span>
      <button type="button" disabled={pending} onClick={() => start(() => exitTenant())}
        style={{ background: '#3FE0A0', color: '#08231B', border: 'none', borderRadius: 8,
          padding: '6px 12px', fontWeight: 600, cursor: 'pointer' }}>
        Exit to platform
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Render it from the dashboard layout when acting.** Make `src/app/(dashboard)/layout.tsx` async and resolve the acting state + office name:

```tsx
import { getViewerScope } from '@/lib/access';
import { getCurrentBrand } from '@/lib/tenant-branding';
import { ActingBanner } from '@/components/layout/acting-banner';
// ...
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const scope = await getViewerScope();
  const acting = scope.actingAs !== null;
  const brand = acting ? await getCurrentBrand() : null;
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        {acting && brand && <ActingBanner officeName={brand.name} />}
        <TopBar />
        {/* existing children wrapper */}
        {children}
      </SidebarInset>
    </SidebarProvider>
  );
}
```

(Preserve the existing children wrapper markup; only add the banner line.)

- [ ] **Step 3: Build + manual verify.**

Run: `npm run build`
Then, while acting (from Task 14), confirm the banner shows the office name and **Exit to platform** returns to `/platform` and clears acting (dashboard then bounces to `/platform`).

- [ ] **Step 4: Commit.**

```bash
git add src/components/layout/acting-banner.tsx "src/app/(dashboard)/layout.tsx"
git commit -m "feat: acting banner with exit in dashboard shell"
```

---

### Task 16: Louder confirm on destructive writes while acting

**Files:**
- Modify: `src/app/(dashboard)/settings/_components/users-tab.tsx` (delete-user confirm)

- [ ] **Step 1: Surface the acting office to the client.** In `src/app/(dashboard)/users/page.tsx`, pass acting context to `UsersTab`:

```tsx
import { getViewerScope } from '@/lib/access';
import { getCurrentBrand } from '@/lib/tenant-branding';
// ...
const scope = await getViewerScope();
const actingOffice = scope.actingAs ? (await getCurrentBrand()).name : null;
return ( /* ... */ <UsersTab initialUsers={allUsers} currentUserId={session.user.id ?? ''} actingOffice={actingOffice} /> );
```

- [ ] **Step 2: Use it in the delete confirm.** In `users-tab.tsx`, accept `actingOffice?: string | null` and prefix the delete confirmation copy when set:

```tsx
const confirmMsg = actingOffice
  ? `You are acting as ${actingOffice}. This permanently deletes this user in THEIR office. Continue?`
  : 'Delete this user? This cannot be undone.';
```

Use `confirmMsg` in the existing delete confirmation dialog/text.

- [ ] **Step 3: Typecheck + build.**

Run: `npx tsc --noEmit && npm run build`
Expected: PASS.

- [ ] **Step 4: Commit.**

```bash
git add "src/app/(dashboard)/users/page.tsx" "src/app/(dashboard)/settings/_components/users-tab.tsx"
git commit -m "feat: louder destructive confirm while acting as an office"
```

---

## Phase H — Isolation & lifecycle tests

### Task 17: Acting isolation + lifecycle tests

**Files:**
- Modify: `src/lib/tenant-isolation.test.ts`

- [ ] **Step 1: Add tests** asserting the security invariants. Follow the existing file's harness (it already seeds 2 tenants and exercises `tenantScopeCondition`/`getViewerScope`-shaped scopes). Add:

```ts
import { tenantScopeCondition, type ViewerScope } from './access';
import { isActingActive } from './acting';
import { transactions } from '@/db/schema';

describe('acting-as isolation', () => {
  it('effective acting scope scopes to the target tenant only (no no-filter branch)', () => {
    const acting: ViewerScope = {
      userId: 'admin1', role: 'admin', tenantId: 'tenantA', isPlatformAdmin: false,
      agentIds: null, actingAs: { realAdminId: 'admin1', tenantId: 'tenantA', expiresAt: 9 },
    };
    const cond = tenantScopeCondition(acting, transactions.tenantId);
    // Not undefined (no-filter) and not 1=0 — a real eq() predicate on tenant_id.
    expect(cond).toBeDefined();
    expect(String(cond)).toContain('tenant_id');
  });

  it('expired acting claim is inert', () => {
    expect(isActingActive(
      { isPlatformAdmin: true, actingTenantId: 'tenantA', actingExpiresAt: 1 }, 2,
    )).toBe(false);
  });

  it('acting claim on a NON-platform session is inert (forged cookie/claim)', () => {
    expect(isActingActive(
      { isPlatformAdmin: false, actingTenantId: 'tenantA', actingExpiresAt: 9 }, 1,
    )).toBe(false);
  });
});
```

- [ ] **Step 2: Run the full suite.**

Run: `npx vitest run`
Expected: PASS.

- [ ] **Step 3: Commit.**

```bash
git add src/lib/tenant-isolation.test.ts
git commit -m "test: acting-as isolation and lifecycle invariants"
```

---

### Task 18: Acting scope == native scope (predicate equivalence)

**Files:**
- Create: `src/lib/acting-equivalence.test.ts`

The cross-tenant *cache* leak the council warned about requires a tenant-blind
Data Cache; there is none today (verified — no `unstable_cache`/`use cache`, all
dashboard routes are dynamic). So the meaningful guarantee to lock in is: an
**acting** effective scope for tenant X produces the **identical** tenant
predicate as a **native** tenant-admin scope for tenant X — i.e. acting never
widens or narrows scope vs. a real admin. This is a pure test (no DB).

- [ ] **Step 1: Write the test.**

```ts
import { describe, it, expect } from 'vitest';
import { tenantScopeCondition, type ViewerScope } from './access';
import { transactions } from '@/db/schema';

const native: ViewerScope = {
  userId: 'u-native', role: 'admin', tenantId: 'tenantA', isPlatformAdmin: false,
  agentIds: null, actingAs: null,
};
const acting: ViewerScope = {
  userId: 'admin1', role: 'admin', tenantId: 'tenantA', isPlatformAdmin: false,
  agentIds: null, actingAs: { realAdminId: 'admin1', tenantId: 'tenantA', expiresAt: 9 },
};

describe('acting scope equivalence', () => {
  it('acting tenant predicate equals the native tenant-admin predicate', () => {
    const a = String(tenantScopeCondition(acting, transactions.tenantId));
    const n = String(tenantScopeCondition(native, transactions.tenantId));
    expect(a).toBe(n);
    expect(a).toContain('tenant_id'); // a real eq() predicate, not the no-filter branch
  });

  it('a DIFFERENT acting tenant yields a different predicate (no cross-tenant widening)', () => {
    const actingB: ViewerScope = { ...acting, tenantId: 'tenantB',
      actingAs: { realAdminId: 'admin1', tenantId: 'tenantB', expiresAt: 9 } };
    const a = String(tenantScopeCondition(acting, transactions.tenantId));
    const b = String(tenantScopeCondition(actingB, transactions.tenantId));
    expect(a).not.toBe(b);
  });
});
```

- [ ] **Step 2: Run.**

Run: `npx vitest run src/lib/acting-equivalence.test.ts`
Expected: PASS.

- [ ] **Step 3: Full suite + build.**

Run: `npx vitest run && npm run build`
Expected: PASS.

- [ ] **Step 4: Commit.**

```bash
git add src/lib/acting-equivalence.test.ts
git commit -m "test: acting effective scope matches native tenant scoping"
```

---

## Final verification

- [ ] **Run the whole suite + build + typecheck.**

Run: `npx vitest run && npm run build && npx tsc --noEmit`
Expected: all PASS; the chokepoint guard (Task 5) is green and un-skipped.

- [ ] **Manual end-to-end (dev server):**
  1. Sign in as `info@d20web.com` / `Conor222` → lands on `/platform`.
  2. Click **Enter** on an office → `/dashboard` scoped to it, banner shows the office name, the office's branding is applied.
  3. Create/edit a user, edit a transaction → succeeds; the office's activity feed shows the change attributed to "d20web (support)".
  4. Confirm `/platform` CRUD is unavailable while acting (must Exit first).
  5. Click **Exit to platform** → back on `/platform`, acting cleared.
  6. Re-enter, wait past 60 min (or temporarily lower `ACTING_TTL_MS`) → next nav drops acting and bounces to `/platform`.

---

## Spec coverage check

- Chokepoint hardening (helper + guard + migration) → Tasks 3–5.
- Acting context in JWT (claims, enter/exit, TTL) → Tasks 6, 9, 13.
- `getViewerScope` effective scope + non-droppable `actingAs` → Task 7.
- `requireRawPlatformAdmin` vs effective `requirePlatformAdmin` → Task 8 (+ existing).
- Edge proxy honors acting → Task 10.
- Audit columns + tenant-visible attribution + entered-office event → Tasks 2, 11, 12, 12b, 13.
- Cache safety rule + render test → Task 18.
- UX: Enter, branding takeover, banner, Exit, destructive confirm → Tasks 14–16.
- Security guardrails (no-filter branch closed, TTL, platform actions disabled while acting, forged claim inert) → Tasks 7, 10, 17.
- Out of scope (per-read audit, exit-restores-position, real-time notify, MSA clause) → not implemented, by design.
