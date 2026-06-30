'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod/v4';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { ArrowRight } from 'lucide-react';
import { PowerTcLogo } from '@/components/brand/power-tc-logo';
import { RequestAccessDialog } from '@/components/auth/request-access-dialog';

const FONT_DISPLAY = "var(--font-space-grotesk), 'Space Grotesk', sans-serif";

// Scoped styles for the bespoke Power TC form — focus rings, button + link
// hover. Namespaced under .ptc-login so nothing leaks into the themed app.
const SCOPED_CSS = `
.ptc-login ::selection { background: #3FE0A0; color: #08231B; }
.ptc-login .ptc-input {
  width: 100%;
  padding: 11px 13px;
  border-radius: 10px;
  border: 1px solid #E3DCCC;
  background: #fff;
  font-size: 15px;
  color: #15201B;
  font-family: var(--font-hanken), 'Hanken Grotesk', ui-sans-serif, system-ui, sans-serif;
  transition: border-color .15s ease, box-shadow .15s ease;
}
.ptc-login .ptc-input::placeholder { color: #9AA89F; }
.ptc-login .ptc-input:focus {
  outline: none;
  border-color: #3FE0A0;
  box-shadow: 0 0 0 3px rgba(63,224,160,.22);
}
.ptc-login .ptc-submit {
  transition: transform .14s ease, box-shadow .14s ease, opacity .14s ease;
  box-shadow: 0 8px 22px rgba(63,224,160,.3);
}
.ptc-login .ptc-submit:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 12px 30px rgba(63,224,160,.45);
}
.ptc-login .ptc-submit:disabled { opacity: .65; cursor: default; }
.ptc-login .ptc-link { transition: color .14s ease; }
.ptc-login .ptc-link:hover { color: #14463A; }
.ptc-login .ptc-backlink { transition: color .14s ease; }
.ptc-login .ptc-backlink:hover { color: #3FE0A0; }
`;

const loginSchema = z.object({
  email: z.email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [requestOpen, setRequestOpen] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  });

  async function onSubmit(data: LoginForm) {
    setError(null);
    const result = await signIn('credentials', {
      email: data.email,
      password: data.password,
      redirect: false,
    });

    if (result?.error) {
      // The credentials provider raises an InactiveTenantError (code 'inactive')
      // when the office is switched off from the /platform console (decision #7).
      const code = (result as { code?: string }).code;
      if (code === 'inactive') {
        setError('This account is inactive — contact d20web.');
      } else {
        setError('Invalid email or password. Please try again.');
      }
      return;
    }

    router.push('/dashboard');
    router.refresh();
  }

  return (
    <div className="ptc-login" style={{ width: '100%', maxWidth: 420 }}>
      <style dangerouslySetInnerHTML={{ __html: SCOPED_CSS }} />

      {/* Brand lockup */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 10,
          marginBottom: 26,
        }}
      >
        <PowerTcLogo variant="dark" markSize={42} gap={12} />
        <p style={{ fontSize: 13.5, color: '#9CBBB0' }}>
          Real estate transaction coordination
        </p>
      </div>

      {/* Card */}
      <div
        style={{
          background: '#FBFAF5',
          border: '1px solid #E8E2D4',
          borderRadius: 16,
          padding: 'clamp(24px, 5vw, 34px)',
          boxShadow: '0 24px 60px rgba(0,0,0,.28)',
        }}
      >
        <h1
          style={{
            fontFamily: FONT_DISPLAY,
            fontWeight: 600,
            fontSize: 23,
            letterSpacing: '-.02em',
            color: '#15201B',
          }}
        >
          Sign in
        </h1>
        <p style={{ fontSize: 14.5, lineHeight: 1.5, color: '#5C6B64', marginTop: 6 }}>
          Enter your credentials to access your office.
        </p>

        <form
          onSubmit={handleSubmit(onSubmit)}
          style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 22 }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            <label
              htmlFor="email"
              style={{ fontSize: 13, fontWeight: 600, color: '#33403A' }}
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              className="ptc-input"
              placeholder="you@example.com"
              autoComplete="email"
              autoFocus
              {...register('email')}
            />
            {errors.email && (
              <p style={{ fontSize: 13, color: '#B4322B' }}>{errors.email.message}</p>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            <label
              htmlFor="password"
              style={{ fontSize: 13, fontWeight: 600, color: '#33403A' }}
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              className="ptc-input"
              placeholder="••••••••"
              autoComplete="current-password"
              {...register('password')}
            />
            {errors.password && (
              <p style={{ fontSize: 13, color: '#B4322B' }}>{errors.password.message}</p>
            )}
          </div>

          {error && (
            <div
              style={{
                borderRadius: 10,
                background: 'rgba(180,50,43,.08)',
                border: '1px solid rgba(180,50,43,.22)',
                padding: '10px 13px',
                fontSize: 13.5,
                color: '#B4322B',
              }}
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            className="ptc-submit"
            disabled={isSubmitting}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 9,
              width: '100%',
              marginTop: 4,
              padding: '14px 20px',
              borderRadius: 10,
              border: 'none',
              background: '#3FE0A0',
              color: '#08231B',
              fontFamily:
                "var(--font-hanken), 'Hanken Grotesk', ui-sans-serif, system-ui, sans-serif",
              fontWeight: 600,
              fontSize: 15.5,
              cursor: 'pointer',
            }}
          >
            {isSubmitting ? 'Signing in…' : 'Sign in'}
            {!isSubmitting && <ArrowRight size={18} strokeWidth={2.2} color="#08231B" />}
          </button>
        </form>
      </div>

      {/* Request access */}
      <p style={{ marginTop: 18, textAlign: 'center', fontSize: 14, color: '#9CBBB0' }}>
        Don&apos;t have an account?{' '}
        <button
          type="button"
          onClick={() => setRequestOpen(true)}
          className="ptc-link"
          style={{
            background: 'none',
            border: 'none',
            padding: 0,
            cursor: 'pointer',
            font: 'inherit',
            color: '#3FE0A0',
            fontWeight: 600,
          }}
        >
          Request access
        </button>
      </p>

      <p style={{ marginTop: 22, textAlign: 'center' }}>
        <Link
          href="/"
          className="ptc-backlink"
          style={{ fontSize: 13, color: '#7FA499' }}
        >
          ← Back to Power TC
        </Link>
      </p>

      <RequestAccessDialog open={requestOpen} onOpenChange={setRequestOpen} />
    </div>
  );
}
