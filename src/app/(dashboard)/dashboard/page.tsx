export const dynamic = 'force-dynamic';

import {
  getDashboardStats,
  getUpcomingTasks,
  getOverdueTasks,
  getUpcomingDeadlines,
} from '@/actions/tasks';
import { getPendingRequests } from '@/actions/access-requests';
import { getActiveTransactionsList } from '@/actions/transactions';
import { StatsCards } from '@/components/dashboard/stats-cards';
import { TodoList } from '@/components/dashboard/todo-list';
import { ActiveTransactionsCard } from '@/components/dashboard/active-transactions-card';
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

      <StatsCards stats={stats} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        <div className="space-y-6">
          <ActiveTransactionsCard transactions={activeTransactions} />
          <UpcomingDeadlines deadlines={deadlines} />
        </div>
        <div className="space-y-6">
          <TodoList
            title="Overdue & Urgent"
            tasks={overdueTasks}
            variant="overdue"
            emptyMessage="No overdue or urgent tasks. Great work!"
          />
          <TodoList
            title="Due in the Next 7 Days"
            tasks={upcomingTasks}
            variant="upcoming"
            emptyMessage="You're all caught up — no tasks due in the next 7 days."
          />
        </div>
      </div>
    </div>
  );
}
