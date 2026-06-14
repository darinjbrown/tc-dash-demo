'use server';

import { db } from '@/db/client';
import { transactionAgents, agents } from '@/db/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { getViewerScope, requireWriteAccess } from '@/lib/access';

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
  // Restricted viewers may only see the agent roster of a transaction they are
  // on. Fail-closed: an out-of-scope (or no-match) agent gets an empty roster.
  const scope = await getViewerScope();
  if (scope.agentIds !== null) {
    if (scope.agentIds.length === 0) return { listing: [], buyer: [] };
    const onTx = await db
      .select({ id: transactionAgents.id })
      .from(transactionAgents)
      .where(
        and(
          eq(transactionAgents.transactionId, transactionId),
          inArray(transactionAgents.agentId, scope.agentIds),
        ),
      )
      .limit(1);
    if (onTx.length === 0) return { listing: [], buyer: [] };
  }

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
  const denied = await requireWriteAccess();
  if (denied) return denied;

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
  const denied = await requireWriteAccess();
  if (denied) return denied;

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
  const denied = await requireWriteAccess();
  if (denied) return denied;

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
