"use client";

import { Check, X, AlertTriangle, HelpCircle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

type PermissionStatus = "allowed" | "blocked" | "partial" | "unknown";

interface CrawlerPermission {
  id: string;
  name: string;
  company: string;
  status: PermissionStatus;
}

interface PermissionMatrixProps {
  permissions: CrawlerPermission[] | undefined;
  isLoading: boolean;
}

const statusConfig: Record<PermissionStatus, { icon: React.ElementType; label: string; variant: "default" | "destructive" | "outline" | "secondary" }> = {
  allowed: { icon: Check, label: "Allowed", variant: "default" },
  blocked: { icon: X, label: "Blocked", variant: "destructive" },
  partial: { icon: AlertTriangle, label: "Partial", variant: "secondary" },
  unknown: { icon: HelpCircle, label: "Unknown", variant: "outline" },
};

export function PermissionMatrix({ permissions, isLoading }: PermissionMatrixProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>AI Crawler Permissions</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    );
  }

  // Group by company
  const byCompany: Record<string, CrawlerPermission[]> = {};
  for (const p of permissions ?? []) {
    (byCompany[p.company] ??= []).push(p);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>AI Crawler Permissions</CardTitle>
        <CardDescription>
          Based on your robots.txt configuration
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Crawler</TableHead>
              <TableHead>Company</TableHead>
              <TableHead className="text-center">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Object.entries(byCompany).map(([company, crawlers]) =>
              crawlers.map((crawler) => {
                const config = statusConfig[crawler.status];
                const Icon = config.icon;
                return (
                  <TableRow key={crawler.id}>
                    <TableCell className="font-medium">{crawler.name}</TableCell>
                    <TableCell>{company}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant={config.variant} className="gap-1">
                        <Icon className="h-3 w-3" />
                        {config.label}
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
