"use client";

import { useState } from "react";
import { Copy, Check, RefreshCw, TestTube } from "lucide-react";
import { useSite } from "@/contexts/site-context";
import { api } from "@/trpc/react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";

export default function TrackingPage() {
  const { activeSite } = useSite();
  const [copied, setCopied] = useState(false);

  const { data: scriptData, isLoading } = api.tracking.getScript.useQuery(
    { siteId: activeSite?.id ?? "" },
    { enabled: !!activeSite?.id }
  );

  const testMutation = api.tracking.testInstallation.useMutation();

  const copyToClipboard = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!activeSite) {
    return (
      <div className="p-6">
        <Alert>
          <AlertTitle>No site selected</AlertTitle>
          <AlertDescription>Select a site to view tracking instructions.</AlertDescription>
        </Alert>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Tracking Pixel</h1>
        <p className="text-muted-foreground">
          Add the tracking pixel to your site to monitor AI crawler visits.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Installation</CardTitle>
          <CardDescription>
            Copy this HTML and add it anywhere in your website&apos;s HTML.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm">
              <code>{scriptData?.pixelTag}</code>
            </pre>
            <Button
              size="sm"
              variant="outline"
              className="absolute top-2 right-2"
              onClick={() => copyToClipboard(scriptData?.pixelTag ?? "")}
            >
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            This invisible 1x1 pixel detects AI crawlers when they visit your pages.
            It works because crawlers fetch images even though they don&apos;t execute JavaScript.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Test Installation</CardTitle>
          <CardDescription>
            Verify that the tracking pixel is properly installed on your site.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button
            onClick={() => testMutation.mutate({ siteId: activeSite.id })}
            disabled={testMutation.isPending}
          >
            {testMutation.isPending ? (
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <TestTube className="h-4 w-4 mr-2" />
            )}
            Test Pixel
          </Button>

          {testMutation.data && (
            <Alert variant={testMutation.data.installed ? "default" : "destructive"}>
              <AlertTitle>
                {testMutation.data.installed ? "Pixel Detected" : "Pixel Not Found"}
              </AlertTitle>
              <AlertDescription>
                {testMutation.data.installed
                  ? "The tracking pixel is properly installed on your site."
                  : testMutation.data.error}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>How It Works</CardTitle>
        </CardHeader>
        <CardContent className="prose prose-sm dark:prose-invert">
          <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
            <li>Add the tracking pixel to your site&apos;s HTML</li>
            <li>When crawlers load your page, they fetch the pixel image</li>
            <li>We detect AI crawlers from the User-Agent header server-side</li>
            <li>Crawler visits are recorded with type, page, and timestamp</li>
            <li>Regular browser visits are not tracked</li>
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}
