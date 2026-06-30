import type { SQL } from 'drizzle-orm';
import type { AnySQLiteColumn } from 'drizzle-orm/sqlite-core';
import { tenantScopeCondition, type ViewerScope } from './access';

/**
 * The single sanctioned tenant predicate for owned-table reads. Thin wrapper over
 * tenantScopeCondition so every scoped query imports from one chokepoint module.
 */
export function tenantPredicate(
  scope: ViewerScope,
  tenantColumn: AnySQLiteColumn,
): SQL | undefined {
  return tenantScopeCondition(scope, tenantColumn);
}
