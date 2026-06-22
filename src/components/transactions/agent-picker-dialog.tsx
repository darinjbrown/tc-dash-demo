'use client';

import { useState, useTransition } from 'react';
import { Search, Plus, Star } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { createAgent } from '@/actions/agents';
import type { AgentFormValues } from '@/actions/agents';

export type AgentOption = {
  id: string;
  name: string;
  broker: string | null;
  email: string;
  phone: string | null;
  isInHouse: boolean;
};

interface AgentPickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  side: 'listing' | 'buyer';
  existingAgentIds: string[];
  agents: AgentOption[];
  onAdd: (agentId: string, isPrimary: boolean) => void;
  onAgentCreated?: (agent: AgentOption) => void;
}

export function AgentPickerDialog({
  open,
  onOpenChange,
  side,
  existingAgentIds,
  agents,
  onAdd,
  onAgentCreated,
}: AgentPickerDialogProps) {
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isPrimary, setIsPrimary] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newAgent, setNewAgent] = useState<Partial<AgentFormValues>>({});
  const [isPending, startTransition] = useTransition();

  const filtered = agents
    .filter((a) => !existingAgentIds.includes(a.id))
    .filter((a) => {
      const q = search.toLowerCase();
      return (
        !q ||
        a.name.toLowerCase().includes(q) ||
        (a.broker ?? '').toLowerCase().includes(q) ||
        a.email.toLowerCase().includes(q)
      );
    });

  const inHouse = filtered.filter((a) => a.isInHouse);
  const outside = filtered.filter((a) => !a.isInHouse);

  function handleConfirm() {
    if (!selectedId) return;
    onAdd(selectedId, isPrimary);
    reset();
    onOpenChange(false);
  }

  function reset() {
    setSearch('');
    setSelectedId(null);
    setIsPrimary(false);
    setShowCreateForm(false);
    setNewAgent({});
  }

  function handleCreateAgent() {
    if (!newAgent.name || !newAgent.email) return;
    startTransition(async () => {
      const result = await createAgent(newAgent as AgentFormValues);
      if (result.success && result.data) {
        const created: AgentOption = {
          id: result.data.id,
          name: result.data.name,
          broker: result.data.broker,
          email: result.data.email,
          phone: result.data.phone,
          isInHouse: newAgent.isInHouse ?? false,
        };
        onAgentCreated?.(created);
        setSelectedId(created.id);
        setShowCreateForm(false);
        toast.success(`${created.name} added to agent directory`);
      } else {
        toast.error(result.error ?? 'Failed to create agent');
      }
    });
  }

  const sideLabel = side === 'listing' ? 'Listing Agent' : "Buyer's Agent";

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add {sideLabel}</DialogTitle>
        </DialogHeader>

        {!showCreateForm ? (
          <>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                placeholder="Search agents..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8"
              />
            </div>

            <div className="max-h-64 overflow-y-auto space-y-3">
              {inHouse.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide px-1 mb-1">
                    In-House
                  </p>
                  {inHouse.map((a) => (
                    <AgentRow key={a.id} agent={a} selected={selectedId === a.id} onSelect={setSelectedId} />
                  ))}
                </div>
              )}
              {outside.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide px-1 mb-1">
                    Outside
                  </p>
                  {outside.map((a) => (
                    <AgentRow key={a.id} agent={a} selected={selectedId === a.id} onSelect={setSelectedId} />
                  ))}
                </div>
              )}
              {filtered.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-6">No agents found</p>
              )}
            </div>

            <div className="flex items-center gap-2 pt-1">
              <Checkbox
                id="isPrimary"
                checked={isPrimary}
                onCheckedChange={(v) => setIsPrimary(!!v)}
              />
              <Label htmlFor="isPrimary" className="text-sm font-normal cursor-pointer flex items-center gap-1">
                <Star className="size-3 text-yellow-500" />
                Set as Primary
              </Label>
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowCreateForm(true)}
              >
                <Plus className="size-4 mr-1" />
                New Agent
              </Button>
              <Button size="sm" onClick={handleConfirm} disabled={!selectedId}>
                Add Agent
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <div className="space-y-3">
              <div className="grid gap-1.5">
                <Label htmlFor="newName">Name *</Label>
                <Input
                  id="newName"
                  value={newAgent.name ?? ''}
                  onChange={(e) => setNewAgent((p) => ({ ...p, name: e.target.value }))}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="newEmail">Email *</Label>
                <Input
                  id="newEmail"
                  type="email"
                  value={newAgent.email ?? ''}
                  onChange={(e) => setNewAgent((p) => ({ ...p, email: e.target.value }))}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="newPhone">Phone</Label>
                <Input
                  id="newPhone"
                  value={newAgent.phone ?? ''}
                  onChange={(e) => setNewAgent((p) => ({ ...p, phone: e.target.value }))}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="newBroker">Brokerage</Label>
                <Input
                  id="newBroker"
                  value={newAgent.broker ?? ''}
                  onChange={(e) => setNewAgent((p) => ({ ...p, broker: e.target.value }))}
                />
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="newIsInHouse"
                  checked={newAgent.isInHouse ?? false}
                  onCheckedChange={(v) => setNewAgent((p) => ({ ...p, isInHouse: !!v }))}
                />
                <Label htmlFor="newIsInHouse" className="text-sm font-normal cursor-pointer">
                  In-House Agent (Crestline Realty)
                </Label>
              </div>
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button type="button" variant="outline" size="sm" onClick={() => setShowCreateForm(false)}>
                Back
              </Button>
              <Button
                size="sm"
                onClick={handleCreateAgent}
                disabled={isPending || !newAgent.name || !newAgent.email}
              >
                {isPending ? 'Saving...' : 'Save & Select'}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function AgentRow({
  agent,
  selected,
  onSelect,
}: {
  agent: AgentOption;
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(agent.id)}
      className={cn(
        'w-full text-left px-3 py-2 rounded-md text-sm transition-colors',
        selected ? 'bg-primary text-primary-foreground' : 'hover:bg-muted',
      )}
    >
      <div className="font-medium">{agent.name}</div>
      {agent.broker && <div className="text-xs opacity-70">{agent.broker}</div>}
    </button>
  );
}
