# Phase 7: Robots.txt and LLMs.txt Analysis

## Overview

Fetch, parse, and display robots.txt and llms.txt files with analysis of AI crawler permissions.

## Dependencies

- Phase 1 (crawler definitions)
- Phase 2 (site domain)

## Files to Create

### `src/lib/robots-parser.ts`

Utility for parsing robots.txt.

```typescript
export interface RobotsRule {
  userAgent: string;
  rules: Array<{
    type: "allow" | "disallow";
    path: string;
  }>;
}

export interface ParsedRobots {
  raw: string;
  rules: RobotsRule[];
  sitemaps: string[];
}

export function parseRobotsTxt(content: string): ParsedRobots {
  const lines = content.split("\n").map((line) => line.trim());
  const rules: RobotsRule[] = [];
  const sitemaps: string[] = [];

  let currentRule: RobotsRule | null = null;

  for (const line of lines) {
    // Skip comments and empty lines
    if (line.startsWith("#") || line === "") continue;

    const [directive, ...valueParts] = line.split(":");
    const value = valueParts.join(":").trim();

    const directiveLower = directive?.toLowerCase().trim();

    if (directiveLower === "user-agent") {
      if (currentRule) {
        rules.push(currentRule);
      }
      currentRule = { userAgent: value, rules: [] };
    } else if (directiveLower === "disallow" && currentRule) {
      currentRule.rules.push({ type: "disallow", path: value || "/" });
    } else if (directiveLower === "allow" && currentRule) {
      currentRule.rules.push({ type: "allow", path: value });
    } else if (directiveLower === "sitemap") {
      sitemaps.push(value);
    }
  }

  if (currentRule) {
    rules.push(currentRule);
  }

  return { raw: content, rules, sitemaps };
}

export function isCrawlerAllowed(
  robots: ParsedRobots,
  crawlerUserAgent: string,
  path = "/"
): "allowed" | "blocked" | "partial" | "unknown" {
  // Find matching rules (specific user-agent or *)
  const matchingRules = robots.rules.filter(
    (rule) =>
      rule.userAgent === "*" ||
      rule.userAgent.toLowerCase() === crawlerUserAgent.toLowerCase() ||
      crawlerUserAgent.toLowerCase().includes(rule.userAgent.toLowerCase())
  );

  if (matchingRules.length === 0) {
    return "allowed"; // No rules = allowed by default
  }

  // Check specific user-agent first, then fallback to *
  const specificRules = matchingRules.filter(
    (r) => r.userAgent.toLowerCase() !== "*"
  );
  const rulesToCheck = specificRules.length > 0 ? specificRules : matchingRules;

  for (const rule of rulesToCheck) {
    // Check for complete block
    const hasRootDisallow = rule.rules.some(
      (r) => r.type === "disallow" && (r.path === "/" || r.path === "")
    );
    const hasAnyAllow = rule.rules.some((r) => r.type === "allow");

    if (hasRootDisallow && !hasAnyAllow) {
      return "blocked";
    }
    if (hasRootDisallow && hasAnyAllow) {
      return "partial";
    }
  }

  return "allowed";
}

// Common AI crawler user agents to check
export const AI_CRAWLER_USER_AGENTS = [
  { id: "gptbot", userAgent: "GPTBot", name: "GPTBot", company: "OpenAI" },
  { id: "chatgpt-user", userAgent: "ChatGPT-User", name: "ChatGPT-User", company: "OpenAI" },
  { id: "oai-searchbot", userAgent: "OAI-SearchBot", name: "OAI-SearchBot", company: "OpenAI" },
  { id: "claudebot", userAgent: "ClaudeBot", name: "ClaudeBot", company: "Anthropic" },
  { id: "claude-web", userAgent: "Claude-Web", name: "Claude-Web", company: "Anthropic" },
  { id: "anthropic-ai", userAgent: "anthropic-ai", name: "anthropic-ai", company: "Anthropic" },
  { id: "perplexitybot", userAgent: "PerplexityBot", name: "PerplexityBot", company: "Perplexity" },
  { id: "google-extended", userAgent: "Google-Extended", name: "Google-Extended", company: "Google" },
  { id: "bingbot", userAgent: "bingbot", name: "Bingbot", company: "Microsoft" },
  { id: "bytespider", userAgent: "Bytespider", name: "Bytespider", company: "ByteDance" },
  { id: "cohere-ai", userAgent: "cohere-ai", name: "cohere-ai", company: "Cohere" },
  { id: "meta-externalagent", userAgent: "Meta-ExternalAgent", name: "Meta-ExternalAgent", company: "Meta" },
  { id: "applebot-extended", userAgent: "Applebot-Extended", name: "Applebot-Extended", company: "Apple" },
];
```

### `src/server/api/routers/robots.ts`

tRPC router for robots analysis.

```typescript
import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { sites } from "@/server/db/schema";
import { eq, and } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import {
  parseRobotsTxt,
  isCrawlerAllowed,
  AI_CRAWLER_USER_AGENTS,
} from "@/lib/robots-parser";

export const robotsRouter = createTRPCRouter({
  // Fetch and parse robots.txt
  fetchRobotsTxt: protectedProcedure
    .input(z.object({ siteId: z.string() }))
    .query(async ({ ctx, input }) => {
      const site = await ctx.db.query.sites.findFirst({
        where: and(
          eq(sites.id, input.siteId),
          eq(sites.userId, ctx.session.user.id)
        ),
      });

      if (!site) throw new TRPCError({ code: "NOT_FOUND" });

      try {
        const response = await fetch(`https://${site.domain}/robots.txt`, {
          headers: { "User-Agent": "PropIntel-Analyzer/1.0" },
          signal: AbortSignal.timeout(10000),
        });

        if (!response.ok) {
          if (response.status === 404) {
            return { found: false, error: "robots.txt not found", content: null, parsed: null };
          }
          return { found: false, error: `HTTP ${response.status}`, content: null, parsed: null };
        }

        const content = await response.text();
        const parsed = parseRobotsTxt(content);

        return { found: true, error: null, content, parsed };
      } catch (error) {
        return {
          found: false,
          error: error instanceof Error ? error.message : "Failed to fetch",
          content: null,
          parsed: null,
        };
      }
    }),

  // Fetch llms.txt
  fetchLlmsTxt: protectedProcedure
    .input(z.object({ siteId: z.string() }))
    .query(async ({ ctx, input }) => {
      const site = await ctx.db.query.sites.findFirst({
        where: and(
          eq(sites.id, input.siteId),
          eq(sites.userId, ctx.session.user.id)
        ),
      });

      if (!site) throw new TRPCError({ code: "NOT_FOUND" });

      try {
        const response = await fetch(`https://${site.domain}/llms.txt`, {
          headers: { "User-Agent": "PropIntel-Analyzer/1.0" },
          signal: AbortSignal.timeout(10000),
        });

        if (!response.ok) {
          if (response.status === 404) {
            return { found: false, error: "llms.txt not found", content: null };
          }
          return { found: false, error: `HTTP ${response.status}`, content: null };
        }

        const content = await response.text();
        return { found: true, error: null, content };
      } catch (error) {
        return {
          found: false,
          error: error instanceof Error ? error.message : "Failed to fetch",
          content: null,
        };
      }
    }),

  // Analyze crawler permissions
  analyzePermissions: protectedProcedure
    .input(z.object({ siteId: z.string() }))
    .query(async ({ ctx, input }) => {
      const site = await ctx.db.query.sites.findFirst({
        where: and(
          eq(sites.id, input.siteId),
          eq(sites.userId, ctx.session.user.id)
        ),
      });

      if (!site) throw new TRPCError({ code: "NOT_FOUND" });

      try {
        const response = await fetch(`https://${site.domain}/robots.txt`, {
          headers: { "User-Agent": "PropIntel-Analyzer/1.0" },
          signal: AbortSignal.timeout(10000),
        });

        if (!response.ok) {
          // No robots.txt = all allowed
          return AI_CRAWLER_USER_AGENTS.map((crawler) => ({
            ...crawler,
            status: "allowed" as const,
          }));
        }

        const content = await response.text();
        const parsed = parseRobotsTxt(content);

        return AI_CRAWLER_USER_AGENTS.map((crawler) => ({
          ...crawler,
          status: isCrawlerAllowed(parsed, crawler.userAgent),
        }));
      } catch {
        // On error, return unknown status
        return AI_CRAWLER_USER_AGENTS.map((crawler) => ({
          ...crawler,
          status: "unknown" as const,
        }));
      }
    }),
});
```

### `src/components/robots/robots-viewer.tsx`

Display raw robots.txt content.

```typescript
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
```

### `src/components/robots/llms-viewer.tsx`

Display llms.txt content.

```typescript
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

export function LlmsViewer({ content, found, error, isLoading, onRefresh }: LlmsViewerProps) {
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
```

### `src/components/robots/permission-matrix.tsx`

Table showing crawler permissions.

```typescript
"use client";

import { Check, X, AlertTriangle, HelpCircle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

type PermissionStatus = "allowed" | "blocked" | "partial" | "unknown";

interface CrawlerPermission {
  id: string;
  name: string;
  company: string;
  status: PermissionStatus;
}

interface PermissionMatrixProps {
  permissions: CrawlerPermission[] | undefined;
  isLoading: boolean;
}

const statusConfig: Record<PermissionStatus, { icon: React.ElementType; label: string; variant: "default" | "destructive" | "outline" | "secondary" }> = {
  allowed: { icon: Check, label: "Allowed", variant: "default" },
  blocked: { icon: X, label: "Blocked", variant: "destructive" },
  partial: { icon: AlertTriangle, label: "Partial", variant: "secondary" },
  unknown: { icon: HelpCircle, label: "Unknown", variant: "outline" },
};

export function PermissionMatrix({ permissions, isLoading }: PermissionMatrixProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>AI Crawler Permissions</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    );
  }

  // Group by company
  const byCompany = (permissions ?? []).reduce((acc, p) => {
    if (!acc[p.company]) acc[p.company] = [];
    acc[p.company].push(p);
    return acc;
  }, {} as Record<string, CrawlerPermission[]>);

  return (
    <Card>
      <CardHeader>
        <CardTitle>AI Crawler Permissions</CardTitle>
        <CardDescription>
          Based on your robots.txt configuration
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Crawler</TableHead>
              <TableHead>Company</TableHead>
              <TableHead className="text-center">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Object.entries(byCompany).map(([company, crawlers]) =>
              crawlers.map((crawler, idx) => {
                const config = statusConfig[crawler.status];
                const Icon = config.icon;
                return (
                  <TableRow key={crawler.id}>
                    <TableCell className="font-medium">{crawler.name}</TableCell>
                    <TableCell>{idx === 0 ? company : ""}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant={config.variant} className="gap-1">
                        <Icon className="h-3 w-3" />
                        {config.label}
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
```

### `src/app/dashboard/robots/page.tsx`

Robots.txt analysis page.

```typescript
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
```

## Files to Modify

### `src/server/api/root.ts`

Add robotsRouter:

```typescript
import { robotsRouter } from "./routers/robots";

export const appRouter = createTRPCRouter({
  post: postRouter,
  site: siteRouter,
  url: urlRouter,
  analytics: analyticsRouter,
  tracking: trackingRouter,
  robots: robotsRouter,  // Add this
});
```

## Acceptance Criteria

- [ ] Robots.txt fetched and displayed for site
- [ ] Robots.txt syntax displayed with proper formatting
- [ ] LLMs.txt fetched if available (graceful 404 handling)
- [ ] Permission matrix shows status for each AI crawler
- [ ] Status badges: green (allowed), red (blocked), yellow (partial), gray (unknown)
- [ ] Refresh button fetches latest version
- [ ] Error states for unreachable sites
- [ ] Loading skeletons during fetch
- [ ] Grouped by company in permission matrix
