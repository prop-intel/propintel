"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/trpc/react";
import { useDashboardFilters } from "@/hooks/use-dashboard-filters";
import { companyColors } from "./chart-colors";

interface CrawlerHeatmapProps {
  siteId: string;
}

function truncatePath(path: string, maxLength = 30): string {
  if (path.length <= maxLength) return path;
  return path.slice(0, maxLength - 3) + "...";
}

export function CrawlerHeatmap({ siteId }: CrawlerHeatmapProps) {
  const { apiParams } = useDashboardFilters();
  const { data, isLoading } = api.analytics.getCrawlerPageMatrix.useQuery({
    siteId,
    pageLimit: 8,
    crawlerLimit: 6,
    ...apiParams,
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Crawler Activity</CardTitle>
          <CardDescription>Which crawlers visit which pages</CardDescription>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[300px] w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!data || data.pages.length === 0 || data.crawlers.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Crawler Activity</CardTitle>
          <CardDescription>Which crawlers visit which pages</CardDescription>
        </CardHeader>
        <CardContent className="flex h-[200px] items-center justify-center text-muted-foreground">
          Not enough data to display
        </CardContent>
      </Card>
    );
  }

  // Find the max value for color scaling
  const maxValue = Math.max(...data.matrix.flat(), 1);

  // Get color intensity based on value
  const getColorStyle = (value: number) => {
    if (value === 0) return {};
    const intensity = Math.min(value / maxValue, 1);
    return {
      backgroundColor: `hsl(var(--primary) / ${0.1 + intensity * 0.5})`,
    };
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Crawler Activity</CardTitle>
        <CardDescription>Which crawlers visit which pages most frequently</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="text-left py-2 pr-4 font-medium text-muted-foreground">
                  Page
                </th>
                {data.crawlers.map((crawler) => (
                  <th
                    key={crawler.id}
                    className="px-2 py-2 text-center min-w-[70px]"
                  >
                    <div className="flex flex-col items-center gap-0.5">
                      <div
                        className="w-2 h-2 rounded-full"
                        style={{
                          backgroundColor:
                            companyColors[crawler.company] ?? "#888888",
                        }}
                      />
                      <span className="text-xs font-medium truncate max-w-[60px]" title={crawler.name}>
                        {crawler.name.split(/[-_]/)[0]}
                      </span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.pages.map((page, pageIdx) => (
                <tr key={page} className="border-t border-border/50">
                  <td
                    className="py-2 pr-4 font-mono text-xs truncate max-w-[200px]"
                    title={page}
                  >
                    {truncatePath(page)}
                  </td>
                  {(data.matrix[pageIdx] ?? []).map((count, crawlerIdx) => (
                    <td
                      key={crawlerIdx}
                      className="px-2 py-2 text-center rounded transition-colors"
                      style={getColorStyle(count)}
                    >
                      <span className={count > 0 ? "font-medium" : "text-muted-foreground"}>
                        {count > 0 ? count : "-"}
                      </span>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
