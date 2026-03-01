import 'next-auth';
import 'next-auth/jwt';

// Extend NextAuth session and JWT types to include role and id
declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      role: 'admin' | 'broker' | 'tc' | 'agent';
    };
  }

  interface User {
    role?: 'admin' | 'broker' | 'tc' | 'agent';
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id?: string;
    role?: string;
  }
}
