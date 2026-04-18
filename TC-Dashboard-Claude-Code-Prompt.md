# Claude Code Prompt: Transaction Coordinator Dashboard

## Instructions for Use
Copy everything below the `---` line into Claude Code as your initial prompt. The build is broken into phases — Claude Code will scaffold the project first, then build each layer incrementally. You can run it all at once or phase by phase.

---

## Prompt

You are a staff-level full-stack engineer. Build a Transaction Coordinator (TC) dashboard for a California real estate brokerage. This is an MVP — ship clean, functional code with no premature optimization. Follow every instruction precisely.

### TECH STACK (non-negotiable)

- **Framework:** Next.js 15+ with App Router, TypeScript strict mode, `src/` directory
- **UI:** shadcn/ui (New York style) + Tailwind CSS v4 + Lucide icons
- **Theming:** CSS custom properties with `next-themes` for dark/light mode + a `BrandConfig` system for white-label rebranding
- **Database:** Turso (libSQL, edge SQLite) via `@libsql/client`
- **ORM:** Drizzle ORM with `drizzle-orm/libsql` driver
- **Auth:** NextAuth.js v5 (Auth.js) with Drizzle adapter, credentials provider for MVP (add OAuth later)
- **Client state:** Zustand (only for UI state like sidebar collapse, expanded rows, active filters)
- **Forms:** React Hook Form + Zod for validation
- **Deployment target:** Vercel

### PHASE 1: Project Scaffolding

1. Initialize the project:
```bash
npx create-next-app@latest tc-dashboard --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"
cd tc-dashboard
```

2. Install all dependencies in one command:
```bash
npm install drizzle-orm @libsql/client @auth/core @auth/drizzle-adapter next-auth@beta react-hook-form @hookform/resolvers zod zustand date-fns uuid
npm install -D drizzle-kit @types/uuid
```

3. Initialize shadcn/ui:
```bash
npx shadcn@latest init
```
When prompted, select: New York style, Neutral base color, CSS variables = yes.

4. Add these shadcn/ui components:
```bash
npx shadcn@latest add button card input label badge table dialog sheet tabs collapsible dropdown-menu separator avatar tooltip select textarea checkbox command sidebar sonner calendar popover
```

5. Create the following directory structure:
```
src/
├── app/
│   ├── globals.css              # Theme CSS variables live here
│   ├── layout.tsx               # Root layout with providers
│   ├── page.tsx                 # Redirect to /dashboard
│   ├── (auth)/
│   │   ├── login/
│   │   │   └── page.tsx
│   │   └── layout.tsx
│   ├── (dashboard)/
│   │   ├── layout.tsx           # Sidebar + top bar + main content area
│   │   ├── page.tsx             # Dashboard home: TODO lists + summary stats
│   │   ├── transactions/
│   │   │   ├── page.tsx         # All transactions grouped by agent
│   │   │   └── [id]/
│   │   │       └── page.tsx     # Single transaction detail (expand/edit)
│   │   ├── agents/
│   │   │   └── page.tsx         # Agent management
│   │   └── settings/
│   │       └── page.tsx         # Brand config, task template management
│   └── api/
│       └── auth/
│           └── [...nextauth]/
│               └── route.ts
├── components/
│   ├── ui/                      # shadcn/ui (auto-generated)
│   ├── providers/
│   │   ├── theme-provider.tsx   # next-themes + brand config
│   │   └── session-provider.tsx # NextAuth session
│   ├── layout/
│   │   ├── app-sidebar.tsx      # Main navigation sidebar
│   │   ├── top-bar.tsx          # Brand logo + user menu + search
│   │   └── mobile-nav.tsx
│   ├── dashboard/
│   │   ├── todo-list.tsx        # Reusable TODO list component
│   │   ├── stats-cards.tsx      # Summary stat cards
│   │   ├── upcoming-deadlines.tsx
│   │   └── overdue-tasks.tsx
│   ├── transactions/
│   │   ├── transaction-table.tsx
│   │   ├── transaction-row.tsx
│   │   ├── transaction-detail.tsx    # Expandable detail panel
│   │   ├── transaction-form.tsx      # Create/edit transaction
│   │   └── agent-group.tsx           # Group transactions by agent
│   └── tasks/
│       ├── task-checklist.tsx
│       ├── task-item.tsx
│       └── task-form.tsx
├── db/
│   ├── schema.ts                # Drizzle schema (all tables)
│   ├── client.ts                # Turso connection
│   ├── seed.ts                  # Seed script with sample data
│   └── migrations/
├── lib/
│   ├── auth.ts                  # NextAuth configuration
│   ├── utils.ts                 # shadcn cn() helper (auto-generated)
│   ├── brand-config.ts          # BrandConfig type + defaults
│   └── task-templates.ts        # Default CA real estate task templates
├── hooks/
│   ├── use-brand.ts             # Access brand config from context
│   └── use-ui-store.ts          # Zustand store for UI state
├── actions/
│   ├── transactions.ts          # Server Actions for transaction CRUD
│   ├── tasks.ts                 # Server Actions for task CRUD
│   └── agents.ts                # Server Actions for agent CRUD
└── types/
    └── index.ts                 # Shared types
```

### PHASE 2: Theming + Rebranding System

This is critical. The dashboard must be rebrandable by changing a single config object.

1. **Create `src/lib/brand-config.ts`:**

```typescript
export interface BrandConfig {
  name: string;
  tagline?: string;
  logo: string;             // path to logo image (light mode)
  logoDark?: string;        // path to logo image (dark mode, optional)
  logoIcon: string;         // small square icon for sidebar collapsed state
  colors: {
    background: string;           // HSL values without the hsl() wrapper
    foreground: string;
    card: string;
    cardForeground: string;
    popover: string;
    popoverForeground: string;
    primary: string;
    primaryForeground: string;
    secondary: string;
    secondaryForeground: string;
    muted: string;
    mutedForeground: string;
    accent: string;
    accentForeground: string;
    destructive: string;
    destructiveForeground: string;
    border: string;
    input: string;
    ring: string;
    // Status colors for real estate workflows
    statusPending: string;
    statusActive: string;
    statusClosing: string;
    statusClosed: string;
    statusCancelled: string;
  };
  darkColors?: Partial<BrandConfig['colors']>;  // overrides for dark mode
  borderRadius: string;
  fontFamily?: string;
}

// DEFAULT BRAND — replace this object to rebrand the entire app
export const activeBrand: BrandConfig = {
  name: "TC Dashboard",
  tagline: "Transaction Management",
  logo: "/brand/logo.svg",
  logoIcon: "/brand/icon.svg",
  colors: {
    background: "0 0% 100%",
    foreground: "222.2 84% 4.9%",
    card: "0 0% 100%",
    cardForeground: "222.2 84% 4.9%",
    popover: "0 0% 100%",
    popoverForeground: "222.2 84% 4.9%",
    primary: "222.2 47.4% 31.2%",       // Deep navy — professional RE feel
    primaryForeground: "210 40% 98%",
    secondary: "210 40% 96.1%",
    secondaryForeground: "222.2 47.4% 11.2%",
    muted: "210 40% 96.1%",
    mutedForeground: "215.4 16.3% 46.9%",
    accent: "210 40% 96.1%",
    accentForeground: "222.2 47.4% 11.2%",
    destructive: "0 84.2% 60.2%",
    destructiveForeground: "210 40% 98%",
    border: "214.3 31.8% 91.4%",
    input: "214.3 31.8% 91.4%",
    ring: "222.2 84% 4.9%",
    statusPending: "38 92% 50%",         // Amber
    statusActive: "142 76% 36%",         // Green
    statusClosing: "217 91% 60%",        // Blue
    statusClosed: "142 76% 36%",         // Green
    statusCancelled: "0 84% 60%",        // Red
  },
  borderRadius: "0.5rem",
};
```

2. **Create `src/components/providers/theme-provider.tsx`:**

Build a provider that:
- Wraps `next-themes` ThemeProvider
- Reads `activeBrand` from the config
- Injects all color values as CSS custom properties on the `<html>` element
- Applies dark mode overrides when the theme switches
- Exposes brand config via React context so components can read `brand.name`, `brand.logo`, etc.

3. **In `globals.css`:** Define the CSS variable structure using the shadcn/ui convention (`--background`, `--foreground`, `--primary`, etc.) plus custom status color variables (`--status-pending`, `--status-active`, etc.). The ThemeProvider will override these at runtime.

4. **Test rebranding:** Create a second brand config object with completely different colors. Add a temporary toggle in settings to switch between them. Both should render correctly with no layout breakage.

### PHASE 3: Database Schema + Turso Setup

1. **Create `src/db/client.ts`:**

```typescript
import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import * as schema from './schema';

const client = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

export const db = drizzle(client, { schema });
```

2. **Create `src/db/schema.ts` with these tables:**

**users** (for NextAuth)
- id (text, PK)
- name (text)
- email (text, unique)
- emailVerified (integer, timestamp)
- image (text, nullable)
- hashedPassword (text, nullable — for credentials auth)
- role (text: 'admin' | 'broker' | 'tc' | 'agent', default 'tc')
- createdAt (integer, timestamp)

**accounts, sessions, verificationTokens** — standard NextAuth/Drizzle adapter tables. Follow the Auth.js Drizzle adapter schema exactly.

**agents**
- id (text, PK, UUID)
- name (text, not null)
- email (text, not null)
- phone (text, nullable)
- licenseNumber (text, nullable) — CA DRE license number
- brokerageId (text, nullable)
- isActive (integer, boolean, default true)
- createdAt (integer, timestamp)
- updatedAt (integer, timestamp)

**transactions**
- id (text, PK, UUID)
- address (text, not null)
- city (text)
- state (text, default 'CA')
- zipCode (text)
- mlsNumber (text, nullable)
- agentId (text, FK → agents.id)
- transactionType (text: 'listing' | 'purchase' | 'dual')
- status (text: 'pending' | 'active' | 'in_escrow' | 'closing' | 'closed' | 'cancelled', default 'pending')
- propertyType (text: 'single_family' | 'condo' | 'townhouse' | 'multi_family' | 'land' | 'commercial', nullable)
- escrowNumber (text, nullable)
- escrowCompany (text, nullable)
- escrowOfficer (text, nullable)
- escrowOfficerPhone (text, nullable)
- escrowOfficerEmail (text, nullable)
- titleCompany (text, nullable)
- titleOfficer (text, nullable)
- lenderName (text, nullable)
- loanOfficer (text, nullable)
- loanOfficerPhone (text, nullable)
- loanOfficerEmail (text, nullable)
- buyerName (text, nullable)
- buyerAgent (text, nullable)
- sellerName (text, nullable)
- sellerAgent (text, nullable)
- purchasePrice (integer, nullable) — store in cents
- listPrice (integer, nullable) — store in cents
- earnestMoneyDeposit (integer, nullable) — store in cents
- commissionPercent (text, nullable) — store as string to avoid float issues
- acceptanceDate (text, nullable) — ISO date
- escrowOpenDate (text, nullable)
- inspectionContingencyDate (text, nullable)
- appraisalContingencyDate (text, nullable)
- loanContingencyDate (text, nullable)
- expectedCloseDate (text, nullable)
- actualCloseDate (text, nullable)
- notes (text, nullable)
- createdBy (text, FK → users.id)
- createdAt (integer, timestamp)
- updatedAt (integer, timestamp)

**taskTemplates** — define the standard checklist items. These are NOT tied to a specific transaction. They are blueprints.
- id (text, PK, UUID)
- name (text, not null)
- description (text, nullable)
- category (text: 'pre_escrow' | 'opening' | 'disclosures' | 'inspections' | 'contingencies' | 'loan' | 'appraisal' | 'title' | 'closing' | 'post_closing')
- transactionType (text: 'listing' | 'purchase' | 'both', default 'both')
- relativeDueDays (integer) — positive = days AFTER milestone, negative = days BEFORE milestone
- relativeTo (text: 'acceptance_date' | 'escrow_open' | 'expected_close_date' | 'inspection_contingency_date' | 'appraisal_contingency_date' | 'loan_contingency_date', default 'escrow_open')
- sortOrder (integer)
- isRequired (integer, boolean, default true)
- isActive (integer, boolean, default true)
- createdAt (integer, timestamp)

**transactionTasks** — instances of tasks for a specific transaction, stamped from templates.
- id (text, PK, UUID)
- transactionId (text, FK → transactions.id, not null)
- templateId (text, FK → taskTemplates.id, nullable — null if custom task)
- name (text, not null)
- description (text, nullable)
- category (text)
- dueDate (text, nullable) — calculated ISO date
- completedDate (text, nullable)
- status (text: 'pending' | 'in_progress' | 'completed' | 'overdue' | 'waived' | 'not_applicable', default 'pending')
- assignedTo (text, nullable)
- priority (text: 'low' | 'medium' | 'high' | 'urgent', default 'medium')
- notes (text, nullable)
- sortOrder (integer)
- createdAt (integer, timestamp)
- updatedAt (integer, timestamp)

**activityLog** — audit trail for compliance
- id (text, PK, UUID)
- transactionId (text, FK → transactions.id)
- userId (text, FK → users.id)
- action (text) — 'created' | 'updated' | 'status_changed' | 'task_completed' | 'note_added'
- details (text, nullable) — JSON string with change details
- createdAt (integer, timestamp)

3. **Create `drizzle.config.ts`** at the project root for migrations.

4. **Create `src/db/seed.ts`:**
- Seed 3 sample agents
- Seed 8-10 sample transactions across those agents in various statuses
- Seed a set of PLACEHOLDER task templates (see Phase 4)
- Stamp transaction tasks from those templates for each sample transaction, calculating due dates
- Include a default admin user (email: admin@example.com, password: hashed "password123")

Make the seed script runnable via `npx tsx src/db/seed.ts` and add a `"db:seed"` script to package.json.

### PHASE 4: Scaffold Task Templates

The full task checklist is coming from the agent later. For now, seed these PLACEHOLDER templates that represent a typical California residential purchase transaction. Use realistic category groupings and relative due dates. These will be replaced later.

Seed at least 25-30 tasks across these categories:

**Pre-Escrow / Opening (relative to acceptance_date, days 0-3):**
- Execute purchase agreement
- Open escrow
- Deposit earnest money
- Order title search
- Send transaction welcome packet to all parties

**Disclosures (relative to escrow_open, days 1-7):**
- Send TDS (Transfer Disclosure Statement) to buyer
- Send SPQ (Seller Property Questionnaire)
- Send NHD (Natural Hazard Disclosure) report
- Send preliminary title report to buyer
- Agent visual inspection disclosure (AVID)

**Inspections (relative to escrow_open, days 1-17):**
- Schedule home inspection
- Schedule pest/termite inspection
- Review inspection reports
- Submit repair request (if applicable)
- Negotiate repair credits
- Inspection contingency removal deadline

**Contingencies (relative to various milestone dates):**
- Appraisal contingency removal
- Loan contingency removal
- Review HOA documents (if applicable)

**Loan & Appraisal (relative to escrow_open, days 7-21):**
- Verify buyer pre-approval
- Order appraisal
- Receive appraisal report
- Loan docs to escrow
- Buyer signs loan docs

**Title & Closing (relative to expected_close_date, negative days):**
- Review title commitment
- Clear title exceptions
- Confirm closing date with all parties
- Schedule signing appointment
- Final walkthrough
- Verify funds to close
- Record deed
- Confirm recording
- Distribute closing statement
- Release keys to buyer

**Post-Closing (relative to expected_close_date, days 1-7):**
- Send closing gift
- Request client review/testimonial
- Archive transaction file
- Update MLS status to sold
- Confirm commission disbursement

### PHASE 5: Dashboard Layout + Navigation

Build the `(dashboard)/layout.tsx` using the shadcn/ui sidebar component pattern:

1. **Sidebar (left):**
   - Brand logo at top (reads from `activeBrand.logo`) — collapses to `activeBrand.logoIcon`
   - Navigation items: Dashboard, Transactions, Agents, Settings
   - Each item uses Lucide icons
   - Active route is highlighted
   - Collapsible on desktop, sheet overlay on mobile
   - User avatar + name at bottom with sign-out dropdown

2. **Top bar:**
   - Page title (dynamic based on route)
   - Quick search (Command+K to open command palette — use shadcn Command component)
   - Notification bell icon (placeholder, no functionality yet)
   - Dark/light mode toggle

3. **Main content area:**
   - Scrollable
   - Max width container with responsive padding

### PHASE 6: Dashboard Home Page

`(dashboard)/page.tsx` — this is the TC's daily command center.

**Layout (top to bottom):**

1. **Stats cards row** (4 cards):
   - Active Transactions (count)
   - Tasks Due This Week (count)
   - Overdue Tasks (count, destructive color if > 0)
   - Closing This Month (count)

2. **Two TODO lists side by side** (responsive: stacked on mobile):

   **Left: "Due This Week"**
   - Shows `transactionTasks` where `dueDate` is within the current week and `status` is not 'completed' or 'waived'
   - Each item shows: task name, transaction address (truncated), due date, priority badge
   - Clicking a task opens a sheet/dialog to mark complete, add notes, or snooze
   - Sorted by due date ascending

   **Right: "Overdue & Urgent"**
   - Shows `transactionTasks` where `dueDate` < today and `status` is 'pending' or 'in_progress', OR `priority` = 'urgent'
   - Same item format but with a destructive/red visual treatment
   - Sorted by how many days overdue (most overdue first)

3. **Upcoming Deadlines** (below the TODO lists):
   - A compact timeline/list of the next 10 critical dates across all transactions
   - Shows: date, task name, transaction address, agent name
   - Group by date

### PHASE 7: Transactions Page

`(dashboard)/transactions/page.tsx`

1. **Filter bar at top:**
   - Filter by status (multi-select badges: All, Active, In Escrow, Closing, Closed, Cancelled)
   - Filter by agent (dropdown)
   - Search by address or MLS number
   - "New Transaction" button (opens dialog/sheet with transaction form)

2. **Transaction list grouped by agent:**
   - Section header: Agent name + count of transactions
   - Each section contains a card-based list (not a dense table — more scannable)
   - Each transaction card shows:
     - Address (primary text)
     - Status badge (colored per status)
     - Transaction type badge (listing/purchase/dual)
     - Expected close date
     - Task completion progress (e.g., "12/18 tasks complete" with a mini progress bar)
     - Buyer/seller name
   - Cards are clickable → navigates to `/transactions/[id]`
   - Agent sections are collapsible

3. **Empty state:** Friendly message with CTA to create first transaction

### PHASE 8: Transaction Detail Page

`(dashboard)/transactions/[id]/page.tsx`

This is the core workspace for a TC managing a single transaction.

1. **Header section:**
   - Full address as page title
   - Status badge (editable via dropdown — changing status logs to activityLog)
   - Quick actions: Edit Details, Add Task, Archive
   - Breadcrumb: Dashboard > Transactions > 123 Main St

2. **Tabs (using shadcn Tabs):**

   **Tab 1: Overview**
   - Two-column layout:
     - Left: Key dates (acceptance, escrow open, contingency dates, expected close) — editable inline
     - Right: Contact card grid (agent, escrow officer, title officer, loan officer, buyer, seller) — each with name, phone, email
   - Property details: MLS#, type, price, commission
   - Notes section (textarea, auto-saves)

   **Tab 2: Tasks / Checklist**
   - Full task checklist grouped by category
   - Each task shows: checkbox, name, due date, status badge, assigned to
   - Clicking a task expands it inline to show description, notes, and action buttons
   - Tasks can be: marked complete, marked N/A, snoozed (new due date), reassigned
   - Progress bar at top showing overall completion
   - "Add Custom Task" button

   **Tab 3: Activity Log**
   - Chronological feed of all actions on this transaction
   - Shows: timestamp, user, action description
   - Read-only

3. **Transaction Edit:**
   - All fields from the schema are editable via a form (use React Hook Form + Zod)
   - Can be a sheet/drawer that slides in from the right, or a dialog
   - Save triggers a Server Action that updates the DB and logs the change

### PHASE 9: Agent Management

`(dashboard)/agents/page.tsx`

Simple CRUD page:
- Table of agents: name, email, phone, license number, active status, transaction count
- "Add Agent" button → dialog with form
- Click row to edit
- Soft delete (toggle isActive)

### PHASE 10: Settings Page

`(dashboard)/settings/page.tsx`

Tabs:
1. **Profile** — current user name, email, password change
2. **Task Templates** — CRUD for taskTemplates table. This is where the full checklist from the agent will be managed. Table with: name, category, transaction type, relative due days, relative to, sort order, active toggle. Add/edit via dialog.
3. **Branding** — show current brand config values. For MVP, display-only with a note that branding is configured via the brand config file. (Future: make this editable and store in DB.)

### PHASE 11: Server Actions

Create all CRUD operations as Next.js Server Actions in `src/actions/`:

**transactions.ts:**
- `createTransaction(data)` — validates with Zod, inserts transaction, stamps tasks from templates (calculating due dates), logs creation
- `updateTransaction(id, data)` — validates, updates, logs changes
- `deleteTransaction(id)` — soft delete or archive
- `getTransactions(filters)` — with agent grouping, status filter, search
- `getTransactionById(id)` — with tasks and activity log

**tasks.ts:**
- `updateTaskStatus(id, status)` — mark complete, waive, etc. + log
- `createCustomTask(transactionId, data)` — for ad-hoc tasks not from templates
- `snoozeTask(id, newDueDate)` — reschedule + log
- `getUpcomingTasks(days)` — for the TODO lists
- `getOverdueTasks()` — for the overdue TODO list

**agents.ts:**
- `createAgent(data)`
- `updateAgent(id, data)`
- `toggleAgentActive(id)`
- `getAgents()`

**Task stamping logic** (critical — put this in a utility):
When a transaction is created, iterate over all active `taskTemplates` matching the transaction type. For each template, calculate the due date:
1. Look up the milestone date from the transaction (e.g., `escrowOpenDate`, `expectedCloseDate`)
2. Add `relativeDueDays` to that date
3. If the milestone date is null, leave `dueDate` null (it will be calculated when the date is entered)
4. Create a `transactionTask` record with the calculated date

When a milestone date is updated on a transaction, recalculate due dates for all tasks relative to that milestone.

### PHASE 12: Environment Setup

Create `.env.local.example`:
```
TURSO_DATABASE_URL=libsql://your-db-name-your-org.turso.io
TURSO_AUTH_TOKEN=your-token-here
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=generate-a-random-secret-here
```

Create a `README.md` with:
1. Prerequisites (Node 20+, Turso CLI)
2. Setup steps (clone, install, create Turso DB, copy env, migrate, seed, run)
3. How to rebrand (edit `brand-config.ts`)
4. How to add/modify task templates

Add these scripts to `package.json`:
```json
{
  "db:generate": "drizzle-kit generate",
  "db:migrate": "drizzle-kit migrate",
  "db:push": "drizzle-kit push",
  "db:seed": "npx tsx src/db/seed.ts",
  "db:studio": "drizzle-kit studio"
}
```

### CODING STANDARDS

- Use `"use server"` directive at the top of Server Action files
- Use `"use client"` only when the component needs interactivity (onClick, useState, etc.)
- Prefer Server Components by default — only add "use client" when required
- All money values stored in cents (integer) and formatted for display with a `formatCurrency()` utility
- All dates stored as ISO strings in the DB, displayed using `date-fns` `format()` and `formatDistanceToNow()`
- Use `crypto.randomUUID()` for generating IDs
- Every form uses Zod schemas that match the Drizzle schema types
- Error handling: Server Actions return `{ success: boolean, data?: T, error?: string }` — never throw
- Use `sonner` (shadcn toast) for success/error notifications on mutations
- Responsive: sidebar collapses on mobile, card layouts stack, tables become card lists on small screens
- No `console.log` in committed code — use proper error boundaries

### IMPORTANT CONSTRAINTS

- Do NOT install or use Supabase for anything. That is a future premium option.
- Do NOT build file upload functionality. It is not needed for MVP.
- Do NOT add email/notification sending. Placeholder icons are fine.
- Do NOT over-engineer auth — credentials provider with hashed passwords is sufficient for MVP.
- Do NOT use Redux, TanStack Query, SWR, or any heavy state management. Zustand for UI state only.
- The task template list is a SCAFFOLD. Make it easy to add, remove, and reorder templates via the Settings page. The real checklist is coming later.

### BUILD ORDER

Execute in this order, verifying each phase works before moving on:
1. Scaffold project + install deps + shadcn init
2. Theming system + brand config + providers
3. Database schema + Turso connection + migrations
4. Auth setup + login page
5. Dashboard layout (sidebar + top bar)
6. Seed data + seed script
7. Dashboard home page (stats + TODO lists)
8. Transactions list page (grouped by agent)
9. Transaction detail page (tabs + checklist + edit)
10. Agent management page
11. Settings page (profile + templates + branding)
12. Polish: loading states, error boundaries, empty states, responsive tweaks

After each phase, run `npm run build` to verify no TypeScript errors. Run `npm run dev` and visually verify.
