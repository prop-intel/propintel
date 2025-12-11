/**
 * Template Detector
 *
 * Classifies pages into content types (blog, product, landing, docs, etc.)
 * to enable template-specific scoring and recommendations.
 */

import { CrawledPage } from '../types';

// ===================
// Types
// ===================

export type TemplateType = 
  | 'blog'
  | 'article'
  | 'product'
  | 'landing'
  | 'documentation'
  | 'homepage'
  | 'category'
  | 'contact'
  | 'about'
  | 'faq'
  | 'how-to'
  | 'comparison'
  | 'pricing'
  | 'unknown';

export interface TemplateDetectionResult {
  type: TemplateType;
  confidence: number; // 0-100
  signals: string[];
  suggestedSchemas: string[];
}

// ===================
// Detection Patterns
// ===================

const URL_PATTERNS: Record<TemplateType, RegExp[]> = {
  blog: [
    /\/blog\//i,
    /\/posts?\//i,
    /\/articles?\//i,
    /\/news\//i,
    /\/\d{4}\/\d{2}\//i, // Date-based URLs
  ],
  article: [
    /\/article\//i,
    /\/story\//i,
    /\/read\//i,
  ],
  product: [
    /\/products?\//i,
    /\/items?\//i,
    /\/shop\//i,
    /\/store\//i,
    /\/p\//i,
    /\/buy\//i,
  ],
  landing: [
    /\/lp\//i,
    /\/landing\//i,
    /\/campaign\//i,
    /\/promo\//i,
  ],
  documentation: [
    /\/docs?\//i,
    /\/documentation\//i,
    /\/api\//i,
    /\/reference\//i,
    /\/guide\//i,
    /\/manual\//i,
  ],
  homepage: [
    /^\/$/,
    /\/index\.html?$/i,
    /\/home\/?$/i,
  ],
  category: [
    /\/category\//i,
    /\/categories\//i,
    /\/tag\//i,
    /\/topics?\//i,
    /\/collections?\//i,
  ],
  contact: [
    /\/contact/i,
    /\/reach-us/i,
    /\/get-in-touch/i,
  ],
  about: [
    /\/about/i,
    /\/team/i,
    /\/company/i,
    /\/who-we-are/i,
  ],
  faq: [
    /\/faq/i,
    /\/questions/i,
    /\/help\/?$/i,
    /\/support\/?$/i,
  ],
  'how-to': [
    /\/how-to/i,
    /\/tutorial/i,
    /\/learn/i,
    /\/getting-started/i,
  ],
  comparison: [
    /\/compare/i,
    /\/vs\//i,
    /-vs-/i,
    /\/alternative/i,
  ],
  pricing: [
    /\/pricing/i,
    /\/plans/i,
    /\/packages/i,
    /\/subscribe/i,
  ],
  unknown: [],
};

const SCHEMA_SIGNALS: Record<string, TemplateType[]> = {
  'Article': ['article', 'blog'],
  'BlogPosting': ['blog'],
  'NewsArticle': ['article', 'blog'],
  'Product': ['product'],
  'Offer': ['product', 'pricing'],
  'HowTo': ['how-to', 'documentation'],
  'FAQPage': ['faq'],
  'WebPage': ['landing', 'homepage'],
  'AboutPage': ['about'],
  'ContactPage': ['contact'],
  'CollectionPage': ['category'],
  'ItemList': ['category', 'comparison'],
  'TechArticle': ['documentation'],
  'APIReference': ['documentation'],
};

const TITLE_PATTERNS: Record<TemplateType, RegExp[]> = {
  blog: [
    /^how\s+(to|i)/i,
    /\d+\s+(ways|tips|tricks|reasons)/i,
    /guide\s+to/i,
    /complete\s+guide/i,
  ],
  article: [
    /^the\s+/i,
    /explained/i,
    /everything\s+you\s+need/i,
  ],
  product: [
    /buy\s+/i,
    /order\s+/i,
    /\$[\d,]+/i,
    /shop\s+/i,
  ],
  landing: [
    /get\s+started/i,
    /sign\s+up/i,
    /try\s+/i,
    /free\s+trial/i,
  ],
  documentation: [
    /documentation/i,
    /api\s+reference/i,
    /developer\s+guide/i,
  ],
  homepage: [
    /^home$/i,
    /welcome\s+to/i,
  ],
  category: [
    /all\s+/i,
    /browse\s+/i,
  ],
  contact: [
    /contact\s+us/i,
    /get\s+in\s+touch/i,
  ],
  about: [
    /about\s+us/i,
    /our\s+story/i,
    /meet\s+the\s+team/i,
  ],
  faq: [
    /faq/i,
    /frequently\s+asked/i,
    /common\s+questions/i,
  ],
  'how-to': [
    /^how\s+to/i,
    /step[\s-]by[\s-]step/i,
    /tutorial/i,
  ],
  comparison: [
    /\svs\.?\s/i,
    /versus/i,
    /compared?\s+to/i,
    /alternative/i,
  ],
  pricing: [
    /pricing/i,
    /plans?\s+(and\s+)?pricing/i,
    /subscription/i,
  ],
  unknown: [],
};

// ===================
// Main Functions
// ===================

/**
 * Detect the template type of a page
 */
export function detectTemplate(page: CrawledPage): TemplateDetectionResult {
  const scores: Map<TemplateType, number> = new Map();
  const signals: string[] = [];

  // Initialize scores
  const types: TemplateType[] = [
    'blog', 'article', 'product', 'landing', 'documentation',
    'homepage', 'category', 'contact', 'about', 'faq',
    'how-to', 'comparison', 'pricing', 'unknown'
  ];
  types.forEach(t => scores.set(t, 0));

  // 1. Check URL patterns
  for (const [type, patterns] of Object.entries(URL_PATTERNS)) {
    for (const pattern of patterns) {
      if (pattern.test(page.url)) {
        scores.set(type as TemplateType, (scores.get(type as TemplateType) || 0) + 30);
        signals.push(`URL matches ${type} pattern`);
        break;
      }
    }
  }

  // 2. Check schema types
  for (const schema of page.schemas) {
    const matchingTypes = SCHEMA_SIGNALS[schema.type];
    if (matchingTypes) {
      for (const type of matchingTypes) {
        scores.set(type, (scores.get(type) || 0) + 25);
        signals.push(`Schema ${schema.type} suggests ${type}`);
      }
    }
  }

  // 3. Check title patterns
  if (page.title) {
    for (const [type, patterns] of Object.entries(TITLE_PATTERNS)) {
      for (const pattern of patterns) {
        if (pattern.test(page.title)) {
          scores.set(type as TemplateType, (scores.get(type as TemplateType) || 0) + 20);
          signals.push(`Title matches ${type} pattern`);
          break;
        }
      }
    }
  }

  // 4. Check content signals
  const contentSignals = analyzeContent(page);
  for (const [type, score] of contentSignals) {
    scores.set(type, (scores.get(type) || 0) + score);
  }

  // Find the highest scoring type
  let bestType: TemplateType = 'unknown';
  let bestScore = 0;

  for (const [type, score] of scores) {
    if (score > bestScore) {
      bestScore = score;
      bestType = type;
    }
  }

  // Calculate confidence
  const confidence = Math.min(100, bestScore);

  // Get suggested schemas
  const suggestedSchemas = getSuggestedSchemas(bestType);

  return {
    type: bestType,
    confidence,
    signals,
    suggestedSchemas,
  };
}

/**
 * Detect templates for multiple pages and identify patterns
 */
export function analyzeTemplateDistribution(pages: CrawledPage[]): {
  distribution: Map<TemplateType, number>;
  primaryTemplate: TemplateType;
  siteType: 'blog' | 'ecommerce' | 'saas' | 'docs' | 'mixed';
  templatesByUrl: Map<string, TemplateDetectionResult>;
} {
  const distribution: Map<TemplateType, number> = new Map();
  const templatesByUrl = new Map<string, TemplateDetectionResult>();

  for (const page of pages) {
    const result = detectTemplate(page);
    templatesByUrl.set(page.url, result);
    distribution.set(result.type, (distribution.get(result.type) || 0) + 1);
  }

  // Find primary template
  let primaryTemplate: TemplateType = 'unknown';
  let maxCount = 0;
  for (const [type, count] of distribution) {
    if (count > maxCount && type !== 'unknown') {
      maxCount = count;
      primaryTemplate = type;
    }
  }

  // Determine site type
  const siteType = determineSiteType(distribution, pages.length);

  return {
    distribution,
    primaryTemplate,
    siteType,
    templatesByUrl,
  };
}

// ===================
// Helper Functions
// ===================

/**
 * Analyze content for template signals
 */
function analyzeContent(page: CrawledPage): Map<TemplateType, number> {
  const scores: Map<TemplateType, number> = new Map();

  // Word count signals
  if (page.wordCount > 1500) {
    scores.set('blog', (scores.get('blog') || 0) + 15);
    scores.set('article', (scores.get('article') || 0) + 15);
    scores.set('documentation', (scores.get('documentation') || 0) + 10);
  } else if (page.wordCount < 300) {
    scores.set('landing', (scores.get('landing') || 0) + 10);
    scores.set('product', (scores.get('product') || 0) + 10);
  }

  // Heading structure signals
  const h2Count = page.headings.h2.length;
  const h3Count = page.headings.h3.length;

  if (h2Count >= 5) {
    scores.set('blog', (scores.get('blog') || 0) + 10);
    scores.set('documentation', (scores.get('documentation') || 0) + 10);
    scores.set('how-to', (scores.get('how-to') || 0) + 10);
  }

  // Check for numbered headings (common in how-to)
  const numberedHeadings = [...page.headings.h2, ...page.headings.h3]
    .filter(h => /^\d+[\.\):]/.test(h) || /^step\s+\d+/i.test(h));
  if (numberedHeadings.length >= 3) {
    scores.set('how-to', (scores.get('how-to') || 0) + 20);
  }

  // Check for FAQ-style headings
  const questionHeadings = [...page.headings.h2, ...page.headings.h3]
    .filter(h => /\?$/.test(h) || /^(what|how|why|when|where|who|which|can|do|is|are)\s/i.test(h));
  if (questionHeadings.length >= 3) {
    scores.set('faq', (scores.get('faq') || 0) + 25);
  }

  // Image count signals
  if (page.images.length >= 5) {
    scores.set('product', (scores.get('product') || 0) + 10);
    scores.set('blog', (scores.get('blog') || 0) + 5);
  }

  // External link signals
  if (page.links.external.length >= 5) {
    scores.set('blog', (scores.get('blog') || 0) + 5);
    scores.set('article', (scores.get('article') || 0) + 5);
  }

  // Check for comparison patterns in headings
  const comparisonHeadings = page.headings.h2
    .filter(h => /vs\.?|versus|compared|alternative|difference/i.test(h));
  if (comparisonHeadings.length >= 1) {
    scores.set('comparison', (scores.get('comparison') || 0) + 25);
  }

  return scores;
}

/**
 * Determine overall site type based on template distribution
 */
function determineSiteType(
  distribution: Map<TemplateType, number>,
  totalPages: number
): 'blog' | 'ecommerce' | 'saas' | 'docs' | 'mixed' {
  const blogCount = (distribution.get('blog') || 0) + (distribution.get('article') || 0);
  const productCount = distribution.get('product') || 0;
  const docsCount = (distribution.get('documentation') || 0) + (distribution.get('how-to') || 0);
  const landingCount = (distribution.get('landing') || 0) + (distribution.get('pricing') || 0);

  const threshold = totalPages * 0.4;

  if (blogCount >= threshold) return 'blog';
  if (productCount >= threshold) return 'ecommerce';
  if (docsCount >= threshold) return 'docs';
  if (landingCount >= threshold) return 'saas';

  return 'mixed';
}

/**
 * Get suggested schemas for a template type
 */
function getSuggestedSchemas(type: TemplateType): string[] {
  const schemas: Record<TemplateType, string[]> = {
    blog: ['BlogPosting', 'Article', 'BreadcrumbList'],
    article: ['Article', 'NewsArticle', 'BreadcrumbList'],
    product: ['Product', 'Offer', 'Review', 'AggregateRating', 'BreadcrumbList'],
    landing: ['WebPage', 'Organization', 'FAQPage'],
    documentation: ['TechArticle', 'HowTo', 'BreadcrumbList'],
    homepage: ['WebSite', 'Organization', 'SiteNavigationElement'],
    category: ['CollectionPage', 'ItemList', 'BreadcrumbList'],
    contact: ['ContactPage', 'LocalBusiness', 'Organization'],
    about: ['AboutPage', 'Organization', 'Person'],
    faq: ['FAQPage', 'Question'],
    'how-to': ['HowTo', 'Step', 'BreadcrumbList'],
    comparison: ['ItemList', 'Product', 'Review'],
    pricing: ['Product', 'Offer', 'PriceSpecification'],
    unknown: ['WebPage'],
  };

  return schemas[type] || ['WebPage'];
}

