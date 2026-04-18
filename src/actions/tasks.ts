'use server';

import { db } from '@/db/client';
import {
  transactionTasks,
  transactions,
  transactionAgents,
  agents,
  taskTemplates,
  taskTemplateGroups,
} from '@/db/schema';
import type { TaskTemplate, TaskTemplateGroup } from '@/db/schema';
import { templateGroupSchema } from '@/lib/template-group-schema';
import type { TemplateGroupFormValues } from '@/lib/template-group-schema';
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
import { format, addDays } from 'date-fns';
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
  tasksDueToday: number;
  tasksDueThisWeek: number;
  overdueTasks: number;
  closingNext30Days: number;
};

// ─── Date helpers ─────────────────────────────────────────────────────────────

function todayStr() {
  return format(new Date(), 'yyyy-MM-dd');
}

function daysFromNowStr(days: number) {
  return format(addDays(new Date(), days), 'yyyy-MM-dd');
}


// ─── Stats for the dashboard cards ───────────────────────────────────────────

export async function getDashboardStats(): Promise<DashboardStats> {
  const today = todayStr();
  const weekEnd = daysFromNowStr(7);
  const next30 = daysFromNowStr(30);

  const [dueTodayResult, dueWeekResult, overdueResult, closingResult] = await Promise.all([
    db
      .select({ count: count() })
      .from(transactionTasks)
      .innerJoin(transactions, eq(transactionTasks.transactionId, transactions.id))
      .where(
        and(
          eq(transactionTasks.dueDate, today),
          notInArray(transactionTasks.status, ['completed', 'waived', 'not_applicable']),
          notInArray(transactions.status, ['closed', 'cancelled']),
        ),
      ),

    db
      .select({ count: count() })
      .from(transactionTasks)
      .innerJoin(transactions, eq(transactionTasks.transactionId, transactions.id))
      .where(
        and(
          isNotNull(transactionTasks.dueDate),
          gte(transactionTasks.dueDate, today),
          lte(transactionTasks.dueDate, weekEnd),
          notInArray(transactionTasks.status, ['completed', 'waived', 'not_applicable']),
          notInArray(transactions.status, ['closed', 'cancelled']),
        ),
      ),

    db
      .select({ count: count() })
      .from(transactionTasks)
      .innerJoin(transactions, eq(transactionTasks.transactionId, transactions.id))
      .where(
        and(
          notInArray(transactions.status, ['closed', 'cancelled']),
          or(
            and(
              isNotNull(transactionTasks.dueDate),
              lt(transactionTasks.dueDate, today),
              inArray(transactionTasks.status, ['pending', 'in_progress', 'overdue']),
            ),
            and(
              eq(transactionTasks.priority, 'urgent'),
              notInArray(transactionTasks.status, ['completed', 'waived', 'not_applicable']),
            ),
          ),
        ),
      ),

    db
      .select({ count: count() })
      .from(transactions)
      .where(
        and(
          isNotNull(transactions.expectedCloseDate),
          gte(transactions.expectedCloseDate, today),
          lte(transactions.expectedCloseDate, next30),
          notInArray(transactions.status, ['closed', 'cancelled']),
        ),
      ),
  ]);

  return {
    tasksDueToday: dueTodayResult[0]?.count ?? 0,
    tasksDueThisWeek: dueWeekResult[0]?.count ?? 0,
    overdueTasks: overdueResult[0]?.count ?? 0,
    closingNext30Days: closingResult[0]?.count ?? 0,
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
      agentName: sql<string | null>`(
        select ${agents.name} from ${transactionAgents}
        join ${agents} on ${agents.id} = ${transactionAgents.agentId}
        where ${transactionAgents.transactionId} = ${transactions.id}
        order by ${transactionAgents.isPrimary} desc, ${transactionAgents.sortOrder}
        limit 1
      )`,
    })
    .from(transactionTasks)
    .innerJoin(transactions, eq(transactionTasks.transactionId, transactions.id))
    .where(
      and(
        isNotNull(transactionTasks.dueDate),
        gte(transactionTasks.dueDate, today),
        lte(transactionTasks.dueDate, end),
        notInArray(transactionTasks.status, ['completed', 'waived', 'not_applicable']),
        notInArray(transactions.status, ['closed', 'cancelled']),
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
      agentName: sql<string | null>`(
        select ${agents.name} from ${transactionAgents}
        join ${agents} on ${agents.id} = ${transactionAgents.agentId}
        where ${transactionAgents.transactionId} = ${transactions.id}
        order by ${transactionAgents.isPrimary} desc, ${transactionAgents.sortOrder}
        limit 1
      )`,
    })
    .from(transactionTasks)
    .innerJoin(transactions, eq(transactionTasks.transactionId, transactions.id))
    .where(
      and(
        notInArray(transactions.status, ['closed', 'cancelled']),
        or(
          and(
            isNotNull(transactionTasks.dueDate),
            lt(transactionTasks.dueDate, today),
            inArray(transactionTasks.status, ['pending', 'in_progress', 'overdue']),
          ),
          and(
            eq(transactionTasks.priority, 'urgent'),
            notInArray(transactionTasks.status, ['completed', 'waived', 'not_applicable']),
          ),
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
      agentName: sql<string | null>`(
        select ${agents.name} from ${transactionAgents}
        join ${agents} on ${agents.id} = ${transactionAgents.agentId}
        where ${transactionAgents.transactionId} = ${transactions.id}
        order by ${transactionAgents.isPrimary} desc, ${transactionAgents.sortOrder}
        limit 1
      )`,
    })
    .from(transactionTasks)
    .innerJoin(transactions, eq(transactionTasks.transactionId, transactions.id))
    .where(
      and(
        isNotNull(transactionTasks.dueDate),
        gte(transactionTasks.dueDate, today),
        notInArray(transactionTasks.status, ['completed', 'waived', 'not_applicable']),
        notInArray(transactions.status, ['closed', 'cancelled']),
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

// ─── Task Template CRUD (used by Templates page) ──────────────────────────────

export type TaskTemplateFormValues = {
  name: string;
  description?: string;
  category: string;
  templateGroupId: string;
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
    'listing',
  ]),
  templateGroupId: z.string().min(1, 'Template group is required'),
  relativeDueDays: z.number().int(),
  relativeTo: z.enum([
    'contract_date',
    'acceptance_date',
    'verification_of_funds_date',
    'earnest_money_due_date',
    'inspection_contingency_date',
    'insurance_contingency_date',
    'loan_contingency_date',
    'appraisal_contingency_date',
    'hoa_docs_due_date',
    'listing_active_date',
    'expected_close_date',
  ]),
  sortOrder: z.number().int().min(0),
  isRequired: z.boolean(),
  isActive: z.boolean(),
});

export async function getTaskTemplateGroups(): Promise<TaskTemplateGroup[]> {
  return db
    .select()
    .from(taskTemplateGroups)
    .orderBy(asc(taskTemplateGroups.sortOrder), asc(taskTemplateGroups.createdAt));
}

export type TemplateGroupOption = {
  id: string;
  name: string;
  isDefault: boolean;
  transactionType: string;
};

export async function getTemplateGroupsForSelect(
  transactionType: string,
): Promise<TemplateGroupOption[]> {
  const all = await db
    .select({
      id: taskTemplateGroups.id,
      name: taskTemplateGroups.name,
      isDefault: taskTemplateGroups.isDefault,
      transactionType: taskTemplateGroups.transactionType,
    })
    .from(taskTemplateGroups)
    .where(eq(taskTemplateGroups.isActive, true))
    .orderBy(asc(taskTemplateGroups.sortOrder));

  return all.filter(
    (g) => g.transactionType === transactionType || g.transactionType === 'all',
  );
}

export async function createTaskTemplateGroup(
  data: TemplateGroupFormValues,
): Promise<{ success: boolean; data?: TaskTemplateGroup; clonedTasks?: TaskTemplate[]; error?: string }> {
  const parsed = templateGroupSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid data' };
  }
  const v = parsed.data;
  try {
    const id = crypto.randomUUID();
    const now = new Date();
    await db.insert(taskTemplateGroups).values({
      id,
      name: v.name,
      description: v.description?.trim() || null,
      transactionType: v.transactionType,
      isDefault: false,
      isActive: true,
      sortOrder: v.sortOrder ?? 100,
      createdAt: now,
    });
    const [created] = await db
      .select()
      .from(taskTemplateGroups)
      .where(eq(taskTemplateGroups.id, id));

    // Clone tasks from the matching built-in group (if one exists for this type)
    let clonedTasks: TaskTemplate[] = [];
    if (v.transactionType !== 'all') {
      const [sourceGroup] = await db
        .select()
        .from(taskTemplateGroups)
        .where(
          and(
            eq(taskTemplateGroups.transactionType, v.transactionType),
            eq(taskTemplateGroups.isDefault, true),
          ),
        );

      if (sourceGroup) {
        const sourceTasks = await db
          .select()
          .from(taskTemplates)
          .where(eq(taskTemplates.templateGroupId, sourceGroup.id))
          .orderBy(asc(taskTemplates.sortOrder));

        if (sourceTasks.length > 0) {
          const cloneRows = sourceTasks.map((t) => ({
            id: crypto.randomUUID(),
            templateGroupId: id,
            name: t.name,
            description: t.description,
            category: t.category,
            relativeDueDays: t.relativeDueDays,
            relativeTo: t.relativeTo,
            sortOrder: t.sortOrder,
            isRequired: t.isRequired,
            isActive: t.isActive,
            createdAt: now,
          }));
          await db.insert(taskTemplates).values(cloneRows);
          clonedTasks = await db
            .select()
            .from(taskTemplates)
            .where(eq(taskTemplates.templateGroupId, id))
            .orderBy(asc(taskTemplates.sortOrder));
        }
      }
    }

    revalidatePath('/templates');
    return { success: true, data: created, clonedTasks };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Failed to create template' };
  }
}

export async function updateTaskTemplateGroup(
  id: string,
  data: TemplateGroupFormValues,
): Promise<{ success: boolean; data?: TaskTemplateGroup; error?: string }> {
  const parsed = templateGroupSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid data' };
  }
  const v = parsed.data;
  try {
    const [existing] = await db
      .select({ isDefault: taskTemplateGroups.isDefault })
      .from(taskTemplateGroups)
      .where(eq(taskTemplateGroups.id, id));
    if (!existing) return { success: false, error: 'Template group not found' };

    await db
      .update(taskTemplateGroups)
      .set({
        name: v.name,
        description: v.description?.trim() || null,
        // Don't allow changing transactionType on built-in groups
        ...(existing.isDefault ? {} : { transactionType: v.transactionType }),
        sortOrder: v.sortOrder ?? 100,
      })
      .where(eq(taskTemplateGroups.id, id));
    const [updated] = await db
      .select()
      .from(taskTemplateGroups)
      .where(eq(taskTemplateGroups.id, id));
    revalidatePath('/templates');
    return { success: true, data: updated };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Failed to update template' };
  }
}

export async function deleteTaskTemplateGroup(
  id: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const [group] = await db
      .select({ isDefault: taskTemplateGroups.isDefault })
      .from(taskTemplateGroups)
      .where(eq(taskTemplateGroups.id, id));
    if (!group) return { success: false, error: 'Template group not found' };
    if (group.isDefault) return { success: false, error: 'Built-in templates cannot be deleted' };

    await db.delete(taskTemplateGroups).where(eq(taskTemplateGroups.id, id));
    revalidatePath('/templates');
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Failed to delete template' };
  }
}

export async function toggleTaskTemplateGroupActive(
  id: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const [group] = await db
      .select({ isActive: taskTemplateGroups.isActive })
      .from(taskTemplateGroups)
      .where(eq(taskTemplateGroups.id, id));
    if (!group) return { success: false, error: 'Template group not found' };

    await db
      .update(taskTemplateGroups)
      .set({ isActive: !group.isActive })
      .where(eq(taskTemplateGroups.id, id));
    revalidatePath('/templates');
    return { success: true };
  } catch {
    return { success: false, error: 'Failed to update template group' };
  }
}

export async function getTaskTemplates(): Promise<TaskTemplate[]> {
  return db
    .select()
    .from(taskTemplates)
    .orderBy(asc(taskTemplates.sortOrder), desc(taskTemplates.createdAt));
}

export async function createTaskTemplatesMulti(
  data: Omit<TaskTemplateFormValues, 'templateGroupId'>,
  groupIds: string[],
): Promise<{ success: boolean; data?: TaskTemplate[]; error?: string }> {
  if (!groupIds.length) return { success: false, error: 'At least one template group is required' };

  const baseSchema = templateSchema.omit({ templateGroupId: true });
  const parsed = baseSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid data' };
  }
  const v = parsed.data;

  try {
    const rows = groupIds.map((gid) => ({
      id: crypto.randomUUID(),
      templateGroupId: gid,
      name: v.name,
      description: v.description?.trim() || null,
      category: v.category,
      relativeDueDays: v.relativeDueDays,
      relativeTo: v.relativeTo,
      sortOrder: v.sortOrder,
      isRequired: v.isRequired,
      isActive: v.isActive,
    }));

    await db.insert(taskTemplates).values(rows);

    const ids = rows.map((r) => r.id);
    const created = await db
      .select()
      .from(taskTemplates)
      .where(sql`${taskTemplates.id} IN (${sql.join(ids.map((id) => sql`${id}`), sql`, `)})`);

    revalidatePath('/templates');
    return { success: true, data: created };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create tasks';
    return { success: false, error: message };
  }
}

export async function createTaskTemplate(
  data: TaskTemplateFormValues,
): Promise<{ success: boolean; data?: TaskTemplate; error?: string }> {
  const parsed = templateSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid data' };
  }
  const v = parsed.data;

  try {
    const id = crypto.randomUUID();
    await db.insert(taskTemplates).values({
      id,
      templateGroupId: v.templateGroupId,
      name: v.name,
      description: v.description?.trim() || null,
      category: v.category,
      relativeDueDays: v.relativeDueDays,
      relativeTo: v.relativeTo,
      sortOrder: v.sortOrder,
      isRequired: v.isRequired,
      isActive: v.isActive,
    });
    const [created] = await db.select().from(taskTemplates).where(eq(taskTemplates.id, id));
    revalidatePath('/templates');
    return { success: true, data: created };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create task';
    return { success: false, error: message };
  }
}

export async function updateTaskTemplate(
  id: string,
  data: TaskTemplateFormValues,
): Promise<{ success: boolean; data?: TaskTemplate; error?: string }> {
  const parsed = templateSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid data' };
  }
  const v = parsed.data;

  try {
    await db
      .update(taskTemplates)
      .set({
        templateGroupId: v.templateGroupId,
        name: v.name,
        description: v.description?.trim() || null,
        category: v.category,
        relativeDueDays: v.relativeDueDays,
        relativeTo: v.relativeTo,
        sortOrder: v.sortOrder,
        isRequired: v.isRequired,
        isActive: v.isActive,
      })
      .where(eq(taskTemplates.id, id));
    const [updated] = await db.select().from(taskTemplates).where(eq(taskTemplates.id, id));
    revalidatePath('/templates');
    return { success: true, data: updated };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to update task';
    return { success: false, error: message };
  }
}

export async function deleteTaskTemplate(
  id: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const [template] = await db
      .select({ id: taskTemplates.id })
      .from(taskTemplates)
      .where(eq(taskTemplates.id, id));
    if (!template) return { success: false, error: 'Task not found' };

    await db.delete(taskTemplates).where(eq(taskTemplates.id, id));
    revalidatePath('/templates');
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Failed to delete task' };
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

    revalidatePath('/templates');
    return { success: true };
  } catch {
    return { success: false, error: 'Failed to update task' };
  }
}
