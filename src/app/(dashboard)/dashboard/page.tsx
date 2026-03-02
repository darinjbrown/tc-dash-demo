export const dynamic = 'force-dynamic';

import {
  getDashboardStats,
  getUpcomingTasks,
  getOverdueTasks,
  getUpcomingDeadlines,
} from '@/actions/tasks';
import { getPendingRequests } from '@/actions/access-requests';
import { StatsCards } from '@/components/dashboard/stats-cards';
import { TodoList } from '@/components/dashboard/todo-list';
import { UpcomingDeadlines } from '@/components/dashboard/upcoming-deadlines';
import { PendingRequestsCard } from '@/components/dashboard/pending-requests-card';

export default async function DashboardPage() {
  const [stats, upcomingTasks, overdueTasks, deadlines, pendingRequests] = await Promise.all([
    getDashboardStats(),
    getUpcomingTasks(7),
    getOverdueTasks(),
    getUpcomingDeadlines(10),
    getPendingRequests(),
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <TodoList
          title="Due This Week"
          tasks={upcomingTasks}
          variant="upcoming"
          emptyMessage="You're all caught up — no tasks due this week."
        />
        <TodoList
          title="Overdue & Urgent"
          tasks={overdueTasks}
          variant="overdue"
          emptyMessage="No overdue or urgent tasks. Great work!"
        />
      </div>

      <UpcomingDeadlines deadlines={deadlines} />
    </div>
  );
}
