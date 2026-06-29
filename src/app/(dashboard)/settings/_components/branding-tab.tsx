'use client';

import { useState, useTransition, useRef } from 'react';
import { toast } from 'sonner';
import { Upload, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { useBrand } from '@/hooks/use-brand';
import type { BrandConfig } from '@/lib/brand-config';
import { updateTenantBranding, uploadTenantLogo } from '@/actions/branding';

interface BrandingTabProps {
  initialBrand: BrandConfig;
  r2Enabled: boolean;
  canEdit: boolean;
}

export function BrandingTab({ initialBrand, r2Enabled, canEdit }: BrandingTabProps) {
  const { brand, setBrand } = useBrand();
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState({
    name: initialBrand.name,
    tagline: initialBrand.tagline ?? '',
    logoUrl: initialBrand.logo ?? '',
    logoIconUrl: initialBrand.logoIcon ?? '',
    borderRadius: initialBrand.borderRadius,
    primary: initialBrand.colors.primary,
    accent: initialBrand.colors.accent,
  });
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  function applyPreview(next: typeof form) {
    // Live preview: update the in-session brand context immediately.
    setBrand({
      ...brand,
      name: next.name,
      tagline: next.tagline || undefined,
      logo: next.logoUrl || brand.logo,
      logoIcon: next.logoIconUrl || brand.logoIcon,
      borderRadius: next.borderRadius,
      colors: { ...brand.colors, primary: next.primary, accent: next.accent },
    });
  }

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    const next = { ...form, [key]: value };
    setForm(next);
    applyPreview(next);
  }

  function onSave() {
    startTransition(async () => {
      const result = await updateTenantBranding({
        name: form.name,
        tagline: form.tagline,
        logoUrl: form.logoUrl,
        logoIconUrl: form.logoIconUrl,
        borderRadius: form.borderRadius,
        colors: { ...brand.colors, primary: form.primary, accent: form.accent },
        darkColors: brand.darkColors as Record<string, string> | undefined,
      });
      if (result.success) toast.success('Branding saved');
      else toast.error(result.error ?? 'Failed to save branding');
    });
  }

  async function onUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.set('slot', 'logo');
      fd.set('file', file);
      const result = await uploadTenantLogo(fd);
      if (result.success && result.url) {
        update('logoUrl', result.url);
        toast.success('Logo uploaded');
      } else {
        toast.error(result.error ?? 'Upload failed');
      }
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  return (
    <div className="space-y-8 max-w-2xl">
      <section className="rounded-lg border p-6 space-y-4">
        <div>
          <h3 className="text-base font-semibold">Office Branding</h3>
          <p className="text-sm text-muted-foreground">
            These settings are stored per office and applied across the app at runtime.
            {!canEdit && ' (Read-only — contact an admin to change branding.)'}
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="b-name">Name</Label>
            <Input id="b-name" value={form.name} disabled={!canEdit}
              onChange={(e) => update('name', e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="b-tagline">Tagline</Label>
            <Input id="b-tagline" value={form.tagline} disabled={!canEdit}
              onChange={(e) => update('tagline', e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="b-primary">Primary color (HSL)</Label>
            <Input id="b-primary" value={form.primary} disabled={!canEdit}
              placeholder="222.2 47.4% 31.2%"
              onChange={(e) => update('primary', e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="b-accent">Accent color (HSL)</Label>
            <Input id="b-accent" value={form.accent} disabled={!canEdit}
              placeholder="210 40% 96.1%"
              onChange={(e) => update('accent', e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="b-radius">Border radius</Label>
            <Input id="b-radius" value={form.borderRadius} disabled={!canEdit}
              placeholder="0.5rem"
              onChange={(e) => update('borderRadius', e.target.value)} />
          </div>
        </div>

        <Separator />

        <div className="space-y-3">
          <Label htmlFor="b-logo">Logo URL</Label>
          <Input id="b-logo" value={form.logoUrl} disabled={!canEdit}
            placeholder="https://… or /brand/logo.svg"
            onChange={(e) => update('logoUrl', e.target.value)} />

          {/* R2 upload control — degrades gracefully: hidden/disabled when R2 is
              not configured, in which case the URL field above is used manually. */}
          {r2Enabled ? (
            <div>
              <input ref={fileRef} type="file" accept="image/*" className="hidden"
                onChange={onUpload} disabled={!canEdit || uploading} />
              <Button type="button" variant="outline" size="sm" disabled={!canEdit || uploading}
                onClick={() => fileRef.current?.click()}>
                {uploading ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
                {uploading ? 'Uploading…' : 'Upload logo'}
              </Button>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              Logo uploads are disabled (Cloudflare R2 not configured). Set a hosted logo URL above.
            </p>
          )}
        </div>

        {canEdit && (
          <div className="pt-2">
            <Button type="button" onClick={onSave} disabled={pending}>
              {pending ? 'Saving…' : 'Save Branding'}
            </Button>
          </div>
        )}
      </section>

      <section className="rounded-lg border p-6 space-y-2">
        <h3 className="text-base font-semibold">Live Preview</h3>
        <p className="text-sm text-muted-foreground">
          Changes preview instantly across the app and are persisted to this office when you save.
        </p>
        <div className="flex items-center gap-3 pt-2">
          <div className="rounded-md px-4 py-2 text-sm font-medium"
            style={{ background: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))' }}>
            {brand.name}
          </div>
          <span className="text-sm text-muted-foreground">{brand.tagline}</span>
        </div>
      </section>
    </div>
  );
}
