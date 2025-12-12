import { type NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { sites, siteUrls, crawlerVisits } from "@/server/db/schema";
import { eq, and } from "drizzle-orm";
import { detectCrawler } from "@/lib/crawler-detection";

/**
 * Pixel Beacon Endpoint
 *
 * This endpoint serves a 1x1 transparent GIF and detects AI crawlers from the
 * request's User-Agent header. Unlike the JavaScript-based beacon, this works
 * with crawlers that don't execute JavaScript because:
 *
 * 1. User embeds: <img src="https://propintel.vercel.app/api/pixel/TRACKING_ID" />
 * 2. When ANY client (browser or crawler) requests the page, they also fetch the image
 * 3. The image request includes the client's real User-Agent header
 * 4. We detect crawlers server-side and record the visit
 *
 * This is the recommended approach for tracking AI crawlers.
 */

interface RouteParams {
  params: Promise<{ trackingId: string }>;
}

// 1x1 transparent GIF
const TRANSPARENT_GIF = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
  "base64"
);

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { trackingId } = await params;
    const userAgent = request.headers.get("user-agent") ?? "";
    const referer = request.headers.get("referer") ?? "";
    const ipAddress = request.headers.get("x-forwarded-for")?.split(",")[0] ?? null;

    // Extract path from referer URL
    let path = "/";
    if (referer) {
      try {
        const refererUrl = new URL(referer);
        path = refererUrl.pathname;
      } catch {
        // Invalid referer URL, use default
      }
    }

    // Find site by tracking ID
    const site = await db.query.sites.findFirst({
      where: eq(sites.trackingId, trackingId),
    });

    if (!site) {
      // Return pixel anyway to avoid broken images, but don't track
      return new NextResponse(TRANSPARENT_GIF, {
        status: 200,
        headers: {
          "Content-Type": "image/gif",
          "Cache-Control": "no-store, no-cache, must-revalidate",
        },
      });
    }

    // Detect crawler from the actual request User-Agent
    const crawlerId = detectCrawler(userAgent);

    // Only record if it's a known AI crawler
    if (crawlerId) {
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
      if (urlRecord) {
        await db
          .update(siteUrls)
          .set({
            lastCrawled: new Date(),
            crawlCount: (urlRecord.crawlCount ?? 0) + 1,
          })
          .where(eq(siteUrls.id, urlRecord.id));
      }

      // Record the visit
      await db.insert(crawlerVisits).values({
        siteId: site.id,
        urlId: urlRecord?.id,
        crawlerId,
        userAgent,
        path,
        ipAddress,
        source: "pixel",
      });
    }

    // Return 1x1 transparent GIF
    return new NextResponse(TRANSPARENT_GIF, {
      status: 200,
      headers: {
        "Content-Type": "image/gif",
        "Cache-Control": "no-store, no-cache, must-revalidate",
        // Prevent caching to ensure every request is tracked
        "Pragma": "no-cache",
        "Expires": "0",
        // Debug header to indicate if tracking occurred (for testing)
        "X-Crawler-Detected": crawlerId ?? "none",
      },
    });
  } catch (error) {
    console.error("Pixel beacon error:", error);
    // Still return the pixel to avoid broken images
    return new NextResponse(TRANSPARENT_GIF, {
      status: 200,
      headers: {
        "Content-Type": "image/gif",
        "Cache-Control": "no-store",
      },
    });
  }
}
