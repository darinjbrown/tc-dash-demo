'use client';

import { useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { createAccessRequest } from '@/actions/access-requests';

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Valid email required'),
  phone: z.string().min(1, 'Phone is required'),
  address: z.string().min(1, 'Address is required'),
  company: z.string().min(1, 'Company is required'),
  note: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

interface RequestAccessDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function RequestAccessDialog({ open, onOpenChange }: RequestAccessDialogProps) {
  const [submitted, setSubmitted] = useState(false);
  const [isPending, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  function onSubmit(data: FormValues) {
    startTransition(async () => {
      const result = await createAccessRequest(data);
      if (result.success) {
        setSubmitted(true);
        reset();
      } else {
        toast.error(result.error ?? 'Failed to submit request');
      }
    });
  }

  function handleClose(open: boolean) {
    onOpenChange(open);
    if (!open) setSubmitted(false);
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Request Access</DialogTitle>
          <DialogDescription>
            Fill out your information and an administrator will review your request.
          </DialogDescription>
        </DialogHeader>

        {submitted ? (
          <div className="py-6 text-center space-y-2">
            <p className="text-sm font-medium">Request submitted!</p>
            <p className="text-sm text-muted-foreground">
              An administrator will review your request and provide your login credentials.
            </p>
            <Button className="mt-4" onClick={() => handleClose(false)}>
              Close
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-3 py-1">
            <div className="space-y-1.5">
              <Label htmlFor="ra-name">Full Name *</Label>
              <Input id="ra-name" {...register('name')} placeholder="Jane Smith" autoFocus />
              {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="ra-email">Email *</Label>
                <Input id="ra-email" type="email" {...register('email')} placeholder="you@example.com" />
                {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ra-phone">Phone *</Label>
                <Input id="ra-phone" {...register('phone')} placeholder="(707) 000-0000" />
                {errors.phone && <p className="text-xs text-destructive">{errors.phone.message}</p>}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="ra-company">Company / Brokerage *</Label>
              <Input id="ra-company" {...register('company')} placeholder="Sonoma Valley Realty" />
              {errors.company && <p className="text-xs text-destructive">{errors.company.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="ra-address">Address *</Label>
              <Input id="ra-address" {...register('address')} placeholder="123 Main St, Santa Rosa, CA" />
              {errors.address && <p className="text-xs text-destructive">{errors.address.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="ra-note">Note <span className="text-muted-foreground">(optional)</span></Label>
              <Textarea
                id="ra-note"
                {...register('note')}
                placeholder="Anything you'd like the admin to know..."
                rows={2}
                className="resize-none"
              />
            </div>

            <DialogFooter className="gap-2 flex-col-reverse sm:flex-row pt-1">
              <Button type="button" variant="outline" onClick={() => handleClose(false)} disabled={isPending}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? 'Submitting...' : 'Submit Request'}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
