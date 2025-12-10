# Phase 4: URL Navigation

## Overview

Display discovered URLs in the sidebar navigation and create URL detail pages.

## Dependencies

- Phase 1 (database schema)
- Phase 2 (site context for active site)

## Files to Create

### `src/server/api/routers/url.ts`

tRPC router for URL management.

```typescript
import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { siteUrls, sites, crawlerVisits } from "@/server/db/schema";
import { eq, and, desc, count } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

export const urlRouter = createTRPCRouter({
  // List URLs for a site
  listBySite: protectedProcedure
    .input(z.object({
      siteId: z.string(),
      limit: z.number().min(1).max(100).default(50),
      offset: z.number().min(0).default(0),
    }))
    .query(async ({ ctx, input }) => {
      // Verify user owns the site
      const site = await ctx.db.query.sites.findFirst({
        where: and(
          eq(sites.id, input.siteId),
          eq(sites.userId, ctx.session.user.id)
        ),
      });
      if (!site) throw new TRPCError({ code: "NOT_FOUND" });

      return ctx.db.query.siteUrls.findMany({
        where: eq(siteUrls.siteId, input.siteId),
        orderBy: [desc(siteUrls.crawlCount), desc(siteUrls.lastCrawled)],
        limit: input.limit,
        offset: input.offset,
      });
    }),

  // Get single URL with stats
  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const url = await ctx.db.query.siteUrls.findFirst({
        where: eq(siteUrls.id, input.id),
        with: {
          site: true,
        },
      });

      if (!url || url.site.userId !== ctx.session.user.id) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      return url;
    }),

  // Get crawler visit stats for a URL
  getStats: protectedProcedure
    .input(z.object({ urlId: z.string() }))
    .query(async ({ ctx, input }) => {
      // Verify ownership through URL -> Site -> User
      const url = await ctx.db.query.siteUrls.findFirst({
        where: eq(siteUrls.id, input.urlId),
        with: { site: true },
      });

      if (!url || url.site.userId !== ctx.session.user.id) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      const visits = await ctx.db
        .select({
          crawlerId: crawlerVisits.crawlerId,
          count: count(),
        })
        .from(crawlerVisits)
        .where(eq(crawlerVisits.urlId, input.urlId))
        .groupBy(crawlerVisits.crawlerId);

      return visits;
    }),
});
```

### `src/components/layout/nav-urls.tsx`

Sidebar component showing URLs for selected site.

```typescript
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
                  {url.crawlCount > 0 && (
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
```

### `src/app/dashboard/url/[id]/page.tsx`

URL detail page (placeholder for now).

```typescript
import { notFound } from "next/navigation";
import { api } from "@/trpc/server";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function UrlDetailPage({ params }: Props) {
  const { id } = await params;

  const url = await api.url.getById({ id }).catch(() => null);

  if (!url) {
    notFound();
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold truncate">{url.path}</h1>
        <p className="text-muted-foreground">
          First seen: {url.firstSeen.toLocaleDateString()}
          {url.lastCrawled && ` | Last crawled: ${url.lastCrawled.toLocaleDateString()}`}
        </p>
      </div>

      <div className="rounded-lg border p-8 text-center text-muted-foreground">
        <p>URL analytics coming soon</p>
        <p className="text-sm mt-2">
          This page will show crawler visit details for this specific URL.
        </p>
      </div>
    </div>
  );
}
```

## Files to Modify

### `src/components/layout/app-sidebar.tsx`

Add NavUrls to sidebar:

```typescript
import { NavUrls } from "@/components/layout/nav-urls";

// In the component, add NavUrls after NavMain:
<SidebarContent>
  <NavMain items={navItems} />
  <NavUrls />
</SidebarContent>
```

### `src/components/layout/nav-main.tsx`

Update navigation items for AEO context:

```typescript
// Update the items prop type to include optional badge
items: {
  title: string;
  url: string;
  icon?: LucideIcon;
  isActive?: boolean;
  items?: { title: string; url: string }[];
}[];
```

### `src/server/api/root.ts`

Add urlRouter:

```typescript
import { urlRouter } from "./routers/url";

export const appRouter = createTRPCRouter({
  post: postRouter,
  site: siteRouter,
  url: urlRouter,  // Add this
});
```

## Acceptance Criteria

- [ ] Sidebar shows URLs for selected site
- [ ] URLs display truncated paths with tooltip for full path
- [ ] URLs show crawl count badge
- [ ] URLs link to `/dashboard/url/[id]` detail pages
- [ ] Detail page shows URL info (path, first seen, last crawled)
- [ ] Empty state when no URLs discovered
- [ ] URLs update when switching sites
- [ ] Loading skeleton during data fetch
