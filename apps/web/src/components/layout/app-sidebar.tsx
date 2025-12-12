"use client";

import * as React from "react";
import { Brain, Code, FileText, LayoutDashboard, Settings } from "lucide-react";

import { NavMain } from "@/components/layout/nav-main";
import { NavUrls } from "@/components/layout/nav-urls";
import { NavUser } from "@/components/layout/nav-user";
import { SiteSwitcher } from "@/components/sites/site-switcher";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from "@/components/ui/sidebar";

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
    title: "Agent Analysis",
    url: "/dashboard/agent-analysis",
    icon: Brain,
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
        <NavUrls />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={user} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
