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
import { getViewerScope, transactionScopeCondition, tenantScopeCondition, requireTenantWrite } from '@/lib/access';
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

  const scope = await getViewerScope();
  const txScope = transactionScopeCondition(scope);
  // Outer tenant ring on the transactions join (every task query joins transactions).
  const tScope = tenantScopeCondition(scope, transactions.tenantId);

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
          txScope,
        tScope,
          tScope,
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
          txScope,
        tScope,
          tScope,
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
          txScope,
        tScope,
          tScope,
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
          txScope,
        tScope,
          tScope,
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
  const listScope = await getViewerScope();
  const txScope = transactionScopeCondition(listScope);
  const tScope = tenantScopeCondition(listScope, transactions.tenantId);

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
        txScope,
        tScope,
      ),
    )
    .orderBy(asc(transactionTasks.dueDate));

  return rows.map((r) => ({ ...r, address: r.address ?? '', agentName: r.agentName ?? null }));
}

// ─── Overdue & urgent tasks ───────────────────────────────────────────────────

export async function getOverdueTasks(): Promise<TaskWithTransaction[]> {
  const today = todayStr();
  const listScope = await getViewerScope();
  const txScope = transactionScopeCondition(listScope);
  const tScope = tenantScopeCondition(listScope, transactions.tenantId);

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
        txScope,
        tScope,
      ),
    )
    .orderBy(asc(transactionTasks.dueDate));

  return rows.map((r) => ({ ...r, address: r.address ?? '', agentName: r.agentName ?? null }));
}

// ─── Upcoming deadlines (next N tasks across all transactions) ────────────────

export async function getUpcomingDeadlines(limit = 10): Promise<TaskWithTransaction[]> {
  const today = todayStr();
  const listScope = await getViewerScope();
  const txScope = transactionScopeCondition(listScope);
  const tScope = tenantScopeCondition(listScope, transactions.tenantId);

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
        txScope,
        tScope,
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
  const tenant = await requireTenantWrite();
  if ('success' in tenant) return tenant;

  try {
    const updateData: {
      status: typeof status;
      updatedAt: Date;
      notes?: string;
      completedDate?: string;
    } = { status, updatedAt: new Date() };

    if (notes !== undefined) updateData.notes = notes;
    if (status === 'completed') updateData.completedDate = format(new Date(), 'yyyy-MM-dd');

    await db
      .update(transactionTasks)
      .set(updateData)
      .where(and(eq(transactionTasks.id, id), eq(transactionTasks.tenantId, tenant.tenantId)));

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
  const tenant = await requireTenantWrite();
  if ('success' in tenant) return tenant;

  try {
    // Parent transaction must be in this tenant (defends against forged id).
    const [parent] = await db
      .select({ id: transactions.id })
      .from(transactions)
      .where(and(eq(transactions.id, transactionId), eq(transactions.tenantId, tenant.tenantId)))
      .limit(1);
    if (!parent) return { success: false, error: 'Transaction not found' };

    const id = crypto.randomUUID();
    await db.insert(transactionTasks).values({
      id,
      tenantId: tenant.tenantId,
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
  const tenant = await requireTenantWrite();
  if ('success' in tenant) return tenant;

  try {
    await db
      .update(transactionTasks)
      .set({ dueDate: newDueDate, updatedAt: new Date() })
      .where(and(eq(transactionTasks.id, id), eq(transactionTasks.tenantId, tenant.tenantId)));

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
  const scope = await getViewerScope();
  return db
    .select()
    .from(taskTemplateGroups)
    .where(tenantScopeCondition(scope, taskTemplateGroups.tenantId))
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
  const scope = await getViewerScope();
  const all = await db
    .select({
      id: taskTemplateGroups.id,
      name: taskTemplateGroups.name,
      isDefault: taskTemplateGroups.isDefault,
      transactionType: taskTemplateGroups.transactionType,
    })
    .from(taskTemplateGroups)
    .where(and(eq(taskTemplateGroups.isActive, true), tenantScopeCondition(scope, taskTemplateGroups.tenantId)))
    .orderBy(asc(taskTemplateGroups.sortOrder));

  return all.filter(
    (g) => g.transactionType === transactionType || g.transactionType === 'all',
  );
}

export async function createTaskTemplateGroup(
  data: TemplateGroupFormValues,
): Promise<{ success: boolean; data?: TaskTemplateGroup; clonedTasks?: TaskTemplate[]; error?: string }> {
  const tenant = await requireTenantWrite();
  if ('success' in tenant) return tenant;
  const tenantId = tenant.tenantId;

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
      tenantId,
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
      .where(and(eq(taskTemplateGroups.id, id), eq(taskTemplateGroups.tenantId, tenantId)));

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
            eq(taskTemplateGroups.tenantId, tenantId),
          ),
        );

      if (sourceGroup) {
        const sourceTasks = await db
          .select()
          .from(taskTemplates)
          .where(and(eq(taskTemplates.templateGroupId, sourceGroup.id), eq(taskTemplates.tenantId, tenantId)))
          .orderBy(asc(taskTemplates.sortOrder));

        if (sourceTasks.length > 0) {
          const cloneRows = sourceTasks.map((t) => ({
            id: crypto.randomUUID(),
            tenantId,
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
            .where(and(eq(taskTemplates.templateGroupId, id), eq(taskTemplates.tenantId, tenantId)))
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
  const tenant = await requireTenantWrite();
  if ('success' in tenant) return tenant;
  const tenantId = tenant.tenantId;

  const parsed = templateGroupSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid data' };
  }
  const v = parsed.data;
  try {
    const [existing] = await db
      .select({ isDefault: taskTemplateGroups.isDefault })
      .from(taskTemplateGroups)
      .where(and(eq(taskTemplateGroups.id, id), eq(taskTemplateGroups.tenantId, tenantId)));
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
      .where(and(eq(taskTemplateGroups.id, id), eq(taskTemplateGroups.tenantId, tenantId)));
    const [updated] = await db
      .select()
      .from(taskTemplateGroups)
      .where(and(eq(taskTemplateGroups.id, id), eq(taskTemplateGroups.tenantId, tenantId)));
    revalidatePath('/templates');
    return { success: true, data: updated };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Failed to update template' };
  }
}

export async function deleteTaskTemplateGroup(
  id: string,
): Promise<{ success: boolean; error?: string }> {
  const tenant = await requireTenantWrite();
  if ('success' in tenant) return tenant;
  const tenantId = tenant.tenantId;

  try {
    const [group] = await db
      .select({ isDefault: taskTemplateGroups.isDefault })
      .from(taskTemplateGroups)
      .where(and(eq(taskTemplateGroups.id, id), eq(taskTemplateGroups.tenantId, tenantId)));
    if (!group) return { success: false, error: 'Template group not found' };
    if (group.isDefault) return { success: false, error: 'Built-in templates cannot be deleted' };

    // FK cascade by hand: detach stamped transaction tasks (so existing
    // transactions keep them as standalone custom tasks), then delete the
    // group's templates, then the group itself. Atomic via transaction.
    await db.transaction(async (tx) => {
      const groupTemplates = await tx
        .select({ id: taskTemplates.id })
        .from(taskTemplates)
        .where(and(eq(taskTemplates.templateGroupId, id), eq(taskTemplates.tenantId, tenantId)));

      if (groupTemplates.length > 0) {
        const templateIds = groupTemplates.map((t) => t.id);
        await tx
          .update(transactionTasks)
          .set({ templateId: null })
          .where(and(inArray(transactionTasks.templateId, templateIds), eq(transactionTasks.tenantId, tenantId)));
        await tx
          .delete(taskTemplates)
          .where(and(eq(taskTemplates.templateGroupId, id), eq(taskTemplates.tenantId, tenantId)));
      }

      await tx
        .delete(taskTemplateGroups)
        .where(and(eq(taskTemplateGroups.id, id), eq(taskTemplateGroups.tenantId, tenantId)));
    });

    revalidatePath('/templates');
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Failed to delete template' };
  }
}

export async function toggleTaskTemplateGroupActive(
  id: string,
): Promise<{ success: boolean; error?: string }> {
  const tenant = await requireTenantWrite();
  if ('success' in tenant) return tenant;
  const tenantId = tenant.tenantId;

  try {
    const [group] = await db
      .select({ isActive: taskTemplateGroups.isActive })
      .from(taskTemplateGroups)
      .where(and(eq(taskTemplateGroups.id, id), eq(taskTemplateGroups.tenantId, tenantId)));
    if (!group) return { success: false, error: 'Template group not found' };

    await db
      .update(taskTemplateGroups)
      .set({ isActive: !group.isActive })
      .where(and(eq(taskTemplateGroups.id, id), eq(taskTemplateGroups.tenantId, tenantId)));
    revalidatePath('/templates');
    return { success: true };
  } catch {
    return { success: false, error: 'Failed to update template group' };
  }
}

export async function getTaskTemplates(): Promise<TaskTemplate[]> {
  const scope = await getViewerScope();
  return db
    .select()
    .from(taskTemplates)
    .where(tenantScopeCondition(scope, taskTemplates.tenantId))
    .orderBy(asc(taskTemplates.sortOrder), desc(taskTemplates.createdAt));
}

export async function createTaskTemplatesMulti(
  data: Omit<TaskTemplateFormValues, 'templateGroupId'>,
  groupIds: string[],
): Promise<{ success: boolean; data?: TaskTemplate[]; error?: string }> {
  const tenant = await requireTenantWrite();
  if ('success' in tenant) return tenant;
  const tenantId = tenant.tenantId;

  if (!groupIds.length) return { success: false, error: 'At least one template group is required' };

  const baseSchema = templateSchema.omit({ templateGroupId: true });
  const parsed = baseSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid data' };
  }
  const v = parsed.data;

  try {
    // Only allow target groups that belong to this tenant (defends forged ids).
    const ownGroups = await db
      .select({ id: taskTemplateGroups.id })
      .from(taskTemplateGroups)
      .where(and(inArray(taskTemplateGroups.id, groupIds), eq(taskTemplateGroups.tenantId, tenantId)));
    const ownGroupIds = new Set(ownGroups.map((g) => g.id));
    const validGroupIds = groupIds.filter((g) => ownGroupIds.has(g));
    if (!validGroupIds.length) return { success: false, error: 'Template group not found' };

    const rows = validGroupIds.map((gid) => ({
      id: crypto.randomUUID(),
      tenantId,
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
      .where(and(
        sql`${taskTemplates.id} IN (${sql.join(ids.map((id) => sql`${id}`), sql`, `)})`,
        eq(taskTemplates.tenantId, tenantId),
      ));

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
  const tenant = await requireTenantWrite();
  if ('success' in tenant) return tenant;
  const tenantId = tenant.tenantId;

  const parsed = templateSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid data' };
  }
  const v = parsed.data;

  try {
    // Target group must be in this tenant.
    const [group] = await db
      .select({ id: taskTemplateGroups.id })
      .from(taskTemplateGroups)
      .where(and(eq(taskTemplateGroups.id, v.templateGroupId), eq(taskTemplateGroups.tenantId, tenantId)))
      .limit(1);
    if (!group) return { success: false, error: 'Template group not found' };

    const id = crypto.randomUUID();
    await db.insert(taskTemplates).values({
      id,
      tenantId,
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
    const [created] = await db
      .select()
      .from(taskTemplates)
      .where(and(eq(taskTemplates.id, id), eq(taskTemplates.tenantId, tenantId)));
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
  const tenant = await requireTenantWrite();
  if ('success' in tenant) return tenant;
  const tenantId = tenant.tenantId;

  const parsed = templateSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid data' };
  }
  const v = parsed.data;

  try {
    // Reassigned group (if any) must be in this tenant.
    const [group] = await db
      .select({ id: taskTemplateGroups.id })
      .from(taskTemplateGroups)
      .where(and(eq(taskTemplateGroups.id, v.templateGroupId), eq(taskTemplateGroups.tenantId, tenantId)))
      .limit(1);
    if (!group) return { success: false, error: 'Template group not found' };

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
      .where(and(eq(taskTemplates.id, id), eq(taskTemplates.tenantId, tenantId)));
    const [updated] = await db
      .select()
      .from(taskTemplates)
      .where(and(eq(taskTemplates.id, id), eq(taskTemplates.tenantId, tenantId)));
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
  const tenant = await requireTenantWrite();
  if ('success' in tenant) return tenant;
  const tenantId = tenant.tenantId;

  try {
    const [template] = await db
      .select({ id: taskTemplates.id })
      .from(taskTemplates)
      .where(and(eq(taskTemplates.id, id), eq(taskTemplates.tenantId, tenantId)));
    if (!template) return { success: false, error: 'Task not found' };

    // Detach any stamped transaction tasks before deleting the template
    // so existing transaction tasks survive as standalone (custom) tasks.
    await db
      .update(transactionTasks)
      .set({ templateId: null })
      .where(and(eq(transactionTasks.templateId, id), eq(transactionTasks.tenantId, tenantId)));

    await db.delete(taskTemplates).where(and(eq(taskTemplates.id, id), eq(taskTemplates.tenantId, tenantId)));
    revalidatePath('/templates');
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Failed to delete task' };
  }
}

export async function reorderTaskTemplates(
  orderedIds: string[],
): Promise<{ success: boolean; error?: string }> {
  const tenant = await requireTenantWrite();
  if ('success' in tenant) return tenant;
  const tenantId = tenant.tenantId;

  try {
    await Promise.all(
      orderedIds.map((id, i) =>
        db
          .update(taskTemplates)
          .set({ sortOrder: i * 10 })
          .where(and(eq(taskTemplates.id, id), eq(taskTemplates.tenantId, tenantId))),
      ),
    );
    revalidatePath('/templates');
    return { success: true };
  } catch {
    return { success: false, error: 'Failed to reorder tasks' };
  }
}

export async function reorderTransactionTasks(
  orderedIds: string[],
): Promise<{ success: boolean; error?: string }> {
  const tenant = await requireTenantWrite();
  if ('success' in tenant) return tenant;
  const tenantId = tenant.tenantId;

  try {
    await Promise.all(
      orderedIds.map((id, i) =>
        db
          .update(transactionTasks)
          .set({ sortOrder: i * 10 })
          .where(and(eq(transactionTasks.id, id), eq(transactionTasks.tenantId, tenantId))),
      ),
    );
    return { success: true };
  } catch {
    return { success: false, error: 'Failed to reorder tasks' };
  }
}

export async function toggleTaskTemplateActive(
  id: string,
): Promise<{ success: boolean; error?: string }> {
  const tenant = await requireTenantWrite();
  if ('success' in tenant) return tenant;
  const tenantId = tenant.tenantId;

  try {
    const [template] = await db
      .select({ isActive: taskTemplates.isActive })
      .from(taskTemplates)
      .where(and(eq(taskTemplates.id, id), eq(taskTemplates.tenantId, tenantId)));

    if (!template) return { success: false, error: 'Template not found' };

    await db
      .update(taskTemplates)
      .set({ isActive: !template.isActive })
      .where(and(eq(taskTemplates.id, id), eq(taskTemplates.tenantId, tenantId)));

    revalidatePath('/templates');
    return { success: true };
  } catch {
    return { success: false, error: 'Failed to update task' };
  }
}
