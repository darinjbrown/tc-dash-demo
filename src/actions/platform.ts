'use server';

import { db } from '@/db/client';
import { tenants, tenantBranding, users } from '@/db/schema';
import { eq, desc, count } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { getViewerScope } from '@/lib/access';
import { seedTenantTemplates } from '@/db/seed-tenant-templates';
import { defaultBrand } from '@/lib/brand-config';

/**
 * Platform superadmin surface (d20web only). EVERY function here gates on
 * isPlatformAdmin server-side — this is the only place cross-tenant power lives,
 * kept off the normal tenant request path (plan §1.4).
 */
async function requirePlatformAdmin(): Promise<boolean> {
  const scope = await getViewerScope();
  return scope.isPlatformAdmin === true;
}

export type TenantRow = {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  billingStatus: string;
  userCount: number;
  createdAt: Date | null;
};

export async function listTenants(): Promise<TenantRow[]> {
  if (!(await requirePlatformAdmin())) return [];

  const rows = await db
    .select({
      id: tenants.id,
      name: tenants.name,
      slug: tenants.slug,
      isActive: tenants.isActive,
      billingStatus: tenants.billingStatus,
      createdAt: tenants.createdAt,
      userCount: count(users.id),
    })
    .from(tenants)
    .leftJoin(users, eq(users.tenantId, tenants.id))
    .groupBy(tenants.id)
    .orderBy(desc(tenants.createdAt));

  return rows;
}

const createTenantSchema = z.object({
  name: z.string().min(1, 'Office name is required'),
  slug: z
    .string()
    .min(1, 'Slug is required')
    .regex(/^[a-z0-9-]+$/, 'Slug may contain only lowercase letters, numbers, and hyphens'),
  adminEmail: z.string().email('Valid admin email required'),
  adminName: z.string().min(1, 'Admin name is required'),
});

export type CreateTenantValues = z.infer<typeof createTenantSchema>;

/**
 * Onboard a new office: tenant row + branding (from the platform default) +
 * seeded CA template pack + the office's first admin user. No deploy — a row
 * insert and a seed (plan §7.3).
 */
export async function createTenant(
  data: CreateTenantValues,
): Promise<{ success: boolean; tempPassword?: string; error?: string }> {
  if (!(await requirePlatformAdmin())) return { success: false, error: 'Unauthorized' };

  const parsed = createTenantSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid data' };
  }
  const v = parsed.data;

  // slug must be unique; email globally unique.
  const [slugTaken] = await db.select({ id: tenants.id }).from(tenants).where(eq(tenants.slug, v.slug));
  if (slugTaken) return { success: false, error: 'That slug is already in use.' };
  const [emailTaken] = await db.select({ id: users.id }).from(users).where(eq(users.email, v.adminEmail));
  if (emailTaken) return { success: false, error: 'A user with that email already exists.' };

  const tenantId = crypto.randomUUID();
  const raw = crypto.randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase();
  const tempPassword = `${raw.slice(0, 4)}-${raw.slice(4)}`;
  const hashedPassword = await bcrypt.hash(tempPassword, 12);

  try {
    await db.insert(tenants).values({
      id: tenantId,
      name: v.name,
      slug: v.slug,
      isActive: true,
      billingStatus: 'manual',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await db.insert(tenantBranding).values({
      tenantId,
      name: v.name,
      tagline: defaultBrand.tagline ?? null,
      logoUrl: defaultBrand.logo,
      logoIconUrl: defaultBrand.logoIcon,
      colors: JSON.stringify(defaultBrand.colors),
      darkColors: defaultBrand.darkColors ? JSON.stringify(defaultBrand.darkColors) : null,
      borderRadius: defaultBrand.borderRadius,
      updatedAt: new Date(),
    });

    // Seed the default CA template pack stamped to this tenant.
    await seedTenantTemplates(db, tenantId);

    // First admin user bound to the new office.
    await db.insert(users).values({
      id: crypto.randomUUID(),
      name: v.adminName,
      email: v.adminEmail,
      role: 'admin',
      tenantId,
      isPlatformAdmin: false,
      hashedPassword,
    });

    revalidatePath('/platform');
    return { success: true, tempPassword };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Failed to create tenant' };
  }
}

/**
 * Flip a tenant's manual active/inactive switch (decisions #4/#7). Inactive
 * tenants are rejected at login; data is preserved. No DB edits required.
 */
export async function setTenantActive(
  tenantId: string,
  isActive: boolean,
): Promise<{ success: boolean; error?: string }> {
  if (!(await requirePlatformAdmin())) return { success: false, error: 'Unauthorized' };

  try {
    await db
      .update(tenants)
      .set({ isActive, updatedAt: new Date() })
      .where(eq(tenants.id, tenantId));
    revalidatePath('/platform');
    return { success: true };
  } catch {
    return { success: false, error: 'Failed to update tenant status' };
  }
}
