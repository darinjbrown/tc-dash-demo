'use client';

import { useBrand } from '@/hooks/use-brand';
import { defaultBrand, premiereBrand } from '@/lib/brand-config';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export function BrandToggle() {
  const { brand, setBrand } = useBrand();

  const brands = [
    { config: defaultBrand, label: 'TC Dashboard (Navy)' },
    { config: premiereBrand, label: 'Premiere Realty (Gold)' },
  ];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Active brand:</span>
        <Badge variant="secondary">{brand.name}</Badge>
      </div>
      <div className="flex gap-2 flex-wrap">
        {brands.map(({ config, label }) => (
          <Button
            key={config.name}
            variant={brand.name === config.name ? 'default' : 'outline'}
            size="sm"
            onClick={() => setBrand(config)}
          >
            {label}
          </Button>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        Brand switches instantly — colors, radius, and name update without a page reload.
      </p>
    </div>
  );
}
