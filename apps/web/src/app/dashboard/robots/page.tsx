"use client";

import { useSite } from "@/contexts/site-context";
import { api } from "@/trpc/react";
import { RobotsViewer } from "@/components/robots/robots-viewer";
import { LlmsViewer } from "@/components/robots/llms-viewer";
import { PermissionMatrix } from "@/components/robots/permission-matrix";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export default function RobotsPage() {
  const { activeSite } = useSite();

  const robotsQuery = api.robots.fetchRobotsTxt.useQuery(
    { siteId: activeSite?.id ?? "" },
    { enabled: !!activeSite?.id }
  );

  const llmsQuery = api.robots.fetchLlmsTxt.useQuery(
    { siteId: activeSite?.id ?? "" },
    { enabled: !!activeSite?.id }
  );

  const permissionsQuery = api.robots.analyzePermissions.useQuery(
    { siteId: activeSite?.id ?? "" },
    { enabled: !!activeSite?.id }
  );

  if (!activeSite) {
    return (
      <div className="p-6">
        <Alert>
          <AlertTitle>No site selected</AlertTitle>
          <AlertDescription>Select a site to analyze its robots.txt and llms.txt.</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Robots Analysis</h1>
        <p className="text-muted-foreground">
          Analyze your site&apos;s robots.txt and llms.txt configurations.
        </p>
      </div>

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
    </div>
  );
}
