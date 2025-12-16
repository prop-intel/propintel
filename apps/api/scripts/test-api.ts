#!/usr/bin/env node

/**
 * PropIntel API Test Script
 *
 * Tests the PropIntel API endpoints including:
 * - Health check
 * - Job creation
 * - Authentication
 *
 * Note: Report retrieval is now handled via tRPC routes that read S3 directly.
 *
 * Usage:
 *   npm run test:api                    # Test against local serverless-offline
 *   npm run test:api -- --url <url>     # Test against deployed API
 *   npm run test:api -- --api-key <key> # Use custom API key
 */

import * as https from 'https';
import * as http from 'http';

// ===================
// Configuration
// ===================

const DEFAULT_API_URL = process.env.API_URL || 'http://localhost:4000';
const DEFAULT_API_KEY = process.env.API_KEY || 'propintel-dev-key-2024';

interface TestConfig {
  apiUrl: string;
  apiKey: string;
  verbose: boolean;
}

// Parse command line arguments
function parseArgs(): TestConfig {
  const args = process.argv.slice(2);
  let apiUrl = DEFAULT_API_URL;
  let apiKey = DEFAULT_API_KEY;
  let verbose = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--url' && args[i + 1]) {
      apiUrl = args[i + 1];
      i++;
    } else if (args[i] === '--api-key' && args[i + 1]) {
      apiKey = args[i + 1];
      i++;
    } else if (args[i] === '--verbose' || args[i] === '-v') {
      verbose = true;
    } else if (args[i] === '--help' || args[i] === '-h') {
      console.log(`
PropIntel API Test Script

Usage:
  npm run test:api [options]

Options:
  --url <url>        API base URL (default: ${DEFAULT_API_URL})
  --api-key <key>    API key for authentication (default: ${DEFAULT_API_KEY})
  --verbose, -v      Show detailed request/response information
  --help, -h         Show this help message

Examples:
  npm run test:api
  npm run test:api -- --url https://api.example.com
  npm run test:api -- --api-key my-custom-key
      `);
      process.exit(0);
    }
  }

  return { apiUrl, apiKey, verbose };
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
      timeout: 10000, // 10 second timeout
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
      reject(new Error(`Request timeout after 10 seconds`));
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
  }
}

function printSummary(): void {
  console.log('\n' + '='.repeat(60));
  console.log('Test Summary');
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

// ===================
// Test Functions
// ===================

async function testHealthCheck(config: TestConfig): Promise<void> {
  const response = await makeRequest(`${config.apiUrl}/health`, {
    method: 'GET',
    path: '/health',
  });

  if (response.statusCode !== 200) {
    throw new Error(`Expected status 200, got ${response.statusCode}`);
  }

  const data = JSON.parse(response.body);
  if (data.status !== 'healthy') {
    throw new Error(`Expected status 'healthy', got '${data.status}'`);
  }

  if (config.verbose) {
    console.log('  Response:', JSON.stringify(data, null, 2));
  }
}

async function testCreateJob(config: TestConfig): Promise<string> {
  const jobData = {
    targetUrl: 'https://example.com',
    config: {
      maxPages: 5,
      maxDepth: 2,
    },
    competitors: ['https://competitor.com'],
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
    throw new Error(`Expected status 201, got ${response.statusCode}: ${errorBody.error?.message || response.body}`);
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

async function testUnauthenticatedRequest(config: TestConfig): Promise<void> {
  const response = await makeRequest(`${config.apiUrl}/jobs`, {
    method: 'POST',
    path: '/jobs',
    body: JSON.stringify({ targetUrl: 'https://example.com' }),
    // No API key header
  });

  if (response.statusCode !== 401) {
    throw new Error(`Expected status 401 for unauthenticated request, got ${response.statusCode}`);
  }
}

// ===================
// Main Test Runner
// ===================

async function main(): Promise<void> {
  const config = parseArgs();

  console.log('PropIntel API Test Suite');
  console.log('='.repeat(60));
  console.log(`API URL: ${config.apiUrl}`);
  console.log(`API Key: ${config.apiKey.substring(0, 10)}...`);
  console.log('='.repeat(60));
  
  if (config.apiUrl.includes('localhost') || config.apiUrl.includes('127.0.0.1')) {
    console.log('\n⚠️  Note: Testing against local server.');
    console.log('   Make sure serverless-offline is running: npm run dev\n');
  }
  
  console.log('');

  let createdJobId: string | null = null;

  // Run tests
  await runTest('Health Check', () => testHealthCheck(config));

  await runTest('Unauthenticated Request (should fail)', () => testUnauthenticatedRequest(config));

  await runTest('Create Job', async () => {
    createdJobId = await testCreateJob(config);
  });

  if (createdJobId) {
    console.log(`\n  Job created with ID: ${createdJobId}`);
    console.log('  Note: Report retrieval is now handled via tRPC routes.');
  }

  // Print summary
  printSummary();
}

// Run tests
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

