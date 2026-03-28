'use client';

import { useState, useTransition } from 'react';
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
import { createTaskTemplatesMulti, updateTaskTemplate } from '@/actions/tasks';
import type { TaskTemplateFormValues } from '@/actions/tasks';
import type { TaskTemplate, TaskTemplateGroup } from '@/db/schema';

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
    'listing',
  ]),
  templateGroupId: z.string().min(1),
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

type FormValues = z.infer<typeof templateFormSchema>;

const CATEGORIES = [
  { value: 'listing', label: 'Listing' },
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
  { value: 'contract_date', label: 'Contract Date' },
  { value: 'acceptance_date', label: 'Acceptance Date' },
  { value: 'verification_of_funds_date', label: 'Verification of Funds Due' },
  { value: 'earnest_money_due_date', label: 'Earnest Money Due' },
  { value: 'inspection_contingency_date', label: 'Inspection Contingency' },
  { value: 'insurance_contingency_date', label: 'Insurance Contingency' },
  { value: 'loan_contingency_date', label: 'Loan Contingency' },
  { value: 'appraisal_contingency_date', label: 'Appraisal Contingency' },
  { value: 'hoa_docs_due_date', label: 'HOA Docs Due' },
  { value: 'listing_active_date', label: 'Listing Active Date' },
  { value: 'expected_close_date', label: 'Expected Close Date' },
];

interface TemplateFormProps {
  template?: TaskTemplate | null;
  templateGroupId: string;
  allGroups: TaskTemplateGroup[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (tasks: TaskTemplate[]) => void;
}

export function TemplateForm({
  template,
  templateGroupId,
  allGroups,
  open,
  onOpenChange,
  onSuccess,
}: TemplateFormProps) {
  const [isPending, startTransition] = useTransition();
  const isEdit = !!template;

  // Multi-group selection — create mode only
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([templateGroupId]);

  // Reset selected groups when the dialog opens
  function handleOpenChange(val: boolean) {
    if (val) setSelectedGroupIds([templateGroupId]);
    onOpenChange(val);
  }

  function toggleGroup(id: string) {
    setSelectedGroupIds((prev) =>
      prev.includes(id) ? prev.filter((g) => g !== id) : [...prev, id],
    );
  }

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
          templateGroupId: template.templateGroupId ?? templateGroupId,
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
          templateGroupId,
          relativeDueDays: 0,
          relativeTo: 'acceptance_date' as const,
          sortOrder: 100,
          isRequired: true,
          isActive: true,
        },
  });

  function onSubmit(data: FormValues) {
    startTransition(async () => {
      if (isEdit) {
        const payload: TaskTemplateFormValues = {
          ...data,
          description: data.description || undefined,
        };
        const result = await updateTaskTemplate(template.id, payload);
        if (result.success && result.data) {
          toast.success('Task updated');
          onOpenChange(false);
          onSuccess([result.data]);
        } else {
          toast.error(result.error ?? 'Failed to update task');
        }
      } else {
        if (selectedGroupIds.length === 0) {
          toast.error('Select at least one template group');
          return;
        }
        const { templateGroupId: _ignored, ...rest } = data;
        const result = await createTaskTemplatesMulti(
          { ...rest, description: rest.description || undefined },
          selectedGroupIds,
        );
        if (result.success && result.data) {
          toast.success(
            result.data.length === 1
              ? 'Task created'
              : `Task created in ${result.data.length} templates`,
          );
          onOpenChange(false);
          reset();
          onSuccess(result.data);
        } else {
          toast.error(result.error ?? 'Failed to create task');
        }
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Task' : 'Add Task'}</DialogTitle>
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

          {/* Template group — single select in edit mode, multi-checkbox in create mode */}
          {isEdit ? (
            <div className="space-y-1.5">
              <Label>Template Group *</Label>
              <Controller
                name="templateGroupId"
                control={control}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {allGroups.map((g) => (
                        <SelectItem key={g.id} value={g.id}>
                          {g.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label>Add to Templates *</Label>
              <div className="rounded-md border divide-y">
                {allGroups.map((g) => (
                  <label
                    key={g.id}
                    className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-muted/50"
                  >
                    <Checkbox
                      checked={selectedGroupIds.includes(g.id)}
                      onCheckedChange={() => toggleGroup(g.id)}
                    />
                    <span className="text-sm font-medium">{g.name}</span>
                  </label>
                ))}
              </div>
              {selectedGroupIds.length === 0 && (
                <p className="text-xs text-destructive">Select at least one template</p>
              )}
            </div>
          )}

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
            <p className="text-xs text-muted-foreground">Lower numbers appear first. Tasks are sorted relative to each other (e.g. 10, 20, 30).</p>
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
            <Button type="submit" disabled={isPending || (!isEdit && selectedGroupIds.length === 0)}>
              {isPending
                ? isEdit
                  ? 'Saving...'
                  : 'Adding...'
                : isEdit
                  ? 'Save Task'
                  : 'Add Task'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
