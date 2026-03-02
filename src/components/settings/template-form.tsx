'use client';

import { useTransition } from 'react';
import { useForm, Controller } from 'react-hook-form';
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
import { Checkbox } from '@/components/ui/checkbox';
import { createTaskTemplate, updateTaskTemplate } from '@/actions/tasks';
import type { TaskTemplateFormValues } from '@/actions/tasks';
import type { TaskTemplate } from '@/db/schema';

const templateFormSchema = z.object({
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

type FormValues = z.infer<typeof templateFormSchema>;

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

const RELATIVE_TO_OPTIONS = [
  { value: 'acceptance_date', label: 'Acceptance Date' },
  { value: 'escrow_open', label: 'Escrow Open Date' },
  { value: 'expected_close_date', label: 'Expected Close Date' },
  { value: 'inspection_contingency_date', label: 'Inspection Contingency' },
  { value: 'appraisal_contingency_date', label: 'Appraisal Contingency' },
  { value: 'loan_contingency_date', label: 'Loan Contingency' },
];

interface TemplateFormProps {
  template?: TaskTemplate | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function TemplateForm({ template, open, onOpenChange, onSuccess }: TemplateFormProps) {
  const [isPending, startTransition] = useTransition();
  const isEdit = !!template;

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(templateFormSchema),
    values: template
      ? {
          name: template.name,
          description: template.description ?? '',
          category: template.category,
          transactionType: template.transactionType,
          relativeDueDays: template.relativeDueDays,
          relativeTo: template.relativeTo,
          sortOrder: template.sortOrder,
          isRequired: template.isRequired,
          isActive: template.isActive,
        }
      : {
          name: '',
          description: '',
          category: 'closing' as const,
          transactionType: 'both' as const,
          relativeDueDays: 0,
          relativeTo: 'escrow_open' as const,
          sortOrder: 100,
          isRequired: true,
          isActive: true,
        },
  });

  function onSubmit(data: FormValues) {
    startTransition(async () => {
      const payload: TaskTemplateFormValues = {
        ...data,
        description: data.description || undefined,
      };

      if (isEdit) {
        const result = await updateTaskTemplate(template.id, payload);
        if (result.success) {
          toast.success('Template updated');
          onOpenChange(false);
          onSuccess();
        } else {
          toast.error(result.error ?? 'Failed to update template');
        }
      } else {
        const result = await createTaskTemplate(payload);
        if (result.success) {
          toast.success('Template created');
          onOpenChange(false);
          reset();
          onSuccess();
        } else {
          toast.error(result.error ?? 'Failed to create template');
        }
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Template' : 'Add Task Template'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="t-name">Task Name *</Label>
            <Input id="t-name" {...register('name')} placeholder="e.g. Open Escrow" />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="t-desc">Description</Label>
            <Textarea id="t-desc" {...register('description')} rows={2} placeholder="Optional details..." />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Category *</Label>
              <Controller
                name="category"
                control={control}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
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
                )}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Transaction Type *</Label>
              <Controller
                name="transactionType"
                control={control}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="both">Both</SelectItem>
                      <SelectItem value="listing">Listing Only</SelectItem>
                      <SelectItem value="purchase">Purchase Only</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="t-days">Due Days (±) *</Label>
              <Input
                id="t-days"
                type="number"
                {...register('relativeDueDays', { valueAsNumber: true })}
                placeholder="e.g. 3 or -7"
              />
              <p className="text-xs text-muted-foreground">Positive = after, negative = before milestone</p>
              {errors.relativeDueDays && (
                <p className="text-xs text-destructive">{errors.relativeDueDays.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>Relative To *</Label>
              <Controller
                name="relativeTo"
                control={control}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {RELATIVE_TO_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="t-sort">Sort Order</Label>
            <Input
              id="t-sort"
              type="number"
              {...register('sortOrder', { valueAsNumber: true })}
              placeholder="100"
            />
          </div>

          <div className="flex gap-6">
            <div className="flex items-center gap-2">
              <Controller
                name="isRequired"
                control={control}
                render={({ field }) => (
                  <Checkbox
                    id="t-required"
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                )}
              />
              <Label htmlFor="t-required" className="font-normal cursor-pointer">
                Required
              </Label>
            </div>

            <div className="flex items-center gap-2">
              <Controller
                name="isActive"
                control={control}
                render={({ field }) => (
                  <Checkbox
                    id="t-active"
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                )}
              />
              <Label htmlFor="t-active" className="font-normal cursor-pointer">
                Active
              </Label>
            </div>
          </div>

          <DialogFooter className="gap-2 flex-col-reverse sm:flex-row pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending
                ? isEdit
                  ? 'Saving...'
                  : 'Creating...'
                : isEdit
                  ? 'Save Changes'
                  : 'Create Template'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
