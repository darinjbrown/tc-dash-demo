import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { listTenants } from '@/actions/platform';
import { PlatformConsole } from './_components/platform-console';

export const metadata = { title: 'Platform Console' };

export default async function PlatformPage() {
  const session = await auth();
  // Server-side gate (defense-in-depth; proxy also gates this prefix).
  if (!session?.user) redirect('/login');
  if (!(session.user as { isPlatformAdmin?: boolean }).isPlatformAdmin) redirect('/dashboard');

  const tenants = await listTenants();

  return (
    <div className="mx-auto max-w-5xl p-6 sm:p-10 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Platform Console</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            d20web administration — create offices and toggle them active/inactive.
          </p>
        </div>
      </div>

      <PlatformConsole initialTenants={tenants} />
    </div>
  );
}
