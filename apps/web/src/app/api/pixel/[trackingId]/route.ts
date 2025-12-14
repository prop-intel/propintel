import { type NextRequest, NextResponse } from "next/server";
import { trackVisit } from "@/lib/track-visit";

/**
 * Pixel Beacon Endpoint
 *
 * This endpoint serves a 1x1 transparent GIF and detects AI crawlers from the
 * request's User-Agent header. Unlike the JavaScript-based beacon, this works
 * with crawlers that don't execute JavaScript because:
 *
 * 1. User embeds: <img src="https://brand-sight.com/api/pixel/TRACKING_ID" />
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

    const result = await trackVisit({
      trackingId,
      userAgent,
      path,
      ipAddress,
      source: "pixel",
    });

    // Return 1x1 transparent GIF (always return pixel to avoid broken images)
    return new NextResponse(TRANSPARENT_GIF, {
      status: 200,
      headers: {
        "Content-Type": "image/gif",
        "Cache-Control": "no-store, no-cache, must-revalidate",
        "Pragma": "no-cache",
        "Expires": "0",
        "X-Crawler-Detected": result.crawlerId ?? "none",
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
