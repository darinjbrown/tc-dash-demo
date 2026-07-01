import { db } from '@/db/client';
import { activityLog } from '@/db/schema';
import { getViewerScope, type ViewerScope } from '@/lib/access';
import { ACTOR_LABEL_PLATFORM } from '@/lib/acting';

export function buildActorAttribution(scope: ViewerScope): {
  userId: string | null; actorIsPlatformAdmin: boolean; actorLabel: string | null;
} {
  const acting = scope.actingAs !== null;
  return {
    userId: scope.userId,
    actorIsPlatformAdmin: acting,
    actorLabel: acting ? ACTOR_LABEL_PLATFORM : null,
  };
}

/** Writes one tenant-scoped activity row, attributed from the current scope. */
export async function logActivity(input: {
  tenantId: string;
  action: string;
  transactionId?: string | null;
  details?: string | null;
}): Promise<void> {
  const scope = await getViewerScope();
  const actor = buildActorAttribution(scope);
  await db.insert(activityLog).values({
    id: crypto.randomUUID(),
    tenantId: input.tenantId,
    transactionId: input.transactionId ?? null,
    userId: actor.userId,
    action: input.action,
    details: input.details ?? null,
    actorIsPlatformAdmin: actor.actorIsPlatformAdmin,
    actorLabel: actor.actorLabel,
  });
}
