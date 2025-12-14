"use client";

import Link from "next/link";
import { Line, LineChart, ResponsiveContainer } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";

interface TopPagesTableProps {
  data: Array<{
    id: string;
    path: string;
    crawlCount: number | null;
    lastCrawled: Date | null;
    trend?: number[];
  }> | undefined;
  isLoading: boolean;
}

function Sparkline({ data }: { data: number[] }) {
  if (!data || data.length === 0) {
    return <div className="w-16 h-5" />;
  }

  const chartData = data.map((value, index) => ({ value, index }));

  return (
    <div className="w-16 h-5">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData}>
          <Line
            type="monotone"
            dataKey="value"
            stroke="hsl(var(--primary))"
            strokeWidth={1.5}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function TopPagesTable({ data, isLoading }: TopPagesTableProps) {
  const hasTrendData = data?.some(d => d.trend && d.trend.length > 0);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Top Pages</CardTitle>
          <CardDescription>Most crawled URLs</CardDescription>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[200px] w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!data || data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Top Pages</CardTitle>
          <CardDescription>Most crawled URLs</CardDescription>
        </CardHeader>
        <CardContent className="text-center text-muted-foreground py-8">
          No pages tracked yet
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Top Pages</CardTitle>
        <CardDescription>Most crawled URLs (click to view details)</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Path</TableHead>
              {hasTrendData && <TableHead className="w-20">7d Trend</TableHead>}
              <TableHead className="text-right w-20">Visits</TableHead>
              <TableHead className="text-right w-28">Last Crawled</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((url) => (
              <TableRow key={url.id} className="group">
                <TableCell>
                  <Link
                    href={`/dashboard/url/${url.id}`}
                    className="text-primary hover:underline truncate block max-w-[250px] group-hover:text-primary/80"
                    title={url.path}
                  >
                    {url.path}
                  </Link>
                </TableCell>
                {hasTrendData && (
                  <TableCell>
                    <Sparkline data={url.trend ?? []} />
                  </TableCell>
                )}
                <TableCell className="text-right font-medium tabular-nums">
                  {url.crawlCount ?? 0}
                </TableCell>
                <TableCell className="text-right text-muted-foreground text-sm">
                  {url.lastCrawled
                    ? new Date(url.lastCrawled).toLocaleDateString()
                    : "-"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
