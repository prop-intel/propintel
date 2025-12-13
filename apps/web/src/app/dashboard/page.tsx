import { cookies } from "next/headers";
import { api } from "@/trpc/server";
import {
  DashboardContent,
  DashboardEmpty,
} from "@/components/dashboard/dashboard-content";

type TimeFramePreset = "12h" | "24h" | "3d" | "7d" | "30d" | "90d";

const TIME_FRAME_CONFIG: Record<
  TimeFramePreset,
  { hours?: number; days?: number; label: string }
> = {
  "12h": { hours: 12, label: "Last 12 hours" },
  "24h": { hours: 24, label: "Last 24 hours" },
  "3d": { days: 3, label: "Last 3 days" },
  "7d": { days: 7, label: "Last 7 days" },
  "30d": { days: 30, label: "Last 30 days" },
  "90d": { days: 90, label: "Last 90 days" },
};

interface DashboardPageProps {
  searchParams: Promise<{
    tf?: string;
    source?: string;
    companies?: string;
  }>;
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  // Parse filter params from URL
  const params = await searchParams;
  const validTimeFrames: TimeFramePreset[] = ["12h", "24h", "3d", "7d", "30d", "90d"];
  const timeFrame: TimeFramePreset = validTimeFrames.includes(params.tf as TimeFramePreset)
    ? (params.tf as TimeFramePreset)
    : "30d";
  const source = params.source as "pixel" | "middleware" | undefined;
  const companies = params.companies ? params.companies.split(",").filter(Boolean) : undefined;

  const timeFrameConfig = TIME_FRAME_CONFIG[timeFrame];

  // Fetch user's sites
  const sites = await api.site.list();

  if (sites.length === 0) {
    return <DashboardEmpty />;
  }

  // Get active site from cookie or default to first
  const cookieStore = await cookies();
  const cookieSiteId = cookieStore.get("activeSiteId")?.value ?? null;
  const activeSite = cookieSiteId
    ? sites.find((s) => s.id === cookieSiteId) ?? sites[0]
    : sites[0];

  if (!activeSite) {
    return <DashboardEmpty />;
  }

  // Build query params for analytics
  const queryParams = {
    siteId: activeSite.id,
    ...(timeFrameConfig.hours ? { hours: timeFrameConfig.hours } : {}),
    ...(timeFrameConfig.days ? { days: timeFrameConfig.days } : {}),
    ...(source ? { source } : {}),
    ...(companies?.length ? { companies } : {}),
  };

  // Fetch all dashboard data in parallel
  const [summary, crawlerStats, timeline, topPages, trackingStatus] = await Promise.all([
    api.analytics.getSummary(queryParams),
    api.analytics.getCrawlerStats(queryParams),
    api.analytics.getVisitTimeline(queryParams),
    api.analytics.getTopPages({ ...queryParams, limit: 10 }),
    api.tracking.getTrackingStatus({ siteId: activeSite.id }),
  ]);

  return (
    <DashboardContent
      site={activeSite}
      sites={sites}
      initialData={{
        summary,
        crawlerStats,
        timeline,
        topPages,
        trackingStatus,
      }}
      timeFrameLabel={timeFrameConfig.label}
    />
  );
}
