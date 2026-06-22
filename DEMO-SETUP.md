# TC Dashboard — Demo Setup (Crestline Realty)

This is a **standalone product-demo** instance of the TC Dashboard, used for the
$49/mo sales walkthrough and screen recordings. The active brand is the
**fictional "Crestline Realty"** brokerage, and all data produced by the demo
seed is **synthetic** — fictional people, addresses, license numbers, and escrow
numbers. **Never present this instance as a real customer or testimonial.**

> **Isolation requirement:** This repo must use its **own** Turso database and its
> **own** Vercel project. Do **not** point it at the production (Bertolone)
> database or deploy it over the production project. The whole point of this fork
> is that the demo can never collide with the real client instance.

---

## 1. Provision a NEW, separate Turso demo database

Create a brand-new database (do not reuse the production one):

```bash
turso db create tc-dash-demo
turso db show tc-dash-demo --url          # -> TURSO_DATABASE_URL
turso db tokens create tc-dash-demo       # -> TURSO_AUTH_TOKEN
```

## 2. Configure local environment

Copy the template and fill in the **new demo** DB credentials plus a fresh secret.
`.env.local` is gitignored and must never be committed.

```bash
cp .env.local.example .env.local
```

Then edit `.env.local`:

```
TURSO_DATABASE_URL=libsql://tc-dash-demo-<your-org>.turso.io   # the NEW demo DB
TURSO_AUTH_TOKEN=<token from step 1>
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=<fresh random secret>
```

Generate a fresh secret (do not reuse the production secret):

```bash
openssl rand -base64 32
```

## 3. Install, migrate, seed, run

```bash
npm install
npm run db:migrate        # apply schema to the new demo DB (or: npm run db:push for dev)
npm run db:demo-seed      # load the Crestline Realty synthetic demo data (~12 transactions)
npm run dev               # http://localhost:3000
```

### Demo logins (from the seed script)

- **Admin:** `demo.admin@crestlinerealty.test` / `demo1234`
- **TC:** `priya.nair@crestlinerealty.test` / `demo1234`
- Agent-role logins also exist so the RBAC agent-scoped view can be demonstrated.

> `db:demo-seed` **clears all existing rows first**, then loads the demo data.
> Only ever run it against the demo database.

## 4. Deploy to a SEPARATE Vercel project

1. Create a **new** Vercel project pointed at this repo
   (`github.com/darinjbrown/tc-dash-demo`) — not the production project.
2. Set the same four environment variables in the Vercel project settings, using
   the **demo** Turso DB credentials and the fresh `NEXTAUTH_SECRET`. Set
   `NEXTAUTH_URL` to the Vercel deployment URL.
3. Deploy. After the first deploy, run the migrate + demo-seed against the demo DB
   (locally with the demo creds, or via a one-off script) so the hosted demo has data.

Keep this project's environment variables, database, and domain entirely separate
from the production (Bertolone) deployment.
