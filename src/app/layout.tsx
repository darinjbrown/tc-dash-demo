import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import { ThemeProvider } from '@/components/providers/theme-provider';
import { SessionProvider } from '@/components/providers/session-provider';
import { defaultBrand } from '@/lib/brand-config';
import { getCurrentBrand } from '@/lib/tenant-branding';
import { generateBrandCss } from '@/lib/brand-utils';
import { Toaster } from '@/components/ui/sonner';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

// Static metadata uses the platform default; per-tenant title is applied at the
// dashboard level if needed. (Branding is now runtime/per-tenant, not compile-time.)
export const metadata: Metadata = {
  title: defaultBrand.name,
  description: defaultBrand.tagline ?? 'Transaction Coordinator Dashboard',
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Resolve the current tenant's brand at runtime (falls back to the platform
  // default for the login/marketing shell or platform admins). Rendered into a
  // server <style> tag so the correct colors are in the initial HTML — no flash.
  const brand = await getCurrentBrand();
  const brandCss = generateBrandCss(brand);

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <style dangerouslySetInnerHTML={{ __html: brandCss }} />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <SessionProvider>
          <ThemeProvider initialBrand={brand}>
            {children}
            <Toaster richColors position="top-right" />
          </ThemeProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
