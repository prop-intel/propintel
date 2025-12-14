#!/usr/bin/env node

/**
 * PropIntel API End-to-End Test Suite
 *
 * Tests the complete job lifecycle:
 * - Creates a job
 * - Polls for completion (via direct DB query)
 * - Validates report structure
 * - Verifies all expected data is present
 *
 * Usage:
 *   npm run test:e2e                    # Test against local serverless-offline
 *   npm run test:e2e -- --url <url>     # Test against deployed API
 *   npm run test:e2e -- --target <url>  # Test with specific target URL
 */

import * as https from 'https';
import * as http from 'http';
import { getJobById } from '../src/lib/db';

// ===================
// Configuration
// ===================

const DEFAULT_API_URL = process.env.API_URL || 'http://localhost:4000';
const DEFAULT_API_KEY = process.env.API_KEY || 'propintel-dev-key-2024';
const DEFAULT_TARGET_URL = process.env.TARGET_URL || 'https://example.com';
const DEFAULT_TIMEOUT = 20 * 60 * 1000; // 20 minutes
const POLL_INTERVAL = 5000; // 5 seconds

interface TestConfig {
  apiUrl: string;
  apiKey: string;
  targetUrl: string;
  timeout: number;
  verbose: boolean;
}

// Parse command line arguments
function parseArgs(): TestConfig {
  const args = process.argv.slice(2);
  let apiUrl = DEFAULT_API_URL;
  let apiKey = DEFAULT_API_KEY;
  let targetUrl = DEFAULT_TARGET_URL;
  let timeout = DEFAULT_TIMEOUT;
  let verbose = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--url' && args[i + 1]) {
      apiUrl = args[i + 1];
      i++;
    } else if (args[i] === '--api-key' && args[i + 1]) {
      apiKey = args[i + 1];
      i++;
    } else if (args[i] === '--target' && args[i + 1]) {
      targetUrl = args[i + 1];
      i++;
    } else if (args[i] === '--timeout' && args[i + 1]) {
      timeout = parseInt(args[i + 1], 10) * 1000;
      i++;
    } else if (args[i] === '--verbose' || args[i] === '-v') {
      verbose = true;
    } else if (args[i] === '--help' || args[i] === '-h') {
      console.log(`
PropIntel API End-to-End Test Suite

Usage:
  npm run test:e2e [options]

Options:
  --url <url>        API base URL (default: ${DEFAULT_API_URL})
  --api-key <key>    API key for authentication (default: ${DEFAULT_API_KEY})
  --target <url>     Target URL to crawl (default: ${DEFAULT_TARGET_URL})
  --timeout <sec>    Timeout in seconds (default: 1200)
  --verbose, -v      Show detailed request/response information
  --help, -h         Show this help message

Examples:
  npm run test:e2e
  npm run test:e2e -- --url https://api.example.com
  npm run test:e2e -- --target https://example.com --timeout 600
      `);
      process.exit(0);
    }
  }

  return { apiUrl, apiKey, targetUrl, timeout, verbose };
}

// ===================
// HTTP Client
// ===================

interface RequestOptions {
  method: string;
  path: string;
  headers?: Record<string, string>;
  body?: string;
}

function makeRequest(url: string, options: RequestOptions): Promise<{ statusCode: number; body: string; headers: Record<string, string> }> {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const isHttps = urlObj.protocol === 'https:';
    const client = isHttps ? https : http;

    const requestOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port || (isHttps ? 443 : 80),
      path: urlObj.pathname + (urlObj.search || ''),
      method: options.method,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      timeout: 30000,
    };

    const req = client.request(requestOptions, (res) => {
      let body = '';
      res.on('data', (chunk) => {
        body += chunk;
      });
      res.on('end', () => {
        const responseHeaders: Record<string, string> = {};
        Object.keys(res.headers).forEach((key) => {
          responseHeaders[key] = res.headers[key] as string;
        });
        resolve({
          statusCode: res.statusCode || 500,
          body,
          headers: responseHeaders,
        });
      });
    });

    req.on('error', (error) => {
      const errorMsg = error.message || String(error);
      if (errorMsg.includes('ECONNREFUSED') || errorMsg.includes('connect')) {
        reject(new Error(`Connection refused. Is the API server running at ${url}?`));
      } else {
        reject(new Error(`Request failed: ${errorMsg}`));
      }
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error(`Request timeout after 30 seconds`));
    });

    if (options.body) {
      req.write(options.body);
    }

    req.end();
  });
}

// ===================
// Test Helpers
// ===================

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  data?: unknown;
}

const testResults: TestResult[] = [];

async function runTest(name: string, testFn: () => Promise<void>): Promise<void> {
  try {
    await testFn();
    testResults.push({ name, passed: true });
    console.log(`✅ ${name}`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    testResults.push({ name, passed: false, error: errorMessage });
    console.error(`❌ ${name}: ${errorMessage}`);
    throw error; // Re-throw to stop E2E flow on critical failures
  }
}

function printSummary(): void {
  console.log('\n' + '='.repeat(60));
  console.log('E2E Test Summary');
  console.log('='.repeat(60));
  
  const passed = testResults.filter((r) => r.passed).length;
  const failed = testResults.filter((r) => !r.passed).length;
  
  console.log(`Total: ${testResults.length}`);
  console.log(`Passed: ${passed} ✅`);
  console.log(`Failed: ${failed} ${failed > 0 ? '❌' : ''}`);
  
  if (failed > 0) {
    console.log('\nFailed Tests:');
    testResults
      .filter((r) => !r.passed)
      .forEach((r) => {
        console.log(`  - ${r.name}: ${r.error}`);
      });
  }
  
  console.log('='.repeat(60));
  process.exit(failed > 0 ? 1 : 0);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ===================
// API Helpers
// ===================

async function createJob(config: TestConfig): Promise<string> {
  const jobData = {
    targetUrl: config.targetUrl,
    config: {
      maxPages: 5,
      maxDepth: 2,
    },
    llmModel: 'gpt-4o-mini',
  };

  const response = await makeRequest(`${config.apiUrl}/jobs`, {
    method: 'POST',
    path: '/jobs',
    headers: {
      'X-Api-Key': config.apiKey,
    },
    body: JSON.stringify(jobData),
  });

  if (response.statusCode !== 201) {
    const errorBody = JSON.parse(response.body);
    throw new Error(`Failed to create job: ${response.statusCode}: ${errorBody.error?.message || response.body}`);
  }

  const data = JSON.parse(response.body);
  if (!data.success || !data.data?.job) {
    throw new Error('Job creation response missing job data');
  }

  const jobId = data.data.job.id;
  if (!jobId) {
    throw new Error('Job ID not found in response');
  }

  if (config.verbose) {
    console.log('  Job created:', JSON.stringify(data.data.job, null, 2));
  }

  return jobId;
}

async function getJobStatus(_config: TestConfig, jobId: string): Promise<{ status: string; job: any }> {
  const job = await getJobById(jobId);

  if (!job) {
    throw new Error(`Job ${jobId} not found`);
  }

  return {
    status: job.status,
    job: job,
  };
}

async function waitForJobCompletion(config: TestConfig, jobId: string): Promise<any> {
  const startTime = Date.now();
  let lastStatus = 'pending';
  let lastStatusUpdateTime = startTime;
  const STATUS_UPDATE_INTERVAL = 30000; // Log status every 30 seconds even if unchanged

  console.log(`\n⏳ Waiting for job ${jobId} to complete...`);
  console.log(`   Target URL: ${config.targetUrl}`);
  console.log(`   Timeout: ${config.timeout / 1000}s\n`);

  while (Date.now() - startTime < config.timeout) {
    try {
      const { status, job } = await getJobStatus(config, jobId);
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      const shouldLogStatus = status !== lastStatus || 
                              (Date.now() - lastStatusUpdateTime) >= STATUS_UPDATE_INTERVAL;

      if (shouldLogStatus) {
        console.log(`   [${elapsed}s] Status: ${status}`);
        if (job.progress) {
          console.log(`      Progress: ${job.progress.pagesCrawled || 0}/${job.progress.pagesTotal || '?'} pages, Phase: ${job.progress.currentPhase || 'unknown'}`);
        }
        if (config.verbose && job.metrics) {
          console.log(`      Metrics:`, JSON.stringify(job.metrics, null, 2));
        }
        lastStatus = status;
        lastStatusUpdateTime = Date.now();
      }

      if (status === 'completed') {
        console.log(`\n✅ Job completed successfully!`);
        if (config.verbose) {
          console.log('   Job details:', JSON.stringify(job, null, 2));
        }
        return job;
      }

      if (status === 'failed' || status === 'blocked') {
        const error = job.error ? `: ${job.error.message}` : '';
        throw new Error(`Job ${status}${error}`);
      }
    } catch (error) {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      console.error(`   [${elapsed}s] Error checking job status:`, error instanceof Error ? error.message : error);
      // Continue polling unless it's a critical error
      if (error instanceof Error && error.message.includes('not found')) {
        // Job not found yet, wait a bit longer before retrying
        await sleep(POLL_INTERVAL * 2);
        continue;
      }
      // For other errors, rethrow
      throw error;
    }

    await sleep(POLL_INTERVAL);
  }

  throw new Error(`Job did not complete within ${config.timeout / 1000} seconds. Last status: ${lastStatus}`);
}

async function getReport(config: TestConfig, jobId: string, format: 'json' | 'md' = 'json'): Promise<any> {
  const response = await makeRequest(`${config.apiUrl}/jobs/${jobId}/report?format=${format}`, {
    method: 'GET',
    path: `/jobs/${jobId}/report?format=${format}`,
    headers: {
      'X-Api-Key': config.apiKey,
    },
  });

  if (response.statusCode !== 200) {
    const errorBody = JSON.parse(response.body);
    throw new Error(`Failed to get report: ${response.statusCode}: ${errorBody.error?.message || response.body}`);
  }

  if (format === 'json') {
    return JSON.parse(response.body);
  }

  return response.body;
}

// ===================
// Validation Functions
// ===================

function validateReportStructure(report: any): void {
  // Validate meta
  if (!report.meta) {
    throw new Error('Report missing meta field');
  }
  if (!report.meta.jobId) {
    throw new Error('Report meta missing jobId');
  }
  if (!report.meta.domain) {
    throw new Error('Report meta missing domain');
  }
  if (typeof report.meta.pagesAnalyzed !== 'number') {
    throw new Error('Report meta missing or invalid pagesAnalyzed');
  }

  // Validate scores
  if (!report.scores) {
    throw new Error('Report missing scores field');
  }
  if (typeof report.scores.aeoVisibilityScore !== 'number') {
    throw new Error('Report scores missing or invalid aeoVisibilityScore');
  }
  if (typeof report.scores.llmeoScore !== 'number') {
    throw new Error('Report scores missing or invalid llmeoScore');
  }
  if (typeof report.scores.seoScore !== 'number') {
    throw new Error('Report scores missing or invalid seoScore');
  }
  if (typeof report.scores.overallScore !== 'number') {
    throw new Error('Report scores missing or invalid overallScore');
  }

  // Validate AEO analysis
  if (!report.aeoAnalysis) {
    throw new Error('Report missing aeoAnalysis field');
  }
  if (typeof report.aeoAnalysis.visibilityScore !== 'number') {
    throw new Error('Report aeoAnalysis missing or invalid visibilityScore');
  }
  if (!Array.isArray(report.aeoAnalysis.targetQueries)) {
    throw new Error('Report aeoAnalysis missing or invalid targetQueries');
  }
  if (!Array.isArray(report.aeoAnalysis.citations)) {
    throw new Error('Report aeoAnalysis missing or invalid citations');
  }

  // Validate recommendations
  if (!Array.isArray(report.aeoRecommendations)) {
    throw new Error('Report missing or invalid aeoRecommendations array');
  }

  // Validate cursor prompt
  if (!report.cursorPrompt) {
    throw new Error('Report missing cursorPrompt field');
  }
  if (typeof report.cursorPrompt.prompt !== 'string' || report.cursorPrompt.prompt.length === 0) {
    throw new Error('Report cursorPrompt missing or invalid prompt');
  }

  // Validate LLMEO and SEO analysis
  if (!report.llmeoAnalysis) {
    throw new Error('Report missing llmeoAnalysis field');
  }
  if (!report.seoAnalysis) {
    throw new Error('Report missing seoAnalysis field');
  }
}

function validateScoreRanges(report: any): void {
  const scores = report.scores;

  // Scores should be between 0 and 100
  const scoreFields = ['aeoVisibilityScore', 'llmeoScore', 'seoScore', 'overallScore'];
  for (const field of scoreFields) {
    if (scores[field] < 0 || scores[field] > 100) {
      throw new Error(`Score ${field} is out of range (0-100): ${scores[field]}`);
    }
  }

  // Confidence should be between 0 and 1
  if (scores.confidence !== undefined) {
    if (scores.confidence < 0 || scores.confidence > 1) {
      throw new Error(`Confidence score is out of range (0-1): ${scores.confidence}`);
    }
  }
}

function validateJobMetrics(job: any): void {
  if (!job.metrics) {
    throw new Error('Job missing metrics field');
  }

  if (!job.metrics.startedAt) {
    throw new Error('Job metrics missing startedAt');
  }

  if (!job.metrics.completedAt) {
    throw new Error('Job metrics missing completedAt');
  }

  if (typeof job.metrics.durationMs !== 'number' || job.metrics.durationMs <= 0) {
    throw new Error('Job metrics missing or invalid durationMs');
  }

  if (job.progress.pagesCrawled !== job.progress.pagesTotal) {
    throw new Error(`Job progress mismatch: ${job.progress.pagesCrawled} crawled vs ${job.progress.pagesTotal} total`);
  }
}

// ===================
// Test Functions
// ===================

async function testCreateAndWaitForJob(config: TestConfig): Promise<{ jobId: string; job: any }> {
  const jobId = await createJob(config);
  const job = await waitForJobCompletion(config, jobId);
  return { jobId, job };
}

async function testReportRetrieval(config: TestConfig, jobId: string): Promise<any> {
  const report = await getReport(config, jobId, 'json');
  
  if (config.verbose) {
    console.log('\n   Report scores:', JSON.stringify(report.scores, null, 2));
    console.log('   AEO visibility:', report.aeoAnalysis.visibilityScore);
    console.log('   Queries analyzed:', report.aeoAnalysis.queriesAnalyzed);
    console.log('   Citation rate:', report.aeoAnalysis.citationRate);
  }

  return report;
}

async function testMarkdownReport(config: TestConfig, jobId: string): Promise<void> {
  const markdown = await getReport(config, jobId, 'md');
  
  if (typeof markdown !== 'string' || markdown.length === 0) {
    throw new Error('Markdown report is empty or invalid');
  }

  // Check for key sections in markdown (using actual section names from the report generator)
  const requiredSections = [
    'AEO Analysis Report',
    'Executive Summary',
    'AEO Visibility',
    'LLMEO Score',
    'SEO Score',
  ];
  
  const missingSections: string[] = [];
  for (const section of requiredSections) {
    if (!markdown.includes(section)) {
      missingSections.push(section);
    }
  }

  if (missingSections.length > 0) {
    // Only fail if critical sections are missing - be flexible with exact wording
    const criticalSections = ['Executive Summary', 'AEO Visibility'];
    const missingCritical = missingSections.filter(s => criticalSections.includes(s));
    if (missingCritical.length > 0) {
      throw new Error(`Markdown report missing critical sections: ${missingCritical.join(', ')}`);
    }
    // Warn about non-critical missing sections
    if (config.verbose) {
      console.log(`   ⚠️  Note: Some sections not found: ${missingSections.join(', ')}`);
    }
  }

  if (config.verbose) {
    console.log(`   Markdown report length: ${markdown.length} characters`);
    console.log(`   Contains key sections: ${requiredSections.filter(s => markdown.includes(s)).join(', ')}`);
  }
}

// ===================
// Main Test Runner
// ===================

async function main(): Promise<void> {
  const config = parseArgs();

  console.log('PropIntel API End-to-End Test Suite');
  console.log('='.repeat(60));
  console.log(`API URL: ${config.apiUrl}`);
  console.log(`API Key: ${config.apiKey.substring(0, 10)}...`);
  console.log(`Target URL: ${config.targetUrl}`);
  console.log(`Timeout: ${config.timeout / 1000}s`);
  console.log('='.repeat(60));

  if (config.apiUrl.includes('localhost') || config.apiUrl.includes('127.0.0.1')) {
    console.log('\n⚠️  Note: Testing against local server.');
    console.log('   Make sure serverless-offline is running: npm run dev\n');
  }

  let jobId: string | null = null;
  let job: any = null;
  let report: any = null;

  try {
    // Step 1: Create job and wait for completion
    await runTest('Create Job and Wait for Completion', async () => {
      const result = await testCreateAndWaitForJob(config);
      jobId = result.jobId;
      job = result.job;
    });

    if (!jobId || !job) {
      throw new Error('Job creation failed');
    }

    // Step 2: Validate job metrics
    await runTest('Validate Job Metrics', async () => {
      validateJobMetrics(job);
    });

    // Step 3: Retrieve and validate report
    await runTest('Retrieve Report', async () => {
      report = await testReportRetrieval(config, jobId!);
    });

    if (!report) {
      throw new Error('Report retrieval failed');
    }

    // Step 4: Validate report structure
    await runTest('Validate Report Structure', async () => {
      validateReportStructure(report);
    });

    // Step 5: Validate score ranges
    await runTest('Validate Score Ranges', async () => {
      validateScoreRanges(report);
    });

    // Step 6: Test markdown report
    await runTest('Retrieve Markdown Report', async () => {
      await testMarkdownReport(config, jobId!);
    });

    // Step 7: Validate report content quality
    await runTest('Validate Report Content Quality', async () => {
      if (report.aeoAnalysis.queriesAnalyzed === 0) {
        throw new Error('No queries were analyzed');
      }
      if (report.aeoRecommendations.length === 0) {
        console.log('   ⚠️  Warning: No recommendations generated');
      }
      if (!report.cursorPrompt.prompt || report.cursorPrompt.prompt.length < 100) {
        throw new Error('Cursor prompt is too short or missing');
      }
    });

    console.log('\n' + '='.repeat(60));
    console.log('E2E Test Results Summary');
    console.log('='.repeat(60));
    console.log(`Job ID: ${jobId}`);
    console.log(`Target URL: ${config.targetUrl}`);
    console.log(`Pages Analyzed: ${report.meta.pagesAnalyzed}`);
    console.log(`\nScores:`);
    console.log(`  AEO Visibility: ${report.scores.aeoVisibilityScore}/100`);
    console.log(`  LLMEO: ${report.scores.llmeoScore}/100`);
    console.log(`  SEO: ${report.scores.seoScore}/100`);
    console.log(`  Overall: ${report.scores.overallScore}/100`);
    console.log(`\nAEO Metrics:`);
    console.log(`  Queries Analyzed: ${report.aeoAnalysis.queriesAnalyzed}`);
    console.log(`  Citation Rate: ${report.aeoAnalysis.citationRate}%`);
    console.log(`  Recommendations: ${report.aeoRecommendations.length}`);
    console.log(`\nJob Duration: ${(job.metrics.durationMs / 1000).toFixed(2)}s`);

  } catch (error) {
    console.error('\n❌ E2E test failed:', error instanceof Error ? error.message : String(error));
    if (jobId) {
      console.error(`\nJob ID: ${jobId}`);
    }
    process.exit(1);
  }

  // Print summary
  printSummary();
}

// Run tests
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

