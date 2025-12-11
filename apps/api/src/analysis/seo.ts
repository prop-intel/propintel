import { type CrawledPage, type SEOAnalysis } from '../types';

// ===================
// Constants
// ===================

const SLOW_PAGE_THRESHOLD_MS = 3000;
const TITLE_MIN_LENGTH = 30;
const TITLE_MAX_LENGTH = 60;
const DESC_MIN_LENGTH = 120;
const DESC_MAX_LENGTH = 160;

// ===================
// Main Analysis Function
// ===================

export function analyzeSEO(pages: CrawledPage[]): SEOAnalysis {
  const indexability = analyzeIndexability(pages);
  const metadata = analyzeMetadata(pages);
  const structure = analyzeStructure(pages);
  const performance = analyzePerformance(pages);
  const images = analyzeImages(pages);

  // Calculate weighted overall score
  const score = Math.round(
    indexability.score * 0.25 +
    metadata.score * 0.25 +
    structure.score * 0.20 +
    performance.score * 0.15 +
    images.score * 0.15
  );

  return {
    score,
    indexability,
    metadata,
    structure,
    performance,
    images,
  };
}

// ===================
// Indexability Analysis
// ===================

function analyzeIndexability(pages: CrawledPage[]): SEOAnalysis['indexability'] {
  const noindexPages: string[] = [];
  const blockedByRobots: string[] = [];
  const issues: string[] = [];

  pages.forEach(page => {
    if (page.robotsMeta.noindex) {
      noindexPages.push(page.url);
    }

    // Pages that returned 4xx or 5xx
    if (page.statusCode >= 400) {
      blockedByRobots.push(page.url);
    }
  });

  // Calculate score
  let score = 100;

  // Noindex pages reduce score (but might be intentional)
  const noindexRatio = noindexPages.length / Math.max(pages.length, 1);
  if (noindexRatio > 0.2) {
    score -= 20;
    issues.push('High percentage of noindex pages detected');
  }

  // Error pages significantly reduce score
  const errorRatio = blockedByRobots.length / Math.max(pages.length, 1);
  score -= Math.round(errorRatio * 50);

  if (blockedByRobots.length > 0) {
    issues.push(`${blockedByRobots.length} pages returned HTTP errors`);
  }

  // Check for duplicate canonical issues
  const canonicalCounts = new Map<string, number>();
  pages.forEach(page => {
    if (page.canonicalUrl) {
      canonicalCounts.set(
        page.canonicalUrl,
        (canonicalCounts.get(page.canonicalUrl) || 0) + 1
      );
    }
  });

  const duplicateCanonicals = Array.from(canonicalCounts.entries())
    .filter(([_, count]) => count > 1);
  if (duplicateCanonicals.length > 0) {
    issues.push('Multiple pages pointing to same canonical URL');
    score -= 10;
  }

  return {
    score: Math.max(0, score),
    noindexPages,
    blockedByRobots,
    issues,
  };
}

// ===================
// Metadata Analysis
// ===================

function analyzeMetadata(pages: CrawledPage[]): SEOAnalysis['metadata'] {
  const missingTitles: string[] = [];
  const missingDescriptions: string[] = [];
  const duplicateTitles: string[] = [];
  const duplicateDescriptions: string[] = [];

  const titleMap = new Map<string, string[]>();
  const descriptionMap = new Map<string, string[]>();

  pages.forEach(page => {
    // Check titles
    if (!page.title || page.title.trim().length === 0) {
      missingTitles.push(page.url);
    } else {
      const urls = titleMap.get(page.title) || [];
      urls.push(page.url);
      titleMap.set(page.title, urls);
    }

    // Check descriptions
    if (!page.metaDescription || page.metaDescription.trim().length === 0) {
      missingDescriptions.push(page.url);
    } else {
      const urls = descriptionMap.get(page.metaDescription) || [];
      urls.push(page.url);
      descriptionMap.set(page.metaDescription, urls);
    }
  });

  // Find duplicates
  titleMap.forEach((urls, title) => {
    if (urls.length > 1) {
      duplicateTitles.push(...urls);
    }
  });

  descriptionMap.forEach((urls, desc) => {
    if (urls.length > 1) {
      duplicateDescriptions.push(...urls);
    }
  });

  // Calculate score
  let score = 100;

  // Missing titles (major issue)
  const missingTitleRatio = missingTitles.length / Math.max(pages.length, 1);
  score -= Math.round(missingTitleRatio * 30);

  // Missing descriptions
  const missingDescRatio = missingDescriptions.length / Math.max(pages.length, 1);
  score -= Math.round(missingDescRatio * 25);

  // Duplicate titles
  const dupTitleRatio = duplicateTitles.length / Math.max(pages.length, 1);
  score -= Math.round(dupTitleRatio * 20);

  // Duplicate descriptions
  const dupDescRatio = duplicateDescriptions.length / Math.max(pages.length, 1);
  score -= Math.round(dupDescRatio * 15);

  // Check for title/description length issues
  let lengthIssues = 0;
  pages.forEach(page => {
    if (page.title) {
      if (page.title.length < TITLE_MIN_LENGTH || page.title.length > TITLE_MAX_LENGTH) {
        lengthIssues++;
      }
    }
    if (page.metaDescription) {
      if (page.metaDescription.length < DESC_MIN_LENGTH || page.metaDescription.length > DESC_MAX_LENGTH) {
        lengthIssues++;
      }
    }
  });

  const lengthIssueRatio = lengthIssues / (Math.max(pages.length, 1) * 2);
  score -= Math.round(lengthIssueRatio * 10);

  return {
    score: Math.max(0, score),
    missingTitles,
    missingDescriptions,
    duplicateTitles: [...new Set(duplicateTitles)],
    duplicateDescriptions: [...new Set(duplicateDescriptions)],
  };
}

// ===================
// Structure Analysis
// ===================

function analyzeStructure(pages: CrawledPage[]): SEOAnalysis['structure'] {
  const missingH1: string[] = [];
  const multipleH1: string[] = [];
  const headingHierarchyIssues: string[] = [];

  pages.forEach(page => {
    // Check for missing H1
    if (page.headings.h1.length === 0) {
      missingH1.push(page.url);
    }

    // Check for multiple H1s
    if (page.headings.h1.length > 1) {
      multipleH1.push(page.url);
    }

    // Check heading hierarchy
    const hasH2 = page.headings.h2.length > 0;
    const hasH3 = page.headings.h3.length > 0;
    const hasH4 = page.headings.h4.length > 0;

    // H3 without H2
    if (hasH3 && !hasH2) {
      headingHierarchyIssues.push(page.url);
    }
    // H4 without H3
    if (hasH4 && !hasH3) {
      if (!headingHierarchyIssues.includes(page.url)) {
        headingHierarchyIssues.push(page.url);
      }
    }
  });

  // Calculate score
  let score = 100;

  // Missing H1 is significant
  const missingH1Ratio = missingH1.length / Math.max(pages.length, 1);
  score -= Math.round(missingH1Ratio * 40);

  // Multiple H1s
  const multipleH1Ratio = multipleH1.length / Math.max(pages.length, 1);
  score -= Math.round(multipleH1Ratio * 25);

  // Hierarchy issues
  const hierarchyIssueRatio = headingHierarchyIssues.length / Math.max(pages.length, 1);
  score -= Math.round(hierarchyIssueRatio * 15);

  return {
    score: Math.max(0, score),
    missingH1,
    multipleH1,
    headingHierarchyIssues: [...new Set(headingHierarchyIssues)],
  };
}

// ===================
// Performance Analysis
// ===================

function analyzePerformance(pages: CrawledPage[]): SEOAnalysis['performance'] {
  const slowPages: string[] = [];
  let totalLoadTime = 0;
  let pagesWithMetrics = 0;

  pages.forEach(page => {
    if (page.loadTimeMs > 0) {
      pagesWithMetrics++;
      totalLoadTime += page.loadTimeMs;

      if (page.loadTimeMs > SLOW_PAGE_THRESHOLD_MS) {
        slowPages.push(page.url);
      }
    }
  });

  const averageLoadTime = pagesWithMetrics > 0 
    ? Math.round(totalLoadTime / pagesWithMetrics) 
    : 0;

  // Calculate score
  let score = 100;

  // Slow pages reduce score
  const slowRatio = slowPages.length / Math.max(pagesWithMetrics, 1);
  score -= Math.round(slowRatio * 40);

  // Average load time affects score
  if (averageLoadTime > 5000) {
    score -= 30;
  } else if (averageLoadTime > 3000) {
    score -= 20;
  } else if (averageLoadTime > 2000) {
    score -= 10;
  } else if (averageLoadTime > 1000) {
    score -= 5;
  }

  return {
    score: Math.max(0, score),
    slowPages,
    averageLoadTime,
  };
}

// ===================
// Image Analysis
// ===================

function analyzeImages(pages: CrawledPage[]): SEOAnalysis['images'] {
  const missingAlt: string[] = [];
  let totalImages = 0;
  let imagesWithAlt = 0;

  pages.forEach(page => {
    page.images.forEach(img => {
      totalImages++;
      if (img.hasAlt && img.alt && img.alt.trim().length > 0) {
        imagesWithAlt++;
      } else {
        if (!missingAlt.includes(page.url)) {
          missingAlt.push(page.url);
        }
      }
    });
  });

  // Calculate score
  let score = 100;

  if (totalImages > 0) {
    const altRatio = imagesWithAlt / totalImages;
    score = Math.round(altRatio * 100);
  }

  return {
    score,
    missingAlt,
    totalImages,
    imagesWithAlt,
  };
}

