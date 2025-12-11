"use client";

import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface RobotsViewerProps {
  content: string | null;
  found: boolean;
  error: string | null;
  isLoading: boolean;
  onRefresh: () => void;
}

export function RobotsViewer({ content, found, error, isLoading, onRefresh }: RobotsViewerProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>robots.txt</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-48 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>robots.txt</CardTitle>
          <CardDescription>
            {found ? "Current robots.txt from your site" : "robots.txt status"}
          </CardDescription>
        </div>
        <Button variant="outline" size="sm" onClick={onRefresh}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </CardHeader>
      <CardContent>
        {!found ? (
          <Alert>
            <AlertDescription>
              {error ?? "robots.txt not found on this domain."}
            </AlertDescription>
          </Alert>
        ) : (
          <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm max-h-96 overflow-y-auto">
            <code>{content}</code>
          </pre>
        )}
      </CardContent>
    </Card>
  );
}
