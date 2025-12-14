"use client";

import {
  Line,
  LineChart,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { urlColors } from "./chart-colors";
import { api } from "@/trpc/react";
import { useDashboardFilters } from "@/hooks/use-dashboard-filters";

interface UrlMultiLineChartProps {
  siteId: string;
}

function formatXAxisTick(value: string, aggregation: "hourly" | "daily"): string {
  const date = new Date(value);
  if (aggregation === "hourly") {
    return date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  }
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function formatTooltipLabel(value: string, aggregation: "hourly" | "daily"): string {
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

function truncatePath(path: string, maxLength = 30): string {
  if (path.length <= maxLength) return path;
  return path.slice(0, maxLength - 3) + "...";
}

export function UrlMultiLineChart({ siteId }: UrlMultiLineChartProps) {
  const { apiParams } = useDashboardFilters();
  const { data, isLoading } = api.analytics.getTimelineByUrl.useQuery({
    siteId,
    urlLimit: 5,
    ...apiParams,
  });

  if (isLoading) {
    return <Skeleton className="h-[300px] w-full" />;
  }

  if (!data || data.data.length === 0) {
    return (
      <div className="flex h-[300px] items-center justify-center text-muted-foreground">
        No data available
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data.data}>
        <XAxis
          dataKey="date"
          tickFormatter={(value: string) => formatXAxisTick(value, data.aggregation)}
          tick={{ fontSize: 12 }}
          interval="preserveStartEnd"
        />
        <YAxis tick={{ fontSize: 12 }} />
        <Tooltip
          labelFormatter={(value: string) => formatTooltipLabel(value, data.aggregation)}
          contentStyle={{
            backgroundColor: "hsl(var(--background))",
            border: "1px solid hsl(var(--border))",
            borderRadius: "8px",
          }}
          formatter={(value: number, name: string) => [value, truncatePath(name)]}
        />
        <Legend
          formatter={(value: string) => truncatePath(value, 25)}
          wrapperStyle={{ fontSize: "12px" }}
        />
        {data.urls.map((url, index) => (
          <Line
            key={url}
            type="monotone"
            dataKey={url}
            stroke={urlColors[index % urlColors.length]}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
