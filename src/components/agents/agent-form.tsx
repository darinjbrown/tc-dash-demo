'use client';

import { useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
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
import { PhoneInput } from '@/components/ui/phone-input';
import { Label } from '@/components/ui/label';
import { createAgent, updateAgent } from '@/actions/agents';
import type { AgentWithStats } from '@/actions/agents';

const agentFormSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Valid email required'),
  phone: z.string().optional(),
  broker: z.string().optional(),
  licenseNumber: z.string().optional(),
  brokerageId: z.string().optional(),
  isInHouse: z.boolean().optional(),
});

type AgentFormValues = z.infer<typeof agentFormSchema>;

interface AgentFormProps {
  agent?: AgentWithStats | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function AgentForm({ agent, open, onOpenChange, onSuccess }: AgentFormProps) {
  const [isPending, startTransition] = useTransition();
  const isEdit = !!agent;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<AgentFormValues>({
    resolver: zodResolver(agentFormSchema),
    values: agent
      ? {
          name: agent.name,
          email: agent.email,
          phone: agent.phone ?? '',
          broker: agent.broker ?? '',
          licenseNumber: agent.licenseNumber ?? '',
          brokerageId: agent.brokerageId ?? '',
          isInHouse: agent.isInHouse ?? false,
        }
      : undefined,
  });

  function onSubmit(data: AgentFormValues) {
    startTransition(async () => {
      if (isEdit) {
        const result = await updateAgent(agent.id, data);
        if (result.success) {
          toast.success('Agent updated');
          onOpenChange(false);
          onSuccess();
        } else {
          toast.error(result.error ?? 'Failed to update agent');
        }
      } else {
        const result = await createAgent(data);
        if (result.success) {
          toast.success('Agent added');
          onOpenChange(false);
          reset();
          onSuccess();
        } else {
          toast.error(result.error ?? 'Failed to create agent');
        }
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Agent' : 'Add Agent'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="agent-name">Full Name *</Label>
            <Input id="agent-name" {...register('name')} placeholder="Jane Smith" />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="agent-email">Email *</Label>
            <Input
              id="agent-email"
              type="email"
              {...register('email')}
              placeholder="jane@example.com"
            />
            {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="agent-phone">Phone</Label>
              <PhoneInput id="agent-phone" {...register('phone')} placeholder="(707) 000-0000" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="agent-license">CA DRE License #</Label>
              <Input id="agent-license" {...register('licenseNumber')} placeholder="01234567" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="agent-broker">Brokerage Name</Label>
            <Input
              id="agent-broker"
              {...register('broker')}
              placeholder="e.g. Sonoma Valley Realty"
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="isInHouse"
              {...register('isInHouse')}
              className="size-4 accent-primary"
            />
            <Label htmlFor="isInHouse" className="text-sm font-normal cursor-pointer">
              In-House Agent (Bertolone Realty)
            </Label>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="agent-brokerage">Brokerage ID</Label>
            <Input
              id="agent-brokerage"
              {...register('brokerageId')}
              placeholder="Optional internal identifier"
            />
          </div>

          <DialogFooter className="gap-2 flex-col-reverse sm:flex-row pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? (isEdit ? 'Saving...' : 'Adding...') : isEdit ? 'Save Changes' : 'Add Agent'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
