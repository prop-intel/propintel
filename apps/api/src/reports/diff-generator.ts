/**
 * Diff Generator
 *
 * Compares current crawl results against previous crawls
 * to track content changes over time.
 */

import { type CrawledPage, type AEOAnalysis } from '../types';

// ===================
// Types
// ===================

export interface ContentDiff {
  url: string;
  changeType: 'added' | 'removed' | 'modified' | 'unchanged';
  changes: FieldChange[];
  changeSeverity: 'major' | 'minor' | 'none';
  impactOnAEO: string[];
}

export interface FieldChange {
  field: string;
  previousValue: string | number | undefined;
  currentValue: string | number | undefined;
  changeType: 'added' | 'removed' | 'modified';
}

export interface DiffReport {
  meta: {
    previousCrawlDate: string;
    currentCrawlDate: string;
    domain: string;
    jobId: string;
    previousJobId: string;
  };
  summary: {
    pagesAdded: number;
    pagesRemoved: number;
    pagesModified: number;
    pagesUnchanged: number;
    totalChanges: number;
    majorChanges: number;
    minorChanges: number;
  };
  aeoImpact: {
    scoreChange: number;
    previousScore: number;
    currentScore: number;
    impactFactors: string[];
  };
  pageDiffs: ContentDiff[];
  highlightedChanges: HighlightedChange[];
}

export interface HighlightedChange {
  description: string;
  impact: 'positive' | 'negative' | 'neutral';
  url?: string;
  recommendation?: string;
}

// ===================
// Main Functions
// ===================

/**
 * Generate a diff report comparing current and previous crawl data
 */
export function generateDiffReport(
  currentPages: CrawledPage[],
  previousPages: CrawledPage[],
  currentAEO: AEOAnalysis,
  previousAEO: AEOAnalysis | null,
  meta: {
    domain: string;
    jobId: string;
    previousJobId: string;
    currentCrawlDate: string;
    previousCrawlDate: string;
  }
): DiffReport {
  // Index pages by URL
  const currentByUrl = new Map(currentPages.map(p => [normalizeUrl(p.url), p]));
  const previousByUrl = new Map(previousPages.map(p => [normalizeUrl(p.url), p]));

  // Calculate page-level diffs
  const pageDiffs: ContentDiff[] = [];
  const allUrls = new Set([...currentByUrl.keys(), ...previousByUrl.keys()]);

  let pagesAdded = 0;
  let pagesRemoved = 0;
  let pagesModified = 0;
  let pagesUnchanged = 0;
  let majorChanges = 0;
  let minorChanges = 0;

  for (const url of allUrls) {
    const current = currentByUrl.get(url);
    const previous = previousByUrl.get(url);

    if (current && !previous) {
      // New page
      pagesAdded++;
      pageDiffs.push({
        url,
        changeType: 'added',
        changes: [],
        changeSeverity: 'major',
        impactOnAEO: ['New content available for indexing'],
      });
      majorChanges++;
    } else if (!current && previous) {
      // Removed page
      pagesRemoved++;
      pageDiffs.push({
        url,
        changeType: 'removed',
        changes: [],
        changeSeverity: 'major',
        impactOnAEO: ['Content no longer available - may affect visibility'],
      });
      majorChanges++;
    } else if (current && previous) {
      // Compare pages
      const diff = comparePages(current, previous);
      pageDiffs.push(diff);

      if (diff.changeType === 'modified') {
        pagesModified++;
        if (diff.changeSeverity === 'major') {
          majorChanges++;
        } else if (diff.changeSeverity === 'minor') {
          minorChanges++;
        }
      } else {
        pagesUnchanged++;
      }
    }
  }

  // Calculate AEO impact
  const aeoImpact = calculateAEOImpact(currentAEO, previousAEO, pageDiffs);

  // Generate highlighted changes
  const highlightedChanges = generateHighlightedChanges(pageDiffs, aeoImpact);

  return {
    meta: {
      previousCrawlDate: meta.previousCrawlDate,
      currentCrawlDate: meta.currentCrawlDate,
      domain: meta.domain,
      jobId: meta.jobId,
      previousJobId: meta.previousJobId,
    },
    summary: {
      pagesAdded,
      pagesRemoved,
      pagesModified,
      pagesUnchanged,
      totalChanges: pagesAdded + pagesRemoved + pagesModified,
      majorChanges,
      minorChanges,
    },
    aeoImpact,
    pageDiffs,
    highlightedChanges,
  };
}

/**
 * Compare two pages and return their differences
 */
function comparePages(current: CrawledPage, previous: CrawledPage): ContentDiff {
  const changes: FieldChange[] = [];
  const impactOnAEO: string[] = [];

  // Compare title
  if (current.title !== previous.title) {
    changes.push({
      field: 'title',
      previousValue: previous.title,
      currentValue: current.title,
      changeType: 'modified',
    });
    impactOnAEO.push('Title changed - may affect search visibility');
  }

  // Compare meta description
  if (current.metaDescription !== previous.metaDescription) {
    changes.push({
      field: 'metaDescription',
      previousValue: previous.metaDescription,
      currentValue: current.metaDescription,
      changeType: 'modified',
    });
    impactOnAEO.push('Meta description changed');
  }

  // Compare H1
  if (current.h1 !== previous.h1) {
    changes.push({
      field: 'h1',
      previousValue: previous.h1,
      currentValue: current.h1,
      changeType: 'modified',
    });
    impactOnAEO.push('Main heading changed');
  }

  // Compare word count (significant if >20% change)
  const wordCountChange = Math.abs(current.wordCount - previous.wordCount) / Math.max(previous.wordCount, 1);
  if (wordCountChange > 0.2) {
    changes.push({
      field: 'wordCount',
      previousValue: previous.wordCount,
      currentValue: current.wordCount,
      changeType: 'modified',
    });
    if (current.wordCount > previous.wordCount) {
      impactOnAEO.push('Content expanded significantly');
    } else {
      impactOnAEO.push('Content reduced significantly');
    }
  }

  // Compare schema types
  const previousSchemas = new Set(previous.schemas.map(s => s.type));
  const currentSchemas = new Set(current.schemas.map(s => s.type));
  
  const addedSchemas = [...currentSchemas].filter(s => !previousSchemas.has(s));
  const removedSchemas = [...previousSchemas].filter(s => !currentSchemas.has(s));

  if (addedSchemas.length > 0) {
    changes.push({
      field: 'schemas.added',
      previousValue: undefined,
      currentValue: addedSchemas.join(', '),
      changeType: 'added',
    });
    impactOnAEO.push(`Added schema types: ${addedSchemas.join(', ')}`);
  }

  if (removedSchemas.length > 0) {
    changes.push({
      field: 'schemas.removed',
      previousValue: removedSchemas.join(', '),
      currentValue: undefined,
      changeType: 'removed',
    });
    impactOnAEO.push(`Removed schema types: ${removedSchemas.join(', ')}`);
  }

  // Compare heading structure
  const h2Change = Math.abs(current.headings.h2.length - previous.headings.h2.length);
  if (h2Change > 2) {
    changes.push({
      field: 'headings.h2.count',
      previousValue: previous.headings.h2.length,
      currentValue: current.headings.h2.length,
      changeType: 'modified',
    });
    impactOnAEO.push('Content structure changed');
  }

  // Determine change severity
  let changeSeverity: 'major' | 'minor' | 'none' = 'none';
  if (changes.length === 0) {
    return {
      url: current.url,
      changeType: 'unchanged',
      changes: [],
      changeSeverity: 'none',
      impactOnAEO: [],
    };
  }

  // Major: title, h1, or significant content change
  const hasMajorChange = changes.some(c =>
    c.field === 'title' ||
    c.field === 'h1' ||
    c.field === 'wordCount' ||
    c.field.startsWith('schemas.')
  );

  changeSeverity = hasMajorChange ? 'major' : 'minor';

  return {
    url: current.url,
    changeType: 'modified',
    changes,
    changeSeverity,
    impactOnAEO,
  };
}

/**
 * Calculate the impact of changes on AEO score
 */
function calculateAEOImpact(
  current: AEOAnalysis,
  previous: AEOAnalysis | null,
  pageDiffs: ContentDiff[]
): DiffReport['aeoImpact'] {
  if (!previous) {
    return {
      scoreChange: 0,
      previousScore: 0,
      currentScore: current.visibilityScore,
      impactFactors: ['No previous data for comparison'],
    };
  }

  const scoreChange = current.visibilityScore - previous.visibilityScore;
  const impactFactors: string[] = [];

  // Analyze what drove the score change
  if (scoreChange > 10) {
    impactFactors.push('Significant visibility improvement');
  } else if (scoreChange < -10) {
    impactFactors.push('Significant visibility decline');
  }

  // Check citation rate change
  const citationChange = current.citationRate - previous.citationRate;
  if (Math.abs(citationChange) > 5) {
    if (citationChange > 0) {
      impactFactors.push(`Citation rate improved by ${citationChange.toFixed(1)}%`);
    } else {
      impactFactors.push(`Citation rate dropped by ${Math.abs(citationChange).toFixed(1)}%`);
    }
  }

  // Check content changes impact
  const majorContentChanges = pageDiffs.filter(d => d.changeSeverity === 'major');
  if (majorContentChanges.length > 0) {
    impactFactors.push(`${majorContentChanges.length} major content changes may affect visibility`);
  }

  // Check for new gaps
  const currentGapCount = current.gaps.length;
  const previousGapCount = previous.gaps.length;
  if (currentGapCount > previousGapCount) {
    impactFactors.push(`${currentGapCount - previousGapCount} new visibility gaps identified`);
  } else if (currentGapCount < previousGapCount) {
    impactFactors.push(`${previousGapCount - currentGapCount} visibility gaps closed`);
  }

  if (impactFactors.length === 0) {
    impactFactors.push('Minimal impact on visibility');
  }

  return {
    scoreChange,
    previousScore: previous.visibilityScore,
    currentScore: current.visibilityScore,
    impactFactors,
  };
}

/**
 * Generate human-readable highlighted changes
 */
function generateHighlightedChanges(
  pageDiffs: ContentDiff[],
  aeoImpact: DiffReport['aeoImpact']
): HighlightedChange[] {
  const highlights: HighlightedChange[] = [];

  // Score change highlight
  if (Math.abs(aeoImpact.scoreChange) >= 5) {
    highlights.push({
      description: aeoImpact.scoreChange > 0
        ? `AEO Visibility Score improved from ${aeoImpact.previousScore} to ${aeoImpact.currentScore}`
        : `AEO Visibility Score dropped from ${aeoImpact.previousScore} to ${aeoImpact.currentScore}`,
      impact: aeoImpact.scoreChange > 0 ? 'positive' : 'negative',
    });
  }

  // New pages highlight
  const addedPages = pageDiffs.filter(d => d.changeType === 'added');
  if (addedPages.length > 0) {
    highlights.push({
      description: `${addedPages.length} new page(s) detected`,
      impact: 'positive',
      recommendation: 'Ensure new pages are optimized for target queries',
    });
  }

  // Removed pages highlight
  const removedPages = pageDiffs.filter(d => d.changeType === 'removed');
  if (removedPages.length > 0) {
    highlights.push({
      description: `${removedPages.length} page(s) removed or no longer accessible`,
      impact: 'negative',
      recommendation: 'Check if removals were intentional; consider redirects if valuable content was removed',
    });
  }

  // Title changes
  const titleChanges = pageDiffs.filter(d =>
    d.changes.some(c => c.field === 'title')
  );
  if (titleChanges.length > 0) {
    highlights.push({
      description: `${titleChanges.length} page(s) with updated titles`,
      impact: 'neutral',
      url: titleChanges[0].url,
      recommendation: 'Verify new titles include target keywords',
    });
  }

  // Schema changes
  const schemaChanges = pageDiffs.filter(d =>
    d.changes.some(c => c.field.startsWith('schemas.'))
  );
  if (schemaChanges.length > 0) {
    highlights.push({
      description: `Schema markup changes on ${schemaChanges.length} page(s)`,
      impact: 'neutral',
      recommendation: 'Verify schema is valid and helps AI understand content',
    });
  }

  return highlights;
}

// ===================
// Helper Functions
// ===================

/**
 * Normalize URL for comparison
 */
function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    // Remove trailing slash, lowercase, remove www
    return parsed.origin.replace('www.', '') + 
           parsed.pathname.replace(/\/$/, '') + 
           parsed.search;
  } catch {
    return url.toLowerCase();
  }
}

/**
 * Generate markdown summary of diff report
 */
export function generateDiffMarkdown(report: DiffReport): string {
  const lines: string[] = [];

  lines.push('# Content Change Report');
  lines.push('');
  lines.push(`**Domain:** ${report.meta.domain}`);
  lines.push(`**Period:** ${report.meta.previousCrawlDate} to ${report.meta.currentCrawlDate}`);
  lines.push('');

  // Summary
  lines.push('## Summary');
  lines.push('');
  lines.push(`| Metric | Count |`);
  lines.push(`|--------|-------|`);
  lines.push(`| Pages Added | ${report.summary.pagesAdded} |`);
  lines.push(`| Pages Removed | ${report.summary.pagesRemoved} |`);
  lines.push(`| Pages Modified | ${report.summary.pagesModified} |`);
  lines.push(`| Pages Unchanged | ${report.summary.pagesUnchanged} |`);
  lines.push(`| Major Changes | ${report.summary.majorChanges} |`);
  lines.push(`| Minor Changes | ${report.summary.minorChanges} |`);
  lines.push('');

  // AEO Impact
  lines.push('## AEO Impact');
  lines.push('');
  const scoreEmoji = report.aeoImpact.scoreChange > 0 ? '+' : '';
  lines.push(`**Score Change:** ${scoreEmoji}${report.aeoImpact.scoreChange} (${report.aeoImpact.previousScore} -> ${report.aeoImpact.currentScore})`);
  lines.push('');
  lines.push('**Impact Factors:**');
  report.aeoImpact.impactFactors.forEach(f => lines.push(`- ${f}`));
  lines.push('');

  // Highlighted Changes
  if (report.highlightedChanges.length > 0) {
    lines.push('## Key Changes');
    lines.push('');
    report.highlightedChanges.forEach(change => {
      const icon = change.impact === 'positive' ? '[+]' : 
                   change.impact === 'negative' ? '[-]' : '[~]';
      lines.push(`${icon} ${change.description}`);
      if (change.recommendation) {
        lines.push(`   *Recommendation: ${change.recommendation}*`);
      }
    });
    lines.push('');
  }

  return lines.join('\n');
}

