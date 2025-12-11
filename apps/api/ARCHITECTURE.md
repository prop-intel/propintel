# PropIntel API Architecture

Comprehensive technical architecture documentation for the PropIntel AEO/LLMEO/SEO Crawler API.

## Table of Contents

1. [System Overview](#system-overview)
2. [High-Level Architecture](#high-level-architecture)
3. [AEO Pipeline Architecture](#aeo-pipeline-architecture)
4. [Component Architecture](#component-architecture)
5. [Data Flow](#data-flow)
6. [Storage Architecture](#storage-architecture)
7. [Security Architecture](#security-architecture)
8. [Scalability & Performance](#scalability--performance)
9. [Technology Stack](#technology-stack)
10. [Deployment Architecture](#deployment-architecture)

## System Overview

PropIntel is a serverless, multi-tenant API that crawls websites and generates comprehensive AEO (Answer Engine Optimization), LLMEO (LLM Engine Optimization), and SEO analysis reports. The system is designed for cost-efficiency, scalability, and reliability.

### Key Design Principles

- **Serverless-First**: Leverage AWS managed services for reduced operational overhead
- **Cost-Optimized**: On-demand resources, no idle infrastructure
- **Multi-Tenant**: Complete data isolation with tenant-scoped operations
- **Event-Driven**: Asynchronous job processing via SQS
- **Observable**: Comprehensive logging and tracing via Langfuse
- **AI-Native**: Deep integration with LLMs for analysis and recommendations

### Primary Metrics

- **AEO Visibility Score** (0-100): Primary metric measuring AI search visibility
- **LLMEO Score** (0-100): LLM optimization readiness
- **SEO Score** (0-100): Traditional search engine optimization
- **Overall Score**: Weighted combination (50% AEO, 30% LLMEO, 20% SEO)

## High-Level Architecture

```
+-------------------------------------------------------------+
|                        Client Layer                          |
|  (Web Apps, CLI Tools, CI/CD Pipelines, Integrations)       |
+-----------------------------+-------------------------------+
                              | HTTPS/REST
                              v
+-------------------------------------------------------------+
|                    API Gateway (HTTP API)                    |
|  - Authentication (API Key)                                  |
|  - Rate Limiting (100 req/min per tenant)                   |
|  - CORS Support                                              |
+-----------------------------+-------------------------------+
                              |
        +---------------------+---------------------+
        |                     |                     |
        v                     v                     v
+---------------+    +---------------+    +---------------+
| Lambda        |    | Lambda        |    | Lambda        |
| Control Plane |    | Dashboard     |    | Schedules     |
|               |    |               |    |               |
| - createJob   |    | - getSummary  |    | - create      |
| - getJob      |    | - getTrends   |    | - list        |
| - listJobs    |    | - getAlerts   |    | - delete      |
| - getReport   |    +-------+-------+    +-------+-------+
+-------+-------+            |                    |
        |                    |                    |
        v                    v                    v
+---------------+    +---------------+    +---------------+
|   DynamoDB    |    |  SQS Queue    |    | EventBridge   |
|               |    |               |    |               |
| - Jobs        |    | - Job Queue   |    | - Scheduled   |
| - Pages       |    | - DLQ         |    |   Rules       |
| - Reports     |    +-------+-------+    +---------------+
| - Tenants     |            |
+---------------+            v
                    +---------------+
                    | Orchestrator  |
                    | Lambda        |
                    |               |
                    | - Crawler     |
                    | - AEO Pipeline|
                    | - Analyzer    |
                    | - Reporter    |
                    +-------+-------+
                            |
        +-------------------+-------------------+
        |                   |                   |
        v                   v                   v
+---------------+   +---------------+   +---------------+
| ECS Fargate   |   |    Tavily     |   |   OpenAI      |
| (SPA Render)  |   |    API        |   |   API         |
+-------+-------+   +---------------+   +---------------+
        |
        v
+---------------+
|      S3       |
|               |
| - Reports     |
| - Snapshots   |
| - Artifacts   |
+---------------+
```

## AEO Pipeline Architecture

The AEO (Answer Engine Optimization) pipeline is the core analysis system that determines how well content appears in AI search results.

### Pipeline Phases

```
+-------------------------------------------------------------------+
|                        AEO PIPELINE                                |
+-------------------------------------------------------------------+
|                                                                    |
|  Phase 1: DISCOVERY                                               |
|  +------------------+    +------------------+    +---------------+ |
|  | Page Analysis    |--->| Query Generation |--->| Competitor    | |
|  | (analyzePages)   |    | (generateTarget  |    | Discovery     | |
|  |                  |    |  Queries)        |    |               | |
|  +------------------+    +------------------+    +---------------+ |
|                                                                    |
|  Phase 2: RESEARCH                                                |
|  +------------------+    +------------------+                      |
|  | Tavily Search    |--->| Citation         |                      |
|  | (researchQueries)|    | Analysis         |                      |
|  |                  |    | (analyzeCitations|                      |
|  +------------------+    +------------------+                      |
|                                                                    |
|  Phase 3: ANALYSIS                                                |
|  +------------------+    +------------------+    +---------------+ |
|  | Citation         |--->| Content          |--->| Visibility    | |
|  | Patterns         |    | Comparison       |    | Scoring       | |
|  +------------------+    +------------------+    +---------------+ |
|                                                                    |
|  Phase 4: OUTPUT                                                  |
|  +------------------+    +------------------+    +---------------+ |
|  | Recommendations  |--->| Cursor Prompt    |--->| Report        | |
|  | Generation       |    | Generation       |    | Generation    | |
|  +------------------+    +------------------+    +---------------+ |
|                                                                    |
+-------------------------------------------------------------------+
```

### Agent System

Each phase is powered by specialized agents:

#### Discovery Agents (`src/agents/discovery/`)
- **Page Analysis**: Extracts topic, intent, entities, and key points from crawled pages
- **Query Generation**: Creates target queries the page should answer in AI search
- **Competitor Discovery**: Identifies competing domains from search results

#### Research Agents (`src/agents/research/`)
- **Tavily Research**: Searches each query via Tavily API
- **Citation Analysis**: Tracks where target domain appears in results

#### Analysis Agents (`src/agents/analysis/`)
- **Citation Patterns**: Deep analysis of citation frequency and positioning
- **Content Comparison**: Compares content against winning competitors
- **Visibility Scoring**: Calculates the AEO Visibility Score (0-100)

#### Output Agents (`src/agents/output/`)
- **Recommendations**: Generates prioritized AEO recommendations
- **Cursor Prompt**: Creates ready-to-paste prompts for Cursor IDE
- **Report Generator**: Produces final AEO report with all metrics

### Visibility Score Calculation

```
AEO Visibility Score = (
    CitationRate * 0.35 +
    RankQuality * 0.25 +
    CompetitivePosition * 0.20 +
    QueryBreadth * 0.10 -
    GapPenalty * 0.10
)
```

## Component Architecture

### API Gateway Layer

**Service**: AWS API Gateway HTTP API v2

**Endpoints**:
- `POST /jobs` - Create crawl job
- `GET /jobs` - List jobs
- `GET /jobs/{id}` - Get job status
- `GET /jobs/{id}/report` - Get report
- `GET /health` - Health check
- `GET /dashboard/summary` - Dashboard metrics
- `GET /dashboard/trends` - Score trends
- `GET /alerts` - Active alerts
- `POST /schedules` - Create scheduled crawl
- `GET /schedules` - List schedules
- `DELETE /schedules/{id}` - Delete schedule
- `GET /docs` - Swagger UI Documentation
- `GET /openapi.json` - OpenAPI Specification

### Lambda Functions

#### Orchestrator Function

**Handler**: `src/handlers/orchestrator.handler`

**Timeout**: 900 seconds (15 minutes)
**Memory**: 1024 MB

**Workflow**:
1. Parse SQS message
2. Update job status to "crawling"
3. Execute crawler (HTTP-based with SPA detection)
4. If SPA detected, launch ECS renderer
5. Run LLMEO/SEO analysis
6. **Run AEO Pipeline**:
   - Discovery phase (page analysis, query generation)
   - Research phase (Tavily search, citation tracking)
   - Analysis phase (citation patterns, content comparison)
   - Output phase (recommendations, Cursor prompt)
7. Generate AEO report
8. Upload to S3
9. Update job status to "completed"
10. Send webhook (Slack/Discord/Generic)

#### Dashboard Functions

**Handlers**: `src/handlers/dashboard.ts`

- `getSummary`: Overall dashboard metrics, recent jobs, alerts
- `getTrends`: Score trends over time with filtering
- `getAlerts`: Active alerts (score drops, errors, gaps)

#### Schedules Functions

**Handlers**: `src/handlers/schedules.ts`

- `createSchedule`: Create EventBridge rule for recurring crawls
- `listSchedules`: List all scheduled crawls
- `deleteSchedule`: Remove scheduled crawl
- `handleScheduledCrawl`: EventBridge trigger handler

### SPA Detection & Rendering

**Detection** (`src/lib/spa-detector.ts`):
- Analyzes word count, heading structure, title/meta presence
- Detects framework indicators (React, Vue, Angular)
- Returns confidence score and recommendation

**Rendering** (`src/lib/renderer.ts`):
- Launches ECS Fargate task with Playwright
- Renders JavaScript-heavy pages
- Returns fully hydrated HTML for analysis

### Analysis Modules

#### Core Analysis (`src/analysis/`)

- **llmeo.ts**: Schema analysis, semantic clarity, content depth, freshness
- **seo.ts**: Indexability, metadata, structure, performance, images
- **benchmarks.ts**: Industry-specific benchmarks and comparisons
- **gap-analysis.ts**: Content, keyword, feature, and schema gap identification
- **template-detector.ts**: Page type detection (article, product, FAQ, etc.)
- **template-rules.ts**: Per-template optimization rules
- **competitor-comparison.ts**: Side-by-side competitor analysis

#### Reports (`src/reports/`)

- **competitive-report.ts**: Competitive analysis report generation
- **diff-generator.ts**: Change detection between crawls
- **reproducibility.ts**: Content stability scoring over time

### External Integrations

#### Tavily API (`src/lib/tavily.ts`)
- Web search for AI-optimized results
- Batch query support with rate limiting
- Domain visibility checking
- Competitor discovery

#### OpenAI (`src/lib/ai.ts`)
- Summary generation
- Recommendation generation
- Copy-ready prompt creation
- Structured output with Zod schemas

#### Langfuse
- Full LLM call tracing
- Token usage tracking
- Tenant-segmented dashboards

#### Webhooks (`src/lib/webhooks.ts`)
- Slack webhook formatting
- Discord webhook formatting
- Generic webhook with retry logic
- Alert notifications

## Data Flow

### Job Processing Flow

```
1. Client creates job via POST /jobs
2. Job record created in DynamoDB (status: pending)
3. Message sent to SQS queue
4. Orchestrator Lambda triggered by SQS
5. Update status: crawling
6. Execute HTTP crawler
7. Check for SPA characteristics
8. If SPA, launch ECS renderer
9. Update status: analyzing
10. Run LLMEO analysis
11. Run SEO analysis
12. Run AEO Pipeline:
    a. Analyze page content (LLM)
    b. Generate target queries (LLM)
    c. Search queries via Tavily
    d. Analyze citations
    e. Discover competitors
    f. Calculate visibility score
    g. Generate recommendations (LLM)
    h. Generate Cursor prompt (LLM)
13. Generate AEO report
14. Upload report to S3 (JSON + Markdown)
15. Update status: completed
16. Increment tenant usage
17. Send webhook notification
```

### AEO Report Structure

```json
{
  "meta": {
    "jobId": "uuid",
    "tenantId": "tenant-id",
    "domain": "example.com",
    "generatedAt": "ISO-8601",
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
    "citationCount": 4,
    "citationRate": 40,
    "pageAnalysis": {...},
    "targetQueries": [...],
    "searchResults": [...],
    "citations": [...],
    "competitors": [...],
    "gaps": [...],
    "topPerformingQueries": [...],
    "missedOpportunities": [...],
    "keyFindings": [...]
  },
  "aeoRecommendations": [...],
  "cursorPrompt": {
    "prompt": "...",
    "sections": [...],
    "version": "v1.0"
  },
  "llmeoAnalysis": {...},
  "seoAnalysis": {...},
  "recommendations": [...],
  "llmSummary": {...},
  "warnings": [...]
}
```

## Storage Architecture

### DynamoDB Schema

**Table**: `propintel-api-{stage}`

**Primary Key**:
- PK: `TENANT#{tenantId}`
- SK: `JOB#{jobId}` | `PAGE#{jobId}#{url}` | `REPORT#{jobId}` | `TENANT#{tenantId}`

**GSI1** (Job lookup):
- GSI1PK: `JOB#{jobId}`
- GSI1SK: `{timestamp}`

**New Entity Types**:
- `SCHEDULE`: Scheduled crawl configuration
- `ALERT`: Active alerts for tenant
- `DIFF`: Diff report references

### S3 Structure

```
{tenantId}/{jobId}/
  +-- snapshots/
  |   +-- {encoded-url}.html
  +-- data/
  |   +-- pages.json
  |   +-- rendered-pages.json (if SPA)
  +-- reports/
      +-- report.json
      +-- report.md
```

## Security Architecture

### Authentication
- API Key via `X-Api-Key` header
- Key lookup in DynamoDB
- Tenant validation and isolation

### Rate Limiting
- 100 requests/minute per tenant
- In-memory store per Lambda instance

### Secrets Management
- `OPENAI_API_KEY`: OpenAI API access
- `TAVILY_API_KEY`: Tavily search API
- `LANGFUSE_PUBLIC_KEY` / `LANGFUSE_SECRET_KEY`: Observability
- All via environment variables

## Technology Stack

### Runtime
- **Node.js**: 20.x
- **TypeScript**: 5.6+
- **Build**: esbuild

### AWS Services
- Lambda, ECS Fargate, DynamoDB, S3, SQS, EventBridge, API Gateway, CloudWatch

### External APIs
- **OpenAI**: GPT-4o-mini (default), GPT-4o
- **Tavily**: AI-optimized search
- **Langfuse**: LLM observability

### Key Libraries
- `@aws-sdk/*`: AWS service clients
- `ai` + `@ai-sdk/openai`: Vercel AI SDK
- `langfuse`: Tracing
- `zod`: Schema validation
- `cheerio`: HTML parsing
- `playwright`: SPA rendering (ECS)

## Deployment Architecture

### Infrastructure as Code

**Tool**: Serverless Framework v4

**Resources**:
- VPC (10.0.0.0/16) with 2 public subnets
- DynamoDB table (on-demand)
- S3 bucket with lifecycle policy
- SQS queue + DLQ
- ECS cluster + task definitions (crawler, renderer)
- Lambda functions (7 total)
- API Gateway HTTP API
- IAM roles and policies

### Environment Stages

- **dev**: Development/testing
- **prod**: Production

### Deployment Commands

```bash
# Deploy all
npm run deploy

# Deploy to production
npm run deploy:prod

# Deploy single function
npx serverless deploy function --function orchestrator
```

## Monitoring & Observability

### CloudWatch Metrics
- Lambda: invocations, errors, duration
- DynamoDB: read/write capacity
- SQS: queue depth, message age
- ECS: task count, CPU/memory

### Langfuse Tracing
- All LLM calls traced with metadata
- Token usage tracking
- Tenant-segmented views

### Alerts
- Automatic detection of score drops
- Job failure notifications
- Low visibility warnings

## Cost Optimization

**Estimated Costs** (per 1000 jobs/month):
- Lambda: ~$10-15
- DynamoDB: ~$2-5
- S3: ~$1-3
- SQS: ~$0.50
- API Gateway: ~$3.50
- Tavily API: ~$10-20 (depends on queries)
- OpenAI API: ~$5-15 (depends on model)
- **Total**: ~$35-60/month

**Optimization Strategies**:
- On-demand ECS tasks
- S3 lifecycle policies (30-day retention)
- DynamoDB TTL
- Right-sized Lambda memory
- Batch Tavily queries
