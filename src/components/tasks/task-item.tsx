'use client';

import { useState, useTransition } from 'react';
import { format, parseISO, differenceInDays } from 'date-fns';
import {
  CheckCircle2,
  Circle,
  MinusCircle,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  CalendarClock,
  Clock,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { updateTaskStatus, snoozeTask } from '@/actions/tasks';
import type { TransactionTask } from '@/db/schema';

const PRIORITY_BADGE: Record<string, string> = {
  urgent: 'bg-destructive text-destructive-foreground',
  high: 'bg-orange-500 text-white',
  medium: 'bg-secondary text-secondary-foreground',
  low: 'bg-muted text-muted-foreground',
};

const STATUS_BADGE: Record<string, string> = {
  completed: 'bg-green-100 text-green-800',
  waived: 'bg-gray-100 text-gray-600',
  not_applicable: 'bg-gray-100 text-gray-500',
  in_progress: 'bg-blue-100 text-blue-800',
  overdue: 'bg-red-100 text-red-800',
  pending: '',
};

function dueDateLabel(dueDate: string | null): { label: string; className: string } {
  if (!dueDate) return { label: '', className: '' };
  const date = parseISO(dueDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = differenceInDays(date, today);
  if (diff < 0) return { label: `${Math.abs(diff)}d overdue`, className: 'text-destructive' };
  if (diff === 0) return { label: 'Due today', className: 'text-orange-600 font-medium' };
  if (diff === 1) return { label: 'Due tomorrow', className: 'text-orange-500' };
  return { label: format(date, 'MMM d'), className: 'text-muted-foreground' };
}

interface TaskItemProps {
  task: TransactionTask;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
}

export function TaskItem({ task, onMoveUp, onMoveDown }: TaskItemProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [notes, setNotes] = useState(task.notes ?? '');
  const [snoozeDate, setSnoozeDate] = useState('');
  const [isPending, startTransition] = useTransition();

  const isTerminal = ['completed', 'waived', 'not_applicable'].includes(task.status);
  const due = dueDateLabel(task.dueDate);

  function handleStatusChange(
    status: 'pending' | 'in_progress' | 'completed' | 'overdue' | 'waived' | 'not_applicable',
  ) {
    startTransition(async () => {
      const result = await updateTaskStatus(task.id, status, notes || undefined);
      if (result.success) {
        toast.success(
          status === 'completed'
            ? 'Task completed'
            : status === 'waived'
              ? 'Task waived'
              : status === 'not_applicable'
                ? 'Marked N/A'
                : 'Task updated',
        );
        setIsOpen(false);
      } else {
        toast.error(result.error ?? 'Failed to update task');
      }
    });
  }

  function handleSnooze() {
    if (!snoozeDate) return;
    startTransition(async () => {
      const result = await snoozeTask(task.id, snoozeDate);
      if (result.success) {
        toast.success('Task rescheduled');
        setSnoozeDate('');
        setIsOpen(false);
      } else {
        toast.error(result.error ?? 'Failed to snooze task');
      }
    });
  }

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <div
          className={cn(
            'flex items-start gap-3 px-4 py-3 cursor-pointer hover:bg-muted/40 transition-colors',
            isTerminal && 'opacity-60',
          )}
        >
          {/* Status icon */}
          <button
            type="button"
            className="mt-0.5 shrink-0"
            onClick={(e) => {
              e.stopPropagation();
              if (!isTerminal) handleStatusChange('completed');
            }}
            disabled={isPending || isTerminal}
            title={isTerminal ? task.status : 'Mark complete'}
          >
            {task.status === 'completed' ? (
              <CheckCircle2 className="size-4 text-green-600" />
            ) : task.status === 'waived' || task.status === 'not_applicable' ? (
              <MinusCircle className="size-4 text-muted-foreground" />
            ) : (
              <Circle className="size-4 text-muted-foreground hover:text-primary transition-colors" />
            )}
          </button>

          {/* Task info */}
          <div className="flex-1 min-w-0">
            <p
              className={cn(
                'text-sm font-medium truncate',
                task.status === 'completed' && 'line-through text-muted-foreground',
              )}
            >
              {task.name}
            </p>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              {due.label && (
                <span className={cn('text-xs flex items-center gap-1', due.className)}>
                  <Clock className="size-3" />
                  {due.label}
                </span>
              )}
              {(task.priority === 'urgent' || task.priority === 'high') && (
                <Badge
                  className={cn(
                    'text-[10px] px-1.5 py-0 h-4 capitalize',
                    PRIORITY_BADGE[task.priority] ?? '',
                  )}
                >
                  {task.priority}
                </Badge>
              )}
              {task.status !== 'pending' && (
                <Badge
                  variant="outline"
                  className={cn(
                    'text-[10px] px-1.5 py-0 h-4 capitalize',
                    STATUS_BADGE[task.status] ?? '',
                  )}
                >
                  {task.status.replace('_', ' ')}
                </Badge>
              )}
              {task.assignedTo && (
                <span className="text-xs text-muted-foreground truncate">→ {task.assignedTo}</span>
              )}
            </div>
          </div>

          {(onMoveUp !== undefined || onMoveDown !== undefined) && (
            <div
              className="flex flex-col shrink-0"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                className="p-0.5 rounded hover:bg-muted disabled:opacity-20"
                onClick={onMoveUp}
                disabled={!onMoveUp}
                title="Move up"
              >
                <ChevronUp className="size-3.5 text-muted-foreground" />
              </button>
              <button
                type="button"
                className="p-0.5 rounded hover:bg-muted disabled:opacity-20"
                onClick={onMoveDown}
                disabled={!onMoveDown}
                title="Move down"
              >
                <ChevronDown className="size-3.5 text-muted-foreground" />
              </button>
            </div>
          )}

          {isOpen ? (
            <ChevronDown className="size-4 text-muted-foreground shrink-0 mt-0.5" />
          ) : (
            <ChevronRight className="size-4 text-muted-foreground shrink-0 mt-0.5" />
          )}
        </div>
      </CollapsibleTrigger>

      <CollapsibleContent>
        <div className="px-11 pb-4 space-y-3">
          {task.description && (
            <p className="text-sm text-muted-foreground">{task.description}</p>
          )}

          <div className="space-y-1.5">
            <Label className="text-xs">Notes</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Add notes..."
              className="text-sm"
            />
          </div>

          {!isTerminal && (
            <div className="space-y-1.5">
              <Label className="text-xs flex items-center gap-1">
                <CalendarClock className="size-3" />
                Reschedule
              </Label>
              <div className="flex gap-2">
                <Input
                  type="date"
                  value={snoozeDate}
                  onChange={(e) => setSnoozeDate(e.target.value)}
                  className="h-8 text-sm"
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleSnooze}
                  disabled={!snoozeDate || isPending}
                >
                  Reschedule
                </Button>
              </div>
            </div>
          )}

          {!isTerminal && (
            <div className="flex flex-wrap gap-2 pt-1">
              <Button
                size="sm"
                onClick={() => handleStatusChange('completed')}
                disabled={isPending}
              >
                <CheckCircle2 className="size-4 mr-1.5" />
                {isPending ? 'Saving...' : 'Complete'}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleStatusChange('not_applicable')}
                disabled={isPending}
              >
                N/A
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleStatusChange('waived')}
                disabled={isPending}
              >
                <MinusCircle className="size-4 mr-1.5" />
                Waive
              </Button>
            </div>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
