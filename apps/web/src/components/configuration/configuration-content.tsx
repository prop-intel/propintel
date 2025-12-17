"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { type RouterOutputs } from "@/trpc/react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RobotsViewer } from "@/components/configuration/robots-viewer";
import { LlmsGenerator } from "@/components/configuration/llms-generator";
import { PermissionMatrix } from "@/components/configuration/permission-matrix";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Settings, FileText, Bell, Key, Globe } from "lucide-react";

type Site = {
  id: string;
  domain: string;
  name: string | null;
  trackingId: string;
};

interface ConfigurationContentProps {
  site: Site;
  sites: Site[];
  initialData: {
    robots: RouterOutputs["robots"]["fetchRobotsTxt"];
    llms: RouterOutputs["robots"]["fetchLlmsTxt"];
    llmsFull: RouterOutputs["robots"]["fetchLlmsFullTxt"];
    permissions: RouterOutputs["robots"]["analyzePermissions"];
  };
}

export function ConfigurationContent({
  site,
  initialData,
}: ConfigurationContentProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleRefresh = () => {
    startTransition(() => {
      router.refresh();
    });
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Configuration</h1>
        <p className="text-muted-foreground">
          Manage your site settings and AI crawler permissions
        </p>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="robots" className="space-y-6">
        <TabsList>
          <TabsTrigger value="robots" className="gap-2">
            <FileText className="h-4 w-4" />
            robots.txt / llms.txt
          </TabsTrigger>
          <TabsTrigger value="settings" className="gap-2">
            <Settings className="h-4 w-4" />
            Settings
          </TabsTrigger>
        </TabsList>

        {/* robots.txt / llms.txt Tab */}
        <TabsContent value="robots">
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Main content - txt viewers */}
            <div className="space-y-6 lg:col-span-2">
              <LlmsGenerator
                siteId={site.id}
                siteName={site.name ?? site.domain}
                domain={site.domain}
                existingLlmsTxtContent={initialData.llms.content}
                existingLlmsTxtFound={initialData.llms.found}
                existingLlmsTxtError={initialData.llms.error}
                existingLlmsFullTxtContent={initialData.llmsFull.content}
                existingLlmsFullTxtFound={initialData.llmsFull.found}
                existingLlmsFullTxtError={initialData.llmsFull.error}
                existingLoading={isPending}
                onRefreshExisting={handleRefresh}
              />
              <RobotsViewer
                content={initialData.robots.content}
                found={initialData.robots.found}
                error={initialData.robots.error}
                isLoading={isPending}
                onRefresh={handleRefresh}
              />
            </div>

            {/* Sidebar - permission matrix */}
            <div className="lg:col-span-1">
              <div className="sticky top-6">
                <PermissionMatrix
                  permissions={initialData.permissions}
                  isLoading={isPending}
                />
              </div>
            </div>
          </div>
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value="settings" className="space-y-6">
          {/* Site Info */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Globe className="text-primary h-5 w-5" />
                <CardTitle>Site Information</CardTitle>
              </div>
              <CardDescription>
                Basic information about your tracked site
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-muted-foreground text-sm font-medium">
                    Domain
                  </label>
                  <p className="mt-1 font-mono text-sm">{site.domain}</p>
                </div>
                <div>
                  <label className="text-muted-foreground text-sm font-medium">
                    Site Name
                  </label>
                  <p className="mt-1 text-sm">
                    {site.name ?? site.domain}
                  </p>
                </div>
                <div>
                  <label className="text-muted-foreground text-sm font-medium">
                    Tracking ID
                  </label>
                  <p className="mt-1 font-mono text-sm">
                    {site.trackingId}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Notifications - Coming Soon */}
          <Card className="opacity-60">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Bell className="text-primary h-5 w-5" />
                  <CardTitle>Notifications</CardTitle>
                </div>
                <Badge variant="secondary">Coming Soon</Badge>
              </div>
              <CardDescription>
                Configure email alerts for analysis completion and crawler
                activity
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-sm">
                Email notifications will be available in a future update.
              </p>
            </CardContent>
          </Card>

          {/* API Keys - Coming Soon */}
          <Card className="opacity-60">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Key className="text-primary h-5 w-5" />
                  <CardTitle>API Keys</CardTitle>
                </div>
                <Badge variant="secondary">Coming Soon</Badge>
              </div>
              <CardDescription>
                Manage API keys for programmatic access
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-sm">
                API key management will be available in a future update.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
