import Link from 'next/link';
import {
  ListChecks,
  CalendarSync,
  ShieldCheck,
  Building2,
  Check,
  ArrowRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

const MAILTO = 'mailto:info@d20web.com?subject=TC%20Dashboard%20setup';

const STATS = [
  {
    n: '40+',
    t: 'deadline-driven steps in a typical purchase file, from contract to close.',
  },
  { n: 'Dozens', t: 'of files open at once, each on its own clock.' },
  {
    n: 'One',
    t: 'missed contingency or signature is all it takes to put a closing at risk.',
  },
];

const FEATURES = [
  {
    icon: ListChecks,
    kicker: 'Setup in minutes',
    title: 'Start a file, get a full task list',
    body: 'Open a new transaction and the right checklist is stamped in automatically, with every task dated from the contract milestones. No building it by hand each time.',
  },
  {
    icon: CalendarSync,
    kicker: 'Dates that move together',
    title: 'Change one milestone, the rest follow',
    body: 'Push a closing date or a contingency and every dependent due date recalculates. The timeline stays correct without a manual pass.',
  },
  {
    icon: ShieldCheck,
    kicker: 'Role-based access',
    title: 'Agents see only their own deals',
    body: 'Admins and coordinators see the whole office. Each agent sees only the transactions they are on. Access is enforced on the server, not just hidden in the screen.',
  },
  {
    icon: Building2,
    kicker: 'Your office, your brand',
    title: 'Set up for your brokerage',
    body: 'Your logo, your colors, your checklist. The default task set is built for California practice and every task is yours to edit, reorder, or replace to match your state and your process.',
  },
];

const PRICING_POINTS = [
  'Unlimited seats. Every coordinator, agent, and admin included.',
  'No per-user fees and no add-on tiers.',
  'Available nationwide.',
  'We set up your office in under a week.',
  'Month to month. Cancel anytime.',
];

const FAQS = [
  {
    q: "Is each office's data separate?",
    a: 'Yes. Every office is fully isolated. Files, agents, and tasks never cross between offices, and isolation is enforced on the server.',
  },
  {
    q: "Can an agent see another agent's deals?",
    a: 'No. Agents see only the transactions they are on. Admins and coordinators see the full office.',
  },
  {
    q: 'Which states do you support?',
    a: 'Nationwide. The starting checklist is built for California practice, and you can edit every task to fit your state and your workflow.',
  },
  {
    q: 'Do you handle setup?',
    a: 'Yes. Send your logo and a few details and we stand up your office in under a week.',
  },
  {
    q: 'What does it cost as we grow?',
    a: 'Still $49 per month. Seats are unlimited, so adding coordinators or agents never changes the price.',
  },
];

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
      {children}
    </p>
  );
}

export function LandingPage({ isAuthenticated = false }: { isAuthenticated?: boolean }) {
  return (
    <div className="min-h-svh scroll-smooth bg-background text-foreground">
      {/* Nav */}
      <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur supports-backdrop-filter:bg-background/60">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-4">
          <Link href="/" className="text-lg font-semibold tracking-tight">
            TC&nbsp;Dashboard{' '}
            <span className="text-muted-foreground">by d20web</span>
          </Link>
          <div className="flex items-center gap-2">
            {isAuthenticated ? (
              <Button asChild variant="ghost" size="sm">
                <Link href="/dashboard">Go to dashboard</Link>
              </Button>
            ) : (
              <Button asChild variant="ghost" size="sm">
                <Link href="/login">Log in</Link>
              </Button>
            )}
            <Button asChild variant="outline" size="sm">
              <a href={MAILTO}>Book a setup call</a>
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl px-6">
        {/* Hero */}
        <section className="py-20 sm:py-28">
          <Eyebrow>Transaction coordination software</Eyebrow>
          <h1 className="mt-4 max-w-[14ch] text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
            Keep every transaction on track.
          </h1>
          <p className="mt-6 max-w-[54ch] text-lg text-muted-foreground sm:text-xl">
            Set up a new file in minutes. Every task gets a due date tied to the
            contract. Move a milestone and the whole timeline updates. Nothing
            slips, and nobody has to remember it all.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link href="/login">
                See the live demo <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <a href={MAILTO}>Book a setup call</a>
            </Button>
          </div>
          <p className="mt-5 text-sm text-muted-foreground">
            $49 per month, per office. Unlimited seats. Available nationwide.
          </p>
        </section>

        {/* Problem */}
        <section className="border-t py-16">
          <div className="max-w-[60ch]">
            <Eyebrow>The problem</Eyebrow>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
              One missed date can cost the deal.
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              A coordinator runs dozens of open files at once, each with its own
              contingencies, signatures, and hard deadlines. The work is real,
              but the system is usually a spreadsheet and a good memory. That
              holds until it doesn&apos;t.
            </p>
          </div>
          <div className="mt-10 grid gap-px overflow-hidden rounded-lg border bg-border sm:grid-cols-3">
            {STATS.map((s) => (
              <div key={s.n} className="bg-card p-7">
                <div className="text-3xl font-semibold tracking-tight text-primary">
                  {s.n}
                </div>
                <p className="mt-2 text-sm text-muted-foreground">{s.t}</p>
              </div>
            ))}
          </div>
        </section>

        {/* What it does */}
        <section className="border-t py-16">
          <div className="max-w-[60ch]">
            <Eyebrow>What it does</Eyebrow>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
              The system does the remembering.
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              TC Dashboard turns each transaction into a living checklist that
              knows its own dates. You coordinate the work. It keeps the timeline
              honest.
            </p>
          </div>
          <div className="mt-10 grid gap-4 sm:grid-cols-2">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="rounded-xl border bg-card p-7 text-card-foreground shadow-sm"
              >
                <div className="flex size-10 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <f.icon className="size-5" />
                </div>
                <p className="mt-5 text-xs font-semibold uppercase tracking-[0.12em] text-primary">
                  {f.kicker}
                </p>
                <h3 className="mt-2 text-xl font-semibold tracking-tight">
                  {f.title}
                </h3>
                <p className="mt-2 text-muted-foreground">{f.body}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      {/* Demo */}
      <section id="demo" className="scroll-mt-16 border-t bg-muted/40 py-16">
        <div className="mx-auto w-full max-w-5xl px-6">
          <div className="max-w-[60ch]">
            <Eyebrow>See it in action</Eyebrow>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
              Walk through a real file.
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              This is a working office loaded with sample transactions, so you
              can see exactly how a file moves from contract to close. Synthetic
              data, real software.
            </p>
          </div>
          <div className="mt-9 rounded-xl border bg-card p-7 text-card-foreground shadow-sm">
            <div className="flex aspect-video items-center justify-center rounded-md border border-dashed bg-background p-6 text-center">
              <div>
                <span className="block text-xl font-semibold tracking-tight">
                  Live demo walkthrough
                </span>
                <span className="mt-2 block text-sm text-muted-foreground">
                  Drop in the demo video or a link to the running instance here.
                </span>
              </div>
            </div>
            <p className="mt-5 text-sm text-muted-foreground">
              Try it yourself. Sign in to the demo office as{' '}
              <code className="rounded border bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground">
                demo.admin@crestlinerealty.test
              </code>{' '}
              with the password shared on your call, and open any transaction to
              see the dated checklist.
            </p>
            <div className="mt-6">
              <Button asChild>
                <Link href="/login">
                  Get the demo link <ArrowRight className="size-4" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="scroll-mt-16 bg-primary text-primary-foreground">
        <div className="mx-auto w-full max-w-5xl px-6 py-16">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary-foreground/70">
            Pricing
          </p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
            One price. Your whole office.
          </h2>
          <div className="mt-10 grid overflow-hidden rounded-lg border border-primary-foreground/15 md:grid-cols-[1.1fr_1fr]">
            <div className="p-9">
              <div className="text-6xl font-semibold leading-none tracking-tight">
                $49
                <span className="text-xl font-medium text-primary-foreground/60">
                  {' '}
                  / month
                </span>
              </div>
              <p className="mt-3 text-primary-foreground/70">
                per office, billed monthly
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Button asChild size="lg" variant="secondary">
                  <a href={MAILTO}>Book a setup call</a>
                </Button>
                <Button
                  asChild
                  size="lg"
                  variant="outline"
                  className="border-primary-foreground/30 bg-transparent text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground"
                >
                  <Link href="/login">See the demo</Link>
                </Button>
              </div>
            </div>
            <ul className="divide-y divide-primary-foreground/10 border-t border-primary-foreground/15 p-9 pt-0 md:border-l md:border-t-0 md:pt-9">
              {PRICING_POINTS.map((point) => (
                <li key={point} className="flex gap-3 py-3 first:pt-0">
                  <Check className="mt-0.5 size-4 shrink-0 text-primary-foreground" />
                  <span className="text-primary-foreground/90">{point}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <main className="mx-auto w-full max-w-5xl px-6">
        {/* FAQ */}
        <section className="border-t py-16">
          <div className="max-w-[60ch]">
            <Eyebrow>Questions</Eyebrow>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
              Straight answers.
            </h2>
          </div>
          <div className="mt-8">
            {FAQS.map((item) => (
              <div key={item.q} className="border-t py-6 last:border-b">
                <h3 className="text-lg font-semibold tracking-tight">
                  {item.q}
                </h3>
                <p className="mt-2 max-w-[70ch] text-muted-foreground">
                  {item.a}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Final CTA */}
        <section id="book" className="scroll-mt-16 border-t py-20 text-center">
          <Eyebrow>Get started</Eyebrow>
          <h2 className="mx-auto mt-3 max-w-[18ch] text-3xl font-semibold tracking-tight sm:text-4xl lg:text-5xl">
            See your office run on it.
          </h2>
          <p className="mx-auto mt-4 max-w-[50ch] text-lg text-muted-foreground">
            Book a short call. We will show you the demo and have your office set
            up within the week.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button asChild size="lg">
              <a href={MAILTO}>Book a setup call</a>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/login">See the live demo</Link>
            </Button>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t">
        <div className="mx-auto flex w-full max-w-5xl flex-wrap justify-between gap-3 px-6 py-10 text-sm text-muted-foreground">
          <div>TC Dashboard, built by d20web.</div>
          <a href={MAILTO} className="hover:text-foreground">
            info@d20web.com
          </a>
        </div>
      </footer>
    </div>
  );
}
