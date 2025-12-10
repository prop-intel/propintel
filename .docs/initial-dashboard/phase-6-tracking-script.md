# Phase 6: Tracking Script

## Overview

Generate embeddable tracking scripts, create the beacon API endpoint, and implement script testing functionality.

## Dependencies

- Phase 1 (database schema)
- Phase 2 (site with tracking_id)

## Files to Create

### `src/lib/crawler-detection.ts`

Utility for detecting AI crawlers from user agent.

```typescript
// Crawler patterns for detection
export const CRAWLER_PATTERNS = [
  { id: "gptbot", pattern: /GPTBot/i },
  { id: "chatgpt-user", pattern: /ChatGPT-User/i },
  { id: "oai-searchbot", pattern: /OAI-SearchBot/i },
  { id: "claudebot", pattern: /ClaudeBot/i },
  { id: "claude-web", pattern: /Claude-Web/i },
  { id: "claude-searchbot", pattern: /Claude-SearchBot/i },
  { id: "anthropic-ai", pattern: /anthropic-ai/i },
  { id: "perplexitybot", pattern: /PerplexityBot/i },
  { id: "perplexity-user", pattern: /Perplexity-User/i },
  { id: "googlebot", pattern: /Googlebot/i },
  { id: "google-extended", pattern: /Google-Extended/i },
  { id: "bingbot", pattern: /bingbot/i },
  { id: "bytespider", pattern: /Bytespider/i },
  { id: "cohere-ai", pattern: /cohere-ai/i },
  { id: "meta-externalagent", pattern: /Meta-ExternalAgent/i },
  { id: "applebot-extended", pattern: /Applebot-Extended/i },
] as const;

export function detectCrawler(userAgent: string): string | null {
  for (const crawler of CRAWLER_PATTERNS) {
    if (crawler.pattern.test(userAgent)) {
      return crawler.id;
    }
  }
  return null;
}

export function isAiCrawler(userAgent: string): boolean {
  return detectCrawler(userAgent) !== null;
}
```

### `src/app/api/beacon/route.ts`

API endpoint for receiving crawler visit beacons.

```typescript
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { sites, siteUrls, crawlerVisits } from "@/server/db/schema";
import { eq, and } from "drizzle-orm";
import { detectCrawler } from "@/lib/crawler-detection";

export const runtime = "edge";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const trackingId = searchParams.get("tid");
    const userAgent = searchParams.get("ua") ?? request.headers.get("user-agent") ?? "";
    const path = searchParams.get("path") ?? "/";

    if (!trackingId) {
      return new NextResponse(null, { status: 400 });
    }

    // Find site by tracking ID
    const site = await db.query.sites.findFirst({
      where: eq(sites.trackingId, trackingId),
    });

    if (!site) {
      return new NextResponse(null, { status: 404 });
    }

    // Detect crawler
    const crawlerId = detectCrawler(userAgent);

    // Only record if it's a known AI crawler
    if (!crawlerId) {
      return new NextResponse(null, { status: 204 });
    }

    // Find or create URL record
    let urlRecord = await db.query.siteUrls.findFirst({
      where: and(
        eq(siteUrls.siteId, site.id),
        eq(siteUrls.path, path)
      ),
    });

    if (!urlRecord) {
      const [newUrl] = await db.insert(siteUrls).values({
        siteId: site.id,
        path,
      }).returning();
      urlRecord = newUrl;
    }

    // Update URL crawl stats
    await db
      .update(siteUrls)
      .set({
        lastCrawled: new Date(),
        crawlCount: (urlRecord?.crawlCount ?? 0) + 1,
      })
      .where(eq(siteUrls.id, urlRecord!.id));

    // Record the visit
    await db.insert(crawlerVisits).values({
      siteId: site.id,
      urlId: urlRecord?.id,
      crawlerId,
      userAgent,
      path,
      ipAddress: request.headers.get("x-forwarded-for")?.split(",")[0] ?? null,
    });

    // Return 1x1 transparent GIF
    const pixel = Buffer.from(
      "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
      "base64"
    );

    return new NextResponse(pixel, {
      status: 200,
      headers: {
        "Content-Type": "image/gif",
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    });
  } catch (error) {
    console.error("Beacon error:", error);
    return new NextResponse(null, { status: 500 });
  }
}

// Also support POST for flexibility
export async function POST(request: NextRequest) {
  return GET(request);
}
```

### `src/app/api/script/[trackingId]/route.ts`

Serves the tracking script dynamically.

```typescript
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { sites } from "@/server/db/schema";
import { eq } from "drizzle-orm";

export const runtime = "edge";

interface RouteParams {
  params: Promise<{ trackingId: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { trackingId } = await params;

  // Verify tracking ID exists
  const site = await db.query.sites.findFirst({
    where: eq(sites.trackingId, trackingId),
  });

  if (!site) {
    return new NextResponse("// Invalid tracking ID", {
      status: 404,
      headers: { "Content-Type": "application/javascript" },
    });
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? request.nextUrl.origin;

  const script = `
(function(){
  var ua=navigator.userAgent;
  var bots=['GPTBot','ChatGPT-User','OAI-SearchBot','ClaudeBot','Claude-Web','Claude-SearchBot','anthropic-ai','PerplexityBot','Perplexity-User','Googlebot','Google-Extended','bingbot','Bytespider','cohere-ai','Meta-ExternalAgent','Applebot-Extended'];
  for(var i=0;i<bots.length;i++){
    if(ua.indexOf(bots[i])!==-1){
      var img=new Image();
      img.src='${baseUrl}/api/beacon?tid=${trackingId}&ua='+encodeURIComponent(ua)+'&path='+encodeURIComponent(location.pathname)+'&t='+Date.now();
      break;
    }
  }
})();
`.trim();

  return new NextResponse(script, {
    status: 200,
    headers: {
      "Content-Type": "application/javascript",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
```

### `src/server/api/routers/tracking.ts`

tRPC router for tracking management.

```typescript
import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { sites } from "@/server/db/schema";
import { eq, and } from "drizzle-orm";
import { nanoid } from "nanoid";
import { TRPCError } from "@trpc/server";

export const trackingRouter = createTRPCRouter({
  // Get tracking script for site
  getScript: protectedProcedure
    .input(z.object({ siteId: z.string() }))
    .query(async ({ ctx, input }) => {
      const site = await ctx.db.query.sites.findFirst({
        where: and(
          eq(sites.id, input.siteId),
          eq(sites.userId, ctx.session.user.id)
        ),
      });

      if (!site) throw new TRPCError({ code: "NOT_FOUND" });

      const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://your-domain.com";

      return {
        trackingId: site.trackingId,
        inlineScript: `<script>
(function(){
  var ua=navigator.userAgent;
  var bots=['GPTBot','ChatGPT-User','OAI-SearchBot','ClaudeBot','Claude-Web','Claude-SearchBot','anthropic-ai','PerplexityBot','Perplexity-User','Googlebot','Google-Extended','bingbot','Bytespider','cohere-ai','Meta-ExternalAgent','Applebot-Extended'];
  for(var i=0;i<bots.length;i++){
    if(ua.indexOf(bots[i])!==-1){
      var img=new Image();
      img.src='${baseUrl}/api/beacon?tid=${site.trackingId}&ua='+encodeURIComponent(ua)+'&path='+encodeURIComponent(location.pathname)+'&t='+Date.now();
      break;
    }
  }
})();
</script>`,
        externalScript: `<script src="${baseUrl}/api/script/${site.trackingId}"></script>`,
      };
    }),

  // Test script installation
  testInstallation: protectedProcedure
    .input(z.object({ siteId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const site = await ctx.db.query.sites.findFirst({
        where: and(
          eq(sites.id, input.siteId),
          eq(sites.userId, ctx.session.user.id)
        ),
      });

      if (!site) throw new TRPCError({ code: "NOT_FOUND" });

      try {
        // Fetch the site's homepage
        const response = await fetch(`https://${site.domain}`, {
          headers: { "User-Agent": "PropIntel-Verification/1.0" },
          signal: AbortSignal.timeout(10000),
        });

        if (!response.ok) {
          return { installed: false, error: `Site returned ${response.status}` };
        }

        const html = await response.text();
        const hasScript = html.includes(site.trackingId);

        return {
          installed: hasScript,
          error: hasScript ? null : "Tracking script not found on page",
        };
      } catch (error) {
        return {
          installed: false,
          error: error instanceof Error ? error.message : "Failed to fetch site",
        };
      }
    }),

  // Regenerate tracking ID
  regenerateTrackingId: protectedProcedure
    .input(z.object({ siteId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const newTrackingId = nanoid(16);

      const [site] = await ctx.db
        .update(sites)
        .set({ trackingId: newTrackingId, updatedAt: new Date() })
        .where(and(
          eq(sites.id, input.siteId),
          eq(sites.userId, ctx.session.user.id)
        ))
        .returning();

      if (!site) throw new TRPCError({ code: "NOT_FOUND" });

      return { trackingId: newTrackingId };
    }),
});
```

### `src/app/dashboard/tracking/page.tsx`

Tracking script management page.

```typescript
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
```

## Files to Modify

### `src/server/api/root.ts`

Add trackingRouter:

```typescript
import { trackingRouter } from "./routers/tracking";

export const appRouter = createTRPCRouter({
  post: postRouter,
  site: siteRouter,
  url: urlRouter,
  analytics: analyticsRouter,
  tracking: trackingRouter,  // Add this
});
```

### `src/env.js`

Add NEXT_PUBLIC_APP_URL:

```typescript
// In client section
client: {
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),
},

// In runtimeEnv
runtimeEnv: {
  // ... existing vars
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
},
```

## Acceptance Criteria

- [ ] Script tag generated with unique tracking ID
- [ ] Both inline and external script options available
- [ ] Copy to clipboard works for both script types
- [ ] Beacon endpoint receives and records visits
- [ ] Crawler detection correctly identifies all 16 AI crawlers
- [ ] Non-crawler visits are ignored (return 204)
- [ ] Test installation provides accurate feedback
- [ ] Script is minified for production
- [ ] External script has appropriate caching headers
- [ ] Beacon returns 1x1 transparent pixel
