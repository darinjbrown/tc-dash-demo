import NextAuth from 'next-auth';
import { NextResponse } from 'next/server';
import { authConfig } from '@/lib/auth.config';
import { isForbiddenForRole } from '@/lib/roles';

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

  // Redirect authenticated users away from login
  if (isAuthenticated && nextUrl.pathname === '/login') {
    return NextResponse.redirect(new URL('/dashboard', nextUrl.origin));
  }

  // Block read-only viewers from admin-only routes. Fail-closed: a missing role
  // on an authenticated session is treated as the most restricted ('agent').
  const role = (req.auth?.user as { role?: string } | undefined)?.role ?? 'agent';
  if (isAuthenticated && isForbiddenForRole(nextUrl.pathname, role)) {
    return NextResponse.redirect(new URL('/dashboard', nextUrl.origin));
  }

  return NextResponse.next();
});

export const config = {
  // Run on all routes except static assets and Next.js internals
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
