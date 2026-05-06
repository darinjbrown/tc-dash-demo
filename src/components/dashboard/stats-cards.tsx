import { Card, CardContent } from '@/components/ui/card';
import type { DashboardStats } from '@/actions/tasks';
import { cn } from '@/lib/utils';

interface StatsCardsProps {
  stats: DashboardStats;
}

export function StatsCards({ stats }: StatsCardsProps) {
  const cards = [
    {
      title: 'Overdue',
      value: stats.overdueTasks,
      borderClass: 'border-l-destructive',
      valueClass: 'text-destructive',
    },
    {
      title: 'Due Today',
      value: stats.tasksDueToday,
      borderClass: 'border-l-amber-500',
      valueClass: 'text-amber-600 dark:text-amber-400',
    },
    {
      title: 'Due This Week',
      value: stats.tasksDueThisWeek,
      borderClass: 'border-l-primary',
      valueClass: 'text-primary',
    },
    {
      title: 'Closing Soon',
      value: stats.closingNext30Days,
      borderClass: 'border-l-emerald-500',
      valueClass: 'text-emerald-600 dark:text-emerald-400',
    },
  ];

  return (
    <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
      {cards.map((card) => (
        <Card
          key={card.title}
          className={cn(
            'border-l-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md',
            card.borderClass,
          )}
        >
          <CardContent className="py-4">
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {card.title}
            </div>
            <div className={cn('text-3xl font-bold mt-1', card.valueClass)}>{card.value}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
