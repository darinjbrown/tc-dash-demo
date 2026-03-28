'use client';

import { useState, useTransition } from 'react';
import { format, parseISO, differenceInDays } from 'date-fns';
import { toast } from 'sonner';
import { CheckCircle2, Clock, AlertCircle, MinusCircle } from 'lucide-react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import type { TaskWithTransaction } from '@/actions/tasks';
import { updateTaskStatus } from '@/actions/tasks';

interface TodoListProps {
  title: string;
  tasks: TaskWithTransaction[];
  variant: 'upcoming' | 'overdue';
  emptyMessage?: string;
}

const PRIORITY_CONFIG = {
  urgent: { label: 'Urgent', className: 'bg-destructive text-destructive-foreground' },
  high: { label: 'High', className: 'bg-orange-500 text-white' },
  medium: { label: 'Medium', className: 'bg-secondary text-secondary-foreground' },
  low: { label: 'Low', className: 'bg-muted text-muted-foreground' },
} as const;

type Priority = keyof typeof PRIORITY_CONFIG;

function formatDueDate(dueDate: string | null, variant: 'upcoming' | 'overdue') {
  if (!dueDate) return { label: 'No date', className: 'text-muted-foreground' };
  const date = parseISO(dueDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = differenceInDays(date, today);

  if (variant === 'overdue') {
    const daysOverdue = Math.abs(diff);
    if (daysOverdue === 0) return { label: 'Due today', className: 'text-destructive font-medium' };
    return { label: `${daysOverdue}d overdue`, className: 'text-destructive font-medium' };
  }

  if (diff === 0) return { label: 'Due today', className: 'text-orange-600 font-medium' };
  if (diff === 1) return { label: 'Due tomorrow', className: 'text-orange-500' };
  return { label: format(date, 'MMM d'), className: 'text-muted-foreground' };
}

export function TodoList({ title, tasks, variant, emptyMessage }: TodoListProps) {
  const [selectedTask, setSelectedTask] = useState<TaskWithTransaction | null>(null);
  const [notes, setNotes] = useState('');
  const [isPending, startTransition] = useTransition();

  function openTask(task: TaskWithTransaction) {
    setSelectedTask(task);
    setNotes('');
  }

  function closeDialog() {
    if (!isPending) {
      setSelectedTask(null);
      setNotes('');
    }
  }

  function handleAction(status: 'completed' | 'waived') {
    if (!selectedTask) return;
    startTransition(async () => {
      const result = await updateTaskStatus(selectedTask.id, status, notes || undefined);
      if (result.success) {
        toast.success(status === 'completed' ? 'Task marked complete' : 'Task waived');
        setSelectedTask(null);
        setNotes('');
      } else {
        toast.error(result.error ?? 'Something went wrong');
      }
    });
  }

  return (
    <>
      <Card className="flex flex-col">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between text-base">
            <span className="flex items-center gap-2">
              {variant === 'overdue' ? (
                <AlertCircle className="size-4 text-destructive" />
              ) : (
                <Clock className="size-4 text-primary" />
              )}
              {title}
            </span>
            <Badge variant="secondary" className="text-xs font-normal">
              {tasks.length}
            </Badge>
          </CardTitle>
        </CardHeader>

        <CardContent className="flex-1 p-0">
          {tasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 px-6 text-center">
              <CheckCircle2 className="size-8 text-muted-foreground/40 mb-2" />
              <p className="text-sm text-muted-foreground">
                {emptyMessage ??
                  (variant === 'overdue'
                    ? 'No overdue or urgent tasks.'
                    : 'No tasks due this week.')}
              </p>
            </div>
          ) : (
            <ul className="divide-y">
              {tasks.map((task) => {
                const due = formatDueDate(task.dueDate, variant);
                const priority = (task.priority ?? 'medium') as Priority;
                const priorityCfg = PRIORITY_CONFIG[priority] ?? PRIORITY_CONFIG.medium;

                return (
                  <li key={task.id}>
                    <div className={cn(
                      'flex items-baseline gap-1.5 flex-wrap px-4 py-2.5',
                      variant === 'overdue' ? 'hover:bg-destructive/5' : 'hover:bg-muted/50',
                    )}>
                      <Link
                        href={`/transactions/${task.transactionId}`}
                        className="text-sm text-muted-foreground shrink-0 truncate max-w-30 hover:underline"
                      >
                        {task.address.split(',')[0]}
                      </Link>
                      <span className="text-muted-foreground/40 text-sm shrink-0">·</span>
                      <button
                        type="button"
                        className="text-sm font-medium truncate flex-1 text-left hover:underline"
                        onClick={() => openTask(task)}
                      >
                        {task.name}
                      </button>
                      <span className="text-muted-foreground/40 text-sm shrink-0">·</span>
                      <span className={cn('text-sm shrink-0', due.className)}>{due.label}</span>
                      {(priority === 'urgent' || priority === 'high') && (
                        <Badge className={cn('text-[10px] px-1.5 py-0 h-4 shrink-0', priorityCfg.className)}>
                          {priorityCfg.label}
                        </Badge>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selectedTask} onOpenChange={closeDialog}>
        {selectedTask && (
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-base leading-snug">{selectedTask.name}</DialogTitle>
              <DialogDescription className="text-sm">
                {selectedTask.address}
                {selectedTask.city ? `, ${selectedTask.city}` : ''}
                {selectedTask.agentName && (
                  <span className="block text-xs mt-0.5">Agent: {selectedTask.agentName}</span>
                )}
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-3 py-2">
              <div className="flex items-center gap-4 text-sm">
                <span className="text-muted-foreground w-16 shrink-0">Due</span>
                <span className={formatDueDate(selectedTask.dueDate, variant).className}>
                  {selectedTask.dueDate
                    ? format(parseISO(selectedTask.dueDate), 'MMMM d, yyyy')
                    : 'No date set'}
                </span>
              </div>
              <div className="flex items-center gap-4 text-sm">
                <span className="text-muted-foreground w-16 shrink-0">Priority</span>
                <Badge
                  className={cn(
                    'text-xs capitalize',
                    PRIORITY_CONFIG[(selectedTask.priority ?? 'medium') as Priority]?.className,
                  )}
                >
                  {selectedTask.priority}
                </Badge>
              </div>

              <div className="grid gap-1.5 mt-1">
                <Label htmlFor="task-notes" className="text-sm">
                  Notes (optional)
                </Label>
                <Textarea
                  id="task-notes"
                  placeholder="Add a note about this task..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  className="text-sm"
                />
              </div>
            </div>

            <DialogFooter className="flex-col-reverse sm:flex-row gap-2">
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => handleAction('waived')}
                disabled={isPending}
              >
                <MinusCircle className="size-4" />
                Waive Task
              </Button>
              <Button
                size="sm"
                className="gap-2"
                onClick={() => handleAction('completed')}
                disabled={isPending}
              >
                <CheckCircle2 className="size-4" />
                {isPending ? 'Saving...' : 'Mark Complete'}
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
    </>
  );
}
