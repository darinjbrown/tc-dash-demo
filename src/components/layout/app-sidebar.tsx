'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';
import { useSession } from 'next-auth/react';
import { useBrandContext } from '@/components/providers/theme-provider';
import { canManageAll } from '@/lib/roles';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  LayoutDashboard,
  ArrowLeftRight,
  Users,
  UserCog,
  ListChecks,
  Settings,
  ChevronUp,
  LogOut,
} from 'lucide-react';

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/transactions', label: 'Transactions', icon: ArrowLeftRight },
  { href: '/agents', label: 'Agents', icon: Users },
  { href: '/settings', label: 'Settings', icon: Settings },
  { href: '/templates', label: 'Templates', icon: ListChecks },
];

const ADMIN_NAV_ITEMS = [
  { href: '/users', label: 'User Management', icon: UserCog },
];

export function AppSidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const { brand } = useBrandContext();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isAdmin = session?.user?.role === 'admin';
  const role = session?.user?.role;
  const canManage = !!role && canManageAll(role);
  const visibleNav = canManage
    ? NAV_ITEMS
    : NAV_ITEMS.filter((i) => i.href === '/dashboard' || i.href === '/transactions');
  const userName = session?.user?.name ?? 'User';
  const userEmail = session?.user?.email ?? '';
  const initials = userName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  function isActive(href: string) {
    if (href === '/dashboard') return pathname === '/dashboard';
    return pathname === href || pathname.startsWith(href + '/');
  }

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              asChild
              tooltip={brand.name}
              className="h-auto gap-3 group-data-[collapsible=icon]:p-1.5! [&>span:last-child]:whitespace-normal"
            >
              <Link href="/dashboard">
                {/* Full wordmark when expanded — constrained to the sidebar width so it
                    never overflows onto the top bar. Hidden in collapsed icon mode. */}
                <img
                  src={brand.logo}
                  alt={brand.name}
                  className="h-10 w-auto max-w-full object-contain group-data-[collapsible=icon]:hidden"
                />
                {/* Square icon when collapsed to icon-only width. */}
                <img
                  src={brand.logoIcon}
                  alt={brand.name}
                  className="hidden size-8 shrink-0 object-contain group-data-[collapsible=icon]:block"
                />
                {/* Tagline — hidden automatically in collapsed icon-only mode */}
                <span className="flex-1 text-center text-base text-muted-foreground leading-snug group-data-[collapsible=icon]:hidden">
                  {brand.tagline}
                </span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {[...visibleNav, ...(isAdmin ? ADMIN_NAV_ITEMS : [])].map(({ href, label, icon: Icon }) => (
                <SidebarMenuItem key={href}>
                  <SidebarMenuButton asChild isActive={isActive(href)} tooltip={label}>
                    <Link href={href}>
                      <Icon />
                      <span>{label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            {mounted ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <SidebarMenuButton
                    size="lg"
                    className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                  >
                    <Avatar className="size-8 rounded-lg shrink-0">
                      <AvatarImage src={session?.user?.image ?? undefined} alt={userName} />
                      <AvatarFallback className="rounded-lg text-xs">{initials}</AvatarFallback>
                    </Avatar>
                    <div className="grid flex-1 text-left text-sm leading-tight min-w-0">
                      <span className="truncate font-semibold">{userName}</span>
                      <span className="truncate text-xs text-muted-foreground">{userEmail}</span>
                    </div>
                    <ChevronUp className="ml-auto size-4 shrink-0" />
                  </SidebarMenuButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
                  side="top"
                  align="end"
                  sideOffset={4}
                >
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="cursor-pointer"
                    onClick={() => signOut({ callbackUrl: '/login' })}
                  >
                    <LogOut className="size-4" />
                    Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <SidebarMenuButton size="lg" disabled>
                <Avatar className="size-8 rounded-lg shrink-0">
                  <AvatarFallback className="rounded-lg text-xs">{initials}</AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight min-w-0">
                  <span className="truncate font-semibold">{userName}</span>
                  <span className="truncate text-xs text-muted-foreground">{userEmail}</span>
                </div>
                <ChevronUp className="ml-auto size-4 shrink-0" />
              </SidebarMenuButton>
            )}
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
