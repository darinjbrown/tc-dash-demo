'use client';

import { useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Plus, Pencil, ToggleLeft, ToggleRight, ListChecks, Palette, User } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { BrandToggle } from './brand-toggle';
import { TemplateForm } from '@/components/settings/template-form';
import { updateProfile, changePassword } from '@/actions/users';
import { toggleTaskTemplateActive } from '@/actions/tasks';
import type { TaskTemplate } from '@/db/schema';

// ─── Profile Tab ──────────────────────────────────────────────────────────────

const profileSchema = z.object({ name: z.string().min(1, 'Name is required') });
const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z.string().min(8, 'Password must be at least 8 characters'),
    confirmPassword: z.string(),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
  });

type ProfileValues = z.infer<typeof profileSchema>;
type PasswordValues = z.infer<typeof passwordSchema>;

function ProfileTab({ user }: { user: { name: string | null; email: string } }) {
  const [profilePending, startProfileTransition] = useTransition();
  const [passwordPending, startPasswordTransition] = useTransition();

  const {
    register: regProfile,
    handleSubmit: handleProfileSubmit,
    formState: { errors: profileErrors },
  } = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: { name: user.name ?? '' },
  });

  const {
    register: regPw,
    handleSubmit: handlePwSubmit,
    reset: resetPw,
    formState: { errors: pwErrors },
  } = useForm<PasswordValues>({ resolver: zodResolver(passwordSchema) });

  function onProfileSave(data: ProfileValues) {
    startProfileTransition(async () => {
      const result = await updateProfile(data);
      if (result.success) {
        toast.success('Profile updated');
      } else {
        toast.error(result.error ?? 'Failed to update profile');
      }
    });
  }

  function onPasswordChange(data: PasswordValues) {
    startPasswordTransition(async () => {
      const result = await changePassword(data);
      if (result.success) {
        toast.success('Password changed');
        resetPw();
      } else {
        toast.error(result.error ?? 'Failed to change password');
      }
    });
  }

  return (
    <div className="space-y-8 max-w-lg">
      {/* Profile info */}
      <section>
        <h3 className="text-base font-semibold mb-4">Profile Information</h3>
        <form onSubmit={handleProfileSubmit(onProfileSave)} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="p-name">Name</Label>
            <Input id="p-name" {...regProfile('name')} />
            {profileErrors.name && (
              <p className="text-xs text-destructive">{profileErrors.name.message}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input value={user.email} disabled className="text-muted-foreground" />
            <p className="text-xs text-muted-foreground">Email cannot be changed.</p>
          </div>
          <Button type="submit" disabled={profilePending}>
            {profilePending ? 'Saving...' : 'Save Profile'}
          </Button>
        </form>
      </section>

      <Separator />

      {/* Password change */}
      <section>
        <h3 className="text-base font-semibold mb-4">Change Password</h3>
        <form onSubmit={handlePwSubmit(onPasswordChange)} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="pw-current">Current Password</Label>
            <Input id="pw-current" type="password" {...regPw('currentPassword')} />
            {pwErrors.currentPassword && (
              <p className="text-xs text-destructive">{pwErrors.currentPassword.message}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pw-new">New Password</Label>
            <Input id="pw-new" type="password" {...regPw('newPassword')} />
            {pwErrors.newPassword && (
              <p className="text-xs text-destructive">{pwErrors.newPassword.message}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pw-confirm">Confirm New Password</Label>
            <Input id="pw-confirm" type="password" {...regPw('confirmPassword')} />
            {pwErrors.confirmPassword && (
              <p className="text-xs text-destructive">{pwErrors.confirmPassword.message}</p>
            )}
          </div>
          <Button type="submit" disabled={passwordPending}>
            {passwordPending ? 'Changing...' : 'Change Password'}
          </Button>
        </form>
      </section>
    </div>
  );
}

// ─── Templates Tab ────────────────────────────────────────────────────────────

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

const RELATIVE_TO_LABELS: Record<string, string> = {
  acceptance_date: 'Acceptance',
  escrow_open: 'Escrow Open',
  expected_close_date: 'Close Date',
  inspection_contingency_date: 'Inspection Contingency',
  appraisal_contingency_date: 'Appraisal Contingency',
  loan_contingency_date: 'Loan Contingency',
};

function TemplatesTab({ initialTemplates }: { initialTemplates: TaskTemplate[] }) {
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

  async function handleToggle(t: TaskTemplate) {
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
    // Optimistic: just refresh by forcing re-render; in production you'd refetch
    // For now, signal that data may have changed (parent can pass onRefresh)
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
    // Reload page data via router refresh happens via revalidatePath in the action
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">
            {templates.length} templates &middot;{' '}
            {templates.filter((t) => t.isActive).length} active
          </p>
        </div>
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

// ─── Branding Tab ─────────────────────────────────────────────────────────────

function BrandingTab() {
  return (
    <div className="space-y-8 max-w-2xl">
      <section className="rounded-lg border p-6">
        <h3 className="text-base font-semibold mb-1">Live Brand Preview</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Toggle between brand configs to verify the rebranding system instantly.
        </p>
        <BrandToggle />
      </section>

      <section className="rounded-lg border p-6 space-y-3">
        <h3 className="text-base font-semibold">How Rebranding Works</h3>
        <p className="text-sm text-muted-foreground">
          All visual theming is driven by the{' '}
          <code className="bg-muted px-1 rounded text-xs">activeBrand</code> object in{' '}
          <code className="bg-muted px-1 rounded text-xs">src/lib/brand-config.ts</code>. Changing
          that single object rebrands the entire app — colors, border radius, font, and logo — with
          no page reload required.
        </p>
        <div className="rounded-md bg-muted p-4 text-xs font-mono text-muted-foreground space-y-1">
          <p>1. Open <strong>src/lib/brand-config.ts</strong></p>
          <p>2. Edit the <strong>activeBrand</strong> export</p>
          <p>3. Save — the app picks up changes on next load</p>
        </div>
        <p className="text-sm text-muted-foreground">
          A future release will allow storing brand config in the database so it can be changed from
          this UI without a code deploy.
        </p>
      </section>
    </div>
  );
}

// ─── Main Tabs Component ───────────────────────────────────────────────────────

interface SettingsTabsProps {
  user: { name: string | null; email: string };
  templates: TaskTemplate[];
}

export function SettingsTabs({ user, templates }: SettingsTabsProps) {
  return (
    <Tabs defaultValue="profile" className="space-y-6">
      <TabsList className="grid w-full grid-cols-3 max-w-sm">
        <TabsTrigger value="profile" className="gap-1.5">
          <User className="size-3.5" />
          Profile
        </TabsTrigger>
        <TabsTrigger value="templates" className="gap-1.5">
          <ListChecks className="size-3.5" />
          Templates
        </TabsTrigger>
        <TabsTrigger value="branding" className="gap-1.5">
          <Palette className="size-3.5" />
          Branding
        </TabsTrigger>
      </TabsList>

      <TabsContent value="profile">
        <ProfileTab user={user} />
      </TabsContent>

      <TabsContent value="templates">
        <TemplatesTab initialTemplates={templates} />
      </TabsContent>

      <TabsContent value="branding">
        <BrandingTab />
      </TabsContent>
    </Tabs>
  );
}
