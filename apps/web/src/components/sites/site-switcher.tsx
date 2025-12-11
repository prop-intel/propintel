"use client";

import { useState, useEffect } from "react";
import { ChevronsUpDown, Globe } from "lucide-react";
import { useSite } from "@/contexts/site-context";
import { AddSiteDialog } from "./add-site-dialog";

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

export function SiteSwitcher() {
  const { isMobile } = useSidebar();
  const { activeSite, setActiveSite, sites, isLoading } = useSite();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

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
                className="gap-2 p-2"
              >
                <div className="flex size-6 items-center justify-center rounded-md border">
                  <Globe className="size-3.5 shrink-0" />
                </div>
                <span className="truncate">{site.name ?? site.domain}</span>
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
