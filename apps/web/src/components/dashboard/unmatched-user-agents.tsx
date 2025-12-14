"use client";

import { useState } from "react";
import { api } from "@/trpc/react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Trash2, Search, ChevronLeft, ChevronRight } from "lucide-react";

const PAGE_SIZE = 20;

export function UnmatchedUserAgents() {
  const [search, setSearch] = useState("");
  const [offset, setOffset] = useState(0);
  const utils = api.useUtils();

  const { data, isLoading } = api.admin.getUnmatchedUserAgents.useQuery({
    limit: PAGE_SIZE,
    offset,
    search: search || undefined,
    days: 30,
  });

  const { data: stats } = api.admin.getUnmatchedStats.useQuery({ days: 30 });

  const deleteMutation = api.admin.deleteUnmatchedUserAgent.useMutation({
    onSuccess: () => {
      void utils.admin.getUnmatchedUserAgents.invalidate();
      void utils.admin.getUnmatchedStats.invalidate();
    },
  });

  const deleteAllMutation = api.admin.deleteAllUnmatched.useMutation({
    onSuccess: () => {
      void utils.admin.getUnmatchedUserAgents.invalidate();
      void utils.admin.getUnmatchedStats.invalidate();
      setOffset(0);
    },
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setOffset(0);
  };

  const handleDelete = (id: string) => {
    deleteMutation.mutate({ id });
  };

  const handleDeleteAll = () => {
    deleteAllMutation.mutate({ days: 30 });
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Unmatched User Agents</CardTitle>
          <CardDescription>
            User agents that don&apos;t match known crawler patterns
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[300px] w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              Unmatched User Agents
              {stats && (
                <Badge variant="secondary">{stats.total} total</Badge>
              )}
            </CardTitle>
            <CardDescription>
              User agents that don&apos;t match known crawler patterns (last 30 days)
            </CardDescription>
          </div>
          {data && data.total > 0 && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm">
                  <Trash2 className="h-4 w-4 mr-1" />
                  Clear All
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Clear all unmatched user agents?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete all {stats?.total ?? 0} unmatched
                    user agent records from the last 30 days. This action cannot be
                    undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDeleteAll}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Delete All
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <form onSubmit={handleSearch} className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search user agents..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8"
            />
          </div>
          <Button type="submit" variant="secondary">
            Search
          </Button>
        </form>

        {!data || data.items.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">
            No unmatched user agents found
          </div>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User Agent</TableHead>
                  <TableHead>Site</TableHead>
                  <TableHead>Path</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-mono text-xs max-w-[300px] truncate" title={item.userAgent}>
                      {item.userAgent}
                    </TableCell>
                    <TableCell className="text-sm">
                      {item.site?.name ?? item.site?.domain ?? "-"}
                    </TableCell>
                    <TableCell className="max-w-[150px] truncate" title={item.path}>
                      {item.path}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{item.source}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(item.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(item.id)}
                        disabled={deleteMutation.isPending}
                      >
                        <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                Showing {offset + 1}-{Math.min(offset + PAGE_SIZE, data.total)} of{" "}
                {data.total}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
                  disabled={offset === 0}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setOffset(offset + PAGE_SIZE)}
                  disabled={!data.hasMore}
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
