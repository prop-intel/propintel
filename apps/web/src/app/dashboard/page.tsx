"use client";

import { useSite } from "@/contexts/site-context";
import { api } from "@/trpc/react";
import { SummaryCards } from "@/components/dashboard/summary-cards";
import { CrawlerChart } from "@/components/dashboard/crawler-chart";
import { TimelineChart } from "@/components/dashboard/timeline-chart";
import { TopPagesTable } from "@/components/dashboard/top-pages-table";

export default function DashboardPage() {
  const { activeSite, isLoading: siteLoading } = useSite();

  const { data: summary, isLoading: summaryLoading } = api.analytics.getSummary.useQuery(
    { siteId: activeSite?.id ?? "" },
    { enabled: !!activeSite?.id }
  );

  const { data: crawlerStats, isLoading: crawlerLoading } = api.analytics.getCrawlerStats.useQuery(
    { siteId: activeSite?.id ?? "", days: 30 },
    { enabled: !!activeSite?.id }
  );

  const { data: timeline, isLoading: timelineLoading } = api.analytics.getVisitTimeline.useQuery(
    { siteId: activeSite?.id ?? "", days: 30 },
    { enabled: !!activeSite?.id }
  );

  const { data: topPages, isLoading: topPagesLoading } = api.analytics.getTopPages.useQuery(
    { siteId: activeSite?.id ?? "", limit: 10 },
    { enabled: !!activeSite?.id }
  );

  if (siteLoading) {
    return (
      <div className="p-6 space-y-6">
        <SummaryCards data={undefined} isLoading={true} />
      </div>
    );
  }

  if (!activeSite) {
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

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{activeSite.name ?? activeSite.domain}</h1>
        <p className="text-muted-foreground">AI Crawler Analytics Dashboard</p>
      </div>

      <SummaryCards data={summary} isLoading={summaryLoading} />

      <div className="grid gap-6 md:grid-cols-2">
        <CrawlerChart data={crawlerStats} isLoading={crawlerLoading} />
        <TimelineChart data={timeline} isLoading={timelineLoading} />
      </div>

      <TopPagesTable data={topPages} isLoading={topPagesLoading} />
    </div>
  );
}
