'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import {
  Sun,
  Moon,
  Bell,
  Search,
  LayoutDashboard,
  ArrowLeftRight,
  Users,
  Settings,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Separator } from '@/components/ui/separator';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';

const PAGE_TITLES: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/transactions': 'Transactions',
  '/agents': 'Agents',
  '/settings': 'Settings',
};

function getPageTitle(pathname: string): string {
  if (pathname.startsWith('/transactions/')) return 'Transaction Detail';
  return PAGE_TITLES[pathname] ?? 'TC Dashboard';
}

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/transactions', label: 'Transactions', icon: ArrowLeftRight },
  { href: '/agents', label: 'Agents', icon: Users },
  { href: '/settings', label: 'Settings', icon: Settings },
];

export function TopBar() {
  const pathname = usePathname();
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [commandOpen, setCommandOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Cmd+K / Ctrl+K to open command palette
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setCommandOpen((prev) => !prev);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  function navigate(href: string) {
    setCommandOpen(false);
    router.push(href);
  }

  return (
    <>
      <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 h-4" />

        <h1 className="text-sm font-semibold flex-1">{getPageTitle(pathname)}</h1>

        <div className="flex items-center gap-1">
          {/* Search trigger */}
          <Button
            variant="ghost"
            size="sm"
            className="h-8 gap-2 text-muted-foreground text-xs hidden sm:flex"
            onClick={() => setCommandOpen(true)}
          >
            <Search className="size-3.5" />
            <span>Search</span>
            <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100">
              <span className="text-xs">⌘</span>K
            </kbd>
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="size-8 sm:hidden"
            onClick={() => setCommandOpen(true)}
            aria-label="Search"
          >
            <Search className="size-4" />
          </Button>

          {/* Notification bell (placeholder) */}
          <Button variant="ghost" size="icon" className="size-8" aria-label="Notifications">
            <Bell className="size-4" />
          </Button>

          {/* Dark/light mode toggle */}
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            aria-label="Toggle theme"
          >
            <Sun className="size-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
            <Moon className="absolute size-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          </Button>
        </div>
      </header>

      {mounted && (
        <CommandDialog open={commandOpen} onOpenChange={setCommandOpen}>
          <CommandInput placeholder="Go to a page..." />
          <CommandList>
            <CommandEmpty>No results found.</CommandEmpty>
            <CommandGroup heading="Navigation">
              {NAV_ITEMS.map(({ href, label, icon: Icon }) => (
                <CommandItem key={href} onSelect={() => navigate(href)}>
                  <Icon className="size-4" />
                  {label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </CommandDialog>
      )}
    </>
  );
}
