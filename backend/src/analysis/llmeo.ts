import { CrawledPage, LLMEOAnalysis } from '../types';

// ===================
// Constants
// ===================

const RECOMMENDED_SCHEMAS = [
  'Article',
  'BlogPosting',
  'FAQPage',
  'HowTo',
  'Product',
  'Organization',
  'WebSite',
  'BreadcrumbList',
  'LocalBusiness',
];

const FRESHNESS_THRESHOLD_DAYS = 30;
const MIN_WORD_COUNT = 100;
const COMPREHENSIVE_WORD_COUNT = 1500;

// ===================
// Main Analysis Function
// ===================

export function analyzeLLMEO(pages: CrawledPage[]): LLMEOAnalysis {
  const schemaAnalysis = analyzeSchemas(pages);
  const semanticClarity = analyzeSemanticClarity(pages);
  const crawlAccessibility = analyzeCrawlAccessibility(pages);
  const contentDepth = analyzeContentDepth(pages);
  const freshness = analyzeFreshness(pages);

  // Calculate weighted overall score
  const score = Math.round(
    schemaAnalysis.score * 0.25 +
    semanticClarity.score * 0.20 +
    crawlAccessibility.score * 0.20 +
    contentDepth.score * 0.20 +
    freshness.score * 0.15
  );

  return {
    score,
    schemaAnalysis,
    semanticClarity,
    crawlAccessibility,
    contentDepth,
    freshness,
  };
}

// ===================
// Schema Analysis
// ===================

function analyzeSchemas(pages: CrawledPage[]): LLMEOAnalysis['schemaAnalysis'] {
  const allSchemas = new Set<string>();
  const invalidSchemas: string[] = [];
  const pagesWithSchemas = new Set<string>();

  pages.forEach(page => {
    page.schemas.forEach(schema => {
      if (schema.isValid) {
        allSchemas.add(schema.type);
        pagesWithSchemas.add(page.url);
      } else {
        invalidSchemas.push(page.url);
      }
    });
  });

  // Find missing recommended schemas
  const missingRecommended = RECOMMENDED_SCHEMAS.filter(s => !allSchemas.has(s));

  // Calculate score
  let score = 0;

  // Base score for having any schema (30 points)
  if (allSchemas.size > 0) {
    score += 30;
  }

  // Points for coverage (30 points max)
  const coverageRatio = pagesWithSchemas.size / Math.max(pages.length, 1);
  score += Math.round(coverageRatio * 30);

  // Points for variety (20 points max)
  const varietyScore = Math.min(allSchemas.size / 5, 1) * 20;
  score += Math.round(varietyScore);

  // Points for having recommended schemas (20 points max)
  const recommendedFound = RECOMMENDED_SCHEMAS.filter(s => allSchemas.has(s)).length;
  const recommendedScore = (recommendedFound / RECOMMENDED_SCHEMAS.length) * 20;
  score += Math.round(recommendedScore);

  // Deduct for invalid schemas
  score = Math.max(0, score - invalidSchemas.length * 5);

  return {
    score: Math.min(100, score),
    schemasFound: Array.from(allSchemas),
    missingRecommended,
    invalidSchemas: [...new Set(invalidSchemas)],
  };
}

// ===================
// Semantic Clarity Analysis
// ===================

function analyzeSemanticClarity(pages: CrawledPage[]): LLMEOAnalysis['semanticClarity'] {
  const issues: string[] = [];
  const suggestions: string[] = [];

  let totalScore = 0;

  pages.forEach(page => {
    let pageScore = 100;

    // Check for title
    if (!page.title) {
      pageScore -= 20;
      if (!issues.includes('Missing page titles')) {
        issues.push('Missing page titles');
      }
    } else if (page.title.length < 30 || page.title.length > 60) {
      pageScore -= 5;
    }

    // Check for meta description
    if (!page.metaDescription) {
      pageScore -= 15;
      if (!issues.includes('Missing meta descriptions')) {
        issues.push('Missing meta descriptions');
      }
    } else if (page.metaDescription.length < 120 || page.metaDescription.length > 160) {
      pageScore -= 5;
    }

    // Check for H1
    if (!page.h1 && page.headings.h1.length === 0) {
      pageScore -= 15;
      if (!issues.includes('Missing H1 headings')) {
        issues.push('Missing H1 headings');
      }
    }

    // Check heading hierarchy
    if (page.headings.h1.length > 1) {
      pageScore -= 10;
      if (!issues.includes('Multiple H1 headings detected')) {
        issues.push('Multiple H1 headings detected');
      }
    }

    // Check for proper heading structure
    if (page.headings.h3.length > 0 && page.headings.h2.length === 0) {
      pageScore -= 5;
      if (!issues.includes('Heading hierarchy skipped (H3 without H2)')) {
        issues.push('Heading hierarchy skipped (H3 without H2)');
      }
    }

    totalScore += Math.max(0, pageScore);
  });

  const averageScore = pages.length > 0 ? Math.round(totalScore / pages.length) : 0;

  // Generate suggestions based on issues
  if (issues.includes('Missing page titles')) {
    suggestions.push('Add descriptive, keyword-rich titles (30-60 characters) to all pages');
  }
  if (issues.includes('Missing meta descriptions')) {
    suggestions.push('Add compelling meta descriptions (120-160 characters) that summarize page content');
  }
  if (issues.includes('Missing H1 headings')) {
    suggestions.push('Ensure every page has a single, descriptive H1 heading');
  }
  if (issues.includes('Multiple H1 headings detected')) {
    suggestions.push('Use only one H1 per page - use H2-H6 for subsections');
  }

  return {
    score: averageScore,
    issues,
    suggestions,
  };
}

// ===================
// Crawl Accessibility Analysis
// ===================

function analyzeCrawlAccessibility(pages: CrawledPage[]): LLMEOAnalysis['crawlAccessibility'] {
  const blockedPages: string[] = [];
  const slowPages: string[] = [];
  const issues: string[] = [];

  const SLOW_THRESHOLD_MS = 3000;

  pages.forEach(page => {
    // Check for blocked/error pages
    if (page.statusCode >= 400) {
      blockedPages.push(page.url);
    }

    // Check for slow pages
    if (page.loadTimeMs > SLOW_THRESHOLD_MS) {
      slowPages.push(page.url);
    }

    // Check for noindex
    if (page.robotsMeta.noindex) {
      issues.push(`${page.url} has noindex meta tag`);
    }
  });

  // Calculate score
  let score = 100;

  // Deduct for blocked pages
  const blockedRatio = blockedPages.length / Math.max(pages.length, 1);
  score -= Math.round(blockedRatio * 40);

  // Deduct for slow pages
  const slowRatio = slowPages.length / Math.max(pages.length, 1);
  score -= Math.round(slowRatio * 30);

  // Deduct for noindex pages (but less severely as it might be intentional)
  const noindexCount = pages.filter(p => p.robotsMeta.noindex).length;
  const noindexRatio = noindexCount / Math.max(pages.length, 1);
  score -= Math.round(noindexRatio * 10);

  if (blockedPages.length > 0) {
    issues.unshift(`${blockedPages.length} pages returned error status codes`);
  }
  if (slowPages.length > 0) {
    issues.unshift(`${slowPages.length} pages loaded slowly (>3s)`);
  }

  return {
    score: Math.max(0, score),
    blockedPages,
    slowPages,
    issues,
  };
}

// ===================
// Content Depth Analysis
// ===================

function analyzeContentDepth(pages: CrawledPage[]): LLMEOAnalysis['contentDepth'] {
  const thinContentPages: string[] = [];
  const comprehensivePages: string[] = [];

  pages.forEach(page => {
    if (page.wordCount < MIN_WORD_COUNT) {
      thinContentPages.push(page.url);
    } else if (page.wordCount >= COMPREHENSIVE_WORD_COUNT) {
      comprehensivePages.push(page.url);
    }
  });

  // Calculate score based on content distribution
  let score = 0;

  const contentPages = pages.filter(p => p.contentType.includes('text/html'));
  if (contentPages.length === 0) {
    return {
      score: 0,
      thinContentPages,
      comprehensivePages,
    };
  }

  // Penalize for thin content
  const thinRatio = thinContentPages.length / contentPages.length;
  score = Math.round((1 - thinRatio) * 60);

  // Bonus for comprehensive content
  const comprehensiveRatio = comprehensivePages.length / contentPages.length;
  score += Math.round(comprehensiveRatio * 40);

  return {
    score: Math.min(100, Math.max(0, score)),
    thinContentPages,
    comprehensivePages,
  };
}

// ===================
// Freshness Analysis
// ===================

function analyzeFreshness(pages: CrawledPage[]): LLMEOAnalysis['freshness'] {
  const stalePages: string[] = [];
  const recentPages: string[] = [];
  const now = Date.now();
  const thresholdMs = FRESHNESS_THRESHOLD_DAYS * 24 * 60 * 60 * 1000;

  let pagesWithDates = 0;

  pages.forEach(page => {
    if (page.lastModified) {
      pagesWithDates++;
      const modifiedDate = new Date(page.lastModified).getTime();
      const age = now - modifiedDate;

      if (age > thresholdMs) {
        stalePages.push(page.url);
      } else {
        recentPages.push(page.url);
      }
    }
  });

  // If no pages have dates, we can't assess freshness
  if (pagesWithDates === 0) {
    return {
      score: 50, // Neutral score when we can't determine
      stalePages: [],
      recentPages: [],
    };
  }

  // Calculate score based on fresh vs stale ratio
  const freshRatio = recentPages.length / pagesWithDates;
  const score = Math.round(freshRatio * 100);

  return {
    score,
    stalePages,
    recentPages,
  };
}

