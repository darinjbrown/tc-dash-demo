import Link from 'next/link';
import { powerTcFontVars } from '@/lib/power-tc-fonts';
import { PowerTcLogo } from '@/components/brand/power-tc-logo';

const FONT_DISPLAY = "var(--font-space-grotesk), 'Space Grotesk', sans-serif";
const FONT_BODY =
  "var(--font-hanken), 'Hanken Grotesk', ui-sans-serif, system-ui, sans-serif";

// Platform console shell — branded Power TC (the platform/product), since this
// is the cross-tenant d20web surface, not a tenant office.
export default function PlatformLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={powerTcFontVars}
      style={{
        minHeight: '100svh',
        background: '#F6F3EA',
        fontFamily: FONT_BODY,
        color: '#15201B',
      }}
    >
      <header style={{ background: '#0A2620', borderBottom: '1px solid #163A2F' }}>
        <div
          style={{
            maxWidth: 1180,
            margin: '0 auto',
            padding: '0 28px',
            height: 64,
            display: 'flex',
            alignItems: 'center',
            gap: 14,
          }}
        >
          <Link href="/" aria-label="Power TC home" style={{ display: 'inline-flex' }}>
            <PowerTcLogo variant="dark" markSize={30} gap={10} />
          </Link>
          <span style={{ width: 1, height: 22, background: '#1F4A3D' }} aria-hidden="true" />
          <span
            style={{
              fontFamily: FONT_DISPLAY,
              fontSize: 13,
              fontWeight: 500,
              letterSpacing: '.1em',
              textTransform: 'uppercase',
              color: '#6FE0B0',
            }}
          >
            Platform console
          </span>
        </div>
      </header>
      <main>{children}</main>
    </div>
  );
}
