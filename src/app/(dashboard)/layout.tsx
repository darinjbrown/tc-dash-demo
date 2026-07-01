import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/layout/app-sidebar';
import { TopBar } from '@/components/layout/top-bar';
import { getViewerScope } from '@/lib/access';
import { getCurrentBrand } from '@/lib/tenant-branding';
import { ActingBanner } from '@/components/layout/acting-banner';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const scope = await getViewerScope();
  const acting = scope.actingAs !== null;
  const brand = acting ? await getCurrentBrand() : null;
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        {acting && brand && <ActingBanner officeName={brand.name} />}
        <TopBar />
        <div className="flex flex-1 flex-col overflow-auto">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
