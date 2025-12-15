"use client";

import { useSite } from "@/contexts/site-context";
import { api } from "@/trpc/react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RobotsViewer } from "@/components/configuration/robots-viewer";
import { LlmsViewer } from "@/components/configuration/llms-viewer";
import { PermissionMatrix } from "@/components/configuration/permission-matrix";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Settings, FileText, Bell, Key, Globe } from "lucide-react";

export default function ConfigurationPage() {
  const { activeSite } = useSite();

  const robotsQuery = api.robots.fetchRobotsTxt.useQuery(
    { siteId: activeSite?.id ?? "" },
    { enabled: !!activeSite?.id },
  );

  const llmsQuery = api.robots.fetchLlmsTxt.useQuery(
    { siteId: activeSite?.id ?? "" },
    { enabled: !!activeSite?.id },
  );

  const permissionsQuery = api.robots.analyzePermissions.useQuery(
    { siteId: activeSite?.id ?? "" },
    { enabled: !!activeSite?.id },
  );

  if (!activeSite) {
    return (
      <div className="p-6">
        <Alert>
          <AlertTitle>No site selected</AlertTitle>
          <AlertDescription>
            Select a site to view configuration options.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

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
        <TabsContent value="robots" className="space-y-6">
          <PermissionMatrix
            permissions={permissionsQuery.data}
            isLoading={permissionsQuery.isLoading}
          />

          <div className="grid gap-6 md:grid-cols-2">
            <RobotsViewer
              content={robotsQuery.data?.content ?? null}
              found={robotsQuery.data?.found ?? false}
              error={robotsQuery.data?.error ?? null}
              isLoading={robotsQuery.isLoading}
              onRefresh={() => robotsQuery.refetch()}
            />

            <LlmsViewer
              content={llmsQuery.data?.content ?? null}
              found={llmsQuery.data?.found ?? false}
              error={llmsQuery.data?.error ?? null}
              isLoading={llmsQuery.isLoading}
              onRefresh={() => llmsQuery.refetch()}
            />
          </div>
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value="settings" className="space-y-6">
          {/* Site Info */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Globe className="h-5 w-5 text-primary" />
                <CardTitle>Site Information</CardTitle>
              </div>
              <CardDescription>
                Basic information about your tracked site
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Domain</label>
                  <p className="text-sm font-mono mt-1">{activeSite.domain}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Site Name</label>
                  <p className="text-sm mt-1">{activeSite.name ?? activeSite.domain}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Tracking ID</label>
                  <p className="text-sm font-mono mt-1">{activeSite.trackingId}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Notifications - Coming Soon */}
          <Card className="opacity-60">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Bell className="h-5 w-5 text-primary" />
                  <CardTitle>Notifications</CardTitle>
                </div>
                <Badge variant="secondary">Coming Soon</Badge>
              </div>
              <CardDescription>
                Configure email alerts for analysis completion and crawler activity
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Email notifications will be available in a future update.
              </p>
            </CardContent>
          </Card>

          {/* API Keys - Coming Soon */}
          <Card className="opacity-60">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Key className="h-5 w-5 text-primary" />
                  <CardTitle>API Keys</CardTitle>
                </div>
                <Badge variant="secondary">Coming Soon</Badge>
              </div>
              <CardDescription>
                Manage API keys for programmatic access
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                API key management will be available in a future update.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
