import type { BrandConfig } from './brand-config';

/** Convert camelCase to kebab-case for CSS custom property names */
function camelToKebab(str: string): string {
  return str.replace(/([A-Z])/g, '-$1').toLowerCase();
}

/** Generate a CSS string that injects brand config as CSS custom properties */
export function generateBrandCss(brand: BrandConfig): string {
  const colorEntries = Object.entries(brand.colors) as [string, string][];

  const lightVars = colorEntries
    .map(([key, val]) => `  --${camelToKebab(key)}: hsl(${val});`)
    .join('\n');

  const darkColors: Record<string, string> = { ...brand.colors, ...brand.darkColors };
  const darkVars = Object.entries(darkColors)
    .map(([key, val]) => `  --${camelToKebab(key)}: hsl(${val});`)
    .join('\n');

  const fontLine = brand.fontFamily
    ? `  --font-sans: ${brand.fontFamily};\n`
    : '';

  return `:root {
  --radius: ${brand.borderRadius};
${fontLine}${lightVars}
}

.dark {
${darkVars}
}`;
}
