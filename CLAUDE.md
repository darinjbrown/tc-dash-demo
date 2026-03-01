# TC Dashboard

## Project

Transaction Coordinator dashboard for California real estate brokerages. Built as a white-label MVP that can be rebranded per brokerage by swapping a single config object. The task checklist is a scaffold — the real checklist will be provided by the agent later and populated via the Settings UI.

## Tech Stack

- **Framework:** Next.js 15+ (App Router, TypeScript strict, `src/` directory)
- **UI:** shadcn/ui (New York style) + Tailwind CSS v4 + Lucide icons
- **Theming:** CSS custom properties + `next-themes` for dark/light + `BrandConfig` in `src/lib/brand-config.ts`
- **Database:** Turso (libSQL, edge SQLite) via `@libsql/client`
- **ORM:** Drizzle ORM with `drizzle-orm/libsql` driver
- **Auth:** NextAuth.js v5 (Auth.js) with Drizzle adapter, credentials provider
- **Client State:** Zustand (UI state only — sidebar, expanded rows, filters)
- **Forms:** React Hook Form + Zod
- **Deployment:** Vercel

## Key Constraints

- **No Supabase.** Turso is the database for MVP. Supabase is a future premium option. Do not install or reference Supabase packages.
- **No file uploads.** Not needed for MVP. Defer to Supabase Storage or Cloudflare R2 later.
- **No email or notification sending.** Placeholder icons are fine.
- **No heavy state management.** No Redux, TanStack Query, or SWR. Zustand for UI state only. Server Components handle data fetching.
- **Task templates are scaffolds.** The real checklist is TBD. The schema must make it trivial to add, remove, and reorder templates via the Settings page.
- **Single role per user.** Roles: `admin`, `broker`, `tc`, `agent`. Use highest-privilege-wins if someone needs multiple roles.

## Architecture Decisions

- **Rebranding:** All visual theming flows from `src/lib/brand-config.ts`. Changing the `activeBrand` object rebrands the entire app — colors, logos, border radius, fonts. The `ThemeProvider` injects these as CSS custom properties at runtime.
- **Task stamping:** When a transaction is created, `taskTemplates` matching the transaction type are stamped into `transactionTasks` with calculated due dates based on milestone dates. When a milestone date changes, affected task due dates are recalculated.
- **Money:** All monetary values stored in cents (integer). Format for display with a `formatCurrency()` utility. Never use floats for money.
- **Dates:** Stored as ISO strings in the DB. Displayed using `date-fns` `format()` and `formatDistanceToNow()`.
- **Server Actions:** Return `{ success: boolean, data?: T, error?: string }`. Never throw from Server Actions. Use `sonner` toasts for user feedback.
- **Supabase migration path:** Drizzle ORM abstracts the DB layer. Switching from Turso (SQLite) to Supabase (Postgres) means changing the Drizzle driver config and running a migration, not rewriting queries.

## Code Style

- Server Components by default. Only add `"use client"` when the component needs interactivity (onClick, useState, useEffect, etc.)
- `"use server"` directive at the top of Server Action files in `src/actions/`
- Use `crypto.randomUUID()` for generating IDs
- Every form uses Zod schemas that match the Drizzle schema types
- Responsive: mobile-first. Sidebar collapses on mobile, card layouts stack, tables become card lists on small screens.
- No `console.log` in committed code. Use proper error boundaries.
- Use shadcn/ui components for all UI elements. Do not install competing component libraries.
- Import paths use `@/*` alias (e.g., `@/components/ui/button`)

## Directory Structure

```
src/
├── app/                    # Next.js App Router
│   ├── (auth)/             # Auth routes (login)
│   ├── (dashboard)/        # Dashboard routes (sidebar layout)
│   │   ├── transactions/   # Transaction list + detail
│   │   ├── agents/         # Agent management
│   │   └── settings/       # Templates, branding, profile
│   └── api/auth/           # NextAuth API route
├── components/
│   ├── ui/                 # shadcn/ui (auto-generated, do not manually edit)
│   ├── providers/          # ThemeProvider, SessionProvider
│   ├── layout/             # Sidebar, top bar, mobile nav
│   ├── dashboard/          # Dashboard-specific components
│   ├── transactions/       # Transaction components
│   └── tasks/              # Task/checklist components
├── db/
│   ├── schema.ts           # Drizzle schema (single source of truth)
│   ├── client.ts           # Turso connection
│   ├── seed.ts             # Seed script
│   └── migrations/
├── lib/                    # Utilities, auth config, brand config
├── hooks/                  # Custom React hooks
├── actions/                # Server Actions (CRUD)
└── types/                  # Shared TypeScript types
```

## Database

- **Provider:** Turso (libSQL)
- **ORM:** Drizzle
- **Tables:** users, accounts, sessions, verificationTokens (NextAuth), agents, transactions, taskTemplates, transactionTasks, activityLog
- **Migrations:** `drizzle-kit generate` → `drizzle-kit migrate`
- **Seed:** `npx tsx src/db/seed.ts`

## Environment Variables

```
TURSO_DATABASE_URL=libsql://...
TURSO_AUTH_TOKEN=...
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=...
```

## Common Commands

```bash
npm run dev              # Start dev server
npm run build            # Production build (verify no TS errors)
npm run db:generate      # Generate migrations from schema changes
npm run db:migrate       # Run migrations
npm run db:push          # Push schema directly (dev only)
npm run db:seed          # Seed sample data
npm run db:studio        # Open Drizzle Studio
```
