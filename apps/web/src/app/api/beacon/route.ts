import { type NextRequest, NextResponse } from "next/server";
import { trackVisit } from "@/lib/track-visit";

// 1x1 transparent GIF
const TRANSPARENT_GIF = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
  "base64"
);

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const trackingId = searchParams.get("tid");
    const userAgent =
      searchParams.get("ua") ?? request.headers.get("user-agent") ?? "";
    const path = searchParams.get("path") ?? "/";
    const ipAddress = request.headers.get("x-forwarded-for")?.split(",")[0] ?? null;

    if (!trackingId) {
      return new NextResponse(null, { status: 400 });
    }

    const result = await trackVisit({
      trackingId,
      userAgent,
      path,
      ipAddress,
      source: "beacon",
    });

    if (!result.siteId) {
      return new NextResponse(null, { status: 404 });
    }

    // Return 1x1 transparent GIF
    return new NextResponse(TRANSPARENT_GIF, {
      status: 200,
      headers: {
        "Content-Type": "image/gif",
        "Cache-Control": "no-store, no-cache, must-revalidate",
        "X-Crawler-Detected": result.crawlerId ?? "none",
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
