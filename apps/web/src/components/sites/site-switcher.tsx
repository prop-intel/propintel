"use client";

import { useState, useEffect } from "react";
import { ChevronsUpDown, Globe, Trash2 } from "lucide-react";
import { useSite } from "@/contexts/site-context";
import { AddSiteDialog } from "./add-site-dialog";
import { api } from "@/trpc/react";
import { useRouter } from "next/navigation";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export function SiteSwitcher() {
  const { isMobile } = useSidebar();
  const { activeSite, setActiveSite, sites, isLoading } = useSite();
  const [mounted, setMounted] = useState(false);
  const router = useRouter();
  const utils = api.useUtils();

  const deleteSiteMutation = api.site.delete.useMutation({
    onSuccess: async () => {
      await utils.site.list.invalidate();
      router.refresh();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleDelete = async (e: React.MouseEvent, siteId: string) => {
    e.stopPropagation();

    if (!confirm("Are you sure you want to delete this site? This action cannot be undone.")) {
      return;
    }

    // Calculate new active site if we're deleting the current one
    let nextSite = activeSite;
    if (activeSite?.id === siteId) {
      const remainingSites = sites.filter((s) => s.id !== siteId);
      nextSite = remainingSites.length > 0 ? (remainingSites[0] ?? null) : null;
    }

    try {
      await deleteSiteMutation.mutateAsync({ id: siteId });

      if (activeSite?.id === siteId) {
        setActiveSite(nextSite);
      }

      toast.success("Site deleted successfully");
    } catch (error) {
      // Error handled in mutation callback
    }
  };

  if (!mounted || isLoading) {
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <Skeleton className="h-12 w-full" />
        </SidebarMenuItem>
      </SidebarMenu>
    );
  }

  if (!activeSite) {
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <AddSiteDialog />
        </SidebarMenuItem>
      </SidebarMenu>
    );
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <div className="bg-sidebar-primary text-sidebar-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg">
                <Globe className="size-4" />
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">
                  {activeSite.name ?? activeSite.domain}
                </span>
                <span className="truncate text-xs">{activeSite.domain}</span>
              </div>
              <ChevronsUpDown className="ml-auto" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
            align="start"
            side={isMobile ? "bottom" : "right"}
            sideOffset={4}
          >
            <DropdownMenuLabel className="text-muted-foreground text-xs">
              Your Sites
            </DropdownMenuLabel>
            {sites.map((site) => (
              <DropdownMenuItem
                key={site.id}
                onClick={() => setActiveSite(site)}
                className="gap-2 p-2 group justify-between cursor-pointer"
              >
                <div className="flex items-center gap-2 overflow-hidden">
                  <div className="flex size-6 shrink-0 items-center justify-center rounded-md border">
                    <Globe className="size-3.5 shrink-0" />
                  </div>
                  <span className="truncate text-sm">{site.name ?? site.domain}</span>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive/10 hover:text-destructive shrink-0"
                  onClick={(e) => handleDelete(e, site.id)}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <AddSiteDialog />
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
