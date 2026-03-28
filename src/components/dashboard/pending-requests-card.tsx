'use client';

import { useState, useTransition } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { UserPlus, Check, X, Copy, Building2, Phone, Mail, MapPin, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { approveRequest, denyRequest } from '@/actions/access-requests';
import type { AccessRequest } from '@/db/schema';

interface PendingRequestsCardProps {
  initialRequests: AccessRequest[];
}

const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin',
  broker: 'Broker',
  tc: 'Transaction Coordinator',
  agent: 'Agent',
};

export function PendingRequestsCard({ initialRequests }: PendingRequestsCardProps) {
  const [requests, setRequests] = useState(initialRequests);
  const [roles, setRoles] = useState<Record<string, 'admin' | 'broker' | 'tc' | 'agent'>>(
    Object.fromEntries(initialRequests.map((r) => [r.id, 'tc'])),
  );
  const [denyingId, setDenyingId] = useState<string | null>(null);
  const [approvedInfo, setApprovedInfo] = useState<{ name: string; tempPassword: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleApprove(request: AccessRequest) {
    const role = roles[request.id] ?? 'tc';
    startTransition(async () => {
      const result = await approveRequest(request.id, role);
      if (result.success && result.tempPassword) {
        setRequests((prev) => prev.filter((r) => r.id !== request.id));
        setApprovedInfo({ name: request.name, tempPassword: result.tempPassword! });
      } else {
        toast.error(result.error ?? 'Failed to approve request');
        if (result.error?.includes('already exists')) {
          setRequests((prev) => prev.filter((r) => r.id !== request.id));
        }
      }
    });
  }

  function handleDeny(id: string) {
    startTransition(async () => {
      const result = await denyRequest(id);
      if (result.success) {
        toast.success('Request denied and removed');
        setRequests((prev) => prev.filter((r) => r.id !== id));
      } else {
        toast.error(result.error ?? 'Failed to deny request');
      }
      setDenyingId(null);
    });
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text).then(() => toast.success('Copied to clipboard'));
  }

  const denyingRequest = requests.find((r) => r.id === denyingId);

  if (requests.length === 0 && !approvedInfo) return null;

  return (
    <>
      {requests.length > 0 && <Card className="border-amber-200 dark:border-amber-800">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <UserPlus className="size-4 text-amber-600" />
              Pending Access Requests
            </CardTitle>
            <Badge variant="secondary" className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200">
              {requests.length} pending
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="space-y-3 pt-0">
          {requests.map((req) => (
            <div
              key={req.id}
              className="rounded-lg border bg-muted/30 p-3 space-y-2"
            >
              {/* Name + timestamp */}
              <div className="flex items-start justify-between gap-2">
                <p className="font-medium text-sm">{req.name}</p>
                <span className="text-xs text-muted-foreground flex items-center gap-1 shrink-0">
                  <Clock className="size-3" />
                  {req.createdAt
                    ? formatDistanceToNow(new Date(req.createdAt), { addSuffix: true })
                    : '—'}
                </span>
              </div>

              {/* Contact info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <Mail className="size-3 shrink-0" />
                  {req.email}
                </span>
                <span className="flex items-center gap-1.5">
                  <Phone className="size-3 shrink-0" />
                  {req.phone}
                </span>
                <span className="flex items-center gap-1.5">
                  <Building2 className="size-3 shrink-0" />
                  {req.company}
                </span>
                <span className="flex items-center gap-1.5">
                  <MapPin className="size-3 shrink-0" />
                  {req.address}
                </span>
              </div>

              {/* Note */}
              {req.note && (
                <p className="text-xs text-muted-foreground italic border-l-2 border-muted pl-2">
                  {req.note}
                </p>
              )}

              {/* Role selector + actions */}
              <div className="flex items-center gap-2 pt-1 flex-wrap">
                <Select
                  value={roles[req.id] ?? 'tc'}
                  onValueChange={(v) =>
                    setRoles((prev) => ({ ...prev, [req.id]: v as 'admin' | 'broker' | 'tc' | 'agent' }))
                  }
                >
                  <SelectTrigger className="h-8 w-48 text-xs">
                    <SelectValue placeholder="Assign role" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(ROLE_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value} className="text-xs">
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Button
                  size="sm"
                  className="h-8 text-xs bg-green-600 hover:bg-green-700"
                  onClick={() => handleApprove(req)}
                  disabled={isPending}
                >
                  <Check className="size-3.5 mr-1" />
                  Approve
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs text-destructive hover:text-destructive"
                  onClick={() => setDenyingId(req.id)}
                  disabled={isPending}
                >
                  <X className="size-3.5 mr-1" />
                  Deny
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>}

      {/* Deny confirmation */}
      <AlertDialog open={!!denyingId} onOpenChange={(open) => !open && setDenyingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deny {denyingRequest?.name}&apos;s request?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove their access request.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => denyingId && handleDeny(denyingId)}
            >
              Deny Request
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Temp password modal shown after approval */}
      <AlertDialog open={!!approvedInfo} onOpenChange={(open) => !open && setApprovedInfo(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Account created for {approvedInfo?.name}</AlertDialogTitle>
            <AlertDialogDescription>
              Share these credentials with them. The password cannot be recovered after closing this dialog.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="my-2 rounded-lg border bg-muted px-4 py-3 text-center">
            <p className="text-xs text-muted-foreground mb-1">Temporary password</p>
            <p className="text-2xl font-mono font-bold tracking-widest">{approvedInfo?.tempPassword}</p>
          </div>

          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => approvedInfo && copyToClipboard(approvedInfo.tempPassword)}
            >
              <Copy className="size-4 mr-2" />
              Copy Password
            </Button>
            <AlertDialogAction onClick={() => setApprovedInfo(null)}>Done</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
