# TC Dashboard — Multi-Tenant Implementation Summary

**Branch:** `multi-tenant` (off `main`) in the `tc-dash-demo` line.
**Scope delivered:** Phases 0–8 (Turso/libSQL). **Phase 9 (Supabase/Postgres) intentionally NOT done — deferred.**
**Status:** All phases complete. `npx vitest run` → 37 passing (3 files). `npm run build` → succeeds. `npx drizzle-kit generate` → "No schema changes" (migration in sync). Migration + both seeds + backfill verified against a real SQLite file. LOCAL ONLY — nothing pushed.

Implements the locked decisions in `docs/superpowers/plans/2026-06-22-multi-tenant-decisions.md`: session-derived tenancy (JWT claim), R2 logo uploads, one tenant per user, `isPlatformAdmin` + `/platform` console, `isActive` + reserved `billingStatus`, per-tenant agent rows, inactive-at-login rejection.

---

## How to apply

### Option A — git bundle (recommended; full history)
```bash
git clone tc-dash-multitenant.bundle tc-dash-mt
cd tc-dash-mt && git checkout multi-tenant
# or into an existing clone:  git pull /path/to/tc-dash-multitenant.bundle multi-tenant
```
Bundle contains both `main` and `multi-tenant`.

### Option B — git am (the 8 per-phase patches)
```bash
cd your-clone        # on main
git checkout -b multi-tenant
git am /path/to/mt-patches/*.patch
```

### Then install, migrate, seed
```bash
npm install                  # pulls @aws-sdk/client-s3 (new dep for R2)
npm run db:migrate           # applies src/db/migrations/0000_multi_tenant_baseline.sql (needs Turso creds)
npm run db:demo-seed         # Crestline Realty demo data, all tenant-stamped
# OR lift an EXISTING single-tenant DB onto the platform without reseeding:
npm run db:backfill-tenant   # creates the demo tenant + stamps tenant_id on existing rows (idempotent)
npm run dev
```
> `drizzle-kit migrate` requires a real `TURSO_AUTH_TOKEN` even for a file URL (the `turso` dialect enforces it). For local file testing without Turso, apply `src/db/migrations/*.sql` directly. Production uses real Turso creds.

---

## Required environment variables

Existing (unchanged): `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, `NEXTAUTH_URL`, `NEXTAUTH_SECRET`.

New — **Cloudflare R2** for per-tenant logo uploads (all OPTIONAL; in `.env.example` + `DEMO-SETUP.md`):
```
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET=
R2_PUBLIC_BASE_URL=     # public base URL the bucket is served from
```
**Graceful degradation:** if any R2 var is missing, `isR2Configured()` is false → the upload control is hidden/disabled and a logo URL can be set manually. The app builds and runs with no R2 configured.

R2 setup: create a bucket + API token (Account ID + Access Key + Secret), make the bucket public (or front it with a custom domain / the R2 dev URL), set the vars. Stored logo URLs = `R2_PUBLIC_BASE_URL + '/' + objectKey`. R2 is S3-compatible — driven via `@aws-sdk/client-s3`.

---

## Per-phase commits

| Phase | Commit | What |
|---|---|---|
| 0 | `71ff41e` | Vitest tenant describe scaffold; add `@aws-sdk/client-s3`. |
| 1 | `bd9d3df` | Schema: `tenants` + `tenant_branding`; `tenant_id` FK + index on every owned table; `users.tenantId` + `users.isPlatformAdmin`. Drizzle migration. Backfill script + per-tenant template seeder. Seeds stamp tenant. `.env`/`DEMO-SETUP` R2 docs. |
| 2 | `134a1c9` | JWT/session carry `tenantId` + `isPlatformAdmin`; inactive-tenant rejection at login; extend `ViewerScope` + `getViewerScope` (tenant-scoped agent match); add `tenantScopeCondition` + `requireTenantWrite`; proxy gates `/platform` and requires a tenant. Vitest for tenant scope. |
| 3 & 4 | `d4eda55` | Scope every read (AND tenant predicate) and guard every write (stamp `tenant_id` from session, scope `WHERE` by tenant) across all `src/actions/*`. Cross-entity links verified same-tenant. |
| 5 | `2a7f16a` | Runtime per-tenant branding from `tenant_branding` (server-rendered CSS, no flash); R2 logo uploader; Settings branding tab. `activeBrand` retired as live source. |
| 6 | `167e113` | Per-tenant templates/seeding; `createTransaction` stamps from the tenant's templates; `platform.ts` createTenant seeds branding + CA pack + first admin; repair scripts tenant-aware. |
| 7 | `6442fb9` | `/platform` console (list tenants, create office, active/inactive toggle), server-gated to platform admins. Tenant-scoped settings. |
| 8 | `67a9419` | Cross-tenant isolation integration tests (in-memory libSQL + real migration + 2 tenants); `isTenantLoginAllowed()` pure helper + unit tests. |

---

## Schema changes (`src/db/schema.ts`)

**New tables**
- `tenants` — `id` (text PK), `name`, `slug` (unique), `isActive` (int 0/1 boolean, default true), `billingStatus` (text, default `'manual'` — RESERVED, unused by logic), `createdAt`, `updatedAt`.
- `tenant_branding` — `tenantId` (text PK, FK→tenants, ON DELETE cascade), `name`, `tagline`, `logoUrl`, `logoDarkUrl`, `logoIconUrl`, `colors` (JSON text), `darkColors` (JSON text, nullable), `borderRadius`, `fontFamily`, `updatedAt`. JSON blobs parse-clean (target Postgres `jsonb`).

**`tenant_id` NOT NULL FK→tenants + index on:** `agents`, `transactions`, `transaction_agents` (denormalized), `task_template_groups`, `task_templates`, `transaction_tasks` (denormalized), `activity_log`.
**`tenant_id` NULLABLE FK on:** `access_requests` (public request may arrive tenant-less; platform admin assigns on approval).
**`users`:** `tenantId` (text, FK→tenants, NULL only for platform admins) + `isPlatformAdmin` (int 0/1 boolean, default false).
**NextAuth tables (`accounts`, `sessions`, `verification_tokens`):** unchanged — intentionally NOT tenant-scoped (Auth.js adapter contract).

**Portability (§7.5 honored):** all DDL in the Drizzle migration; text UUID PKs; ISO date strings; integer cents; booleans as integer 0/1 via `{ mode: 'boolean' }`; JSON as text blobs; every `tenant_id` FK + index declared in `schema.ts`; no raw libsql SQL in app code (only Drizzle's portable `sql` helper for `1=0`). Turso→Postgres stays a Drizzle dialect/driver swap.

---

## How `access.ts` was extended (the heart of isolation)

- `ViewerScope` gained `tenantId: string | null` (OUTER ring) and `isPlatformAdmin: boolean`; `agentIds` (INNER ring) unchanged.
- `computeViewerScope()` carries the tenant claims; platform admins (and privileged tenant roles) are unrestricted on the **agent** ring; tenant isolation is enforced separately by the outer ring.
- `getViewerScope()` reads `tenantId` + `isPlatformAdmin` straight off the JWT (no extra DB round-trip). The email→agent match is now **tenant-scoped** (`eq(agents.tenantId, tenantId)` AND email), closing the same-email-across-offices hole.
- **New `tenantScopeCondition(scope, column)`** — outer-ring predicate: `undefined` (no filter) for a platform admin with no tenant; `sql`1 = 0`` fail-closed when no tenant and not a platform admin; `eq(column, scope.tenantId)` otherwise. ANDed into every read.
- **New `requireTenantWrite()`** — returns `{ tenantId }` (from the session) or a denial. Every insert stamps it; the value is **never** read from client input.
- `requireWriteAccess()` also fails closed when there is no tenant.
- Composition: tenant ring `and()` agent ring on every read; writes stamp tenant on insert and scope `WHERE` by `eq(table.tenantId, scope.tenantId)` so a forged cross-tenant id hits 0 rows.

`roles.ts` stays Edge-safe/role-only; added pure `isPlatformPath()` (proxy gate) and `isTenantLoginAllowed()` (login gate, unit-tested).

---

## R2 wiring (decision #2)

- `src/lib/r2.ts` — S3-compatible client at `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`; `isR2Configured()`; `uploadLogoToR2(key, body, contentType)`.
- `src/actions/branding.ts` — `getTenantBranding`, `getBrandingEnv` (drives the UI), `updateTenantBranding`, `uploadTenantLogo` (validates type PNG/JPEG/SVG/WEBP + size ≤ 1 MB, stamps tenant, stores the returned URL).
- Settings → Branding tab: edit name/tagline/colors/radius/logo URL + an Upload control hidden/disabled when R2 is absent, with live preview.

---

## Verification results

- `npx vitest run` → **37 passed** (was 17): `access.test.ts` (18), `roles.test.ts` (11), `tenant-isolation.test.ts` (8 integration).
- `npm run build` → **succeeds**, no new warnings (all routes dynamic since brand resolves per session).
- `npx drizzle-kit generate` → **"No schema changes"** (schema ↔ migration in sync).
- `npx tsc --noEmit` → **clean**.
- Migration applied to a real SQLite file; `db:demo-seed` (Crestline, 12 tx / 346 tasks) and `db:seed` (9 tx, platform admin `info@d20web.com`) both run; **0 NULL tenant_id** across all owned tables; `db:backfill-tenant` stamps existing rows and is idempotent.

---

## Needs the owner's decision / follow-ups

1. **Production migrate** — `db:migrate` needs a real `TURSO_AUTH_TOKEN`. Use `db:demo-seed` (fresh demo) OR `db:backfill-tenant` (lift existing DB) — mutually exclusive per DB.
2. **R2 credentials** — not provisioned here; without them logo upload is disabled (manual URL still works).
3. **Migration baseline** — the repo had no `src/db/migrations/` before (used `db:push`). This delivery establishes `0000_multi_tenant_baseline.sql` as the canonical baseline (full schema incl. tenant tables). If a live demo DB predates this, reconcile the Drizzle journal (mark baseline applied) — flag it.
4. **Subdomains (v2)** — deferred by design; tenancy is JWT-claim based and slots subdomains in later without changing isolation.
5. **Billing enforcement** — `billingStatus` is reserved/inert; only the manual `isActive` toggle (login gate) is wired.

---

## Deliverable files (in `outputs/`)

- `tc-dash-multitenant.bundle` — git bundle (`main` + `multi-tenant`, full history).
- `mt-patches/0001…0008-*.patch` — the 8 per-phase `git format-patch` files.
- `mt-commit-list.txt` — full commit hashes + messages.
- `MULTI-TENANT-IMPLEMENTATION.md` — this summary.
