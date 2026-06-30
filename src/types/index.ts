import 'next-auth';
import 'next-auth/jwt';

// Extend NextAuth session and JWT types to include role, id, and tenant claims.
declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      role: 'admin' | 'broker' | 'tc' | 'agent';
      // Tenant membership. null only for platform superadmins.
      tenantId: string | null;
      isPlatformAdmin: boolean;
      actingTenantId?: string | null;
      actingExpiresAt?: number | null;
    };
  }

  interface User {
    role?: 'admin' | 'broker' | 'tc' | 'agent';
    tenantId?: string | null;
    isPlatformAdmin?: boolean;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id?: string;
    role?: string;
    tenantId?: string | null;
    isPlatformAdmin?: boolean;
    actingTenantId?: string | null;
    actingExpiresAt?: number | null;
  }
}
