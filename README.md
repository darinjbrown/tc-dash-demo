# TC Dashboard

A Transaction Coordinator dashboard for California real estate brokerages. Built as a white-label MVP — rebrand the entire app by changing a single config object.

## Prerequisites

- Node.js 20+
- A [Turso](https://turso.tech) account (free tier is fine)
- Turso CLI (`brew install tursodatabase/tap/turso` on macOS)

## Setup

### 1. Clone and install

```bash
git clone <your-repo-url>
cd tc-dashboard
npm install
```

### 2. Create a Turso database

```bash
turso auth login
turso db create tc-dashboard
turso db show tc-dashboard --url      # copy TURSO_DATABASE_URL
turso db tokens create tc-dashboard   # copy TURSO_AUTH_TOKEN
```

### 3. Configure environment variables

Copy `.env.local.example` to `.env.local` and fill in your values:

```bash
cp .env.local.example .env.local
```

```env
TURSO_DATABASE_URL=libsql://tc-dashboard-your-org.turso.io
TURSO_AUTH_TOKEN=your-token-here
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=generate-with-openssl-rand-base64-32
```

Generate `NEXTAUTH_SECRET`:
```bash
openssl rand -base64 32
```

### 4. Push the schema and seed sample data

```bash
npm run db:push   # push schema to Turso (dev)
npm run db:seed   # seed sample agents, transactions, and task templates
```

The seed creates:
- 1 admin user: `admin@example.com` / `password123`
- 3 sample agents
- 8–10 sample transactions in various statuses
- 38 task templates covering the full CA real estate transaction lifecycle

### 5. Run the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and log in with `admin@example.com` / `password123`.

## Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server with Turbopack |
| `npm run build` | Production build (must pass with zero TS errors) |
| `npm run db:generate` | Generate migrations from schema changes |
| `npm run db:migrate` | Run pending migrations |
| `npm run db:push` | Push schema directly to Turso (dev shortcut) |
| `npm run db:seed` | Seed sample data |
| `npm run db:studio` | Open Drizzle Studio (visual DB browser) |

## How to Rebrand

All visual theming is driven by the `activeBrand` export in `src/lib/brand-config.ts`. Changing this single object rebrands the entire app — colors, border radius, font, and logo — with no page reload required.

```typescript
// src/lib/brand-config.ts

export const activeBrand: BrandConfig = {
  name: 'Your Brokerage Name',
  tagline: 'Tagline here',
  logo: '/brand/logo.svg',       // place your logo in /public/brand/
  logoIcon: '/brand/icon.svg',
  colors: {
    primary: '220 90% 30%',      // HSL values (no hsl() wrapper)
    // ... other color tokens
  },
  borderRadius: '0.5rem',
};
```

You can preview rebranding live from **Settings → Branding** in the app.

## How to Manage Task Templates

Task templates are blueprints that get "stamped" into individual transaction tasks when a new transaction is created. Each template specifies:

- **Category** — which phase of the transaction (Pre-Escrow, Disclosures, Closing, etc.)
- **Transaction Type** — applies to listings, purchases, or both
- **Relative Due Days** — positive = days after the milestone, negative = days before
- **Relative To** — which milestone date to calculate from (Acceptance Date, Escrow Open, Expected Close, etc.)

### Editing templates from the UI

Go to **Settings → Templates** to add, edit, activate, or deactivate templates.

### Editing templates in code

The seed script at `src/db/seed.ts` and the default templates in `src/lib/task-templates.ts` are the source of truth for the initial template set. After editing:

```bash
npm run db:seed   # re-seeds (drops existing data — use only in dev)
```

## Architecture

```
src/
├── app/
│   ├── (auth)/login/         # Login page
│   └── (dashboard)/          # Protected routes (sidebar layout)
│       ├── dashboard/         # Home page: stats, TODO lists, deadlines
│       ├── transactions/      # Transaction list + [id] detail
│       ├── agents/            # Agent management
│       └── settings/          # Profile, templates, branding
├── actions/                  # Server Actions (CRUD) — never throw, return {success}
├── components/
│   ├── ui/                   # shadcn/ui (auto-generated — do not manually edit)
│   ├── agents/               # Agent-specific components
│   ├── dashboard/            # Dashboard widgets
│   ├── layout/               # Sidebar, top bar, mobile nav
│   ├── settings/             # Settings-specific components
│   ├── tasks/                # Task checklist + item + form
│   └── transactions/         # Transaction list, detail, form
├── db/
│   ├── schema.ts             # Drizzle schema — single source of truth
│   ├── client.ts             # Turso connection
│   └── seed.ts               # Sample data + task template scaffolds
└── lib/
    ├── auth.ts               # NextAuth v5 config
    ├── brand-config.ts       # BrandConfig + activeBrand export
    ├── task-stamping.ts      # Task due date calculation logic
    └── transaction-schema.ts # Shared Zod schema (form <-> action)
```

## Key Conventions

- **Money:** Stored as integers (cents) in the DB. Use `formatCurrency()` from `src/lib/utils.ts` for display.
- **Dates:** Stored as ISO strings (`YYYY-MM-DD`) in the DB. Displayed with `date-fns`.
- **Server Actions:** Return `{ success: boolean; data?: T; error?: string }` — never throw.
- **IDs:** Generated with `crypto.randomUUID()`.
- **"use server" files:** May only export async functions and TypeScript types (no Zod schemas or plain objects).

## Deployment

This app is designed to deploy on [Vercel](https://vercel.com):

1. Push to GitHub
2. Import the repo in Vercel
3. Add environment variables (`TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, `NEXTAUTH_URL`, `NEXTAUTH_SECRET`)
4. Deploy

The Turso database is edge-compatible — queries run close to users worldwide.

## Future Roadmap

- OAuth login (Google, GitHub)
- File attachments (Cloudflare R2 or Supabase Storage)
- Email notifications (SendGrid, Resend)
- Multi-brokerage / multi-tenant support
- Branding stored in DB (editable from the Settings UI)
- Role-based access control (agents see only their transactions)
