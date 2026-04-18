export const dynamic = 'force-dynamic';

import {
  getDashboardStats,
  getUpcomingTasks,
  getOverdueTasks,
  getUpcomingDeadlines,
} from '@/actions/tasks';
import { getPendingRequests } from '@/actions/access-requests';
import { getActiveTransactionsList } from '@/actions/transactions';
import { DashboardMainSection } from '@/components/dashboard/dashboard-main-section';
import { UpcomingDeadlines } from '@/components/dashboard/upcoming-deadlines';
import { PendingRequestsCard } from '@/components/dashboard/pending-requests-card';

export default async function DashboardPage() {
  const [stats, upcomingTasks, overdueTasks, deadlines, pendingRequests, activeTransactions] =
    await Promise.all([
      getDashboardStats(),
      getUpcomingTasks(7),
      getOverdueTasks(),
      getUpcomingDeadlines(10),
      getPendingRequests(),
      getActiveTransactionsList(),
    ]);

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">Good morning</h2>
        <p className="text-sm text-muted-foreground">
          Here&apos;s what needs your attention today.
        </p>
      </div>

      {pendingRequests.length > 0 && (
        <PendingRequestsCard initialRequests={pendingRequests} />
      )}

      <DashboardMainSection
        activeTransactions={activeTransactions}
        stats={stats}
        upcomingTasks={upcomingTasks}
        overdueTasks={overdueTasks}
      />

      <UpcomingDeadlines deadlines={deadlines} />
    </div>
  );
}
