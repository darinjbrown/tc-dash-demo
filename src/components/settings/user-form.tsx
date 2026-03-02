'use client';

import { useEffect, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
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
import { userSchema, type UserFormValues } from '@/lib/user-schema';
import { createUser, updateUser } from '@/actions/users';

type UserRow = {
  id: string;
  name: string | null;
  email: string;
  role: string;
  createdAt: Date | null;
};

const ROLES = [
  { value: 'admin', label: 'Admin' },
  { value: 'broker', label: 'Broker' },
  { value: 'tc', label: 'TC' },
  { value: 'agent', label: 'Agent' },
] as const;

interface UserFormProps {
  user: UserRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (updated: UserRow, tempPassword?: string) => void;
}

export function UserForm({ user, open, onOpenChange, onSuccess }: UserFormProps) {
  const isEdit = !!user;
  const [isPending, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<UserFormValues>({
    resolver: zodResolver(userSchema),
    defaultValues: { name: '', email: '', role: 'tc' },
  });

  const roleValue = watch('role');

  useEffect(() => {
    if (open) {
      reset({
        name: user?.name ?? '',
        email: user?.email ?? '',
        role: (user?.role as UserFormValues['role']) ?? 'tc',
      });
    }
  }, [open, user, reset]);

  function onSubmit(data: UserFormValues) {
    startTransition(async () => {
      if (isEdit) {
        const result = await updateUser(user.id, data);
        if (result.success) {
          toast.success('User updated');
          onSuccess({ ...user, ...data });
          onOpenChange(false);
        } else {
          toast.error(result.error ?? 'Failed to update user');
        }
      } else {
        const result = await createUser(data);
        if (result.success) {
          toast.success('User created');
          const newUser: UserRow = {
            id: crypto.randomUUID(), // placeholder; real id set in DB
            name: data.name,
            email: data.email,
            role: data.role,
            createdAt: new Date(),
          };
          onSuccess(newUser, result.tempPassword);
          onOpenChange(false);
        } else {
          toast.error(result.error ?? 'Failed to create user');
        }
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit User' : 'Add User'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="u-name">Full Name</Label>
            <Input id="u-name" {...register('name')} placeholder="Jane Smith" />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="u-email">Email</Label>
            <Input id="u-email" type="email" {...register('email')} placeholder="jane@example.com" />
            {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="u-role">Role</Label>
            <Select
              value={roleValue}
              onValueChange={(v) => setValue('role', v as UserFormValues['role'])}
            >
              <SelectTrigger id="u-role">
                <SelectValue placeholder="Select role" />
              </SelectTrigger>
              <SelectContent>
                {ROLES.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.role && <p className="text-xs text-destructive">{errors.role.message}</p>}
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Saving...' : isEdit ? 'Save Changes' : 'Add User'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
