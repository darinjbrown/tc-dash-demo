'use server';

import { db } from '@/db/client';
import { transactionAgents, agents, transactions } from '@/db/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { getViewerScope, requireTenantWrite } from '@/lib/access';

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
  const scope = await getViewerScope();

  // Tenant ring (outer): a viewer with no tenant (and not a platform admin)
  // sees nothing. Platform admins don't use this tenant-scoped action surface.
  if (!scope.tenantId) return { listing: [], buyer: [] };

  // Confirm the transaction is in the viewer's tenant before exposing its roster.
  const inTenant = await db
    .select({ id: transactionAgents.id })
    .from(transactionAgents)
    .where(
      and(
        eq(transactionAgents.transactionId, transactionId),
        eq(transactionAgents.tenantId, scope.tenantId),
      ),
    )
    .limit(1);
  // No in-tenant rows means either the tx is in another tenant or has no agents
  // yet; verify the transaction itself is in-tenant for the latter case.
  if (inTenant.length === 0) {
    const tx = await db
      .select({ id: transactions.id })
      .from(transactions)
      .where(and(eq(transactions.id, transactionId), eq(transactions.tenantId, scope.tenantId)))
      .limit(1);
    if (tx.length === 0) return { listing: [], buyer: [] };
  }

  // Agent ring (inner): restricted viewers may only see the roster of a
  // transaction they are on. Fail-closed for a no-match agent.
  if (scope.agentIds !== null) {
    if (scope.agentIds.length === 0) return { listing: [], buyer: [] };
    const onTx = await db
      .select({ id: transactionAgents.id })
      .from(transactionAgents)
      .where(
        and(
          eq(transactionAgents.transactionId, transactionId),
          eq(transactionAgents.tenantId, scope.tenantId),
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
    .where(
      and(
        eq(transactionAgents.transactionId, transactionId),
        eq(transactionAgents.tenantId, scope.tenantId),
      ),
    )
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
  const tenant = await requireTenantWrite();
  if ('success' in tenant) return tenant;

  try {
    // Verify BOTH the transaction and the agent live in the viewer's tenant
    // before linking them — prevents a cross-tenant link by construction.
    const [tx] = await db
      .select({ id: transactions.id })
      .from(transactions)
      .where(and(eq(transactions.id, transactionId), eq(transactions.tenantId, tenant.tenantId)))
      .limit(1);
    if (!tx) return { success: false, error: 'Transaction not found.' };

    const [agent] = await db
      .select({ id: agents.id })
      .from(agents)
      .where(and(eq(agents.id, agentId), eq(agents.tenantId, tenant.tenantId)))
      .limit(1);
    if (!agent) return { success: false, error: 'Agent not found.' };

    const existing = await db
      .select({ id: transactionAgents.id })
      .from(transactionAgents)
      .where(
        and(
          eq(transactionAgents.transactionId, transactionId),
          eq(transactionAgents.agentId, agentId),
          eq(transactionAgents.side, side),
          eq(transactionAgents.tenantId, tenant.tenantId),
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
            eq(transactionAgents.tenantId, tenant.tenantId),
          ),
        );
    }

    await db.insert(transactionAgents).values({
      id: crypto.randomUUID(),
      tenantId: tenant.tenantId, // stamped from session
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
  const tenant = await requireTenantWrite();
  if ('success' in tenant) return tenant;

  try {
    await db
      .delete(transactionAgents)
      .where(
        and(
          eq(transactionAgents.transactionId, transactionId),
          eq(transactionAgents.agentId, agentId),
          eq(transactionAgents.side, side),
          eq(transactionAgents.tenantId, tenant.tenantId),
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
  const tenant = await requireTenantWrite();
  if ('success' in tenant) return tenant;

  try {
    await db
      .update(transactionAgents)
      .set({ isPrimary: false })
      .where(
        and(
          eq(transactionAgents.transactionId, transactionId),
          eq(transactionAgents.side, side),
          eq(transactionAgents.tenantId, tenant.tenantId),
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
          eq(transactionAgents.tenantId, tenant.tenantId),
        ),
      );

    revalidatePath(`/transactions/${transactionId}`);
    return { success: true };
  } catch {
    return { success: false, error: 'Failed to set primary agent.' };
  }
}
