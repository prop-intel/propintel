"use client";

import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";

interface TopPagesTableProps {
  data: Array<{
    id: string;
    path: string;
    crawlCount: number | null;
    lastCrawled: Date | null;
  }> | undefined;
  isLoading: boolean;
}

export function TopPagesTable({ data, isLoading }: TopPagesTableProps) {
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
        <CardDescription>Most crawled URLs</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Path</TableHead>
              <TableHead className="text-right">Visits</TableHead>
              <TableHead className="text-right">Last Crawled</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((url) => (
              <TableRow key={url.id}>
                <TableCell>
                  <Link
                    href={`/dashboard/url/${url.id}`}
                    className="text-primary hover:underline truncate block max-w-[300px]"
                    title={url.path}
                  >
                    {url.path}
                  </Link>
                </TableCell>
                <TableCell className="text-right">{url.crawlCount ?? 0}</TableCell>
                <TableCell className="text-right">
                  {url.lastCrawled?.toLocaleDateString() ?? "-"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
