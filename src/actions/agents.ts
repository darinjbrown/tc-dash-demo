'use server';

import { db } from '@/db/client';
import { agents, transactionAgents } from '@/db/schema';
import type { Agent } from '@/db/schema';
import { eq, and, asc, sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { getViewerScope, requireWriteAccess, requireTenantWrite, tenantScopeCondition } from '@/lib/access';
import { z } from 'zod';

// ─── Types ─────────────────────────────────────────────────────────────────────

export type AgentWithStats = Agent & { transactionCount: number };

export type AgentFormValues = {
  name: string;
  email: string;
  phone?: string;
  broker?: string;
  licenseNumber?: string;
  brokerageId?: string;
  isInHouse?: boolean;
};

// Internal schema — not exported (use server files can only export async functions)
const agentSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Valid email required'),
  phone: z.string().optional(),
  broker: z.string().optional(),
  licenseNumber: z.string().optional(),
  brokerageId: z.string().optional(),
  isInHouse: z.boolean().optional(),
});

// ─── Queries ──────────────────────────────────────────────────────────────────

export async function getAgents(): Promise<AgentWithStats[]> {
  const scope = await getViewerScope();
  const rows = await db
    .select({
      id: agents.id,
      tenantId: agents.tenantId,
      name: agents.name,
      email: agents.email,
      phone: agents.phone,
      broker: agents.broker,
      licenseNumber: agents.licenseNumber,
      brokerageId: agents.brokerageId,
      isActive: agents.isActive,
      isInHouse: agents.isInHouse,
      createdAt: agents.createdAt,
      updatedAt: agents.updatedAt,
      transactionCount: sql<number>`count(distinct ${transactionAgents.transactionId})`,
    })
    .from(agents)
    .leftJoin(transactionAgents, eq(transactionAgents.agentId, agents.id))
    .where(tenantScopeCondition(scope, agents.tenantId))
    .groupBy(agents.id)
    .orderBy(asc(agents.name));

  return rows;
}

export async function getAgentsForSelect(): Promise<{
  id: string;
  name: string;
  broker: string | null;
  email: string;
  phone: string | null;
  isInHouse: boolean;
}[]> {
  const scope = await getViewerScope();
  const rows = await db
    .select({
      id: agents.id,
      name: agents.name,
      broker: agents.broker,
      email: agents.email,
      phone: agents.phone,
      isInHouse: agents.isInHouse,
    })
    .from(agents)
    .where(and(eq(agents.isActive, true), tenantScopeCondition(scope, agents.tenantId)))
    .orderBy(asc(agents.name));
  return rows.map((r) => ({ ...r, isInHouse: r.isInHouse ?? false }));
}

// ─── Mutations ────────────────────────────────────────────────────────────────

export async function createAgent(
  data: AgentFormValues,
): Promise<{ success: boolean; data?: { id: string; name: string; broker: string | null; email: string; phone: string | null }; error?: string }> {
  const tenant = await requireTenantWrite();
  if ('success' in tenant) return tenant;

  const parsed = agentSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid data' };
  }
  const v = parsed.data;
  const id = crypto.randomUUID();

  try {
    await db.insert(agents).values({
      id,
      tenantId: tenant.tenantId, // stamped from session, never client input
      name: v.name,
      email: v.email,
      phone: v.phone?.trim() || null,
      broker: v.broker?.trim() || null,
      licenseNumber: v.licenseNumber?.trim() || null,
      brokerageId: v.brokerageId?.trim() || null,
      isInHouse: v.isInHouse ?? false,
    });
    revalidatePath('/agents');
    return { success: true, data: { id, name: v.name, broker: v.broker?.trim() || null, email: v.email, phone: v.phone?.trim() || null } };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create agent';
    return { success: false, error: message };
  }
}

export async function updateAgent(
  id: string,
  data: AgentFormValues,
): Promise<{ success: boolean; error?: string }> {
  const tenant = await requireTenantWrite();
  if ('success' in tenant) return tenant;

  const parsed = agentSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid data' };
  }
  const v = parsed.data;

  try {
    await db
      .update(agents)
      .set({
        name: v.name,
        email: v.email,
        phone: v.phone?.trim() || null,
        broker: v.broker?.trim() || null,
        licenseNumber: v.licenseNumber?.trim() || null,
        brokerageId: v.brokerageId?.trim() || null,
        isInHouse: v.isInHouse ?? false,
        updatedAt: new Date(),
      })
      // tenant-scoped WHERE: a forged id from another office updates 0 rows
      .where(and(eq(agents.id, id), eq(agents.tenantId, tenant.tenantId)));
    revalidatePath('/agents');
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to update agent';
    return { success: false, error: message };
  }
}

export async function deleteAgent(
  id: string,
): Promise<{ success: boolean; error?: string }> {
  const tenant = await requireTenantWrite();
  if ('success' in tenant) return tenant;

  try {
    const linked = await db
      .select({ id: transactionAgents.id })
      .from(transactionAgents)
      .where(and(eq(transactionAgents.agentId, id), eq(transactionAgents.tenantId, tenant.tenantId)))
      .limit(1);

    if (linked.length > 0) {
      return { success: false, error: 'Agent has linked transactions. Deactivate instead.' };
    }

    await db.delete(agents).where(and(eq(agents.id, id), eq(agents.tenantId, tenant.tenantId)));
    revalidatePath('/agents');
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to delete agent';
    return { success: false, error: message };
  }
}

export async function toggleAgentActive(
  id: string,
): Promise<{ success: boolean; error?: string }> {
  const tenant = await requireTenantWrite();
  if ('success' in tenant) return tenant;

  try {
    const [agent] = await db
      .select({ isActive: agents.isActive })
      .from(agents)
      .where(and(eq(agents.id, id), eq(agents.tenantId, tenant.tenantId)));

    if (!agent) return { success: false, error: 'Agent not found' };

    await db
      .update(agents)
      .set({ isActive: !agent.isActive, updatedAt: new Date() })
      .where(and(eq(agents.id, id), eq(agents.tenantId, tenant.tenantId)));

    revalidatePath('/agents');
    return { success: true };
  } catch {
    return { success: false, error: 'Failed to update agent status' };
  }
}

export async function toggleAgentInHouse(
  id: string,
): Promise<{ success: boolean; error?: string }> {
  const tenant = await requireTenantWrite();
  if ('success' in tenant) return tenant;

  try {
    const [agent] = await db
      .select({ isInHouse: agents.isInHouse })
      .from(agents)
      .where(and(eq(agents.id, id), eq(agents.tenantId, tenant.tenantId)));

    if (!agent) return { success: false, error: 'Agent not found' };

    await db
      .update(agents)
      .set({ isInHouse: !agent.isInHouse, updatedAt: new Date() })
      .where(and(eq(agents.id, id), eq(agents.tenantId, tenant.tenantId)));

    revalidatePath('/agents');
    revalidatePath('/transactions');
    revalidatePath('/dashboard');
    return { success: true };
  } catch {
    return { success: false, error: 'Failed to update agent' };
  }
}
