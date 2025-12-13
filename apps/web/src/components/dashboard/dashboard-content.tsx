"use client";

import { useState } from "react";
import { SummaryCards } from "@/components/dashboard/summary-cards";
import { CrawlerChart } from "@/components/dashboard/crawler-chart";
import { TimelineChart } from "@/components/dashboard/timeline-chart";
import { TopPagesTable } from "@/components/dashboard/top-pages-table";
import { DashboardFilters } from "@/components/dashboard/dashboard-filters";
import {
  TrackingStatusBadge,
  TrackingSetupDialog,
  TrackingEmptyState,
} from "@/components/dashboard/tracking-status";

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
      siteId: string;
      path: string | null;
      title: string | null;
      firstSeen: Date;
      lastCrawled: Date | null;
      crawlCount: number | null;
    }>;
    trackingStatus: {
      hasPixel: boolean;
      hasMiddleware: boolean;
      pixelCount: number;
      middlewareCount: number;
    };
  };
  timeFrameLabel: string;
}

export function DashboardContent({
  site,
  initialData,
  timeFrameLabel,
}: DashboardContentProps) {
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
  }));

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-2xl font-bold">{site.name ?? site.domain}</h1>
            <p className="text-muted-foreground">AI Crawler Analytics Dashboard</p>
          </div>
          <TrackingStatusBadge
            siteId={site.id}
            onClick={() => setDialogOpen(true)}
          />
        </div>
        <DashboardFilters siteId={site.id} />
      </div>

      {hasTracking ? (
        <>
          <SummaryCards data={initialData.summary} isLoading={false} />

          <div className="grid gap-6 md:grid-cols-2">
            <CrawlerChart data={crawlerChartData} isLoading={false} />
            <TimelineChart
              data={initialData.timeline}
              isLoading={false}
              timeFrameLabel={timeFrameLabel}
            />
          </div>

          <TopPagesTable data={topPagesData} isLoading={false} />
        </>
      ) : (
        <TrackingEmptyState onSetupClick={() => setDialogOpen(true)} />
      )}

      <TrackingSetupDialog
        siteId={site.id}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
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
