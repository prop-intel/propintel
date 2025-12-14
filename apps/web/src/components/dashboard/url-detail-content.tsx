"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/trpc/react";
import { companyColors } from "./chart-colors";

interface UrlDetailContentProps {
  url: {
    id: string;
    path: string;
    title: string | null;
    firstSeen: Date;
    lastCrawled: Date | null;
    crawlCount: number | null;
    siteId: string;
  };
}

export function UrlDetailContent({ url }: UrlDetailContentProps) {
  const { data: timeline, isLoading: timelineLoading } = api.url.getTimeline.useQuery({
    urlId: url.id,
    days: 30,
  });

  const { data: crawlerBreakdown, isLoading: breakdownLoading } = api.url.getCrawlerBreakdown.useQuery({
    urlId: url.id,
  });

  const { data: recentVisits, isLoading: visitsLoading } = api.url.getRecentVisits.useQuery({
    urlId: url.id,
    limit: 20,
  });

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/dashboard">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold truncate" title={url.path}>
            {url.path}
          </h1>
          <p className="text-muted-foreground text-sm">
            First seen: {new Date(url.firstSeen).toLocaleDateString()}
            {url.lastCrawled && (
              <> &middot; Last crawled: {new Date(url.lastCrawled).toLocaleDateString()}</>
            )}
            {url.crawlCount !== null && (
              <> &middot; Total visits: {url.crawlCount}</>
            )}
          </p>
        </div>
      </div>

      {/* Timeline Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Visit Timeline</CardTitle>
          <CardDescription>Crawler visits over the last 30 days</CardDescription>
        </CardHeader>
        <CardContent>
          {timelineLoading ? (
            <Skeleton className="h-[200px] w-full" />
          ) : !timeline || timeline.length === 0 ? (
            <div className="flex h-[200px] items-center justify-center text-muted-foreground">
              No visit data available
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={timeline}>
                <XAxis
                  dataKey="date"
                  tickFormatter={(value: string) =>
                    new Date(value).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                    })
                  }
                  tick={{ fontSize: 12 }}
                  interval="preserveStartEnd"
                />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip
                  labelFormatter={(value: string) =>
                    new Date(value).toLocaleDateString(undefined, {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                    })
                  }
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
          )}
        </CardContent>
      </Card>

      {/* Two column layout */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Crawler Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle>Crawler Breakdown</CardTitle>
            <CardDescription>Visits by AI crawler</CardDescription>
          </CardHeader>
          <CardContent>
            {breakdownLoading ? (
              <Skeleton className="h-[200px] w-full" />
            ) : !crawlerBreakdown || crawlerBreakdown.length === 0 ? (
              <div className="flex h-[200px] items-center justify-center text-muted-foreground">
                No crawler data available
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart
                  data={crawlerBreakdown
                    .filter((c) => c.crawler)
                    .map((c) => ({
                      name: c.crawler!.name,
                      visits: c.count,
                      company: c.crawler!.company,
                      fill: companyColors[c.crawler!.company] ?? "#888888",
                    }))
                    .sort((a, b) => b.visits - a.visits)}
                  layout="vertical"
                >
                  <XAxis type="number" />
                  <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 12 }} />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const data = payload[0]?.payload as {
                        name: string;
                        company: string;
                        visits: number;
                      };
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
            )}
          </CardContent>
        </Card>

        {/* Recent Visits */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Visits</CardTitle>
            <CardDescription>Latest crawler activity</CardDescription>
          </CardHeader>
          <CardContent>
            {visitsLoading ? (
              <Skeleton className="h-[200px] w-full" />
            ) : !recentVisits || recentVisits.length === 0 ? (
              <div className="flex h-[200px] items-center justify-center text-muted-foreground">
                No recent visits
              </div>
            ) : (
              <div className="max-h-[250px] overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Time</TableHead>
                      <TableHead>Crawler</TableHead>
                      <TableHead>Source</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recentVisits.map((visit) => (
                      <TableRow key={visit.id}>
                        <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                          {new Date(visit.visitedAt).toLocaleString(undefined, {
                            month: "short",
                            day: "numeric",
                            hour: "numeric",
                            minute: "2-digit",
                          })}
                        </TableCell>
                        <TableCell>
                          {visit.crawlerName ? (
                            <div className="flex items-center gap-2">
                              <div
                                className="w-2 h-2 rounded-full shrink-0"
                                style={{
                                  backgroundColor:
                                    companyColors[visit.crawlerCompany ?? ""] ?? "#888888",
                                }}
                              />
                              <span className="text-sm">{visit.crawlerName}</span>
                            </div>
                          ) : (
                            <span className="text-sm text-muted-foreground">Unknown</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {visit.source}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
