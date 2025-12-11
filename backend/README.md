# PropIntel API

A production-ready, multi-tenant AEO (Answer Engine Optimization), LLMEO (LLM Engine Optimization), and SEO crawler API built on AWS Serverless infrastructure. PropIntel crawls websites, analyzes them for AI search visibility, and generates actionable reports with AI-powered insights and ready-to-use Cursor prompts.

## Features

### Core Capabilities

- **AEO Analysis** (NEW): Measures how well your content appears in AI search results (ChatGPT, Perplexity, Google AI)
  - Visibility scoring based on real AI search results via Tavily
  - Citation tracking and competitor analysis
  - Gap identification for missed opportunities
  - Ready-to-paste Cursor prompts for content optimization

- **Intelligent Web Crawling**: HTTP-based crawler with robots.txt compliance, SPA detection, and ECS-based rendering for JavaScript-heavy sites

- **LLMEO Analysis**: Schema markup analysis, semantic clarity scoring, content depth evaluation, and crawl accessibility checks

- **SEO Analysis**: Traditional SEO metrics including indexability, metadata quality, heading structure, performance, and image optimization

- **AI-Powered Insights**: LLM-generated summaries, prioritized recommendations, and copy-ready prompts using OpenAI

- **Multi-Tenant Architecture**: Full tenant isolation with API key authentication and usage tracking

- **Dashboard & Monitoring**: Real-time metrics, score trends, and automated alerts

- **Scheduled Crawls**: Recurring crawl jobs via EventBridge with cron expressions

- **Webhook Notifications**: Slack, Discord, and generic webhook support with formatted payloads

### Primary Metrics

| Metric | Weight | Description |
|--------|--------|-------------|
| **AEO Visibility Score** | 50% | How often your content appears in AI search results |
| LLMEO Score | 30% | LLM optimization readiness (schema, clarity, depth) |
| SEO Score | 20% | Traditional search engine optimization |

## Architecture

```
+-------------+     +-------------+     +-------------+
| API Gateway |---->|   Lambda    |---->|   SQS       |
+-------------+     | Control     |     |   Queue     |
                    +-------------+     +------+------+
                                               |
                    +-------------+     +------v------+
                    |  Dashboard  |     | Orchestrator|
                    |  Lambda     |     |   Lambda    |
                    +-------------+     +------+------+
                                               |
        +------------------+-------------------+-------------------+
        |                  |                   |                   |
        v                  v                   v                   v
+---------------+  +---------------+  +---------------+  +---------------+
|   DynamoDB    |  |  ECS Fargate  |  |    Tavily     |  |    OpenAI     |
|               |  |  (SPA Render) |  |     API       |  |     API       |
+---------------+  +---------------+  +---------------+  +---------------+
        |                  |
        v                  v
+-----------------------------------------------+
|                      S3                        |
|  (Reports, Snapshots, Rendered Pages)         |
+-----------------------------------------------+
```

### AEO Pipeline

The AEO analysis pipeline runs in 4 phases:

1. **Discovery**: Analyze page content, generate target queries, discover competitors
2. **Research**: Search queries via Tavily, track citations for your domain
3. **Analysis**: Analyze citation patterns, compare content, calculate visibility score
4. **Output**: Generate recommendations, create Cursor prompt, build final report

## Prerequisites

- **Node.js**: >= 20.0.0
- **AWS Account**: With appropriate permissions
- **AWS CLI**: Configured with credentials
- **Serverless Framework**: v4.x
- **API Keys**:
  - OpenAI API key (required)
  - Tavily API key (required for AEO analysis)
  - Langfuse keys (optional, recommended for observability)

## Installation

### 1. Clone the Repository

```bash
git clone <repository-url>
cd propintel-backend
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment Variables

Create a `.env` file with your API keys:

```env
OPENAI_API_KEY=sk-your-openai-key
TAVILY_API_KEY=tvly-your-tavily-key
LANGFUSE_PUBLIC_KEY=pk-your-langfuse-public-key
LANGFUSE_SECRET_KEY=sk-your-langfuse-secret-key
LANGFUSE_BASE_URL=https://us.cloud.langfuse.com
```

### 4. Configure AWS

Ensure your AWS CLI is configured:

```bash
aws configure --profile your-profile
```

Update `serverless.yml` to match your AWS profile.

## Deployment

### Deploy to Development

```bash
npm run deploy
```

### Deploy to Production

```bash
npm run deploy:prod
```

### Seed Tenants

After deployment, seed your tenant data:

```powershell
$env:AWS_REGION='us-west-2'
$env:AWS_PROFILE='your-profile'
npx ts-node scripts/seed-tenants.ts
```

## API Documentation

### Base URL

```
https://{api-id}.execute-api.{region}.amazonaws.com
```

### Interactive Documentation (Swagger UI)

Visit `/docs` in your browser to explore and test the API interactively.
- **UI**: `/docs`
- **Spec**: `/openapi.json`

### Authentication

All endpoints (except `/health` and `/docs`) require API key authentication:

```bash
curl -H "X-Api-Key: your-api-key" https://your-api/endpoint
```

### Endpoints

#### Jobs

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/jobs` | Create crawl job |
| GET | `/jobs` | List jobs |
| GET | `/jobs/{id}` | Get job status |
| GET | `/jobs/{id}/report` | Get report (JSON or Markdown) |

#### Dashboard

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/dashboard/summary` | Overall metrics and recent jobs |
| GET | `/dashboard/trends` | Score trends over time |
| GET | `/alerts` | Active alerts |

#### Schedules

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/schedules` | Create scheduled crawl |
| GET | `/schedules` | List schedules |
| DELETE | `/schedules/{id}` | Delete schedule |

#### Health

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check (no auth required) |

### Create Job Request

```json
{
  "targetUrl": "https://example.com",
  "config": {
    "maxPages": 50,
    "maxDepth": 3
  },
  "competitors": ["https://competitor.com"],
  "webhookUrl": "https://your-webhook.com/callback",
  "llmModel": "gpt-4o-mini"
}
```

### Report Response (AEO)

```json
{
  "meta": {
    "jobId": "uuid",
    "domain": "example.com",
    "pagesAnalyzed": 25
  },
  "scores": {
    "aeoVisibilityScore": 65,
    "llmeoScore": 75,
    "seoScore": 82,
    "overallScore": 70,
    "confidence": 0.85
  },
  "aeoAnalysis": {
    "visibilityScore": 65,
    "queriesAnalyzed": 10,
    "citationRate": 40,
    "citations": [...],
    "competitors": [...],
    "gaps": [...],
    "keyFindings": [...]
  },
  "aeoRecommendations": [...],
  "cursorPrompt": {
    "prompt": "Copy this into Cursor...",
    "sections": [...]
  },
  "llmeoAnalysis": {...},
  "seoAnalysis": {...}
}
```

### Job Statuses

| Status | Description |
|--------|-------------|
| `pending` | Job created, waiting to be queued |
| `queued` | Job in SQS queue |
| `crawling` | Actively crawling pages |
| `analyzing` | Running analysis (LLMEO, SEO, AEO) |
| `completed` | Job finished successfully |
| `failed` | Job encountered an error |
| `blocked` | Site blocked access |

## Project Structure

```
propintel-backend/
+-- src/
|   +-- handlers/           # Lambda function handlers
|   |   +-- job.ts          # Job CRUD operations
|   |   +-- orchestrator.ts # Main job processing
|   |   +-- dashboard.ts    # Dashboard endpoints
|   |   +-- schedules.ts    # Scheduled crawls
|   |   +-- health.ts       # Health check
|   +-- agents/             # AEO Pipeline Agents
|   |   +-- discovery/      # Page analysis, query generation
|   |   +-- research/       # Tavily search, citations
|   |   +-- analysis/       # Scoring, comparison
|   |   +-- output/         # Recommendations, reports
|   +-- analysis/           # Core analysis modules
|   |   +-- llmeo.ts        # LLMEO scoring
|   |   +-- seo.ts          # SEO analysis
|   |   +-- benchmarks.ts   # Industry benchmarks
|   |   +-- gap-analysis.ts # Gap identification
|   +-- lib/                # Shared libraries
|   |   +-- ai.ts           # OpenAI integration
|   |   +-- tavily.ts       # Tavily API client
|   |   +-- dynamodb.ts     # DynamoDB operations
|   |   +-- s3.ts           # S3 operations
|   |   +-- crawler-simple.ts # HTTP crawler
|   |   +-- spa-detector.ts # SPA detection
|   |   +-- renderer.ts     # ECS rendering
|   |   +-- webhooks.ts     # Webhook delivery
|   +-- reports/            # Report generation
|   +-- types/              # TypeScript types
+-- config/
|   +-- tenants.json        # Tenant seed data
+-- scripts/
|   +-- seed-tenants.ts     # Tenant seeding
+-- serverless.yml          # Infrastructure config
```

## Development

### Local Development

```bash
npm run dev
```

### Type Checking

```bash
npm run typecheck
```

### Linting

```bash
npm run lint
```

## Testing

The project includes two types of test suites: API endpoint tests and end-to-end tests.

### API Endpoint Tests

Quick tests that validate individual API endpoints without waiting for job completion.

#### Test Against Local Server

1. Start the local server:
   ```bash
   npm run dev
   ```

2. In another terminal, run the tests:
   ```bash
   npm run test:api
   ```

#### Test Against Deployed API

```bash
npm run test:api -- --url https://your-api-id.execute-api.us-west-2.amazonaws.com
```

#### API Test Options

- `--url <url>` - API base URL (default: `http://localhost:4000`)
- `--api-key <key>` - API key for authentication (default: `propintel-dev-key-2024`)
- `--verbose, -v` - Show detailed request/response information
- `--help, -h` - Show help message

#### API Test Coverage

The API test script validates:

1. ✅ **Health Check** - Verifies `/health` endpoint
2. ✅ **Authentication** - Tests unauthenticated request rejection
3. ✅ **Create Job** - Creates a new crawl job
4. ✅ **Get Job Status** - Retrieves job status by ID
5. ✅ **List Jobs** - Lists all jobs for the tenant
6. ✅ **Get Report** - Retrieves report (if job is completed)
7. ✅ **Error Handling** - Tests invalid job ID handling

### End-to-End Tests

Comprehensive tests that validate the complete job lifecycle from creation to report generation.

#### Run E2E Tests

```bash
# Test against local server
npm run test:e2e

# Test against deployed API
npm run test:e2e -- --url https://your-api-id.execute-api.us-west-2.amazonaws.com

# Test with specific target URL
npm run test:e2e -- --target https://example.com

# Custom timeout (in seconds)
npm run test:e2e -- --timeout 600
```

#### E2E Test Options

- `--url <url>` - API base URL (default: `http://localhost:4000`)
- `--api-key <key>` - API key for authentication (default: `propintel-dev-key-2024`)
- `--target <url>` - Target URL to crawl (default: `https://example.com`)
- `--timeout <sec>` - Timeout in seconds (default: 1200)
- `--verbose, -v` - Show detailed request/response information
- `--help, -h` - Show help message

#### E2E Test Coverage

The E2E test suite validates:

1. ✅ **Job Creation** - Creates a crawl job
2. ✅ **Job Completion** - Polls and waits for job to complete (with timeout)
3. ✅ **Job Metrics** - Validates job metrics (duration, timestamps, progress)
4. ✅ **Report Retrieval** - Retrieves JSON and Markdown reports
5. ✅ **Report Structure** - Validates all required report fields
6. ✅ **Score Validation** - Ensures scores are within valid ranges (0-100)
7. ✅ **Content Quality** - Validates report content completeness

#### E2E Test Example Output

```
PropIntel API End-to-End Test Suite
============================================================
API URL: https://api.example.com
Target URL: https://example.com
Timeout: 1200s
============================================================

✅ Create Job and Wait for Completion
   Status: pending → queued → crawling → analyzing → completed
✅ Validate Job Metrics
✅ Retrieve Report
✅ Validate Report Structure
✅ Validate Score Ranges
✅ Retrieve Markdown Report
✅ Validate Report Content Quality

============================================================
E2E Test Results Summary
============================================================
Job ID: abc-123-def
Target URL: https://example.com
Pages Analyzed: 5

Scores:
  AEO Visibility: 65/100
  LLMEO: 75/100
  SEO: 82/100
  Overall: 70/100

AEO Metrics:
  Queries Analyzed: 10
  Citation Rate: 40%
  Recommendations: 5

Job Duration: 45.23s
============================================================
```

### Environment Variables

You can set these via environment variables for both test suites:

- `API_URL` - API base URL
- `API_KEY` - API key for authentication
- `TARGET_URL` - Target URL for E2E tests (default: `https://example.com`)

### Test Notes

- **API Tests**: Fast endpoint validation, doesn't wait for job completion
- **E2E Tests**: Full lifecycle validation, can take 5-20 minutes depending on target site
- Both test suites use the default tenant API key from `config/tenants.json`
- E2E tests create real jobs with limited scope (5 pages, depth 2) for faster execution

## Configuration

### Tenant Configuration

Edit `config/tenants.json`:

```json
{
  "tenants": [
    {
      "id": "tenant-001",
      "name": "My Company",
      "apiKey": "your-secure-api-key",
      "isActive": true,
      "limits": {
        "maxConcurrentJobs": 2,
        "maxPagesPerJob": 100,
        "maxJobsPerDay": 20
      }
    }
  ]
}
```

### Crawl Configuration

Default limits (configurable per job):

| Setting | Default | Description |
|---------|---------|-------------|
| maxPages | 50 | Maximum pages to crawl |
| maxDepth | 3 | Maximum link depth |
| pageTimeout | 30s | Page load timeout |
| jobTimeout | 15min | Total job timeout |

## Webhook Integration

### Slack

Webhooks to `hooks.slack.com` are automatically formatted with rich attachments showing scores and domain info.

### Discord

Webhooks to `discord.com/api/webhooks` are formatted with embeds and color-coded by score.

### Generic

All other webhooks receive JSON payload:

```json
{
  "event": "job.completed",
  "timestamp": "ISO-8601",
  "data": {
    "summary": {...},
    "report": {...}
  }
}
```

## Monitoring

### CloudWatch Logs

```bash
aws logs tail /aws/lambda/propintel-api-dev-orchestrator --follow
```

### Langfuse Dashboard

All LLM calls are traced in Langfuse with:
- Token usage
- Latency metrics
- Tenant segmentation

### Alerts

The system automatically generates alerts for:
- Score drops > 10 points
- Job failures
- Low visibility scores (< 30)

## Cost Estimates

Per 1,000 jobs/month:

| Service | Cost |
|---------|------|
| AWS Lambda | ~$10-15 |
| DynamoDB | ~$2-5 |
| S3 | ~$1-3 |
| SQS | ~$0.50 |
| Tavily API | ~$10-20 |
| OpenAI API | ~$5-15 |
| **Total** | **~$35-60** |

## Security

- API keys stored securely in DynamoDB
- Multi-tenant data isolation
- Rate limiting (100 req/min)
- No secrets in code or logs
- TLS encryption in transit
- Encryption at rest (DynamoDB, S3)

## Troubleshooting

### Job stuck in "queued"
- Check SQS queue for messages
- Verify orchestrator Lambda logs
- Check for DLQ messages

### Low AEO scores
- Ensure Tavily API key is configured
- Check if target domain is accessible
- Review citation gaps in report

### SPA not rendering
- Verify ECS cluster is running
- Check ECS task definition
- Review renderer Lambda logs

## Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push branch (`git push origin feature/amazing`)
5. Open Pull Request

## License

[Add your license here]

## Support

- Open GitHub issues for bugs
- Check `_docs/` for detailed documentation
- Review CloudWatch logs for debugging
