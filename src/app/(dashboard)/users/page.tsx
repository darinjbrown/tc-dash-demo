import { auth } from '@/lib/auth';
import { listUsers } from '@/actions/users';
import { redirect } from 'next/navigation';
import { UsersTab } from '@/app/(dashboard)/settings/_components/users-tab';

export default async function UsersPage() {
  const session = await auth();
  if (!session?.user) redirect('/login');
  if (session.user.role !== 'admin') redirect('/dashboard');

  const allUsers = await listUsers();

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">User Management</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Create, edit, and manage user accounts.
        </p>
      </div>

      <UsersTab initialUsers={allUsers} currentUserId={session.user.id ?? ''} />
    </div>
  );
}
