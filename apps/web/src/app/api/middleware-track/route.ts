import { type NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { sites, siteUrls, crawlerVisits } from "@/server/db/schema";
import { eq, and } from "drizzle-orm";
import { detectCrawler } from "@/lib/crawler-detection";

interface TrackRequest {
  trackingId: string;
  userAgent: string;
  path?: string;
  ip?: string;
}

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as TrackRequest;
    const { trackingId, userAgent, path, ip } = body;

    if (!trackingId || !userAgent) {
      return NextResponse.json(
        { tracked: false, error: "Missing required fields" },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const site = await db.query.sites.findFirst({
      where: eq(sites.trackingId, trackingId),
    });

    if (!site) {
      return NextResponse.json(
        { tracked: false, error: "Invalid tracking ID" },
        { status: 404, headers: CORS_HEADERS }
      );
    }

    const crawlerId = detectCrawler(userAgent);

    if (!crawlerId) {
      return NextResponse.json({ tracked: false }, { headers: CORS_HEADERS });
    }

    // Find or create URL record
    let urlRecord = await db.query.siteUrls.findFirst({
      where: and(eq(siteUrls.siteId, site.id), eq(siteUrls.path, path || "/")),
    });

    if (!urlRecord) {
      const [newUrl] = await db
        .insert(siteUrls)
        .values({
          siteId: site.id,
          path: path || "/",
        })
        .returning();
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
      path: path || "/",
      ipAddress: ip || null,
      source: "middleware",
    });

    return NextResponse.json(
      { tracked: true, crawlerId },
      { headers: CORS_HEADERS }
    );
  } catch (error) {
    console.error("Middleware track error:", error);
    return NextResponse.json(
      { tracked: false, error: "Internal error" },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
