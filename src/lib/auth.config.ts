import type { NextAuthConfig } from 'next-auth';

export const authConfig = {
  session: { strategy: 'jwt' },
  pages: { signIn: '/login' },
  providers: [], // real providers are added in the full instance (auth.ts)
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = (user as { id?: string }).id;
        token.role = (user as { role?: string }).role;
        // Tenant binding is established ONLY here, at login, from the DB —
        // never from client input. tenantId is null for platform admins.
        token.tenantId = (user as { tenantId?: string | null }).tenantId ?? null;
        token.isPlatformAdmin = (user as { isPlatformAdmin?: boolean }).isPlatformAdmin ?? false;
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
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
