'use client';

import { useState, useTransition } from 'react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { Plus, Pencil, KeyRound, Trash2, Users } from 'lucide-react';
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { UserForm } from '@/components/settings/user-form';
import { deleteUser, resetUserPassword } from '@/actions/users';

type UserRow = {
  id: string;
  name: string | null;
  email: string;
  role: string;
  createdAt: Date | null;
};

const ROLE_BADGE: Record<string, 'destructive' | 'default' | 'secondary' | 'outline'> = {
  admin: 'destructive',
  broker: 'default',
  tc: 'secondary',
  agent: 'outline',
};

const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin',
  broker: 'Broker',
  tc: 'TC',
  agent: 'Agent',
};

// ─── Temp password reveal dialog ──────────────────────────────────────────────

function TempPasswordDialog({
  info,
  onClose,
}: {
  info: { name: string; tempPassword: string } | null;
  onClose: () => void;
}) {
  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text).then(() => toast.success('Copied to clipboard'));
  }

  return (
    <Dialog open={!!info} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Temporary Password</DialogTitle>
          <DialogDescription>
            Share this with <strong>{info?.name}</strong>. It will not be shown again.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <p className="text-center text-2xl font-mono font-bold tracking-widest bg-muted rounded-lg py-4">
            {info?.tempPassword}
          </p>
          <Button
            className="w-full"
            variant="secondary"
            onClick={() => info && copyToClipboard(info.tempPassword)}
          >
            Copy to Clipboard
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Users Tab ────────────────────────────────────────────────────────────────

export function UsersTab({
  initialUsers,
  currentUserId,
  actingOffice,
}: {
  initialUsers: UserRow[];
  currentUserId: string;
  actingOffice?: string | null;
}) {
  const [users, setUsers] = useState<UserRow[]>(initialUsers);
  const [formOpen, setFormOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<UserRow | null>(null);
  const [resetTarget, setResetTarget] = useState<UserRow | null>(null);
  const [tempInfo, setTempInfo] = useState<{ name: string; tempPassword: string } | null>(null);
  const [, startTransition] = useTransition();

  function openCreate() {
    setEditingUser(null);
    setFormOpen(true);
  }

  function openEdit(u: UserRow) {
    setEditingUser(u);
    setFormOpen(true);
  }

  function handleFormSuccess(updated?: UserRow, tempPassword?: string) {
    if (updated) {
      setUsers((prev) => {
        const idx = prev.findIndex((u) => u.id === updated.id);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = updated;
          return next;
        }
        return [...prev, updated];
      });
      if (tempPassword) {
        setTempInfo({ name: updated.name ?? updated.email, tempPassword });
      }
    }
  }

  function confirmDelete() {
    if (!deleteTarget) return;
    const target = deleteTarget;
    setDeleteTarget(null);
    startTransition(async () => {
      const result = await deleteUser(target.id);
      if (result.success) {
        toast.success(`${target.name ?? target.email} deleted`);
        setUsers((prev) => prev.filter((u) => u.id !== target.id));
      } else {
        toast.error(result.error ?? 'Failed to delete user');
      }
    });
  }

  function confirmReset() {
    if (!resetTarget) return;
    const target = resetTarget;
    setResetTarget(null);
    startTransition(async () => {
      const result = await resetUserPassword(target.id);
      if (result.success && result.tempPassword) {
        setTempInfo({ name: target.name ?? target.email, tempPassword: result.tempPassword });
      } else {
        toast.error(result.error ?? 'Failed to reset password');
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{users.length} users</p>
        <Button onClick={openCreate}>
          <Plus className="size-4 mr-2" />
          Add User
        </Button>
      </div>

      <div className="rounded-lg border overflow-hidden">
        {users.length === 0 ? (
          <div className="py-16 text-center text-muted-foreground">
            <Users className="size-10 mx-auto mb-3 opacity-30" />
            <p className="font-medium">No users yet</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead className="hidden sm:table-cell">Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead className="hidden md:table-cell">Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u) => {
                const isSelf = u.id === currentUserId;
                return (
                  <TableRow key={u.id}>
                    <TableCell>
                      <div className="font-medium text-sm">{u.name ?? '—'}</div>
                      <div className="text-xs text-muted-foreground sm:hidden">{u.email}</div>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
                      {u.email}
                    </TableCell>
                    <TableCell>
                      <Badge variant={ROLE_BADGE[u.role] ?? 'outline'} className="text-xs">
                        {ROLE_LABELS[u.role] ?? u.role}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-xs text-muted-foreground">
                      {u.createdAt ? format(u.createdAt, 'MMM d, yyyy') : '—'}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2"
                          onClick={() => openEdit(u)}
                          title="Edit user"
                        >
                          <Pencil className="size-3.5" />
                          <span className="sr-only">Edit</span>
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2"
                          onClick={() => setResetTarget(u)}
                          title="Reset password"
                        >
                          <KeyRound className="size-3.5" />
                          <span className="sr-only">Reset password</span>
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-destructive hover:text-destructive"
                          onClick={() => setDeleteTarget(u)}
                          disabled={isSelf}
                          title={isSelf ? 'Cannot delete yourself' : 'Delete user'}
                        >
                          <Trash2 className="size-3.5" />
                          <span className="sr-only">Delete</span>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Create / Edit dialog */}
      <UserForm
        user={editingUser}
        open={formOpen}
        onOpenChange={setFormOpen}
        onSuccess={handleFormSuccess}
      />

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete user?</AlertDialogTitle>
            <AlertDialogDescription>
              {actingOffice ? (
                `You are acting as ${actingOffice}. This permanently deletes ${
                  deleteTarget?.name ?? deleteTarget?.email
                } in THEIR office. Continue?`
              ) : (
                <>
                  This will permanently delete{' '}
                  <strong>{deleteTarget?.name ?? deleteTarget?.email}</strong>. This action cannot
                  be undone.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reset password confirmation */}
      <AlertDialog open={!!resetTarget} onOpenChange={(o) => !o && setResetTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset password?</AlertDialogTitle>
            <AlertDialogDescription>
              A new temporary password will be generated for{' '}
              <strong>{resetTarget?.name ?? resetTarget?.email}</strong>. Their current password
              will stop working immediately.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmReset}>Reset Password</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Temp password reveal */}
      <TempPasswordDialog info={tempInfo} onClose={() => setTempInfo(null)} />
    </div>
  );
}
