'use client';

import { useRef, useState, useEffect } from 'react';
import { ActiveTransactionsCard } from '@/components/dashboard/active-transactions-card';
import { StatsCards } from '@/components/dashboard/stats-cards';
import type { ActiveTransactionRow } from '@/actions/transactions';
import type { DashboardStats } from '@/actions/tasks';

interface DashboardTopSectionProps {
  activeTransactions: ActiveTransactionRow[];
  stats: DashboardStats;
}

export function DashboardTopSection({ activeTransactions, stats }: DashboardTopSectionProps) {
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
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
      <ActiveTransactionsCard
        transactions={activeTransactions}
        collapsedHeight={statsHeight}
      />
      <div ref={statsRef}>
        <StatsCards stats={stats} />
      </div>
    </div>
  );
}
