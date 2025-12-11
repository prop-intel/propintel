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
              tickFormatter={(value: string) => new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
            />
            <YAxis />
            <Tooltip
              labelFormatter={(value: string) => new Date(value).toLocaleDateString()}
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
