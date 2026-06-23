# Multi-Tenant Plan — Locked Decisions (2026-06-22)

Owner (Darin) resolved the 7 open questions from `2026-06-22-multi-tenant.md` §9.
These are authoritative; where they differ from the main plan's prose, **these win**
(the main plan's §9 still lists some as "open" and should be read with this file).

| # | Question | Decision |
|---|---|---|
| 1 | Tenant resolution | **Session-derived.** `tenantId` is a signed claim in the NextAuth JWT. One `/login`. Subdomains **deferred** to v2 (branding/convenience layer; the JWT claim stays authoritative). |
| 2 | Per-tenant logos | **Build in-app uploads NOW** — but on **Cloudflare R2** (object storage, DB-independent), **not** Supabase Storage, so we don't pull Supabase in before the deferred Phase 9 DB migration. (Supersedes the old "URL-string interim / no file uploads" framing.) |
| 3 | User ↔ tenant | **One tenant per user** for v1. Email stays globally unique. Multi-office memberships table deferred until a real customer needs it. |
| 4 | Platform superadmin | **`isPlatformAdmin` boolean on the user + a thin `/platform` console.** The console must include a per-tenant **active/inactive on-off toggle** (create tenants + flip them on/off from the app — **no DB edits**). No 5th role. |
| 5 | Billing enforcement | **Defer automated enforcement.** Invoice the first offices manually (Stripe/Zoho). **BUT add a billing-status boolean on the `tenants` row now** (default = active) so enforcement is a trivial later switch. Eventual policy when built: grace period → read-only, never delete data. |
| 6 | Cross-office agents | **Separate per-tenant rows.** No shared global agent identity; the same person at two offices = two independent records. |
| 7 | Inactive tenant UX | **Reject at login**, using the word **"inactive"** (less abrasive than "suspended"), e.g. "This account is inactive — contact d20web." Data preserved. The active/inactive state is flipped from the **`/platform` console** (see #4), not via DB edits. Read-only locked state deferred (build later with billing enforcement). |

## Implications for the build (fold into the main plan at implementation)
- **Schema (Phase 1):** `tenants` gets an **`isActive` boolean (default true)** — the on/off
  state toggled from the `/platform` console (#4/#7) and checked at login. A separate
  `billingStatus` column stays **reserved** per #5 so future automated billing can drive
  `isActive` without conflating manual admin off/on with billing state. One `users.tenantId`
  per #3; `isPlatformAdmin` boolean per #4; tenant resolution is JWT-claim based per #1.
- **Platform console (its own phase / part of Phase 7 admin UI):** `/platform` lists tenants,
  creates them, and **toggles `isActive` on/off** — the manual control Darin uses instead of DB edits.
- **Branding phase (Phase 5):** now includes a **Cloudflare R2 logo uploader** per #2 — add R2 bucket + credentials (env) + a Settings "upload logo" control. This reverses the §4.4 "asset storage gap / defer uploads" note.
- **Auth / login:** inactive-tenant check rejects at login with the "inactive" copy per #7.
- **Templates / agents:** per-tenant scoping unchanged; agents stay per-tenant rows per #6.
- **Unchanged:** Phases 0–8 stay on Turso/libSQL; **Phase 9 (Supabase/Postgres) remains deferred & gated on the first paying customer.**

See the full plan: `docs/superpowers/plans/2026-06-22-multi-tenant.md`.
