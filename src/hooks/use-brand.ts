'use client';

import { useBrandContext } from '@/components/providers/theme-provider';

/** Returns the current active brand config */
export function useBrand() {
  const { brand, setBrand } = useBrandContext();
  return { brand, setBrand };
}
