"use client";

import Link from "next/link";
import { api } from "@/trpc/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  FileText, 
  ExternalLink, 
  TrendingUp, 
  TrendingDown,
  Minus,
  Clock
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface TopPage {
  id: string;
  path: string;
  crawlCount: number;
  lastCrawled: Date | null;
  trend: number[];
}

interface TrackedUrlsTabProps {
  siteId: string;
  topPages: TopPage[];
}

function getTrendIndicator(trend: number[]) {
  if (trend.length < 2) return { icon: Minus, color: "text-muted-foreground", label: "No trend" };
  
  const recent = trend.slice(-3).reduce((a, b) => a + b, 0);
  const previous = trend.slice(-6, -3).reduce((a, b) => a + b, 0);
  
  if (recent > previous * 1.1) {
    return { icon: TrendingUp, color: "text-emerald-500", label: "Increasing" };
  } else if (recent < previous * 0.9) {
    return { icon: TrendingDown, color: "text-red-500", label: "Decreasing" };
  }
  return { icon: Minus, color: "text-muted-foreground", label: "Stable" };
}

export function TrackedUrlsTab({ siteId, topPages }: TrackedUrlsTabProps) {
  const { data: urls = [], isLoading } = api.url.listBySite.useQuery(
    { siteId },
    { enabled: !!siteId }
  );

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
    );
  }

  if (urls.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-semibold mb-2">No URLs Tracked Yet</h3>
          <p className="text-muted-foreground max-w-md mx-auto">
            URLs will appear here once AI crawlers start visiting your site.
            Make sure tracking is set up correctly.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Merge URL data with top pages data for richer info
  const enrichedUrls = urls.map((url) => {
    const pageData = topPages.find((p) => p.id === url.id);
    return {
      ...url,
      trend: pageData?.trend ?? [],
      lastCrawled: pageData?.lastCrawled ?? null,
    };
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">All Tracked URLs</CardTitle>
            <Badge variant="outline" className="font-mono">
              {urls.length} URLs
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="divide-y">
            {enrichedUrls.map((url) => {
              const trendInfo = getTrendIndicator(url.trend);
              const TrendIcon = trendInfo.icon;

              return (
                <div
                  key={url.id}
                  className="flex items-center justify-between py-4 first:pt-0 last:pb-0"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <FileText className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/dashboard/url/${url.id}`}
                        className="text-sm font-medium hover:text-primary hover:underline truncate block"
                        title={url.path}
                      >
                        {url.path}
                      </Link>
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                        {url.lastCrawled && (
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatDistanceToNow(new Date(url.lastCrawled), { addSuffix: true })}
                          </span>
                        )}
                        <span className={`flex items-center gap-1 ${trendInfo.color}`}>
                          <TrendIcon className="h-3 w-3" />
                          {trendInfo.label}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 flex-shrink-0">
                    <div className="text-right">
                      <div className="text-sm font-semibold">{url.crawlCount ?? 0}</div>
                      <div className="text-xs text-muted-foreground">visits</div>
                    </div>
                    <Link
                      href={`/dashboard/url/${url.id}`}
                      className="p-2 hover:bg-muted rounded-md transition-colors"
                    >
                      <ExternalLink className="h-4 w-4 text-muted-foreground" />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

