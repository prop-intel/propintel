"use client";

import {
  Area,
  AreaChart,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
} from "recharts";
import { BarChart3, Building2, FileText, Activity } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { CompanyStackedChart } from "./company-stacked-chart";
import { UrlMultiLineChart } from "./url-multiline-chart";
import { ActivityFeed } from "./activity-feed";
import { Skeleton } from "@/components/ui/skeleton";

interface TimelineTabsProps {
  siteId: string;
  timeFrameLabel: string;
  initialData: {
    data: Array<{ date: string; count: number }>;
    aggregation: "hourly" | "daily";
  };
  isLoading?: boolean;
}

function formatXAxisTick(
  value: string,
  aggregation: "hourly" | "daily",
): string {
  const date = new Date(value);
  if (aggregation === "hourly") {
    return date.toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
    });
  }
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function formatTooltipLabel(
  value: string,
  aggregation: "hourly" | "daily",
): string {
  const date = new Date(value);
  if (aggregation === "hourly") {
    return date.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }
  return date.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

const tabItems = [
  { value: "overview", icon: BarChart3, label: "Overview" },
  { value: "by-company", icon: Building2, label: "By Company" },
  { value: "by-url", icon: FileText, label: "By URL" },
  { value: "activity", icon: Activity, label: "Activity" },
];

export function TimelineTabs({
  siteId,
  timeFrameLabel,
  initialData,
  isLoading = false,
}: TimelineTabsProps) {
  return (
    <Card>
      <Tabs defaultValue="overview" className="w-full">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Visit Timeline</CardTitle>
              <CardDescription>
                Crawler visits ({timeFrameLabel.toLowerCase()})
              </CardDescription>
            </div>
            <TooltipProvider delayDuration={0}>
              <TabsList className="h-8">
                {tabItems.map(({ value, icon: Icon, label }) => (
                  <Tooltip key={value}>
                    <TooltipTrigger asChild>
                      <TabsTrigger value={value} className="h-7 px-2">
                        <Icon className="h-4 w-4" />
                      </TabsTrigger>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">
                      <p>{label}</p>
                    </TooltipContent>
                  </Tooltip>
                ))}
              </TabsList>
            </TooltipProvider>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <TabsContent value="overview" className="mt-0">
            {isLoading ? (
              <Skeleton className="h-[300px] w-full" />
            ) : (
              <TimelineChartInner data={initialData} />
            )}
          </TabsContent>
          <TabsContent value="by-company" className="mt-0">
            <CompanyStackedChart siteId={siteId} />
          </TabsContent>
          <TabsContent value="by-url" className="mt-0">
            <UrlMultiLineChart siteId={siteId} />
          </TabsContent>
          <TabsContent value="activity" className="mt-0">
            <ActivityFeed siteId={siteId} />
          </TabsContent>
        </CardContent>
      </Tabs>
    </Card>
  );
}

// Inner component to render just the chart without the card wrapper
function TimelineChartInner({
  data,
}: {
  data: {
    data: Array<{ date: string; count: number }>;
    aggregation: "hourly" | "daily";
  };
}) {
  if (!data || data.data.length === 0) {
    return (
      <div className="text-muted-foreground flex h-[300px] items-center justify-center">
        No visit data yet
      </div>
    );
  }

  const { data: chartData, aggregation } = data;

  return (
    <ResponsiveContainer width="100%" height={300}>
      <AreaChart data={chartData}>
        <XAxis
          dataKey="date"
          tickFormatter={(value: string) => formatXAxisTick(value, aggregation)}
          tick={{ fontSize: 12 }}
          interval="preserveStartEnd"
        />
        <YAxis tick={{ fontSize: 12 }} />
        <RechartsTooltip
          content={({ active, payload, label }) => {
            if (!active || !payload?.length) return null;
            return (
              <div className="rounded-lg border bg-popover p-2 shadow-sm">
                <div className="text-sm text-popover-foreground">
                  {formatTooltipLabel(label as string, aggregation)}
                </div>
                <div className="text-sm font-medium text-popover-foreground">
                  {payload[0]?.value} Visits
                </div>
              </div>
            );
          }}
        />
        <Area
          type="monotone"
          dataKey="count"
          stroke="hsl(var(--primary))"
          fill="hsl(var(--primary) / 0.2)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
