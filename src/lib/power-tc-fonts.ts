import { Space_Grotesk, Hanken_Grotesk, JetBrains_Mono } from 'next/font/google';

// Typefaces for the Power TC public-facing pages (landing + login). Defined once
// here and shared so both routes load the same fonts and expose the same CSS
// variables. The authenticated app keeps Geist (and, later, per-tenant fonts).
const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-space-grotesk',
  display: 'swap',
});
const hankenGrotesk = Hanken_Grotesk({
  subsets: ['latin'],
  variable: '--font-hanken',
  display: 'swap',
});
const jetBrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains-mono',
  display: 'swap',
});

/** Space-separated CSS-variable class names. Apply to a route wrapper element. */
export const powerTcFontVars = `${spaceGrotesk.variable} ${hankenGrotesk.variable} ${jetBrainsMono.variable}`;
