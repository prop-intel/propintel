"use client";

import { useState } from "react";
import { SummaryCards } from "@/components/dashboard/summary-cards";
import { CrawlerChart } from "@/components/dashboard/crawler-chart";
import { TimelineTabs } from "@/components/dashboard/timeline-tabs";
import { TopPagesTable } from "@/components/dashboard/top-pages-table";
import { CrawlerHeatmap } from "@/components/dashboard/crawler-heatmap";
import { DashboardFilters } from "@/components/dashboard/dashboard-filters";
import {
  TrackingStatusBadge,
  TrackingSetupDialog,
  TrackingEmptyState,
} from "@/components/dashboard/tracking-status";
import { UnmatchedUserAgents } from "@/components/dashboard/unmatched-user-agents";
import { useSite } from "@/contexts/site-context";
import type { UserRole } from "@/server/auth/config";

type Site = {
  id: string;
  domain: string;
  name: string | null;
  trackingId: string;
};

interface DashboardContentProps {
  site: Site;
  sites: Site[];
  initialData: {
    summary: {
      totalVisits: number;
      totalUrls: number;
      uniqueCrawlers: number;
      visitsToday: number;
    };
    crawlerStats: Array<{
      crawlerId: string | null;
      count: number;
      crawler?: {
        id: string;
        name: string;
        company: string;
        category: string | null;
      };
    }>;
    timeline: {
      data: Array<{ date: string; count: number }>;
      aggregation: "hourly" | "daily";
    };
    topPages: Array<{
      id: string;
      path: string;
      crawlCount: number;
      lastCrawled: Date | null;
      trend: number[];
    }>;
    trackingStatus: {
      hasPixel: boolean;
      hasMiddleware: boolean;
      pixelCount: number;
      middlewareCount: number;
    };
  };
  timeFrameLabel: string;
  userRole: UserRole;
}

export function DashboardContent({
  site,
  initialData,
  timeFrameLabel,
  userRole,
}: DashboardContentProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const { activeSite } = useSite();

  // Use context site for reactive updates, fallback to prop for initial render
  const currentSite = activeSite ?? site;

  // Detect if we're switching sites (context updated but server data is stale)
  const isSiteSwitching = currentSite.id !== site.id;

  const hasTracking =
    initialData.trackingStatus.hasPixel ||
    initialData.trackingStatus.hasMiddleware;

  // Transform data to match component prop types
  const crawlerChartData = initialData.crawlerStats.map((stat) => ({
    crawlerId: stat.crawlerId,
    count: stat.count,
    crawler: stat.crawler
      ? { name: stat.crawler.name, company: stat.crawler.company }
      : undefined,
  }));

  const topPagesData = initialData.topPages.map((page) => ({
    id: page.id,
    path: page.path ?? "/",
    crawlCount: page.crawlCount,
    lastCrawled: page.lastCrawled,
    trend: page.trend,
  }));

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-2xl font-bold">{currentSite.name ?? currentSite.domain}</h1>
            <p className="text-muted-foreground">AI Crawler Analytics Dashboard</p>
          </div>
          <TrackingStatusBadge
            siteId={currentSite.id}
            onClick={() => setDialogOpen(true)}
          />
        </div>
        <DashboardFilters siteId={currentSite.id} />
      </div>

      {hasTracking ? (
        <>
          <SummaryCards data={initialData.summary} isLoading={isSiteSwitching} />

          <div className="grid gap-6 lg:grid-cols-2">
            <CrawlerChart data={crawlerChartData} isLoading={isSiteSwitching} />
            <TimelineTabs
              siteId={currentSite.id}
              timeFrameLabel={timeFrameLabel}
              initialData={initialData.timeline}
              isLoading={isSiteSwitching}
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <TopPagesTable data={topPagesData} isLoading={isSiteSwitching} />
            <CrawlerHeatmap siteId={currentSite.id} />
          </div>
        </>
      ) : (
        <TrackingEmptyState onSetupClick={() => setDialogOpen(true)} />
      )}

      <TrackingSetupDialog
        siteId={currentSite.id}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />

      {userRole === "admin" && <UnmatchedUserAgents />}
    </div>
  );
}

export function DashboardEmpty() {
  return (
    <div className="p-6">
      <div className="rounded-lg border p-8 text-center">
        <h2 className="text-xl font-semibold mb-2">Welcome to Prop Intel</h2>
        <p className="text-muted-foreground mb-4">
          Add your first site to start tracking AI crawler visits.
        </p>
      </div>
    </div>
  );
}

export function DashboardLoading() {
  return (
    <div className="p-6 space-y-6">
      <SummaryCards data={undefined} isLoading={true} />
    </div>
  );
}
