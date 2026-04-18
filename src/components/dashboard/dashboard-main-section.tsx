'use client';

import { useRef, useState, useEffect } from 'react';
import { ActiveTransactionsCard } from '@/components/dashboard/active-transactions-card';
import { StatsCards } from '@/components/dashboard/stats-cards';
import { TodoList } from '@/components/dashboard/todo-list';
import type { ActiveTransactionRow } from '@/actions/transactions';
import type { DashboardStats, TaskWithTransaction } from '@/actions/tasks';

interface DashboardMainSectionProps {
  activeTransactions: ActiveTransactionRow[];
  stats: DashboardStats;
  upcomingTasks: TaskWithTransaction[];
  overdueTasks: TaskWithTransaction[];
}

export function DashboardMainSection({
  activeTransactions,
  stats,
  upcomingTasks,
  overdueTasks,
}: DashboardMainSectionProps) {
  const statsRef = useRef<HTMLDivElement>(null);
  const [statsHeight, setStatsHeight] = useState<number | undefined>(undefined);

  useEffect(() => {
    const el = statsRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      setStatsHeight(entry.contentRect.height);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
      <div ref={statsRef} className="lg:col-start-2 lg:row-start-1">
        <StatsCards stats={stats} />
      </div>
      <div className="lg:col-start-1 lg:row-start-1">
        <ActiveTransactionsCard
          transactions={activeTransactions}
          collapsedHeight={statsHeight}
        />
      </div>
      <div className="lg:col-start-1 lg:row-start-2">
        <TodoList
          title="Due This Week"
          tasks={upcomingTasks}
          variant="upcoming"
          emptyMessage="You're all caught up — no tasks due this week."
        />
      </div>
      <div className="lg:col-start-2 lg:row-start-2">
        <TodoList
          title="Overdue & Urgent"
          tasks={overdueTasks}
          variant="overdue"
          emptyMessage="No overdue or urgent tasks. Great work!"
        />
      </div>
    </div>
  );
}
