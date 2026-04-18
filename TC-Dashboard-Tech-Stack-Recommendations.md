# Transaction Coordinator Dashboard — Tech Stack Recommendations

**Prepared by:** Staff Software Architect  
**Date:** March 2026  
**Project:** California Real Estate Broker TC Dashboard  

---

## Executive Summary

This document evaluates every layer of the tech stack for a Transaction Coordinator (TC) dashboard built on React/Next.js. The core constraints are:

1. **Rebrandable theming** — swap colors/logos per brokerage without code changes
2. **Free persistent storage** (non-Supabase) for initial launch
3. **Future Supabase upgrade path** for a premium tier
4. **Scaffoldable** — the task checklist is TBD, so the data model must be flexible

Each section presents options with pros, cons, and a recommendation.

---

## 1. Framework: Next.js (App Router)

This is already decided, but worth noting the specific approach.

### Recommendation: Next.js 15+ with App Router

| Pros | Cons |
|------|------|
| Server Components reduce client bundle size | Learning curve vs Pages Router |
| Server Actions eliminate API boilerplate for CRUD | Some libraries still assume Pages Router |
| Built-in middleware for auth guards | Debugging RSC errors can be opaque |
| Vercel-native deployment with zero config | Vendor gravity toward Vercel hosting |
| Route Groups organize dashboard sections cleanly | — |

**Specific guidance for Claude Code prompt:** Use `app/` directory, TypeScript strict mode, `src/` folder structure.

---

## 2. UI Component Library + Theming

Your rebranding requirement is the most important constraint here. You need a system where a non-developer can change a handful of CSS variables (or a config file) and get a fully rebranded dashboard.

### Option A: shadcn/ui + Tailwind CSS (Recommended ✅)

shadcn/ui is not a traditional component library — it copies component source code into your project, giving you full ownership. Theming is done via CSS custom properties (HSL values) in `globals.css`.

| Pros | Cons |
|------|------|
| Theming via CSS variables — change 10-12 color tokens to rebrand entirely | You own the code, so you own maintenance |
| `next-themes` provides light/dark mode out of the box | Initial setup is more involved than installing a package |
| Tailwind utility classes are predictable and scannable | Tailwind learning curve for devs unfamiliar with it |
| Components are accessible (built on Radix UI primitives) | No drag-and-drop theme builder included (but many exist) |
| Massive ecosystem of pre-built blocks and templates | — |
| Logo/brand assets can be driven from a config file or DB | — |

**How rebranding works:** You define a `theme.config.ts` that maps brokerage names to CSS variable overrides (primary color, accent, radius, logo URL, etc.). A `ThemeProvider` applies them at runtime. Swapping brands is a single config change — no rebuild needed if you load the config from the DB or an env variable.

### Option B: Chakra UI

| Pros | Cons |
|------|------|
| Built-in theme object is easy to override | Heavier runtime (emotion CSS-in-JS) |
| Good component variety | Less flexibility than owning the source |
| Dark mode is trivial | Smaller ecosystem for dashboard-specific blocks |

### Option C: Material UI (MUI)

| Pros | Cons |
|------|------|
| Mature, comprehensive component set | Google's Material Design aesthetic is hard to escape |
| Theme provider is well-documented | Heavy bundle size |
| Used by many enterprise dashboards | Rebranding beyond colors (e.g., border radius, density) is painful |

### Verdict: **shadcn/ui + Tailwind CSS v4 + next-themes**

It gives you the deepest control over rebranding, the lightest runtime, and the strongest ecosystem for dashboard patterns (data tables, command palettes, collapsible sidebars, etc.).

---

## 3. Persistent Storage (Free Tier, Non-Supabase)

This is your most consequential decision. You need something free, production-viable, and that doesn't lock you in — since you plan to offer a Supabase premium tier later.

### Option A: Turso (libSQL / Edge SQLite) — Recommended ✅

Turso is a managed, serverless SQLite-compatible database built on libSQL. It runs on the edge and has a very generous free tier.

| Pros | Cons |
|------|------|
| **Free tier:** 500M row reads, 10M writes, 5GB storage/month — extremely generous for a TC dashboard | SQLite dialect, not Postgres — some syntax differences |
| SQLite is the simplest possible DB to reason about | No built-in auth (but you don't need it from the DB layer) |
| Edge-deployed, sub-10ms reads globally | Write latency is 20-100ms (fine for a TC dashboard) |
| Drizzle ORM works natively with both Turso AND Supabase (Postgres) | Smaller community than Postgres ecosystem |
| No cold starts on free tier (unlike Neon) | — |
| $4.99/month Developer tier if you outgrow free | — |

**Migration path to Supabase:** If you use **Drizzle ORM** as your data access layer, your schema definitions and queries are ORM-level abstractions. Switching from Turso (SQLite dialect) to Supabase (Postgres) means changing the Drizzle driver config and running a migration — not rewriting queries. You can even run both simultaneously during a transition.

### Option B: Neon (Serverless Postgres)

| Pros | Cons |
|------|------|
| Full Postgres — identical dialect to Supabase | Free tier: 0.5GB storage per branch, 100 CU-hours/project |
| Branching for preview environments | 5-minute inactivity timeout causes ~800ms cold starts |
| Drizzle ORM support | Smaller free tier than Turso |
| Scale-to-zero saves cost | Cold starts are noticeable for first request |
| Vercel native integration | — |

### Option C: PlanetScale (MySQL-compatible)

| Pros | Cons |
|------|------|
| Mature, reliable | Free tier was removed in 2024 — now $39/month minimum |
| Good branching model | MySQL dialect is farther from Supabase (Postgres) |
| — | Not free — disqualified |

### Option D: SQLite on Disk (self-hosted, e.g., on Railway/Fly.io)

| Pros | Cons |
|------|------|
| Zero external dependencies | You manage the server and backups |
| Fastest possible reads | No managed free tier — need to host somewhere |
| — | Single-writer limitation without WAL tuning |
| — | Not viable for multi-user without careful architecture |

### Verdict: **Turso**

For a TC dashboard with modest write volume and a future Supabase migration path, Turso's free tier is unmatched. The Drizzle ORM abstraction layer makes the future switch manageable.

---

## 4. ORM / Data Access Layer

### Option A: Drizzle ORM — Recommended ✅

| Pros | Cons |
|------|------|
| Type-safe schema definitions in TypeScript | Newer than Prisma, smaller community |
| Works with both SQLite (Turso) and Postgres (Supabase) — critical for your migration path | Less "magic" — you write more explicit queries |
| Lightweight, no runtime engine | Migration tooling is less polished than Prisma |
| SQL-like query builder feels natural | — |
| Built-in migration generation (`drizzle-kit`) | — |

### Option B: Prisma

| Pros | Cons |
|------|------|
| Largest ORM community in the TypeScript ecosystem | Heavy runtime engine (Prisma Client + Query Engine) |
| Prisma Studio for visual data browsing | SQLite support is available but not the primary target |
| Schema-first approach is intuitive | Slower cold starts in serverless environments |
| — | Schema language (`.prisma`) is custom, not TypeScript |

### Verdict: **Drizzle ORM**

Drizzle's dual-dialect support (SQLite → Postgres) is a perfect match for the Turso → Supabase migration path, and its lightweight runtime is better suited to serverless/edge deployment.

---

## 5. Authentication

You'll need auth to identify agents and brokers. Since you're not using Supabase yet, you need a standalone auth solution.

### Option A: NextAuth.js (Auth.js v5) — Recommended ✅

| Pros | Cons |
|------|------|
| Free, open source | Configuration can be verbose |
| Works with any database via adapters (Drizzle adapter exists) | Session management has edge cases |
| Supports OAuth (Google), email/password, magic links | Documentation for v5 is still catching up |
| Stores sessions in your own DB (Turso) | — |
| When you move to Supabase, you can swap to Supabase Auth or keep NextAuth | — |

### Option B: Clerk

| Pros | Cons |
|------|------|
| Beautiful drop-in UI components | Free tier: 10,000 MAU, then $0.02/MAU |
| Handles all auth complexity | Vendor lock-in for auth |
| User management dashboard included | Data lives on Clerk's servers |

### Option C: Lucia Auth

| Pros | Cons |
|------|------|
| Lightweight, framework-agnostic | Officially deprecated as of late 2024 |
| Full control over sessions | — not recommended for new projects |

### Verdict: **NextAuth.js v5 (Auth.js)**

Free, stores data in your DB (keeping the Supabase migration clean), and has the broadest ecosystem support.

---

## 6. State Management

### Recommendation: React Server Components + Zustand (for client-side interactive state)

| Layer | Tool | Why |
|-------|------|-----|
| Server data | RSC + Server Actions | Transactions, tasks, and agent data are fetched server-side |
| Client interactivity | Zustand | Lightweight store for UI state: expanded rows, filters, sidebar collapse |
| Form state | React Hook Form + Zod | Type-safe form validation for transaction detail editing |

You do **not** need Redux, TanStack Query, or SWR for this project. Server Components handle data fetching, and Zustand handles the small amount of client-side state (which TODO list is active, which transaction is expanded, etc.).

---

## 7. Deployment

### Option A: Vercel — Recommended ✅

| Pros | Cons |
|------|------|
| Zero-config Next.js deployment | Hobby tier: 100GB bandwidth, limited serverless execution |
| Preview deployments per PR | Can get expensive at scale |
| Edge Functions for middleware | Vendor lock-in to Vercel's serverless model |
| Native Turso and Neon integrations | — |

### Option B: Cloudflare Pages

| Pros | Cons |
|------|------|
| Generous free tier (unlimited bandwidth) | Next.js support via `@cloudflare/next-on-pages` has gaps |
| Edge-first architecture | Some Next.js features (ISR, middleware) need workarounds |

### Option C: Railway / Fly.io

| Pros | Cons |
|------|------|
| More control over infrastructure | More DevOps overhead |
| Can run long-running processes | No native Next.js integration |

### Verdict: **Vercel (Hobby tier → Pro)**

For a Next.js app, Vercel is the path of least resistance and the free Hobby tier is sufficient to launch.

---

## 8. File Storage (for transaction documents, disclosures, etc.)

Real estate transactions generate documents. You'll need file storage eventually.

### Option A: Uploadthing — Recommended for MVP ✅

| Pros | Cons |
|------|------|
| Free tier: 2GB, 100MB file size limit | Less control than S3 |
| Dead-simple Next.js integration | Smaller company |
| Type-safe upload handlers | — |

### Option B: Cloudflare R2

| Pros | Cons |
|------|------|
| S3-compatible, no egress fees | More setup required |
| 10GB free storage, 10M class A operations | Need to build upload UI yourself |

### Option C: Defer to Supabase Storage (premium tier)

When you add the Supabase premium tier, you get Supabase Storage (S3-backed) with the subscription. For MVP, start with Uploadthing or skip file storage entirely and scaffold the UI for it.

---

## 9. Recommended Full Stack Summary

| Layer | Technology | Cost |
|-------|-----------|------|
| **Framework** | Next.js 15 (App Router, TypeScript) | Free |
| **UI Components** | shadcn/ui + Tailwind CSS v4 | Free |
| **Theming** | CSS variables + next-themes + brand config | Free |
| **Database** | Turso (libSQL, edge SQLite) | Free tier |
| **ORM** | Drizzle ORM | Free |
| **Auth** | NextAuth.js v5 (Auth.js) | Free |
| **Client State** | Zustand | Free |
| **Forms** | React Hook Form + Zod | Free |
| **Deployment** | Vercel (Hobby) | Free |
| **File Storage** | Uploadthing (or deferred) | Free tier |
| **Premium DB (future)** | Supabase | $25/mo+ |

**Total cost at launch: $0/month**

---

## 10. Project Structure (for Claude Code prompt)

```
src/
├── app/
│   ├── (auth)/           # Login, register routes
│   ├── (dashboard)/      # Main dashboard layout
│   │   ├── layout.tsx     # Sidebar + header
│   │   ├── page.tsx       # Dashboard home (TODO lists)
│   │   ├── transactions/
│   │   │   ├── page.tsx   # Transaction list by agent
│   │   │   └── [id]/
│   │   │       └── page.tsx  # Expandable transaction detail
│   │   └── settings/
│   │       └── page.tsx   # Brand config, user prefs
│   └── api/              # API routes if needed
├── components/
│   ├── ui/               # shadcn/ui components
│   ├── dashboard/        # Dashboard-specific components
│   │   ├── todo-list.tsx
│   │   ├── transaction-card.tsx
│   │   ├── transaction-detail.tsx
│   │   └── agent-group.tsx
│   └── theme/
│       ├── theme-provider.tsx
│       └── brand-config.ts
├── db/
│   ├── schema.ts         # Drizzle schema definitions
│   ├── client.ts         # Turso connection (swappable to Supabase)
│   └── migrations/
├── lib/
│   ├── auth.ts           # NextAuth config
│   ├── utils.ts          # shadcn cn() helper
│   └── constants/
│       └── task-templates.ts  # Scaffold: default CA RE task checklists
└── types/
    └── index.ts          # Shared TypeScript types
```

---

## 11. Data Model Scaffold

Since the full task checklist is TBD, the schema should be designed for flexibility. Here's the Drizzle schema sketch:

```typescript
// db/schema.ts — Drizzle ORM (SQLite dialect for Turso)

export const agents = sqliteTable('agents', {
  id: text('id').primaryKey(),       // UUID
  name: text('name').notNull(),
  email: text('email').notNull(),
  phone: text('phone'),
  brokerageId: text('brokerage_id'), // for multi-brokerage support
  createdAt: integer('created_at', { mode: 'timestamp' }).defaultNow(),
});

export const transactions = sqliteTable('transactions', {
  id: text('id').primaryKey(),
  address: text('address').notNull(),
  mlsNumber: text('mls_number'),
  agentId: text('agent_id').references(() => agents.id),
  transactionType: text('transaction_type'),  // 'listing' | 'purchase' | 'dual'
  status: text('status').default('pending'),  // 'pending' | 'active' | 'closed' | 'cancelled'
  escrowNumber: text('escrow_number'),
  escrowCompany: text('escrow_company'),
  titleCompany: text('title_company'),
  lenderName: text('lender_name'),
  purchasePrice: integer('purchase_price'),
  openedDate: text('opened_date'),            // ISO date string
  expectedCloseDate: text('expected_close_date'),
  actualCloseDate: text('actual_close_date'),
  notes: text('notes'),
  createdAt: integer('created_at', { mode: 'timestamp' }).defaultNow(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).defaultNow(),
});

export const taskTemplates = sqliteTable('task_templates', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  category: text('category'),          // 'pre-escrow' | 'escrow' | 'closing' | 'post-closing'
  transactionType: text('transaction_type'), // which transaction types this applies to
  relativeDueDays: integer('relative_due_days'), // days from escrow open (or milestone)
  relativeTo: text('relative_to').default('escrow_open'), // 'escrow_open' | 'close_date' | 'inspection_date'
  sortOrder: integer('sort_order'),
  isRequired: integer('is_required', { mode: 'boolean' }).default(true),
});

export const transactionTasks = sqliteTable('transaction_tasks', {
  id: text('id').primaryKey(),
  transactionId: text('transaction_id').references(() => transactions.id),
  templateId: text('template_id').references(() => taskTemplates.id),
  name: text('name').notNull(),           // copied from template, editable
  description: text('description'),
  category: text('category'),
  dueDate: text('due_date'),              // calculated from template + transaction dates
  completedDate: text('completed_date'),
  status: text('status').default('pending'), // 'pending' | 'in_progress' | 'completed' | 'overdue' | 'waived'
  assignedTo: text('assigned_to'),
  notes: text('notes'),
  sortOrder: integer('sort_order'),
  createdAt: integer('created_at', { mode: 'timestamp' }).defaultNow(),
});
```

**Key design decisions:**

- **Task templates are separate from transaction tasks.** When you get the full checklist from the agent, you populate `taskTemplates`. When a new transaction is created, the system stamps out `transactionTasks` from the matching templates, calculating due dates relative to the escrow open date. This is the scaffold — templates can be added/modified later without touching existing transactions.
- **Relative due dates** use a `relativeTo` milestone + `relativeDueDays` offset. This lets you say "inspection contingency removal: 17 days from escrow open" or "final walkthrough: 3 days before close."
- **The two TODO lists** on the dashboard can be views over `transactionTasks`: one for "My Tasks Due This Week" and another for "Overdue / Urgent Tasks." Both are filtered queries, not separate tables.

---

## 12. Rebranding Architecture

```typescript
// components/theme/brand-config.ts

export interface BrandConfig {
  name: string;
  logo: string;           // URL or path to logo
  logoIcon: string;       // Small icon variant
  colors: {
    primary: string;      // HSL value, e.g., "222 47% 31%"
    primaryForeground: string;
    accent: string;
    accentForeground: string;
    // ... all shadcn/ui CSS variable tokens
  };
  borderRadius: string;   // e.g., "0.5rem"
  fontFamily?: string;
}

export const defaultBrand: BrandConfig = {
  name: "Acme Realty",
  logo: "/brands/acme/logo.svg",
  logoIcon: "/brands/acme/icon.svg",
  colors: {
    primary: "222 47% 31%",
    primaryForeground: "210 40% 98%",
    accent: "210 40% 96%",
    accentForeground: "222 47% 11%",
  },
  borderRadius: "0.5rem",
};
```

The `ThemeProvider` reads this config and applies it as CSS variables on `<html>`. To rebrand: swap the config object. This can come from a DB table (per-brokerage), an env variable, or a static file — your call depending on whether this is a multi-tenant SaaS or a single-broker deployment.

---

## 13. Risk Register

| Risk | Mitigation |
|------|------------|
| Turso free tier limits hit early | Monitor usage; $4.99/month Developer tier is the escape hatch |
| Drizzle SQLite → Postgres migration has edge cases | Write queries using Drizzle abstractions only (no raw SQLite functions); test migration early |
| Task checklist changes significantly after scaffolding | Template system is decoupled; templates can be CRUD'd without schema changes |
| Auth complexity grows (roles, permissions) | NextAuth supports custom session callbacks; add RBAC at the middleware layer |
| File storage needed before premium tier | Uploadthing free tier or Cloudflare R2 as stopgap |

---

## Next Steps

1. **Approve this tech stack** — or flag any concerns
2. **Build the Claude Code prompt** — I'll translate this into a detailed, multi-phase prompt that scaffolds the project, sets up theming, creates the DB schema, and builds the dashboard shell
3. **Receive the full task checklist** from the agent — populate the `taskTemplates` table
4. **Iterate on the dashboard UI** — expand transaction detail view, agent grouping, notification system
