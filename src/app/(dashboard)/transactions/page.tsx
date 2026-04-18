'use client';

import { useEffect, useState } from 'react';
import { Plus, Search, SlidersHorizontal, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { AgentGroup, TransactionCard } from '@/components/transactions/agent-group';
import { TransactionForm } from '@/components/transactions/transaction-form';
import { getTransactions } from '@/actions/transactions';
import { getAgentsForSelect } from '@/actions/agents';
import type { AgentTransactionGroup } from '@/actions/transactions';

type SortMode = 'date-asc' | 'date-desc' | 'agent';

const STATUS_OPTIONS = [
  { value: 'pending', label: 'Pending' },
  { value: 'listed', label: 'Listed' },
  { value: 'in_escrow', label: 'In Escrow' },
  { value: 'closed', label: 'Closed' },
  { value: 'cancelled', label: 'Cancelled' },
];

export default function TransactionsPage() {
  const [groups, setGroups] = useState<AgentTransactionGroup[]>([]);
  const [agents, setAgents] = useState<{ id: string; name: string; broker: string | null; email: string; phone: string | null }[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [sortMode, setSortMode] = useState<SortMode>('date-asc');

  useEffect(() => {
    setLoading(true);
    Promise.all([getTransactions(), getAgentsForSelect()]).then(([g, a]) => {
      setGroups(g);
      setAgents(a);
      setLoading(false);
    });
  }, []);

  // Re-fetch after create sheet closes (new transaction may have been added)
  function handleCreateClose(open: boolean) {
    setCreateOpen(open);
    if (!open) {
      Promise.all([getTransactions(), getAgentsForSelect()]).then(([g, a]) => {
        setGroups(g);
        setAgents(a);
      });
    }
  }

  // Client-side filtering
  const filtered = groups
    .map((group) => ({
      ...group,
      transactions: group.transactions.filter((tx) => {
        const q = search.toLowerCase();
        const matchesSearch =
          !q ||
          tx.address.toLowerCase().includes(q) ||
          (tx.city ?? '').toLowerCase().includes(q) ||
          (tx.mlsNumber ?? '').toLowerCase().includes(q) ||
          (tx.buyerName ?? '').toLowerCase().includes(q) ||
          (tx.sellerName ?? '').toLowerCase().includes(q) ||
          (tx.sellerAgentName ?? '').toLowerCase().includes(q) ||
          (tx.buyerAgentName ?? '').toLowerCase().includes(q) ||
          (tx.sellerTcName ?? '').toLowerCase().includes(q) ||
          (tx.buyerTcName ?? '').toLowerCase().includes(q) ||
          (tx.expectedCloseDate ?? '').includes(q);
        const matchesStatus =
          selectedStatuses.length === 0 || selectedStatuses.includes(tx.status);
        return matchesSearch && matchesStatus;
      }),
    }))
    .filter((group) => group.transactions.length > 0);

  const totalCount = filtered.reduce((sum, g) => sum + g.transactions.length, 0);

  const flatSorted = sortMode !== 'agent'
    ? filtered
        .flatMap((g) => g.transactions)
        .sort((a, b) => {
          const da = a.expectedCloseDate ?? '\uffff';
          const db = b.expectedCloseDate ?? '\uffff';
          return sortMode === 'date-asc' ? da.localeCompare(db) : db.localeCompare(da);
        })
    : null;

  function toggleStatus(status: string) {
    setSelectedStatuses((prev) =>
      prev.includes(status) ? prev.filter((s) => s !== status) : [...prev, status],
    );
  }

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6">
      {/* ── Header ───────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Transactions</h1>
          {!loading && (
            <p className="text-sm text-muted-foreground mt-0.5">
              {totalCount} {totalCount === 1 ? 'transaction' : 'transactions'}
            </p>
          )}
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="size-4 mr-1.5" />
          New Transaction
        </Button>
      </div>

      {/* ── Filters ──────────────────────────────────────── */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Search address, MLS#, buyer, seller..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-9"
          />
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1.5">
              <SlidersHorizontal className="size-4" />
              Status
              {selectedStatuses.length > 0 && (
                <Badge variant="secondary" className="ml-1 text-xs font-normal">
                  {selectedStatuses.length}
                </Badge>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            {STATUS_OPTIONS.map((s) => (
              <DropdownMenuCheckboxItem
                key={s.value}
                checked={selectedStatuses.includes(s.value)}
                onCheckedChange={() => toggleStatus(s.value)}
              >
                {s.label}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1.5">
              {sortMode === 'date-asc' && <ArrowUp className="size-4" />}
              {sortMode === 'date-desc' && <ArrowDown className="size-4" />}
              {sortMode === 'agent' && <ArrowUpDown className="size-4" />}
              Sort
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">By Close Date</DropdownMenuLabel>
            <DropdownMenuRadioGroup value={sortMode} onValueChange={(v) => setSortMode(v as SortMode)}>
              <DropdownMenuRadioItem value="date-asc">Ascending (soonest first)</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="date-desc">Descending (latest first)</DropdownMenuRadioItem>
              <DropdownMenuSeparator />
              <DropdownMenuRadioItem value="agent">By Agent</DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>

        {selectedStatuses.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSelectedStatuses([])}
            className="text-muted-foreground"
          >
            Clear filters
          </Button>
        )}
      </div>

      <Separator />

      {/* ── Content ──────────────────────────────────────── */}
      {loading ? (
        <div className="space-y-6 animate-pulse">
          {[1, 2].map((i) => (
            <div key={i} className="space-y-3">
              <div className="h-5 w-40 bg-muted rounded" />
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {[1, 2, 3].map((j) => (
                  <div key={j} className="h-28 bg-muted rounded-lg" />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="size-16 rounded-full bg-muted flex items-center justify-center mb-4">
            <Search className="size-7 text-muted-foreground" />
          </div>
          {groups.length === 0 ? (
            <>
              <h3 className="font-semibold mb-1">No transactions yet</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Create your first transaction to get started.
              </p>
              <Button onClick={() => setCreateOpen(true)}>
                <Plus className="size-4 mr-1.5" />
                New Transaction
              </Button>
            </>
          ) : (
            <>
              <h3 className="font-semibold mb-1">No results</h3>
              <p className="text-sm text-muted-foreground">
                Try adjusting your search or filters.
              </p>
            </>
          )}
        </div>
      ) : flatSorted ? (
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
          {flatSorted.map((tx) => (
            <TransactionCard key={tx.id} tx={tx} />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((group) => (
            <AgentGroup key={group.agentId ?? '__none__'} group={group} defaultOpen />
          ))}
        </div>
      )}

      <TransactionForm agents={agents} open={createOpen} onOpenChange={handleCreateClose} />
    </div>
  );
}
