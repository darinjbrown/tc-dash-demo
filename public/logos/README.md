# Power TC — Brand Assets (Keystone mark)

The **Keystone** mark: a faceted gem in the Power TC palette — value, stability,
the cornerstone of a deal. Two-tone, flat geometry, no gradients.

## Colors
| Role | Hex |
|---|---|
| Mint (bright facet / accent) | `#3FE0A0` |
| Evergreen (dark surface / tile) | `#0A2620` |
| Ink (wordmark on light) | `#15201B` |
| Deep green (TC text on light) | `#14463A` |
| Ivory (wordmark on dark) | `#F6F3EA` |

Light-mark facets: `#1C6B53` `#3FE0A0` `#14463A` `#0F4234` (TL/TR/BR/BL).
Dark-mark facets: `#2DB07E` `#3FE0A0` `#1E8A63` `#166B4E`.

Typeface: **Space Grotesk** — Power = Medium (500), TC = Bold (700).

## What's in here

### `svg/` — vector (scales to any size)
- `mark-keystone-color.svg` — the mark for **light** backgrounds
- `mark-keystone-reversed.svg` — the mark for **dark** backgrounds
- `mark-keystone-mono-ink.svg` / `mark-keystone-mono-white.svg` — single-color silhouette (stamps, embossing, faxes)
- `app-icon.svg` — evergreen squircle + bright mark (primary app icon)
- `app-icon-mint.svg` — mint squircle alt
- `favicon.svg` — small evergreen tile, optimized for tiny sizes
- `logo-horizontal-light.svg` / `logo-horizontal-dark.svg` — full lockup (mark + wordmark)
- `logo-stacked-light.svg` — mark over wordmark

> The lockup SVGs use live **Space Grotesk** text (pulled from Google Fonts).
> For print or to guarantee rendering anywhere, open in a vector editor and
> **convert text to outlines**. The standalone `mark-*` SVGs have no text and are
> always safe.

### `png/` — raster
- `app-icon-1024.png`, `app-icon-512.png` — store / general app icon
- `icon-maskable-512.png` — Android/PWA maskable icon
- `apple-touch-icon-180.png` — iOS home screen
- `favicon-32.png`, `favicon-16.png` — browser tab
- `mark-color-512.png` — transparent mark for general use

### `Logo.tsx`
A React component (`<Logo variant="light|dark" markOnly size={32} />` + `<KeystoneMark />`).

## Using it in the Next.js app

1. **Icons / favicons** → copy the PNGs (and `favicon.svg`) into `/public`, then in
   `src/app/layout.tsx` (or `app/icon` conventions):
   ```ts
   export const metadata = {
     icons: {
       icon: [
         { url: "/favicon.svg", type: "image/svg+xml" },
         { url: "/favicon-32.png", sizes: "32x32" },
       ],
       apple: "/apple-touch-icon-180.png",
     },
   };
   ```
   (Or use the file-based convention: drop `icon.svg`, `apple-icon.png`,
   `favicon.ico` into `src/app/`. A `.ico` can be generated from `favicon-32.png`.)

2. **Logo in the UI** → put `Logo.tsx` in `src/components/brand/` and load Space Grotesk.
   With `next/font`:
   ```ts
   import { Space_Grotesk } from "next/font/google";
   const spaceGrotesk = Space_Grotesk({ subsets: ["latin"], weight: ["500","700"] });
   ```
   Then use `<Logo />` in the nav (light) and `<Logo variant="dark" />` on dark sections.

3. **Web manifest** (PWA) → point `icons` at `app-icon-512.png` and
   `icon-maskable-512.png` (`"purpose": "maskable"`).

## Clear space & minimum size
Keep padding around the logo ≥ the height of the mark. Don't place the full
lockup below ~120px wide; below that, use the mark alone.
