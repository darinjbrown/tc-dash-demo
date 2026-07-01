'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Plus, Power, PowerOff, Building2, LogIn } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger,
} from '@/components/ui/dialog';
import { createTenant, setTenantActive, type TenantRow } from '@/actions/platform';
import { enterTenant } from '@/actions/acting';

const FONT_DISPLAY = "var(--font-space-grotesk), 'Space Grotesk', sans-serif";
const FONT_MONO = "var(--font-jetbrains-mono), 'JetBrains Mono', monospace";

// Power TC styling for the console. Rendered as a global <style> so the rules
// also reach the create-office dialog, which Radix portals outside this subtree.
const SCOPED_CSS = `
.ptc-console ::selection, .ptc-dialog ::selection { background: #3FE0A0; color: #08231B; }

.ptc-input {
  width: 100%;
  padding: 10px 12px;
  border-radius: 9px;
  border: 1px solid #E3DCCC;
  background: #fff;
  font-size: 14.5px;
  color: #15201B;
  font-family: var(--font-hanken), 'Hanken Grotesk', ui-sans-serif, system-ui, sans-serif;
  transition: border-color .15s ease, box-shadow .15s ease;
}
.ptc-input::placeholder { color: #9AA89F; }
.ptc-input:focus { outline: none; border-color: #3FE0A0; box-shadow: 0 0 0 3px rgba(63,224,160,.22); }

.ptc-btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 8px;
  border-radius: 9px; font-weight: 600; font-size: 14px; cursor: pointer;
  padding: 10px 16px; border: 1px solid transparent;
  font-family: var(--font-hanken), 'Hanken Grotesk', ui-sans-serif, system-ui, sans-serif;
  transition: transform .14s ease, box-shadow .14s ease, border-color .14s ease, background .14s ease, opacity .14s ease;
}
.ptc-btn:disabled { opacity: .6; cursor: default; }
.ptc-btn-primary { background: #3FE0A0; color: #08231B; box-shadow: 0 6px 16px rgba(63,224,160,.28); }
.ptc-btn-primary:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 10px 24px rgba(63,224,160,.42); }
.ptc-btn-outline { background: #fff; color: #15201B; border-color: #E3DCCC; }
.ptc-btn-outline:hover:not(:disabled) { border-color: #3FE0A0; }
.ptc-btn-sm { padding: 8px 13px; font-size: 13px; }

.ptc-badge {
  display: inline-flex; align-items: center; gap: 6px;
  font-size: 11px; font-weight: 600; padding: 3px 9px; border-radius: 999px;
  text-transform: lowercase; letter-spacing: .01em;
}
.ptc-badge-active { background: #E7F7EE; color: #14463A; }
.ptc-badge-inactive { background: #FBF1DD; color: #A9741B; }
.ptc-badge-dot { width: 6px; height: 6px; border-radius: 50%; display: block; }
`;

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
        // The page revalidates server-side; we leave the dialog open to show the password.
      } else {
        toast.error(result.error ?? 'Failed to create office');
      }
    });
  }

  const labelStyle: React.CSSProperties = {
    fontSize: 13,
    fontWeight: 600,
    color: '#33403A',
    display: 'block',
    marginBottom: 6,
  };

  return (
    <div className="ptc-console">
      <style dangerouslySetInnerHTML={{ __html: SCOPED_CSS }} />

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 18 }}>
        <Dialog open={createOpen} onOpenChange={(o) => { setCreateOpen(o); if (!o) setTempPassword(null); }}>
          <DialogTrigger asChild>
            <button type="button" className="ptc-btn ptc-btn-primary">
              <Plus className="size-4" /> New office
            </button>
          </DialogTrigger>
          <DialogContent
            className="ptc-dialog"
            style={{ background: '#FBFAF5', border: '1px solid #E8E2D4', color: '#15201B', borderRadius: 14 }}
          >
            <DialogHeader>
              <DialogTitle style={{ fontFamily: FONT_DISPLAY, fontWeight: 600, color: '#15201B' }}>
                Create office (tenant)
              </DialogTitle>
              <DialogDescription style={{ color: '#5C6B64' }}>
                Seeds branding + the CA template pack and creates the first admin login.
              </DialogDescription>
            </DialogHeader>

            {tempPassword ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <p style={{ fontSize: 14, color: '#33403A' }}>
                  Office created. Share these credentials with the new admin:
                </p>
                <div
                  style={{
                    borderRadius: 10,
                    background: '#E7F7EE',
                    border: '1px solid #CDEBDD',
                    padding: 13,
                    fontFamily: FONT_MONO,
                    fontSize: 13,
                    color: '#14463A',
                  }}
                >
                  Temp password: <strong>{tempPassword}</strong>
                </div>
                <p style={{ fontSize: 12.5, color: '#5C6B64' }}>
                  They will be prompted to change it. Reload to see the new office in the list.
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <label htmlFor="t-name" style={labelStyle}>Office name</label>
                  <input id="t-name" className="ptc-input" value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })} />
                </div>
                <div>
                  <label htmlFor="t-slug" style={labelStyle}>Slug</label>
                  <input id="t-slug" className="ptc-input" value={form.slug} placeholder="crestline"
                    onChange={(e) => setForm({ ...form, slug: e.target.value.toLowerCase() })} />
                  <p style={{ fontSize: 12, color: '#5C6B64', marginTop: 6 }}>
                    Lowercase letters, numbers, hyphens. Immutable once set.
                  </p>
                </div>
                <div>
                  <label htmlFor="t-admin-name" style={labelStyle}>First admin name</label>
                  <input id="t-admin-name" className="ptc-input" value={form.adminName}
                    onChange={(e) => setForm({ ...form, adminName: e.target.value })} />
                </div>
                <div>
                  <label htmlFor="t-admin-email" style={labelStyle}>First admin email</label>
                  <input id="t-admin-email" type="email" className="ptc-input" value={form.adminEmail}
                    onChange={(e) => setForm({ ...form, adminEmail: e.target.value })} />
                </div>
              </div>
            )}

            <DialogFooter>
              {tempPassword ? (
                <button type="button" className="ptc-btn ptc-btn-primary"
                  onClick={() => { setCreateOpen(false); setTempPassword(null); }}>
                  Done
                </button>
              ) : (
                <button type="button" className="ptc-btn ptc-btn-primary" onClick={onCreate} disabled={pending}>
                  {pending ? 'Creating…' : 'Create office'}
                </button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div
        style={{
          background: '#fff',
          border: '1px solid #E8E2D4',
          borderRadius: 14,
          overflow: 'hidden',
        }}
      >
        {tenants.length === 0 && (
          <div style={{ padding: 40, textAlign: 'center', fontSize: 14, color: '#5C6B64' }}>
            No offices yet.
          </div>
        )}
        {tenants.map((t, i) => (
          <div
            key={t.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 16,
              padding: 16,
              borderTop: i === 0 ? undefined : '1px solid #EFEADD',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
              <span
                style={{
                  flex: 'none',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 38,
                  height: 38,
                  borderRadius: 9,
                  background: '#E7F7EE',
                  color: '#14463A',
                }}
              >
                <Building2 className="size-4" />
              </span>
              <div style={{ minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span
                    style={{
                      fontWeight: 600,
                      fontSize: 15,
                      color: '#15201B',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {t.name}
                  </span>
                  <span className={`ptc-badge ${t.isActive ? 'ptc-badge-active' : 'ptc-badge-inactive'}`}>
                    <span
                      className="ptc-badge-dot"
                      style={{ background: t.isActive ? '#25B47C' : '#E0A23C' }}
                    />
                    {t.isActive ? 'active' : 'inactive'}
                  </span>
                </div>
                <div style={{ fontSize: 12.5, color: '#5C6B64', marginTop: 2 }}>
                  slug: {t.slug} · {t.userCount} user{t.userCount === 1 ? '' : 's'} · billing: {t.billingStatus}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 'none' }}>
              <button
                type="button"
                className="ptc-btn ptc-btn-sm ptc-btn-outline"
                disabled={pending}
                onClick={() => startTransition(async () => {
                  const res = await enterTenant(t.id);
                  if (res && !res.success) toast.error(res.error);
                  // success path redirects server-side; no client nav needed.
                })}
              >
                <LogIn className="size-4" /> Enter
              </button>
              <button
                type="button"
                className={`ptc-btn ptc-btn-sm ${t.isActive ? 'ptc-btn-outline' : 'ptc-btn-primary'}`}
                disabled={pending}
                onClick={() => toggleActive(t)}
              >
                {t.isActive ? <PowerOff className="size-4" /> : <Power className="size-4" />}
                {t.isActive ? 'Deactivate' : 'Activate'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
