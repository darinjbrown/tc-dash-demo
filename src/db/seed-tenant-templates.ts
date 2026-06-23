/**
 * Per-tenant default template seeding (plan §5.2).
 *
 * Seeds the default CA template pack (the 3 built-in groups + the
 * `defaultTaskTemplates` rows) for a single tenant, all stamped with that
 * tenant's id. Called when a new office is onboarded from the /platform console,
 * so "new office" = "tenant row + branding row + seeded template pack" with no
 * deploy. Returns the created group ids.
 *
 * Accepts any Drizzle-libSQL database handle so it can run inside a server
 * action (using the app `db`) or a standalone script.
 */
import { taskTemplateGroups, taskTemplates } from './schema';
import { defaultTaskTemplates } from '../lib/task-templates';

type Db = {
  insert: (table: unknown) => { values: (rows: unknown) => Promise<unknown> };
};

export async function seedTenantTemplates(
  database: Db,
  tenantId: string,
): Promise<{ listingGroupId: string; purchaseGroupId: string; dualGroupId: string }> {
  const listingGroupId = crypto.randomUUID();
  const purchaseGroupId = crypto.randomUUID();
  const dualGroupId = crypto.randomUUID();
  const now = new Date();

  await database.insert(taskTemplateGroups).values([
    {
      id: listingGroupId,
      tenantId,
      name: 'Listing Template',
      description: 'Tasks for listing transactions',
      transactionType: 'listing',
      isDefault: true,
      isActive: true,
      sortOrder: 0,
      createdAt: now,
    },
    {
      id: purchaseGroupId,
      tenantId,
      name: 'Purchase Template',
      description: 'Tasks for purchase transactions',
      transactionType: 'purchase',
      isDefault: true,
      isActive: true,
      sortOrder: 1,
      createdAt: now,
    },
    {
      id: dualGroupId,
      tenantId,
      name: 'Dual Agency Template',
      description: 'Additional tasks specific to dual agency transactions',
      transactionType: 'dual',
      isDefault: true,
      isActive: true,
      sortOrder: 2,
      createdAt: now,
    },
  ]);

  const templateRows = defaultTaskTemplates.map((t) => ({
    id: crypto.randomUUID(),
    tenantId,
    templateGroupId: t.transactionType === 'listing' ? listingGroupId : purchaseGroupId,
    name: t.name,
    description: t.description ?? null,
    category: t.category,
    relativeDueDays: t.relativeDueDays,
    relativeTo: t.relativeTo,
    sortOrder: t.sortOrder,
    isRequired: t.isRequired !== false,
    isActive: true,
    createdAt: now,
  }));

  await database.insert(taskTemplates).values(templateRows);

  return { listingGroupId, purchaseGroupId, dualGroupId };
}
