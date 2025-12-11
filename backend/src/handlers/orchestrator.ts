import { SQSHandler, SQSEvent, SQSRecord } from 'aws-lambda';
import { ECSClient, RunTaskCommand, DescribeTasksCommand } from '@aws-sdk/client-ecs';
import { CrawlJobMessage } from '../lib/sqs';
import { getJobById, updateJob, saveReportReference, saveAnalysis } from '../lib/db';
import { uploadAEOReport } from '../lib/s3';
import { generateSummary, generateRecommendations, generateCopyReadyPrompt } from '../lib/ai';
import { analyzeLLMEO } from '../analysis/llmeo';
import { analyzeSEO } from '../analysis/seo';
import { Report, CrawledPage as CrawledPageType, AEOReport, PageAnalysis, TargetQuery, CrawlConfig, Job as LegacyJob, TavilySearchResult, CompetitorVisibility, QueryCitation, AEORecommendation, CursorPrompt } from '../types';
import type { Job } from '../../shared/db/schema';
import { CitationAnalysisResult } from '../agents/analysis';

// AEO Agent imports
import { analyzePages, generateTargetQueries, discoverCompetitors } from '../agents/discovery';
import { researchQueries, analyzeCitations } from '../agents/research';
import { analyzeCitationPatterns, compareContent, calculateVisibilityScore, buildAEOAnalysis } from '../agents/analysis';
import { generateAEORecommendations, generateCursorPrompt, generateAEOReport } from '../agents/output';

// Orchestrator Agent imports
import { OrchestratorAgent } from '../agents/orchestrator';

// SPA Detection and Rendering
import { detectSPASite } from '../lib/spa-detector';
import { renderWithECS, isECSRenderingAvailable } from '../lib/renderer';

const ecsClient = new ECSClient({});

// ===================
// Environment Config
// ===================

const ECS_CLUSTER_ARN = process.env.ECS_CLUSTER_ARN || '';
const ECS_TASK_DEFINITION = process.env.ECS_TASK_DEFINITION || '';
const ECS_SUBNET_IDS = (process.env.ECS_SUBNET_IDS || '').split(',');
const ECS_SECURITY_GROUP = process.env.ECS_SECURITY_GROUP || '';

// AEO Configuration
const AEO_QUERY_COUNT = 10; // Number of queries to generate per job

// ===================
// Main Handler
// ===================

export const handler: SQSHandler = async (event: SQSEvent): Promise<void> => {
  for (const record of event.Records) {
    await processRecord(record);
  }
};

async function processRecord(record: SQSRecord): Promise<void> {
  const message: CrawlJobMessage = JSON.parse(record.body);
  const { jobId, tenantId: userId } = message; // tenantId is now userId

  console.log(`Processing job ${jobId} for user ${userId}`);

  try {
    // Try to get the job, with retry logic in case it was just created
    let job: Job | null = null;
    let attempts = 0;
    const maxAttempts = 5;
    const retryDelay = 500; // 500ms between retries

    while (!job && attempts < maxAttempts) {
      job = await getJobById(jobId);
      if (!job) {
        attempts++;
        if (attempts < maxAttempts) {
          console.log(`[${jobId}] Job not found, retrying (attempt ${attempts}/${maxAttempts})...`);
          await new Promise(resolve => setTimeout(resolve, retryDelay * attempts));
        }
      }
    }

    if (!job) {
      throw new Error(`Job ${jobId} not found after ${maxAttempts} attempts`);
    }

    // Verify the job belongs to the correct user
    if (job.userId !== userId) {
      throw new Error(`Job ${jobId} belongs to different user. Expected ${userId}, got ${job.userId}`);
    }

    // Update job status to crawling
    await updateJob(userId, jobId, {
      status: 'crawling',
      'metrics.startedAt': new Date().toISOString(),
      'progress.currentPhase': 'crawling',
    });

    // Phase 1: Crawl the site
    console.log(`[${jobId}] Phase 1: Crawling site...`);
    const pages = await runCrawler(job);

    await updateJob(userId, jobId, {
      'progress.pagesCrawled': pages.length,
      'progress.pagesTotal': pages.length,
      'progress.currentPhase': 'analyzing',
    });

    // Phase 2: Run traditional LLMEO/SEO analysis
    console.log(`[${jobId}] Phase 2: Running LLMEO/SEO analysis...`);
    const llmeoAnalysis = analyzeLLMEO(pages);
    const seoAnalysis = analyzeSEO(pages);

    // Phase 3: Run AEO Pipeline (with orchestrator agent)
    console.log(`[${jobId}] Phase 3: Running AEO pipeline with orchestrator agent...`);
    await updateJob(userId, jobId, {
      status: 'analyzing',
      'progress.currentPhase': 'aeo-discovery',
    });

    // Use new orchestrator-based pipeline (with fallback to old pipeline)
    const useOrchestrator = process.env.USE_ORCHESTRATOR_AGENT !== 'false'; // Default to true
    const aeoReport = useOrchestrator
      ? await runAEOPipelineWithOrchestrator(job, pages, llmeoAnalysis, seoAnalysis)
      : await runAEOPipeline(job, pages, llmeoAnalysis, seoAnalysis);

    // Phase 4: Generate final report
    console.log(`[${jobId}] Phase 4: Generating final report...`);
    await updateJob(userId, jobId, {
      'progress.currentPhase': 'generating-report',
    });

    // Upload AEO report to S3
    console.log(`[${jobId}] Uploading report to S3...`);
    const { jsonKey, markdownKey } = await uploadAEOReport(userId, jobId, aeoReport);
    console.log(`[${jobId}] Report uploaded to S3:`, { jsonKey, markdownKey, bucket: process.env.S3_BUCKET || 'propintel-api-dev-storage' });
    
    console.log(`[${jobId}] Saving report reference to database...`);
    await saveReportReference(jobId, jsonKey, markdownKey);
    console.log(`[${jobId}] Report reference saved to database`);

    // Save analysis summary to database for fast queries
    await saveAnalysisToDatabase(userId, jobId, aeoReport, jsonKey);

    // Update job as completed
    const startedAt = job.metrics?.startedAt || job.createdAt.toISOString();
    await updateJob(userId, jobId, {
      status: 'completed',
      'metrics.completedAt': new Date().toISOString(),
      'metrics.durationMs': Date.now() - new Date(startedAt).getTime(),
      'progress.currentPhase': 'completed',
    });

    // Send webhook if configured
    if (job.webhookUrl) {
      await sendWebhook(job.webhookUrl, aeoReport);
    }

    console.log(`[${jobId}] Job completed successfully. AEO Score: ${aeoReport.scores.aeoVisibilityScore}`);
  } catch (error) {
    console.error(`Job ${jobId} failed:`, error);
    console.error(`Job ${jobId} error stack:`, (error as Error).stack);

    const errorMessage = (error as Error).message;
    const isBlocked = errorMessage.includes('CAPTCHA') || errorMessage.includes('blocked');

    try {
      await updateJob(userId, jobId, {
        status: isBlocked ? 'blocked' : 'failed',
        error: {
          code: isBlocked ? 'SITE_BLOCKED' : 'PROCESSING_ERROR',
          message: errorMessage,
          details: (error as Error).stack,
        },
        'progress.currentPhase': 'error',
      });
    } catch (updateError) {
      console.error(`Job ${jobId} failed to update error status:`, updateError);
      // If we can't update the job, at least log the error
    }
  }
}

// ===================
// Crawler (with SPA Detection)
// ===================

async function runCrawler(job: Job): Promise<CrawledPageType[]> {
  const { crawlSite } = await import('../lib/crawler-simple');
  
  const defaultConfig: CrawlConfig = {
    maxPages: 50,
    maxDepth: 3,
    pageTimeout: 30000,
    crawlDelay: 1000,
    maxJobDuration: 15 * 60 * 1000,
    viewport: { width: 1920, height: 1080 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    followCanonical: true,
    respectRobotsTxt: true,
    skipExactDuplicates: true,
    urlExclusions: [],
    maxFileSize: 5 * 1024 * 1024,
  };
  
  const crawlerJob: LegacyJob = {
    id: job.id,
    tenantId: job.userId,
    targetUrl: job.targetUrl,
    status: job.status,
    config: (job.config as CrawlConfig) || defaultConfig,
    competitors: job.competitors || [],
    webhookUrl: job.webhookUrl || undefined,
    llmModel: job.llmModel || 'gpt-4o-mini',
    progress: job.progress || { pagesCrawled: 0, pagesTotal: 0, currentPhase: 'pending' },
    metrics: job.metrics || { apiCallsCount: 0, storageUsedBytes: 0 },
    createdAt: job.createdAt.toISOString(),
    updatedAt: job.updatedAt.toISOString(),
  };
  
  const pages = await crawlSite(crawlerJob);

  // Check if this looks like an SPA that needs rendering
  const spaDetection = detectSPASite(pages);

  if (spaDetection.isSPASite && isECSRenderingAvailable()) {
    console.log(`[${job.id}] SPA detected (confidence: ${spaDetection.overallConfidence}%). Launching ECS renderer...`);

    try {
      const renderResult = await renderWithECS(crawlerJob, {
        maxPages: crawlerJob.config.maxPages,
        viewport: crawlerJob.config.viewport,
        timeout: 5 * 60 * 1000,
      });

      if (renderResult.success && renderResult.pages.length > 0) {
        console.log(`[${job.id}] ECS render complete. Using ${renderResult.pages.length} rendered pages.`);
        return renderResult.pages;
      } else {
        console.log(`[${job.id}] ECS render failed or returned no pages. Using HTTP-crawled pages.`);
      }
    } catch (error) {
      console.error(`[${job.id}] ECS render error:`, error);
      // Fall back to HTTP-crawled pages
    }
  } else if (spaDetection.isSPASite) {
    console.log(`[${job.id}] SPA detected but ECS rendering not available. Using HTTP-crawled pages.`);
  }

  return pages;
}

// ===================
// AEO Pipeline with Orchestrator Agent
// ===================

/**
 * Run AEO pipeline using the orchestrator agent
 */
async function runAEOPipelineWithOrchestrator(
  job: Job,
  pages: CrawledPageType[],
  llmeoAnalysis: ReturnType<typeof analyzeLLMEO>,
  seoAnalysis: ReturnType<typeof analyzeSEO>
): Promise<AEOReport> {
  const domain = new URL(job.targetUrl).hostname;
  const userId = job.userId;
  const jobId = job.id;
  const llmModel = job.llmModel || 'gpt-4o-mini';

  console.log(`[${jobId}] Initializing orchestrator agent...`);

  // Initialize orchestrator
  const orchestrator = new OrchestratorAgent(jobId, userId, domain);

  // Store pages in context (needed for page-analysis agent)
  const contextManager = orchestrator.getContextManager();
  await contextManager.storeAgentResult('pages', pages, llmModel);

  // Initialize and create execution plan
  const plan = await orchestrator.initialize(job.targetUrl, domain, llmModel);
  console.log(`[${jobId}] Execution plan created: ${plan.phases.length} phases, estimated ${plan.estimatedDuration}s`);

  // Execute the plan
  await orchestrator.execute(llmModel);

  // Retrieve results from context
  const finalContext = orchestrator.getContext();

  // Extract all results needed for report generation
  const pageAnalysis = await contextManager.getAgentResult<PageAnalysis>('page-analysis');
  const targetQueries = await contextManager.getAgentResult<TargetQuery[]>('query-generation');
  const searchResults = await contextManager.getAgentResult<TavilySearchResult[]>('tavily-research');
  
  // Generate citations if not already stored
  let citations = await contextManager.getAgentResult<QueryCitation[]>('citations');
  if (!citations && searchResults && searchResults.length > 0) {
    citations = analyzeCitations(searchResults, domain);
    await contextManager.storeAgentResult('citations', citations, llmModel);
  }
  
  const competitors = await contextManager.getAgentResult<CompetitorVisibility[]>('competitor-discovery');
  let citationAnalysis = await contextManager.getAgentResult<CitationAnalysisResult>('citation-analysis');
  const contentComparison = await contextManager.getAgentResult('content-comparison');
  const visibilityScoreResult = await contextManager.getAgentResult<{ score: number }>('visibility-scoring');
  const aeoRecommendations = await contextManager.getAgentResult<AEORecommendation[]>('recommendations');
  const cursorPrompt = await contextManager.getAgentResult<CursorPrompt>('cursor-prompt');

  if (!pageAnalysis || !targetQueries) {
    throw new Error('Required analysis results not available: pageAnalysis and targetQueries are required');
  }

  const safeSearchResults = searchResults || [];
  const safeCitations = citations || [];
  const safeCompetitors = competitors || [];
  
  if (!citationAnalysis) {
    console.log(`[${jobId}] No citation analysis available, using defaults`);
    citationAnalysis = {
      totalQueries: targetQueries.length,
      citedQueries: 0,
      mentionedQueries: 0,
      absentQueries: targetQueries.length,
      citationRate: 0,
      averageRank: 0,
      top3Count: 0,
      top3Rate: 0,
      queryTypesWinning: new Map(),
      queryTypesLosing: new Map(),
      gaps: [],
      findings: [],
    };
  }

  // Build AEO Analysis
  const aeoAnalysis = buildAEOAnalysis(
    pageAnalysis,
    targetQueries,
    safeSearchResults,
    safeCitations,
    safeCompetitors,
    citationAnalysis.gaps || [],
    visibilityScoreResult?.score || 0,
    citationAnalysis
  );

  // Generate final report
  const aeoReport = await generateAEOReport(
    jobId,
    userId,
    domain,
    pages,
    aeoAnalysis,
    aeoRecommendations || [],
    cursorPrompt || {
      prompt: '',
      sections: [],
      version: 'v1.0',
      generatedAt: new Date().toISOString(),
    },
    llmeoAnalysis,
    seoAnalysis,
    {
      meta: {
        jobId,
        tenantId: userId,
        domain,
        generatedAt: new Date().toISOString(),
        pagesAnalyzed: pages.length,
        crawlDuration: job.metrics?.durationMs || 0,
      },
    }
  );

  return aeoReport;
}

// ===================
// AEO Pipeline (Legacy)
// ===================

async function runAEOPipeline(
  job: Job,
  pages: CrawledPageType[],
  llmeoAnalysis: ReturnType<typeof analyzeLLMEO>,
  seoAnalysis: ReturnType<typeof analyzeSEO>
): Promise<AEOReport> {
  const domain = new URL(job.targetUrl).hostname;
  const userId = job.userId;
  const jobId = job.id;
  const llmModel = job.llmModel || 'gpt-4o-mini';

  // ----- Phase 1: Discovery -----
  console.log(`[${jobId}] AEO Discovery: Analyzing page content...`);

  // Analyze the crawled pages to understand content
  const pageAnalysis = await analyzePages(pages, userId, jobId, llmModel);

  console.log(`[${jobId}] AEO Discovery: Generating target queries...`);

  // Generate queries this page should be answering
  const targetQueries = await generateTargetQueries(
    pageAnalysis,
    domain,
    userId,
    jobId,
    { queryCount: AEO_QUERY_COUNT, model: llmModel }
  );

  // ----- Phase 2: Research -----
  console.log(`[${jobId}] AEO Research: Searching ${targetQueries.length} queries via Tavily...`);

  // Search each query using Tavily
  const searchResults = await researchQueries(targetQueries, userId, jobId);

  // Analyze citations for target domain
  const citations = analyzeCitations(searchResults, domain);

  console.log(`[${jobId}] AEO Research: Discovering competitors...`);

  // Discover competitors from search results
  const competitors = await discoverCompetitors(
    targetQueries,
    domain,
    userId,
    jobId,
    { searchResults }
  );

  // ----- Phase 3: Analysis -----
  console.log(`[${jobId}] AEO Analysis: Analyzing citations and visibility...`);

  // Deep citation analysis
  const citationAnalysis = await analyzeCitationPatterns(
    citations,
    searchResults,
    domain,
    userId,
    jobId
  );

  // Content comparison with competitors
  const contentComparison = await compareContent(
    pageAnalysis,
    competitors,
    searchResults,
    userId,
    jobId,
    llmModel
  );

  // Calculate visibility score
  const { score: visibilityScore, breakdown, grade, summary } = await calculateVisibilityScore(
    citationAnalysis,
    competitors,
    contentComparison,
    userId,
    jobId
  );

  console.log(`[${jobId}] AEO Score: ${visibilityScore}/100 (${grade})`);

  // Build AEO Analysis object
  const aeoAnalysis = buildAEOAnalysis(
    pageAnalysis,
    targetQueries,
    searchResults,
    citations,
    competitors,
    citationAnalysis.gaps,
    visibilityScore,
    citationAnalysis
  );

  // ----- Phase 4: Output -----
  console.log(`[${jobId}] AEO Output: Generating recommendations...`);

  // Generate AEO-specific recommendations
  const aeoRecommendations = await generateAEORecommendations(
    aeoAnalysis,
    contentComparison,
    userId,
    jobId,
    llmModel
  );

  console.log(`[${jobId}] AEO Output: Generating Cursor prompt...`);

  // Generate Cursor-ready prompt
  const cursorPrompt = await generateCursorPrompt(
    domain,
    pageAnalysis,
    aeoAnalysis,
    aeoRecommendations,
    userId,
    jobId,
    llmModel
  );

  // Generate the complete AEO report
  const aeoReport = await generateAEOReport(
    jobId,
    userId,
    domain,
    pages,
    aeoAnalysis,
    aeoRecommendations,
    cursorPrompt,
    llmeoAnalysis,
    seoAnalysis,
    {
      meta: {
        jobId,
        tenantId: userId,
        domain,
        generatedAt: new Date().toISOString(),
        pagesAnalyzed: pages.length,
        crawlDuration: job.metrics?.durationMs || 0,
      },
    }
  );

  return aeoReport;
}

// ===================
// Legacy Analysis (for backward compatibility)
// ===================

async function runLegacyAnalysis(job: Job, pages: CrawledPageType[]): Promise<Report> {
  const domain = new URL(job.targetUrl).hostname;
  const userId = job.userId;
  const llmModel = job.llmModel || 'gpt-4o-mini';

  const llmeoAnalysis = analyzeLLMEO(pages);
  const seoAnalysis = analyzeSEO(pages);
  const overallScore = Math.round(llmeoAnalysis.score * 0.7 + seoAnalysis.score * 0.3);

  const summary = await generateSummary(
    pages,
    llmeoAnalysis,
    seoAnalysis,
    userId,
    job.id,
    llmModel
  );

  const recommendations = await generateRecommendations(
    pages,
    llmeoAnalysis,
    seoAnalysis,
    userId,
    job.id,
    llmModel
  );

  const copyReadyPrompt = await generateCopyReadyPrompt(
    domain,
    summary,
    userId,
    job.id,
    llmModel
  );

  const report: Report = {
    meta: {
      jobId: job.id,
      tenantId: userId,
      domain,
      generatedAt: new Date().toISOString(),
      pagesAnalyzed: pages.length,
      crawlDuration: job.metrics?.durationMs || 0,
    },
    scores: {
      llmeoScore: llmeoAnalysis.score,
      seoScore: seoAnalysis.score,
      overallScore,
      confidence: calculateConfidence(pages.length, llmeoAnalysis, seoAnalysis),
    },
    llmeoAnalysis,
    seoAnalysis,
    recommendations,
    llmSummary: summary,
    copyReadyPrompt,
    promptVersion: 'v1.0',
    warnings: collectWarnings(pages, llmeoAnalysis, seoAnalysis),
    artifacts: {
      rawSnapshots: pages.filter(p => p.htmlSnapshot).map(p => p.htmlSnapshot!),
      extractedData: `${userId}/${job.id}/data/pages.json`,
      fullReport: `${userId}/${job.id}/reports/report.json`,
    },
  };

  return report;
}

function calculateConfidence(
  pagesCount: number,
  llmeo: { score: number },
  seo: { score: number }
): number {
  const pagesFactor = Math.min(pagesCount / 50, 1);
  const scoreFactor = ((llmeo.score + seo.score) / 200);
  return Math.round((pagesFactor * 0.6 + scoreFactor * 0.4) * 100) / 100;
}

function collectWarnings(
  pages: CrawledPageType[],
  llmeo: { schemaAnalysis: { invalidSchemas: string[] } },
  seo: { indexability: { issues: string[] } }
): Report['warnings'] {
  const warnings: Report['warnings'] = [];

  if (llmeo.schemaAnalysis.invalidSchemas.length > 0) {
    warnings.push({
      code: 'INVALID_SCHEMA',
      message: 'Some pages have invalid structured data',
      affectedPages: llmeo.schemaAnalysis.invalidSchemas,
      severity: 'warning',
    });
  }

  pages.forEach(page => {
    if (page.warnings.length > 0) {
      page.warnings.forEach(w => {
        warnings.push({
          code: 'PAGE_WARNING',
          message: w,
          affectedPages: [page.url],
          severity: 'info',
        });
      });
    }
  });

  seo.indexability.issues.forEach(issue => {
    warnings.push({
      code: 'SEO_ISSUE',
      message: issue,
      affectedPages: [],
      severity: 'warning',
    });
  });

  return warnings;
}

// ===================
// Webhook
// ===================

async function sendWebhook(url: string, report: AEOReport | Report): Promise<void> {
  try {
    await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        event: 'job.completed',
        timestamp: new Date().toISOString(),
        report,
      }),
    });
  } catch (error) {
    console.error('Webhook delivery failed:', error);
  }
}

// ===================
// Analysis Storage
// ===================

/**
 * Save analysis summary to database for fast queries
 */
async function saveAnalysisToDatabase(
  userId: string,
  jobId: string,
  report: AEOReport,
  reportS3Key: string
): Promise<void> {
  try {
    // Extract top competitors
    const topCompetitors = report.aeoAnalysis.competitors
      .slice(0, 3)
      .map(c => c.domain);

    // Extract top findings and recommendations
    const topFindings = report.aeoAnalysis.keyFindings.slice(0, 5);
    const topRecommendations = report.aeoRecommendations
      .filter(r => r.priority === 'high')
      .slice(0, 5)
      .map(r => r.title);

    // Determine grade from visibility score
    const getGrade = (score: number): string => {
      if (score >= 90) return 'A+';
      if (score >= 85) return 'A';
      if (score >= 80) return 'A-';
      if (score >= 75) return 'B+';
      if (score >= 70) return 'B';
      if (score >= 65) return 'B-';
      if (score >= 60) return 'C+';
      if (score >= 55) return 'C';
      if (score >= 50) return 'C-';
      if (score >= 40) return 'D';
      return 'F';
    };

    await saveAnalysis(userId, jobId, {
      domain: report.meta.domain,
      scores: {
        aeoVisibilityScore: report.scores.aeoVisibilityScore,
        llmeoScore: report.scores.llmeoScore,
        seoScore: report.scores.seoScore,
        overallScore: report.scores.overallScore,
      },
      keyMetrics: {
        citationRate: report.aeoAnalysis.citationRate,
        queriesAnalyzed: report.aeoAnalysis.queriesAnalyzed,
        citationCount: report.aeoAnalysis.citationCount,
        topCompetitors,
      },
      summary: {
        topFindings,
        topRecommendations,
        grade: getGrade(report.scores.aeoVisibilityScore),
      },
      reportS3Key,
    });

    console.log(`[${jobId}] Analysis summary saved to database`);
  } catch (error) {
    console.error(`[${jobId}] Failed to save analysis to database:`, error);
    // Don't throw - this is not critical for job completion
  }
}

// ===================
// ECS Task Launch (for future phases)
// ===================

async function launchECSTask(job: Job): Promise<string> {
  const response = await ecsClient.send(
    new RunTaskCommand({
      cluster: ECS_CLUSTER_ARN,
      taskDefinition: ECS_TASK_DEFINITION,
      launchType: 'FARGATE',
      networkConfiguration: {
        awsvpcConfiguration: {
          subnets: ECS_SUBNET_IDS,
          securityGroups: [ECS_SECURITY_GROUP],
          assignPublicIp: 'ENABLED',
        },
      },
      overrides: {
        containerOverrides: [
          {
            name: 'crawler',
            environment: [
              { name: 'JOB_ID', value: job.id },
              { name: 'USER_ID', value: job.userId },
              { name: 'TARGET_URL', value: job.targetUrl },
              { name: 'CONFIG', value: JSON.stringify(job.config) },
            ],
          },
        ],
      },
    })
  );

  const taskArn = response.tasks?.[0]?.taskArn;
  if (!taskArn) {
    throw new Error('Failed to launch ECS task');
  }

  return taskArn;
}

async function waitForECSTask(taskArn: string): Promise<void> {
  let attempts = 0;
  const maxAttempts = 60;

  while (attempts < maxAttempts) {
    const response = await ecsClient.send(
      new DescribeTasksCommand({
        cluster: ECS_CLUSTER_ARN,
        tasks: [taskArn],
      })
    );

    const task = response.tasks?.[0];
    if (!task) {
      throw new Error('Task not found');
    }

    if (task.lastStatus === 'STOPPED') {
      const exitCode = task.containers?.[0]?.exitCode;
      if (exitCode !== 0) {
        throw new Error(`Task failed with exit code ${exitCode}`);
      }
      return;
    }

    await new Promise(resolve => setTimeout(resolve, 5000));
    attempts++;
  }

  throw new Error('Task timed out');
}
