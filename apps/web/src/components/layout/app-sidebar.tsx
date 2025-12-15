"use client";

import * as React from "react";
import { 
  Activity, 
  BarChart3, 
  Lightbulb, 
  Settings 
} from "lucide-react";

import { NavMain } from "@/components/layout/nav-main";
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
    title: "Monitor",
    url: "/dashboard",
    icon: Activity,
    isActive: true,
  },
  {
    title: "Analyze",
    url: "/dashboard/analyze",
    icon: BarChart3,
  },
  {
    title: "Recommendations",
    url: "/dashboard/recommendations",
    icon: Lightbulb,
  },
  {
    title: "Configuration",
    url: "/dashboard/configuration",
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
