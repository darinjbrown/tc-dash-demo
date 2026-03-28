import { addDays, parseISO, format } from 'date-fns';
import type { TaskTemplate, TaskTemplateGroup, Transaction } from '@/db/schema';

// Map relativeTo keys to transaction fields
function getMilestoneDate(tx: Transaction, relativeTo: string): string | null {
  switch (relativeTo) {
    case 'acceptance_date':
      return tx.acceptanceDate ?? null;
    case 'escrow_open':
      return tx.escrowOpenDate ?? null;
    case 'expected_close_date':
      return tx.expectedCloseDate ?? null;
    case 'inspection_contingency_date':
      return tx.inspectionContingencyDate ?? null;
    case 'appraisal_contingency_date':
      return tx.appraisalContingencyDate ?? null;
    case 'loan_contingency_date':
      return tx.loanContingencyDate ?? null;
    case 'listing_active_date':
      return tx.listingActiveDate ?? null;
    default:
      return null;
  }
}

export function calculateDueDate(
  milestoneDate: string | null,
  relativeDueDays: number,
): string | null {
  if (!milestoneDate) return null;
  return format(addDays(parseISO(milestoneDate), relativeDueDays), 'yyyy-MM-dd');
}

export type StampedTask = {
  transactionId: string;
  templateId: string;
  name: string;
  description: string | null;
  category: string;
  dueDate: string | null;
  completedDate: null;
  status: 'pending';
  assignedTo: null;
  priority: 'medium';
  notes: null;
  sortOrder: number;
};

function getApplicableGroupIds(
  transactionType: string,
  groups: TaskTemplateGroup[],
): Set<string> {
  const active = groups.filter((g) => g.isActive);
  if (transactionType === 'dual') {
    // Dual agency group is self-contained (populated via repair-dual-tasks.ts).
    // Also include 'all' groups for any shared additions, but do NOT inherit
    // listing/purchase groups — the dual group already contains those tasks.
    return new Set(
      active
        .filter((g) => g.transactionType === 'dual' || g.transactionType === 'all')
        .map((g) => g.id),
    );
  }
  return new Set(
    active
      .filter((g) => g.transactionType === transactionType || g.transactionType === 'all')
      .map((g) => g.id),
  );
}

// Stamp task templates onto a transaction, calculating due dates from milestone dates.
// Only includes templates belonging to groups that match the transaction type.
export function stampTasks(
  transaction: Transaction,
  templates: TaskTemplate[],
  groups: TaskTemplateGroup[],
): StampedTask[] {
  const applicableGroupIds = getApplicableGroupIds(transaction.transactionType, groups);

  const applicable = templates.filter(
    (t) => t.isActive && t.templateGroupId !== null && applicableGroupIds.has(t.templateGroupId),
  );

  return applicable.map((t) => ({
    transactionId: transaction.id,
    templateId: t.id,
    name: t.name,
    description: t.description ?? null,
    category: t.category,
    dueDate: calculateDueDate(getMilestoneDate(transaction, t.relativeTo), t.relativeDueDays),
    completedDate: null,
    status: 'pending' as const,
    assignedTo: null,
    priority: 'medium' as const,
    notes: null,
    sortOrder: t.sortOrder,
  }));
}

// Recalculate due dates for all template-based tasks after milestone dates change.
// Returns an array of { id, dueDate } updates to apply.
export function recalculateTaskDueDates(
  tasks: Array<{ id: string; templateId: string | null }>,
  templates: TaskTemplate[],
  transaction: Transaction,
): Array<{ id: string; dueDate: string | null }> {
  const templateMap = new Map(templates.map((t) => [t.id, t]));
  return tasks
    .filter((task) => task.templateId !== null)
    .map((task) => {
      const template = templateMap.get(task.templateId!);
      if (!template) return { id: task.id, dueDate: null };
      const milestoneDate = getMilestoneDate(transaction, template.relativeTo);
      return {
        id: task.id,
        dueDate: calculateDueDate(milestoneDate, template.relativeDueDays),
      };
    });
}
