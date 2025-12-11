import { type NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { sites, siteUrls, crawlerVisits } from "../../../../../shared/db/schema";
import { eq, and } from "drizzle-orm";
import { detectCrawler } from "@/lib/crawler-detection";

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
