'use server';

import { db } from '@/db/client';
import {
  transactions,
  taskTemplates,
  taskTemplateGroups,
  transactionTasks,
  activityLog,
} from '@/db/schema';
import type { Transaction, TransactionTask } from '@/db/schema';
import { eq, count, sql, asc, desc, inArray } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { auth } from '@/lib/auth';
import { stampTasks, recalculateTaskDueDates } from '@/lib/task-stamping';
import { transactionSchema } from '@/lib/transaction-schema';
import type { TransactionFormValues } from '@/lib/transaction-schema';
export type { TransactionFormValues } from '@/lib/transaction-schema';

// ─── Shared types ─────────────────────────────────────────────────────────────

export type TransactionSummary = {
  id: string;
  address: string;
  city: string | null;
  state: string | null;
  zipCode: string | null;
  mlsNumber: string | null;
  sellerAgentId: string | null;
  sellerAgentName: string | null;
  sellerAgentPhone: string | null;
  sellerAgentEmail: string | null;
  sellerAgentIsInHouse: boolean | null;
  buyerAgentId: string | null;
  buyerAgentName: string | null;
  buyerAgentPhone: string | null;
  buyerAgentEmail: string | null;
  buyerAgentIsInHouse: boolean | null;
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
  // In-house agent info (joined from agents table)
  sellerAgentName: string | null;
  sellerInHouseEmail: string | null;
  sellerInHousePhone: string | null;
  sellerInHouseBroker: string | null;
  buyerAgentName: string | null;
  buyerInHouseEmail: string | null;
  buyerInHousePhone: string | null;
  buyerInHouseBroker: string | null;
  tasks: TransactionTask[];
  activity: ActivityEntry[];
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
      sellerAgentId: transactions.sellerAgentId,
      sellerAgentName: sql<string | null>`(select name from agents where agents.id = ${transactions.sellerAgentId})`,
      sellerAgentPhone: sql<string | null>`CASE WHEN ${transactions.sellerAgentIsInHouse} = 1 THEN (select phone from agents where agents.id = ${transactions.sellerAgentId}) ELSE ${transactions.sellerAgentPhone} END`,
      sellerAgentEmail: sql<string | null>`CASE WHEN ${transactions.sellerAgentIsInHouse} = 1 THEN (select email from agents where agents.id = ${transactions.sellerAgentId}) ELSE ${transactions.sellerAgentEmail} END`,
      sellerAgentIsInHouse: transactions.sellerAgentIsInHouse,
      buyerAgentId: transactions.buyerAgentId,
      buyerAgentName: sql<string | null>`(select name from agents where agents.id = ${transactions.buyerAgentId})`,
      buyerAgentPhone: sql<string | null>`CASE WHEN ${transactions.buyerAgentIsInHouse} = 1 THEN (select phone from agents where agents.id = ${transactions.buyerAgentId}) ELSE ${transactions.buyerAgentPhone} END`,
      buyerAgentEmail: sql<string | null>`CASE WHEN ${transactions.buyerAgentIsInHouse} = 1 THEN (select email from agents where agents.id = ${transactions.buyerAgentId}) ELSE ${transactions.buyerAgentEmail} END`,
      buyerAgentIsInHouse: transactions.buyerAgentIsInHouse,
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

  const taskCountRows = await db
    .select({
      transactionId: transactionTasks.transactionId,
      total: count(),
      completed: sql<number>`sum(case when ${transactionTasks.status} = 'completed' then 1 else 0 end)`,
    })
    .from(transactionTasks)
    .groupBy(transactionTasks.transactionId);

  const countMap = new Map(
    taskCountRows.map((r) => [r.transactionId, { total: r.total, completed: r.completed ?? 0 }]),
  );

  const summaries: TransactionSummary[] = rows.map((r) => {
    const counts = countMap.get(r.id) ?? { total: 0, completed: 0 };
    return {
      ...r,
      totalTasks: counts.total,
      completedTasks: Number(counts.completed),
    };
  });

  const groupMap = new Map<string, AgentTransactionGroup>();
  const ungroupedKey = '__none__';

  for (const s of summaries) {
    // Group by seller's agent first (our listing side), fall back to buyer's agent
    const primaryId = s.sellerAgentId ?? s.buyerAgentId;
    const primaryName = s.sellerAgentId ? s.sellerAgentName : s.buyerAgentName;
    const key = primaryId ?? ungroupedKey;
    if (!groupMap.has(key)) {
      groupMap.set(key, { agentId: primaryId, agentName: primaryName, transactions: [] });
    }
    groupMap.get(key)!.transactions.push(s);
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
  sellerAgentName: string | null;
  buyerAgentName: string | null;
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
      sellerAgentName: sql<string | null>`(select name from agents where agents.id = ${transactions.sellerAgentId})`,
      buyerAgentName: sql<string | null>`(select name from agents where agents.id = ${transactions.buyerAgentId})`,
    })
    .from(transactions)
    .where(inArray(transactions.status, ['listed', 'in_escrow']))
    .orderBy(asc(transactions.expectedCloseDate));

  if (rows.length === 0) return [];

  const taskCounts = await db
    .select({
      transactionId: transactionTasks.transactionId,
      total: count(),
      completed: sql<number>`sum(case when ${transactionTasks.status} = 'completed' then 1 else 0 end)`,
    })
    .from(transactionTasks)
    .where(inArray(transactionTasks.transactionId, rows.map((r) => r.id)))
    .groupBy(transactionTasks.transactionId);

  const countMap = new Map(
    taskCounts.map((r) => [r.transactionId, { total: r.total, completed: Number(r.completed ?? 0) }]),
  );

  return rows.map((r) => {
    const counts = countMap.get(r.id) ?? { total: 0, completed: 0 };
    return { ...r, totalTasks: counts.total, completedTasks: counts.completed };
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
      agentId: transactions.agentId,
      sellerAgentId: transactions.sellerAgentId,
      sellerAgentIsInHouse: transactions.sellerAgentIsInHouse,
      sellerAgentCompany: transactions.sellerAgentCompany,
      sellerAgentPhone: transactions.sellerAgentPhone,
      sellerAgentEmail: transactions.sellerAgentEmail,
      buyerAgentId: transactions.buyerAgentId,
      buyerAgentIsInHouse: transactions.buyerAgentIsInHouse,
      buyerAgentCompany: transactions.buyerAgentCompany,
      buyerAgentPhone: transactions.buyerAgentPhone,
      buyerAgentEmail: transactions.buyerAgentEmail,
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
      buyerAgent: transactions.buyerAgent,
      sellerName: transactions.sellerName,
      sellerAgent: transactions.sellerAgent,
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
      sellerAgentName: sql<string | null>`(select name from agents where agents.id = ${transactions.sellerAgentId})`,
      sellerInHouseEmail: sql<string | null>`(select email from agents where agents.id = ${transactions.sellerAgentId})`,
      sellerInHousePhone: sql<string | null>`(select phone from agents where agents.id = ${transactions.sellerAgentId})`,
      sellerInHouseBroker: sql<string | null>`(select broker from agents where agents.id = ${transactions.sellerAgentId})`,
      buyerAgentName: sql<string | null>`(select name from agents where agents.id = ${transactions.buyerAgentId})`,
      buyerInHouseEmail: sql<string | null>`(select email from agents where agents.id = ${transactions.buyerAgentId})`,
      buyerInHousePhone: sql<string | null>`(select phone from agents where agents.id = ${transactions.buyerAgentId})`,
      buyerInHouseBroker: sql<string | null>`(select broker from agents where agents.id = ${transactions.buyerAgentId})`,
    })
    .from(transactions)
    .where(eq(transactions.id, id));

  if (!txRow) return null;

  const [tasks, activityRows] = await Promise.all([
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
  ]);

  return {
    ...txRow,
    sellerAgentName: txRow.sellerAgentName ?? null,
    sellerInHouseEmail: txRow.sellerInHouseEmail ?? null,
    sellerInHousePhone: txRow.sellerInHousePhone ?? null,
    sellerInHouseBroker: txRow.sellerInHouseBroker ?? null,
    buyerAgentName: txRow.buyerAgentName ?? null,
    buyerInHouseEmail: txRow.buyerInHouseEmail ?? null,
    buyerInHousePhone: txRow.buyerInHousePhone ?? null,
    buyerInHouseBroker: txRow.buyerInHouseBroker ?? null,
    tasks,
    activity: activityRows,
  };
}

// ─── Mutations ────────────────────────────────────────────────────────────────

export async function createTransaction(
  data: TransactionFormValues,
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
      sellerAgentId: n(values.sellerAgentId),
      sellerAgentIsInHouse: values.sellerAgentIsInHouse ?? false,
      sellerAgentCompany: n(values.sellerAgentCompany),
      sellerAgentPhone: n(values.sellerAgentPhone),
      sellerAgentEmail: n(values.sellerAgentEmail),
      buyerAgentId: n(values.buyerAgentId),
      buyerAgentIsInHouse: values.buyerAgentIsInHouse ?? false,
      buyerAgentCompany: n(values.buyerAgentCompany),
      buyerAgentPhone: n(values.buyerAgentPhone),
      buyerAgentEmail: n(values.buyerAgentEmail),
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
      buyerAgent: n(values.buyerAgent),
      sellerName: n(values.sellerName),
      sellerAgent: n(values.sellerAgent),
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
        sellerAgentId: n(values.sellerAgentId),
        sellerAgentIsInHouse: values.sellerAgentIsInHouse ?? false,
        sellerAgentCompany: n(values.sellerAgentCompany),
        sellerAgentPhone: n(values.sellerAgentPhone),
        sellerAgentEmail: n(values.sellerAgentEmail),
        buyerAgentId: n(values.buyerAgentId),
        buyerAgentIsInHouse: values.buyerAgentIsInHouse ?? false,
        buyerAgentCompany: n(values.buyerAgentCompany),
        buyerAgentPhone: n(values.buyerAgentPhone),
        buyerAgentEmail: n(values.buyerAgentEmail),
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
        buyerAgent: n(values.buyerAgent),
        sellerName: n(values.sellerName),
        sellerAgent: n(values.sellerAgent),
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
