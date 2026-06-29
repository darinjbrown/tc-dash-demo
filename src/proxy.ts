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

  // Allow these paths without auth. The root path is the public marketing
  // landing page (exact match only — never `startsWith('/')`, which would open
  // every route).
  const isPublic =
    nextUrl.pathname === '/' ||
    nextUrl.pathname.startsWith('/login') ||
    nextUrl.pathname.startsWith('/api/auth');

  // Unauthenticated: serve public paths, bounce everything else to /login.
  if (!isAuthenticated) {
    if (isPublic) return NextResponse.next();
    return NextResponse.redirect(new URL('/login', nextUrl.origin));
  }

  // ---- authenticated from here down ----
  // Tenant + platform claims come straight off the signed JWT (never the URL).
  const user = req.auth?.user as
    | { role?: string; tenantId?: string | null; isPlatformAdmin?: boolean }
    | undefined;
  const role = user?.role ?? 'agent';
  const tenantId = user?.tenantId ?? null;
  const isPlatformAdmin = user?.isPlatformAdmin ?? false;

  // Dead-end token: authenticated, but a non-admin with NO tenant binding. Its
  // claims can't scope any data, so force a clean re-login. This arises whenever
  // the JWT shape changes (e.g. tenantId was added on the multi-tenant branch)
  // and an old, still-validly-signed cookie lacks the new claims.
  //
  // CRITICAL: this runs BEFORE the "redirect away from /login" rule below AND
  // lets public paths pass through. That passthrough is what actually breaks the
  // redirect loop — without it, /dashboard -> /login -> /dashboard ping-pongs
  // forever (ERR_TOO_MANY_REDIRECTS). Clearing the cookie is only best-effort
  // cleanup; it must NOT be what the loop fix depends on (a missed cookie name,
  // a __Secure- prefix, or a chunked .0/.1 cookie would silently reopen the loop).
  if (!isPlatformAdmin && !tenantId) {
    if (isPublic) return NextResponse.next();
    const res = NextResponse.redirect(new URL('/login', nextUrl.origin));
    // Name-independent: drop every auth session cookie present on the request,
    // covering authjs./next-auth. prefixes, __Secure- variants, and chunks.
    for (const cookie of req.cookies.getAll()) {
      if (cookie.name.includes('session-token')) res.cookies.delete(cookie.name);
    }
    return res;
  }

  // Authenticated WITH a usable token: keep them off the login page.
  if (nextUrl.pathname === '/login') {
    const home = isPlatformAdmin ? '/platform' : '/dashboard';
    return NextResponse.redirect(new URL(home, nextUrl.origin));
  }

  // /platform/* is platform-admin-only. Everyone else is bounced to /dashboard.
  if (isPlatformPath(nextUrl.pathname)) {
    if (!isPlatformAdmin) {
      return NextResponse.redirect(new URL('/dashboard', nextUrl.origin));
    }
    return NextResponse.next();
  }

  // A platform admin has no tenant, so keep them on /platform rather than the
  // tenant dashboard (which would fail-closed to empty).
  if (isPlatformAdmin && nextUrl.pathname.startsWith('/dashboard')) {
    return NextResponse.redirect(new URL('/platform', nextUrl.origin));
  }

  // Block read-only viewers from admin-only routes. Fail-closed: a missing role
  // on an authenticated session is treated as the most restricted ('agent').
  if (isForbiddenForRole(nextUrl.pathname, role)) {
    return NextResponse.redirect(new URL('/dashboard', nextUrl.origin));
  }

  return NextResponse.next();
});

export const config = {
  // Run on all routes except static assets and Next.js internals
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
