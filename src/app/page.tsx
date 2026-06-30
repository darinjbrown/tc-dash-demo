import type { Metadata } from 'next';
import { auth } from '@/lib/auth';
import { LandingPage } from '@/components/marketing/landing-page';
import { powerTcFontVars } from '@/lib/power-tc-fonts';

// Page-level metadata for the public marketing page. Overrides the layout's
// platform-default title (which is the tenant brand name) so the product's
// landing page reads as "Power TC". The white-label brand-config is untouched.
export const metadata: Metadata = {
  title: 'Power TC — Real estate transaction coordination',
  description:
    'Keep every real estate transaction on track. Auto-dated checklists, dates that recalculate when a milestone moves, and role-based access — for residential and commercial offices.',
};

// The root path is the public marketing landing page — the product's sales
// pitch. It NEVER requires auth. We read the session only so the nav can offer
// "Go to dashboard" instead of "Log in" to a visitor who is already signed in.
export default async function RootPage() {
  const session = await auth();
  return (
    <div className={powerTcFontVars}>
      <LandingPage isAuthenticated={!!session?.user} />
    </div>
  );
}
