import NextAuth, { CredentialsSignin } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { DrizzleAdapter } from '@auth/drizzle-adapter';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { users, tenants } from '@/db/schema';
import { authConfig } from '@/lib/auth.config';

/**
 * Raised when a user's tenant is inactive. The `code` is surfaced to the login
 * page (via the NextAuth error) so it can show the "inactive" copy. Per the
 * locked decision (#7), inactive tenants are rejected AT LOGIN; data preserved.
 */
export class InactiveTenantError extends CredentialsSignin {
  code = 'inactive';
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: DrizzleAdapter(db),
  providers: [
    Credentials({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const user = await db
          .select()
          .from(users)
          .where(eq(users.email, credentials.email as string))
          .get();

        if (!user?.hashedPassword) return null;

        const valid = await bcrypt.compare(
          credentials.password as string,
          user.hashedPassword,
        );
        if (!valid) return null;

        // Tenant gate: a tenant user whose office is inactive is rejected at
        // login (decision #7). Platform admins (no tenant) bypass this check.
        if (!user.isPlatformAdmin && user.tenantId) {
          const tenant = await db
            .select({ isActive: tenants.isActive })
            .from(tenants)
            .where(eq(tenants.id, user.tenantId))
            .get();
          // Treat a missing or inactive tenant as inactive (fail-closed).
          if (!tenant || !tenant.isActive) {
            throw new InactiveTenantError();
          }
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name ?? undefined,
          role: user.role,
          tenantId: user.tenantId ?? null,
          isPlatformAdmin: user.isPlatformAdmin,
        };
      },
    }),
  ],
});
