// Power TC — logo component
// Drop into your Next.js app (e.g. src/components/brand/Logo.tsx).
// Renders the Keystone mark + "Power TC" wordmark. Font: Space Grotesk
// (load it via next/font or a <link> — see README).

type LogoProps = {
  /** "light" = for light backgrounds, "dark" = for dark/evergreen backgrounds */
  variant?: "light" | "dark";
  /** render just the mark, no wordmark */
  markOnly?: boolean;
  /** mark height in px (wordmark scales with it) */
  size?: number;
  className?: string;
};

const FACETS = {
  light: { tl: "#1C6B53", tr: "#3FE0A0", br: "#14463A", bl: "#0F4234" },
  dark: { tl: "#2DB07E", tr: "#3FE0A0", br: "#1E8A63", bl: "#166B4E" },
};

export function KeystoneMark({
  variant = "light",
  size = 32,
}: {
  variant?: "light" | "dark";
  size?: number;
}) {
  const f = FACETS[variant];
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      aria-hidden="true"
    >
      <polygon points="24,5 24,24 6,24" fill={f.tl} />
      <polygon points="24,5 42,24 24,24" fill={f.tr} />
      <polygon points="42,24 24,43 24,24" fill={f.br} />
      <polygon points="6,24 24,43 24,24" fill={f.bl} />
    </svg>
  );
}

export function Logo({
  variant = "light",
  markOnly = false,
  size = 32,
  className,
}: LogoProps) {
  const powerColor = variant === "dark" ? "#F6F3EA" : "#15201B";
  const tcColor = variant === "dark" ? "#3FE0A0" : "#14463A";

  return (
    <span
      className={className}
      style={{ display: "inline-flex", alignItems: "center", gap: size * 0.34 }}
      aria-label="Power TC"
    >
      <KeystoneMark variant={variant} size={size} />
      {!markOnly && (
        <span
          style={{
            fontFamily: "'Space Grotesk', sans-serif",
            fontSize: size * 0.78,
            letterSpacing: "-0.018em",
            lineHeight: 1,
            whiteSpace: "nowrap",
          }}
        >
          <span style={{ fontWeight: 500, color: powerColor }}>Power</span>
          <span style={{ fontWeight: 700, color: tcColor, marginLeft: "0.28em" }}>
            TC
          </span>
        </span>
      )}
    </span>
  );
}

export default Logo;
