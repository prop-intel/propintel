"use client";

import { RefreshCw, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface LlmsViewerProps {
  content: string | null;
  found: boolean;
  error: string | null;
  isLoading: boolean;
  onRefresh: () => void;
}

export function LlmsViewer({ content, found, isLoading, onRefresh }: LlmsViewerProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>llms.txt</CardTitle>
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
          <CardTitle>llms.txt</CardTitle>
          <CardDescription>
            AI-specific instructions file (emerging standard)
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
            <Info className="h-4 w-4" />
            <AlertTitle>No llms.txt found</AlertTitle>
            <AlertDescription>
              llms.txt is an emerging standard for providing instructions to AI models.
              Consider adding one to your site to control how AI systems interact with your content.
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
