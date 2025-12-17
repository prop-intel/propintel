import { cookies } from "next/headers";
import { ThemeProvider } from "next-themes";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { SiteProvider } from "@/contexts/site-context";
import { auth } from "@/server/auth";
import { api } from "@/trpc/server";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  const user = session?.user ?? { name: null, email: null, image: null };

  // Fetch sites server-side
  const sites = await api.site.list();

  // Get active site from cookie or default to first
  const cookieStore = await cookies();
  const cookieSiteId = cookieStore.get("activeSiteId")?.value ?? null;
  const activeSite = cookieSiteId
    ? (sites.find((s) => s.id === cookieSiteId) ?? sites[0])
    : sites[0];

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <SidebarProvider>
        <SiteProvider
          initialSites={sites}
          initialActiveSite={activeSite ?? null}
        >
          <AppSidebar user={user} />
          <SidebarInset>
            {/* <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
              <div className="flex items-center gap-2 px-4">
                <SidebarTrigger className="-ml-1" />
              </div>
            </header> */}
            {children}
          </SidebarInset>
        </SiteProvider>
      </SidebarProvider>
    </ThemeProvider>
  );
}
