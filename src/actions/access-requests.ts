'use server';

import { db } from '@/db/client';
import { accessRequests, users } from '@/db/schema';
import type { AccessRequest } from '@/db/schema';
import { eq, desc, count } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { auth } from '@/lib/auth';

const requestSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Valid email required'),
  phone: z.string().min(1, 'Phone is required'),
  address: z.string().min(1, 'Address is required'),
  company: z.string().min(1, 'Company is required'),
  note: z.string().optional(),
});

// ─── Public (no auth) ─────────────────────────────────────────────────────────

export async function createAccessRequest(
  data: unknown,
): Promise<{ success: boolean; error?: string }> {
  const parsed = requestSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid data' };
  }
  const v = parsed.data;

  // Duplicate checks
  const [existingUser] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, v.email));
  if (existingUser) {
    return { success: false, error: 'An account with this email already exists.' };
  }

  const [existingReq] = await db
    .select({ id: accessRequests.id })
    .from(accessRequests)
    .where(eq(accessRequests.email, v.email));
  if (existingReq) {
    return { success: false, error: 'A request with this email is already pending.' };
  }

  try {
    await db.insert(accessRequests).values({
      id: crypto.randomUUID(),
      name: v.name,
      email: v.email,
      phone: v.phone,
      address: v.address,
      company: v.company,
      note: v.note?.trim() || null,
    });
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to submit request';
    return { success: false, error: message };
  }
}

// ─── Admin only ───────────────────────────────────────────────────────────────

export async function getPendingRequestCount(): Promise<number> {
  const session = await auth();
  if (session?.user?.role !== 'admin') return 0;
  const [row] = await db.select({ count: count() }).from(accessRequests);
  return row?.count ?? 0;
}

export async function getPendingRequests(): Promise<AccessRequest[]> {
  const session = await auth();
  if (session?.user?.role !== 'admin') return [];
  return db.select().from(accessRequests).orderBy(desc(accessRequests.createdAt));
}

export async function approveRequest(
  id: string,
  role: 'admin' | 'broker' | 'tc' | 'agent',
): Promise<{ success: boolean; tempPassword?: string; error?: string }> {
  const session = await auth();
  if (session?.user?.role !== 'admin') return { success: false, error: 'Unauthorized' };

  const [request] = await db
    .select()
    .from(accessRequests)
    .where(eq(accessRequests.id, id));
  if (!request) return { success: false, error: 'Request not found' };

  // Guard: email may have been registered since the request was submitted
  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, request.email));
  if (existing) {
    await db.delete(accessRequests).where(eq(accessRequests.id, id));
    revalidatePath('/dashboard');
    return {
      success: false,
      error: 'An account with this email already exists. Request removed.',
    };
  }

  // Generate a readable temp password, e.g. "A3F8-9C21"
  const raw = crypto.randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase();
  const tempPassword = `${raw.slice(0, 4)}-${raw.slice(4)}`;
  const hashedPassword = await bcrypt.hash(tempPassword, 12);

  try {
    await db.insert(users).values({
      id: crypto.randomUUID(),
      name: request.name,
      email: request.email,
      hashedPassword,
      role,
    });
    await db.delete(accessRequests).where(eq(accessRequests.id, id));
    revalidatePath('/dashboard');
    return { success: true, tempPassword };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to approve request';
    return { success: false, error: message };
  }
}

export async function denyRequest(
  id: string,
): Promise<{ success: boolean; error?: string }> {
  const session = await auth();
  if (session?.user?.role !== 'admin') return { success: false, error: 'Unauthorized' };

  try {
    await db.delete(accessRequests).where(eq(accessRequests.id, id));
    revalidatePath('/dashboard');
    return { success: true };
  } catch {
    return { success: false, error: 'Failed to deny request' };
  }
}
