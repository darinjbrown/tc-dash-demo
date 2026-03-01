'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { ThemeProvider as NextThemesProvider } from 'next-themes';
import { type BrandConfig, activeBrand } from '@/lib/brand-config';
import { generateBrandCss } from '@/lib/brand-utils';

interface BrandContextValue {
  brand: BrandConfig;
  setBrand: (brand: BrandConfig) => void;
}

const BrandContext = createContext<BrandContextValue>({
  brand: activeBrand,
  setBrand: () => {},
});

export function useBrandContext() {
  return useContext(BrandContext);
}

interface ThemeProviderProps {
  children: React.ReactNode;
  initialBrand?: BrandConfig;
}

export function ThemeProvider({ children, initialBrand = activeBrand }: ThemeProviderProps) {
  const [brand, setBrand] = useState<BrandConfig>(initialBrand);

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
