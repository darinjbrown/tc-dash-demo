import NextAuth from 'next-auth';
import { NextResponse } from 'next/server';
import { authConfig } from '@/lib/auth.config';
import { isForbiddenForRole, isPlatformPath } from '@/lib/roles';

// Edge-safe instance: built from authConfig only, so no Node-only code
// (bcrypt / Drizzle adapter) is pulled into the Edge proxy bundle.
const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const { nextUrl } = req;
  const isAuthenticated = !!req.auth;

  // Allow these paths without auth
  const isPublic =
    nextUrl.pathname.startsWith('/login') ||
    nextUrl.pathname.startsWith('/api/auth');

  if (!isAuthenticated && !isPublic) {
    return NextResponse.redirect(new URL('/login', nextUrl.origin));
  }

  // Tenant + platform claims come straight off the signed JWT (never the URL).
  const user = req.auth?.user as
    | { role?: string; tenantId?: string | null; isPlatformAdmin?: boolean }
    | undefined;
  const role = user?.role ?? 'agent';
  const tenantId = user?.tenantId ?? null;
  const isPlatformAdmin = user?.isPlatformAdmin ?? false;

  // Redirect authenticated users away from login (to their home surface).
  if (isAuthenticated && nextUrl.pathname === '/login') {
    const home = isPlatformAdmin ? '/platform' : '/dashboard';
    return NextResponse.redirect(new URL(home, nextUrl.origin));
  }

  // /platform/* is platform-admin-only. Everyone else is bounced to /dashboard.
  if (isAuthenticated && isPlatformPath(nextUrl.pathname)) {
    if (!isPlatformAdmin) {
      return NextResponse.redirect(new URL('/dashboard', nextUrl.origin));
    }
    return NextResponse.next();
  }

  // Dashboard (and every non-platform authed route): a tenant binding is
  // required. A user with no tenant who is NOT a platform admin is fail-closed —
  // send them to login (their token can't scope any data).
  if (isAuthenticated && !tenantId && !isPlatformAdmin) {
    return NextResponse.redirect(new URL('/login', nextUrl.origin));
  }

  // A platform admin has no tenant, so keep them on /platform rather than the
  // tenant dashboard (which would fail-closed to empty).
  if (isAuthenticated && isPlatformAdmin && nextUrl.pathname.startsWith('/dashboard')) {
    return NextResponse.redirect(new URL('/platform', nextUrl.origin));
  }

  // Block read-only viewers from admin-only routes. Fail-closed: a missing role
  // on an authenticated session is treated as the most restricted ('agent').
  if (isAuthenticated && isForbiddenForRole(nextUrl.pathname, role)) {
    return NextResponse.redirect(new URL('/dashboard', nextUrl.origin));
  }

  return NextResponse.next();
});

export const config = {
  // Run on all routes except static assets and Next.js internals
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
