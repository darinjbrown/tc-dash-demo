'use client';

import { useEffect, useState, useTransition } from 'react';
import { Plus, Pencil, ToggleLeft, ToggleRight, Phone, Mail, Hash, Building2, Trash2, Search } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { AgentForm } from '@/components/agents/agent-form';
import { getAgents, toggleAgentActive, deleteAgent, toggleAgentInHouse } from '@/actions/agents';
import type { AgentWithStats } from '@/actions/agents';

type TypeFilter = 'all' | 'in_house' | 'outside';

export default function AgentsPage() {
  const [agents, setAgents] = useState<AgentWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editingAgent, setEditingAgent] = useState<AgentWithStats | null>(null);
  const [deletingAgent, setDeletingAgent] = useState<AgentWithStats | null>(null);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [showInactive, setShowInactive] = useState(false);
  const [, startTransition] = useTransition();

  async function loadAgents() {
    const data = await getAgents();
    setAgents(data);
    setLoading(false);
  }

  useEffect(() => {
    loadAgents();
  }, []);

  function openCreate() {
    setEditingAgent(null);
    setFormOpen(true);
  }

  function openEdit(agent: AgentWithStats) {
    setEditingAgent(agent);
    setFormOpen(true);
  }

  function handleFormSuccess() {
    setLoading(true);
    loadAgents();
  }

  function handleDelete(agent: AgentWithStats) {
    startTransition(async () => {
      const result = await deleteAgent(agent.id);
      if (result.success) {
        toast.success(`${agent.name} deleted`);
        handleFormSuccess();
      } else {
        toast.error(result.error ?? 'Failed to delete agent');
      }
      setDeletingAgent(null);
    });
  }

  function handleToggleActive(agent: AgentWithStats) {
    startTransition(async () => {
      const result = await toggleAgentActive(agent.id);
      if (result.success) {
        toast.success(agent.isActive ? 'Agent deactivated' : 'Agent activated');
        handleFormSuccess();
      } else {
        toast.error(result.error ?? 'Failed to update agent');
      }
    });
  }

  function handleToggleInHouse(agent: AgentWithStats) {
    startTransition(async () => {
      const result = await toggleAgentInHouse(agent.id);
      if (result.success) {
        toast.success(agent.isInHouse ? 'Marked as outside agent' : 'Marked as in-house');
        handleFormSuccess();
      } else {
        toast.error(result.error ?? 'Failed to update agent');
      }
    });
  }

  const filteredAgents = agents.filter((agent) => {
    if (!showInactive && !agent.isActive) return false;
    if (typeFilter === 'in_house' && !agent.isInHouse) return false;
    if (typeFilter === 'outside' && agent.isInHouse) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        agent.name.toLowerCase().includes(q) ||
        agent.email.toLowerCase().includes(q) ||
        (agent.broker ?? '').toLowerCase().includes(q) ||
        (agent.phone ?? '').toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Agents</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Manage your brokerage&apos;s agents and their contact details.
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="size-4 mr-2" />
          Add Agent
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Search agents..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {(['all', 'in_house', 'outside'] as TypeFilter[]).map((f) => (
            <Button
              key={f}
              size="sm"
              variant={typeFilter === f ? 'default' : 'outline'}
              onClick={() => setTypeFilter(f)}
              className="h-8 text-xs"
            >
              {f === 'all' ? 'All' : f === 'in_house' ? 'In-House' : 'Outside'}
            </Button>
          ))}
          <Button
            size="sm"
            variant={showInactive ? 'default' : 'outline'}
            onClick={() => setShowInactive((v) => !v)}
            className="h-8 text-xs"
          >
            Show inactive
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-lg border overflow-hidden">
        {loading ? (
          <div className="p-6 space-y-3">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : filteredAgents.length === 0 ? (
          <div className="py-20 text-center text-muted-foreground">
            <Building2 className="size-10 mx-auto mb-3 opacity-30" />
            {agents.length === 0 ? (
              <>
                <p className="font-medium">No agents yet</p>
                <p className="text-sm mt-1">Add your first agent to get started.</p>
                <Button onClick={openCreate} variant="outline" className="mt-4">
                  <Plus className="size-4 mr-2" />
                  Add Agent
                </Button>
              </>
            ) : (
              <p className="font-medium">No agents match the current filters</p>
            )}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead className="hidden sm:table-cell">Type</TableHead>
                <TableHead className="hidden sm:table-cell">Contact</TableHead>
                <TableHead className="hidden md:table-cell">License #</TableHead>
                <TableHead className="text-center">Transactions</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAgents.map((agent) => (
                <TableRow key={agent.id} className="group">
                  <TableCell>
                    <div className="font-medium">{agent.name}</div>
                    <div className="text-xs text-muted-foreground sm:hidden flex items-center gap-1 mt-0.5">
                      <Mail className="size-3" />
                      {agent.email}
                    </div>
                  </TableCell>

                  <TableCell className="hidden sm:table-cell">
                    <button
                      type="button"
                      onClick={() => handleToggleInHouse(agent)}
                      title="Click to toggle in-house status"
                    >
                      <Badge variant={agent.isInHouse ? 'default' : 'outline'} className="text-xs cursor-pointer">
                        {agent.isInHouse ? 'In-House' : 'Outside'}
                      </Badge>
                    </button>
                  </TableCell>

                  <TableCell className="hidden sm:table-cell">
                    <div className="space-y-0.5">
                      <div className="text-sm flex items-center gap-1.5 text-muted-foreground">
                        <Mail className="size-3 shrink-0" />
                        <a
                          href={`mailto:${agent.email}`}
                          className="hover:text-foreground truncate max-w-[200px]"
                        >
                          {agent.email}
                        </a>
                      </div>
                      {agent.phone && (
                        <div className="text-sm flex items-center gap-1.5 text-muted-foreground">
                          <Phone className="size-3 shrink-0" />
                          <a href={`tel:${agent.phone}`} className="hover:text-foreground">
                            {agent.phone}
                          </a>
                        </div>
                      )}
                    </div>
                  </TableCell>

                  <TableCell className="hidden md:table-cell">
                    {agent.licenseNumber ? (
                      <div className="text-sm flex items-center gap-1.5 text-muted-foreground">
                        <Hash className="size-3" />
                        {agent.licenseNumber}
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>

                  <TableCell className="text-center">
                    <span className="text-sm font-medium">{agent.transactionCount}</span>
                  </TableCell>

                  <TableCell className="text-center">
                    <Badge
                      variant={agent.isActive ? 'default' : 'secondary'}
                      className="text-xs"
                    >
                      {agent.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </TableCell>

                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 px-2"
                        onClick={() => openEdit(agent)}
                      >
                        <Pencil className="size-3.5" />
                        <span className="sr-only">Edit</span>
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 px-2"
                        onClick={() => handleToggleActive(agent)}
                        title={agent.isActive ? 'Deactivate agent' : 'Activate agent'}
                      >
                        {agent.isActive ? (
                          <ToggleRight className="size-4 text-green-600" />
                        ) : (
                          <ToggleLeft className="size-4 text-muted-foreground" />
                        )}
                        <span className="sr-only">
                          {agent.isActive ? 'Deactivate' : 'Activate'}
                        </span>
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 px-2 text-destructive hover:text-destructive"
                        onClick={() => setDeletingAgent(agent)}
                        disabled={agent.transactionCount > 0}
                        title={
                          agent.transactionCount > 0
                            ? 'Cannot delete — agent has linked transactions'
                            : 'Delete agent'
                        }
                      >
                        <Trash2 className="size-3.5" />
                        <span className="sr-only">Delete</span>
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <AgentForm
        agent={editingAgent}
        open={formOpen}
        onOpenChange={setFormOpen}
        onSuccess={handleFormSuccess}
      />

      <AlertDialog open={!!deletingAgent} onOpenChange={(open) => !open && setDeletingAgent(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deletingAgent?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the agent and cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deletingAgent && handleDelete(deletingAgent)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
