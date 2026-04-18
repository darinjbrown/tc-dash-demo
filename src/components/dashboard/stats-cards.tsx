import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { DashboardStats } from '@/actions/tasks';
import { cn } from '@/lib/utils';

interface StatsCardsProps {
  stats: DashboardStats;
}

export function StatsCards({ stats }: StatsCardsProps) {
  const cards = [
    {
      title: 'Overdue Tasks',
      value: stats.overdueTasks,
      description: 'Past due or urgent',
      valueClass: stats.overdueTasks > 0 ? 'text-destructive' : '',
      cardClass: stats.overdueTasks > 0 ? 'border-destructive/40' : '',
    },
    {
      title: 'Due Today',
      value: stats.tasksDueToday,
      description: 'Tasks due today',
      valueClass: stats.tasksDueToday > 0 ? 'text-amber-600 dark:text-amber-400' : '',
      cardClass: stats.tasksDueToday > 0 ? 'border-amber-400/40' : '',
    },
    {
      title: 'Due Next 7 Days',
      value: stats.tasksDueThisWeek,
      description: 'Tasks due in the next 7 days',
      valueClass: '',
      cardClass: '',
    },
    {
      title: 'Closing in 30 Days',
      value: stats.closingNext30Days,
      description: 'Expected to close within 30 days',
      valueClass: '',
      cardClass: '',
    },
  ];

  return (
    <div className="grid gap-4 grid-cols-2">
      {cards.map((card) => {
        return (
          <Card key={card.title} className={cn(card.cardClass)}>
            <CardHeader className="pb-2 space-y-0">
              <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className={cn('text-2xl font-bold', card.valueClass)}>{card.value}</div>
              <p className="text-sm text-muted-foreground mt-1">{card.description}</p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
