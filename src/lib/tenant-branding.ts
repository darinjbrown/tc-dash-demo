import { cache } from 'react';
import { db } from '@/db/client';
import { tenantBranding } from '@/db/schema';
import { and, eq } from 'drizzle-orm';
import { defaultBrand, type BrandConfig } from '@/lib/brand-config';
import { getViewerScope } from '@/lib/access';
import { tenantPredicate } from '@/lib/tenant-query';

/**
 * Parse a tenant_branding row into the in-memory BrandConfig the rest of the app
 * already understands. Colors/darkColors are stored as parse-clean JSON text
 * blobs; we JSON.parse at this data-layer edge (and fall back to defaults on any
 * malformed blob so a bad row can never crash the shell).
 */
export function rowToBrandConfig(row: {
  name: string;
  tagline: string | null;
  logoUrl: string | null;
  logoDarkUrl: string | null;
  logoIconUrl: string | null;
  colors: string;
  darkColors: string | null;
  borderRadius: string;
  fontFamily: string | null;
}): BrandConfig {
  let colors: BrandConfig['colors'];
  try {
    colors = JSON.parse(row.colors);
  } catch {
    colors = defaultBrand.colors;
  }
  let darkColors: BrandConfig['darkColors'];
  try {
    darkColors = row.darkColors ? JSON.parse(row.darkColors) : undefined;
  } catch {
    darkColors = undefined;
  }
  return {
    name: row.name,
    tagline: row.tagline ?? undefined,
    logo: row.logoUrl ?? defaultBrand.logo,
    logoDark: row.logoDarkUrl ?? undefined,
    logoIcon: row.logoIconUrl ?? defaultBrand.logoIcon,
    colors,
    darkColors,
    borderRadius: row.borderRadius,
    fontFamily: row.fontFamily ?? undefined,
  };
}

/**
 * Load a single tenant's brand. Returns defaultBrand if the tenant has no
 * branding row yet (so the app always renders).
 */
export async function getBrandForTenant(tenantId: string): Promise<BrandConfig> {
  const [row] = await db
    .select()
    .from(tenantBranding)
    .where(eq(tenantBranding.tenantId, tenantId));
  if (!row) return defaultBrand;
  return rowToBrandConfig(row);
}

/**
 * Resolve the brand for the CURRENT request from the session's tenant.
 * - tenant user  -> that tenant's branding (runtime, from the DB)
 * - platform admin / no tenant -> the platform default brand
 * Wrapped in cache() so the layout resolves it once per render.
 */
export const getCurrentBrand = cache(async (): Promise<BrandConfig> => {
  const scope = await getViewerScope();
  if (!scope.tenantId) return defaultBrand;
  // Read the current tenant's branding through the chokepoint predicate so the
  // tenant filter is the single sanctioned one (composed with the row lookup).
  const [row] = await db
    .select()
    .from(tenantBranding)
    .where(
      and(
        tenantPredicate(scope, tenantBranding.tenantId),
        eq(tenantBranding.tenantId, scope.tenantId),
      ),
    );
  if (!row) return defaultBrand;
  return rowToBrandConfig(row);
});
