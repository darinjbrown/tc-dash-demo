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
import { BrandToggle } from './brand-toggle';
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
}

export function SettingsTabs({ user }: SettingsTabsProps) {
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
        <BrandingTab />
      </TabsContent>
    </Tabs>
  );
}
