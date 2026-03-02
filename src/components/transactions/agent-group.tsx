'use client';

import { useState } from 'react';
import Link from 'next/link';
import { format, parseISO } from 'date-fns';
import { ChevronDown, ChevronRight, User2, Calendar, CheckSquare } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import type { AgentTransactionGroup, TransactionSummary } from '@/actions/transactions';

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  pending: { label: 'Pending', className: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
  active: { label: 'Active', className: 'bg-green-100 text-green-800 border-green-200' },
  in_escrow: { label: 'In Escrow', className: 'bg-blue-100 text-blue-800 border-blue-200' },
  closing: { label: 'Closing', className: 'bg-purple-100 text-purple-800 border-purple-200' },
  closed: { label: 'Closed', className: 'bg-gray-100 text-gray-700 border-gray-200' },
  cancelled: { label: 'Cancelled', className: 'bg-red-100 text-red-700 border-red-200' },
};

const TYPE_CONFIG: Record<string, { label: string }> = {
  purchase: { label: 'Purchase' },
  listing: { label: 'Listing' },
  dual: { label: 'Dual' },
};

// ─── Transaction card ─────────────────────────────────────────────────────────

function TransactionCard({ tx }: { tx: TransactionSummary }) {
  const statusCfg = STATUS_CONFIG[tx.status] ?? { label: tx.status, className: '' };
  const typeCfg = TYPE_CONFIG[tx.transactionType] ?? { label: tx.transactionType };
  const progressPct =
    tx.totalTasks > 0 ? Math.round((tx.completedTasks / tx.totalTasks) * 100) : 0;

  return (
    <Link
      href={`/transactions/${tx.id}`}
      className="block rounded-lg border bg-card p-4 hover:bg-muted/30 transition-colors"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="font-medium truncate">{tx.address}</p>
          {tx.city && (
            <p className="text-sm text-muted-foreground truncate">{tx.city}</p>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <Badge
            variant="outline"
            className={cn('text-xs font-normal', typeCfg.label === 'Dual' ? 'border-orange-200 bg-orange-50 text-orange-700' : '')}
          >
            {typeCfg.label}
          </Badge>
          <Badge variant="outline" className={cn('text-xs font-normal', statusCfg.className)}>
            {statusCfg.label}
          </Badge>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-4 text-sm text-muted-foreground">
        {tx.buyerName && (
          <span className="truncate">
            <span className="font-medium text-foreground/70">Buyer:</span> {tx.buyerName}
          </span>
        )}
        {tx.sellerName && !tx.buyerName && (
          <span className="truncate">
            <span className="font-medium text-foreground/70">Seller:</span> {tx.sellerName}
          </span>
        )}
        {tx.expectedCloseDate && (
          <span className="flex items-center gap-1 shrink-0 ml-auto">
            <Calendar className="size-3" />
            {format(parseISO(tx.expectedCloseDate), 'MMM d, yyyy')}
          </span>
        )}
      </div>

      {tx.totalTasks > 0 && (
        <div className="mt-3">
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
}

// ─── Agent group ──────────────────────────────────────────────────────────────

interface AgentGroupProps {
  group: AgentTransactionGroup;
  defaultOpen?: boolean;
}

export function AgentGroup({ group, defaultOpen = true }: AgentGroupProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger className="flex w-full items-center gap-3 py-2 text-left group">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted">
            <User2 className="size-4 text-muted-foreground" />
          </div>
          <div>
            <p className="font-semibold text-sm">
              {group.agentName ?? 'Unassigned'}
            </p>
            <p className="text-xs text-muted-foreground">
              {group.transactions.length}{' '}
              {group.transactions.length === 1 ? 'transaction' : 'transactions'}
            </p>
          </div>
        </div>
        {isOpen ? (
          <ChevronDown className="size-4 text-muted-foreground shrink-0" />
        ) : (
          <ChevronRight className="size-4 text-muted-foreground shrink-0" />
        )}
      </CollapsibleTrigger>

      <CollapsibleContent>
        <div className="grid gap-3 pb-4 sm:grid-cols-2 lg:grid-cols-3">
          {group.transactions.map((tx) => (
            <TransactionCard key={tx.id} tx={tx} />
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
