import * as cheerio from 'cheerio';
import robotsParser from 'robots-parser';
import {
  type Job,
  type CrawledPage,
  type SchemaOrgData,
  type ImageData,
  type HeadingStructure,
  type HreflangLink,
  type CrawlConfig,
} from '../types';
import { uploadHtmlSnapshot, uploadPageData } from './s3';

// ===================
// Crawler State
// ===================

interface CrawlState {
  visited: Set<string>;
  queue: Array<{ url: string; depth: number }>;
  pages: CrawledPage[];
  startTime: number;
  robotsRules: ReturnType<typeof robotsParser> | null;
  contentHashes: Set<string>;
}

// ===================
// Main Crawler Function (HTTP-based, no Puppeteer)
// ===================

export async function crawlSite(job: Job): Promise<CrawledPage[]> {
  const config = job.config;
  const baseUrl = new URL(job.targetUrl);
  const tenantId = job.tenantId ?? job.userId;

  const state: CrawlState = {
    visited: new Set(),
    queue: [{ url: job.targetUrl, depth: 0 }],
    pages: [],
    startTime: Date.now(),
    robotsRules: null,
    contentHashes: new Set(),
  };

  try {
    // Fetch and parse robots.txt
    if (config.respectRobotsTxt) {
      state.robotsRules = await fetchRobotsTxt(baseUrl.origin, config.userAgent);
    }

    // Get adaptive crawl delay from robots.txt
    let crawlDelay = config.crawlDelay;
    if (state.robotsRules) {
      const robotsDelay = state.robotsRules.getCrawlDelay(config.userAgent);
      if (robotsDelay) {
        crawlDelay = Math.max(crawlDelay, robotsDelay * 1000);
      }
    }

    // Process queue
    while (state.queue.length > 0) {
      // Check time limit
      if (Date.now() - state.startTime > config.maxJobDuration) {
        console.log('Job duration limit reached');
        break;
      }

      // Check page limit
      if (state.pages.length >= config.maxPages) {
        console.log('Page limit reached');
        break;
      }

      const { url, depth } = state.queue.shift()!;

      // Skip if already visited
      if (state.visited.has(url)) continue;

      // Check depth limit
      if (depth > config.maxDepth) continue;

      // Check robots.txt
      if (state.robotsRules && !state.robotsRules.isAllowed(url, config.userAgent)) {
        console.log(`Blocked by robots.txt: ${url}`);
        continue;
      }

      // Check URL exclusions
      if (shouldExcludeUrl(url, config.urlExclusions)) {
        console.log(`Excluded by pattern: ${url}`);
        continue;
      }

      state.visited.add(url);

      try {
        // Crawl page using HTTP fetch
        const page = await crawlPage(url, config, tenantId, job.id);

        if (page) {
          // Check for duplicate content
          const contentHash = hashContent(page.title || '' + page.metaDescription || '');
          if (config.skipExactDuplicates && state.contentHashes.has(contentHash)) {
            console.log(`Skipping duplicate content: ${url}`);
            continue;
          }
          state.contentHashes.add(contentHash);

          state.pages.push(page);

          // Extract and queue internal links
          if (depth < config.maxDepth) {
            const internalLinks = page.links.internal.filter(link => {
              try {
                const linkUrl = new URL(link, baseUrl.origin);
                return linkUrl.hostname === baseUrl.hostname;
              } catch {
                return false;
              }
            });

            for (const link of internalLinks) {
              if (!state.visited.has(link)) {
                state.queue.push({ url: link, depth: depth + 1 });
              }
            }
          }
        }

        // Respect crawl delay
        await delay(crawlDelay);

      } catch (error) {
        console.error(`Error crawling ${url}:`, error);
        
        // Check for blocking/CAPTCHA
        const errorMessage = (error as Error).message;
        if (errorMessage.includes('CAPTCHA') || errorMessage.includes('blocked') || errorMessage.includes('403')) {
          throw new Error(`Site blocked access: ${errorMessage}`);
        }
      }
    }

    // Save crawled data to S3
    await uploadPageData(tenantId, job.id, state.pages);

    return state.pages;

  } catch (error) {
    console.error('Crawl error:', error);
    throw error;
  }
}

// ===================
// Single Page Crawler (HTTP-based)
// ===================

async function crawlPage(
  url: string,
  config: CrawlConfig,
  tenantId: string,
  jobId: string
): Promise<CrawledPage | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), config.pageTimeout);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': config.userAgent,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      redirect: 'follow',
    });

    clearTimeout(timeoutId);

    const statusCode = response.status;

    // Handle non-success responses
    if (statusCode >= 400) {
      console.log(`HTTP ${statusCode} for ${url}`);
      return {
        url,
        statusCode,
        contentType: response.headers.get('content-type') || '',
        wordCount: 0,
        schemas: [],
        links: { internal: [], external: [] },
        images: [],
        headings: { h1: [], h2: [], h3: [], h4: [], h5: [], h6: [] },
        robotsMeta: { noindex: false, nofollow: false },
        hreflangAlternates: [],
        loadTimeMs: 0,
        crawledAt: new Date().toISOString(),
        warnings: [`HTTP ${statusCode} response`],
      };
    }

    // Get HTML content
    const html = await response.text();
    const $ = cheerio.load(html);

    // Check for canonical
    const canonicalUrl = $('link[rel="canonical"]').attr('href');
    if (config.followCanonical && canonicalUrl && canonicalUrl !== url) {
      console.log(`Canonical differs: ${url} -> ${canonicalUrl}`);
    }

    // Extract metadata
    const title = $('title').text().trim();
    const metaDescription = $('meta[name="description"]').attr('content')?.trim();
    const h1 = $('h1').first().text().trim();
    const language = $('html').attr('lang') || detectLanguageFromContent($);

    // Check robots meta
    const robotsMeta = {
      noindex: $('meta[name="robots"]').attr('content')?.includes('noindex') || false,
      nofollow: $('meta[name="robots"]').attr('content')?.includes('nofollow') || false,
    };

    // Extract schemas
    const schemas = extractSchemas($);

    // Extract links
    const links = extractLinks($, url);

    // Extract images
    const images = extractImages($);

    // Extract headings
    const headings = extractHeadings($);

    // Extract hreflang
    const hreflangAlternates = extractHreflang($);

    // Calculate word count (text content only)
    const textContent = $('body').text().replace(/\s+/g, ' ').trim();
    const wordCount = textContent.split(' ').filter(w => w.length > 0).length;

    // Estimate load time (we can't measure actual load time without browser)
    const loadTimeMs = html.length / 1000; // Rough estimate based on content size

    // Check for low content warning
    const warnings: string[] = [];
    if (wordCount < 100) {
      warnings.push('Low content: less than 100 words');
    }

    // Save HTML snapshot
    let htmlSnapshot: string | undefined;
    try {
      htmlSnapshot = await uploadHtmlSnapshot(tenantId, jobId, url, html);
    } catch (error) {
      console.error('Failed to save HTML snapshot:', error);
    }

    // Get last modified
    const lastModified = response.headers.get('last-modified');

    return {
      url,
      canonicalUrl: canonicalUrl || undefined,
      statusCode,
      contentType: response.headers.get('content-type') || 'text/html',
      title: title || undefined,
      metaDescription: metaDescription || undefined,
      h1: h1 || undefined,
      wordCount,
      language: language || undefined,
      lastModified: lastModified || undefined,
      schemas,
      links,
      images,
      headings,
      robotsMeta,
      hreflangAlternates,
      loadTimeMs,
      htmlSnapshot,
      crawledAt: new Date().toISOString(),
      warnings,
    };

  } catch (error) {
    clearTimeout(timeoutId);
    
    if ((error as Error).name === 'AbortError') {
      throw new Error(`Request timeout for ${url}`);
    }
    
    throw error;
  }
}

// ===================
// Extraction Helpers (same as crawler.ts)
// ===================

function extractSchemas($: cheerio.CheerioAPI): SchemaOrgData[] {
  const schemas: SchemaOrgData[] = [];

  // JSON-LD schemas
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const content = $(el).html();
      if (content) {
        const data = JSON.parse(content) as Record<string, unknown> | Record<string, unknown>[];
        const items = Array.isArray(data) ? data : [data];

        for (const item of items) {
          schemas.push({
            type: (item['@type'] as string) || 'Unknown',
            properties: item,
            isValid: true,
          });
        }
      }
    } catch (error) {
      schemas.push({
        type: 'Invalid',
        properties: {},
        isValid: false,
        errors: [(error as Error).message],
      });
    }
  });

  // Microdata (basic extraction)
  $('[itemtype]').each((_, el) => {
    const type = $(el).attr('itemtype');
    if (type) {
      schemas.push({
        type: type.split('/').pop() || type,
        properties: { _source: 'microdata' },
        isValid: true,
      });
    }
  });

  return schemas;
}

function extractLinks($: cheerio.CheerioAPI, baseUrl: string): { internal: string[]; external: string[] } {
  const internal = new Set<string>();
  const external = new Set<string>();
  const base = new URL(baseUrl);

  $('a[href]').each((_, el) => {
    const href = $(el).attr('href');
    if (!href || href.startsWith('#') || href.startsWith('javascript:') || href.startsWith('mailto:')) {
      return;
    }

    try {
      const url = new URL(href, baseUrl);
      url.hash = ''; // Remove fragment
      const normalized = url.toString();

      if (url.hostname === base.hostname) {
        internal.add(normalized);
      } else {
        external.add(normalized);
      }
    } catch {
      // Invalid URL, skip
    }
  });

  return {
    internal: Array.from(internal),
    external: Array.from(external),
  };
}

function extractImages($: cheerio.CheerioAPI): ImageData[] {
  const images: ImageData[] = [];

  $('img').each((_, el) => {
    const src = $(el).attr('src');
    if (src) {
      images.push({
        src,
        alt: $(el).attr('alt'),
        width: parseInt($(el).attr('width') || '0', 10) || undefined,
        height: parseInt($(el).attr('height') || '0', 10) || undefined,
        hasAlt: !!$(el).attr('alt'),
      });
    }
  });

  return images;
}

function extractHeadings($: cheerio.CheerioAPI): HeadingStructure {
  return {
    h1: $('h1').map((_, el) => $(el).text().trim()).get(),
    h2: $('h2').map((_, el) => $(el).text().trim()).get(),
    h3: $('h3').map((_, el) => $(el).text().trim()).get(),
    h4: $('h4').map((_, el) => $(el).text().trim()).get(),
    h5: $('h5').map((_, el) => $(el).text().trim()).get(),
    h6: $('h6').map((_, el) => $(el).text().trim()).get(),
  };
}

function extractHreflang($: cheerio.CheerioAPI): HreflangLink[] {
  const alternates: HreflangLink[] = [];

  $('link[rel="alternate"][hreflang]').each((_, el) => {
    const lang = $(el).attr('hreflang');
    const href = $(el).attr('href');
    if (lang && href) {
      alternates.push({ lang, url: href });
    }
  });

  return alternates;
}

function detectLanguageFromContent($: cheerio.CheerioAPI): string | undefined {
  // Simple heuristic - check for common language patterns
  const text = $('body').text().toLowerCase();
  
  if (/\b(the|and|is|are|this|that|for|with)\b/.test(text)) return 'en';
  if (/\b(el|la|los|las|que|con|por)\b/.test(text)) return 'es';
  if (/\b(le|la|les|que|avec|pour)\b/.test(text)) return 'fr';
  if (/\b(der|die|das|und|ist|mit)\b/.test(text)) return 'de';
  
  return undefined;
}

// ===================
// Utility Functions
// ===================

async function fetchRobotsTxt(
  origin: string,
  _userAgent: string
): Promise<ReturnType<typeof robotsParser> | null> {
  try {
    const response = await fetch(`${origin}/robots.txt`);
    if (response.ok) {
      const text = await response.text();
      return robotsParser(`${origin}/robots.txt`, text);
    }
  } catch {
    // No robots.txt or error fetching
  }
  return null;
}

function shouldExcludeUrl(url: string, exclusions: string[]): boolean {
  const path = new URL(url).pathname.toLowerCase();
  return exclusions.some(pattern => path.includes(pattern.toLowerCase()));
}

function hashContent(content: string): string {
  // Simple hash for duplicate detection
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return hash.toString(36);
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

