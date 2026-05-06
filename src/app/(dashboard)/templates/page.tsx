import { auth } from '@/lib/auth';
import { getTaskTemplates, getTaskTemplateGroups } from '@/actions/tasks';
import { redirect } from 'next/navigation';
import { TemplatesTab } from '@/components/settings/templates-tab';

export default async function TemplatesPage() {
  const session = await auth();
  if (!session?.user) redirect('/login');

  const isAdmin = (session.user as { role?: string }).role === 'admin';

  const [groups, templates] = await Promise.all([getTaskTemplateGroups(), getTaskTemplates()]);

  return (

    <div className="p-4 sm:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Task Templates</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {isAdmin
            ? 'Manage the task checklist templates stamped onto new transactions.'
            : 'View task checklist templates used for new transactions.'}
        </p>
      </div>

      <TemplatesTab initialGroups={groups} initialTemplates={templates} isAdmin={isAdmin} />
    </div>
  );
}
