import { describe, it, expect, vi } from 'vitest';

// Mock server-only modules so the pure attribution builder can be tested in
// Node without a real DB connection or Next.js runtime (mirrors access.test.ts).
vi.mock('@/lib/auth', () => ({ auth: vi.fn() }));
vi.mock('@/db/client', () => ({ db: {} }));

import { buildActorAttribution } from './activity';
import { ACTOR_LABEL_PLATFORM } from './acting';

describe('buildActorAttribution', () => {
  it('marks platform-admin acting writes', () => {
    const a = buildActorAttribution({
      userId: 'admin1', role: 'admin', tenantId: 't1', isPlatformAdmin: false,
      agentIds: null, actingAs: { realAdminId: 'admin1', tenantId: 't1', expiresAt: 9 },
    });
    expect(a).toEqual({ userId: 'admin1', actorIsPlatformAdmin: true, actorLabel: ACTOR_LABEL_PLATFORM });
  });
  it('normal writes are unmarked', () => {
    const a = buildActorAttribution({
      userId: 'u2', role: 'admin', tenantId: 't1', isPlatformAdmin: false,
      agentIds: null, actingAs: null,
    });
    expect(a).toEqual({ userId: 'u2', actorIsPlatformAdmin: false, actorLabel: null });
  });
});
