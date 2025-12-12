"use client";

import { Area, AreaChart, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

interface TimelineChartProps {
  data:
    | {
        data: Array<{ date: string; count: number }>;
        aggregation: "hourly" | "daily";
      }
    | undefined;
  isLoading: boolean;
  timeFrameLabel?: string;
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

export function TimelineChart({ data, isLoading, timeFrameLabel }: TimelineChartProps) {
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

  if (!data || data.data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Visit Timeline</CardTitle>
          <CardDescription>
            {timeFrameLabel ? `Crawler visits (${timeFrameLabel.toLowerCase()})` : "Crawler visits over time"}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex h-[300px] items-center justify-center text-muted-foreground">
          No visit data yet
        </CardContent>
      </Card>
    );
  }

  const { data: chartData, aggregation } = data;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Visit Timeline</CardTitle>
        <CardDescription>
          {timeFrameLabel
            ? `Crawler visits (${timeFrameLabel.toLowerCase()})`
            : `Crawler visits over time`}
          {aggregation === "hourly" && " — hourly"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={chartData}>
            <XAxis
              dataKey="date"
              tickFormatter={(value: string) => formatXAxisTick(value, aggregation)}
              tick={{ fontSize: 12 }}
              interval="preserveStartEnd"
            />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip
              labelFormatter={(value: string) => formatTooltipLabel(value, aggregation)}
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
