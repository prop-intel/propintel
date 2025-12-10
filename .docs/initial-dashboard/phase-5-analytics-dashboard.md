# Phase 5: Analytics Dashboard

## Overview

Build the main dashboard page showing AI crawler analytics with charts and metrics.

## Dependencies

- Phase 1 (database schema)
- Phase 2 (site context)
- Phase 6 (tracking script - for data to display)

## Files to Create

### `src/server/api/routers/analytics.ts`

tRPC router for analytics data.

```typescript
import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { crawlerVisits, siteUrls, sites, crawlers } from "@/server/db/schema";
import { eq, and, gte, desc, count, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

export const analyticsRouter = createTRPCRouter({
  // Get summary metrics
  getSummary: protectedProcedure
    .input(z.object({ siteId: z.string() }))
    .query(async ({ ctx, input }) => {
      // Verify ownership
      const site = await ctx.db.query.sites.findFirst({
        where: and(
          eq(sites.id, input.siteId),
          eq(sites.userId, ctx.session.user.id)
        ),
      });
      if (!site) throw new TRPCError({ code: "NOT_FOUND" });

      const [totalVisits] = await ctx.db
        .select({ count: count() })
        .from(crawlerVisits)
        .where(eq(crawlerVisits.siteId, input.siteId));

      const [totalUrls] = await ctx.db
        .select({ count: count() })
        .from(siteUrls)
        .where(eq(siteUrls.siteId, input.siteId));

      const uniqueCrawlers = await ctx.db
        .selectDistinct({ crawlerId: crawlerVisits.crawlerId })
        .from(crawlerVisits)
        .where(eq(crawlerVisits.siteId, input.siteId));

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const [visitsToday] = await ctx.db
        .select({ count: count() })
        .from(crawlerVisits)
        .where(and(
          eq(crawlerVisits.siteId, input.siteId),
          gte(crawlerVisits.visitedAt, today)
        ));

      return {
        totalVisits: totalVisits?.count ?? 0,
        totalUrls: totalUrls?.count ?? 0,
        uniqueCrawlers: uniqueCrawlers.length,
        visitsToday: visitsToday?.count ?? 0,
      };
    }),

  // Get visits by crawler
  getCrawlerStats: protectedProcedure
    .input(z.object({
      siteId: z.string(),
      days: z.number().min(1).max(90).default(30),
    }))
    .query(async ({ ctx, input }) => {
      const site = await ctx.db.query.sites.findFirst({
        where: and(
          eq(sites.id, input.siteId),
          eq(sites.userId, ctx.session.user.id)
        ),
      });
      if (!site) throw new TRPCError({ code: "NOT_FOUND" });

      const startDate = new Date();
      startDate.setDate(startDate.getDate() - input.days);

      const stats = await ctx.db
        .select({
          crawlerId: crawlerVisits.crawlerId,
          count: count(),
        })
        .from(crawlerVisits)
        .where(and(
          eq(crawlerVisits.siteId, input.siteId),
          gte(crawlerVisits.visitedAt, startDate)
        ))
        .groupBy(crawlerVisits.crawlerId);

      // Join with crawler info
      const allCrawlers = await ctx.db.query.crawlers.findMany();
      const crawlerMap = new Map(allCrawlers.map(c => [c.id, c]));

      return stats.map(s => ({
        ...s,
        crawler: crawlerMap.get(s.crawlerId ?? ""),
      }));
    }),

  // Get visit timeline
  getVisitTimeline: protectedProcedure
    .input(z.object({
      siteId: z.string(),
      days: z.number().min(1).max(90).default(30),
    }))
    .query(async ({ ctx, input }) => {
      const site = await ctx.db.query.sites.findFirst({
        where: and(
          eq(sites.id, input.siteId),
          eq(sites.userId, ctx.session.user.id)
        ),
      });
      if (!site) throw new TRPCError({ code: "NOT_FOUND" });

      const startDate = new Date();
      startDate.setDate(startDate.getDate() - input.days);

      const timeline = await ctx.db
        .select({
          date: sql<string>`DATE(${crawlerVisits.visitedAt})`,
          count: count(),
        })
        .from(crawlerVisits)
        .where(and(
          eq(crawlerVisits.siteId, input.siteId),
          gte(crawlerVisits.visitedAt, startDate)
        ))
        .groupBy(sql`DATE(${crawlerVisits.visitedAt})`)
        .orderBy(sql`DATE(${crawlerVisits.visitedAt})`);

      return timeline;
    }),

  // Get top pages
  getTopPages: protectedProcedure
    .input(z.object({
      siteId: z.string(),
      limit: z.number().min(1).max(20).default(10),
    }))
    .query(async ({ ctx, input }) => {
      const site = await ctx.db.query.sites.findFirst({
        where: and(
          eq(sites.id, input.siteId),
          eq(sites.userId, ctx.session.user.id)
        ),
      });
      if (!site) throw new TRPCError({ code: "NOT_FOUND" });

      return ctx.db.query.siteUrls.findMany({
        where: eq(siteUrls.siteId, input.siteId),
        orderBy: [desc(siteUrls.crawlCount)],
        limit: input.limit,
      });
    }),

  // Get recent visits
  getRecentVisits: protectedProcedure
    .input(z.object({
      siteId: z.string(),
      limit: z.number().min(1).max(50).default(20),
    }))
    .query(async ({ ctx, input }) => {
      const site = await ctx.db.query.sites.findFirst({
        where: and(
          eq(sites.id, input.siteId),
          eq(sites.userId, ctx.session.user.id)
        ),
      });
      if (!site) throw new TRPCError({ code: "NOT_FOUND" });

      return ctx.db.query.crawlerVisits.findMany({
        where: eq(crawlerVisits.siteId, input.siteId),
        orderBy: [desc(crawlerVisits.visitedAt)],
        limit: input.limit,
        with: {
          crawler: true,
        },
      });
    }),
});
```

### `src/components/dashboard/summary-cards.tsx`

Grid of metric cards.

```typescript
"use client";

import { Activity, Bot, FileText, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

interface SummaryCardsProps {
  data: {
    totalVisits: number;
    totalUrls: number;
    uniqueCrawlers: number;
    visitsToday: number;
  } | undefined;
  isLoading: boolean;
}

export function SummaryCards({ data, isLoading }: SummaryCardsProps) {
  const cards = [
    {
      title: "Total Crawler Visits",
      value: data?.totalVisits ?? 0,
      icon: Activity,
      description: "All time",
    },
    {
      title: "Unique Crawlers",
      value: data?.uniqueCrawlers ?? 0,
      icon: Bot,
      description: "Detected AI bots",
    },
    {
      title: "Pages Tracked",
      value: data?.totalUrls ?? 0,
      icon: FileText,
      description: "URLs discovered",
    },
    {
      title: "Visits Today",
      value: data?.visitsToday ?? 0,
      icon: TrendingUp,
      description: "Last 24 hours",
    },
  ];

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {cards.map((_, i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-4" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-16" />
              <Skeleton className="h-3 w-20 mt-1" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => (
        <Card key={card.title}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
            <card.icon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{card.value.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">{card.description}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
```

### `src/components/dashboard/crawler-chart.tsx`

Bar chart showing visits by crawler.

```typescript
"use client";

import { Bar, BarChart, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

// Company colors
const companyColors: Record<string, string> = {
  OpenAI: "#10a37f",
  Anthropic: "#d4a27f",
  Perplexity: "#20b8cd",
  Google: "#4285f4",
  Microsoft: "#00a4ef",
  ByteDance: "#000000",
  Cohere: "#39594d",
  Meta: "#0668e1",
  Apple: "#555555",
};

interface CrawlerChartProps {
  data: Array<{
    crawlerId: string | null;
    count: number;
    crawler?: {
      name: string;
      company: string;
    };
  }> | undefined;
  isLoading: boolean;
}

export function CrawlerChart({ data, isLoading }: CrawlerChartProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Crawler Distribution</CardTitle>
          <CardDescription>Visits by AI crawler</CardDescription>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[300px] w-full" />
        </CardContent>
      </Card>
    );
  }

  const chartData = (data ?? [])
    .filter(d => d.crawler)
    .map(d => ({
      name: d.crawler!.name,
      visits: d.count,
      company: d.crawler!.company,
      fill: companyColors[d.crawler!.company] ?? "#888888",
    }))
    .sort((a, b) => b.visits - a.visits);

  if (chartData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Crawler Distribution</CardTitle>
          <CardDescription>Visits by AI crawler</CardDescription>
        </CardHeader>
        <CardContent className="flex h-[300px] items-center justify-center text-muted-foreground">
          No crawler visits recorded yet
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Crawler Distribution</CardTitle>
        <CardDescription>Visits by AI crawler (last 30 days)</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData} layout="vertical">
            <XAxis type="number" />
            <YAxis type="category" dataKey="name" width={120} />
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const data = payload[0]?.payload;
                return (
                  <div className="rounded-lg border bg-background p-2 shadow-sm">
                    <div className="font-medium">{data.name}</div>
                    <div className="text-sm text-muted-foreground">{data.company}</div>
                    <div className="text-sm font-bold">{data.visits} visits</div>
                  </div>
                );
              }}
            />
            <Bar dataKey="visits" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
```

### `src/components/dashboard/timeline-chart.tsx`

Area chart showing visits over time.

```typescript
"use client";

import { Area, AreaChart, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

interface TimelineChartProps {
  data: Array<{ date: string; count: number }> | undefined;
  isLoading: boolean;
}

export function TimelineChart({ data, isLoading }: TimelineChartProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Visit Timeline</CardTitle>
          <CardDescription>Crawler visits over time</CardDescription>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[300px] w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!data || data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Visit Timeline</CardTitle>
          <CardDescription>Crawler visits over time</CardDescription>
        </CardHeader>
        <CardContent className="flex h-[300px] items-center justify-center text-muted-foreground">
          No visit data yet
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Visit Timeline</CardTitle>
        <CardDescription>Crawler visits over time (last 30 days)</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={data}>
            <XAxis
              dataKey="date"
              tickFormatter={(value) => new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
            />
            <YAxis />
            <Tooltip
              labelFormatter={(value) => new Date(value).toLocaleDateString()}
              formatter={(value: number) => [value, "Visits"]}
            />
            <Area
              type="monotone"
              dataKey="count"
              stroke="hsl(var(--primary))"
              fill="hsl(var(--primary) / 0.2)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
```

### `src/components/dashboard/top-pages-table.tsx`

Table of most visited URLs.

```typescript
"use client";

import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";

interface TopPagesTableProps {
  data: Array<{
    id: string;
    path: string;
    crawlCount: number | null;
    lastCrawled: Date | null;
  }> | undefined;
  isLoading: boolean;
}

export function TopPagesTable({ data, isLoading }: TopPagesTableProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Top Pages</CardTitle>
          <CardDescription>Most crawled URLs</CardDescription>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[200px] w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!data || data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Top Pages</CardTitle>
          <CardDescription>Most crawled URLs</CardDescription>
        </CardHeader>
        <CardContent className="text-center text-muted-foreground py-8">
          No pages tracked yet
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Top Pages</CardTitle>
        <CardDescription>Most crawled URLs</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Path</TableHead>
              <TableHead className="text-right">Visits</TableHead>
              <TableHead className="text-right">Last Crawled</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((url) => (
              <TableRow key={url.id}>
                <TableCell>
                  <Link
                    href={`/dashboard/url/${url.id}`}
                    className="text-primary hover:underline truncate block max-w-[300px]"
                    title={url.path}
                  >
                    {url.path}
                  </Link>
                </TableCell>
                <TableCell className="text-right">{url.crawlCount ?? 0}</TableCell>
                <TableCell className="text-right">
                  {url.lastCrawled?.toLocaleDateString() ?? "-"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
```

### `src/app/dashboard/page.tsx` (Complete Rewrite)

Main analytics dashboard.

```typescript
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
```

## Files to Modify

### `src/server/api/root.ts`

Add analyticsRouter:

```typescript
import { analyticsRouter } from "./routers/analytics";

export const appRouter = createTRPCRouter({
  post: postRouter,
  site: siteRouter,
  url: urlRouter,
  analytics: analyticsRouter,  // Add this
});
```

## Acceptance Criteria

- [ ] Dashboard shows summary metrics for selected site
- [ ] Summary cards display: Total visits, Unique crawlers, Pages tracked, Visits today
- [ ] Crawler distribution bar chart displays correctly
- [ ] Timeline area chart shows visit trends
- [ ] Top pages table links to URL details
- [ ] Empty state for sites with no data
- [ ] Loading skeletons during data fetch
- [ ] Responsive layout for mobile
- [ ] Charts use company-branded colors
