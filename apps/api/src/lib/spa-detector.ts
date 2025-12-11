/**
 * SPA Detector
 *
 * Detects whether a page is a Single Page Application (SPA)
 * that requires JavaScript rendering to extract content.
 */

import { type CrawledPage } from '../types';

// ===================
// Configuration
// ===================

// Minimum word count threshold - below this suggests SPA
const MIN_WORD_COUNT = 50;

// Minimum content length in characters
const MIN_CONTENT_LENGTH = 500;

// Common SPA framework indicators
const SPA_INDICATORS = [
  // React
  'data-reactroot',
  'data-react-helmet',
  '__NEXT_DATA__',
  '__NUXT__',
  
  // Vue
  'data-v-',
  'data-server-rendered',
  
  // Angular
  'ng-version',
  '_nghost',
  '_ngcontent',
  
  // Generic
  'app-root',
  '#app',
  '#root',
  'noscript',
];

// Patterns that indicate loading/placeholder content
const LOADING_PATTERNS = [
  'loading',
  'please wait',
  'javascript required',
  'enable javascript',
  'loading...',
  'spinner',
];

// ===================
// Types
// ===================

export interface SPADetectionResult {
  isSPA: boolean;
  confidence: number; // 0-100
  reasons: string[];
  frameworkHints: string[];
  recommendation: 'render' | 'skip' | 'optional';
}

// ===================
// Main Functions
// ===================

/**
 * Detect if a page is an SPA that needs JavaScript rendering
 */
export function detectSPA(page: CrawledPage, htmlContent?: string): SPADetectionResult {
  const reasons: string[] = [];
  const frameworkHints: string[] = [];
  let score = 0;

  // Check word count
  if (page.wordCount < MIN_WORD_COUNT) {
    reasons.push(`Very low word count (${page.wordCount} words)`);
    score += 30;
  } else if (page.wordCount < MIN_WORD_COUNT * 2) {
    reasons.push(`Low word count (${page.wordCount} words)`);
    score += 15;
  }

  // Check for missing essential elements
  if (!page.title) {
    reasons.push('Missing title');
    score += 10;
  }

  if (!page.metaDescription) {
    reasons.push('Missing meta description');
    score += 5;
  }

  if (page.headings.h1.length === 0) {
    reasons.push('No H1 headings found');
    score += 10;
  }

  if (page.headings.h2.length === 0 && page.headings.h3.length === 0) {
    reasons.push('No subheadings found');
    score += 10;
  }

  // Check HTML content for SPA indicators (if provided)
  if (htmlContent) {
    const htmlLower = htmlContent.toLowerCase();

    // Check for SPA framework indicators
    for (const indicator of SPA_INDICATORS) {
      if (htmlContent.includes(indicator)) {
        frameworkHints.push(indicator);
        score += 5;
      }
    }

    // Check for loading patterns
    for (const pattern of LOADING_PATTERNS) {
      if (htmlLower.includes(pattern)) {
        reasons.push(`Loading indicator found: "${pattern}"`);
        score += 15;
      }
    }

    // Check content length
    const textContent = extractTextContent(htmlContent);
    if (textContent.length < MIN_CONTENT_LENGTH) {
      reasons.push(`Minimal text content (${textContent.length} chars)`);
      score += 20;
    }

    // Check for noscript warnings
    if (htmlContent.includes('<noscript>')) {
      reasons.push('Has noscript fallback');
      score += 10;
    }

    // Check for empty body or minimal structure
    const bodyMatch = /<body[^>]*>([\s\S]*?)<\/body>/i.exec(htmlContent);
    if (bodyMatch?.[1]) {
      const bodyContent = bodyMatch[1].trim();
      const tagCount = (bodyContent.match(/<[^>]+>/g) || []).length;
      if (tagCount < 10) {
        reasons.push(`Minimal HTML structure (${tagCount} tags)`);
        score += 15;
      }
    }
  }

  // Determine confidence and recommendation
  const confidence = Math.min(100, score);
  const isSPA = confidence >= 40;

  let recommendation: 'render' | 'skip' | 'optional';
  if (confidence >= 70) {
    recommendation = 'render';
  } else if (confidence >= 40) {
    recommendation = 'optional';
  } else {
    recommendation = 'skip';
  }

  return {
    isSPA,
    confidence,
    reasons,
    frameworkHints,
    recommendation,
  };
}

/**
 * Quick check based on initial response
 */
export function quickSPACheck(
  statusCode: number,
  contentType: string,
  contentLength: number,
  hasBody: boolean
): boolean {
  // Not HTML
  if (!contentType.includes('text/html')) {
    return false;
  }

  // Very small response might be SPA shell
  if (contentLength < 5000 && hasBody) {
    return true;
  }

  return false;
}

/**
 * Check multiple pages to determine if site is SPA-based
 */
export function detectSPASite(pages: CrawledPage[]): {
  isSPASite: boolean;
  spaPageCount: number;
  totalPages: number;
  overallConfidence: number;
} {
  if (pages.length === 0) {
    return {
      isSPASite: false,
      spaPageCount: 0,
      totalPages: 0,
      overallConfidence: 0,
    };
  }

  let spaCount = 0;
  let totalConfidence = 0;

  for (const page of pages) {
    const result = detectSPA(page);
    if (result.isSPA) {
      spaCount++;
    }
    totalConfidence += result.confidence;
  }

  const avgConfidence = totalConfidence / pages.length;
  const spaRatio = spaCount / pages.length;

  return {
    isSPASite: spaRatio >= 0.5 || avgConfidence >= 50,
    spaPageCount: spaCount,
    totalPages: pages.length,
    overallConfidence: Math.round(avgConfidence),
  };
}

// ===================
// Helper Functions
// ===================

/**
 * Extract visible text content from HTML
 */
function extractTextContent(html: string): string {
  // Remove script and style tags
  let text = html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');

  // Remove HTML tags
  text = text.replace(/<[^>]+>/g, ' ');

  // Clean up whitespace
  text = text.replace(/\s+/g, ' ').trim();

  return text;
}

/**
 * Get recommended rendering approach based on detection
 */
export function getRecommendedApproach(
  detectionResult: SPADetectionResult
): {
  approach: 'http' | 'playwright' | 'puppeteer';
  reason: string;
} {
  if (detectionResult.recommendation === 'render') {
    // Check framework hints for optimal renderer
    const hasReact = detectionResult.frameworkHints.some(h =>
      h.includes('react') || h.includes('NEXT')
    );
    const hasVue = detectionResult.frameworkHints.some(h =>
      h.includes('vue') || h.includes('NUXT')
    );

    if (hasReact || hasVue) {
      return {
        approach: 'playwright',
        reason: `Modern framework detected (${hasReact ? 'React/Next.js' : 'Vue/Nuxt'})`,
      };
    }

    return {
      approach: 'playwright',
      reason: 'SPA detected - requires JavaScript rendering',
    };
  }

  if (detectionResult.recommendation === 'optional') {
    return {
      approach: 'http',
      reason: 'Likely static content, try HTTP first',
    };
  }

  return {
    approach: 'http',
    reason: 'Static site detected',
  };
}

