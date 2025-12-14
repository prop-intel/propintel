"use client";

import { useState } from "react";
import {
  AlertCircle,
  Check,
  CheckCheck,
  Copy,
  Loader2,
  BarChart3,
  RefreshCw,
  TestTube,
} from "lucide-react";
import { api } from "@/trpc/react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from "@/components/ui/empty";

interface TrackingStatusBadgeProps {
  siteId: string;
  onClick?: () => void;
}

export function TrackingStatusBadge({
  siteId,
  onClick,
}: TrackingStatusBadgeProps) {
  const { data: status, isLoading } = api.tracking.getTrackingStatus.useQuery(
    { siteId },
    { enabled: !!siteId },
  );

  if (isLoading) {
    return (
      <Badge variant="secondary" className="cursor-pointer" onClick={onClick}>
        <Loader2 className="h-3 w-3 animate-spin" />
        <span className="hidden sm:inline">Checking...</span>
      </Badge>
    );
  }

  const hasPixel = status?.hasPixel ?? false;
  const hasMiddleware = status?.hasMiddleware ?? false;

  if (hasPixel && hasMiddleware) {
    return (
      <Badge variant="default" className="cursor-pointer" onClick={onClick}>
        <CheckCheck className="h-3 w-3" />
        <span className="hidden sm:inline">Pixel + Middleware</span>
      </Badge>
    );
  }

  if (hasPixel) {
    return (
      <Badge variant="default" className="cursor-pointer" onClick={onClick}>
        <Check className="h-3 w-3" />
        <span className="hidden sm:inline">Pixel</span>
      </Badge>
    );
  }

  if (hasMiddleware) {
    return (
      <Badge variant="default" className="cursor-pointer" onClick={onClick}>
        <Check className="h-3 w-3" />
        <span className="hidden sm:inline">Middleware</span>
      </Badge>
    );
  }

  return (
    <Badge variant="destructive" className="cursor-pointer" onClick={onClick}>
      <AlertCircle className="h-3 w-3" />
      <span className="hidden sm:inline">Not tracking</span>
    </Badge>
  );
}

interface TrackingSetupDialogProps {
  siteId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TrackingSetupDialog({
  siteId,
  open,
  onOpenChange,
}: TrackingSetupDialogProps) {
  const [copied, setCopied] = useState<string | null>(null);

  const { data: scriptData } = api.tracking.getScript.useQuery(
    { siteId },
    { enabled: !!siteId && open },
  );

  const testPixelMutation = api.tracking.testInstallation.useMutation();
  const testMiddlewareMutation = api.tracking.testMiddleware.useMutation();

  const copyToClipboard = async (text: string, type: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(type);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Install Tracking</DialogTitle>
          <DialogDescription>
            Choose a method to track AI crawler visits.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="pixel" className="mt-2">
          <TabsList className="w-full">
            <TabsTrigger value="pixel" className="flex-1">
              Pixel
            </TabsTrigger>
            <TabsTrigger value="middleware" className="flex-1">
              Middleware
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pixel" className="mt-4 space-y-3">
            <div className="relative">
              <pre className="bg-muted whitespace-pre-wrap break-all rounded-md p-3 pr-12 text-sm">
                <code>{scriptData?.pixelSnippet}</code>
              </pre>
              <Button
                size="icon"
                variant="ghost"
                className="absolute right-1.5 top-1.5 h-7 w-7"
                onClick={() =>
                  copyToClipboard(scriptData?.pixelSnippet ?? "", "pixel")
                }
              >
                {copied === "pixel" ? (
                  <Check className="h-3.5 w-3.5" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
              </Button>
            </div>
            <p className="text-muted-foreground text-sm">
              Add to your HTML body. Works without JavaScript.
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => testPixelMutation.mutate({ siteId })}
                disabled={testPixelMutation.isPending}
              >
                {testPixelMutation.isPending ? (
                  <RefreshCw className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <TestTube className="mr-1.5 h-3.5 w-3.5" />
                )}
                Test
              </Button>
              {testPixelMutation.data && (
                <Badge
                  variant={
                    testPixelMutation.data.installed ? "default" : "destructive"
                  }
                >
                  {testPixelMutation.data.installed ? "Detected" : "Not found"}
                </Badge>
              )}
            </div>
            {testPixelMutation.data && !testPixelMutation.data.installed && (
              <Alert variant="destructive" className="py-2">
                <AlertDescription className="text-xs">
                  {testPixelMutation.data.error}
                </AlertDescription>
              </Alert>
            )}
          </TabsContent>

          <TabsContent value="middleware" className="mt-4 space-y-3">
            <div className="relative">
              <pre className="bg-muted max-h-48 overflow-y-auto whitespace-pre-wrap break-all rounded-md p-3 pr-12 text-sm">
                <code>{scriptData?.middlewareSnippet}</code>
              </pre>
              <Button
                size="icon"
                variant="ghost"
                className="absolute right-1.5 top-1.5 h-7 w-7"
                onClick={() =>
                  copyToClipboard(
                    scriptData?.middlewareSnippet ?? "",
                    "middleware",
                  )
                }
              >
                {copied === "middleware" ? (
                  <Check className="h-3.5 w-3.5" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
              </Button>
            </div>
            <p className="text-muted-foreground text-sm">
              For Next.js/Express. Catches text-only AI agents.
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => testMiddlewareMutation.mutate({ siteId })}
                disabled={testMiddlewareMutation.isPending}
              >
                {testMiddlewareMutation.isPending ? (
                  <RefreshCw className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <TestTube className="mr-1.5 h-3.5 w-3.5" />
                )}
                Test Endpoint
              </Button>
              {testMiddlewareMutation.data && (
                <Badge
                  variant={
                    testMiddlewareMutation.data.working
                      ? "default"
                      : "destructive"
                  }
                >
                  {testMiddlewareMutation.data.working ? "Working" : "Error"}
                </Badge>
              )}
            </div>
            {testMiddlewareMutation.data &&
              !testMiddlewareMutation.data.working && (
                <Alert variant="destructive" className="py-2">
                  <AlertDescription className="text-xs">
                    {testMiddlewareMutation.data.error}
                  </AlertDescription>
                </Alert>
              )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

interface TrackingEmptyStateProps {
  onSetupClick: () => void;
}

export function TrackingEmptyState({ onSetupClick }: TrackingEmptyStateProps) {
  return (
    <Empty className="min-h-[300px] border">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <BarChart3 className="h-6 w-6" />
        </EmptyMedia>
        <EmptyTitle>No tracking data yet</EmptyTitle>
        <EmptyDescription>
          Install tracking to monitor AI crawler visits.
        </EmptyDescription>
      </EmptyHeader>
      <Button onClick={onSetupClick}>Setup Tracking</Button>
    </Empty>
  );
}
