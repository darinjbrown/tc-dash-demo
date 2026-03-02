'use server';

import { db } from '@/db/client';
import { agents, transactions } from '@/db/schema';
import type { Agent } from '@/db/schema';
import { eq, asc, sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
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
};

// Internal schema — not exported (use server files can only export async functions)
const agentSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Valid email required'),
  phone: z.string().optional(),
  broker: z.string().optional(),
  licenseNumber: z.string().optional(),
  brokerageId: z.string().optional(),
});

// ─── Queries ──────────────────────────────────────────────────────────────────

export async function getAgents(): Promise<AgentWithStats[]> {
  const rows = await db
    .select({
      id: agents.id,
      name: agents.name,
      email: agents.email,
      phone: agents.phone,
      broker: agents.broker,
      licenseNumber: agents.licenseNumber,
      brokerageId: agents.brokerageId,
      isActive: agents.isActive,
      createdAt: agents.createdAt,
      updatedAt: agents.updatedAt,
      transactionCount: sql<number>`(
        select count(distinct t.id) from transactions t
        where t.listing_agent_id = ${agents.id} or t.selling_agent_id = ${agents.id}
      )`,
    })
    .from(agents)
    .orderBy(asc(agents.name));

  return rows;
}

export async function getAgentsForSelect(): Promise<{ id: string; name: string; broker: string | null }[]> {
  return db
    .select({ id: agents.id, name: agents.name, broker: agents.broker })
    .from(agents)
    .where(eq(agents.isActive, true))
    .orderBy(asc(agents.name));
}

// ─── Mutations ────────────────────────────────────────────────────────────────

export async function createAgent(
  data: AgentFormValues,
): Promise<{ success: boolean; data?: { id: string; name: string; broker: string | null }; error?: string }> {
  const parsed = agentSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid data' };
  }
  const v = parsed.data;
  const id = crypto.randomUUID();

  try {
    await db.insert(agents).values({
      id,
      name: v.name,
      email: v.email,
      phone: v.phone?.trim() || null,
      broker: v.broker?.trim() || null,
      licenseNumber: v.licenseNumber?.trim() || null,
      brokerageId: v.brokerageId?.trim() || null,
    });
    revalidatePath('/agents');
    return { success: true, data: { id, name: v.name, broker: v.broker?.trim() || null } };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create agent';
    return { success: false, error: message };
  }
}

export async function updateAgent(
  id: string,
  data: AgentFormValues,
): Promise<{ success: boolean; error?: string }> {
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
        updatedAt: new Date(),
      })
      .where(eq(agents.id, id));
    revalidatePath('/agents');
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to update agent';
    return { success: false, error: message };
  }
}

export async function toggleAgentActive(
  id: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const [agent] = await db
      .select({ isActive: agents.isActive })
      .from(agents)
      .where(eq(agents.id, id));

    if (!agent) return { success: false, error: 'Agent not found' };

    await db
      .update(agents)
      .set({ isActive: !agent.isActive, updatedAt: new Date() })
      .where(eq(agents.id, id));

    revalidatePath('/agents');
    return { success: true };
  } catch {
    return { success: false, error: 'Failed to update agent status' };
  }
}
