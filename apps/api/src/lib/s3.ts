import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Report, AEOReport } from '../types';
import { generateMarkdownReport as generateAEOMarkdownReport } from '../agents/output/report-generator';

const s3Client = new S3Client({});
const BUCKET_NAME = process.env.S3_BUCKET || 'propintel-api-dev-storage';
const IS_LOCAL = process.env.IS_OFFLINE === 'true' || !process.env.S3_BUCKET;

// ===================
// Key Builders
// ===================

export const s3Keys = {
  htmlSnapshot: (tenantId: string, jobId: string, pageUrl: string) =>
    `${tenantId}/${jobId}/snapshots/${encodeURIComponent(pageUrl)}.html`,
  pageData: (tenantId: string, jobId: string) =>
    `${tenantId}/${jobId}/data/pages.json`,
  report: (tenantId: string, jobId: string, format: 'json' | 'md') =>
    `${tenantId}/${jobId}/reports/report.${format}`,
  artifact: (tenantId: string, jobId: string, filename: string) =>
    `${tenantId}/${jobId}/artifacts/${filename}`,
  agentResult: (tenantId: string, jobId: string, agentId: string) =>
    `${tenantId}/${jobId}/context/agent-results/${agentId}.json`,
  contextSnapshot: (tenantId: string, jobId: string) =>
    `${tenantId}/${jobId}/context/context-snapshot.json`,
};

// ===================
// Upload Operations
// ===================

export async function uploadHtmlSnapshot(
  tenantId: string,
  jobId: string,
  pageUrl: string,
  html: string
): Promise<string> {
  const key = s3Keys.htmlSnapshot(tenantId, jobId, pageUrl);

  await s3Client.send(
    new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      Body: html,
      ContentType: 'text/html',
      ContentEncoding: 'utf-8',
    })
  );

  return key;
}

export async function uploadPageData(
  tenantId: string,
  jobId: string,
  data: unknown
): Promise<string> {
  const key = s3Keys.pageData(tenantId, jobId);

  await s3Client.send(
    new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      Body: JSON.stringify(data, null, 2),
      ContentType: 'application/json',
    })
  );

  return key;
}

export async function uploadReport(
  tenantId: string,
  jobId: string,
  report: Report
): Promise<{ jsonKey: string; markdownKey: string }> {
  const jsonKey = s3Keys.report(tenantId, jobId, 'json');
  const mdKey = s3Keys.report(tenantId, jobId, 'md');

  // Upload JSON report
  await s3Client.send(
    new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: jsonKey,
      Body: JSON.stringify(report, null, 2),
      ContentType: 'application/json',
    })
  );

  // Generate and upload Markdown report
  const markdown = generateMarkdownReport(report);
  await s3Client.send(
    new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: mdKey,
      Body: markdown,
      ContentType: 'text/markdown',
    })
  );

  return { jsonKey, markdownKey: mdKey };
}

export async function uploadAEOReport(
  tenantId: string,
  jobId: string,
  report: AEOReport
): Promise<{ jsonKey: string; markdownKey: string }> {
  const jsonKey = s3Keys.report(tenantId, jobId, 'json');
  const mdKey = s3Keys.report(tenantId, jobId, 'md');

  console.log(`[S3] Uploading AEO report for job ${jobId}`, {
    bucket: BUCKET_NAME,
    jsonKey,
    mdKey,
    isLocal: IS_LOCAL,
    reportSize: JSON.stringify(report).length,
  });

  // Always upload to S3, even in local mode (for development/testing)
  // Note: Make sure S3_BUCKET is set and AWS credentials are configured

  // Upload JSON report
  console.log(`[S3] Uploading JSON report to s3://${BUCKET_NAME}/${jsonKey}`);
  await s3Client.send(
    new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: jsonKey,
      Body: JSON.stringify(report, null, 2),
      ContentType: 'application/json',
    })
  );
  console.log(`[S3] JSON report uploaded successfully to s3://${BUCKET_NAME}/${jsonKey}`);

  // Generate and upload Markdown report using AEO-specific generator
  console.log(`[S3] Generating and uploading Markdown report to s3://${BUCKET_NAME}/${mdKey}`);
  const markdown = generateAEOMarkdownReport(report);
  await s3Client.send(
    new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: mdKey,
      Body: markdown,
      ContentType: 'text/markdown',
    })
  );
  console.log(`[S3] Markdown report uploaded successfully to s3://${BUCKET_NAME}/${mdKey}`);

  return { jsonKey, markdownKey: mdKey };
}

// ===================
// Download Operations
// ===================

export async function getReport(
  tenantId: string,
  jobId: string,
  format: 'json' | 'md' = 'json'
): Promise<string | null> {
  const key = s3Keys.report(tenantId, jobId, format);

  try {
    const response = await s3Client.send(
      new GetObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
      })
    );

    return (await response.Body?.transformToString()) ?? null;
  } catch (error: unknown) {
    if ((error as { name?: string }).name === 'NoSuchKey') {
      return null;
    }
    throw error;
  }
}

export async function getPresignedUrl(
  key: string,
  expiresIn: number = 3600
): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
  });

  return getSignedUrl(s3Client, command, { expiresIn });
}

// ===================
// List Operations
// ===================

export async function listArtifacts(
  tenantId: string,
  jobId: string
): Promise<string[]> {
  const prefix = `${tenantId}/${jobId}/`;

  const response = await s3Client.send(
    new ListObjectsV2Command({
      Bucket: BUCKET_NAME,
      Prefix: prefix,
    })
  );

  return (response.Contents || []).map((obj) => obj.Key || '');
}

// ===================
// Delete Operations
// ===================

export async function deleteJobArtifacts(
  tenantId: string,
  jobId: string
): Promise<void> {
  const objects = await listArtifacts(tenantId, jobId);

  for (const key of objects) {
    await s3Client.send(
      new DeleteObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
      })
    );
  }
}

// ===================
// Markdown Generator
// ===================

function generateMarkdownReport(report: Report): string {
  const lines: string[] = [];

  // Header
  lines.push(`# LLMEO/SEO Analysis Report`);
  lines.push('');
  lines.push(`**Domain:** ${report.meta.domain}`);
  lines.push(`**Generated:** ${report.meta.generatedAt}`);
  lines.push(`**Pages Analyzed:** ${report.meta.pagesAnalyzed}`);
  lines.push('');

  // Executive Summary
  lines.push('## Executive Summary');
  lines.push('');
  lines.push('| Metric | Score |');
  lines.push('|--------|-------|');
  lines.push(`| LLMEO Score | ${report.scores.llmeoScore}/100 |`);
  lines.push(`| SEO Score | ${report.scores.seoScore}/100 |`);
  lines.push(`| Overall Score | ${report.scores.overallScore}/100 |`);
  lines.push(`| Confidence | ${(report.scores.confidence * 100).toFixed(0)}% |`);
  lines.push('');

  // Top Recommendations
  lines.push('## Top Priority Actions');
  lines.push('');
  const highPriority = report.recommendations.filter((r) => r.priority === 'high').slice(0, 5);
  highPriority.forEach((rec, i) => {
    lines.push(`### ${i + 1}. ${rec.title}`);
    lines.push('');
    lines.push(rec.description);
    lines.push('');
    lines.push(`**Impact:** ${rec.impact}`);
    lines.push(`**Effort:** ${rec.effort}`);
    if (rec.codeSnippet) {
      lines.push('');
      lines.push('```json');
      lines.push(rec.codeSnippet);
      lines.push('```');
    }
    lines.push('');
  });

  // LLMEO Analysis
  lines.push('## LLMEO Analysis');
  lines.push('');
  lines.push(`**Overall LLMEO Score:** ${report.llmeoAnalysis.score}/100`);
  lines.push('');

  lines.push('### Schema Coverage');
  lines.push(`- Score: ${report.llmeoAnalysis.schemaAnalysis.score}/100`);
  lines.push(`- Schemas Found: ${report.llmeoAnalysis.schemaAnalysis.schemasFound.join(', ') || 'None'}`);
  if (report.llmeoAnalysis.schemaAnalysis.missingRecommended.length > 0) {
    lines.push(`- Missing Recommended: ${report.llmeoAnalysis.schemaAnalysis.missingRecommended.join(', ')}`);
  }
  lines.push('');

  lines.push('### Content Freshness');
  lines.push(`- Score: ${report.llmeoAnalysis.freshness.score}/100`);
  if (report.llmeoAnalysis.freshness.stalePages.length > 0) {
    lines.push(`- Stale Pages (>30 days): ${report.llmeoAnalysis.freshness.stalePages.length}`);
  }
  lines.push('');

  // SEO Analysis
  lines.push('## SEO Analysis');
  lines.push('');
  lines.push(`**Overall SEO Score:** ${report.seoAnalysis.score}/100`);
  lines.push('');

  lines.push('### Indexability');
  lines.push(`- Score: ${report.seoAnalysis.indexability.score}/100`);
  if (report.seoAnalysis.indexability.noindexPages.length > 0) {
    lines.push(`- Noindex Pages: ${report.seoAnalysis.indexability.noindexPages.length}`);
  }
  lines.push('');

  lines.push('### Metadata');
  lines.push(`- Score: ${report.seoAnalysis.metadata.score}/100`);
  if (report.seoAnalysis.metadata.missingTitles.length > 0) {
    lines.push(`- Missing Titles: ${report.seoAnalysis.metadata.missingTitles.length}`);
  }
  if (report.seoAnalysis.metadata.missingDescriptions.length > 0) {
    lines.push(`- Missing Descriptions: ${report.seoAnalysis.metadata.missingDescriptions.length}`);
  }
  lines.push('');

  // LLM Summary
  lines.push('## AI-Generated Summary');
  lines.push('');
  lines.push('### Strengths');
  report.llmSummary.strengths.forEach((s) => lines.push(`- ${s}`));
  lines.push('');
  lines.push('### Weaknesses');
  report.llmSummary.weaknesses.forEach((w) => lines.push(`- ${w}`));
  lines.push('');
  lines.push('### Opportunities');
  report.llmSummary.opportunities.forEach((o) => lines.push(`- ${o}`));
  lines.push('');
  lines.push('### Next Steps');
  report.llmSummary.nextSteps.forEach((n) => lines.push(`- ${n}`));
  lines.push('');

  // Competitor Comparison (if available)
  if (report.competitorComparison && report.competitorComparison.length > 0) {
    lines.push('## Competitor Comparison');
    lines.push('');
    lines.push('| Domain | LLMEO | SEO | Key Strength | Key Weakness |');
    lines.push('|--------|-------|-----|--------------|--------------|');
    report.competitorComparison.forEach((comp) => {
      lines.push(
        `| ${comp.domain} | ${comp.llmeoScore} | ${comp.seoScore} | ${comp.strengths[0] || '-'} | ${comp.weaknesses[0] || '-'} |`
      );
    });
    lines.push('');
  }

  // Competitive Gap Analysis
  if (report.competitiveGapAnalysis) {
    lines.push('## Competitive Gap Analysis');
    lines.push('');
    lines.push('### Where You\'re Ahead');
    report.competitiveGapAnalysis.ahead.forEach((a) => lines.push(`- ${a}`));
    lines.push('');
    lines.push('### Where You\'re Behind');
    report.competitiveGapAnalysis.behind.forEach((b) => lines.push(`- ${b}`));
    lines.push('');
    lines.push('### Priority Actions');
    report.competitiveGapAnalysis.priorityActions.forEach((p) => lines.push(`- ${p}`));
    lines.push('');
  }

  // Warnings
  if (report.warnings.length > 0) {
    lines.push('## Warnings');
    lines.push('');
    report.warnings.forEach((w) => {
      lines.push(`- **[${w.severity.toUpperCase()}]** ${w.message}`);
    });
    lines.push('');
  }

  // Copy-Ready Prompt
  lines.push('## Copy-Ready Prompt');
  lines.push('');
  lines.push('```');
  lines.push(report.copyReadyPrompt);
  lines.push('```');
  lines.push('');
  lines.push(`*Prompt Version: ${report.promptVersion}*`);

  return lines.join('\n');
}

// ===================
// Context Storage Operations
// ===================

/**
 * Store agent result in S3
 */
export async function storeAgentResult(
  tenantId: string,
  jobId: string,
  agentId: string,
  result: unknown
): Promise<string> {
  const key = s3Keys.agentResult(tenantId, jobId, agentId);

  await s3Client.send(
    new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      Body: JSON.stringify(result, null, 2),
      ContentType: 'application/json',
    })
  );

  return key;
}

/**
 * Retrieve agent result from S3
 */
export async function getAgentResult<T = unknown>(
  tenantId: string,
  jobId: string,
  agentId: string
): Promise<T | null> {
  const key = s3Keys.agentResult(tenantId, jobId, agentId);

  try {
    const response = await s3Client.send(
      new GetObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
      })
    );

    const body = await response.Body?.transformToString();
    if (!body) return null;

    return JSON.parse(body) as T;
  } catch (error: unknown) {
    if ((error as { name?: string }).name === 'NoSuchKey') {
      return null;
    }
    throw error;
  }
}

/**
 * Store context snapshot in S3
 */
export async function storeContextSnapshot(
  tenantId: string,
  jobId: string,
  context: unknown
): Promise<string> {
  const key = s3Keys.contextSnapshot(tenantId, jobId);

  await s3Client.send(
    new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      Body: JSON.stringify(context, null, 2),
      ContentType: 'application/json',
    })
  );

  return key;
}

