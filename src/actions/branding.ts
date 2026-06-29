'use server';

import { db } from '@/db/client';
import { tenantBranding } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { getViewerScope, requireTenantWrite } from '@/lib/access';
import { getBrandForTenant, rowToBrandConfig } from '@/lib/tenant-branding';
import { isR2Configured, uploadLogoToR2 } from '@/lib/r2';
import { defaultBrand, type BrandConfig } from '@/lib/brand-config';

export type BrandingEnv = { r2Enabled: boolean };

/** Is the R2 logo uploader available? (drives the UI control's enabled state) */
export async function getBrandingEnv(): Promise<BrandingEnv> {
  return { r2Enabled: isR2Configured() };
}

/** Current tenant's brand config (for the Settings editor). */
export async function getTenantBranding(): Promise<BrandConfig> {
  const scope = await getViewerScope();
  if (!scope.tenantId) return defaultBrand;
  return getBrandForTenant(scope.tenantId);
}

// Editable subset of branding. Colors are validated as a record of HSL strings;
// we keep this permissive (the app already trusts BrandConfig shape) but ensure
// the JSON we store is parse-clean.
const brandingSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  tagline: z.string().optional(),
  logoUrl: z.string().optional(),
  logoDarkUrl: z.string().optional(),
  logoIconUrl: z.string().optional(),
  borderRadius: z.string().min(1).optional(),
  fontFamily: z.string().optional(),
  // Color blobs are optional; when present they must be objects.
  colors: z.record(z.string(), z.string()).optional(),
  darkColors: z.record(z.string(), z.string()).optional(),
});

export type BrandingFormValues = z.infer<typeof brandingSchema>;

export async function updateTenantBranding(
  data: BrandingFormValues,
): Promise<{ success: boolean; error?: string }> {
  const tenant = await requireTenantWrite();
  if ('success' in tenant) return tenant;

  const parsed = brandingSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid data' };
  }
  const v = parsed.data;

  try {
    const [existing] = await db
      .select()
      .from(tenantBranding)
      .where(eq(tenantBranding.tenantId, tenant.tenantId));

    // Merge with current/default so partial edits don't blank required JSON.
    const current = existing ? rowToBrandConfig(existing) : defaultBrand;
    const colors = v.colors ?? current.colors;
    const darkColors = v.darkColors ?? current.darkColors;

    const row = {
      tenantId: tenant.tenantId,
      name: v.name,
      tagline: v.tagline?.trim() || null,
      logoUrl: v.logoUrl?.trim() || null,
      logoDarkUrl: v.logoDarkUrl?.trim() || null,
      logoIconUrl: v.logoIconUrl?.trim() || null,
      colors: JSON.stringify(colors),
      darkColors: darkColors ? JSON.stringify(darkColors) : null,
      borderRadius: v.borderRadius?.trim() || current.borderRadius,
      fontFamily: v.fontFamily?.trim() || null,
      updatedAt: new Date(),
    };

    if (existing) {
      await db
        .update(tenantBranding)
        .set(row)
        .where(eq(tenantBranding.tenantId, tenant.tenantId));
    } else {
      await db.insert(tenantBranding).values(row);
    }

    revalidatePath('/settings');
    revalidatePath('/', 'layout'); // brand CSS is rendered in the root layout
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Failed to save branding' };
  }
}

const MAX_LOGO_BYTES = 1_000_000; // 1 MB
const ALLOWED_LOGO_TYPES = new Set(['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp']);

/**
 * Upload a logo to R2 for the current tenant and persist its URL. The control is
 * disabled in the UI when R2 is not configured; this also fails closed here.
 */
export async function uploadTenantLogo(
  formData: FormData,
): Promise<{ success: boolean; url?: string; error?: string }> {
  const tenant = await requireTenantWrite();
  if ('success' in tenant) return tenant;

  if (!isR2Configured()) {
    return { success: false, error: 'Logo uploads are not enabled. Set a logo URL manually.' };
  }

  const slot = (formData.get('slot') as string) || 'logo';
  const file = formData.get('file');
  if (!(file instanceof File)) return { success: false, error: 'No file provided.' };
  if (!ALLOWED_LOGO_TYPES.has(file.type)) {
    return { success: false, error: 'Unsupported file type. Use PNG, JPEG, SVG, or WEBP.' };
  }
  if (file.size > MAX_LOGO_BYTES) {
    return { success: false, error: 'File too large (max 1 MB).' };
  }

  try {
    const ext = file.name.includes('.') ? file.name.split('.').pop() : 'png';
    const key = `tenants/${tenant.tenantId}/${slot}-${crypto.randomUUID()}.${ext}`;
    const bytes = new Uint8Array(await file.arrayBuffer());
    const url = await uploadLogoToR2(key, bytes, file.type);

    // Persist into the matching slot.
    const column =
      slot === 'logoDark'
        ? { logoDarkUrl: url }
        : slot === 'logoIcon'
          ? { logoIconUrl: url }
          : { logoUrl: url };

    const [existing] = await db
      .select({ tenantId: tenantBranding.tenantId })
      .from(tenantBranding)
      .where(eq(tenantBranding.tenantId, tenant.tenantId));

    if (existing) {
      await db
        .update(tenantBranding)
        .set({ ...column, updatedAt: new Date() })
        .where(eq(tenantBranding.tenantId, tenant.tenantId));
    } else {
      // No branding row yet — seed from defaults plus this logo.
      await db.insert(tenantBranding).values({
        tenantId: tenant.tenantId,
        name: defaultBrand.name,
        tagline: defaultBrand.tagline ?? null,
        logoUrl: defaultBrand.logo,
        logoIconUrl: defaultBrand.logoIcon,
        colors: JSON.stringify(defaultBrand.colors),
        darkColors: defaultBrand.darkColors ? JSON.stringify(defaultBrand.darkColors) : null,
        borderRadius: defaultBrand.borderRadius,
        ...column,
        updatedAt: new Date(),
      });
    }

    revalidatePath('/settings');
    revalidatePath('/', 'layout');
    return { success: true, url };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Upload failed' };
  }
}
