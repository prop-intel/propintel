"use client";

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
import { useDashboardFilters } from "@/hooks/use-dashboard-filters";
import { companyColors } from "./chart-colors";

interface ActivityFeedProps {
  siteId: string;
}

function formatTimestamp(date: Date): string {
  return new Date(date).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function truncatePath(path: string, maxLength = 40): string {
  if (path.length <= maxLength) return path;
  return path.slice(0, maxLength - 3) + "...";
}

export function ActivityFeed({ siteId }: ActivityFeedProps) {
  const { apiParams } = useDashboardFilters();
  const { data, isLoading } = api.analytics.getActivityFeed.useQuery({
    siteId,
    limit: 50,
    ...apiParams,
  });

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 10 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="flex h-[300px] items-center justify-center text-muted-foreground">
        No activity in this time period
      </div>
    );
  }

  return (
    <div className="max-h-[400px] overflow-y-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[140px]">Time</TableHead>
            <TableHead>Path</TableHead>
            <TableHead>Crawler</TableHead>
            <TableHead className="w-[100px]">Source</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((visit) => (
            <TableRow key={visit.id}>
              <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                {formatTimestamp(visit.visitedAt)}
              </TableCell>
              <TableCell
                className="font-mono text-sm truncate max-w-[200px]"
                title={visit.path}
              >
                {truncatePath(visit.path)}
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
  );
}
