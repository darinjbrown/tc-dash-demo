'use client';

import { useState } from 'react';
import type { ElementType } from 'react';
import Link from 'next/link';
import { format, parseISO } from 'date-fns';
import { ChevronDown, ChevronRight, Calendar, CheckSquare, User2, Phone, Mail } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import type { AgentTransactionGroup, TransactionSummary } from '@/actions/transactions';

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  pending: { label: 'Pending', className: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
  listed: { label: 'Listed', className: 'bg-green-100 text-green-800 border-green-200' },
  in_escrow: { label: 'In Escrow', className: 'bg-blue-100 text-blue-800 border-blue-200' },
  closed: { label: 'Closed', className: 'bg-gray-100 text-gray-700 border-gray-200' },
  cancelled: { label: 'Cancelled', className: 'bg-red-100 text-red-700 border-red-200' },
};

const TYPE_CONFIG: Record<string, { label: string }> = {
  purchase: { label: 'Purchase' },
  listing: { label: 'Listing' },
  dual: { label: 'Dual' },
};

// ─── Contact mini row ─────────────────────────────────────────────────────────

function CopyButton({
  value,
  label,
  icon: Icon,
}: {
  value: string;
  label: string;
  icon: ElementType;
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        navigator.clipboard.writeText(value).then(() => {
          toast.success(`${label} copied!`);
        });
      }}
      className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
      title={value}
    >
      <Icon className="size-3" />
    </button>
  );
}

function ContactMini({
  label,
  name,
  phone,
  email,
}: {
  label: string;
  name?: string | null;
  phone?: string | null;
  email?: string | null;
}) {
  if (!name && !phone && !email) return null;
  return (
    <div className="flex items-center gap-1.5 text-xs min-w-0">
      <span className="text-muted-foreground shrink-0 w-20">{label}</span>
      <span className="truncate flex-1 font-medium">{name ?? '—'}</span>
      {phone && <CopyButton value={phone} label={phone} icon={Phone} />}
      {email && <CopyButton value={email} label={email} icon={Mail} />}
    </div>
  );
}

// ─── Transaction card ─────────────────────────────────────────────────────────

export function TransactionCard({ tx }: { tx: TransactionSummary }) {
  const statusCfg = STATUS_CONFIG[tx.status] ?? { label: tx.status, className: '' };
  const typeCfg = TYPE_CONFIG[tx.transactionType] ?? { label: tx.transactionType };
  const progressPct =
    tx.totalTasks > 0 ? Math.round((tx.completedTasks / tx.totalTasks) * 100) : 0;

  const hasContacts =
    tx.sellerAgentName || tx.sellerAgentPhone || tx.sellerAgentEmail ||
    tx.buyerAgentName || tx.buyerAgentPhone || tx.buyerAgentEmail ||
    tx.sellerTcName || tx.sellerTcPhone || tx.sellerTcEmail ||
    tx.buyerTcName || tx.buyerTcPhone || tx.buyerTcEmail;

  return (
    <Link
      href={`/transactions/${tx.id}`}
      className="block rounded-lg border bg-card p-4 hover:bg-muted/30 transition-colors"
    >
      {/* Address + badges */}
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

      {/* Contacts */}
      {hasContacts && (
        <div className="mt-3 space-y-1.5">
          <ContactMini
            label="Listing Agent"
            name={tx.sellerAgentName}
            phone={tx.sellerAgentPhone}
            email={tx.sellerAgentEmail}
          />
          <ContactMini
            label="Buyer's Agent"
            name={tx.buyerAgentName}
            phone={tx.buyerAgentPhone}
            email={tx.buyerAgentEmail}
          />
          <ContactMini
            label="Seller TC"
            name={tx.sellerTcName}
            phone={tx.sellerTcPhone}
            email={tx.sellerTcEmail}
          />
          <ContactMini
            label="Buyer TC"
            name={tx.buyerTcName}
            phone={tx.buyerTcPhone}
            email={tx.buyerTcEmail}
          />
        </div>
      )}

      {/* Close date */}
      {tx.expectedCloseDate && (
        <div className="mt-3 flex items-center gap-1 text-xs text-muted-foreground">
          <Calendar className="size-3" />
          {format(parseISO(tx.expectedCloseDate), 'MMM d, yyyy')}
        </div>
      )}

      {/* Task progress */}
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
            <p className="font-semibold text-sm">{group.agentName ?? 'Unassigned'}</p>
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
        <div className="grid gap-3 pb-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
          {group.transactions.map((tx) => (
            <TransactionCard key={tx.id} tx={tx} />
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
