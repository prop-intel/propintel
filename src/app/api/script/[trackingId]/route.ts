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
