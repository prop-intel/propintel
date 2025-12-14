/**
 * Template-Specific Scoring Rules
 *
 * Defines scoring criteria and weights for each template type.
 * Different content types have different optimization requirements.
 */

import { type CrawledPage, type LLMEOAnalysis, type SEOAnalysis } from '../types';
import { type TemplateType, detectTemplate } from './template-detector';

// ===================
// Types
// ===================

export interface TemplateScore {
  templateType: TemplateType;
  score: number; // 0-100
  breakdown: TemplateScoreBreakdown;
  missingElements: string[];
  recommendations: TemplateRecommendation[];
}

export interface TemplateScoreBreakdown {
  structure: number;
  content: number;
  schema: number;
  metadata: number;
  performance: number;
}

export interface TemplateRecommendation {
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  expectedImpact: string;
}

// ===================
// Scoring Rules
// ===================

interface TemplateRules {
  requiredSchemas: string[];
  optionalSchemas: string[];
  minWordCount: number;
  maxWordCount: number;
  requiredElements: string[];
  weights: {
    structure: number;
    content: number;
    schema: number;
    metadata: number;
    performance: number;
  };
  specificChecks: (page: CrawledPage) => { score: number; issues: string[] };
}

const TEMPLATE_RULES: Record<TemplateType, TemplateRules> = {
  blog: {
    requiredSchemas: ['Article', 'BlogPosting'],
    optionalSchemas: ['BreadcrumbList', 'Person'],
    minWordCount: 800,
    maxWordCount: 5000,
    requiredElements: ['title', 'h1', 'metaDescription'],
    weights: { structure: 0.2, content: 0.35, schema: 0.2, metadata: 0.15, performance: 0.1 },
    specificChecks: (page) => {
      const issues: string[] = [];
      let score = 100;

      // Check for author info in schema
      const hasAuthor = page.schemas.some(s => s.properties?.author);
      if (!hasAuthor) {
        issues.push('Missing author information');
        score -= 10;
      }

      // Check for date
      const hasDate = page.schemas.some(s => s.properties?.datePublished);
      if (!hasDate) {
        issues.push('Missing publish date');
        score -= 10;
      }

      // Check heading hierarchy
      if (page.headings.h2.length < 3) {
        issues.push('Few section headings (recommend 3+ H2s)');
        score -= 15;
      }

      return { score, issues };
    },
  },

  article: {
    requiredSchemas: ['Article', 'NewsArticle'],
    optionalSchemas: ['BreadcrumbList', 'Organization'],
    minWordCount: 600,
    maxWordCount: 4000,
    requiredElements: ['title', 'h1', 'metaDescription'],
    weights: { structure: 0.2, content: 0.35, schema: 0.2, metadata: 0.15, performance: 0.1 },
    specificChecks: (page) => {
      const issues: string[] = [];
      let score = 100;

      if (!page.metaDescription || page.metaDescription.length < 120) {
        issues.push('Meta description too short for article');
        score -= 15;
      }

      return { score, issues };
    },
  },

  product: {
    requiredSchemas: ['Product', 'Offer'],
    optionalSchemas: ['Review', 'AggregateRating', 'BreadcrumbList'],
    minWordCount: 200,
    maxWordCount: 2000,
    requiredElements: ['title', 'h1', 'metaDescription'],
    weights: { structure: 0.15, content: 0.2, schema: 0.35, metadata: 0.2, performance: 0.1 },
    specificChecks: (page) => {
      const issues: string[] = [];
      let score = 100;

      // Check for product schema completeness
      const productSchema = page.schemas.find(s => s.type === 'Product');
      if (productSchema) {
        const props = productSchema.properties;
        if (!props.name) { issues.push('Missing product name in schema'); score -= 10; }
        if (!props.description) { issues.push('Missing product description in schema'); score -= 10; }
        if (!props.image) { issues.push('Missing product image in schema'); score -= 10; }
        if (!props.offers) { issues.push('Missing price/offer in schema'); score -= 15; }
      }

      // Check for images
      if (page.images.length < 1) {
        issues.push('No product images found');
        score -= 20;
      }

      return { score, issues };
    },
  },

  landing: {
    requiredSchemas: ['WebPage'],
    optionalSchemas: ['Organization', 'FAQPage', 'HowTo'],
    minWordCount: 300,
    maxWordCount: 1500,
    requiredElements: ['title', 'h1', 'metaDescription'],
    weights: { structure: 0.25, content: 0.2, schema: 0.15, metadata: 0.25, performance: 0.15 },
    specificChecks: (page) => {
      const issues: string[] = [];
      let score = 100;

      // Landing pages need strong CTAs (indicated by buttons/links)
      if (page.links.internal.length < 2) {
        issues.push('Few internal links/CTAs');
        score -= 15;
      }

      // Check load time (critical for landing pages)
      if (page.loadTimeMs > 3000) {
        issues.push('Slow load time (>3s)');
        score -= 20;
      }

      return { score, issues };
    },
  },

  documentation: {
    requiredSchemas: ['TechArticle', 'HowTo'],
    optionalSchemas: ['BreadcrumbList', 'ItemList'],
    minWordCount: 500,
    maxWordCount: 10000,
    requiredElements: ['title', 'h1'],
    weights: { structure: 0.3, content: 0.25, schema: 0.15, metadata: 0.15, performance: 0.15 },
    specificChecks: (page) => {
      const issues: string[] = [];
      let score = 100;

      // Docs need good heading structure
      const totalHeadings = page.headings.h2.length + page.headings.h3.length;
      if (totalHeadings < 5) {
        issues.push('Documentation needs better heading structure');
        score -= 20;
      }

      // Check for code blocks (common in docs) - would need HTML analysis
      // For now, just check if it's technical content
      if (page.wordCount < 300) {
        issues.push('Documentation content too brief');
        score -= 15;
      }

      return { score, issues };
    },
  },

  homepage: {
    requiredSchemas: ['WebSite', 'Organization'],
    optionalSchemas: ['SiteNavigationElement', 'LocalBusiness'],
    minWordCount: 100,
    maxWordCount: 1000,
    requiredElements: ['title', 'h1', 'metaDescription'],
    weights: { structure: 0.2, content: 0.15, schema: 0.3, metadata: 0.25, performance: 0.1 },
    specificChecks: (page) => {
      const issues: string[] = [];
      let score = 100;

      // Homepage should have Organization schema
      const hasOrg = page.schemas.some(s => s.type === 'Organization');
      if (!hasOrg) {
        issues.push('Missing Organization schema');
        score -= 20;
      }

      // Check for clear navigation (internal links)
      if (page.links.internal.length < 5) {
        issues.push('Limited navigation links');
        score -= 10;
      }

      return { score, issues };
    },
  },

  category: {
    requiredSchemas: ['CollectionPage', 'ItemList'],
    optionalSchemas: ['BreadcrumbList', 'Product'],
    minWordCount: 100,
    maxWordCount: 1000,
    requiredElements: ['title', 'h1'],
    weights: { structure: 0.25, content: 0.15, schema: 0.3, metadata: 0.2, performance: 0.1 },
    specificChecks: (page) => {
      const issues: string[] = [];
      let score = 100;

      // Category pages should have many internal links
      if (page.links.internal.length < 5) {
        issues.push('Category page has few product/item links');
        score -= 15;
      }

      return { score, issues };
    },
  },

  contact: {
    requiredSchemas: ['ContactPage'],
    optionalSchemas: ['LocalBusiness', 'Organization'],
    minWordCount: 50,
    maxWordCount: 500,
    requiredElements: ['title', 'h1'],
    weights: { structure: 0.2, content: 0.1, schema: 0.35, metadata: 0.2, performance: 0.15 },
    specificChecks: (page) => {
      const issues: string[] = [];
      let score = 100;

      // Contact pages benefit from LocalBusiness schema
      const hasContact = page.schemas.some(s => 
        s.type === 'ContactPage' || s.type === 'LocalBusiness'
      );
      if (!hasContact) {
        issues.push('Missing contact/local business schema');
        score -= 25;
      }

      return { score, issues };
    },
  },

  about: {
    requiredSchemas: ['AboutPage'],
    optionalSchemas: ['Organization', 'Person'],
    minWordCount: 200,
    maxWordCount: 2000,
    requiredElements: ['title', 'h1', 'metaDescription'],
    weights: { structure: 0.2, content: 0.25, schema: 0.25, metadata: 0.2, performance: 0.1 },
    specificChecks: (page) => {
      const issues: string[] = [];
      let score = 100;

      // About pages should have Organization schema
      const hasOrg = page.schemas.some(s => s.type === 'Organization' || s.type === 'Person');
      if (!hasOrg) {
        issues.push('Missing Organization or Person schema');
        score -= 20;
      }

      return { score, issues };
    },
  },

  faq: {
    requiredSchemas: ['FAQPage'],
    optionalSchemas: ['Question', 'BreadcrumbList'],
    minWordCount: 300,
    maxWordCount: 3000,
    requiredElements: ['title', 'h1'],
    weights: { structure: 0.25, content: 0.2, schema: 0.35, metadata: 0.1, performance: 0.1 },
    specificChecks: (page) => {
      const issues: string[] = [];
      let score = 100;

      // FAQPage schema is crucial
      const hasFAQ = page.schemas.some(s => s.type === 'FAQPage');
      if (!hasFAQ) {
        issues.push('Missing FAQPage schema - critical for FAQ pages');
        score -= 30;
      }

      // Should have question-style headings
      const questionHeadings = [...page.headings.h2, ...page.headings.h3]
        .filter(h => h.includes('?'));
      if (questionHeadings.length < 3) {
        issues.push('FAQ page should have question-format headings');
        score -= 15;
      }

      return { score, issues };
    },
  },

  'how-to': {
    requiredSchemas: ['HowTo'],
    optionalSchemas: ['Step', 'BreadcrumbList', 'VideoObject'],
    minWordCount: 500,
    maxWordCount: 5000,
    requiredElements: ['title', 'h1', 'metaDescription'],
    weights: { structure: 0.3, content: 0.25, schema: 0.25, metadata: 0.1, performance: 0.1 },
    specificChecks: (page) => {
      const issues: string[] = [];
      let score = 100;

      // HowTo schema is important
      const hasHowTo = page.schemas.some(s => s.type === 'HowTo');
      if (!hasHowTo) {
        issues.push('Missing HowTo schema');
        score -= 25;
      }

      // Should have numbered/step headings
      const stepHeadings = page.headings.h2.filter(h => 
        /step\s*\d|^\d+[\.\)]/i.test(h)
      );
      if (stepHeadings.length < 3) {
        issues.push('How-to content should have numbered steps');
        score -= 15;
      }

      return { score, issues };
    },
  },

  comparison: {
    requiredSchemas: ['ItemList'],
    optionalSchemas: ['Product', 'Review', 'Table'],
    minWordCount: 800,
    maxWordCount: 5000,
    requiredElements: ['title', 'h1', 'metaDescription'],
    weights: { structure: 0.25, content: 0.3, schema: 0.2, metadata: 0.15, performance: 0.1 },
    specificChecks: (page) => {
      const issues: string[] = [];
      let score = 100;

      // Comparison pages benefit from structured content
      if (page.headings.h2.length < 2) {
        issues.push('Comparison page needs more sections');
        score -= 15;
      }

      // Should have good word count for thorough comparison
      if (page.wordCount < 1000) {
        issues.push('Comparison content may be too brief');
        score -= 10;
      }

      return { score, issues };
    },
  },

  pricing: {
    requiredSchemas: ['Product', 'Offer'],
    optionalSchemas: ['PriceSpecification', 'ItemList'],
    minWordCount: 100,
    maxWordCount: 1500,
    requiredElements: ['title', 'h1'],
    weights: { structure: 0.2, content: 0.15, schema: 0.35, metadata: 0.2, performance: 0.1 },
    specificChecks: (page) => {
      const issues: string[] = [];
      let score = 100;

      // Pricing pages need offer/price schema
      const hasOffer = page.schemas.some(s => s.type === 'Offer' || s.type === 'Product');
      if (!hasOffer) {
        issues.push('Missing Product/Offer schema for pricing');
        score -= 25;
      }

      return { score, issues };
    },
  },

  unknown: {
    requiredSchemas: ['WebPage'],
    optionalSchemas: ['BreadcrumbList'],
    minWordCount: 100,
    maxWordCount: 5000,
    requiredElements: ['title'],
    weights: { structure: 0.2, content: 0.25, schema: 0.2, metadata: 0.2, performance: 0.15 },
    specificChecks: () => ({ score: 100, issues: [] }),
  },
};

// ===================
// Main Functions
// ===================

/**
 * Calculate template-specific score for a page
 */
export function calculateTemplateScore(
  page: CrawledPage,
  _llmeoAnalysis?: LLMEOAnalysis,
  _seoAnalysis?: SEOAnalysis
): TemplateScore {
  const detection = detectTemplate(page);
  const rules = TEMPLATE_RULES[detection.type];
  const missingElements: string[] = [];
  const recommendations: TemplateRecommendation[] = [];

  // Calculate structure score
  let structureScore = 100;
  if (!page.h1 || page.headings.h1.length === 0) {
    structureScore -= 30;
    missingElements.push('h1');
  }
  if (page.headings.h1.length > 1) {
    structureScore -= 15;
    recommendations.push({
      priority: 'medium',
      title: 'Multiple H1 tags',
      description: 'Page has more than one H1 tag',
      expectedImpact: 'Clearer content hierarchy for AI systems',
    });
  }
  if (page.headings.h2.length === 0) {
    structureScore -= 20;
    missingElements.push('h2 headings');
  }

  // Calculate content score
  let contentScore = 100;
  if (page.wordCount < rules.minWordCount) {
    const deficit = (rules.minWordCount - page.wordCount) / rules.minWordCount;
    contentScore -= Math.min(50, deficit * 100);
    recommendations.push({
      priority: 'high',
      title: 'Content too short',
      description: `${detection.type} pages should have at least ${rules.minWordCount} words`,
      expectedImpact: 'More comprehensive content for AI citation',
    });
  }
  if (page.wordCount > rules.maxWordCount) {
    contentScore -= 10; // Minor penalty for very long content
  }

  // Calculate schema score
  let schemaScore = 100;
  const presentSchemas = new Set(page.schemas.map(s => s.type));
  const missingRequired = rules.requiredSchemas.filter(s => !presentSchemas.has(s));
  
  if (missingRequired.length > 0) {
    schemaScore -= missingRequired.length * 25;
    missingElements.push(...missingRequired.map(s => `${s} schema`));
    recommendations.push({
      priority: 'high',
      title: 'Missing required schemas',
      description: `Add ${missingRequired.join(', ')} schema for ${detection.type} pages`,
      expectedImpact: 'Better structured data for AI understanding',
    });
  }

  // Calculate metadata score
  let metadataScore = 100;
  if (!page.title) {
    metadataScore -= 40;
    missingElements.push('title');
  }
  if (!page.metaDescription) {
    metadataScore -= 30;
    missingElements.push('meta description');
  } else if (page.metaDescription.length < 100) {
    metadataScore -= 15;
    recommendations.push({
      priority: 'medium',
      title: 'Short meta description',
      description: 'Meta description should be 120-160 characters',
      expectedImpact: 'Better snippet display in search results',
    });
  }

  // Calculate performance score
  let performanceScore = 100;
  if (page.loadTimeMs > 3000) {
    performanceScore -= 30;
    recommendations.push({
      priority: 'medium',
      title: 'Slow page load',
      description: 'Page takes over 3 seconds to load',
      expectedImpact: 'Faster pages rank better',
    });
  } else if (page.loadTimeMs > 2000) {
    performanceScore -= 15;
  }

  // Apply template-specific checks
  const specificResult = rules.specificChecks(page);
  const specificPenalty = 100 - specificResult.score;
  structureScore = Math.max(0, structureScore - specificPenalty * 0.3);
  contentScore = Math.max(0, contentScore - specificPenalty * 0.3);
  schemaScore = Math.max(0, schemaScore - specificPenalty * 0.4);

  for (const issue of specificResult.issues) {
    if (!missingElements.includes(issue)) {
      missingElements.push(issue);
    }
  }

  // Calculate weighted overall score
  const weights = rules.weights;
  const overallScore = Math.round(
    structureScore * weights.structure +
    contentScore * weights.content +
    schemaScore * weights.schema +
    metadataScore * weights.metadata +
    performanceScore * weights.performance
  );

  return {
    templateType: detection.type,
    score: overallScore,
    breakdown: {
      structure: Math.round(structureScore),
      content: Math.round(contentScore),
      schema: Math.round(schemaScore),
      metadata: Math.round(metadataScore),
      performance: Math.round(performanceScore),
    },
    missingElements,
    recommendations,
  };
}

/**
 * Get template-specific optimization guidelines
 */
export function getTemplateGuidelines(type: TemplateType): {
  description: string;
  keyElements: string[];
  commonMistakes: string[];
  aiOptimizationTips: string[];
} {
  const guidelines: Record<TemplateType, ReturnType<typeof getTemplateGuidelines>> = {
    blog: {
      description: 'Blog posts should be comprehensive, well-structured, and include author/date information.',
      keyElements: ['BlogPosting schema', 'Author info', 'Publish date', '3+ H2 sections', '800+ words'],
      commonMistakes: ['Missing author', 'No date', 'Thin content', 'Poor heading hierarchy'],
      aiOptimizationTips: ['Include FAQs at bottom', 'Add key takeaways section', 'Use numbered lists'],
    },
    article: {
      description: 'Articles should be authoritative, well-researched, and properly attributed.',
      keyElements: ['Article schema', 'Clear byline', '600+ words', 'Source citations'],
      commonMistakes: ['Missing meta description', 'No images', 'Poor structure'],
      aiOptimizationTips: ['Lead with key facts', 'Include expert quotes', 'Add summary section'],
    },
    product: {
      description: 'Product pages need comprehensive structured data for rich results.',
      keyElements: ['Product schema', 'Price/Offer', 'Images', 'Reviews', 'Specifications'],
      commonMistakes: ['Incomplete schema', 'No reviews', 'Missing images', 'No price'],
      aiOptimizationTips: ['Add comparison info', 'Include use cases', 'Answer "who is this for"'],
    },
    landing: {
      description: 'Landing pages should be focused, fast, and conversion-oriented.',
      keyElements: ['Clear value proposition', 'Fast load time', 'Strong CTAs', 'Social proof'],
      commonMistakes: ['Slow loading', 'Too much content', 'Unclear CTA', 'No trust signals'],
      aiOptimizationTips: ['Include FAQs', 'Add testimonials', 'Clear feature list'],
    },
    documentation: {
      description: 'Documentation should be well-organized, searchable, and comprehensive.',
      keyElements: ['TechArticle/HowTo schema', 'Clear hierarchy', 'Code examples', 'Navigation'],
      commonMistakes: ['Poor structure', 'No code blocks', 'Missing steps', 'Outdated content'],
      aiOptimizationTips: ['Add common issues section', 'Include prerequisites', 'Version information'],
    },
    homepage: {
      description: 'Homepage should clearly communicate what the site/business is about.',
      keyElements: ['Organization schema', 'WebSite schema', 'Clear navigation', 'Value proposition'],
      commonMistakes: ['No Organization schema', 'Slow loading', 'Unclear purpose'],
      aiOptimizationTips: ['State what you do clearly', 'Include key services', 'Add trust signals'],
    },
    category: {
      description: 'Category pages should help users and AI understand content groupings.',
      keyElements: ['CollectionPage schema', 'ItemList', 'Filter options', 'Clear categories'],
      commonMistakes: ['No schema', 'Too few items', 'Poor descriptions'],
      aiOptimizationTips: ['Add category descriptions', 'Include popular items', 'Clear breadcrumbs'],
    },
    contact: {
      description: 'Contact pages should make it easy to find business information.',
      keyElements: ['ContactPage schema', 'LocalBusiness (if applicable)', 'Clear contact info'],
      commonMistakes: ['No schema', 'Missing hours', 'No address'],
      aiOptimizationTips: ['Include all contact methods', 'Add location schema', 'Include hours'],
    },
    about: {
      description: 'About pages should establish credibility and tell your story.',
      keyElements: ['AboutPage schema', 'Organization schema', 'Team info', 'History'],
      commonMistakes: ['No schema', 'Too vague', 'Missing credentials'],
      aiOptimizationTips: ['Include founding story', 'Add team credentials', 'Mention achievements'],
    },
    faq: {
      description: 'FAQ pages are prime real estate for AI-generated answers.',
      keyElements: ['FAQPage schema', 'Question/Answer format', 'Clear categories'],
      commonMistakes: ['No FAQPage schema', 'Not enough questions', 'Poor organization'],
      aiOptimizationTips: ['Use question format headings', 'Direct answers first', 'Group by topic'],
    },
    'how-to': {
      description: 'How-to guides should be step-by-step and easy to follow.',
      keyElements: ['HowTo schema', 'Numbered steps', 'Time estimate', 'Tools/materials'],
      commonMistakes: ['No HowTo schema', 'Missing steps', 'No images', 'Unclear instructions'],
      aiOptimizationTips: ['Include difficulty level', 'Add video if possible', 'List prerequisites'],
    },
    comparison: {
      description: 'Comparison pages should be comprehensive and unbiased.',
      keyElements: ['ItemList schema', 'Clear criteria', 'Pros/cons', 'Winner recommendation'],
      commonMistakes: ['Biased content', 'Missing criteria', 'Outdated info'],
      aiOptimizationTips: ['Add comparison table', 'Include use cases', 'State winner clearly'],
    },
    pricing: {
      description: 'Pricing pages need clear, structured pricing information.',
      keyElements: ['Offer schema', 'Clear plans', 'Feature comparison', 'FAQs'],
      commonMistakes: ['No schema', 'Hidden pricing', 'Unclear differences'],
      aiOptimizationTips: ['Add "most popular" indicator', 'Include FAQs', 'Show savings'],
    },
    unknown: {
      description: 'General web page optimization guidelines.',
      keyElements: ['WebPage schema', 'Clear structure', 'Good metadata'],
      commonMistakes: ['Missing title', 'No schema', 'Poor structure'],
      aiOptimizationTips: ['Add relevant schema', 'Improve heading structure', 'Add meta description'],
    },
  };

  return guidelines[type];
}

