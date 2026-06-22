export interface BrandConfig {
  name: string;
  tagline?: string;
  logo: string;           // path to logo image (light mode)
  logoDark?: string;      // path to logo image (dark mode, optional)
  logoIcon: string;       // small square icon for sidebar collapsed state
  colors: {
    background: string;         // HSL values without the hsl() wrapper
    foreground: string;
    card: string;
    cardForeground: string;
    popover: string;
    popoverForeground: string;
    primary: string;
    primaryForeground: string;
    secondary: string;
    secondaryForeground: string;
    muted: string;
    mutedForeground: string;
    accent: string;
    accentForeground: string;
    destructive: string;
    destructiveForeground: string;
    border: string;
    input: string;
    ring: string;
    // Status colors for real estate workflows
    statusPending: string;
    statusActive: string;
    statusClosing: string;
    statusClosed: string;
    statusCancelled: string;
  };
  darkColors?: Partial<BrandConfig['colors']>; // overrides for dark mode
  borderRadius: string;
  fontFamily?: string;
}

// DEFAULT BRAND — replace this object to rebrand the entire app
export const defaultBrand: BrandConfig = {
  name: 'Crestline Realty',
  tagline: 'Transaction Management',
  logo: '/brand/logo.svg',
  logoIcon: '/brand/icon.svg',
  colors: {
    background: '0 0% 100%',
    foreground: '222.2 84% 4.9%',
    card: '0 0% 100%',
    cardForeground: '222.2 84% 4.9%',
    popover: '0 0% 100%',
    popoverForeground: '222.2 84% 4.9%',
    primary: '222.2 47.4% 31.2%',       // Deep navy — professional RE feel
    primaryForeground: '210 40% 98%',
    secondary: '210 40% 96.1%',
    secondaryForeground: '222.2 47.4% 11.2%',
    muted: '210 40% 96.1%',
    mutedForeground: '215.4 16.3% 46.9%',
    accent: '210 40% 96.1%',
    accentForeground: '222.2 47.4% 11.2%',
    destructive: '0 84.2% 60.2%',
    destructiveForeground: '210 40% 98%',
    border: '214.3 31.8% 91.4%',
    input: '214.3 31.8% 91.4%',
    ring: '222.2 84% 4.9%',
    statusPending: '38 92% 50%',        // Amber
    statusActive: '142 76% 36%',        // Green
    statusClosing: '217 91% 60%',       // Blue
    statusClosed: '142 76% 36%',        // Green
    statusCancelled: '0 84% 60%',       // Red
  },
  darkColors: {
    background: '222.2 84% 4.9%',
    foreground: '210 40% 98%',
    card: '222.2 84% 4.9%',
    cardForeground: '210 40% 98%',
    popover: '222.2 84% 4.9%',
    popoverForeground: '210 40% 98%',
    primary: '217.2 91.2% 59.8%',
    primaryForeground: '222.2 47.4% 11.2%',
    secondary: '217.2 32.6% 17.5%',
    secondaryForeground: '210 40% 98%',
    muted: '217.2 32.6% 17.5%',
    mutedForeground: '215 20.2% 65.1%',
    accent: '217.2 32.6% 17.5%',
    accentForeground: '210 40% 98%',
    destructive: '0 62.8% 30.6%',
    destructiveForeground: '210 40% 98%',
    border: '217.2 32.6% 17.5%',
    input: '217.2 32.6% 17.5%',
    ring: '212.7 26.8% 83.9%',
  },
  borderRadius: '0.5rem',
};

// ALTERNATE BRAND — swap activeBrand below to rebrand the entire app
export const premiereBrand: BrandConfig = {
  name: 'Premiere Realty TC',
  tagline: 'Closing Deals, Building Futures',
  logo: '/brand/premiere-logo.svg',
  logoIcon: '/brand/premiere-icon.svg',
  colors: {
    background: '0 0% 100%',
    foreground: '20 14% 4%',
    card: '0 0% 100%',
    cardForeground: '20 14% 4%',
    popover: '0 0% 100%',
    popoverForeground: '20 14% 4%',
    primary: '24 9.8% 10%',             // Warm charcoal — luxury RE feel
    primaryForeground: '60 9.1% 97.8%',
    secondary: '60 4.8% 95.9%',
    secondaryForeground: '24 9.8% 10%',
    muted: '60 4.8% 95.9%',
    mutedForeground: '25 5.3% 44.7%',
    accent: '43 96% 56%',               // Gold accent
    accentForeground: '24 9.8% 10%',
    destructive: '0 84.2% 60.2%',
    destructiveForeground: '60 9.1% 97.8%',
    border: '20 5.9% 90%',
    input: '20 5.9% 90%',
    ring: '24 5.7% 82.9%',
    statusPending: '38 92% 50%',
    statusActive: '142 76% 36%',
    statusClosing: '217 91% 60%',
    statusClosed: '142 76% 36%',
    statusCancelled: '0 84% 60%',
  },
  darkColors: {
    background: '20 14% 4%',
    foreground: '60 9.1% 97.8%',
    card: '20 14% 4%',
    cardForeground: '60 9.1% 97.8%',
    popover: '20 14% 4%',
    popoverForeground: '60 9.1% 97.8%',
    primary: '60 9.1% 97.8%',
    primaryForeground: '24 9.8% 10%',
    secondary: '12 6.5% 15.1%',
    secondaryForeground: '60 9.1% 97.8%',
    muted: '12 6.5% 15.1%',
    mutedForeground: '24 5.4% 63.9%',
    accent: '43 96% 56%',
    accentForeground: '24 9.8% 10%',
    destructive: '0 62.8% 30.6%',
    destructiveForeground: '60 9.1% 97.8%',
    border: '12 6.5% 15.1%',
    input: '12 6.5% 15.1%',
    ring: '24 5.7% 82.9%',
  },
  borderRadius: '0.25rem',
};

// ← Change this to switch the active brand across the entire app
export const activeBrand: BrandConfig = defaultBrand;
