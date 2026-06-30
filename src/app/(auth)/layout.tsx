import { powerTcFontVars } from '@/lib/power-tc-fonts';

// Public auth shell — branded as Power TC (the product), not the tenant. The
// evergreen backdrop with soft mint glows mirrors the landing hero so the
// sign-in experience feels like one continuous product surface.
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={powerTcFontVars}
      style={{
        position: 'relative',
        minHeight: '100svh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        background: '#0A2620',
        fontFamily:
          "var(--font-hanken), 'Hanken Grotesk', ui-sans-serif, system-ui, sans-serif",
        padding: '40px 20px',
      }}
    >
      {/* ambient glows — mint top-right, deep-green bottom-left */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          top: -200,
          right: -140,
          width: 620,
          height: 620,
          background:
            'radial-gradient(circle at center, rgba(63,224,160,.16), rgba(63,224,160,0) 62%)',
          pointerEvents: 'none',
        }}
      />
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          bottom: -180,
          left: -160,
          width: 520,
          height: 520,
          background:
            'radial-gradient(circle at center, rgba(28,107,83,.5), rgba(10,38,32,0) 65%)',
          pointerEvents: 'none',
        }}
      />
      <div style={{ position: 'relative', width: '100%', display: 'flex', justifyContent: 'center' }}>
        {children}
      </div>
    </div>
  );
}
