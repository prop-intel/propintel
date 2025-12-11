/**
 * ECS Render Task Entry Point
 *
 * This runs inside the ECS Fargate container to render SPAs
 * using Playwright and save the results to S3.
 */

import { chromium, type Browser, type Page } from 'playwright';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { type CrawledPage } from '../types';
import { updateJob } from '../lib/db';

// ===================
// Configuration
// ===================

const S3_BUCKET = process.env.S3_BUCKET || '';
const AWS_REGION = process.env.AWS_REGION || 'us-west-2';

interface RenderConfig {
  jobId: string;
  userId: string; // Changed from tenantId
  targetUrl: string;
  maxPages: number;
  viewport: { width: number; height: number };
  waitForSelector?: string;
  waitForTimeout: number;
}

// ===================
// Clients
// ===================

const s3Client = new S3Client({ region: AWS_REGION });

// ===================
// Main Entry Point
// ===================

async function main(): Promise<void> {
  console.log('[Renderer] Starting ECS render task...');

  // Parse configuration from environment
  const configJson = process.env.CONFIG;
  if (!configJson) {
    throw new Error('CONFIG environment variable not set');
  }

  const config = JSON.parse(configJson) as RenderConfig;
  console.log(`[Renderer] Job: ${config.jobId}, URL: ${config.targetUrl}`);

  let browser: Browser | undefined;

  try {
    // Update job status
    await updateJobPhase(config.userId, config.jobId, 'rendering');

    // Launch browser
    browser = await chromium.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
      ],
    });

    // Render pages
    const pages = await renderSite(browser, config);
    console.log(`[Renderer] Rendered ${pages.length} pages`);

    // Save results to S3
    await saveResults(config.userId, config.jobId, pages);

    // Update job status
    await updateJobPhase(config.userId, config.jobId, 'analyzing');

    console.log('[Renderer] Render task completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('[Renderer] Error:', error);

    try {
      await updateJob(config.userId, config.jobId, {
        status: 'failed',
        error: {
          code: 'RENDER_FAILED',
          message: (error as Error).message,
          details: (error as Error).stack,
        },
        'progress.currentPhase': 'error',
      });
    } catch (updateError) {
      console.error('[Renderer] Failed to update job status:', updateError);
    }

    process.exit(1);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

// ===================
// Job Status Update
// ===================

async function updateJobPhase(userId: string, jobId: string, phase: string): Promise<void> {
  await updateJob(userId, jobId, {
    'progress.currentPhase': phase,
  });
}

// ===================
// Rendering Functions
// ===================

async function renderSite(browser: Browser, config: RenderConfig): Promise<CrawledPage[]> {
  const pages: CrawledPage[] = [];
  const visited = new Set<string>();
  const queue: string[] = [config.targetUrl];

  const context = await browser.newContext({
    viewport: config.viewport,
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  });

  while (queue.length > 0 && pages.length < config.maxPages) {
    const url = queue.shift()!;

    if (visited.has(url)) {
      continue;
    }
    visited.add(url);

    try {
      const pageData = await renderPage(context, url, config);
      pages.push(pageData);

      // Extract internal links for crawling
      const baseUrl = new URL(config.targetUrl);
      for (const link of pageData.links.internal) {
        try {
          const linkUrl = new URL(link, url);
          if (linkUrl.hostname === baseUrl.hostname && !visited.has(linkUrl.href)) {
            queue.push(linkUrl.href);
          }
        } catch {
          // Invalid URL, skip
        }
      }
    } catch (error) {
      console.error(`[Renderer] Failed to render ${url}:`, error);
    }
  }

  await context.close();
  return pages;
}

async function renderPage(
  context: Awaited<ReturnType<Browser['newContext']>>,
  url: string,
  config: RenderConfig
): Promise<CrawledPage> {
  const startTime = Date.now();
  const page = await context.newPage();

  try {
    // Navigate and wait for content
    const response = await page.goto(url, {
      waitUntil: 'networkidle',
      timeout: 30000,
    });

    // Wait for specific selector if provided
    if (config.waitForSelector) {
      await page.waitForSelector(config.waitForSelector, {
        timeout: config.waitForTimeout,
      }).catch(() => { /* timeout is ok */ });
    } else {
      // Default wait for body content
      await page.waitForTimeout(config.waitForTimeout);
    }

    // Extract page data
    const pageData = await extractPageData(page, url, response?.status() || 200);
    pageData.loadTimeMs = Date.now() - startTime;

    return pageData;
  } finally {
    await page.close();
  }
}

/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-explicit-any */
// Note: page.evaluate() runs in browser context where DOM types are different
async function extractPageData(
  page: Page,
  url: string,
  statusCode: number
): Promise<CrawledPage> {
  const data = await page.evaluate(() => {
    // Browser context - document and window are available here
    // Using 'any' because DOM types are not available in Node.js environment
    const doc = (globalThis as any).document;
    const win = (globalThis as any).window;

    // Extract title
    const title = doc.title || '';

    // Extract meta description
    const metaDesc = doc.querySelector('meta[name="description"]');
    const metaDescription = metaDesc?.getAttribute('content') || '';

    // Extract H1
    const h1Element = doc.querySelector('h1');
    const h1 = h1Element?.textContent?.trim() || '';

    // Extract all headings
    const headings = {
      h1: Array.from(doc.querySelectorAll('h1')).map((h: any) => h.textContent?.trim() || ''),
      h2: Array.from(doc.querySelectorAll('h2')).map((h: any) => h.textContent?.trim() || ''),
      h3: Array.from(doc.querySelectorAll('h3')).map((h: any) => h.textContent?.trim() || ''),
      h4: Array.from(doc.querySelectorAll('h4')).map((h: any) => h.textContent?.trim() || ''),
      h5: Array.from(doc.querySelectorAll('h5')).map((h: any) => h.textContent?.trim() || ''),
      h6: Array.from(doc.querySelectorAll('h6')).map((h: any) => h.textContent?.trim() || ''),
    };

    // Extract links
    const allLinks = Array.from(doc.querySelectorAll('a[href]'));
    const internal: string[] = [];
    const external: string[] = [];
    const baseHost = win.location.hostname;

    allLinks.forEach((link: any) => {
      const href = link.getAttribute('href');
      if (!href) return;
      try {
        const linkUrl = new URL(href, win.location.href);
        if (linkUrl.hostname === baseHost) {
          internal.push(linkUrl.href);
        } else {
          external.push(linkUrl.href);
        }
      } catch {
        // Relative URL
        internal.push(href);
      }
    });

    // Extract images
    const images = Array.from(doc.querySelectorAll('img')).map((img: any) => ({
      src: img.src,
      alt: img.alt || undefined,
      width: img.naturalWidth || undefined,
      height: img.naturalHeight || undefined,
      hasAlt: !!img.alt,
    }));

    // Extract schemas
    const schemas: Array<{type: string; properties: Record<string, unknown>; isValid: boolean; errors?: string[]}> = [];
    doc.querySelectorAll('script[type="application/ld+json"]').forEach((script: any) => {
      try {
        const data = JSON.parse(script.textContent || '');
        schemas.push({
          type: data['@type'] || 'Unknown',
          properties: data,
          isValid: true,
        });
      } catch {
        schemas.push({
          type: 'Invalid',
          properties: {},
          isValid: false,
          errors: ['Failed to parse JSON-LD'],
        });
      }
    });

    // Extract robots meta
    const robotsMeta = doc.querySelector('meta[name="robots"]');
    const robotsContent = robotsMeta?.getAttribute('content') || '';
    const noindex = robotsContent.includes('noindex');
    const nofollow = robotsContent.includes('nofollow');

    // Extract canonical
    const canonicalLink = doc.querySelector('link[rel="canonical"]');
    const canonicalUrl = canonicalLink?.getAttribute('href') || undefined;

    // Count words
    const bodyText = doc.body?.innerText || '';
    const wordCount = bodyText.split(/\s+/).filter((w: string) => w.length > 0).length;

    // Get HTML for snapshot
    const html = doc.documentElement.outerHTML;

    return {
      title,
      metaDescription,
      h1,
      headings,
      links: { internal: [...new Set(internal)], external: [...new Set(external)] },
      images,
      schemas,
      robotsMeta: { noindex, nofollow },
      canonicalUrl,
      wordCount,
      html,
    };
  });

  return {
    url,
    canonicalUrl: data.canonicalUrl,
    statusCode,
    contentType: 'text/html',
    title: data.title,
    metaDescription: data.metaDescription,
    h1: data.h1,
    wordCount: data.wordCount,
    schemas: data.schemas,
    links: data.links,
    images: data.images,
    headings: data.headings,
    robotsMeta: data.robotsMeta,
    hreflangAlternates: [],
    loadTimeMs: 0,
    crawledAt: new Date().toISOString(),
    warnings: [],
  };
}
/* eslint-enable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-return */

// ===================
// Storage Functions
// ===================

async function saveResults(
  userId: string,
  jobId: string,
  pages: CrawledPage[]
): Promise<void> {
  const key = `${userId}/${jobId}/data/rendered-pages.json`;

  await s3Client.send(
    new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: key,
      Body: JSON.stringify(pages, null, 2),
      ContentType: 'application/json',
    })
  );

  console.log(`[Renderer] Saved ${pages.length} pages to s3://${S3_BUCKET}/${key}`);
}

// Run main
main().catch(error => {
  console.error('[Renderer] Fatal error:', error);
  process.exit(1);
});
