"use client";

import { useState } from "react";
import { Copy, Check, RefreshCw, TestTube, HelpCircle } from "lucide-react";
import { useSite } from "@/contexts/site-context";
import { api } from "@/trpc/react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export default function TrackingPage() {
  const { activeSite } = useSite();
  const [copied, setCopied] = useState<string | null>(null);

  const { data: scriptData, isLoading } = api.tracking.getScript.useQuery(
    { siteId: activeSite?.id ?? "" },
    { enabled: !!activeSite?.id }
  );

  const testMutation = api.tracking.testInstallation.useMutation();

  const copyToClipboard = async (text: string, type: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(type);
    setTimeout(() => setCopied(null), 2000);
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
          Add the tracking pixel to your site to start monitoring AI crawler visits.
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Installation</CardTitle>
              <CardDescription>
                Add this to your website&apos;s HTML body.
              </CardDescription>
            </div>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <HelpCircle className="h-4 w-4 text-muted-foreground" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="left" className="max-w-xs">
                <p className="font-medium mb-2">How it works:</p>
                <ol className="list-decimal list-inside space-y-1 text-xs">
                  <li>Add pixel to pages you want to track</li>
                  <li>AI crawlers request the pixel image</li>
                  <li>We detect crawlers from request headers</li>
                  <li>No JavaScript required</li>
                </ol>
              </TooltipContent>
            </Tooltip>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <pre className="bg-muted p-4 pr-24 rounded-lg overflow-x-auto text-sm">
              <code>{scriptData?.pixelSnippet}</code>
            </pre>
            <div className="absolute top-2 right-2 flex gap-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="icon"
                    variant="outline"
                    className="h-8 w-8"
                    onClick={() => copyToClipboard(scriptData?.pixelSnippet ?? "", "pixel")}
                  >
                    {copied === "pixel" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Copy to clipboard</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="icon"
                    variant="outline"
                    className="h-8 w-8"
                    onClick={() => testMutation.mutate({ siteId: activeSite.id })}
                    disabled={testMutation.isPending}
                  >
                    {testMutation.isPending ? (
                      <RefreshCw className="h-4 w-4 animate-spin" />
                    ) : (
                      <TestTube className="h-4 w-4" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Test installation</TooltipContent>
              </Tooltip>
            </div>
          </div>

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
    </div>
  );
}
