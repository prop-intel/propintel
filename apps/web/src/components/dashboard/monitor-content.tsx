"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { TrackedUrlsTab } from "@/components/dashboard/tracked-urls-tab";
import type { UserRole } from "@/server/auth/config";

type Site = {
  id: string;
  domain: string;
  name: string | null;
  trackingId: string;
};

interface MonitorContentProps {
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
  initialTab?: string;
}

export function MonitorContent({
  site,
  initialData,
  timeFrameLabel,
  userRole,
  initialTab = "overview",
}: MonitorContentProps) {
  const [dialogOpen, setDialogOpen] = useState(false);

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
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-2xl font-bold">Monitor</h1>
            <p className="text-muted-foreground">
              Track AI crawler activity on {site.name ?? site.domain}
            </p>
          </div>
          <TrackingStatusBadge
            siteId={site.id}
            onClick={() => setDialogOpen(true)}
          />
        </div>
        <DashboardFilters siteId={site.id} />
      </div>

      {/* Tabs */}
      <Tabs defaultValue={initialTab} className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="crawlers">Crawlers & Traffic</TabsTrigger>
          <TabsTrigger value="urls">Tracked URLs</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          {hasTracking ? (
            <>
              <SummaryCards data={initialData.summary} isLoading={false} />

              <div className="grid gap-6 lg:grid-cols-2">
                <CrawlerChart data={crawlerChartData} isLoading={false} />
                <TimelineTabs
                  siteId={site.id}
                  timeFrameLabel={timeFrameLabel}
                  initialData={initialData.timeline}
                />
              </div>

              <TopPagesTable data={topPagesData} isLoading={false} />
            </>
          ) : (
            <TrackingEmptyState onSetupClick={() => setDialogOpen(true)} />
          )}
        </TabsContent>

        {/* Crawlers & Traffic Tab */}
        <TabsContent value="crawlers" className="space-y-6">
          {hasTracking ? (
            <>
              <SummaryCards data={initialData.summary} isLoading={false} />
              
              <div className="grid gap-6 lg:grid-cols-2">
                <CrawlerChart data={crawlerChartData} isLoading={false} />
                <CrawlerHeatmap siteId={site.id} />
              </div>

              {userRole === "admin" && <UnmatchedUserAgents />}
            </>
          ) : (
            <TrackingEmptyState onSetupClick={() => setDialogOpen(true)} />
          )}
        </TabsContent>

        {/* Tracked URLs Tab */}
        <TabsContent value="urls" className="space-y-6">
          {hasTracking ? (
            <TrackedUrlsTab siteId={site.id} topPages={topPagesData} />
          ) : (
            <TrackingEmptyState onSetupClick={() => setDialogOpen(true)} />
          )}
        </TabsContent>
      </Tabs>

      <TrackingSetupDialog
        siteId={site.id}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
    </div>
  );
}

export function MonitorEmpty() {
  return (
    <div className="p-6">
      <div className="rounded-lg border p-8 text-center">
        <h2 className="text-xl font-semibold mb-2">Welcome to Brandsight</h2>
        <p className="text-muted-foreground mb-4">
          Add your first site to start tracking AI crawler visits.
        </p>
      </div>
    </div>
  );
}

export function MonitorLoading() {
  return (
    <div className="p-6 space-y-6">
      <SummaryCards data={undefined} isLoading={true} />
    </div>
  );
}

