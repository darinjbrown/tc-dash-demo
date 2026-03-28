'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Plus, Pencil, ToggleLeft, ToggleRight, ListChecks } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { TemplateForm } from '@/components/settings/template-form';
import { toggleTaskTemplateActive } from '@/actions/tasks';
import type { TaskTemplate } from '@/db/schema';

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
  listing: 'Listing',
};

const RELATIVE_TO_LABELS: Record<string, string> = {
  acceptance_date: 'Acceptance',
  escrow_open: 'Escrow Open',
  expected_close_date: 'Close Date',
  inspection_contingency_date: 'Inspection Contingency',
  appraisal_contingency_date: 'Appraisal Contingency',
  loan_contingency_date: 'Loan Contingency',
  listing_active_date: 'Listing Active',
};

export function TemplatesTab({ initialTemplates }: { initialTemplates: TaskTemplate[] }) {
  const [templates, setTemplates] = useState<TaskTemplate[]>(initialTemplates);
  const [formOpen, setFormOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<TaskTemplate | null>(null);
  const [, startTransition] = useTransition();

  function openCreate() {
    setEditingTemplate(null);
    setFormOpen(true);
  }

  function openEdit(t: TaskTemplate) {
    setEditingTemplate(t);
    setFormOpen(true);
  }

  function handleToggle(t: TaskTemplate) {
    startTransition(async () => {
      const result = await toggleTaskTemplateActive(t.id);
      if (result.success) {
        toast.success(t.isActive ? 'Template deactivated' : 'Template activated');
        setTemplates((prev) =>
          prev.map((item) => (item.id === t.id ? { ...item, isActive: !item.isActive } : item)),
        );
      } else {
        toast.error(result.error ?? 'Failed to update template');
      }
    });
  }

  function handleFormSuccess(updatedOrNew?: TaskTemplate) {
    if (updatedOrNew) {
      setTemplates((prev) => {
        const idx = prev.findIndex((t) => t.id === updatedOrNew.id);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = updatedOrNew;
          return next;
        }
        return [...prev, updatedOrNew];
      });
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {templates.length} templates &middot;{' '}
          {templates.filter((t) => t.isActive).length} active
        </p>
        <Button onClick={openCreate}>
          <Plus className="size-4 mr-2" />
          Add Template
        </Button>
      </div>

      <div className="rounded-lg border overflow-hidden">
        {templates.length === 0 ? (
          <div className="py-16 text-center text-muted-foreground">
            <ListChecks className="size-10 mx-auto mb-3 opacity-30" />
            <p className="font-medium">No templates yet</p>
            <p className="text-sm mt-1">Add task templates to stamp new transactions.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead className="hidden sm:table-cell">Category</TableHead>
                <TableHead className="hidden md:table-cell">Type</TableHead>
                <TableHead className="hidden lg:table-cell">Due</TableHead>
                <TableHead className="text-center">Active</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {templates.map((t) => (
                <TableRow key={t.id} className={t.isActive ? '' : 'opacity-50'}>
                  <TableCell>
                    <div className="font-medium text-sm">{t.name}</div>
                    {t.description && (
                      <div className="text-xs text-muted-foreground truncate max-w-[200px]">
                        {t.description}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <span className="text-sm">{CATEGORY_LABELS[t.category] ?? t.category}</span>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <Badge variant="outline" className="text-xs capitalize">
                      {t.transactionType}
                    </Badge>
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">
                    <span className="text-xs text-muted-foreground">
                      {t.relativeDueDays >= 0 ? '+' : ''}
                      {t.relativeDueDays}d from {RELATIVE_TO_LABELS[t.relativeTo] ?? t.relativeTo}
                    </span>
                  </TableCell>
                  <TableCell className="text-center">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2"
                      onClick={() => handleToggle(t)}
                    >
                      {t.isActive ? (
                        <ToggleRight className="size-4 text-green-600" />
                      ) : (
                        <ToggleLeft className="size-4 text-muted-foreground" />
                      )}
                      <span className="sr-only">{t.isActive ? 'Deactivate' : 'Activate'}</span>
                    </Button>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2"
                      onClick={() => openEdit(t)}
                    >
                      <Pencil className="size-3.5" />
                      <span className="sr-only">Edit</span>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <TemplateForm
        template={editingTemplate}
        open={formOpen}
        onOpenChange={setFormOpen}
        onSuccess={() => handleFormSuccess()}
      />
    </div>
  );
}
