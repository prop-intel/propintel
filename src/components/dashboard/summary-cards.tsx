"use client";

import { Activity, Bot, FileText, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

interface SummaryCardsProps {
  data: {
    totalVisits: number;
    totalUrls: number;
    uniqueCrawlers: number;
    visitsToday: number;
  } | undefined;
  isLoading: boolean;
}

export function SummaryCards({ data, isLoading }: SummaryCardsProps) {
  const cards = [
    {
      title: "Total Crawler Visits",
      value: data?.totalVisits ?? 0,
      icon: Activity,
      description: "All time",
    },
    {
      title: "Unique Crawlers",
      value: data?.uniqueCrawlers ?? 0,
      icon: Bot,
      description: "Detected AI bots",
    },
    {
      title: "Pages Tracked",
      value: data?.totalUrls ?? 0,
      icon: FileText,
      description: "URLs discovered",
    },
    {
      title: "Visits Today",
      value: data?.visitsToday ?? 0,
      icon: TrendingUp,
      description: "Last 24 hours",
    },
  ];

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {cards.map((_, i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-4" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-16" />
              <Skeleton className="h-3 w-20 mt-1" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => (
        <Card key={card.title}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
            <card.icon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{card.value.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">{card.description}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
