# Reports System Documentation

## Overview

The reports system generates, stores, and retrieves analysis reports for completed jobs. Reports contain SEO/AEO scores, recommendations, and AI-generated summaries.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Report Generation                            │
│                                                                      │
│  Job Processing (API)                                                │
│  ├── Phase 1: Crawl site                                            │
│  ├── Phase 2: LLMEO/SEO analysis                                    │
│  ├── Phase 3: AEO pipeline (orchestrator agent)                     │
│  │   └── Multiple agent phases (Discovery → Research → Analysis     │
│  │       → Scoring → Output)                                        │
│  └── Final: Generate & upload report to S3                          │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         Report Storage                               │
│                                                                      │
│  S3 Bucket (or local .local-storage/ in dev)                        │
│  └── {userId}/{jobId}/reports/                                      │
│      ├── report.json    (structured data)                           │
│      └── report.md      (human-readable markdown)                   │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         Report Access                                │
│                                                                      │
│  Next.js Web App (tRPC)                                             │
│  ├── orchestrator.getStatus  →  Direct S3 read (for completed jobs) │
│  └── job.getReport           →  Direct S3 read                      │
│                                                                      │
│  Both routes read directly from S3 using @aws-sdk/client-s3         │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Report Generation

Reports are generated at the end of job processing in `apps/api/src/handlers/orchestrator.ts`.

### Generation Flow

1. **Job completes all phases** - Crawling, analysis, and agent pipeline finish
2. **Report data compiled** - Scores, recommendations, and summaries aggregated
3. **Upload to S3** - Both JSON and Markdown versions uploaded
4. **Job marked complete** - Status updated in database

### Key Files

| File | Purpose |
|------|---------|
| `apps/api/src/handlers/orchestrator.ts` | Orchestrates job processing, uploads final report |
| `apps/api/src/agents/output/report-generator.ts` | Generates markdown from report data |
| `apps/api/src/lib/s3.ts` | S3 upload/download utilities |

---

## Report Storage

### S3 Key Structure

```
{userId}/{jobId}/reports/report.json
{userId}/{jobId}/reports/report.md
```

### Storage Configuration

| Environment Variable | Purpose |
|---------------------|---------|
| `S3_BUCKET` | S3 bucket name (default: `propintel-api-dev-storage`) |
| `USE_LOCAL_STORAGE` | Set to `true` for local file storage |
| `LOCAL_STORAGE_PATH` | Path to local storage directory |
| `AWS_REGION` | AWS region (default: `us-west-2`) |
| `AWS_ACCESS_KEY_ID` | AWS credentials |
| `AWS_SECRET_ACCESS_KEY` | AWS credentials |

### Local Development

When `USE_LOCAL_STORAGE=true`, reports are stored in the filesystem:
```
apps/api/.local-storage/{userId}/{jobId}/reports/report.json
apps/api/.local-storage/{userId}/{jobId}/reports/report.md
```

---

## Report Access

### Server-Side Access (tRPC Routes)

Reports are accessed directly from S3 in the Next.js server-side tRPC routes.

#### `orchestrator.getStatus`

**File:** `apps/web/src/server/api/routers/orchestrator.ts`

Called repeatedly during job polling. For completed jobs, fetches report from S3:

```typescript
if (job.status === "completed") {
  const reportContent = await getReport(ctx.session.user.id, input.jobId, "json");
  // Parse and return report summary
}
```

#### `job.getReport`

**File:** `apps/web/src/server/api/routers/job.ts`

Dedicated endpoint for fetching full report:

```typescript
const reportContent = await getReportFromStorage(ctx.session.user.id, input.id, input.format);
// Returns JSON object or markdown string based on format
```

### Storage Utility

**File:** `apps/web/src/lib/storage/s3.ts`

Shared utility for reading reports from S3 or local storage:

```typescript
export async function getReport(
  userId: string,
  jobId: string,
  format: 'json' | 'md' = 'json'
): Promise<string | null>
```

---

## Report Data Structure

### JSON Report (`report.json`)

```typescript
interface AEOReport {
  meta: {
    jobId: string;
    domain: string;
    generatedAt: string;
    pagesAnalyzed: number;
  };

  scores: {
    aeoScore: number;      // 0-100
    seoScore: number;      // 0-100
    overallScore: number;  // 0-100
    confidence: number;    // 0-1
  };

  llmSummary: {
    strengths: string[];
    weaknesses: string[];
    opportunities: string[];
    nextSteps: string[];
  };

  aeoRecommendations: Recommendation[];
  recommendations: Recommendation[];

  // Additional analysis data...
}
```

### Markdown Report (`report.md`)

Human-readable version with:
- Executive summary with scores
- Top priority actions
- LLMEO/SEO analysis breakdown
- AI-generated insights
- Competitor comparison (if available)
- Copy-ready prompts

---

## Data Flow Diagram

```
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│  Client  │────▶│  tRPC    │────▶│  S3      │────▶│  Report  │
│  (React) │     │  Router  │     │  Storage │     │  Data    │
└──────────┘     └──────────┘     └──────────┘     └──────────┘
     │                │                                  │
     │                │                                  │
     │    getStatus   │         Direct S3 Read           │
     │───────────────▶│─────────────────────────────────▶│
     │                │                                  │
     │   Report Data  │                                  │
     │◀───────────────│◀─────────────────────────────────│
```

### Previous Architecture (Removed)

Previously, reports were fetched via HTTP:
```
Client → tRPC → HTTP API → S3
```

This added ~2.5s latency due to:
- Extra HTTP hop
- Duplicate authentication
- TLS handshake overhead

### Current Architecture

Reports are now fetched directly:
```
Client → tRPC → S3
```

Benefits:
- ~75% latency reduction for completed job status
- No duplicate authentication
- Simpler code path

---

## Configuration

### Web App (`apps/web/.env`)

```bash
# S3 Storage (for direct report reads - server-side only)
AWS_REGION=us-west-2
AWS_ACCESS_KEY_ID=your-key
AWS_SECRET_ACCESS_KEY=your-secret
S3_BUCKET=propintel-api-dev-storage

# Local Development Storage
USE_LOCAL_STORAGE=true
LOCAL_STORAGE_PATH=../api/.local-storage
```

### API (`apps/api/.env`)

```bash
# S3 Storage
AWS_REGION=us-west-2
AWS_ACCESS_KEY_ID=your-key
AWS_SECRET_ACCESS_KEY=your-secret
S3_BUCKET=propintel-api-dev-storage

# Local Development
USE_LOCAL_STORAGE=true
```

---

## Related Files

| File | Description |
|------|-------------|
| `apps/web/src/lib/storage/s3.ts` | Web app S3 reader utility |
| `apps/web/src/server/api/routers/orchestrator.ts` | Status polling with report fetch |
| `apps/web/src/server/api/routers/job.ts` | Report retrieval endpoint |
| `apps/api/src/lib/s3.ts` | API S3 utilities (read/write) |
| `apps/api/src/handlers/orchestrator.ts` | Report generation and upload |
| `apps/api/src/agents/output/report-generator.ts` | Markdown report generator |
