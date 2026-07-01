import type { NextAuthConfig } from 'next-auth';

export const authConfig = {
  session: { strategy: 'jwt' },
  pages: { signIn: '/login' },
  providers: [], // real providers are added in the full instance (auth.ts)
  callbacks: {
    jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = (user as { id?: string }).id;
        token.role = (user as { role?: string }).role;
        // Tenant binding is established ONLY here, at login, from the DB —
        // never from client input. tenantId is null for platform admins.
        token.tenantId = (user as { tenantId?: string | null }).tenantId ?? null;
        token.isPlatformAdmin = (user as { isPlatformAdmin?: boolean }).isPlatformAdmin ?? false;
      }
      // Acting-as is mutated via unstable_update({ actingTenantId, actingExpiresAt }).
      if (trigger === 'update' && session) {
        const s = session as { actingTenantId?: string | null; actingExpiresAt?: number | null };
        token.actingTenantId = s.actingTenantId ?? null;
        token.actingExpiresAt = s.actingExpiresAt ?? null;
      }
      return token;
    },
    session({ session, token }) {
      if (token) {
        session.user.id = token.id as string;
        const u = session.user as {
          id: string;
          role?: string;
          tenantId?: string | null;
          isPlatformAdmin?: boolean;
        };
        u.role = token.role as string;
        u.tenantId = (token.tenantId as string | null) ?? null;
        u.isPlatformAdmin = (token.isPlatformAdmin as boolean) ?? false;
        (u as { actingTenantId?: string | null }).actingTenantId =
          (token.actingTenantId as string | null) ?? null;
        (u as { actingExpiresAt?: number | null }).actingExpiresAt =
          (token.actingExpiresAt as number | null) ?? null;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
