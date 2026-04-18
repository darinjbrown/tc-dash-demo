'use server';

import { db } from '@/db/client';
import { transactionAgents, agents } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

export type TransactionAgentEntry = {
  id: string;
  agentId: string;
  name: string;
  phone: string | null;
  email: string;
  broker: string | null;
  isInHouse: boolean;
  isPrimary: boolean;
  sortOrder: number;
  side: 'listing' | 'buyer';
};

export async function getTransactionAgents(transactionId: string): Promise<{
  listing: TransactionAgentEntry[];
  buyer: TransactionAgentEntry[];
}> {
  const rows = await db
    .select({
      id: transactionAgents.id,
      agentId: transactionAgents.agentId,
      name: agents.name,
      phone: agents.phone,
      email: agents.email,
      broker: agents.broker,
      isInHouse: agents.isInHouse,
      isPrimary: transactionAgents.isPrimary,
      sortOrder: transactionAgents.sortOrder,
      side: transactionAgents.side,
    })
    .from(transactionAgents)
    .innerJoin(agents, eq(transactionAgents.agentId, agents.id))
    .where(eq(transactionAgents.transactionId, transactionId))
    .orderBy(transactionAgents.sortOrder);

  return {
    listing: rows
      .filter((r) => r.side === 'listing')
      .map((r) => ({ ...r, isInHouse: r.isInHouse ?? false })) as TransactionAgentEntry[],
    buyer: rows
      .filter((r) => r.side === 'buyer')
      .map((r) => ({ ...r, isInHouse: r.isInHouse ?? false })) as TransactionAgentEntry[],
  };
}

export async function addTransactionAgent(
  transactionId: string,
  agentId: string,
  side: 'listing' | 'buyer',
  isPrimary: boolean,
): Promise<{ success: boolean; error?: string }> {
  try {
    const existing = await db
      .select({ id: transactionAgents.id })
      .from(transactionAgents)
      .where(
        and(
          eq(transactionAgents.transactionId, transactionId),
          eq(transactionAgents.agentId, agentId),
          eq(transactionAgents.side, side),
        ),
      )
      .limit(1);

    if (existing.length > 0) {
      return { success: false, error: 'Agent is already added to this side.' };
    }

    if (isPrimary) {
      await db
        .update(transactionAgents)
        .set({ isPrimary: false })
        .where(
          and(
            eq(transactionAgents.transactionId, transactionId),
            eq(transactionAgents.side, side),
          ),
        );
    }

    await db.insert(transactionAgents).values({
      id: crypto.randomUUID(),
      transactionId,
      agentId,
      side,
      isPrimary,
      sortOrder: 0,
    });

    revalidatePath(`/transactions/${transactionId}`);
    revalidatePath('/transactions');
    revalidatePath('/dashboard');
    return { success: true };
  } catch {
    return { success: false, error: 'Failed to add agent.' };
  }
}

export async function removeTransactionAgent(
  transactionId: string,
  agentId: string,
  side: 'listing' | 'buyer',
): Promise<{ success: boolean; error?: string }> {
  try {
    await db
      .delete(transactionAgents)
      .where(
        and(
          eq(transactionAgents.transactionId, transactionId),
          eq(transactionAgents.agentId, agentId),
          eq(transactionAgents.side, side),
        ),
      );

    revalidatePath(`/transactions/${transactionId}`);
    revalidatePath('/transactions');
    revalidatePath('/dashboard');
    return { success: true };
  } catch {
    return { success: false, error: 'Failed to remove agent.' };
  }
}

export async function setTransactionAgentPrimary(
  transactionId: string,
  agentId: string,
  side: 'listing' | 'buyer',
): Promise<{ success: boolean; error?: string }> {
  try {
    await db
      .update(transactionAgents)
      .set({ isPrimary: false })
      .where(
        and(
          eq(transactionAgents.transactionId, transactionId),
          eq(transactionAgents.side, side),
        ),
      );

    await db
      .update(transactionAgents)
      .set({ isPrimary: true })
      .where(
        and(
          eq(transactionAgents.transactionId, transactionId),
          eq(transactionAgents.agentId, agentId),
          eq(transactionAgents.side, side),
        ),
      );

    revalidatePath(`/transactions/${transactionId}`);
    return { success: true };
  } catch {
    return { success: false, error: 'Failed to set primary agent.' };
  }
}
