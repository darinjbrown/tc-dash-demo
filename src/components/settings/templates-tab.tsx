'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Plus, Pencil, ToggleLeft, ToggleRight, ListChecks, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { TemplateForm } from '@/components/settings/template-form';
import {
  toggleTaskTemplateActive,
  deleteTaskTemplate,
  createTaskTemplateGroup,
  updateTaskTemplateGroup,
  deleteTaskTemplateGroup,
} from '@/actions/tasks';
import type { TaskTemplate, TaskTemplateGroup } from '@/db/schema';

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

const TX_TYPE_LABELS: Record<string, string> = {
  listing: 'Listing',
  purchase: 'Purchase',
  dual: 'Dual Agency',
  all: 'All',
};

// ─── Group form dialog ─────────────────────────────────────────────────────────

interface GroupFormDialogProps {
  group?: TaskTemplateGroup | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (group: TaskTemplateGroup, clonedTasks?: TaskTemplate[]) => void;
}

function GroupFormDialog({ group, open, onOpenChange, onSuccess }: GroupFormDialogProps) {
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState(group?.name ?? '');
  const [description, setDescription] = useState(group?.description ?? '');
  const [transactionType, setTransactionType] = useState<'listing' | 'purchase' | 'dual' | 'all'>(
    (group?.transactionType as 'listing' | 'purchase' | 'dual' | 'all') ?? 'listing',
  );
  const isEdit = !!group;
  const isDefault = group?.isDefault ?? false;

  // Reset local state when dialog opens with new data
  const handleOpenChange = (val: boolean) => {
    if (val) {
      setName(group?.name ?? '');
      setDescription(group?.description ?? '');
      setTransactionType(
        (group?.transactionType as 'listing' | 'purchase' | 'dual' | 'all') ?? 'listing',
      );
    }
    onOpenChange(val);
  };

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const data = { name, description: description || undefined, transactionType };
      if (isEdit) {
        const result = await updateTaskTemplateGroup(group.id, data);
        if (result.success && result.data) {
          toast.success('Template updated');
          onOpenChange(false);
          onSuccess(result.data);
        } else {
          toast.error(result.error ?? 'Failed to update template');
        }
      } else {
        const result = await createTaskTemplateGroup(data);
        if (result.success && result.data) {
          const count = result.clonedTasks?.length ?? 0;
          toast.success(count > 0 ? `Template created with ${count} cloned tasks` : 'Template created');
          onOpenChange(false);
          setName('');
          setDescription('');
          setTransactionType('listing');
          onSuccess(result.data, result.clonedTasks);
        } else {
          toast.error(result.error ?? 'Failed to create template');
        }
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Template' : 'Add Template'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="g-name">Template Name *</Label>
            <Input
              id="g-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Listing Template"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="g-desc">Description</Label>
            <Input
              id="g-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Transaction Type *</Label>
            <Select
              value={transactionType}
              onValueChange={(v) =>
                setTransactionType(v as 'listing' | 'purchase' | 'dual' | 'all')
              }
              disabled={isDefault}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="listing">Listing</SelectItem>
                <SelectItem value="purchase">Purchase</SelectItem>
                <SelectItem value="dual">Dual Agency</SelectItem>
                <SelectItem value="all">All Transactions</SelectItem>
              </SelectContent>
            </Select>
            {isDefault && (
              <p className="text-xs text-muted-foreground">
                Transaction type cannot be changed for built-in templates.
              </p>
            )}
          </div>
          <DialogFooter className="gap-2 flex-col-reverse sm:flex-row pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending || !name.trim()}>
              {isPending ? 'Saving...' : isEdit ? 'Save Template' : 'Add Template'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Task list for one group ───────────────────────────────────────────────────

interface GroupTaskListProps {
  group: TaskTemplateGroup;
  allGroups: TaskTemplateGroup[];
  tasks: TaskTemplate[];
  onTaskChange: (tasks: TaskTemplate[], isNew: boolean) => void;
  onToggle: (task: TaskTemplate) => void;
  onDelete: (task: TaskTemplate) => void;
}

function GroupTaskList({ group, allGroups, tasks, onTaskChange, onToggle, onDelete }: GroupTaskListProps) {
  const [formOpen, setFormOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<TaskTemplate | null>(null);
  const [deletingTask, setDeletingTask] = useState<TaskTemplate | null>(null);

  function openCreate() {
    setEditingTask(null);
    setFormOpen(true);
  }

  function openEdit(t: TaskTemplate) {
    setEditingTask(t);
    setFormOpen(true);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {tasks.length} {tasks.length === 1 ? 'task' : 'tasks'} &middot;{' '}
          {tasks.filter((t) => t.isActive).length} active
        </p>
        <Button size="sm" onClick={openCreate}>
          <Plus className="size-4 mr-1.5" />
          Add Task
        </Button>
      </div>

      <div className="rounded-lg border overflow-hidden">
        {tasks.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground">
            <ListChecks className="size-8 mx-auto mb-2 opacity-30" />
            <p className="font-medium text-sm">No tasks yet</p>
            <p className="text-xs mt-1">Add tasks to this template.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead className="hidden sm:table-cell">Category</TableHead>
                <TableHead className="hidden lg:table-cell">Due</TableHead>
                <TableHead className="text-center">Active</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tasks.map((t) => (
                <TableRow key={t.id} className={t.isActive ? '' : 'opacity-50'}>
                  <TableCell>
                    <div className="font-medium text-sm">{t.name}</div>
                    {t.description && (
                      <div className="text-xs text-muted-foreground truncate max-w-50">
                        {t.description}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <span className="text-sm">{CATEGORY_LABELS[t.category] ?? t.category}</span>
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
                      onClick={() => onToggle(t)}
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
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2"
                        onClick={() => openEdit(t)}
                      >
                        <Pencil className="size-3.5" />
                        <span className="sr-only">Edit</span>
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2 text-destructive hover:text-destructive"
                        onClick={() => setDeletingTask(t)}
                      >
                        <Trash2 className="size-3.5" />
                        <span className="sr-only">Delete</span>
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <TemplateForm
        template={editingTask}
        templateGroupId={group.id}
        allGroups={allGroups}
        open={formOpen}
        onOpenChange={setFormOpen}
        onSuccess={(tasks) => onTaskChange(tasks, !editingTask)}
      />

      <AlertDialog open={!!deletingTask} onOpenChange={(open) => !open && setDeletingTask(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete task?</AlertDialogTitle>
            <AlertDialogDescription>
              &ldquo;{deletingTask?.name}&rdquo; will be permanently deleted. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (deletingTask) {
                  onDelete(deletingTask);
                  setDeletingTask(null);
                }
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─── Main TemplatesTab ─────────────────────────────────────────────────────────

interface TemplatesTabProps {
  initialGroups: TaskTemplateGroup[];
  initialTemplates: TaskTemplate[];
}

export function TemplatesTab({ initialGroups, initialTemplates }: TemplatesTabProps) {
  const [groups, setGroups] = useState<TaskTemplateGroup[]>(initialGroups);
  const [templates, setTemplates] = useState<TaskTemplate[]>(initialTemplates);
  const [groupFormOpen, setGroupFormOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<TaskTemplateGroup | null>(null);
  const [activeTab, setActiveTab] = useState(initialGroups[0]?.id ?? '');
  const [, startTransition] = useTransition();

  function handleGroupSuccess(group: TaskTemplateGroup, clonedTasks?: TaskTemplate[]) {
    setGroups((prev) => {
      const idx = prev.findIndex((g) => g.id === group.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = group;
        return next;
      }
      return [...prev, group];
    });
    if (clonedTasks && clonedTasks.length > 0) {
      setTemplates((prev) => [...prev, ...clonedTasks]);
    }
    setActiveTab(group.id);
  }

  function handleTaskChange(changed: TaskTemplate[], isNew: boolean) {
    setTemplates((prev) => {
      if (isNew) return [...prev, ...changed];
      // edit: changed contains exactly one updated task
      const updated = changed[0];
      if (!updated) return prev;
      const idx = prev.findIndex((t) => t.id === updated.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = updated;
        return next;
      }
      return prev;
    });
  }

  function handleToggleTask(t: TaskTemplate) {
    startTransition(async () => {
      const result = await toggleTaskTemplateActive(t.id);
      if (result.success) {
        toast.success(t.isActive ? 'Task deactivated' : 'Task activated');
        setTemplates((prev) =>
          prev.map((item) => (item.id === t.id ? { ...item, isActive: !item.isActive } : item)),
        );
      } else {
        toast.error(result.error ?? 'Failed to update task');
      }
    });
  }

  function handleDeleteTask(task: TaskTemplate) {
    startTransition(async () => {
      const result = await deleteTaskTemplate(task.id);
      if (result.success) {
        toast.success('Task deleted');
        setTemplates((prev) => prev.filter((t) => t.id !== task.id));
      } else {
        toast.error(result.error ?? 'Failed to delete task');
      }
    });
  }

  function handleDeleteGroup(group: TaskTemplateGroup) {
    startTransition(async () => {
      const result = await deleteTaskTemplateGroup(group.id);
      if (result.success) {
        toast.success('Template deleted');
        const remaining = groups.filter((g) => g.id !== group.id);
        setGroups(remaining);
        if (activeTab === group.id) setActiveTab(remaining[0]?.id ?? '');
      } else {
        toast.error(result.error ?? 'Failed to delete template');
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {groups.length} {groups.length === 1 ? 'template' : 'templates'}
        </p>
        <Button
          onClick={() => {
            setEditingGroup(null);
            setGroupFormOpen(true);
          }}
        >
          <Plus className="size-4 mr-2" />
          Add Template
        </Button>
      </div>

      {groups.length === 0 ? (
        <div className="rounded-lg border py-16 text-center text-muted-foreground">
          <ListChecks className="size-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No templates yet</p>
          <p className="text-sm mt-1">Add a template to get started.</p>
        </div>
      ) : (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <div className="flex items-center gap-2 overflow-x-auto">
            <TabsList className="shrink-0">
              {groups.map((g) => {
                const count = templates.filter((t) => t.templateGroupId === g.id).length;
                return (
                  <TabsTrigger key={g.id} value={g.id} className="gap-1.5">
                    {g.name}
                    <Badge variant="secondary" className="text-xs h-4 px-1.5 min-w-5">
                      {count}
                    </Badge>
                  </TabsTrigger>
                );
              })}
            </TabsList>
          </div>

          {groups.map((g) => {
            const groupTasks = templates.filter((t) => t.templateGroupId === g.id);
            return (
              <TabsContent key={g.id} value={g.id} className="mt-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">
                    {TX_TYPE_LABELS[g.transactionType] ?? g.transactionType}
                  </Badge>
                  {g.description && (
                    <span className="text-xs text-muted-foreground">{g.description}</span>
                  )}
                  <div className="flex items-center gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2"
                      disabled={g.isDefault}
                      title={g.isDefault ? 'Built-in templates cannot be edited' : undefined}
                      onClick={() => {
                        setEditingGroup(g);
                        setGroupFormOpen(true);
                      }}
                    >
                      <Pencil className="size-3.5" />
                      <span className="sr-only">Edit template</span>
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 text-destructive hover:text-destructive"
                      disabled={g.isDefault}
                      title={g.isDefault ? 'Built-in templates cannot be deleted' : undefined}
                      onClick={() => !g.isDefault && handleDeleteGroup(g)}
                    >
                      <Trash2 className="size-3.5" />
                      <span className="sr-only">Delete template</span>
                    </Button>
                  </div>
                </div>

                <GroupTaskList
                  group={g}
                  allGroups={groups}
                  tasks={groupTasks}
                  onTaskChange={handleTaskChange}
                  onToggle={handleToggleTask}
                  onDelete={handleDeleteTask}
                />
              </TabsContent>
            );
          })}
        </Tabs>
      )}

      <GroupFormDialog
        group={editingGroup}
        open={groupFormOpen}
        onOpenChange={setGroupFormOpen}
        onSuccess={(group, clonedTasks) => handleGroupSuccess(group, clonedTasks)}
      />
    </div>
  );
}
