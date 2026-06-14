'use client';

import { useState, useTransition, useRef, useEffect } from 'react';
import { format, parseISO, formatDistanceToNow } from 'date-fns';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { toast } from 'sonner';
import { canManageAll } from '@/lib/roles';
import {
  Edit2,
  Archive,
  Phone,
  Mail,
  Calendar,
  DollarSign,
  Hash,
  Building2,
  X,
  Plus,
  Printer,
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
import type { TransactionDetail as TxDetail, TransactionAgentEntry } from '@/actions/transactions';
import { TaskChecklist } from '@/components/tasks/task-checklist';
import { TransactionForm } from './transaction-form';
import { getAgentsForSelect } from '@/actions/agents';
import { addTransactionAgent, removeTransactionAgent, setTransactionAgentPrimary } from '@/actions/transaction-agents';
import { AgentPickerDialog } from './agent-picker-dialog';
import type { AgentOption } from './agent-picker-dialog';

// ─── Status config ─────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  pending: { label: 'Pending', className: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
  listed: { label: 'Listed', className: 'bg-green-100 text-green-800 border-green-200' },
  in_escrow: { label: 'In Escrow', className: 'bg-blue-100 text-blue-800 border-blue-200' },
  closed: { label: 'Closed', className: 'bg-gray-100 text-gray-700 border-gray-200' },
  cancelled: { label: 'Cancelled', className: 'bg-red-100 text-red-700 border-red-200' },
};

const ALL_STATUSES = ['pending', 'listed', 'in_escrow', 'closed', 'cancelled'] as const;

// ─── Contact card ──────────────────────────────────────────────────────────────

function ContactCard({
  title,
  name,
  phone,
  email,
  broker,
  isInHouse,
}: {
  title: string;
  name?: string | null;
  phone?: string | null;
  email?: string | null;
  broker?: string | null;
  isInHouse?: boolean | null;
}) {
  if (!name && !phone && !email) return null;
  return (
    <div className="rounded-lg border p-3 space-y-1">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{title}</p>
        {isInHouse === true && (
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 font-normal">
            In-House
          </Badge>
        )}
        {isInHouse === false && (
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-normal">
            Outside
          </Badge>
        )}
      </div>
      {name && <p className="text-sm font-medium">{name}</p>}
      {broker && (
        <p className="flex items-center gap-1 text-xs text-muted-foreground">
          <Building2 className="size-3 shrink-0" />
          {broker}
        </p>
      )}
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

// ─── Agent card ────────────────────────────────────────────────────────────────

function AgentCard({
  agent,
  onRemove,
  onSetPrimary,
  canEdit,
}: {
  agent: TransactionAgentEntry;
  onRemove: (agentId: string) => void;
  onSetPrimary: (agentId: string) => void;
  canEdit: boolean;
}) {
  return (
    <div className="flex flex-col gap-1 p-3 rounded-md border bg-card text-sm">
      <div className="flex items-center justify-between gap-2">
        <span className={cn('font-semibold', agent.isPrimary && 'text-primary')}>
          {agent.name}
        </span>
        <div className="flex items-center gap-1 shrink-0">
          {agent.isPrimary && (
            <Badge className="text-[10px] px-1.5 py-0 h-4">Primary</Badge>
          )}
          {canEdit && !agent.isPrimary && (
            <button
              type="button"
              className="text-xs text-muted-foreground hover:text-foreground underline"
              onClick={() => onSetPrimary(agent.agentId)}
            >
              Set primary
            </button>
          )}
          {canEdit && (
            <button
              type="button"
              className="text-muted-foreground hover:text-destructive transition-colors ml-1"
              onClick={() => onRemove(agent.agentId)}
              aria-label="Remove agent"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>
      </div>
      {agent.broker && <div className="text-xs text-muted-foreground">{agent.broker}</div>}
      <div className="flex items-center gap-3 mt-0.5 flex-wrap">
        {agent.phone && (
          <button
            type="button"
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            onClick={() => { navigator.clipboard.writeText(agent.phone!); toast.success('Phone copied'); }}
          >
            <Phone className="size-3" />
            {agent.phone}
          </button>
        )}
        {agent.email && (
          <button
            type="button"
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            onClick={() => { navigator.clipboard.writeText(agent.email); toast.success('Email copied'); }}
          >
            <Mail className="size-3" />
            <span className="truncate max-w-40">{agent.email}</span>
          </button>
        )}
      </div>
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
}

export function TransactionDetail({ transaction: tx }: TransactionDetailProps) {
  const router = useRouter();
  const { data: session } = useSession();
  const role = (session?.user as { role?: string } | undefined)?.role;
  const canEdit = !!role && canManageAll(role);
  const [editOpen, setEditOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [notes, setNotes] = useState(tx.notes ?? '');
  const notesTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [listingAgents, setListingAgents] = useState(tx.listingAgents);
  const [buyerAgents, setBuyerAgents] = useState(tx.buyerAgents);
  const [pickerOpen, setPickerOpen] = useState<'listing' | 'buyer' | null>(null);
  const [allAgents, setAllAgents] = useState<AgentOption[]>([]);
  const [, startAgentTransition] = useTransition();

  useEffect(() => {
    getAgentsForSelect().then((data) =>
      setAllAgents(data.map((a) => ({ ...a, isInHouse: a.isInHouse ?? false })))
    );
  }, []);

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

  function handleAddAgent(agentId: string, isPrimary: boolean) {
    const side = pickerOpen!;
    startAgentTransition(async () => {
      const result = await addTransactionAgent(tx.id, agentId, side, isPrimary);
      if (result.success) {
        const agent = allAgents.find((a) => a.id === agentId)!;
        const entry: TransactionAgentEntry = {
          agentId,
          name: agent.name,
          phone: agent.phone,
          email: agent.email,
          broker: agent.broker,
          isInHouse: agent.isInHouse,
          isPrimary,
        };
        if (side === 'listing') {
          setListingAgents((prev) =>
            isPrimary ? prev.map((a) => ({ ...a, isPrimary: false })).concat(entry) : [...prev, entry]
          );
        } else {
          setBuyerAgents((prev) =>
            isPrimary ? prev.map((a) => ({ ...a, isPrimary: false })).concat(entry) : [...prev, entry]
          );
        }
        toast.success('Agent added');
      } else {
        toast.error(result.error ?? 'Failed to add agent');
      }
    });
  }

  function handleRemoveAgent(agentId: string, side: 'listing' | 'buyer') {
    startAgentTransition(async () => {
      const result = await removeTransactionAgent(tx.id, agentId, side);
      if (result.success) {
        if (side === 'listing') setListingAgents((prev) => prev.filter((a) => a.agentId !== agentId));
        else setBuyerAgents((prev) => prev.filter((a) => a.agentId !== agentId));
        toast.success('Agent removed');
      } else {
        toast.error(result.error ?? 'Failed to remove agent');
      }
    });
  }

  function handleSetPrimary(agentId: string, side: 'listing' | 'buyer') {
    startAgentTransition(async () => {
      const result = await setTransactionAgentPrimary(tx.id, agentId, side);
      if (result.success) {
        const update = (prev: TransactionAgentEntry[]) =>
          prev.map((a) => ({ ...a, isPrimary: a.agentId === agentId }));
        if (side === 'listing') setListingAgents(update);
        else setBuyerAgents(update);
        toast.success('Primary agent updated');
      } else {
        toast.error(result.error ?? 'Failed to set primary');
      }
    });
  }

  const printDate = format(new Date(), 'MMM d, yyyy');

  return (
    <>
      {/* ── Print-only view ───────────────────────────────── */}
      <div className="hidden print:block text-black text-sm leading-snug">
        {/* Print header */}
        <div className="mb-4 pb-3 border-b border-gray-300">
          <h1 className="text-xl font-bold">{tx.address}</h1>
          {(tx.city || tx.state) && (
            <p className="text-sm text-gray-600">{[tx.city, tx.state, tx.zipCode].filter(Boolean).join(', ')}</p>
          )}
          <div className="flex gap-4 mt-1 text-xs text-gray-500">
            <span className="capitalize font-medium">{statusCfg.label}</span>
            <span className="capitalize">{tx.transactionType}</span>
            {tx.mlsNumber && <span>MLS {tx.mlsNumber}</span>}
            <span className="ml-auto">Printed {printDate}</span>
          </div>
        </div>

        {/* Key dates + financials */}
        <div className="grid grid-cols-2 gap-6 mb-4">
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-2">Key Dates</h2>
            <table className="w-full text-xs">
              <tbody>
                {[
                  ['Contract Date', tx.contractDate],
                  ['Acceptance', tx.acceptanceDate],
                  ['Verification of Funds', tx.verificationOfFundsDate],
                  ['Earnest Money Due', tx.earnestMoneyDueDate],
                  ['Inspection Contingency', tx.inspectionContingencyDate],
                  ['Insurance Contingency', tx.insuranceContingencyDate],
                  ['Loan Contingency', tx.loanContingencyDate],
                  ['Appraisal Contingency', tx.appraisalContingencyDate],
                  ['HOA Docs Due', tx.hoaDocsDueDate],
                  ['Expected Close', tx.expectedCloseDate],
                  ['Actual Close', tx.actualCloseDate],
                ].map(([label, value]) => (
                  <tr key={label} className="border-b border-gray-100">
                    <td className="py-0.5 text-gray-500 pr-3">{label}</td>
                    <td className="py-0.5 font-medium text-right">
                      {value ? format(parseISO(value as string), 'MMM d, yyyy') : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div>
            <h2 className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-2">Financials</h2>
            <table className="w-full text-xs mb-4">
              <tbody>
                {([
                  tx.propertyType ? ['Property Type', tx.propertyType.replace('_', ' ')] : null,
                  tx.purchasePrice != null ? ['Purchase Price', formatCurrency(tx.purchasePrice)] : null,
                  tx.earnestMoneyDeposit != null ? ['Earnest Money', formatCurrency(tx.earnestMoneyDeposit)] : null,
                  tx.buyerCommissionPercent ? ['Buyer Commission', `${tx.buyerCommissionPercent}%`] : null,
                  tx.listingCommissionPercent ? ['Listing Commission', `${tx.listingCommissionPercent}%`] : null,
                  tx.escrowNumber ? ['Escrow #', tx.escrowNumber] : null,
                  tx.escrowCompany ? ['Escrow Company', tx.escrowCompany] : null,
                ] as ([string, string] | null)[]).filter((r): r is [string, string] => r !== null).map(([label, value]) => (
                  <tr key={label} className="border-b border-gray-100">
                    <td className="py-0.5 text-gray-500 pr-3 capitalize">{label}</td>
                    <td className="py-0.5 font-medium text-right capitalize">{value}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <h2 className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-2 mt-4">Parties</h2>
            <table className="w-full text-xs">
              <tbody>
                {tx.sellerName && (
                  <tr className="border-b border-gray-100">
                    <td className="py-0.5 text-gray-500 pr-3">Seller</td>
                    <td className="py-0.5 font-medium">{tx.sellerName}</td>
                  </tr>
                )}
                {tx.buyerName && (
                  <tr className="border-b border-gray-100">
                    <td className="py-0.5 text-gray-500 pr-3">Buyer</td>
                    <td className="py-0.5 font-medium">{tx.buyerName}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Agents */}
        {(listingAgents.length > 0 || buyerAgents.length > 0) && (
          <div className="grid grid-cols-2 gap-6 mb-4">
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-2">Listing Agents</h2>
              {listingAgents.length === 0 ? <p className="text-xs text-gray-400">None</p> : listingAgents.map((a) => (
                <div key={a.agentId} className="mb-2 text-xs">
                  <p className="font-semibold">{a.name}{a.isPrimary ? ' ★' : ''}</p>
                  {a.broker && <p className="text-gray-500">{a.broker}</p>}
                  {a.phone && <p>{a.phone}</p>}
                  {a.email && <p className="text-gray-600">{a.email}</p>}
                </div>
              ))}
            </div>
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-2">Buyer&apos;s Agents</h2>
              {buyerAgents.length === 0 ? <p className="text-xs text-gray-400">None</p> : buyerAgents.map((a) => (
                <div key={a.agentId} className="mb-2 text-xs">
                  <p className="font-semibold">{a.name}{a.isPrimary ? ' ★' : ''}</p>
                  {a.broker && <p className="text-gray-500">{a.broker}</p>}
                  {a.phone && <p>{a.phone}</p>}
                  {a.email && <p className="text-gray-600">{a.email}</p>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Contacts */}
        <div className="grid grid-cols-3 gap-4 mb-4">
          {[
            { title: "Seller's TC", name: tx.sellerTcName, phone: tx.sellerTcPhone, email: tx.sellerTcEmail },
            { title: "Buyer's TC", name: tx.buyerTcName, phone: tx.buyerTcPhone, email: tx.buyerTcEmail },
            { title: 'Escrow Officer', name: tx.escrowOfficer, phone: tx.escrowOfficerPhone, email: tx.escrowOfficerEmail },
            { title: 'Loan Officer', name: tx.loanOfficer, phone: tx.loanOfficerPhone, email: tx.loanOfficerEmail },
          ].filter((c) => c.name || c.phone || c.email).map((c) => (
            <div key={c.title} className="text-xs">
              <p className="font-bold uppercase tracking-wide text-gray-500 text-[10px] mb-1">{c.title}</p>
              {c.name && <p className="font-medium">{c.name}</p>}
              {c.phone && <p className="text-gray-600">{c.phone}</p>}
              {c.email && <p className="text-gray-600 truncate">{c.email}</p>}
            </div>
          ))}
        </div>

        {/* Notes */}
        {notes && (
          <div className="mb-4">
            <h2 className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-1">Notes</h2>
            <p className="text-xs whitespace-pre-wrap text-gray-700 border border-gray-200 rounded p-2">{notes}</p>
          </div>
        )}

        {/* Tasks */}
        {tx.tasks.length > 0 && (
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-2">
              Tasks ({tx.tasks.filter((t) => t.status === 'completed').length}/{tx.tasks.length} completed)
            </h2>
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-300">
                  <th className="text-left py-1 font-semibold text-gray-500">Task</th>
                  <th className="text-left py-1 font-semibold text-gray-500">Due</th>
                  <th className="text-left py-1 font-semibold text-gray-500">Status</th>
                </tr>
              </thead>
              <tbody>
                {tx.tasks.map((task) => (
                  <tr key={task.id} className="border-b border-gray-100">
                    <td className="py-0.5 pr-4">{task.name}</td>
                    <td className="py-0.5 pr-4 whitespace-nowrap">
                      {task.dueDate ? format(parseISO(task.dueDate), 'MMM d, yyyy') : '—'}
                    </td>
                    <td className="py-0.5 capitalize">{task.status.replace('_', ' ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Screen-only view ──────────────────────────────── */}
      <div className="print:hidden">

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
            {/* Status badge + dropdown — write control gated for agents */}
            {canEdit ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={isPending}
                    className={cn('gap-1.5 border font-normal', statusCfg.className)}
                  >
                    {statusCfg.label}
                    <span className="text-xs opacity-60">▾</span>
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
            ) : (
              <Badge
                variant="outline"
                className={cn('border font-normal', statusCfg.className)}
              >
                {statusCfg.label}
              </Badge>
            )}

            {canEdit && (
              <Button size="sm" variant="outline" onClick={() => setEditOpen(true)}>
                <Edit2 className="size-4 mr-1.5" />
                Edit Details
              </Button>
            )}

            <Button
              size="sm"
              variant="outline"
              onClick={() => window.print()}
            >
              <Printer className="size-4 mr-1.5" />
              Print
            </Button>

            {canEdit && (
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
            )}
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
                  <DateRow label="Contract Date" value={tx.contractDate} />
                  <DateRow label="Acceptance" value={tx.acceptanceDate} />
                  <DateRow label="Verification of Funds Due" value={tx.verificationOfFundsDate} />
                  <DateRow label="Earnest Money Due" value={tx.earnestMoneyDueDate} />
                  <DateRow label="Inspection Contingency" value={tx.inspectionContingencyDate} />
                  <DateRow label="Insurance Contingency" value={tx.insuranceContingencyDate} />
                  <DateRow label="Loan Contingency" value={tx.loanContingencyDate} />
                  <DateRow label="Appraisal Contingency" value={tx.appraisalContingencyDate} />
                  <DateRow label="HOA Docs Due" value={tx.hoaDocsDueDate} />
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
                  {tx.earnestMoneyDeposit != null && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Earnest Money</span>
                      <span className="font-medium">{formatCurrency(tx.earnestMoneyDeposit)}</span>
                    </div>
                  )}
                  {tx.buyerCommissionPercent && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Buyer Commission</span>
                      <span className="font-medium">{tx.buyerCommissionPercent}%</span>
                    </div>
                  )}
                  {tx.listingCommissionPercent && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Listing Commission</span>
                      <span className="font-medium">{tx.listingCommissionPercent}%</span>
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

                {/* Listing Agents — full width */}
                <div className="mb-3">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Listing Agents
                    </h4>
                    {canEdit && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 text-xs gap-1 px-2"
                        onClick={() => setPickerOpen('listing')}
                      >
                        <Plus className="size-3" /> Add
                      </Button>
                    )}
                  </div>
                  <div className="space-y-2">
                    {listingAgents.map((a) => (
                      <AgentCard
                        key={a.agentId}
                        agent={a}
                        onRemove={(id) => handleRemoveAgent(id, 'listing')}
                        onSetPrimary={(id) => handleSetPrimary(id, 'listing')}
                        canEdit={canEdit}
                      />
                    ))}
                    {listingAgents.length === 0 && (
                      <p className="text-xs text-muted-foreground italic">No listing agents</p>
                    )}
                  </div>
                </div>

                {/* Buyer Agents — full width */}
                <div className="mb-3">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Buyer&apos;s Agents
                    </h4>
                    {canEdit && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 text-xs gap-1 px-2"
                        onClick={() => setPickerOpen('buyer')}
                      >
                        <Plus className="size-3" /> Add
                      </Button>
                    )}
                  </div>
                  <div className="space-y-2">
                    {buyerAgents.map((a) => (
                      <AgentCard
                        key={a.agentId}
                        agent={a}
                        onRemove={(id) => handleRemoveAgent(id, 'buyer')}
                        onSetPrimary={(id) => handleSetPrimary(id, 'buyer')}
                        canEdit={canEdit}
                      />
                    ))}
                    {buyerAgents.length === 0 && (
                      <p className="text-xs text-muted-foreground italic">No buyer&apos;s agents</p>
                    )}
                  </div>
                </div>

                <Separator className="mb-3" />

                {/* Other contacts in 2-col grid */}
                <div className="grid gap-3 sm:grid-cols-2">
                  <ContactCard title="Seller" name={tx.sellerName} />
                  <ContactCard title="Buyer" name={tx.buyerName} />
                  <ContactCard
                    title="Seller's TC"
                    name={tx.sellerTcName}
                    phone={tx.sellerTcPhone}
                    email={tx.sellerTcEmail}
                  />
                  <ContactCard
                    title="Buyer's TC"
                    name={tx.buyerTcName}
                    phone={tx.buyerTcPhone}
                    email={tx.buyerTcEmail}
                  />
                  <ContactCard
                    title="Escrow Officer"
                    name={tx.escrowOfficer}
                    phone={tx.escrowOfficerPhone}
                    email={tx.escrowOfficerEmail}
                  />
                  <ContactCard
                    title="Loan Officer"
                    name={tx.loanOfficer}
                    phone={tx.loanOfficerPhone}
                    email={tx.loanOfficerEmail}
                  />
                </div>
              </div>

              {/* Notes */}
              <div className="rounded-lg border p-4">
                <h3 className="text-sm font-semibold mb-3">Notes</h3>
                {canEdit ? (
                  <>
                    <Textarea
                      value={notes}
                      onChange={(e) => handleNotesChange(e.target.value)}
                      rows={6}
                      placeholder="Internal notes about this transaction (auto-saves)..."
                      className="text-sm"
                    />
                    <p className="text-xs text-muted-foreground mt-1.5">Auto-saves as you type</p>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                    {notes || 'No notes.'}
                  </p>
                )}
              </div>
            </div>
          </div>
        </TabsContent>

        {/* ── Tasks tab ──────────────────────────────────── */}
        <TabsContent value="tasks">
          <TaskChecklist tasks={tx.tasks} transactionId={tx.id} canEdit={canEdit} />
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
        open={editOpen}
        onOpenChange={setEditOpen}
        transaction={tx}
      />

      <AgentPickerDialog
        open={!!pickerOpen}
        onOpenChange={(v) => !v && setPickerOpen(null)}
        side={pickerOpen ?? 'listing'}
        existingAgentIds={
          pickerOpen === 'listing'
            ? listingAgents.map((a) => a.agentId)
            : buyerAgents.map((a) => a.agentId)
        }
        agents={allAgents}
        onAdd={handleAddAgent}
        onAgentCreated={(a) => setAllAgents((prev) => [...prev, a])}
      />
      </div>{/* end screen-only */}
    </>
  );
}
