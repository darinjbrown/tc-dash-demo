import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Activity, CalendarCheck, AlertTriangle, CalendarRange } from 'lucide-react';
import type { DashboardStats } from '@/actions/tasks';
import { cn } from '@/lib/utils';

interface StatsCardsProps {
  stats: DashboardStats;
}

export function StatsCards({ stats }: StatsCardsProps) {
  const cards = [
    {
      title: 'Active Transactions',
      value: stats.activeTransactions,
      icon: Activity,
      description: 'In progress or in escrow',
      valueClass: '',
      cardClass: '',
    },
    {
      title: 'Due This Week',
      value: stats.tasksDueThisWeek,
      icon: CalendarCheck,
      description: 'Tasks due in the next 7 days',
      valueClass: '',
      cardClass: '',
    },
    {
      title: 'Overdue Tasks',
      value: stats.overdueTasks,
      icon: AlertTriangle,
      description: 'Past due or urgent',
      valueClass: stats.overdueTasks > 0 ? 'text-destructive' : '',
      cardClass: stats.overdueTasks > 0 ? 'border-destructive/40' : '',
    },
    {
      title: 'Closing This Month',
      value: stats.closingThisMonth,
      icon: CalendarRange,
      description: 'Expected to close this month',
      valueClass: '',
      cardClass: '',
    },
  ];

  return (
    <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <Card key={card.title} className={cn(card.cardClass)}>
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
              <Icon className="size-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className={cn('text-2xl font-bold', card.valueClass)}>{card.value}</div>
              <p className="text-xs text-muted-foreground mt-1">{card.description}</p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
