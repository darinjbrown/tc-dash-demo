'use server';
// todo add role based access

import { db } from '@/db/client';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import bcrypt from 'bcryptjs';
import { z } from 'zod';

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
