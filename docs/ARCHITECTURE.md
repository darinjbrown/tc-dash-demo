# TC Dashboard — Architecture Reference

Transaction Coordinator dashboard for California real estate brokerages. Built as a white-label MVP: a single config object rebrands the entire app — colors, logo, typography, border radius — without a redeploy. The task checklist system is the core workflow engine; all other features support it.

---

## Tech Stack

| Layer | Package | Version |
|---|---|---|
| Framework | Next.js (App Router) | 16.1.6 |
| Language | TypeScript (strict) | ^5 |
| UI Components | shadcn/ui (New York style) | 3.8.5 |
| Styling | Tailwind CSS v4 | ^4 |
| Icons | Lucide React | ^0.575.0 |
| Database | Turso (libSQL / edge SQLite) | @libsql/client ^0.17.0 |
| ORM | Drizzle ORM | ^0.45.1 |
| Auth | NextAuth.js v5 (beta) | ^5.0.0-beta.30 |
| Auth Adapter | @auth/drizzle-adapter | ^1.11.1 |
| Forms | React Hook Form + Zod | ^7.71.2 / ^4.3.6 |
| Client State | Zustand | ^5.0.11 |
| Toasts | Sonner | ^2.0.7 |
| Date Utils | date-fns | ^4.1.0 |
| Fonts | Geist Sans / Geist Mono (Google) | via next/font |
| Deployment | Vercel | — |

**React version:** 19.2.3
**Node target:** 22.x

---

## Directory Structure

```
tc-dashboard/
├── docs/
│   └── ARCHITECTURE.md          # this file
├── public/                      # static assets (logos, brand images)
├── src/
│   ├── actions/                 # Next.js Server Actions (all DB mutations)
│   │   ├── access-requests.ts   # public access request form + admin approval
│   │   ├── agents.ts            # agent CRUD
│   │   ├── tasks.ts             # task template group CRUD + task template CRUD + dashboard queries
│   │   ├── transactions.ts      # transaction CRUD + milestone updates
│   │   └── users.ts             # admin user management
│   ├── app/
│   │   ├── (auth)/
│   │   │   └── login/page.tsx   # credentials login form
│   │   ├── (dashboard)/         # route group — all share the sidebar layout
│   │   │   ├── layout.tsx       # sidebar + main content shell
│   │   │   ├── dashboard/       # /dashboard — stats + task lists
│   │   │   ├── transactions/    # /transactions — list + create
│   │   │   │   └── [id]/        # /transactions/:id — detail + tasks + activity
│   │   │   ├── agents/          # /agents — agent table + CRUD
│   │   │   ├── settings/        # /settings — profile + branding tabs
│   │   │   │   └── _components/ # settings-specific client components
│   │   │   ├── templates/       # /templates — task template management
│   │   │   └── users/           # /users — admin-only user management
│   │   ├── api/auth/[...nextauth]/route.ts  # NextAuth handler
│   │   ├── layout.tsx           # root layout — fonts, providers, brand CSS injection
│   │   ├── globals.css          # Tailwind v4 imports + CSS custom properties
│   │   └── page.tsx             # / → redirect to /dashboard
│   ├── components/
│   │   ├── ui/                  # shadcn/ui primitives (auto-generated, do not edit)
│   │   ├── providers/
│   │   │   ├── theme-provider.tsx   # next-themes wrapper + brand CSS injection + BrandContext
│   │   │   └── session-provider.tsx # NextAuth SessionProvider wrapper
│   │   ├── layout/
│   │   │   └── app-sidebar.tsx  # collapsible sidebar with nav + user menu
│   │   ├── dashboard/           # dashboard-specific cards and lists
│   │   ├── transactions/        # transaction list, detail, forms
│   │   ├── agents/              # agent form
│   │   ├── tasks/               # transaction task list + inline task actions
│   │   └── settings/            # template group + task template forms and tabs
│   ├── db/
│   │   ├── schema.ts            # Drizzle schema — single source of truth for all types
│   │   ├── client.ts            # Turso libSQL connection + Drizzle instance
│   │   ├── seed.ts              # full database seed (wipes and repopulates)
│   │   ├── migrations/          # generated migration files (drizzle-kit generate)
│   │   ├── migrate-template-groups.ts  # one-time migration: template groups backfill
│   │   ├── drop-legacy-columns.ts      # utility: drop orphaned DB columns
│   │   └── inspect-schema.ts           # utility: print live DB CREATE TABLE statements
│   ├── lib/
│   │   ├── auth.ts              # NextAuth config — credentials provider, JWT callbacks
│   │   ├── brand-config.ts      # BrandConfig interface + defaultBrand + premiereBrand + activeBrand
│   │   ├── brand-utils.ts       # generateBrandCss() — converts BrandConfig to CSS string
│   │   ├── task-stamping.ts     # stampTasks() + recalculateTaskDueDates()
│   │   ├── task-templates.ts    # defaultTaskTemplates seed data (38 CA RE tasks)
│   │   ├── template-group-schema.ts  # Zod schema for template group forms (shared client/server)
│   │   ├── transaction-schema.ts     # Zod schema for transaction forms (shared client/server)
│   │   └── utils.ts             # cn() (clsx + tailwind-merge)
│   ├── hooks/
│   │   └── use-brand.ts         # useBrand() hook — reads/sets active brand at runtime
│   ├── proxy.ts                 # Next.js 16 auth proxy (replaces middleware.ts)
│   └── types/
│       └── index.ts             # NextAuth module augmentation: session.user.id + role
├── drizzle.config.ts            # Drizzle Kit config (dialect: turso)
├── components.json              # shadcn/ui config
└── .env.local                   # secrets (not committed)
```

---

## Database Schema

All tables live in a single Turso (libSQL/SQLite) database. Schema defined in `src/db/schema.ts`; Drizzle infers all TypeScript types from it.

### NextAuth tables (managed by @auth/drizzle-adapter)

| Table | Purpose |
|---|---|
| `users` | App users. Extra columns: `hashed_password`, `role` |
| `accounts` | OAuth provider accounts (unused — credentials only) |
| `sessions` | Session tokens (unused — JWT strategy) |
| `verification_tokens` | Email verification (unused) |

### App tables

#### `agents`
Brokerage agents who can be attached to transactions as seller or buyer representatives.

| Column | Type | Notes |
|---|---|---|
| id | text PK | UUID |
| name | text | |
| email | text | |
| phone | text | nullable, auto-formatted on display |
| broker | text | brokerage name for display |
| license_number | text | CA DRE license |
| brokerage_id | text | nullable |
| is_active | boolean | soft delete |
| created_at / updated_at | timestamp_ms | |

#### `transactions`
Core entity. One row per real estate transaction.

| Column | Type | Notes |
|---|---|---|
| id | text PK | UUID |
| address, city, state, zip_code | text | property address |
| mls_number | text | |
| listing_agent_id | text FK → agents | in-house agent representing the Seller |
| seller_agent_is_in_house | boolean | |
| selling_agent_id | text FK → agents | in-house agent representing the Buyer |
| buyer_agent_is_in_house | boolean | |
| transaction_type | enum | `listing` \| `purchase` \| `dual` |
| status | enum | `pending` \| `active` \| `in_escrow` \| `closing` \| `closed` \| `cancelled` |
| property_type | enum | `single_family` \| `condo` \| `townhouse` \| `multi_family` \| `land` \| `commercial` |
| escrow_* | text | escrow company, officer, contact |
| title_* | text | title company, officer |
| lender_name, loan_officer, loan_officer_* | text | lender details |
| buyer_name, buyer_agent | text | external buyer/agent names (free text) |
| seller_name, seller_agent | text | external seller/agent names (free text) |
| purchase_price, list_price, earnest_money_deposit | integer | **cents** — never floats |
| commission_percent | text | stored as string to avoid float precision issues |
| acceptance_date | text | ISO date string (YYYY-MM-DD) |
| escrow_open_date | text | ISO date string |
| listing_active_date | text | ISO date string |
| inspection_contingency_date | text | ISO date string |
| appraisal_contingency_date | text | ISO date string |
| loan_contingency_date | text | ISO date string |
| expected_close_date | text | ISO date string |
| actual_close_date | text | ISO date string |
| notes | text | freeform |
| created_by | text FK → users | |
| created_at / updated_at | timestamp_ms | |
| agent_id | text | **legacy column** — retained in schema to match DB, not used in app logic |

#### `task_template_groups`
Named template collections. Three built-in groups are seeded and cannot be deleted.

| Column | Type | Notes |
|---|---|---|
| id | text PK | UUID |
| name | text | e.g. "Listing Template" |
| description | text | nullable |
| transaction_type | enum | `listing` \| `purchase` \| `dual` \| `all` |
| is_default | boolean | true = built-in, cannot be deleted |
| is_active | boolean | inactive groups are excluded from stamping |
| sort_order | integer | tab display order |
| created_at | timestamp_ms | |

**Built-in groups (seeded):**

| Name | transaction_type | Stamps on |
|---|---|---|
| Listing Template | listing | listing + dual transactions |
| Purchase Template | purchase | purchase + dual transactions |
| Dual Agency Template | dual | dual transactions only |

#### `task_templates`
Individual task definitions belonging to a group.

| Column | Type | Notes |
|---|---|---|
| id | text PK | UUID |
| template_group_id | text FK → task_template_groups | nullable |
| name | text | |
| description | text | nullable |
| category | enum | `pre_escrow` \| `opening` \| `disclosures` \| `inspections` \| `contingencies` \| `loan` \| `appraisal` \| `title` \| `closing` \| `post_closing` \| `listing` |
| relative_due_days | integer | positive = days after milestone, negative = before |
| relative_to | enum | `acceptance_date` \| `escrow_open` \| `expected_close_date` \| `inspection_contingency_date` \| `appraisal_contingency_date` \| `loan_contingency_date` \| `listing_active_date` |
| sort_order | integer | |
| is_required | boolean | |
| is_active | boolean | inactive tasks excluded from stamping |
| created_at | timestamp_ms | |
| transaction_type | text | **legacy column** — retained to match DB, not used in app logic |

#### `transaction_tasks`
Stamped task instances on a specific transaction. Created from templates at transaction creation time, or added manually.

| Column | Type | Notes |
|---|---|---|
| id | text PK | UUID |
| transaction_id | text FK → transactions | |
| template_id | text FK → task_templates | null for custom tasks |
| name | text | copied from template at stamp time |
| description | text | copied from template |
| category | text | copied from template |
| due_date | text | calculated ISO date string, recalculated on milestone changes |
| completed_date | text | ISO date, set when status → completed |
| status | enum | `pending` \| `in_progress` \| `completed` \| `overdue` \| `waived` \| `not_applicable` |
| assigned_to | text | nullable |
| priority | enum | `low` \| `medium` \| `high` \| `urgent` |
| notes | text | |
| sort_order | integer | |
| created_at / updated_at | timestamp_ms | |

#### `activity_log`
Append-only event log per transaction.

| Column | Type | Notes |
|---|---|---|
| id | text PK | UUID |
| transaction_id | text FK → transactions | |
| user_id | text FK → users | |
| action | text | `created` \| `updated` \| `status_changed` \| `task_completed` \| `note_added` |
| details | text | JSON string with change details |
| created_at | timestamp_ms | |

#### `access_requests`
Public access request form submissions (no auth required). Admins review and approve/reject from the dashboard.

| Column | Type | Notes |
|---|---|---|
| id | text PK | UUID |
| name, email, phone, address, company, note | text | |
| created_at | timestamp_ms | |

---

## Authentication & Authorization

**Provider:** NextAuth v5 (beta), credentials only — email + bcrypt password.
**Session strategy:** JWT (not database sessions). Session tokens are not stored in the DB.
**Adapter:** @auth/drizzle-adapter populates the NextAuth tables but sessions use JWT.

**Roles:** `admin` | `broker` | `tc` | `agent`

Role is stored on the `users` table and propagated into the JWT via the `jwt` callback, then surfaced on `session.user.role` via the `session` callback. The type augmentation lives in `src/types/index.ts`.

**Route protection:** Each server component calls `auth()` and redirects to `/login` if no session. The `/users` route additionally checks `session.user.role === 'admin'` and redirects non-admins to `/dashboard`.

**Auth proxy:** `src/proxy.ts` serves as the Next.js 16 middleware equivalent (Next 16 deprecated `middleware.ts` filename).

**Password management:** bcryptjs, cost factor 12. Admins can reset any user's password; a temporary password is generated (`XXXX-XXXX` format) and displayed once in a modal.

---

## Routing

All dashboard routes share a layout at `src/app/(dashboard)/layout.tsx` that renders the `AppSidebar` and a `<main>` content area.

| Route | Type | Auth | Notes |
|---|---|---|---|
| `/` | Static | — | Redirects to `/dashboard` |
| `/login` | Static | Public | Credentials form |
| `/dashboard` | Dynamic | Any role | Stats cards, task lists, pending access requests (admin only visible) |
| `/transactions` | Client | Any role | List grouped by agent; client-side search + status filter |
| `/transactions/[id]` | Dynamic | Any role | Full transaction detail, task checklist, milestone dates, activity log |
| `/agents` | Client | Any role | Agent table with CRUD |
| `/templates` | Dynamic | Any role | Task template management — tabbed by template group |
| `/settings` | Dynamic | Any role | Profile (name/password) + Branding (live brand toggle) |
| `/users` | Dynamic | Admin only | User management — create, edit role, reset password, delete |
| `/api/auth/[...nextauth]` | API | — | NextAuth handler (GET + POST) |

**Server vs Client components:** Server Components are the default. `'use client'` is added only when a component needs `useState`, `useEffect`, event handlers, or hooks. Pages that require real-time interactivity (transactions list, agents, templates) are client components that call server actions directly.

---

## Branding System

The entire visual identity is controlled by a single exported object in `src/lib/brand-config.ts`.

```
activeBrand (BrandConfig)
    └── generateBrandCss()          → CSS string of custom properties
            ├── injected server-side in root layout <head> (no flash)
            └── re-injected client-side by ThemeProvider on mount (dark mode support)
```

**BrandConfig properties:**
- `name` — app title (used in `<title>` and sidebar header)
- `tagline` — subtitle shown in the sidebar header
- `logo` — path to logo image rendered in the sidebar
- `logoIcon` — small icon for collapsed sidebar state
- `colors` — full HSL color palette including 5 status colors
- `darkColors` — optional overrides for dark mode
- `borderRadius` — applied to `--radius` CSS variable
- `fontFamily` — optional font override

**To rebrand:** change the `activeBrand` export in `brand-config.ts`. Two brand configs are included: `defaultBrand` (Crestline Realty, navy) and `premiereBrand` (Premiere Realty TC, gold/charcoal).

**BrandContext** is exposed via `useBrandContext()` for components that need to read brand values at runtime (e.g. sidebar logo, page titles).

The Settings → Branding tab includes a live toggle between the two configured brands for preview purposes.

---

## Task Template System

### Concept

Templates are organized into named **groups**. A group represents a checklist for a specific transaction type. When a transaction is created, all active tasks from the applicable groups are **stamped** onto it as `transaction_tasks` with calculated due dates.

### Groups → Templates → Tasks

```
task_template_groups        (named collection, e.g. "Listing Template")
    └── task_templates      (individual task definitions with due date rules)
            └── transaction_tasks   (stamped instances on a specific transaction)
```

### Stamping Logic (`src/lib/task-stamping.ts`)

Called at transaction creation time. Selects applicable groups based on `transactionType`:

| Transaction Type | Groups stamped from |
|---|---|
| `listing` | listing + all |
| `purchase` | purchase + all |
| `dual` | listing + purchase + dual + all |

Dual agency transactions inherit all listing and purchase tasks automatically, plus any tasks added directly to the Dual Agency group.

**Due date calculation:** `milestone_date + relative_due_days`. If the milestone date is not yet set, `due_date` is null and calculated later when milestones are entered.

**Milestone recalculation:** When a transaction's milestone dates change (e.g. `expected_close_date` updated), `recalculateTaskDueDates()` recalculates due dates for all template-based tasks on that transaction.

### Template Group Management

Three built-in groups (`is_default = true`) are seeded at setup and cannot be deleted. Admins can add custom groups with any `transaction_type`. The Templates page (`/templates`) renders one tab per group.

### Adding Tasks

The "Add Task" button in each group tab defaults `templateGroupId` to the active tab's group — no extra step required. The task form collects: name, description, category, due days offset, relative-to milestone, sort order, required flag, active flag.

---

## Server Actions

All mutations go through Next.js Server Actions in `src/actions/`. Each action returns `{ success: boolean, data?: T, error?: string }` and never throws. Client components use `useTransition` to call actions and display `sonner` toasts on result.

Zod schemas shared between client forms and server actions live in `src/lib/*-schema.ts` files (no directive) to avoid `"use server"` export restrictions.

| File | Key exports |
|---|---|
| `actions/tasks.ts` | `getDashboardStats`, `getUpcomingTasks`, `getOverdueTasks`, `getUpcomingDeadlines`, `updateTaskStatus`, `createCustomTask`, `snoozeTask`, `getTaskTemplateGroups`, `createTaskTemplateGroup`, `updateTaskTemplateGroup`, `deleteTaskTemplateGroup`, `toggleTaskTemplateGroupActive`, `getTaskTemplates`, `createTaskTemplate`, `updateTaskTemplate`, `toggleTaskTemplateActive` |
| `actions/transactions.ts` | `getTransactions`, `getTransactionById`, `createTransaction`, `updateTransaction`, `updateTransactionStatus`, `getActivityLog` |
| `actions/agents.ts` | `getAgents`, `getAgentsForSelect`, `createAgent`, `updateAgent`, `toggleAgentActive`, `deleteAgent` |
| `actions/users.ts` | `listUsers`, `createUser`, `updateUser`, `deleteUser`, `resetUserPassword`, `updateProfile`, `changePassword` |
| `actions/access-requests.ts` | `submitAccessRequest`, `getPendingRequests`, `approveRequest`, `rejectRequest` |

**`"use server"` export rules (enforced by Turbopack):**
- Only async functions and inline `type` aliases may be exported from `"use server"` files
- No Zod schemas, no plain objects, no re-exported types from other modules
- Violating this causes a Turbopack build error at compile time

---

## Key Conventions

**Money:** All monetary values stored as integer cents. Display with a `formatCurrency()` utility. Never use floats.

**Dates:** Stored as ISO date strings (`YYYY-MM-DD`) in the DB. Displayed using `date-fns` `format()` and `formatDistanceToNow()`.

**IDs:** `crypto.randomUUID()` throughout — no external UUID library needed at runtime.

**Forms:** React Hook Form + Zod resolver. `z.number()` with `{ valueAsNumber: true }` on `register()` for numeric inputs — never `z.coerce.number()` (breaks the RHF resolver with unknown input type). No `.transform()` in schemas shared with RHF; transformations go in server actions only.

**Responsive layout:** Mobile-first. Sidebar collapses to icon-only on small screens. Table columns progressively hide at `sm`/`md`/`lg` breakpoints. Card layouts stack vertically on mobile.

**Tailwind v4:** Uses `@import "tailwindcss"` (not `@tailwind base/components/utilities`). CSS variables in `oklch()` format from shadcn defaults; the brand system overrides with `hsl()` at runtime — both formats are valid. Dark mode activated via `.dark` class (`@custom-variant dark (&:is(.dark *))`).

**shadcn/ui:** New York style. Components in `src/components/ui/` are auto-generated and must not be manually edited. Override styles via `className` props on the component, not by editing the source.

---

## Environment Variables

```
TURSO_DATABASE_URL=libsql://your-db.turso.io
TURSO_AUTH_TOKEN=your-token
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-secret
```

---

## Database Operations

```bash
npm run db:generate    # generate migration files from schema changes
npm run db:migrate     # apply generated migrations
npm run db:push        # push schema directly to DB (dev only — bypasses migration files)
npm run db:seed        # wipe and reseed all tables with sample data
npm run db:studio      # open Drizzle Studio (browser-based DB explorer)
```

**Migration approach for this project:** `db:push` is used in development because SQLite table recreation (required for column drops/renames) is handled interactively. `db:generate` + `db:migrate` is available for production-style migrations.

**SQLite column drop caveat:** Drizzle-kit drops SQLite columns by recreating the table, which triggers `PRAGMA foreign_key_check`. Columns with table-level FK constraints (e.g. the legacy `agent_id` on `transactions`) may fail this check even when safe. Use `ALTER TABLE DROP COLUMN` directly via a migration script for those cases, or retain them in `schema.ts` as documented legacy columns.

---

## Access Request Flow

A public-facing form (accessible without login) allows agents to request dashboard access. The flow:

1. Agent submits form → row inserted in `access_requests`
2. Admin sees a `PendingRequestsCard` on `/dashboard` with count badge
3. Admin clicks Approve → a user account is created with a generated temporary password (`XXXX-XXXX`) and the request row is deleted
4. Temporary password is shown once in a modal (AlertDialog) — admin must record it to pass to the new user
5. Admin clicks Reject → request row is deleted, no account created

---

## White-Label Rebranding Guide

To deploy this app for a different brokerage:

1. Add logo files to `/public/`
2. Create a new `BrandConfig` object in `src/lib/brand-config.ts`
3. Set `activeBrand` to the new object
4. Update `NEXTAUTH_SECRET` and database credentials in `.env.local`
5. Deploy — no other code changes required

A future release will store brand config in the database, enabling UI-driven rebranding without a code deploy.
