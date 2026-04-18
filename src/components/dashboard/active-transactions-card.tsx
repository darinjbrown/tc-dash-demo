'use client';

import { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronUp, CheckSquare } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import Link from 'next/link';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import type { ActiveTransactionRow } from '@/actions/transactions';

const TYPE_LABELS: Record<string, string> = {
  listing: 'Listing',
  purchase: 'Purchase',
  dual: 'Dual Agency',
};

const TYPE_VARIANT: Record<string, 'default' | 'secondary' | 'outline'> = {
  listing: 'default',
  purchase: 'secondary',
  dual: 'outline',
};

interface ActiveTransactionsCardProps {
  transactions: ActiveTransactionRow[];
  collapsedHeight?: number;
}

export function ActiveTransactionsCard({ transactions, collapsedHeight }: ActiveTransactionsCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [isOverflowing, setIsOverflowing] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    setIsOverflowing(el.scrollHeight > el.clientHeight);
  }, [transactions, collapsedHeight]);

  return (
    <Card
      className="flex flex-col overflow-hidden"
      style={!expanded && collapsedHeight ? { height: collapsedHeight } : undefined}
    >
      <CardHeader className="pb-2 space-y-0 shrink-0">
        <CardTitle className="text-sm font-medium">Active Transactions</CardTitle>
      </CardHeader>

      <CardContent className="flex flex-col flex-1 min-h-0 pb-3">
        {transactions.length === 0 ? (
          <div className="flex items-center justify-center flex-1">
            <p className="text-sm text-muted-foreground">No active transactions</p>
          </div>
        ) : (
          <>
            <div className="text-2xl font-bold mb-2 shrink-0">{transactions.length}</div>

            {/* Collapsed: flex-1 + overflow-hidden clips at the stretch height.
                Expanded: overflow visible, natural height. */}
            <div ref={listRef} className={cn('divide-y', expanded ? '' : 'flex-1 overflow-hidden')}>
              {transactions.map((tx) => {
                const agentDisplay = [tx.primaryListingAgent, tx.primaryBuyerAgent]
                  .filter(Boolean)
                  .join(' · ');
                const closeDate = tx.expectedCloseDate
                  ? format(parseISO(tx.expectedCloseDate), 'MMM d, yyyy')
                  : null;

                const progressPct =
                  tx.totalTasks > 0
                    ? Math.round((tx.completedTasks / tx.totalTasks) * 100)
                    : 0;

                return (
                  <Link
                    key={tx.id}
                    href={`/transactions/${tx.id}`}
                    className="block py-2.5 hover:bg-muted/50 -mx-2 px-2 rounded transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm truncate">{tx.address}</span>
                          {tx.city && (
                            <span className="text-sm text-muted-foreground shrink-0">{tx.city}</span>
                          )}
                        </div>
                        {agentDisplay && (
                          <p className="text-sm text-muted-foreground mt-0.5 truncate">{agentDisplay}</p>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <Badge
                          variant={TYPE_VARIANT[tx.transactionType] ?? 'outline'}
                          className="text-xs"
                        >
                          {TYPE_LABELS[tx.transactionType] ?? tx.transactionType}
                        </Badge>
                        {closeDate && (
                          <span className="text-sm text-muted-foreground">Closes {closeDate}</span>
                        )}
                      </div>
                    </div>
                    {tx.totalTasks > 0 && (
                      <div className="mt-2">
                        <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                          <span className="flex items-center gap-1">
                            <CheckSquare className="size-3" />
                            {tx.completedTasks}/{tx.totalTasks} tasks
                          </span>
                          <span>{progressPct}%</span>
                        </div>
                        <Progress value={progressPct} className="h-1.5" />
                      </div>
                    )}
                  </Link>
                );
              })}
            </div>

            {(isOverflowing || expanded) && (
              <Button
                variant="ghost"
                size="sm"
                className="mt-2 w-full h-7 text-xs text-muted-foreground shrink-0"
                onClick={() => setExpanded((v) => !v)}
              >
                {expanded ? (
                  <>
                    <ChevronUp className="size-3 mr-1" />
                    Show less
                  </>
                ) : (
                  <>
                    <ChevronDown className="size-3 mr-1" />
                    Show all {transactions.length}
                  </>
                )}
              </Button>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
