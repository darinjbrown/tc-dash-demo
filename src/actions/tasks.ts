'use server';

import { db } from '@/db/client';
import { transactionTasks, transactions, taskTemplates } from '@/db/schema';
import type { TaskTemplate } from '@/db/schema';
import {
  eq,
  and,
  or,
  lt,
  lte,
  gte,
  inArray,
  notInArray,
  count,
  isNotNull,
  asc,
  desc,
  sql,
} from 'drizzle-orm';
import { format, addDays, startOfMonth, endOfMonth } from 'date-fns';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

// ─── Shared types ─────────────────────────────────────────────────────────────

export type TaskWithTransaction = {
  id: string;
  name: string;
  dueDate: string | null;
  status: string;
  priority: string;
  transactionId: string;
  address: string;
  city: string | null;
  agentName: string | null;
};

export type DashboardStats = {
  activeTransactions: number;
  tasksDueThisWeek: number;
  overdueTasks: number;
  closingThisMonth: number;
};

// ─── Date helpers ─────────────────────────────────────────────────────────────

function todayStr() {
  return format(new Date(), 'yyyy-MM-dd');
}

function daysFromNowStr(days: number) {
  return format(addDays(new Date(), days), 'yyyy-MM-dd');
}

function startOfMonthStr() {
  return format(startOfMonth(new Date()), 'yyyy-MM-dd');
}

function endOfMonthStr() {
  return format(endOfMonth(new Date()), 'yyyy-MM-dd');
}

// ─── Stats for the dashboard cards ───────────────────────────────────────────

export async function getDashboardStats(): Promise<DashboardStats> {
  const today = todayStr();
  const weekEnd = daysFromNowStr(7);
  const monthStart = startOfMonthStr();
  const monthEnd = endOfMonthStr();

  const [activeResult, dueWeekResult, overdueResult, closingResult] = await Promise.all([
    db
      .select({ count: count() })
      .from(transactions)
      .where(inArray(transactions.status, ['active', 'in_escrow'])),

    db
      .select({ count: count() })
      .from(transactionTasks)
      .where(
        and(
          isNotNull(transactionTasks.dueDate),
          gte(transactionTasks.dueDate, today),
          lte(transactionTasks.dueDate, weekEnd),
          notInArray(transactionTasks.status, ['completed', 'waived', 'not_applicable']),
        ),
      ),

    db
      .select({ count: count() })
      .from(transactionTasks)
      .where(
        or(
          and(
            isNotNull(transactionTasks.dueDate),
            lt(transactionTasks.dueDate, today),
            inArray(transactionTasks.status, ['pending', 'in_progress']),
          ),
          and(
            eq(transactionTasks.priority, 'urgent'),
            notInArray(transactionTasks.status, ['completed', 'waived', 'not_applicable']),
          ),
        ),
      ),

    db
      .select({ count: count() })
      .from(transactions)
      .where(
        and(
          isNotNull(transactions.expectedCloseDate),
          gte(transactions.expectedCloseDate, monthStart),
          lte(transactions.expectedCloseDate, monthEnd),
          notInArray(transactions.status, ['closed', 'cancelled']),
        ),
      ),
  ]);

  return {
    activeTransactions: activeResult[0]?.count ?? 0,
    tasksDueThisWeek: dueWeekResult[0]?.count ?? 0,
    overdueTasks: overdueResult[0]?.count ?? 0,
    closingThisMonth: closingResult[0]?.count ?? 0,
  };
}

// ─── Upcoming tasks (due within N days) ──────────────────────────────────────

export async function getUpcomingTasks(days = 7): Promise<TaskWithTransaction[]> {
  const today = todayStr();
  const end = daysFromNowStr(days);

  const rows = await db
    .select({
      id: transactionTasks.id,
      name: transactionTasks.name,
      dueDate: transactionTasks.dueDate,
      status: transactionTasks.status,
      priority: transactionTasks.priority,
      transactionId: transactionTasks.transactionId,
      address: transactions.address,
      city: transactions.city,
      agentName: sql<string | null>`coalesce(
        (select name from agents where agents.id = ${transactions.listingAgentId}),
        (select name from agents where agents.id = ${transactions.sellingAgentId})
      )`,
    })
    .from(transactionTasks)
    .leftJoin(transactions, eq(transactionTasks.transactionId, transactions.id))
    .where(
      and(
        isNotNull(transactionTasks.dueDate),
        gte(transactionTasks.dueDate, today),
        lte(transactionTasks.dueDate, end),
        notInArray(transactionTasks.status, ['completed', 'waived', 'not_applicable']),
      ),
    )
    .orderBy(asc(transactionTasks.dueDate));

  return rows.map((r) => ({ ...r, address: r.address ?? '', agentName: r.agentName ?? null }));
}

// ─── Overdue & urgent tasks ───────────────────────────────────────────────────

export async function getOverdueTasks(): Promise<TaskWithTransaction[]> {
  const today = todayStr();

  const rows = await db
    .select({
      id: transactionTasks.id,
      name: transactionTasks.name,
      dueDate: transactionTasks.dueDate,
      status: transactionTasks.status,
      priority: transactionTasks.priority,
      transactionId: transactionTasks.transactionId,
      address: transactions.address,
      city: transactions.city,
      agentName: sql<string | null>`coalesce(
        (select name from agents where agents.id = ${transactions.listingAgentId}),
        (select name from agents where agents.id = ${transactions.sellingAgentId})
      )`,
    })
    .from(transactionTasks)
    .leftJoin(transactions, eq(transactionTasks.transactionId, transactions.id))
    .where(
      or(
        and(
          isNotNull(transactionTasks.dueDate),
          lt(transactionTasks.dueDate, today),
          inArray(transactionTasks.status, ['pending', 'in_progress']),
        ),
        and(
          eq(transactionTasks.priority, 'urgent'),
          notInArray(transactionTasks.status, ['completed', 'waived', 'not_applicable']),
        ),
      ),
    )
    .orderBy(asc(transactionTasks.dueDate));

  return rows.map((r) => ({ ...r, address: r.address ?? '', agentName: r.agentName ?? null }));
}

// ─── Upcoming deadlines (next N tasks across all transactions) ────────────────

export async function getUpcomingDeadlines(limit = 10): Promise<TaskWithTransaction[]> {
  const today = todayStr();

  const rows = await db
    .select({
      id: transactionTasks.id,
      name: transactionTasks.name,
      dueDate: transactionTasks.dueDate,
      status: transactionTasks.status,
      priority: transactionTasks.priority,
      transactionId: transactionTasks.transactionId,
      address: transactions.address,
      city: transactions.city,
      agentName: sql<string | null>`coalesce(
        (select name from agents where agents.id = ${transactions.listingAgentId}),
        (select name from agents where agents.id = ${transactions.sellingAgentId})
      )`,
    })
    .from(transactionTasks)
    .leftJoin(transactions, eq(transactionTasks.transactionId, transactions.id))
    .where(
      and(
        isNotNull(transactionTasks.dueDate),
        gte(transactionTasks.dueDate, today),
        notInArray(transactionTasks.status, ['completed', 'waived', 'not_applicable']),
      ),
    )
    .orderBy(asc(transactionTasks.dueDate))
    .limit(limit);

  return rows.map((r) => ({ ...r, address: r.address ?? '', agentName: r.agentName ?? null }));
}

// ─── Mutation: update a task's status ────────────────────────────────────────

export async function updateTaskStatus(
  id: string,
  status: 'pending' | 'in_progress' | 'completed' | 'overdue' | 'waived' | 'not_applicable',
  notes?: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const updateData: {
      status: typeof status;
      updatedAt: Date;
      notes?: string;
      completedDate?: string;
    } = { status, updatedAt: new Date() };

    if (notes !== undefined) updateData.notes = notes;
    if (status === 'completed') updateData.completedDate = format(new Date(), 'yyyy-MM-dd');

    await db.update(transactionTasks).set(updateData).where(eq(transactionTasks.id, id));

    revalidatePath('/dashboard');
    revalidatePath('/transactions');
    return { success: true };
  } catch {
    return { success: false, error: 'Failed to update task status' };
  }
}

// ─── Mutation: create a custom (non-template) task ───────────────────────────

export async function createCustomTask(
  transactionId: string,
  data: {
    name: string;
    category: string;
    priority?: string;
    dueDate?: string | null;
    notes?: string | null;
    assignedTo?: string | null;
  },
): Promise<{ success: boolean; data?: { id: string }; error?: string }> {
  try {
    const id = crypto.randomUUID();
    await db.insert(transactionTasks).values({
      id,
      transactionId,
      templateId: null,
      name: data.name,
      description: null,
      category: data.category,
      dueDate: data.dueDate ?? null,
      completedDate: null,
      status: 'pending',
      assignedTo: data.assignedTo ?? null,
      priority: (data.priority as 'low' | 'medium' | 'high' | 'urgent') ?? 'medium',
      notes: data.notes ?? null,
      sortOrder: 9999,
    });

    revalidatePath('/transactions');
    return { success: true, data: { id } };
  } catch {
    return { success: false, error: 'Failed to create task' };
  }
}

// ─── Mutation: snooze (reschedule) a task ────────────────────────────────────

export async function snoozeTask(
  id: string,
  newDueDate: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    await db
      .update(transactionTasks)
      .set({ dueDate: newDueDate, updatedAt: new Date() })
      .where(eq(transactionTasks.id, id));

    revalidatePath('/dashboard');
    revalidatePath('/transactions');
    return { success: true };
  } catch {
    return { success: false, error: 'Failed to snooze task' };
  }
}

// ─── Task Template CRUD (used by Settings page) ───────────────────────────────

export type TaskTemplateFormValues = {
  name: string;
  description?: string;
  category: string;
  transactionType: 'listing' | 'purchase' | 'both';
  relativeDueDays: number;
  relativeTo: string;
  sortOrder: number;
  isRequired: boolean;
  isActive: boolean;
};

const templateSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  category: z.enum([
    'pre_escrow',
    'opening',
    'disclosures',
    'inspections',
    'contingencies',
    'loan',
    'appraisal',
    'title',
    'closing',
    'post_closing',
  ]),
  transactionType: z.enum(['listing', 'purchase', 'both']),
  relativeDueDays: z.number().int(),
  relativeTo: z.enum([
    'acceptance_date',
    'escrow_open',
    'expected_close_date',
    'inspection_contingency_date',
    'appraisal_contingency_date',
    'loan_contingency_date',
  ]),
  sortOrder: z.number().int().min(0),
  isRequired: z.boolean(),
  isActive: z.boolean(),
});

export async function getTaskTemplates(): Promise<TaskTemplate[]> {
  return db
    .select()
    .from(taskTemplates)
    .orderBy(asc(taskTemplates.sortOrder), desc(taskTemplates.createdAt));
}

export async function createTaskTemplate(
  data: TaskTemplateFormValues,
): Promise<{ success: boolean; error?: string }> {
  const parsed = templateSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid data' };
  }
  const v = parsed.data;

  try {
    await db.insert(taskTemplates).values({
      id: crypto.randomUUID(),
      name: v.name,
      description: v.description?.trim() || null,
      category: v.category,
      transactionType: v.transactionType,
      relativeDueDays: v.relativeDueDays,
      relativeTo: v.relativeTo,
      sortOrder: v.sortOrder,
      isRequired: v.isRequired,
      isActive: v.isActive,
    });
    revalidatePath('/settings');
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create template';
    return { success: false, error: message };
  }
}

export async function updateTaskTemplate(
  id: string,
  data: TaskTemplateFormValues,
): Promise<{ success: boolean; error?: string }> {
  const parsed = templateSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid data' };
  }
  const v = parsed.data;

  try {
    await db
      .update(taskTemplates)
      .set({
        name: v.name,
        description: v.description?.trim() || null,
        category: v.category,
        transactionType: v.transactionType,
        relativeDueDays: v.relativeDueDays,
        relativeTo: v.relativeTo,
        sortOrder: v.sortOrder,
        isRequired: v.isRequired,
        isActive: v.isActive,
      })
      .where(eq(taskTemplates.id, id));
    revalidatePath('/settings');
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to update template';
    return { success: false, error: message };
  }
}

export async function toggleTaskTemplateActive(
  id: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const [template] = await db
      .select({ isActive: taskTemplates.isActive })
      .from(taskTemplates)
      .where(eq(taskTemplates.id, id));

    if (!template) return { success: false, error: 'Template not found' };

    await db
      .update(taskTemplates)
      .set({ isActive: !template.isActive })
      .where(eq(taskTemplates.id, id));

    revalidatePath('/settings');
    return { success: true };
  } catch {
    return { success: false, error: 'Failed to update template' };
  }
}
