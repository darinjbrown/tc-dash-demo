// Power TC brand lockup — the "Keystone" faceted-gem mark plus the two-tone
// "Power TC" wordmark. Shared by the public-facing pages (landing + login) so
// the brand stays in one place. `variant` adapts the colors to the surface:
// "dark" for evergreen backgrounds, "light" for paper/white.
//
// Wordmark uses Space Grotesk via the --font-space-grotesk CSS variable, which
// the public routes set on their wrapper (see src/lib/power-tc-fonts.ts).

const FONT_DISPLAY = "var(--font-space-grotesk), 'Space Grotesk', sans-serif";

const KEYSTONE_FACETS = {
  light: { tl: '#1C6B53', tr: '#3FE0A0', br: '#14463A', bl: '#0F4234' },
  dark: { tl: '#2DB07E', tr: '#3FE0A0', br: '#1E8A63', bl: '#166B4E' },
} as const;

type Variant = 'light' | 'dark';

export function KeystoneMark({
  variant = 'light',
  size = 34,
}: {
  variant?: Variant;
  size?: number;
}) {
  const f = KEYSTONE_FACETS[variant];
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <polygon points="24,5 24,24 6,24" fill={f.tl} />
      <polygon points="24,5 42,24 24,24" fill={f.tr} />
      <polygon points="42,24 24,43 24,24" fill={f.br} />
      <polygon points="6,24 24,43 24,24" fill={f.bl} />
    </svg>
  );
}

export function PowerTcWordmark({
  variant = 'light',
  size = 18,
}: {
  variant?: Variant;
  size?: number;
}) {
  const powerColor = variant === 'dark' ? '#F6F3EA' : '#15201B';
  const tcColor = variant === 'dark' ? '#3FE0A0' : '#14463A';
  return (
    <span
      style={{
        fontFamily: FONT_DISPLAY,
        fontSize: size,
        letterSpacing: '-.018em',
        lineHeight: 1,
        whiteSpace: 'nowrap',
      }}
    >
      <span style={{ fontWeight: 500, color: powerColor }}>Power</span>
      <span style={{ fontWeight: 700, color: tcColor, marginLeft: '0.26em' }}>TC</span>
    </span>
  );
}

export function PowerTcLogo({
  variant = 'light',
  markSize = 34,
  gap = 11,
}: {
  variant?: Variant;
  markSize?: number;
  gap?: number;
}) {
  return (
    <span
      style={{ display: 'inline-flex', alignItems: 'center', gap }}
      aria-label="Power TC"
    >
      <KeystoneMark variant={variant} size={markSize} />
      <PowerTcWordmark variant={variant} size={Math.round(markSize * 0.53)} />
    </span>
  );
}
