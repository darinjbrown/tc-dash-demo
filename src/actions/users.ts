'use server';

import { db } from '@/db/client';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import { requireWriteAccess } from '@/lib/access';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { userSchema } from '@/lib/user-schema';
import type { UserFormValues } from '@/lib/user-schema';

const profileSchema = z.object({
  name: z.string().min(1, 'Name is required'),
});

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z.string().min(8, 'New password must be at least 8 characters'),
    confirmPassword: z.string(),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
  });

export type ProfileFormValues = z.infer<typeof profileSchema>;
export type PasswordFormValues = z.infer<typeof passwordSchema>;

export async function updateProfile(
  data: ProfileFormValues,
): Promise<{ success: boolean; error?: string }> {
  const denied = await requireWriteAccess();
  if (denied) return denied;

  const parsed = profileSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid data' };
  }

  const session = await auth();
  if (!session?.user?.id) return { success: false, error: 'Not authenticated' };

  try {
    await db
      .update(users)
      .set({ name: parsed.data.name })
      .where(eq(users.id, session.user.id));

    revalidatePath('/settings');
    return { success: true };
  } catch {
    return { success: false, error: 'Failed to update profile' };
  }
}

export async function changePassword(
  data: PasswordFormValues,
): Promise<{ success: boolean; error?: string }> {
  const denied = await requireWriteAccess();
  if (denied) return denied;

  const parsed = passwordSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid data' };
  }

  const session = await auth();
  if (!session?.user?.id) return { success: false, error: 'Not authenticated' };

  try {
    const [user] = await db
      .select({ hashedPassword: users.hashedPassword })
      .from(users)
      .where(eq(users.id, session.user.id));

    if (!user?.hashedPassword) {
      return { success: false, error: 'Cannot change password for this account type' };
    }

    const valid = await bcrypt.compare(parsed.data.currentPassword, user.hashedPassword);
    if (!valid) {
      return { success: false, error: 'Current password is incorrect' };
    }

    const hashed = await bcrypt.hash(parsed.data.newPassword, 12);
    await db
      .update(users)
      .set({ hashedPassword: hashed })
      .where(eq(users.id, session.user.id));

    return { success: true };
  } catch {
    return { success: false, error: 'Failed to change password' };
  }
}

// ─── Admin-only user management ───────────────────────────────────────────────

async function requireAdmin() {
  const session = await auth();
  if (session?.user?.role !== 'admin') return null;
  return session;
}

function generateTempPassword(): { tempPassword: string; hashedPassword: Promise<string> } {
  const raw = crypto.randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase();
  const tempPassword = `${raw.slice(0, 4)}-${raw.slice(4)}`;
  return { tempPassword, hashedPassword: bcrypt.hash(tempPassword, 12) };
}

export async function listUsers(): Promise<
  Array<{ id: string; name: string | null; email: string; role: string; createdAt: Date | null }>
> {
  const session = await requireAdmin();
  if (!session) return [];

  return db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      createdAt: users.createdAt,
    })
    .from(users)
    .orderBy(users.createdAt);
}

export async function createUser(
  data: UserFormValues,
): Promise<{ success: boolean; tempPassword?: string; error?: string }> {
  const denied = await requireWriteAccess();
  if (denied) return denied;

  const session = await requireAdmin();
  if (!session) return { success: false, error: 'Unauthorized' };

  const parsed = userSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid data' };
  }

  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, parsed.data.email));
  if (existing) return { success: false, error: 'A user with this email already exists' };

  const { tempPassword, hashedPassword } = generateTempPassword();

  try {
    await db.insert(users).values({
      id: crypto.randomUUID(),
      name: parsed.data.name,
      email: parsed.data.email,
      role: parsed.data.role,
      hashedPassword: await hashedPassword,
    });
    revalidatePath('/settings');
    return { success: true, tempPassword };
  } catch {
    return { success: false, error: 'Failed to create user' };
  }
}

export async function updateUser(
  id: string,
  data: UserFormValues,
): Promise<{ success: boolean; error?: string }> {
  const denied = await requireWriteAccess();
  if (denied) return denied;

  const session = await requireAdmin();
  if (!session) return { success: false, error: 'Unauthorized' };

  const parsed = userSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid data' };
  }

  // Prevent admin from changing their own role (lockout guard)
  if (id === session.user.id && parsed.data.role !== session.user.role) {
    return { success: false, error: 'You cannot change your own role' };
  }

  try {
    await db
      .update(users)
      .set({ name: parsed.data.name, email: parsed.data.email, role: parsed.data.role })
      .where(eq(users.id, id));
    revalidatePath('/settings');
    return { success: true };
  } catch {
    return { success: false, error: 'Failed to update user' };
  }
}

export async function deleteUser(id: string): Promise<{ success: boolean; error?: string }> {
  const denied = await requireWriteAccess();
  if (denied) return denied;

  const session = await requireAdmin();
  if (!session) return { success: false, error: 'Unauthorized' };

  if (id === session.user.id) return { success: false, error: 'You cannot delete yourself' };

  try {
    await db.delete(users).where(eq(users.id, id));
    revalidatePath('/settings');
    return { success: true };
  } catch {
    return { success: false, error: 'Failed to delete user' };
  }
}

export async function resetUserPassword(
  id: string,
): Promise<{ success: boolean; tempPassword?: string; error?: string }> {
  const denied = await requireWriteAccess();
  if (denied) return denied;

  const session = await requireAdmin();
  if (!session) return { success: false, error: 'Unauthorized' };

  const { tempPassword, hashedPassword } = generateTempPassword();

  try {
    await db.update(users).set({ hashedPassword: await hashedPassword }).where(eq(users.id, id));
    return { success: true, tempPassword };
  } catch {
    return { success: false, error: 'Failed to reset password' };
  }
}
