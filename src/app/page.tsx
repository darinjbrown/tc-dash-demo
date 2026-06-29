import { auth } from '@/lib/auth';
import { LandingPage } from '@/components/marketing/landing-page';

// The root path is the public marketing landing page — the product's sales
// pitch. It NEVER requires auth. We read the session only so the nav can offer
// "Go to dashboard" instead of "Log in" to a visitor who is already signed in.
export default async function RootPage() {
  const session = await auth();
  return <LandingPage isAuthenticated={!!session?.user} />;
}
