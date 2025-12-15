"use client";

import {
  Area,
  AreaChart,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { companyColors } from "./chart-colors";
import { api } from "@/trpc/react";
import { useDashboardFilters } from "@/hooks/use-dashboard-filters";

interface CompanyStackedChartProps {
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

export function CompanyStackedChart({ siteId }: CompanyStackedChartProps) {
  const { apiParams } = useDashboardFilters();
  const { data, isLoading } = api.analytics.getTimelineByCompany.useQuery({
    siteId,
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
      <AreaChart data={data.data}>
        <XAxis
          dataKey="date"
          tickFormatter={(value: string) => formatXAxisTick(value, data.aggregation)}
          tick={{ fontSize: 12 }}
          interval="preserveStartEnd"
        />
        <YAxis tick={{ fontSize: 12 }} />
        <Tooltip
          content={({ active, payload, label }) => {
            if (!active || !payload?.length) return null;
            return (
              <div className="rounded-lg border bg-popover p-2 shadow-sm">
                <div className="text-sm text-popover-foreground mb-1">
                  {formatTooltipLabel(label as string, data.aggregation)}
                </div>
                {payload.map((entry) => (
                  <div key={entry.name} className="flex items-center gap-2 text-sm">
                    <div
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: entry.color }}
                    />
                    <span className="text-popover-foreground">{entry.name}:</span>
                    <span className="font-medium text-popover-foreground">{entry.value}</span>
                  </div>
                ))}
              </div>
            );
          }}
        />
        <Legend />
        {data.companies.map((company) => (
          <Area
            key={company}
            type="monotone"
            dataKey={company}
            stackId="1"
            stroke={companyColors[company] ?? "#888888"}
            fill={companyColors[company] ?? "#888888"}
            fillOpacity={0.6}
          />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  );
}
