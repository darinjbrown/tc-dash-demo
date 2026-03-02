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
import { createAgent } from '@/actions/agents';

const quickAddSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Valid email required'),
  phone: z.string().optional(),
  broker: z.string().optional(),
});

type QuickAddValues = z.infer<typeof quickAddSchema>;

interface QuickAddAgentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAgentCreated: (agent: { id: string; name: string; broker: string | null }) => void;
}

export function QuickAddAgentDialog({ open, onOpenChange, onAgentCreated }: QuickAddAgentDialogProps) {
  const [isPending, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<QuickAddValues>({
    resolver: zodResolver(quickAddSchema),
  });

  function onSubmit(data: QuickAddValues) {
    startTransition(async () => {
      const result = await createAgent({
        name: data.name,
        email: data.email,
        phone: data.phone,
        broker: data.broker,
      });
      if (result.success && result.data) {
        toast.success(`${data.name} added`);
        onAgentCreated(result.data);
        onOpenChange(false);
        reset();
      } else {
        toast.error(result.error ?? 'Failed to add agent');
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Add In-House Agent</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3 py-1">
          <div className="space-y-1.5">
            <Label htmlFor="qa-name">Full Name *</Label>
            <Input id="qa-name" {...register('name')} placeholder="Jane Smith" autoFocus />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="qa-email">Email *</Label>
            <Input id="qa-email" type="email" {...register('email')} placeholder="jane@brokerage.com" />
            {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="qa-phone">Phone</Label>
            <PhoneInput id="qa-phone" {...register('phone')} placeholder="(707) 000-0000" />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="qa-broker">Brokerage</Label>
            <Input id="qa-broker" {...register('broker')} placeholder="e.g. Sonoma Valley Realty" />
          </div>

          <DialogFooter className="gap-2 flex-col-reverse sm:flex-row pt-1">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Adding...' : 'Add Agent'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
