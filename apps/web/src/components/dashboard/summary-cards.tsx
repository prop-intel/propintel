"use client";

import { Activity, Bot, FileText, TrendingUp } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";

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
  const stats = [
    {
      title: "Total Visits",
      value: data?.totalVisits ?? 0,
      icon: Activity,
    },
    {
      title: "Crawlers",
      value: data?.uniqueCrawlers ?? 0,
      icon: Bot,
    },
    {
      title: "Pages",
      value: data?.totalUrls ?? 0,
      icon: FileText,
    },
    {
      title: "Today",
      value: data?.visitsToday ?? 0,
      icon: TrendingUp,
    },
  ];

  if (isLoading) {
    return (
      <Card className="p-4">
        <div className="flex items-center gap-6 overflow-x-auto">
          {stats.map((_, i) => (
            <div key={i} className="flex items-center gap-3 min-w-fit">
              <Skeleton className="h-4 w-4" />
              <div className="flex flex-col gap-1">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-5 w-12" />
              </div>
              {i < stats.length - 1 && (
                <Separator orientation="vertical" className="h-8 ml-6" />
              )}
            </div>
          ))}
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-4">
      <div className="flex items-center gap-4 overflow-x-auto sm:gap-6">
        {stats.map((stat, index) => (
          <div key={stat.title} className="flex items-center gap-3 min-w-fit">
            <stat.icon className="h-4 w-4 text-muted-foreground shrink-0" />
            <div className="flex flex-col">
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                {stat.title}
              </span>
              <span className="text-lg font-bold tabular-nums">
                {stat.value.toLocaleString()}
              </span>
            </div>
            {index < stats.length - 1 && (
              <Separator orientation="vertical" className="h-8 ml-2 sm:ml-4" />
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}
