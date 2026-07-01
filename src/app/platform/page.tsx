import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { listTenants } from '@/actions/platform';
import { PlatformConsole } from './_components/platform-console';

export const metadata = { title: 'Power TC — Platform console' };

const FONT_DISPLAY = "var(--font-space-grotesk), 'Space Grotesk', sans-serif";

export default async function PlatformPage() {
  const session = await auth();
  // Server-side gate (defense-in-depth; proxy also gates this prefix).
  if (!session?.user) redirect('/login');
  if (!(session.user as { isPlatformAdmin?: boolean }).isPlatformAdmin) redirect('/dashboard');

  const tenants = await listTenants();

  return (
    <div style={{ maxWidth: 1180, margin: '0 auto', padding: 'clamp(28px,5vw,48px) 28px' }}>
      <div style={{ marginBottom: 28 }}>
        <h1
          style={{
            fontFamily: FONT_DISPLAY,
            fontWeight: 600,
            fontSize: 28,
            letterSpacing: '-.02em',
            color: '#15201B',
          }}
        >
          Offices
        </h1>
        <p style={{ fontSize: 14.5, color: '#5C6B64', marginTop: 4 }}>
          d20web administration — create offices and toggle them active or inactive.
        </p>
      </div>

      <PlatformConsole initialTenants={tenants} />
    </div>
  );
}
