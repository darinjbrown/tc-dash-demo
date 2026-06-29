import { auth } from '@/lib/auth';
import { SettingsTabs } from './_components/settings-tabs';
import { redirect } from 'next/navigation';
import { getTenantBranding, getBrandingEnv } from '@/actions/branding';

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user) redirect('/login');

  const user = {
    name: session.user.name ?? null,
    email: session.user.email ?? '',
  };

  const role = (session.user as { role?: string }).role;
  const canEditBranding = role === 'admin' || role === 'broker';

  const [brand, env] = await Promise.all([getTenantBranding(), getBrandingEnv()]);

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Manage your profile and branding.
        </p>
      </div>

      <SettingsTabs
        user={user}
        brand={brand}
        r2Enabled={env.r2Enabled}
        canEditBranding={canEditBranding}
      />
    </div>
  );
}
