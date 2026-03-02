import { format, parseISO, isToday, isTomorrow, differenceInDays } from 'date-fns';
import Link from 'next/link';
import { CalendarDays, MapPin, User } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { TaskWithTransaction } from '@/actions/tasks';

interface UpcomingDeadlinesProps {
  deadlines: TaskWithTransaction[];
}

function formatGroupDate(dateStr: string): string {
  const date = parseISO(dateStr);
  if (isToday(date)) return 'Today';
  if (isTomorrow(date)) return 'Tomorrow';
  const diff = differenceInDays(date, new Date());
  if (diff < 7) return format(date, 'EEEE'); // e.g. "Wednesday"
  return format(date, 'EEEE, MMM d');
}

function groupByDate(tasks: TaskWithTransaction[]): Map<string, TaskWithTransaction[]> {
  const groups = new Map<string, TaskWithTransaction[]>();
  for (const task of tasks) {
    if (!task.dueDate) continue;
    const dateKey = task.dueDate.slice(0, 10); // YYYY-MM-DD
    if (!groups.has(dateKey)) groups.set(dateKey, []);
    groups.get(dateKey)!.push(task);
  }
  return groups;
}

export function UpcomingDeadlines({ deadlines }: UpcomingDeadlinesProps) {
  const groups = groupByDate(deadlines);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <CalendarDays className="size-4 text-primary" />
          Upcoming Deadlines
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {deadlines.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 px-6 text-center">
            <CalendarDays className="size-8 text-muted-foreground/40 mb-2" />
            <p className="text-sm text-muted-foreground">No upcoming deadlines.</p>
          </div>
        ) : (
          <div className="divide-y">
            {Array.from(groups.entries()).map(([dateKey, tasks]) => (
              <div key={dateKey} className="px-4 py-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  {formatGroupDate(dateKey)}
                  <span className="normal-case tracking-normal font-normal ml-2">
                    {format(parseISO(dateKey), 'MMM d')}
                  </span>
                </p>
                <ul className="space-y-2">
                  {tasks.map((task) => (
                    <li key={task.id} className="flex items-start gap-3">
                      <div className="size-1.5 rounded-full bg-primary shrink-0 mt-1.5" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{task.name}</p>
                        <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <MapPin className="size-3" />
                            <Link
                              href={`/transactions/${task.transactionId}`}
                              className="hover:text-foreground transition-colors truncate max-w-50"
                            >
                              {task.address}
                              {task.city ? `, ${task.city}` : ''}
                            </Link>
                          </span>
                          {task.agentName && (
                            <span className="flex items-center gap-1 text-xs text-muted-foreground">
                              <User className="size-3" />
                              {task.agentName}
                            </span>
                          )}
                          {task.priority === 'urgent' && (
                            <Badge className="text-[10px] px-1.5 py-0 h-4 bg-destructive text-destructive-foreground">
                              Urgent
                            </Badge>
                          )}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
