'use client';

import { useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Palette, User } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { BrandingTab } from './branding-tab';
import type { BrandConfig } from '@/lib/brand-config';
import { updateProfile, changePassword } from '@/actions/users';

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

// ─── Main Tabs Component ───────────────────────────────────────────────────────

interface SettingsTabsProps {
  user: { name: string | null; email: string };
  brand: BrandConfig;
  r2Enabled: boolean;
  canEditBranding: boolean;
}

export function SettingsTabs({ user, brand, r2Enabled, canEditBranding }: SettingsTabsProps) {
  return (
    <Tabs defaultValue="profile" className="space-y-6">
      <TabsList className="grid w-full grid-cols-2 max-w-xs">
        <TabsTrigger value="profile" className="gap-1.5">
          <User className="size-3.5" />
          Profile
        </TabsTrigger>
        <TabsTrigger value="branding" className="gap-1.5">
          <Palette className="size-3.5" />
          Branding
        </TabsTrigger>
      </TabsList>

      <TabsContent value="profile">
        <ProfileTab user={user} />
      </TabsContent>

      <TabsContent value="branding">
        <BrandingTab initialBrand={brand} r2Enabled={r2Enabled} canEdit={canEditBranding} />
      </TabsContent>
    </Tabs>
  );
}
