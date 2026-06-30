'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  ArrowRight,
  Check,
  ListChecks,
  CalendarSync,
  ShieldCheck,
  Columns3,
} from 'lucide-react';
import { KeystoneMark } from '@/components/brand/power-tc-logo';

// ---------------------------------------------------------------------------
// Config — three tweakable values surfaced as props (see design handoff).
// ---------------------------------------------------------------------------
type LandingPageProps = {
  isAuthenticated?: boolean;
  /** Monthly price per office. Single source of truth for every price mention. */
  priceMonthly?: number;
  /** Show the floating "Close date moved" card overlapping the hero mockup. */
  showAutoUpdateCard?: boolean;
  /** Enable the ambient bob/pulse loops (also gated on prefers-reduced-motion). */
  ambientMotion?: boolean;
};

const MAILTO = 'mailto:info@d20web.com?subject=TC%20Dashboard%20setup';

// Real photo lives at /public/marketing/peace-of-mind.png. Set false to fall
// back to the on-brand gradient placeholder.
const HAS_PEACE_PHOTO = true;

// Font stacks driven by the CSS variables set on the marketing route wrapper.
const FONT_DISPLAY = "var(--font-space-grotesk), 'Space Grotesk', sans-serif";
const FONT_BODY =
  "var(--font-hanken), 'Hanken Grotesk', ui-sans-serif, system-ui, sans-serif";
const FONT_MONO = "var(--font-jetbrains-mono), 'JetBrains Mono', monospace";

// ---------------------------------------------------------------------------
// Scoped styles — keyframes, hover states, ::selection and <details> chrome
// that inline styles can't express. Everything is namespaced under .lp-root.
// ---------------------------------------------------------------------------
const SCOPED_CSS = `
html { scroll-behavior: smooth; }
.lp-root { font-family: ${FONT_BODY}; color: #15201B; overflow-x: hidden; }
.lp-root *, .lp-root *::before, .lp-root *::after { box-sizing: border-box; }
.lp-root ::selection { background: #3FE0A0; color: #08231B; }
.lp-root a { color: inherit; text-decoration: none; }
.lp-root details > summary { list-style: none; cursor: pointer; }
.lp-root details > summary::-webkit-details-marker { display: none; }
.lp-root details[open] .lp-faq-marker { transform: rotate(45deg); }

@keyframes lpFloat { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-9px); } }
@keyframes lpPulse { 0%,100% { box-shadow: 0 0 0 0 rgba(63,224,160,.55); } 70% { box-shadow: 0 0 0 7px rgba(63,224,160,0); } }

.lp-cta-primary { transition: transform .14s ease, box-shadow .14s ease; }
.lp-cta-primary:hover { transform: translateY(-2px); }
.lp-cta-primary.lp-shadow-nav { box-shadow: 0 4px 14px rgba(63,224,160,.3); }
.lp-cta-primary.lp-shadow-nav:hover { box-shadow: 0 8px 22px rgba(63,224,160,.45); }
.lp-cta-primary.lp-shadow-md { box-shadow: 0 8px 22px rgba(63,224,160,.3); }
.lp-cta-primary.lp-shadow-md:hover { box-shadow: 0 12px 30px rgba(63,224,160,.45); }
.lp-cta-primary.lp-shadow-final { box-shadow: 0 8px 24px rgba(63,224,160,.32); }
.lp-cta-primary.lp-shadow-final:hover { box-shadow: 0 14px 34px rgba(63,224,160,.48); }

.lp-cta-secondary { transition: background .14s ease, border-color .14s ease; }
.lp-cta-secondary:hover { background: rgba(246,243,234,.07); border-color: rgba(246,243,234,.5); }

.lp-feature-card { transition: border-color .18s ease, transform .18s ease; }
.lp-feature-card:hover { border-color: #3FE0A0; transform: translateY(-3px); }

.lp-navlink { transition: color .25s ease, opacity .14s ease; }
.lp-navlink:hover { opacity: .7; }

.lp-footer-link { transition: color .14s ease; }
.lp-footer-link:hover { color: #3FE0A0; }

.lp-faq-marker { transition: transform .2s ease; }

/* Fail-open: visible by default. JS arms the hidden state, then reveals on
   scroll — so content is never stuck invisible if JS/observer never runs. */
.lp-reveal.lp-armed { opacity: 0; transform: translateY(18px); }
.lp-reveal.lp-armed.is-visible { opacity: 1; transform: none; }

@media (prefers-reduced-motion: reduce) {
  .lp-anim { animation: none !important; }
  html { scroll-behavior: auto; }
}
`;

// ---------------------------------------------------------------------------
// Call-to-action buttons. Renders <Link> for internal routes, <a> for mailto.
// ---------------------------------------------------------------------------
function CtaLink({
  href,
  children,
  style,
  className,
  ...rest
}: {
  href: string;
  children: React.ReactNode;
  style?: React.CSSProperties;
  className?: string;
}) {
  const isInternal = href.startsWith('/');
  if (isInternal) {
    return (
      <Link href={href} style={style} className={className} {...rest}>
        {children}
      </Link>
    );
  }
  return (
    <a href={href} style={style} className={className} {...rest}>
      {children}
    </a>
  );
}

const primaryBase: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 9,
  borderRadius: 10,
  background: '#3FE0A0',
  color: '#08231B',
  fontWeight: 600,
};

const secondaryBase: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 9,
  borderRadius: 10,
  background: 'transparent',
  color: '#F6F3EA',
  fontWeight: 600,
  border: '1px solid rgba(246,243,234,.26)',
};

// ---------------------------------------------------------------------------
// Eyebrow label: mint rule + uppercase tracked text. `tone` flips the color
// for dark vs light surfaces.
// ---------------------------------------------------------------------------
function Eyebrow({
  children,
  tone = 'light',
  center = false,
}: {
  children: React.ReactNode;
  tone?: 'light' | 'dark';
  center?: boolean;
}) {
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 10,
        fontSize: 12,
        fontWeight: 600,
        letterSpacing: '.14em',
        textTransform: 'uppercase',
        color: tone === 'dark' ? '#6FE0B0' : '#1C6B53',
        justifyContent: center ? 'center' : undefined,
      }}
    >
      <span style={{ width: 26, height: 1.5, background: '#3FE0A0', display: 'block' }} />
      {children}
    </div>
  );
}

const h2Style: React.CSSProperties = {
  fontFamily: FONT_DISPLAY,
  fontWeight: 600,
  fontSize: 'clamp(2rem, 3.6vw, 2.9rem)',
  lineHeight: 1.08,
  letterSpacing: '-.022em',
  marginTop: 18,
};

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------
const STATS = [
  { n: '40+', t: 'deadline-driven steps in a typical purchase file, from contract to close.' },
  { n: 'Dozens', t: 'of files open at once, each one running on its own clock.' },
  { n: 'One', t: 'missed contingency or signature is all it takes to put a closing at risk.' },
];

const FEATURES = [
  {
    icon: ListChecks,
    kicker: 'Setup in minutes',
    title: 'Start a file, get a full task list',
    body: 'Open a new transaction and the right checklist is stamped in automatically, every task dated from the contract milestones. No building it by hand each time.',
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
    body: 'Admins and coordinators see the whole office. Each agent sees only the transactions they are on — and access is enforced on the server, not just hidden in the screen.',
  },
  {
    icon: Columns3,
    kicker: 'Your office, your brand',
    title: 'Set up for your brokerage',
    body: 'Your logo, your colors, your checklist. The default task set is built for California practice — and every task is yours to edit, reorder, or replace to match your state and your process.',
  },
];

const PEACE_POINTS = [
  {
    lead: 'Nothing slips quietly.',
    rest: 'Every upcoming and overdue task surfaces on one dashboard.',
  },
  {
    lead: 'One source of truth.',
    rest: 'Coordinators, agents, and admins all see the same live file.',
  },
  {
    lead: 'Handoffs without gaps.',
    rest: 'Anyone can pick up a file and see exactly where it stands.',
  },
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
];

// ---------------------------------------------------------------------------
// Hero product mockup
// ---------------------------------------------------------------------------
function HeroMockup({
  showAutoUpdateCard,
  pulse,
  float,
}: {
  showAutoUpdateCard: boolean;
  pulse: boolean;
  float: boolean;
}) {
  const greenCheck = (
    <svg
      width="11"
      height="11"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#fff"
      strokeWidth="3.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="4 12 9 17 20 6" />
    </svg>
  );

  return (
    <div style={{ flex: '1 1 440px', minWidth: 0, display: 'flex', justifyContent: 'center' }}>
      <div style={{ position: 'relative', width: '100%', maxWidth: 560 }}>
        <div
          style={{
            background: '#fff',
            borderRadius: 16,
            border: '1px solid rgba(255,255,255,.08)',
            boxShadow: '0 36px 80px rgba(0,0,0,.5), 0 10px 28px rgba(0,0,0,.32)',
            overflow: 'hidden',
          }}
        >
          {/* window header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '13px 17px',
              borderBottom: '1px solid #EEE9DB',
              background: '#FBFAF5',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <KeystoneMark variant="light" size={20} />
              <span
                style={{
                  fontFamily: FONT_DISPLAY,
                  fontSize: 13,
                  letterSpacing: '-.018em',
                  lineHeight: 1,
                }}
              >
                <span style={{ fontWeight: 500, color: '#15201B' }}>Power</span>
                <span style={{ fontWeight: 700, color: '#14463A', marginLeft: '0.26em' }}>TC</span>
              </span>
            </div>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 7,
                background: 'rgba(37,180,124,.12)',
                color: '#1B7A55',
                fontSize: 11.5,
                fontWeight: 600,
                padding: '5px 11px',
                borderRadius: 999,
              }}
            >
              <span
                className="lp-anim"
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: '50%',
                  background: '#25B47C',
                  display: 'block',
                  animation: pulse ? 'lpPulse 2.4s ease-in-out infinite' : 'none',
                }}
              />
              On track
            </span>
          </div>

          {/* window body */}
          <div style={{ padding: 18 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                gap: 12,
              }}
            >
              <div>
                <div
                  style={{
                    fontFamily: FONT_DISPLAY,
                    fontWeight: 600,
                    fontSize: 18,
                    color: '#15201B',
                    letterSpacing: '-.01em',
                  }}
                >
                  742 Camino Real
                </div>
                <div style={{ fontSize: 12, color: '#6B7A72', marginTop: 4 }}>
                  Escrow #CR-2048 · Purchase
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div
                  style={{
                    fontFamily: FONT_MONO,
                    fontWeight: 600,
                    fontSize: 14,
                    color: '#15201B',
                  }}
                >
                  $1,240,000
                </div>
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                    marginTop: 5,
                    background: '#FBF1DD',
                    color: '#A9741B',
                    fontSize: 10.5,
                    fontWeight: 600,
                    padding: '3px 8px',
                    borderRadius: 999,
                  }}
                >
                  Closes in 12 days
                </div>
              </div>
            </div>

            {/* milestone timeline */}
            <div style={{ position: 'relative', marginTop: 20, padding: '0 6px' }}>
              <div
                style={{
                  position: 'absolute',
                  top: 9,
                  left: 14,
                  right: 14,
                  height: 2,
                  background: '#E7E1D0',
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  top: 9,
                  left: 14,
                  width: '56%',
                  height: 2,
                  background: '#3FE0A0',
                }}
              />
              <div
                style={{ position: 'relative', display: 'flex', justifyContent: 'space-between' }}
              >
                {['Accept', 'Inspect', 'Appraise'].map((label) => (
                  <div
                    key={label}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    <span
                      style={{
                        width: 20,
                        height: 20,
                        borderRadius: '50%',
                        background: '#25B47C',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {greenCheck}
                    </span>
                    <span style={{ fontSize: 9.5, color: '#7A887F', fontWeight: 500 }}>{label}</span>
                  </div>
                ))}
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <span
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: '50%',
                      background: '#fff',
                      border: '2px solid #3FE0A0',
                      boxShadow: '0 0 0 3px rgba(63,224,160,.18)',
                    }}
                  />
                  <span style={{ fontSize: 9.5, color: '#15201B', fontWeight: 600 }}>Loan</span>
                </div>
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <span
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: '50%',
                      background: '#fff',
                      border: '2px solid #DDD6C5',
                    }}
                  />
                  <span style={{ fontSize: 9.5, color: '#9AA89F', fontWeight: 500 }}>Close</span>
                </div>
              </div>
            </div>

            {/* checklist */}
            <div
              style={{
                marginTop: 20,
                border: '1px solid #EEE9DB',
                borderRadius: 12,
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '11px 14px',
                  background: '#FBFAF5',
                  borderBottom: '1px solid #EEE9DB',
                }}
              >
                <span style={{ fontWeight: 600, fontSize: 12.5, color: '#15201B' }}>
                  Transaction tasks
                </span>
                <span
                  style={{ fontFamily: FONT_MONO, fontSize: 11, color: '#1B7A55', fontWeight: 500 }}
                >
                  8 / 12 done
                </span>
              </div>

              {/* completed rows */}
              {[
                { label: 'Open escrow & confirm acceptance', date: 'Mar 14', top: false },
                { label: 'Appraisal ordered', date: 'Apr 02', top: true },
              ].map((row) => (
                <div
                  key={row.label}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 11,
                    padding: '11px 14px',
                    borderTop: row.top ? '1px solid #F0EBDD' : undefined,
                  }}
                >
                  <span
                    style={{
                      flex: 'none',
                      width: 18,
                      height: 18,
                      borderRadius: 5,
                      background: '#25B47C',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <svg
                      width="11"
                      height="11"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="#fff"
                      strokeWidth="3.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <polyline points="4 12 9 17 20 6" />
                    </svg>
                  </span>
                  <span style={{ flex: 1, fontSize: 13, color: '#8C988F' }}>{row.label}</span>
                  <span style={{ fontFamily: FONT_MONO, fontSize: 11, color: '#9AA89F' }}>
                    {row.date}
                  </span>
                </div>
              ))}

              {/* urgent row */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 11,
                  padding: '11px 14px',
                  borderTop: '1px solid #F0EBDD',
                  background: '#FFFBF2',
                }}
              >
                <span
                  style={{
                    flex: 'none',
                    width: 18,
                    height: 18,
                    borderRadius: 5,
                    background: '#fff',
                    border: '2px solid #E0A23C',
                  }}
                />
                <span style={{ flex: 1, fontSize: 13, color: '#33403A', fontWeight: 500 }}>
                  Remove loan contingency
                </span>
                <span
                  style={{ fontFamily: FONT_MONO, fontSize: 11, color: '#C7872B', fontWeight: 600 }}
                >
                  in 3 days
                </span>
              </div>

              {/* upcoming row */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 11,
                  padding: '11px 14px',
                  borderTop: '1px solid #F0EBDD',
                }}
              >
                <span
                  style={{
                    flex: 'none',
                    width: 18,
                    height: 18,
                    borderRadius: 5,
                    background: '#fff',
                    border: '2px solid #DDD6C5',
                  }}
                />
                <span style={{ flex: 1, fontSize: 13, color: '#33403A' }}>
                  Schedule final walkthrough
                </span>
                <span style={{ fontFamily: FONT_MONO, fontSize: 11, color: '#9AA89F' }}>Apr 22</span>
              </div>
            </div>
          </div>
        </div>

        {/* floating auto-update card */}
        {showAutoUpdateCard && (
          <div
            className="lp-anim"
            style={{
              position: 'absolute',
              left: -18,
              bottom: 42,
              display: 'flex',
              gap: 11,
              alignItems: 'center',
              background: '#0F352B',
              border: '1px solid #1F4A3D',
              borderRadius: 13,
              padding: '12px 15px',
              boxShadow: '0 20px 44px rgba(0,0,0,.45)',
              maxWidth: 236,
              animation: float ? 'lpFloat 6s ease-in-out infinite' : 'none',
            }}
          >
            <span
              style={{
                flex: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 34,
                height: 34,
                borderRadius: 9,
                background: 'rgba(63,224,160,.16)',
              }}
            >
              <CalendarSync size={18} strokeWidth={2} color="#3FE0A0" />
            </span>
            <div>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: '#F6F3EA' }}>
                Close date moved
              </div>
              <div
                style={{ fontSize: 11.5, color: '#9CBBB0', marginTop: 2, lineHeight: 1.35 }}
              >
                6 due dates updated automatically
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export function LandingPage({
  isAuthenticated = false,
  priceMonthly = 49,
  showAutoUpdateCard = true,
  ambientMotion = true,
}: LandingPageProps) {
  const [scrolled, setScrolled] = useState(false);
  const [motionOn, setMotionOn] = useState(false);

  // Sticky-nav color flip on scroll.
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Resolve ambient motion against the user's reduced-motion preference.
  useEffect(() => {
    if (!ambientMotion) {
      setMotionOn(false);
      return;
    }
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const apply = () => setMotionOn(!mq.matches);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [ambientMotion]);

  // Reveal-on-scroll. Fail-open: if the observer can't run, everything is shown.
  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const els = Array.from(document.querySelectorAll<HTMLElement>('.lp-reveal'));
    if (reduce || typeof IntersectionObserver === 'undefined') {
      els.forEach((el) => el.classList.add('is-visible'));
      return;
    }
    els.forEach((el, i) => {
      const d = (i % 5) * 50;
      el.style.transition =
        `opacity .6s cubic-bezier(.22,1,.36,1) ${d}ms, transform .6s cubic-bezier(.22,1,.36,1) ${d}ms`;
      el.classList.add('lp-armed');
    });
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add('is-visible');
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.1, rootMargin: '0px 0px -7% 0px' },
    );
    els.forEach((el) => io.observe(el));
    // Safety net: reveal anything still hidden after 3s.
    const t = setTimeout(() => els.forEach((el) => el.classList.add('is-visible')), 3000);
    return () => {
      io.disconnect();
      clearTimeout(t);
    };
  }, []);

  const navText = scrolled ? '#15201B' : '#F6F3EA';
  const navMuted = scrolled ? '#5C6B64' : 'rgba(246,243,234,0.82)';
  const price = priceMonthly;

  return (
    <div className="lp-root">
      <style dangerouslySetInnerHTML={{ __html: SCOPED_CSS }} />

      {/* ============ NAV ============ */}
      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 50,
          borderBottom: `1px solid ${scrolled ? '#E6E0D0' : 'transparent'}`,
          background: scrolled ? 'rgba(246,243,234,0.85)' : 'transparent',
          backdropFilter: scrolled ? 'blur(12px)' : undefined,
          WebkitBackdropFilter: scrolled ? 'blur(12px)' : undefined,
          boxShadow: scrolled ? '0 1px 0 rgba(11,11,13,0.04)' : 'none',
          transition: 'background .25s ease, border-color .25s ease, box-shadow .25s ease',
        }}
      >
        <div
          style={{
            maxWidth: 1180,
            margin: '0 auto',
            padding: '16px 28px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 24,
          }}
        >
          <Link
            href="/"
            aria-label="Power TC"
            style={{ display: 'flex', alignItems: 'center', gap: 11 }}
          >
            <KeystoneMark variant={scrolled ? 'light' : 'dark'} size={34} />
            <span
              style={{
                fontFamily: FONT_DISPLAY,
                fontSize: 18,
                letterSpacing: '-.018em',
                lineHeight: 1,
                whiteSpace: 'nowrap',
                transition: 'color .25s ease',
              }}
            >
              <span style={{ fontWeight: 500, color: navText }}>Power</span>
              <span
                style={{
                  fontWeight: 700,
                  color: scrolled ? '#14463A' : '#3FE0A0',
                  marginLeft: '0.28em',
                }}
              >
                TC
              </span>
            </span>
          </Link>
          <nav style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            {[
              { label: 'Features', href: '#features' },
              { label: 'Pricing', href: '#pricing' },
              { label: 'FAQ', href: '#faq' },
            ].map((l) => (
              <a
                key={l.href}
                href={l.href}
                className="lp-navlink"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  color: navMuted,
                  fontSize: 14.5,
                  fontWeight: 500,
                  padding: '8px 14px',
                }}
              >
                {l.label}
              </a>
            ))}
            <Link
              href={isAuthenticated ? '/dashboard' : '/login'}
              className="lp-navlink"
              style={{ color: navText, fontSize: 14.5, fontWeight: 600, padding: '9px 16px' }}
            >
              {isAuthenticated ? 'Go to dashboard' : 'Log in'}
            </Link>
            <a
              href={MAILTO}
              className="lp-cta-primary lp-shadow-nav"
              style={{ ...primaryBase, gap: 7, fontSize: 14.5, padding: '10px 18px', borderRadius: 9 }}
            >
              Book a setup call
            </a>
          </nav>
        </div>
      </header>

      {/* ============ HERO ============ */}
      <section
        id="top"
        style={{ position: 'relative', background: '#0A2620', overflow: 'hidden', marginTop: -74 }}
      >
        <div
          style={{
            position: 'absolute',
            top: -180,
            right: -120,
            width: 620,
            height: 620,
            background:
              'radial-gradient(circle at center, rgba(63,224,160,.18), rgba(63,224,160,0) 62%)',
            pointerEvents: 'none',
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: -160,
            left: -140,
            width: 520,
            height: 520,
            background:
              'radial-gradient(circle at center, rgba(28,107,83,.5), rgba(10,38,32,0) 65%)',
            pointerEvents: 'none',
          }}
        />
        <div
          style={{
            position: 'relative',
            maxWidth: 1180,
            margin: '0 auto',
            padding: 'calc(74px + clamp(40px,6vw,76px)) 28px clamp(72px,9vw,108px)',
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: 'clamp(40px,5vw,72px)',
          }}
        >
          {/* hero copy */}
          <div style={{ flex: '1 1 430px', minWidth: 0 }}>
            <Eyebrow tone="dark">Transaction coordination software</Eyebrow>
            <h1
              style={{
                fontFamily: FONT_DISPLAY,
                fontWeight: 600,
                fontSize: 'clamp(2.6rem,5.4vw,4.3rem)',
                lineHeight: 1.04,
                letterSpacing: '-.025em',
                color: '#F6F3EA',
                marginTop: 22,
                maxWidth: '14ch',
              }}
            >
              Keep every transaction <span style={{ color: '#3FE0A0' }}>on track.</span>
            </h1>
            <p
              style={{
                fontSize: 'clamp(17px,1.4vw,19.5px)',
                lineHeight: 1.6,
                color: '#AFCBC0',
                marginTop: 24,
                maxWidth: '52ch',
              }}
            >
              Set up a new file in minutes. Every task gets a due date tied to the contract — move
              one milestone and the whole timeline updates. Nothing slips, and nobody has to hold it
              all in their head.
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 13, marginTop: 34 }}>
              <CtaLink
                href="/login"
                className="lp-cta-primary lp-shadow-md"
                style={{ ...primaryBase, padding: '15px 24px', fontSize: 15.5 }}
              >
                See the live demo
                <ArrowRight size={18} strokeWidth={2.2} color="#08231B" />
              </CtaLink>
              <a
                href={MAILTO}
                className="lp-cta-secondary"
                style={{ ...secondaryBase, padding: '15px 24px', fontSize: 15.5 }}
              >
                Book a setup call
              </a>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px 22px', marginTop: 30 }}>
              {['Auto-dated checklists', 'Dates recalculate', 'Role-based access'].map((chip) => (
                <span
                  key={chip}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    fontSize: 13.5,
                    color: '#9CBBB0',
                  }}
                >
                  <Check size={16} strokeWidth={2.4} color="#3FE0A0" />
                  {chip}
                </span>
              ))}
            </div>
            <p
              style={{
                fontFamily: FONT_MONO,
                fontSize: 12.5,
                color: '#7FA499',
                marginTop: 26,
                letterSpacing: '.01em',
              }}
            >
              ${price}/mo per office · Unlimited seats · Nationwide
            </p>
          </div>

          {/* hero product mockup */}
          <HeroMockup
            showAutoUpdateCard={showAutoUpdateCard}
            pulse={motionOn}
            float={motionOn}
          />
        </div>
      </section>

      {/* ============ PROBLEM / STATS ============ */}
      <section style={{ background: '#F6F3EA', padding: 'clamp(64px,9vw,116px) 0' }}>
        <div style={{ maxWidth: 1180, margin: '0 auto', padding: '0 28px' }}>
          <div className="lp-reveal" style={{ maxWidth: '62ch' }}>
            <Eyebrow>The problem</Eyebrow>
            <h2 style={{ ...h2Style, color: '#15201B' }}>One missed date can cost the deal.</h2>
            <p
              style={{
                fontSize: 'clamp(17px,1.3vw,19px)',
                lineHeight: 1.6,
                color: '#5C6B64',
                marginTop: 18,
              }}
            >
              A coordinator runs dozens of open files at once, each with its own contingencies,
              signatures, and hard deadlines. The work is real — but the system is usually a
              spreadsheet and a good memory. That holds, until it doesn&apos;t.
            </p>
          </div>
          <div
            className="lp-reveal"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))',
              gap: 18,
              marginTop: 48,
            }}
          >
            {STATS.map((s) => (
              <div
                key={s.n}
                style={{
                  background: '#fff',
                  border: '1px solid #E8E2D4',
                  borderRadius: 14,
                  padding: 30,
                }}
              >
                <div
                  style={{
                    fontFamily: FONT_DISPLAY,
                    fontWeight: 600,
                    fontSize: 46,
                    lineHeight: 1,
                    letterSpacing: '-.02em',
                    color: '#14463A',
                  }}
                >
                  {s.n}
                </div>
                <p
                  style={{ fontSize: 14.5, lineHeight: 1.55, color: '#5C6B64', marginTop: 14 }}
                >
                  {s.t}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============ FEATURES ============ */}
      <section
        id="features"
        style={{
          background: '#FFFFFF',
          borderTop: '1px solid #ECE6D7',
          padding: 'clamp(64px,9vw,116px) 0',
          scrollMarginTop: 80,
        }}
      >
        <div style={{ maxWidth: 1180, margin: '0 auto', padding: '0 28px' }}>
          <div className="lp-reveal" style={{ maxWidth: '62ch' }}>
            <Eyebrow>What it does</Eyebrow>
            <h2 style={{ ...h2Style, color: '#15201B' }}>The system does the remembering.</h2>
            <p
              style={{
                fontSize: 'clamp(17px,1.3vw,19px)',
                lineHeight: 1.6,
                color: '#5C6B64',
                marginTop: 18,
              }}
            >
              Power TC turns each transaction into a living checklist that knows its own dates.
              You coordinate the work. It keeps the timeline honest.
            </p>
          </div>
          <div
            className="lp-reveal"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))',
              gap: 18,
              marginTop: 48,
            }}
          >
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="lp-feature-card"
                style={{
                  background: '#FBFAF5',
                  border: '1px solid #ECE6D7',
                  borderRadius: 16,
                  padding: 30,
                }}
              >
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 46,
                    height: 46,
                    borderRadius: 11,
                    background: '#E7F7EE',
                    color: '#14463A',
                  }}
                >
                  <f.icon size={24} strokeWidth={1.7} />
                </span>
                <p
                  style={{
                    fontSize: 11.5,
                    fontWeight: 600,
                    letterSpacing: '.12em',
                    textTransform: 'uppercase',
                    color: '#1C6B53',
                    marginTop: 22,
                  }}
                >
                  {f.kicker}
                </p>
                <h3
                  style={{
                    fontFamily: FONT_DISPLAY,
                    fontWeight: 600,
                    fontSize: 20,
                    letterSpacing: '-.01em',
                    color: '#15201B',
                    marginTop: 9,
                  }}
                >
                  {f.title}
                </h3>
                <p
                  style={{ fontSize: 15, lineHeight: 1.6, color: '#5C6B64', marginTop: 10 }}
                >
                  {f.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============ PEACE OF MIND BAND ============ */}
      <section
        style={{
          background: '#F6F3EA',
          borderTop: '1px solid #ECE6D7',
          padding: 'clamp(64px,9vw,116px) 0',
        }}
      >
        <div
          style={{
            maxWidth: 1180,
            margin: '0 auto',
            padding: '0 28px',
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: 'clamp(36px,5vw,68px)',
          }}
        >
          <div className="lp-reveal" style={{ flex: '1 1 360px', minWidth: 0 }}>
            {/* Peace-of-mind visual. Real photo at
                /public/marketing/peace-of-mind.png; the gradient block is the
                fallback when HAS_PEACE_PHOTO is false. */}
            {HAS_PEACE_PHOTO ? (
              <div
                style={{
                  position: 'relative',
                  width: '100%',
                  aspectRatio: '4 / 3',
                  borderRadius: 16,
                  overflow: 'hidden',
                  boxShadow: '0 20px 50px rgba(11,11,13,.12)',
                }}
              >
                <Image
                  src="/marketing/peace-of-mind.png"
                  alt="A transaction status board with every deal in the closed column"
                  fill
                  sizes="(max-width: 720px) 100vw, 460px"
                  style={{ objectFit: 'cover' }}
                />
              </div>
            ) : (
              <div
                aria-hidden="true"
                style={{
                  position: 'relative',
                  width: '100%',
                  aspectRatio: '4 / 3',
                  borderRadius: 16,
                  overflow: 'hidden',
                  boxShadow: '0 20px 50px rgba(11,11,13,.12)',
                  background:
                    'radial-gradient(120% 90% at 78% 14%, rgba(255,229,168,.95) 0%, rgba(245,200,140,.9) 18%, rgba(180,150,120,0) 46%), linear-gradient(160deg, #163A2F 0%, #1C6B53 52%, #2A8C68 100%)',
                }}
              >
                {/* warm sun glow + a faint on-track route motif */}
                <svg
                  viewBox="0 0 400 300"
                  preserveAspectRatio="xMidYMid slice"
                  style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
                >
                  <circle cx="312" cy="58" r="40" fill="rgba(255,236,189,.55)" />
                  <polyline
                    points="36 232 132 168 196 198 360 92"
                    fill="none"
                    stroke="rgba(63,224,160,.7)"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <circle cx="360" cy="92" r="5.5" fill="#3FE0A0" />
                </svg>
              </div>
            )}
          </div>
          <div className="lp-reveal" style={{ flex: '1 1 380px', minWidth: 0 }}>
            <Eyebrow>Peace of mind</Eyebrow>
            <h2
              style={{
                ...h2Style,
                fontSize: 'clamp(2rem,3.4vw,2.7rem)',
                lineHeight: 1.1,
                color: '#15201B',
              }}
            >
              Walk into every closing knowing it&apos;s handled.
            </h2>
            <p
              style={{
                fontSize: 'clamp(16px,1.25vw,18.5px)',
                lineHeight: 1.6,
                color: '#5C6B64',
                marginTop: 18,
                maxWidth: '50ch',
              }}
            >
              When the timeline is always correct and every task carries its own deadline, the
              anxious part of the job quiets down. You stop chasing dates and start running a calm,
              predictable office.
            </p>
            <div
              style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 26 }}
            >
              {PEACE_POINTS.map((p) => (
                <div key={p.lead} style={{ display: 'flex', alignItems: 'flex-start', gap: 11 }}>
                  <span
                    style={{
                      flex: 'none',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: 24,
                      height: 24,
                      borderRadius: 7,
                      background: '#E7F7EE',
                      marginTop: 1,
                    }}
                  >
                    <Check size={14} strokeWidth={2.6} color="#14463A" />
                  </span>
                  <span style={{ fontSize: 15.5, lineHeight: 1.5, color: '#33403A' }}>
                    <strong style={{ color: '#15201B', fontWeight: 600 }}>{p.lead}</strong> {p.rest}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ============ DEMO ============ */}
      <section
        style={{
          position: 'relative',
          background: '#0A2620',
          overflow: 'hidden',
          padding: 'clamp(64px,9vw,112px) 0',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: -140,
            left: '50%',
            transform: 'translateX(-50%)',
            width: 680,
            height: 480,
            background:
              'radial-gradient(circle at center, rgba(63,224,160,.13), rgba(10,38,32,0) 65%)',
            pointerEvents: 'none',
          }}
        />
        <div
          className="lp-reveal"
          style={{
            position: 'relative',
            maxWidth: 760,
            margin: '0 auto',
            padding: '0 28px',
            textAlign: 'center',
          }}
        >
          <Eyebrow tone="dark" center>
            See it in action
          </Eyebrow>
          <h2 style={{ ...h2Style, color: '#F6F3EA' }}>Walk through a real file.</h2>
          <p
            style={{
              fontSize: 'clamp(16px,1.3vw,18.5px)',
              lineHeight: 1.6,
              color: '#AFCBC0',
              marginTop: 18,
              maxWidth: '56ch',
              marginLeft: 'auto',
              marginRight: 'auto',
            }}
          >
            A working office loaded with sample transactions, so you can see exactly how a file moves
            from contract to close. Synthetic data, real software.
          </p>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 10,
              marginTop: 26,
              background: '#0F352B',
              border: '1px solid #1F4A3D',
              borderRadius: 10,
              padding: '11px 16px',
              flexWrap: 'wrap',
              justifyContent: 'center',
            }}
          >
            <span style={{ fontSize: 12.5, color: '#9CBBB0' }}>Sign in to the demo office as</span>
            <code
              style={{
                fontFamily: FONT_MONO,
                fontSize: 12,
                color: '#3FE0A0',
                background: 'rgba(63,224,160,.1)',
                padding: '4px 9px',
                borderRadius: 6,
              }}
            >
              demo.admin@crestlinerealty.test
            </code>
          </div>
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              justifyContent: 'center',
              gap: 13,
              marginTop: 30,
            }}
          >
            <CtaLink
              href="/login"
              className="lp-cta-primary lp-shadow-md"
              style={{ ...primaryBase, padding: '15px 24px', fontSize: 15.5 }}
            >
              Open the live demo
              <ArrowRight size={18} strokeWidth={2.2} color="#08231B" />
            </CtaLink>
            <a
              href={MAILTO}
              className="lp-cta-secondary"
              style={{ ...secondaryBase, padding: '15px 24px', fontSize: 15.5 }}
            >
              Get a guided tour
            </a>
          </div>
        </div>
      </section>

      {/* ============ PRICING ============ */}
      <section
        id="pricing"
        style={{
          background: '#F6F3EA',
          padding: 'clamp(64px,9vw,116px) 0',
          scrollMarginTop: 80,
        }}
      >
        <div style={{ maxWidth: 1180, margin: '0 auto', padding: '0 28px' }}>
          <div
            className="lp-reveal"
            style={{ textAlign: 'center', maxWidth: '60ch', margin: '0 auto' }}
          >
            <Eyebrow center>Pricing</Eyebrow>
            <h2 style={{ ...h2Style, color: '#15201B' }}>One price. Your whole office.</h2>
          </div>
          <div
            className="lp-reveal"
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              maxWidth: 900,
              margin: '44px auto 0',
              borderRadius: 18,
              overflow: 'hidden',
              border: '1px solid #E3DCCC',
              boxShadow: '0 24px 60px rgba(11,11,13,.08)',
              background: '#fff',
            }}
          >
            <div
              style={{
                flex: '1 1 320px',
                background: '#0A2620',
                padding: 'clamp(32px,4vw,46px)',
                color: '#F6F3EA',
              }}
            >
              <p
                style={{
                  fontSize: 11.5,
                  fontWeight: 600,
                  letterSpacing: '.12em',
                  textTransform: 'uppercase',
                  color: '#6FE0B0',
                }}
              >
                Simple, flat pricing
              </p>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, marginTop: 18 }}>
                <span
                  style={{
                    fontFamily: FONT_DISPLAY,
                    fontWeight: 600,
                    fontSize: 'clamp(56px,8vw,76px)',
                    lineHeight: 0.9,
                    letterSpacing: '-.03em',
                    color: '#F6F3EA',
                  }}
                >
                  ${price}
                </span>
                <span style={{ fontSize: 17, color: '#9CBBB0', marginBottom: 10 }}>/ month</span>
              </div>
              <p style={{ fontSize: 14.5, color: '#9CBBB0', marginTop: 14 }}>
                per office, billed monthly
              </p>
              <div
                style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 30 }}
              >
                <a
                  href={MAILTO}
                  className="lp-cta-primary lp-shadow-md"
                  style={{ ...primaryBase, padding: '15px 22px', fontSize: 15.5 }}
                >
                  Book a setup call
                </a>
                <CtaLink
                  href="/login"
                  className="lp-cta-secondary"
                  style={{ ...secondaryBase, padding: '15px 22px', fontSize: 15.5 }}
                >
                  See the demo
                </CtaLink>
              </div>
            </div>
            <div
              style={{
                flex: '1 1 320px',
                padding: 'clamp(32px,4vw,46px)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
              }}
            >
              {[
                'Unlimited seats — every coordinator, agent, and admin included.',
                'No per-user fees and no add-on tiers.',
                'Available nationwide.',
                'We set up your office in under a week.',
                'Month to month. Cancel anytime.',
              ].map((point, i, arr) => (
                <div
                  key={point}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 12,
                    padding: '13px 0',
                    borderBottom: i < arr.length - 1 ? '1px solid #EDE8DA' : undefined,
                  }}
                >
                  <Check
                    size={20}
                    strokeWidth={2.4}
                    color="#1C6B53"
                    style={{ flex: 'none', marginTop: 1 }}
                  />
                  <span style={{ fontSize: 15.5, lineHeight: 1.5, color: '#33403A' }}>{point}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ============ FAQ ============ */}
      <section
        id="faq"
        style={{
          background: '#FFFFFF',
          borderTop: '1px solid #ECE6D7',
          padding: 'clamp(64px,9vw,116px) 0',
          scrollMarginTop: 80,
        }}
      >
        <div style={{ maxWidth: 820, margin: '0 auto', padding: '0 28px' }}>
          <div className="lp-reveal">
            <Eyebrow>Questions</Eyebrow>
            <h2 style={{ ...h2Style, color: '#15201B' }}>Straight answers.</h2>
          </div>
          <div className="lp-reveal" style={{ marginTop: 34 }}>
            {FAQS.map((item, i) => (
              <details
                key={item.q}
                style={{
                  borderTop: '1px solid #ECE6D7',
                  borderBottom: i === FAQS.length - 1 ? '1px solid #ECE6D7' : undefined,
                }}
              >
                <summary
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 16,
                    padding: '22px 0',
                    fontFamily: FONT_DISPLAY,
                    fontWeight: 500,
                    fontSize: 18,
                    color: '#15201B',
                  }}
                >
                  {item.q}
                  <span
                    className="lp-faq-marker"
                    style={{ flex: 'none', color: '#3FE0A0', fontSize: 22, lineHeight: 1 }}
                  >
                    +
                  </span>
                </summary>
                <p
                  style={{
                    fontSize: 15.5,
                    lineHeight: 1.6,
                    color: '#5C6B64',
                    paddingBottom: 22,
                    maxWidth: '68ch',
                  }}
                >
                  {item.a}
                </p>
              </details>
            ))}
            <details style={{ borderBottom: '1px solid #ECE6D7' }}>
              <summary
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 16,
                  padding: '22px 0',
                  fontFamily: FONT_DISPLAY,
                  fontWeight: 500,
                  fontSize: 18,
                  color: '#15201B',
                }}
              >
                What does it cost as we grow?
                <span
                  className="lp-faq-marker"
                  style={{ flex: 'none', color: '#3FE0A0', fontSize: 22, lineHeight: 1 }}
                >
                  +
                </span>
              </summary>
              <p
                style={{
                  fontSize: 15.5,
                  lineHeight: 1.6,
                  color: '#5C6B64',
                  paddingBottom: 22,
                  maxWidth: '68ch',
                }}
              >
                Still ${price} per month. Seats are unlimited, so adding coordinators or agents never
                changes the price.
              </p>
            </details>
          </div>
        </div>
      </section>

      {/* ============ FINAL CTA + FOOTER ============ */}
      <section style={{ position: 'relative', background: '#0A2620', overflow: 'hidden' }}>
        <div
          style={{
            position: 'absolute',
            top: -160,
            right: -100,
            width: 560,
            height: 560,
            background:
              'radial-gradient(circle at center, rgba(63,224,160,.14), rgba(10,38,32,0) 64%)',
            pointerEvents: 'none',
          }}
        />
        <div
          className="lp-reveal"
          style={{
            position: 'relative',
            maxWidth: 1180,
            margin: '0 auto',
            padding: 'clamp(72px,10vw,128px) 28px',
            textAlign: 'center',
          }}
        >
          <Eyebrow tone="dark" center>
            Get started
          </Eyebrow>
          <h2
            style={{
              fontFamily: FONT_DISPLAY,
              fontWeight: 600,
              fontSize: 'clamp(2.2rem,4.4vw,3.6rem)',
              lineHeight: 1.05,
              letterSpacing: '-.025em',
              color: '#F6F3EA',
              margin: '18px auto 0',
              maxWidth: '18ch',
            }}
          >
            See your office run on it.
          </h2>
          <p
            style={{
              fontSize: 'clamp(16px,1.3vw,18.5px)',
              lineHeight: 1.6,
              color: '#AFCBC0',
              margin: '18px auto 0',
              maxWidth: '50ch',
            }}
          >
            Book a short call. We&apos;ll show you the demo and have your office set up within the
            week.
          </p>
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              justifyContent: 'center',
              gap: 13,
              marginTop: 32,
            }}
          >
            <a
              href={MAILTO}
              className="lp-cta-primary lp-shadow-final"
              style={{ ...primaryBase, padding: '16px 26px', fontSize: 16 }}
            >
              Book a setup call
              <ArrowRight size={18} strokeWidth={2.2} color="#08231B" />
            </a>
            <CtaLink
              href="/login"
              className="lp-cta-secondary"
              style={{ ...secondaryBase, padding: '16px 26px', fontSize: 16 }}
            >
              See the live demo
            </CtaLink>
          </div>
        </div>

        {/* footer bar */}
        <div style={{ position: 'relative', borderTop: '1px solid #163A2F' }}>
          <div
            style={{
              maxWidth: 1180,
              margin: '0 auto',
              padding: 28,
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 16,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
              <KeystoneMark variant="dark" size={28} />
              <span style={{ fontSize: 13.5, color: '#9CBBB0' }}>
                <span style={{ fontFamily: FONT_DISPLAY, letterSpacing: '-.018em' }}>
                  <span style={{ fontWeight: 500, color: '#F6F3EA' }}>Power</span>
                  <span style={{ fontWeight: 700, color: '#3FE0A0', marginLeft: '0.26em' }}>
                    TC
                  </span>
                </span>
                {' — real estate transaction coordination.'}
              </span>
            </div>
            <a href={MAILTO} className="lp-footer-link" style={{ fontSize: 13.5, color: '#9CBBB0' }}>
              info@d20web.com
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
