'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Plus, Power, PowerOff, Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { createTenant, setTenantActive, type TenantRow } from '@/actions/platform';

export function PlatformConsole({ initialTenants }: { initialTenants: TenantRow[] }) {
  const [tenants, setTenants] = useState(initialTenants);
  const [createOpen, setCreateOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState({ name: '', slug: '', adminName: '', adminEmail: '' });
  const [tempPassword, setTempPassword] = useState<string | null>(null);

  function toggleActive(t: TenantRow) {
    const next = !t.isActive;
    startTransition(async () => {
      const result = await setTenantActive(t.id, next);
      if (result.success) {
        setTenants((prev) => prev.map((x) => (x.id === t.id ? { ...x, isActive: next } : x)));
        toast.success(next ? `${t.name} is now active` : `${t.name} is now inactive`);
      } else {
        toast.error(result.error ?? 'Failed to update');
      }
    });
  }

  function onCreate() {
    startTransition(async () => {
      const result = await createTenant(form);
      if (result.success) {
        toast.success('Office created');
        setTempPassword(result.tempPassword ?? null);
        setForm({ name: '', slug: '', adminName: '', adminEmail: '' });
        // Optimistic: append a row (counts refresh on next load).
        // The page revalidates server-side; we leave the dialog open to show the password.
      } else {
        toast.error(result.error ?? 'Failed to create office');
      }
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Dialog open={createOpen} onOpenChange={(o) => { setCreateOpen(o); if (!o) setTempPassword(null); }}>
          <DialogTrigger asChild>
            <Button><Plus className="size-4" /> New office</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create office (tenant)</DialogTitle>
              <DialogDescription>
                Seeds branding + the CA template pack and creates the first admin login.
              </DialogDescription>
            </DialogHeader>

            {tempPassword ? (
              <div className="space-y-3">
                <p className="text-sm">Office created. Share these credentials with the new admin:</p>
                <div className="rounded-md bg-muted p-3 text-sm font-mono">
                  <div>Email: {/* shown for convenience */}</div>
                  <div>Temp password: <strong>{tempPassword}</strong></div>
                </div>
                <p className="text-xs text-muted-foreground">
                  They will be prompted to change it. Reload to see the new office in the list.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="t-name">Office name</Label>
                  <Input id="t-name" value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="t-slug">Slug</Label>
                  <Input id="t-slug" value={form.slug} placeholder="crestline"
                    onChange={(e) => setForm({ ...form, slug: e.target.value.toLowerCase() })} />
                  <p className="text-xs text-muted-foreground">Lowercase letters, numbers, hyphens. Immutable once set.</p>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="t-admin-name">First admin name</Label>
                  <Input id="t-admin-name" value={form.adminName}
                    onChange={(e) => setForm({ ...form, adminName: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="t-admin-email">First admin email</Label>
                  <Input id="t-admin-email" type="email" value={form.adminEmail}
                    onChange={(e) => setForm({ ...form, adminEmail: e.target.value })} />
                </div>
              </div>
            )}

            <DialogFooter>
              {tempPassword ? (
                <Button onClick={() => { setCreateOpen(false); setTempPassword(null); }}>Done</Button>
              ) : (
                <Button onClick={onCreate} disabled={pending}>
                  {pending ? 'Creating…' : 'Create office'}
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="rounded-lg border divide-y">
        {tenants.length === 0 && (
          <div className="p-8 text-center text-sm text-muted-foreground">No offices yet.</div>
        )}
        {tenants.map((t) => (
          <div key={t.id} className="flex items-center justify-between gap-4 p-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="rounded-md bg-muted p-2"><Building2 className="size-4" /></div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium truncate">{t.name}</span>
                  <Badge variant={t.isActive ? 'secondary' : 'outline'}>
                    {t.isActive ? 'active' : 'inactive'}
                  </Badge>
                </div>
                <div className="text-xs text-muted-foreground">
                  slug: {t.slug} · {t.userCount} user{t.userCount === 1 ? '' : 's'} · billing: {t.billingStatus}
                </div>
              </div>
            </div>
            <Button
              variant={t.isActive ? 'outline' : 'default'}
              size="sm"
              disabled={pending}
              onClick={() => toggleActive(t)}
            >
              {t.isActive ? <PowerOff className="size-4" /> : <Power className="size-4" />}
              {t.isActive ? 'Deactivate' : 'Activate'}
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
