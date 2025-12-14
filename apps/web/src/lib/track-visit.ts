import { db } from "@/server/db";
import {
  sites,
  siteUrls,
  crawlerVisits,
  unmatchedUserAgents,
} from "@/server/db/schema";
import { eq, and } from "drizzle-orm";
import { detectCrawler } from "@/lib/crawler-detection";

export type TrackSource = "pixel" | "middleware" | "beacon";

export interface TrackVisitParams {
  trackingId: string;
  userAgent: string;
  path: string;
  ipAddress: string | null;
  source: TrackSource;
}

export interface TrackVisitResult {
  siteId: string | null;
  tracked: boolean;
  crawlerId: string | null;
  isUnmatched: boolean;
}

export async function trackVisit(
  params: TrackVisitParams
): Promise<TrackVisitResult> {
  const { trackingId, userAgent, path, ipAddress, source } = params;

  // Find site by tracking ID
  const site = await db.query.sites.findFirst({
    where: eq(sites.trackingId, trackingId),
  });

  if (!site) {
    return {
      siteId: null,
      tracked: false,
      crawlerId: null,
      isUnmatched: false,
    };
  }

  // Detect crawler from user agent
  const crawlerId = detectCrawler(userAgent);

  if (crawlerId) {
    // Known crawler detected - record the visit
    // Find or create URL record
    let urlRecord = await db.query.siteUrls.findFirst({
      where: and(eq(siteUrls.siteId, site.id), eq(siteUrls.path, path)),
    });

    if (!urlRecord) {
      const [newUrl] = await db
        .insert(siteUrls)
        .values({
          siteId: site.id,
          path,
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
      path,
      ipAddress,
      source,
    });

    return {
      siteId: site.id,
      tracked: true,
      crawlerId,
      isUnmatched: false,
    };
  } else {
    // No crawler detected - record as unmatched for review
    await db.insert(unmatchedUserAgents).values({
      siteId: site.id,
      userAgent,
      path,
      ipAddress,
      source,
    });

    return {
      siteId: site.id,
      tracked: false,
      crawlerId: null,
      isUnmatched: true,
    };
  }
}
