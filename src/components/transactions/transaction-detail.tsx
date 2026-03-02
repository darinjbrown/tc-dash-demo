'use client';

import { useState, useTransition, useRef } from 'react';
import { format, parseISO, formatDistanceToNow } from 'date-fns';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  ArrowLeft,
  Edit2,
  Archive,
  Phone,
  Mail,
  Calendar,
  DollarSign,
  Hash,
} from 'lucide-react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/utils';
import { updateTransactionStatus, updateTransactionNotes, deleteTransaction } from '@/actions/transactions';
import type { TransactionDetail as TxDetail } from '@/actions/transactions';
import { TaskChecklist } from '@/components/tasks/task-checklist';
import { TransactionForm } from './transaction-form';

// ─── Status config ─────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  pending: { label: 'Pending', className: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
  active: { label: 'Active', className: 'bg-green-100 text-green-800 border-green-200' },
  in_escrow: { label: 'In Escrow', className: 'bg-blue-100 text-blue-800 border-blue-200' },
  closing: { label: 'Closing', className: 'bg-purple-100 text-purple-800 border-purple-200' },
  closed: { label: 'Closed', className: 'bg-gray-100 text-gray-700 border-gray-200' },
  cancelled: { label: 'Cancelled', className: 'bg-red-100 text-red-700 border-red-200' },
};

const ALL_STATUSES = ['pending', 'active', 'in_escrow', 'closing', 'closed', 'cancelled'] as const;

// ─── Contact card ──────────────────────────────────────────────────────────────

function ContactCard({
  title,
  name,
  phone,
  email,
}: {
  title: string;
  name?: string | null;
  phone?: string | null;
  email?: string | null;
}) {
  if (!name && !phone && !email) return null;
  return (
    <div className="rounded-lg border p-3 space-y-1">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{title}</p>
      {name && <p className="text-sm font-medium">{name}</p>}
      {phone && (
        <a
          href={`tel:${phone}`}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <Phone className="size-3" />
          {phone}
        </a>
      )}
      {email && (
        <a
          href={`mailto:${email}`}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground truncate"
        >
          <Mail className="size-3" />
          {email}
        </a>
      )}
    </div>
  );
}

// ─── Date row ─────────────────────────────────────────────────────────────────

function DateRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium">
        {value ? format(parseISO(value), 'MMM d, yyyy') : '—'}
      </span>
    </div>
  );
}

// ─── Activity log entry ────────────────────────────────────────────────────────

function activityDescription(action: string, details: string | null): string {
  const d = details ? (() => { try { return JSON.parse(details); } catch { return {}; } })() : {};
  switch (action) {
    case 'created': return `Transaction created${d.address ? ` for ${d.address}` : ''}`;
    case 'updated': return `Transaction details updated`;
    case 'status_changed': return `Status changed to ${(d.status as string)?.replace('_', ' ') ?? 'unknown'}`;
    case 'task_completed': return `Task completed: ${d.taskName ?? ''}`;
    case 'note_added': return 'Note added';
    default: return action;
  }
}

// ─── Main detail component ────────────────────────────────────────────────────

interface TransactionDetailProps {
  transaction: TxDetail;
  agents: { id: string; name: string }[];
}

export function TransactionDetail({ transaction: tx, agents }: TransactionDetailProps) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [notes, setNotes] = useState(tx.notes ?? '');
  const notesTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const statusCfg = STATUS_CONFIG[tx.status] ?? { label: tx.status, className: '' };

  function handleStatusChange(status: string) {
    startTransition(async () => {
      const result = await updateTransactionStatus(tx.id, status);
      if (result.success) {
        toast.success('Status updated');
        router.refresh();
      } else {
        toast.error(result.error ?? 'Failed to update status');
      }
    });
  }

  function handleNotesChange(value: string) {
    setNotes(value);
    if (notesTimer.current) clearTimeout(notesTimer.current);
    notesTimer.current = setTimeout(async () => {
      const result = await updateTransactionNotes(tx.id, value);
      if (!result.success) toast.error('Failed to save notes');
    }, 1500);
  }

  function handleArchive() {
    startTransition(async () => {
      const result = await deleteTransaction(tx.id);
      if (result.success) {
        toast.success('Transaction archived');
        router.push('/transactions');
      } else {
        toast.error(result.error ?? 'Failed to archive');
      }
    });
  }

  const fullAddress = [tx.address, tx.city, tx.state, tx.zipCode].filter(Boolean).join(', ');

  return (
    <>
      {/* ── Header ────────────────────────────────────────── */}
      <div className="space-y-3 mb-6">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Link href="/dashboard" className="hover:text-foreground">
            Dashboard
          </Link>
          <span>/</span>
          <Link href="/transactions" className="hover:text-foreground">
            Transactions
          </Link>
          <span>/</span>
          <span className="text-foreground font-medium truncate">{tx.address}</span>
        </nav>

        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold">{tx.address}</h1>
            {(tx.city || tx.state) && (
              <p className="text-muted-foreground mt-0.5">
                {[tx.city, tx.state, tx.zipCode].filter(Boolean).join(', ')}
              </p>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Status badge + dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5" disabled={isPending}>
                  <Badge
                    variant="outline"
                    className={cn('text-xs font-normal border-0 p-0', statusCfg.className)}
                  >
                    {statusCfg.label}
                  </Badge>
                  <span className="text-muted-foreground text-xs">▾</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {ALL_STATUSES.map((s) => (
                  <DropdownMenuItem
                    key={s}
                    onClick={() => handleStatusChange(s)}
                    className={cn(tx.status === s && 'font-semibold')}
                  >
                    {STATUS_CONFIG[s]?.label ?? s}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <Button size="sm" variant="outline" onClick={() => setEditOpen(true)}>
              <Edit2 className="size-4 mr-1.5" />
              Edit Details
            </Button>

            <Button
              size="sm"
              variant="ghost"
              className="text-muted-foreground"
              onClick={handleArchive}
              disabled={isPending}
            >
              <Archive className="size-4 mr-1.5" />
              Archive
            </Button>
          </div>
        </div>
      </div>

      {/* ── Tabs ─────────────────────────────────────────── */}
      <Tabs defaultValue="overview">
        <TabsList className="mb-6">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="tasks">
            Tasks
            {tx.tasks.length > 0 && (
              <Badge variant="secondary" className="ml-1.5 text-xs font-normal">
                {tx.tasks.filter((t) => t.status !== 'completed').length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>

        {/* ── Overview tab ───────────────────────────────── */}
        <TabsContent value="overview">
          <div className="grid gap-6 md:grid-cols-2">
            {/* Left: Key dates */}
            <div className="space-y-4">
              <div className="rounded-lg border p-4">
                <h3 className="text-sm font-semibold mb-1 flex items-center gap-2">
                  <Calendar className="size-4 text-muted-foreground" />
                  Key Dates
                </h3>
                <Separator className="mb-3" />
                <div className="divide-y">
                  <DateRow label="Acceptance" value={tx.acceptanceDate} />
                  <DateRow label="Escrow Open" value={tx.escrowOpenDate} />
                  <DateRow label="Inspection Contingency" value={tx.inspectionContingencyDate} />
                  <DateRow label="Appraisal Contingency" value={tx.appraisalContingencyDate} />
                  <DateRow label="Loan Contingency" value={tx.loanContingencyDate} />
                  <DateRow label="Expected Close" value={tx.expectedCloseDate} />
                  <DateRow label="Actual Close" value={tx.actualCloseDate} />
                </div>
              </div>

              {/* Property & Financial */}
              <div className="rounded-lg border p-4">
                <h3 className="text-sm font-semibold mb-1 flex items-center gap-2">
                  <DollarSign className="size-4 text-muted-foreground" />
                  Property &amp; Financials
                </h3>
                <Separator className="mb-3" />
                <div className="space-y-2 text-sm">
                  {tx.mlsNumber && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground flex items-center gap-1">
                        <Hash className="size-3" /> MLS
                      </span>
                      <span className="font-medium">{tx.mlsNumber}</span>
                    </div>
                  )}
                  {tx.propertyType && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Type</span>
                      <span className="font-medium capitalize">
                        {tx.propertyType.replace('_', ' ')}
                      </span>
                    </div>
                  )}
                  {tx.transactionType && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Transaction</span>
                      <span className="font-medium capitalize">{tx.transactionType}</span>
                    </div>
                  )}
                  {tx.purchasePrice != null && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Purchase Price</span>
                      <span className="font-medium">{formatCurrency(tx.purchasePrice)}</span>
                    </div>
                  )}
                  {tx.listPrice != null && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">List Price</span>
                      <span className="font-medium">{formatCurrency(tx.listPrice)}</span>
                    </div>
                  )}
                  {tx.earnestMoneyDeposit != null && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Earnest Money</span>
                      <span className="font-medium">{formatCurrency(tx.earnestMoneyDeposit)}</span>
                    </div>
                  )}
                  {tx.commissionPercent && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Commission</span>
                      <span className="font-medium">{tx.commissionPercent}%</span>
                    </div>
                  )}
                  {tx.escrowNumber && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Escrow #</span>
                      <span className="font-medium">{tx.escrowNumber}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Right: Contacts */}
            <div className="space-y-4">
              <div className="rounded-lg border p-4">
                <h3 className="text-sm font-semibold mb-1">Contacts</h3>
                <Separator className="mb-3" />
                <div className="grid gap-3 sm:grid-cols-2">
                  <ContactCard
                    title="Agent"
                    name={tx.agentName}
                    phone={tx.agentPhone}
                    email={tx.agentEmail}
                  />
                  <ContactCard
                    title="Escrow Officer"
                    name={tx.escrowOfficer}
                    phone={tx.escrowOfficerPhone}
                    email={tx.escrowOfficerEmail}
                  />
                  <ContactCard
                    title="Title Officer"
                    name={tx.titleOfficer}
                    phone={null}
                    email={null}
                  />
                  <ContactCard
                    title="Loan Officer"
                    name={tx.loanOfficer}
                    phone={tx.loanOfficerPhone}
                    email={tx.loanOfficerEmail}
                  />
                  <ContactCard
                    title={tx.transactionType === 'listing' ? 'Seller' : 'Buyer'}
                    name={tx.transactionType === 'listing' ? tx.sellerName : tx.buyerName}
                    phone={null}
                    email={null}
                  />
                  {tx.transactionType === 'dual' && (
                    <ContactCard title="Seller" name={tx.sellerName} phone={null} email={null} />
                  )}
                </div>
              </div>

              {/* Notes */}
              <div className="rounded-lg border p-4">
                <h3 className="text-sm font-semibold mb-3">Notes</h3>
                <Textarea
                  value={notes}
                  onChange={(e) => handleNotesChange(e.target.value)}
                  rows={6}
                  placeholder="Internal notes about this transaction (auto-saves)..."
                  className="text-sm"
                />
                <p className="text-xs text-muted-foreground mt-1.5">Auto-saves as you type</p>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* ── Tasks tab ──────────────────────────────────── */}
        <TabsContent value="tasks">
          <TaskChecklist tasks={tx.tasks} transactionId={tx.id} />
        </TabsContent>

        {/* ── Activity tab ───────────────────────────────── */}
        <TabsContent value="activity">
          {tx.activity.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              <p className="text-sm">No activity recorded yet.</p>
            </div>
          ) : (
            <div className="space-y-0 relative">
              {/* Timeline line */}
              <div className="absolute left-4 top-2 bottom-2 w-px bg-border" />
              {tx.activity.map((entry) => (
                <div key={entry.id} className="flex gap-4 pb-4 relative">
                  {/* Dot */}
                  <div className="relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full border bg-background">
                    <div className="size-2 rounded-full bg-primary" />
                  </div>
                  <div className="flex-1 pt-1.5 min-w-0">
                    <p className="text-sm">{activityDescription(entry.action, entry.details)}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {entry.userName ? `${entry.userName} · ` : ''}
                      {entry.createdAt
                        ? formatDistanceToNow(
                            entry.createdAt instanceof Date
                              ? entry.createdAt
                              : new Date(entry.createdAt),
                            { addSuffix: true },
                          )
                        : '—'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Edit sheet */}
      <TransactionForm
        agents={agents}
        open={editOpen}
        onOpenChange={setEditOpen}
        transaction={tx}
      />
    </>
  );
}
