'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { TaskItem } from './task-item';
import { TaskForm } from './task-form';
import { reorderTransactionTasks } from '@/actions/tasks';
import type { TransactionTask } from '@/db/schema';

const CATEGORY_LABELS: Record<string, string> = {
  pre_escrow: 'Pre-Escrow',
  opening: 'Opening',
  disclosures: 'Disclosures',
  inspections: 'Inspections',
  contingencies: 'Contingencies',
  loan: 'Loan',
  appraisal: 'Appraisal',
  title: 'Title',
  closing: 'Closing',
  post_closing: 'Post-Closing',
};

const CATEGORY_ORDER = [
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
];

interface TaskChecklistProps {
  tasks: TransactionTask[];
  transactionId: string;
  canEdit?: boolean;
}

export function TaskChecklist({ tasks, transactionId, canEdit = false }: TaskChecklistProps) {
  const [addTaskOpen, setAddTaskOpen] = useState(false);
  const [localTasks, setLocalTasks] = useState<TransactionTask[]>(tasks);

  const completedCount = localTasks.filter((t) => t.status === 'completed').length;
  const totalCount = localTasks.length;
  const progressPct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  // Group tasks by category, sorted by sortOrder within each category
  const grouped = new Map<string, TransactionTask[]>();
  for (const task of localTasks) {
    const cat = task.category;
    if (!grouped.has(cat)) grouped.set(cat, []);
    grouped.get(cat)!.push(task);
  }
  for (const catTasks of grouped.values()) {
    catTasks.sort((a, b) => a.sortOrder - b.sortOrder);
  }

  // Sort categories by preferred order, unknowns appended last
  const sortedCategories = [
    ...CATEGORY_ORDER.filter((c) => grouped.has(c)),
    ...[...grouped.keys()].filter((c) => !CATEGORY_ORDER.includes(c)),
  ];

  function moveTask(category: string, taskId: string, direction: 'up' | 'down') {
    setLocalTasks((prev) => {
      const catTasks = [...prev]
        .filter((t) => t.category === category)
        .sort((a, b) => a.sortOrder - b.sortOrder);
      const idx = catTasks.findIndex((t) => t.id === taskId);
      if (direction === 'up' && idx <= 0) return prev;
      if (direction === 'down' && idx >= catTasks.length - 1) return prev;
      const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
      [catTasks[idx], catTasks[swapIdx]] = [catTasks[swapIdx], catTasks[idx]];
      const updated = catTasks.map((t, i) => ({ ...t, sortOrder: i * 10 }));
      const updateMap = new Map(updated.map((t) => [t.id, t.sortOrder]));
      reorderTransactionTasks(catTasks.map((t) => t.id));
      return prev.map((t) => {
        const so = updateMap.get(t.id);
        return so !== undefined ? { ...t, sortOrder: so } : t;
      });
    });
  }

  return (
    <>
      {/* Progress header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex-1 mr-4">
          <div className="flex justify-between text-sm mb-1.5">
            <span className="text-muted-foreground">
              {completedCount} of {totalCount} tasks complete
            </span>
            <span className="font-medium">{progressPct}%</span>
          </div>
          <Progress value={progressPct} className="h-2" />
        </div>
        {canEdit && (
          <Button size="sm" variant="outline" onClick={() => setAddTaskOpen(true)}>
            <Plus className="size-4 mr-1.5" />
            Add Task
          </Button>
        )}
      </div>

      {/* Task groups */}
      {totalCount === 0 ? (
        <div className="py-12 text-center text-muted-foreground">
          <p className="text-sm">No tasks yet.</p>
          <p className="text-xs mt-1">Tasks are stamped from templates when a transaction is created.</p>
        </div>
      ) : (
        <div className="rounded-md border divide-y overflow-hidden">
          {sortedCategories.map((category) => {
            const categoryTasks = grouped.get(category) ?? [];
            const catLabel = CATEGORY_LABELS[category] ?? category;
            const catCompleted = categoryTasks.filter((t) => t.status === 'completed').length;

            return (
              <div key={category}>
                <div className="flex items-center justify-between px-4 py-2 bg-muted/30">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    {catLabel}
                  </p>
                  <span className="text-xs text-muted-foreground">
                    {catCompleted}/{categoryTasks.length}
                  </span>
                </div>
                <div className="divide-y">
                  {categoryTasks.map((task, idx) => (
                    <TaskItem
                      key={task.id}
                      task={task}
                      onMoveUp={canEdit && idx > 0 ? () => moveTask(category, task.id, 'up') : undefined}
                      onMoveDown={canEdit && idx < categoryTasks.length - 1 ? () => moveTask(category, task.id, 'down') : undefined}
                      canEdit={canEdit}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <TaskForm transactionId={transactionId} open={addTaskOpen} onOpenChange={setAddTaskOpen} />
    </>
  );
}
