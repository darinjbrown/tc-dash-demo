'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { ThemeProvider as NextThemesProvider } from 'next-themes';
import { type BrandConfig, defaultBrand } from '@/lib/brand-config';
import { generateBrandCss } from '@/lib/brand-utils';

interface BrandContextValue {
  brand: BrandConfig;
  setBrand: (brand: BrandConfig) => void;
}

const BrandContext = createContext<BrandContextValue>({
  brand: defaultBrand,
  setBrand: () => {},
});

export function useBrandContext() {
  return useContext(BrandContext);
}

interface ThemeProviderProps {
  children: React.ReactNode;
  // Server-provided brand (resolved per tenant in the root layout). Falls back
  // to the platform default only for the unauthenticated shell.
  initialBrand?: BrandConfig;
}

export function ThemeProvider({ children, initialBrand = defaultBrand }: ThemeProviderProps) {
  const [brand, setBrand] = useState<BrandConfig>(initialBrand);

  // Keep client state in sync if the server brand changes between navigations.
  useEffect(() => {
    setBrand(initialBrand);
  }, [initialBrand]);

  // The root layout renders brand CSS server-side (no flash). This effect only
  // updates the vars for in-session brand edits (Settings live preview).
  useEffect(() => {
    const styleId = 'tc-brand-css-vars';
    let styleEl = document.getElementById(styleId) as HTMLStyleElement | null;
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = styleId;
      document.head.appendChild(styleEl);
    }
    styleEl.textContent = generateBrandCss(brand);
  }, [brand]);

  return (
    <BrandContext.Provider value={{ brand, setBrand }}>
      <NextThemesProvider
        attribute="class"
        defaultTheme="system"
        enableSystem
        disableTransitionOnChange
      >
        {children}
      </NextThemesProvider>
    </BrandContext.Provider>
  );
}
