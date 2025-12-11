"use client";

import { useState } from "react";
import { Copy, Check, RefreshCw, TestTube } from "lucide-react";
import { useSite } from "@/contexts/site-context";
import { api } from "@/trpc/react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";

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
        <h1 className="text-2xl font-bold">Tracking Script</h1>
        <p className="text-muted-foreground">
          Add the tracking script to your site to start monitoring AI crawler visits.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Installation</CardTitle>
          <CardDescription>
            Copy one of the following scripts and add it to your website&apos;s &lt;head&gt; or before &lt;/body&gt;.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="inline">
            <TabsList>
              <TabsTrigger value="inline">Inline Script</TabsTrigger>
              <TabsTrigger value="external">External Script</TabsTrigger>
            </TabsList>

            <TabsContent value="inline" className="space-y-4">
              <div className="relative">
                <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm">
                  <code>{scriptData?.inlineScript}</code>
                </pre>
                <Button
                  size="sm"
                  variant="outline"
                  className="absolute top-2 right-2"
                  onClick={() => copyToClipboard(scriptData?.inlineScript ?? "", "inline")}
                >
                  {copied === "inline" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">
                The inline script is self-contained and doesn&apos;t make additional requests.
              </p>
            </TabsContent>

            <TabsContent value="external" className="space-y-4">
              <div className="relative">
                <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm">
                  <code>{scriptData?.externalScript}</code>
                </pre>
                <Button
                  size="sm"
                  variant="outline"
                  className="absolute top-2 right-2"
                  onClick={() => copyToClipboard(scriptData?.externalScript ?? "", "external")}
                >
                  {copied === "external" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">
                The external script loads from our server. This allows automatic updates but adds a network request.
              </p>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Test Installation</CardTitle>
          <CardDescription>
            Verify that the tracking script is properly installed on your site.
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
            Test Script
          </Button>

          {testMutation.data && (
            <Alert variant={testMutation.data.installed ? "default" : "destructive"}>
              <AlertTitle>
                {testMutation.data.installed ? "Script Detected" : "Script Not Found"}
              </AlertTitle>
              <AlertDescription>
                {testMutation.data.installed
                  ? "The tracking script is properly installed on your site."
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
            <li>The script checks the visitor&apos;s User-Agent for known AI crawlers</li>
            <li>When an AI crawler is detected, a beacon is sent to our server</li>
            <li>We record the crawler type, page visited, and timestamp</li>
            <li>Regular visitors are not tracked - only AI crawlers</li>
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}
