'use client';

import { useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { createCustomTask } from '@/actions/tasks';

const taskFormSchema = z.object({
  name: z.string().min(1, 'Task name is required'),
  category: z.string().min(1, 'Category is required'),
  priority: z.enum(['low', 'medium', 'high', 'urgent']),
  dueDate: z.string().optional(),
  notes: z.string().optional(),
  assignedTo: z.string().optional(),
});

type TaskFormValues = z.infer<typeof taskFormSchema>;

interface TaskFormProps {
  transactionId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const CATEGORIES = [
  { value: 'pre_escrow', label: 'Pre-Escrow' },
  { value: 'opening', label: 'Opening' },
  { value: 'disclosures', label: 'Disclosures' },
  { value: 'inspections', label: 'Inspections' },
  { value: 'contingencies', label: 'Contingencies' },
  { value: 'loan', label: 'Loan' },
  { value: 'appraisal', label: 'Appraisal' },
  { value: 'title', label: 'Title' },
  { value: 'closing', label: 'Closing' },
  { value: 'post_closing', label: 'Post-Closing' },
];

export function TaskForm({ transactionId, open, onOpenChange }: TaskFormProps) {
  const [isPending, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    formState: { errors },
  } = useForm<TaskFormValues>({
    resolver: zodResolver(taskFormSchema),
    defaultValues: { priority: 'medium', category: 'closing' },
  });

  function onSubmit(data: TaskFormValues) {
    startTransition(async () => {
      const result = await createCustomTask(transactionId, {
        name: data.name,
        category: data.category,
        priority: data.priority,
        dueDate: data.dueDate || null,
        notes: data.notes || null,
        assignedTo: data.assignedTo || null,
      });

      if (result.success) {
        toast.success('Task added');
        onOpenChange(false);
        reset();
      } else {
        toast.error(result.error ?? 'Failed to add task');
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Custom Task</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="task-name">Task Name *</Label>
            <Input id="task-name" {...register('name')} placeholder="Enter task name" />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Category *</Label>
              <Select
                defaultValue="closing"
                onValueChange={(v) => setValue('category', v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Priority</Label>
              <Select
                defaultValue="medium"
                onValueChange={(v) => setValue('priority', v as TaskFormValues['priority'])}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="task-due">Due Date</Label>
              <Input id="task-due" type="date" {...register('dueDate')} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="task-assigned">Assigned To</Label>
              <Input id="task-assigned" {...register('assignedTo')} placeholder="Name" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="task-notes">Notes</Label>
            <Textarea id="task-notes" {...register('notes')} rows={2} placeholder="Optional notes..." />
          </div>

          <DialogFooter className="gap-2 flex-col-reverse sm:flex-row">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Adding...' : 'Add Task'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
