# Phase 2: Site Management

## Overview

Implement site CRUD operations, transform ProjectSwitcher into SiteSwitcher, and create the Add Site modal for users to register their websites.

## Dependencies

- Phase 1 (database schema)

## Files to Create

### `src/server/api/routers/site.ts`

tRPC router for site management.

```typescript
import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { sites } from "@/server/db/schema";
import { eq, and } from "drizzle-orm";
import { nanoid } from "nanoid";
import { TRPCError } from "@trpc/server";

export const siteRouter = createTRPCRouter({
  // List all sites for current user
  list: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.query.sites.findMany({
      where: eq(sites.userId, ctx.session.user.id),
      orderBy: (sites, { desc }) => [desc(sites.createdAt)],
    });
  }),

  // Get single site by ID
  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const site = await ctx.db.query.sites.findFirst({
        where: and(
          eq(sites.id, input.id),
          eq(sites.userId, ctx.session.user.id)
        ),
      });
      if (!site) throw new TRPCError({ code: "NOT_FOUND" });
      return site;
    }),

  // Create new site
  create: protectedProcedure
    .input(z.object({
      domain: z.string().min(1).transform((val) => {
        // Normalize domain: remove protocol, www, trailing slash
        return val
          .replace(/^https?:\/\//, "")
          .replace(/^www\./, "")
          .replace(/\/$/, "")
          .toLowerCase();
      }),
      name: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const trackingId = nanoid(16);
      const [site] = await ctx.db.insert(sites).values({
        userId: ctx.session.user.id,
        domain: input.domain,
        name: input.name ?? input.domain,
        trackingId,
      }).returning();
      return site;
    }),

  // Update site
  update: protectedProcedure
    .input(z.object({
      id: z.string(),
      name: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const [site] = await ctx.db
        .update(sites)
        .set({ name: input.name, updatedAt: new Date() })
        .where(and(
          eq(sites.id, input.id),
          eq(sites.userId, ctx.session.user.id)
        ))
        .returning();
      return site;
    }),

  // Delete site
  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .delete(sites)
        .where(and(
          eq(sites.id, input.id),
          eq(sites.userId, ctx.session.user.id)
        ));
      return { success: true };
    }),
});
```

### `src/contexts/site-context.tsx`

React context for active site state.

```typescript
"use client";

import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { api } from "@/trpc/react";

type Site = {
  id: string;
  domain: string;
  name: string | null;
  trackingId: string;
};

type SiteContextType = {
  activeSite: Site | null;
  setActiveSite: (site: Site | null) => void;
  sites: Site[];
  isLoading: boolean;
};

const SiteContext = createContext<SiteContextType | null>(null);

export function SiteProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const siteIdParam = searchParams.get("site");

  const { data: sites = [], isLoading } = api.site.list.useQuery();
  const [activeSite, setActiveSiteState] = useState<Site | null>(null);

  // Sync active site with URL param or default to first site
  useEffect(() => {
    if (sites.length === 0) {
      setActiveSiteState(null);
      return;
    }

    const site = siteIdParam
      ? sites.find((s) => s.id === siteIdParam)
      : sites[0];

    setActiveSiteState(site ?? sites[0] ?? null);
  }, [sites, siteIdParam]);

  const setActiveSite = (site: Site | null) => {
    setActiveSiteState(site);
    if (site) {
      const params = new URLSearchParams(searchParams.toString());
      params.set("site", site.id);
      router.push(`${pathname}?${params.toString()}`);
    }
  };

  return (
    <SiteContext.Provider value={{ activeSite, setActiveSite, sites, isLoading }}>
      {children}
    </SiteContext.Provider>
  );
}

export function useSite() {
  const context = useContext(SiteContext);
  if (!context) {
    throw new Error("useSite must be used within a SiteProvider");
  }
  return context;
}
```

### `src/components/sites/add-site-dialog.tsx`

Dialog for adding new sites.

```typescript
"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus } from "lucide-react";
import { api } from "@/trpc/react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";

const formSchema = z.object({
  domain: z.string().min(1, "Domain is required"),
  name: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

export function AddSiteDialog() {
  const [open, setOpen] = useState(false);
  const utils = api.useUtils();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { domain: "", name: "" },
  });

  const createSite = api.site.create.useMutation({
    onSuccess: () => {
      utils.site.list.invalidate();
      setOpen(false);
      form.reset();
    },
  });

  const onSubmit = (values: FormValues) => {
    createSite.mutate(values);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" className="gap-2 p-2 w-full justify-start">
          <div className="flex size-6 items-center justify-center rounded-md border bg-transparent">
            <Plus className="size-4" />
          </div>
          <span className="text-muted-foreground font-medium">Add site</span>
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add a new site</DialogTitle>
          <DialogDescription>
            Enter the domain of the site you want to track.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="domain"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Domain</FormLabel>
                  <FormControl>
                    <Input placeholder="example.com" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Display Name (optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="My Website" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="submit" disabled={createSite.isPending}>
                {createSite.isPending ? "Adding..." : "Add Site"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
```

### `src/components/sites/site-switcher.tsx`

Replace ProjectSwitcher with site selection.

```typescript
"use client";

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

  if (isLoading) {
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
```

## Files to Modify

### `src/server/api/root.ts`

Add siteRouter to appRouter:

```typescript
import { siteRouter } from "./routers/site";

export const appRouter = createTRPCRouter({
  post: postRouter,
  site: siteRouter,  // Add this
});
```

### `src/components/layout/app-sidebar.tsx`

Replace ProjectSwitcher and remove sample data:

```typescript
"use client";

import { SiteSwitcher } from "@/components/sites/site-switcher";
import { NavMain } from "@/components/layout/nav-main";
import { NavUser } from "@/components/layout/nav-user";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from "@/components/ui/sidebar";
import {
  LayoutDashboard,
  Code,
  FileText,
  Settings,
} from "lucide-react";

const navItems = [
  {
    title: "Dashboard",
    url: "/dashboard",
    icon: LayoutDashboard,
    isActive: true,
  },
  {
    title: "Tracking Script",
    url: "/dashboard/tracking",
    icon: Code,
  },
  {
    title: "Robots Analysis",
    url: "/dashboard/robots",
    icon: FileText,
  },
  {
    title: "Settings",
    url: "/dashboard/settings",
    icon: Settings,
  },
];

export function AppSidebar({
  user,
  ...props
}: React.ComponentProps<typeof Sidebar> & {
  user: { name?: string | null; email?: string | null; image?: string | null };
}) {
  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SiteSwitcher />
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={navItems} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={user} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
```

### `src/app/dashboard/layout.tsx`

Add SiteProvider and pass user data:

```typescript
import { AppSidebar } from "@/components/layout/app-sidebar";
import { SiteProvider } from "@/contexts/site-context";
import { auth } from "@/server/auth";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  const user = session?.user ?? { name: null, email: null, image: null };

  return (
    <SidebarProvider>
      <SiteProvider>
        <AppSidebar user={user} />
        <SidebarInset>
          <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
            <div className="flex items-center gap-2 px-4">
              <SidebarTrigger className="-ml-1" />
            </div>
          </header>
          {children}
        </SidebarInset>
      </SiteProvider>
    </SidebarProvider>
  );
}
```

## Acceptance Criteria

- [ ] Users can add sites with domain validation
- [ ] SiteSwitcher displays user's sites from database
- [ ] Switching sites updates URL param (`?site=<id>`)
- [ ] Sites can be renamed and deleted
- [ ] Empty state shown for new users (no sites)
- [ ] Active site persists across page navigation
- [ ] Domain normalization works (strips protocol, www, trailing slash)
