import { type NextRequest, NextResponse } from "next/server";
import { trackVisit } from "@/lib/track-visit";

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

    const result = await trackVisit({
      trackingId,
      userAgent,
      path: path || "/",
      ipAddress: ip || null,
      source: "middleware",
    });

    if (!result.siteId) {
      return NextResponse.json(
        { tracked: false, error: "Invalid tracking ID" },
        { status: 404, headers: CORS_HEADERS }
      );
    }

    return NextResponse.json(
      { tracked: result.tracked, crawlerId: result.crawlerId },
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
