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
                const data = payload[0]?.payload as { name: string; company: string; visits: number };
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
