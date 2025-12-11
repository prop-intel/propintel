"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FileText, MoreHorizontal } from "lucide-react";
import { useSite } from "@/contexts/site-context";
import { api } from "@/trpc/react";

import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuAction,
} from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

export function NavUrls() {
  const pathname = usePathname();
  const { activeSite } = useSite();

  const { data: urls = [], isLoading } = api.url.listBySite.useQuery(
    { siteId: activeSite?.id ?? "" },
    { enabled: !!activeSite?.id }
  );

  if (!activeSite) {
    return null;
  }

  if (isLoading) {
    return (
      <SidebarGroup className="group-data-[collapsible=icon]:hidden">
        <SidebarGroupLabel>URLs</SidebarGroupLabel>
        <SidebarMenu>
          {[1, 2, 3].map((i) => (
            <SidebarMenuItem key={i}>
              <Skeleton className="h-8 w-full" />
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroup>
    );
  }

  if (urls.length === 0) {
    return (
      <SidebarGroup className="group-data-[collapsible=icon]:hidden">
        <SidebarGroupLabel>URLs</SidebarGroupLabel>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton disabled className="text-muted-foreground">
              <FileText className="size-4" />
              <span className="text-xs">No URLs tracked yet</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarGroup>
    );
  }

  return (
    <SidebarGroup className="group-data-[collapsible=icon]:hidden">
      <SidebarGroupLabel>URLs ({urls.length})</SidebarGroupLabel>
      <SidebarMenu>
        {urls.map((url) => {
          const isActive = pathname === `/dashboard/url/${url.id}`;
          return (
            <SidebarMenuItem key={url.id}>
              <SidebarMenuButton asChild isActive={isActive}>
                <Link href={`/dashboard/url/${url.id}`}>
                  <FileText className="size-4" />
                  <span className="truncate" title={url.path}>
                    {truncatePath(url.path)}
                  </span>
                  {url.crawlCount && url.crawlCount > 0 && (
                    <Badge variant="secondary" className="ml-auto">
                      {url.crawlCount}
                    </Badge>
                  )}
                </Link>
              </SidebarMenuButton>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <SidebarMenuAction>
                    <MoreHorizontal />
                  </SidebarMenuAction>
                </DropdownMenuTrigger>
                <DropdownMenuContent side="right" align="start">
                  <DropdownMenuItem asChild>
                    <Link href={`/dashboard/url/${url.id}`}>View Details</Link>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </SidebarMenuItem>
          );
        })}
      </SidebarMenu>
    </SidebarGroup>
  );
}

function truncatePath(path: string, maxLength = 25): string {
  if (path.length <= maxLength) return path;
  return "..." + path.slice(-maxLength + 3);
}
