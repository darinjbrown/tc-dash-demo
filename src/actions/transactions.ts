'use server';

import { db } from '@/db/client';
import {
  transactions,
  taskTemplates,
  taskTemplateGroups,
  transactionTasks,
  activityLog,
  transactionAgents,
  agents,
} from '@/db/schema';
import type { Transaction, TransactionTask } from '@/db/schema';
import { eq, count, sql, asc, desc, inArray, and, notInArray } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { auth } from '@/lib/auth';
import { stampTasks, recalculateTaskDueDates } from '@/lib/task-stamping';
import { transactionSchema } from '@/lib/transaction-schema';
import type { TransactionFormValues } from '@/lib/transaction-schema';
export type { TransactionFormValues } from '@/lib/transaction-schema';

// ─── Shared types ─────────────────────────────────────────────────────────────

export type TransactionAgentEntry = {
  agentId: string;
  name: string;
  phone: string | null;
  email: string;
  broker: string | null;
  isInHouse: boolean;
  isPrimary: boolean;
};

export type TransactionSummary = {
  id: string;
  address: string;
  city: string | null;
  state: string | null;
  zipCode: string | null;
  mlsNumber: string | null;
  transactionType: string;
  status: string;
  propertyType: string | null;
  buyerName: string | null;
  sellerName: string | null;
  expectedCloseDate: string | null;
  sellerTcName: string | null;
  sellerTcPhone: string | null;
  sellerTcEmail: string | null;
  buyerTcName: string | null;
  buyerTcPhone: string | null;
  buyerTcEmail: string | null;
  totalTasks: number;
  completedTasks: number;
  listingAgents: TransactionAgentEntry[];
  buyerAgents: TransactionAgentEntry[];
};

export type AgentTransactionGroup = {
  agentId: string | null;
  agentName: string | null;
  transactions: TransactionSummary[];
};

export type ActivityEntry = {
  id: string;
  action: string;
  details: string | null;
  createdAt: Date | null;
  userName: string | null;
};

export type TransactionDetail = Transaction & {
  listingAgents: TransactionAgentEntry[];
  buyerAgents: TransactionAgentEntry[];
  tasks: TransactionTask[];
  activity: ActivityEntry[];
};

export type FormAgentInput = {
  agentId: string;
  side: 'listing' | 'buyer';
  isPrimary: boolean;
};

// Helper: empty string → null for DB insertion
function n(v: string | undefined): string | null {
  return v && v.trim() !== '' ? v.trim() : null;
}

// Helper: dollar string → cents integer, null if blank
function dollars(v: string | undefined): number | null {
  if (!v || v.trim() === '') return null;
  const num = parseFloat(v);
  return isNaN(num) ? null : Math.round(num * 100);
}

// ─── Queries ──────────────────────────────────────────────────────────────────

export async function getTransactions(): Promise<AgentTransactionGroup[]> {
  const rows = await db
    .select({
      id: transactions.id,
      address: transactions.address,
      city: transactions.city,
      state: transactions.state,
      zipCode: transactions.zipCode,
      mlsNumber: transactions.mlsNumber,
      transactionType: transactions.transactionType,
      status: transactions.status,
      propertyType: transactions.propertyType,
      buyerName: transactions.buyerName,
      sellerName: transactions.sellerName,
      expectedCloseDate: transactions.expectedCloseDate,
      sellerTcName: transactions.sellerTcName,
      sellerTcPhone: transactions.sellerTcPhone,
      sellerTcEmail: transactions.sellerTcEmail,
      buyerTcName: transactions.buyerTcName,
      buyerTcPhone: transactions.buyerTcPhone,
      buyerTcEmail: transactions.buyerTcEmail,
    })
    .from(transactions)
    .orderBy(desc(transactions.createdAt));

  if (rows.length === 0) return [];

  const txIds = rows.map((r) => r.id);

  const [taskCountRows, agentRows] = await Promise.all([
    db
      .select({
        transactionId: transactionTasks.transactionId,
        total: count(),
        completed: sql<number>`sum(case when ${transactionTasks.status} = 'completed' then 1 else 0 end)`,
      })
      .from(transactionTasks)
      .groupBy(transactionTasks.transactionId),

    db
      .select({
        transactionId: transactionAgents.transactionId,
        agentId: transactionAgents.agentId,
        side: transactionAgents.side,
        isPrimary: transactionAgents.isPrimary,
        sortOrder: transactionAgents.sortOrder,
        name: agents.name,
        phone: agents.phone,
        email: agents.email,
        broker: agents.broker,
        isInHouse: agents.isInHouse,
      })
      .from(transactionAgents)
      .innerJoin(agents, eq(transactionAgents.agentId, agents.id))
      .where(inArray(transactionAgents.transactionId, txIds))
      .orderBy(transactionAgents.sortOrder),
  ]);

  const countMap = new Map(
    taskCountRows.map((r) => [r.transactionId, { total: r.total, completed: r.completed ?? 0 }]),
  );

  const agentMap = new Map<string, { listing: TransactionAgentEntry[]; buyer: TransactionAgentEntry[] }>();
  for (const a of agentRows) {
    if (!agentMap.has(a.transactionId)) {
      agentMap.set(a.transactionId, { listing: [], buyer: [] });
    }
    const entry: TransactionAgentEntry = {
      agentId: a.agentId,
      name: a.name,
      phone: a.phone,
      email: a.email,
      broker: a.broker,
      isInHouse: a.isInHouse ?? false,
      isPrimary: a.isPrimary,
    };
    agentMap.get(a.transactionId)![a.side === 'listing' ? 'listing' : 'buyer'].push(entry);
  }

  const summaries: TransactionSummary[] = rows.map((r) => {
    const counts = countMap.get(r.id) ?? { total: 0, completed: 0 };
    const txAgents = agentMap.get(r.id) ?? { listing: [], buyer: [] };
    return {
      ...r,
      totalTasks: counts.total,
      completedTasks: Number(counts.completed),
      listingAgents: txAgents.listing,
      buyerAgents: txAgents.buyer,
    };
  });

  // Group by in-house agents only
  const groupMap = new Map<string, AgentTransactionGroup>();
  const ungroupedKey = '__none__';

  for (const s of summaries) {
    const inHouseAgents = [...s.listingAgents, ...s.buyerAgents].filter((a) => a.isInHouse);

    if (inHouseAgents.length === 0) {
      if (!groupMap.has(ungroupedKey)) {
        groupMap.set(ungroupedKey, { agentId: null, agentName: null, transactions: [] });
      }
      groupMap.get(ungroupedKey)!.transactions.push(s);
    } else {
      for (const a of inHouseAgents) {
        if (!groupMap.has(a.agentId)) {
          groupMap.set(a.agentId, { agentId: a.agentId, agentName: a.name, transactions: [] });
        }
        groupMap.get(a.agentId)!.transactions.push(s);
      }
    }
  }

  return Array.from(groupMap.values());
}

export type ActiveTransactionRow = {
  id: string;
  address: string;
  city: string | null;
  transactionType: string;
  status: string;
  expectedCloseDate: string | null;
  primaryListingAgent: string | null;
  primaryBuyerAgent: string | null;
  totalTasks: number;
  completedTasks: number;
};

export async function getActiveTransactionsList(): Promise<ActiveTransactionRow[]> {
  const rows = await db
    .select({
      id: transactions.id,
      address: transactions.address,
      city: transactions.city,
      transactionType: transactions.transactionType,
      status: transactions.status,
      expectedCloseDate: transactions.expectedCloseDate,
    })
    .from(transactions)
    .where(inArray(transactions.status, ['listed', 'in_escrow']))
    .orderBy(asc(transactions.expectedCloseDate));

  if (rows.length === 0) return [];

  const txIds = rows.map((r) => r.id);

  const [taskCounts, agentRows] = await Promise.all([
    db
      .select({
        transactionId: transactionTasks.transactionId,
        total: count(),
        completed: sql<number>`sum(case when ${transactionTasks.status} = 'completed' then 1 else 0 end)`,
      })
      .from(transactionTasks)
      .where(inArray(transactionTasks.transactionId, txIds))
      .groupBy(transactionTasks.transactionId),

    db
      .select({
        transactionId: transactionAgents.transactionId,
        side: transactionAgents.side,
        isPrimary: transactionAgents.isPrimary,
        sortOrder: transactionAgents.sortOrder,
        name: agents.name,
      })
      .from(transactionAgents)
      .innerJoin(agents, eq(transactionAgents.agentId, agents.id))
      .where(inArray(transactionAgents.transactionId, txIds))
      .orderBy(transactionAgents.isPrimary, transactionAgents.sortOrder),
  ]);

  const countMap = new Map(
    taskCounts.map((r) => [r.transactionId, { total: r.total, completed: Number(r.completed ?? 0) }]),
  );

  const agentMap = new Map<string, { listing: string | null; buyer: string | null }>();
  for (const a of agentRows) {
    if (!agentMap.has(a.transactionId)) agentMap.set(a.transactionId, { listing: null, buyer: null });
    const entry = agentMap.get(a.transactionId)!;
    if (a.side === 'listing' && (entry.listing === null || a.isPrimary)) entry.listing = a.name;
    if (a.side === 'buyer' && (entry.buyer === null || a.isPrimary)) entry.buyer = a.name;
  }

  return rows.map((r) => {
    const counts = countMap.get(r.id) ?? { total: 0, completed: 0 };
    const agts = agentMap.get(r.id) ?? { listing: null, buyer: null };
    return {
      ...r,
      totalTasks: counts.total,
      completedTasks: counts.completed,
      primaryListingAgent: agts.listing,
      primaryBuyerAgent: agts.buyer,
    };
  });
}

export async function getTransactionById(id: string): Promise<TransactionDetail | null> {
  const [txRow] = await db
    .select({
      id: transactions.id,
      address: transactions.address,
      city: transactions.city,
      state: transactions.state,
      zipCode: transactions.zipCode,
      mlsNumber: transactions.mlsNumber,
      sellerTcName: transactions.sellerTcName,
      sellerTcEmail: transactions.sellerTcEmail,
      sellerTcPhone: transactions.sellerTcPhone,
      buyerTcName: transactions.buyerTcName,
      buyerTcEmail: transactions.buyerTcEmail,
      buyerTcPhone: transactions.buyerTcPhone,
      transactionType: transactions.transactionType,
      status: transactions.status,
      propertyType: transactions.propertyType,
      escrowNumber: transactions.escrowNumber,
      escrowCompany: transactions.escrowCompany,
      escrowOfficer: transactions.escrowOfficer,
      escrowOfficerPhone: transactions.escrowOfficerPhone,
      escrowOfficerEmail: transactions.escrowOfficerEmail,

      lenderName: transactions.lenderName,
      loanOfficer: transactions.loanOfficer,
      loanOfficerPhone: transactions.loanOfficerPhone,
      loanOfficerEmail: transactions.loanOfficerEmail,
      buyerName: transactions.buyerName,
      sellerName: transactions.sellerName,
      purchasePrice: transactions.purchasePrice,
      earnestMoneyDeposit: transactions.earnestMoneyDeposit,
      buyerCommissionPercent: transactions.buyerCommissionPercent,
      listingCommissionPercent: transactions.listingCommissionPercent,
      contractDate: transactions.contractDate,
      acceptanceDate: transactions.acceptanceDate,
      verificationOfFundsDate: transactions.verificationOfFundsDate,
      earnestMoneyDueDate: transactions.earnestMoneyDueDate,
      inspectionContingencyDate: transactions.inspectionContingencyDate,
      insuranceContingencyDate: transactions.insuranceContingencyDate,
      loanContingencyDate: transactions.loanContingencyDate,
      appraisalContingencyDate: transactions.appraisalContingencyDate,
      hoaDocsDueDate: transactions.hoaDocsDueDate,
      listingActiveDate: transactions.listingActiveDate,
      expectedCloseDate: transactions.expectedCloseDate,
      actualCloseDate: transactions.actualCloseDate,
      notes: transactions.notes,
      createdBy: transactions.createdBy,
      createdAt: transactions.createdAt,
      updatedAt: transactions.updatedAt,
    })
    .from(transactions)
    .where(eq(transactions.id, id));

  if (!txRow) return null;

  const [tasks, activityRows, agentRows] = await Promise.all([
    db
      .select()
      .from(transactionTasks)
      .where(eq(transactionTasks.transactionId, id))
      .orderBy(asc(transactionTasks.sortOrder), asc(transactionTasks.dueDate)),

    db
      .select({
        id: activityLog.id,
        action: activityLog.action,
        details: activityLog.details,
        createdAt: activityLog.createdAt,
        userName: sql<string | null>`(select name from users where users.id = ${activityLog.userId})`,
      })
      .from(activityLog)
      .where(eq(activityLog.transactionId, id))
      .orderBy(desc(activityLog.createdAt))
      .limit(50),

    db
      .select({
        agentId: transactionAgents.agentId,
        side: transactionAgents.side,
        isPrimary: transactionAgents.isPrimary,
        sortOrder: transactionAgents.sortOrder,
        name: agents.name,
        phone: agents.phone,
        email: agents.email,
        broker: agents.broker,
        isInHouse: agents.isInHouse,
      })
      .from(transactionAgents)
      .innerJoin(agents, eq(transactionAgents.agentId, agents.id))
      .where(eq(transactionAgents.transactionId, id))
      .orderBy(transactionAgents.sortOrder),
  ]);

  const listingAgents: TransactionAgentEntry[] = agentRows
    .filter((r) => r.side === 'listing')
    .map((r) => ({
      agentId: r.agentId,
      name: r.name,
      phone: r.phone,
      email: r.email,
      broker: r.broker,
      isInHouse: r.isInHouse ?? false,
      isPrimary: r.isPrimary,
    }));

  const buyerAgents: TransactionAgentEntry[] = agentRows
    .filter((r) => r.side === 'buyer')
    .map((r) => ({
      agentId: r.agentId,
      name: r.name,
      phone: r.phone,
      email: r.email,
      broker: r.broker,
      isInHouse: r.isInHouse ?? false,
      isPrimary: r.isPrimary,
    }));

  return {
    ...txRow,
    listingAgents,
    buyerAgents,
    tasks,
    activity: activityRows,
  };
}

// ─── Mutations ────────────────────────────────────────────────────────────────

export async function createTransaction(
  data: TransactionFormValues,
  agentInputs: FormAgentInput[] = [],
): Promise<{ success: boolean; data?: { id: string }; error?: string }> {
  const parsed = transactionSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid data' };
  }

  const session = await auth();
  const userId = session?.user?.id ?? null;
  const values = parsed.data;
  const id = crypto.randomUUID();

  try {
    const newTx = {
      id,
      address: values.address,
      city: n(values.city),
      state: n(values.state) ?? 'CA',
      zipCode: n(values.zipCode),
      mlsNumber: n(values.mlsNumber),
      sellerTcName: n(values.sellerTcName),
      sellerTcEmail: n(values.sellerTcEmail),
      sellerTcPhone: n(values.sellerTcPhone),
      buyerTcName: n(values.buyerTcName),
      buyerTcEmail: n(values.buyerTcEmail),
      buyerTcPhone: n(values.buyerTcPhone),
      transactionType: values.transactionType,
      status: values.status,
      propertyType: n(values.propertyType) as Transaction['propertyType'],
      escrowNumber: n(values.escrowNumber),
      escrowCompany: n(values.escrowCompany),
      escrowOfficer: n(values.escrowOfficer),
      escrowOfficerPhone: n(values.escrowOfficerPhone),
      escrowOfficerEmail: n(values.escrowOfficerEmail),

      lenderName: n(values.lenderName),
      loanOfficer: n(values.loanOfficer),
      loanOfficerPhone: n(values.loanOfficerPhone),
      loanOfficerEmail: n(values.loanOfficerEmail),
      buyerName: n(values.buyerName),
      sellerName: n(values.sellerName),
      purchasePrice: dollars(values.purchasePrice),
      earnestMoneyDeposit: dollars(values.earnestMoneyDeposit),
      buyerCommissionPercent: n(values.buyerCommissionPercent),
      listingCommissionPercent: n(values.listingCommissionPercent),
      contractDate: n(values.contractDate),
      acceptanceDate: n(values.acceptanceDate),
      verificationOfFundsDate: n(values.verificationOfFundsDate),
      earnestMoneyDueDate: n(values.earnestMoneyDueDate),
      inspectionContingencyDate: n(values.inspectionContingencyDate),
      insuranceContingencyDate: n(values.insuranceContingencyDate),
      loanContingencyDate: n(values.loanContingencyDate),
      appraisalContingencyDate: n(values.appraisalContingencyDate),
      hoaDocsDueDate: n(values.hoaDocsDueDate),
      listingActiveDate: n(values.listingActiveDate),
      expectedCloseDate: n(values.expectedCloseDate),
      actualCloseDate: n(values.actualCloseDate),
      notes: n(values.notes),
      createdBy: userId,
    };

    await db.insert(transactions).values(newTx);

    if (agentInputs.length > 0) {
      await db.insert(transactionAgents).values(
        agentInputs.map((a) => ({
          id: crypto.randomUUID(),
          transactionId: id,
          agentId: a.agentId,
          side: a.side,
          isPrimary: a.isPrimary,
          sortOrder: 0,
        })),
      );
    }

    // Stamp tasks from active templates
    const [templates, groups] = await Promise.all([
      db.select().from(taskTemplates).where(eq(taskTemplates.isActive, true)).orderBy(asc(taskTemplates.sortOrder)),
      db.select().from(taskTemplateGroups),
    ]);

    const stamped = stampTasks(newTx as Parameters<typeof stampTasks>[0], templates, groups);
    if (stamped.length > 0) {
      await db
        .insert(transactionTasks)
        .values(stamped.map((t) => ({ id: crypto.randomUUID(), ...t })));
    }

    await db.insert(activityLog).values({
      id: crypto.randomUUID(),
      transactionId: id,
      userId,
      action: 'created',
      details: JSON.stringify({ address: values.address }),
    }).catch(() => {/* activity log is non-critical */});

    revalidatePath('/transactions');
    revalidatePath('/dashboard');

    return { success: true, data: { id } };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create transaction';
    return { success: false, error: message };
  }
}

export async function updateTransaction(
  id: string,
  data: TransactionFormValues,
): Promise<{ success: boolean; error?: string }> {
  const parsed = transactionSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid data' };
  }

  const session = await auth();
  const userId = session?.user?.id ?? null;
  const values = parsed.data;

  try {
    await db
      .update(transactions)
      .set({
        address: values.address,
        city: n(values.city),
        state: n(values.state) ?? 'CA',
        zipCode: n(values.zipCode),
        mlsNumber: n(values.mlsNumber),
        sellerTcName: n(values.sellerTcName),
        sellerTcEmail: n(values.sellerTcEmail),
        sellerTcPhone: n(values.sellerTcPhone),
        buyerTcName: n(values.buyerTcName),
        buyerTcEmail: n(values.buyerTcEmail),
        buyerTcPhone: n(values.buyerTcPhone),
        transactionType: values.transactionType,
        status: values.status,
        propertyType: n(values.propertyType) as Transaction['propertyType'],
        escrowNumber: n(values.escrowNumber),
        escrowCompany: n(values.escrowCompany),
        escrowOfficer: n(values.escrowOfficer),
        escrowOfficerPhone: n(values.escrowOfficerPhone),
        escrowOfficerEmail: n(values.escrowOfficerEmail),

        lenderName: n(values.lenderName),
        loanOfficer: n(values.loanOfficer),
        loanOfficerPhone: n(values.loanOfficerPhone),
        loanOfficerEmail: n(values.loanOfficerEmail),
        buyerName: n(values.buyerName),
        sellerName: n(values.sellerName),
        purchasePrice: dollars(values.purchasePrice),
        earnestMoneyDeposit: dollars(values.earnestMoneyDeposit),
        buyerCommissionPercent: n(values.buyerCommissionPercent),
        listingCommissionPercent: n(values.listingCommissionPercent),
        contractDate: n(values.contractDate),
        acceptanceDate: n(values.acceptanceDate),
        verificationOfFundsDate: n(values.verificationOfFundsDate),
        earnestMoneyDueDate: n(values.earnestMoneyDueDate),
        inspectionContingencyDate: n(values.inspectionContingencyDate),
        insuranceContingencyDate: n(values.insuranceContingencyDate),
        loanContingencyDate: n(values.loanContingencyDate),
        appraisalContingencyDate: n(values.appraisalContingencyDate),
        hoaDocsDueDate: n(values.hoaDocsDueDate),
        listingActiveDate: n(values.listingActiveDate),
        expectedCloseDate: n(values.expectedCloseDate),
        actualCloseDate: n(values.actualCloseDate),
        notes: n(values.notes),
        updatedAt: new Date(),
      })
      .where(eq(transactions.id, id));

    // Recalculate all template-based task due dates
    const [existingTasks, templates, updatedRows] = await Promise.all([
      db
        .select({ id: transactionTasks.id, templateId: transactionTasks.templateId })
        .from(transactionTasks)
        .where(eq(transactionTasks.transactionId, id)),
      db.select().from(taskTemplates),
      db.select().from(transactions).where(eq(transactions.id, id)),
    ]);

    const updated = updatedRows[0];
    if (updated) {
      const dueDateUpdates = recalculateTaskDueDates(existingTasks, templates, updated);
      for (const u of dueDateUpdates) {
        await db
          .update(transactionTasks)
          .set({ dueDate: u.dueDate, updatedAt: new Date() })
          .where(eq(transactionTasks.id, u.id));
      }
    }

    await db.insert(activityLog).values({
      id: crypto.randomUUID(),
      transactionId: id,
      userId,
      action: 'updated',
      details: JSON.stringify({ address: values.address }),
    }).catch(() => {/* activity log is non-critical */});

    revalidatePath(`/transactions/${id}`);
    revalidatePath('/transactions');
    revalidatePath('/dashboard');

    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to update transaction';
    return { success: false, error: message };
  }
}

export async function updateTransactionStatus(
  id: string,
  status: string,
): Promise<{ success: boolean; error?: string }> {
  const session = await auth();
  const userId = session?.user?.id ?? null;

  try {
    await db
      .update(transactions)
      .set({ status: status as Transaction['status'], updatedAt: new Date() })
      .where(eq(transactions.id, id));

    await db.insert(activityLog).values({
      id: crypto.randomUUID(),
      transactionId: id,
      userId,
      action: 'status_changed',
      details: JSON.stringify({ status }),
    });

    revalidatePath(`/transactions/${id}`);
    revalidatePath('/transactions');
    revalidatePath('/dashboard');

    return { success: true };
  } catch {
    return { success: false, error: 'Failed to update status' };
  }
}

export async function updateTransactionNotes(
  id: string,
  notes: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    await db.update(transactions).set({ notes, updatedAt: new Date() }).where(eq(transactions.id, id));
    revalidatePath(`/transactions/${id}`);
    return { success: true };
  } catch {
    return { success: false, error: 'Failed to save notes' };
  }
}

export async function deleteTransaction(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    // Soft-delete: set status to 'cancelled'
    await db
      .update(transactions)
      .set({ status: 'cancelled', updatedAt: new Date() })
      .where(eq(transactions.id, id));

    revalidatePath('/transactions');
    revalidatePath('/dashboard');

    return { success: true };
  } catch {
    return { success: false, error: 'Failed to archive transaction' };
  }
}
