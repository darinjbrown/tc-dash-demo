import { BrandToggle } from './_components/brand-toggle';

export default function SettingsPage() {
  return (
    <main className="p-6 max-w-2xl">
      <h1 className="text-2xl font-bold">Settings</h1>
      <p className="text-muted-foreground mt-1 mb-8">
        Full settings — coming in Phase 11.
      </p>

      <section className="rounded-lg border p-6">
        <h2 className="text-lg font-semibold mb-1">Branding (Temporary Test)</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Toggle between brand configs to verify the rebranding system. In production,
          change <code className="bg-muted px-1 rounded text-xs">activeBrand</code> in{' '}
          <code className="bg-muted px-1 rounded text-xs">src/lib/brand-config.ts</code>.
        </p>
        <BrandToggle />
      </section>
    </main>
  );
}
