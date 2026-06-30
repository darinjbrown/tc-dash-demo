import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

// Owned tables that MUST be tenant-scoped in every query.
const OWNED = [
  'agents',
  'transactions',
  'transactionAgents',
  'taskTemplateGroups',
  'taskTemplates',
  'transactionTasks',
  'activityLog',
  'tenantBranding',
];

// Files allowed to query owned tables without the runtime tenant predicate:
// seeds (offline), the scoped-helper module itself, and tests.
const ALLOWLIST = [
  'src/db/seed.ts',
  'src/db/demo-seed.ts',
  'src/lib/tenant-query.ts',
  // Platform superadmin surface. Every function gates on isPlatformAdmin and
  // operates ACROSS tenants by design (plan §1.4). Its only owned-table touch is
  // the tenantBranding insert in createTenant, which stamps a brand-new tenantId
  // the platform admin is provisioning — not a session tenant — so neither
  // tenantPredicate (reads) nor requireTenantWrite (would deny the tenant-less
  // platform admin) applies. This is a legitimate cross-tenant path, not debt.
  'src/actions/platform.ts',
];

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(p) && !/\.test\.tsx?$/.test(p)) out.push(p);
  }
  return out;
}

// A query is considered "scoped" if the same file references the tenant predicate
// helpers. This is a coarse safety net, not a type-level proof.
const SCOPE_MARKERS = ['tenantScopeCondition', 'requireTenantWrite', 'tenantPredicate'];

describe('tenant chokepoint', () => {
  it('no owned-table query without a tenant predicate', () => {
    const offenders: string[] = [];
    for (const file of walk('src')) {
      const rel = file.replace(/\\/g, '/');
      if (ALLOWLIST.some((a) => rel.endsWith(a))) continue;
      const src = readFileSync(file, 'utf8');
      const touchesOwned = OWNED.some((t) =>
        new RegExp(`\\.from\\(\\s*${t}\\b|insert\\(\\s*${t}\\b|update\\(\\s*${t}\\b|delete\\(\\s*${t}\\b`).test(src),
      );
      if (!touchesOwned) continue;
      const scoped = SCOPE_MARKERS.some((m) => src.includes(m));
      if (!scoped) offenders.push(rel);
    }
    expect(offenders, `Unscoped owned-table access in:\n${offenders.join('\n')}`).toEqual([]);
  });
});
