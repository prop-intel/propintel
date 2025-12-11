# PropIntel Backend API Integration

This directory contains the frontend integration layer for the PropIntel backend API.

## Overview

The backend API client provides type-safe access to the PropIntel analysis service. It handles:

- **Authentication**: Session token validation via NextAuth cookies
- **Job Management**: Create, list, and monitor analysis jobs
- **Reports**: Fetch analysis reports in JSON or Markdown format
- **Dashboard**: Get summary metrics, trends, and alerts

## Files

- `types.ts` - TypeScript type definitions for all API responses
- `client.ts` - API client with request handling and error management
- `index.ts` - Main export file

## Usage

### Basic API Client

```typescript
import { api } from "@/lib/api";

// Create a job
const { job } = await api.jobs.create({
  targetUrl: "https://example.com",
  config: { maxPages: 50 },
});

// Get job status
const { job } = await api.jobs.get(jobId);

// Get report (JSON)
const report = await api.jobs.getReport(jobId, "json");

// Get report (Markdown)
const markdown = await api.jobs.getReport(jobId, "md");

// Dashboard summary
const summary = await api.dashboard.getSummary();

// Score trends
const trends = await api.dashboard.getTrends("example.com", 30);
```

### React Hooks

Use the provided React hooks for data fetching with automatic caching and polling:

```typescript
import { useJobQuery, useCreateJob, useJobReport } from "@/hooks/use-jobs";
import { useDashboardSummary, useScoreTrends } from "@/hooks/use-dashboard";

// Poll job status (automatically stops when complete)
const { data: job, isLoading } = useJobQuery(jobId);

// Create a new job
const createJob = useCreateJob();
createJob.mutate({
  targetUrl: "https://example.com",
});

// Get report (only fetches when job is completed)
const { data: report } = useJobReport(jobId, "json");

// Dashboard data
const { data: summary } = useDashboardSummary();
const { data: trends } = useScoreTrends("example.com", 30);
```

### Manual Job Polling

For more control over polling, use the `useJob` hook:

```typescript
import { useJob } from "@/hooks/use-job";

const { job, loading, error, isTerminal } = useJob(jobId, {
  interval: 3000, // Poll every 3 seconds
  onComplete: (job) => {
    console.log("Job completed:", job);
  },
  onError: (error) => {
    console.error("Job error:", error);
  },
});
```

## Error Handling

The API client throws `ApiClientError` for API errors:

```typescript
import { api, ApiClientError } from "@/lib/api";

try {
  const { job } = await api.jobs.create({ targetUrl: "..." });
} catch (error) {
  if (error instanceof ApiClientError) {
    console.error("Error code:", error.code);
    console.error("Error message:", error.message);
    console.error("Error details:", error.details);
  }
}
```

## Environment Variables

Add these to your `.env` file:

```env
# Backend API URL (required)
NEXT_PUBLIC_API_URL=https://xxx.execute-api.us-west-2.amazonaws.com

# API Key for development (optional)
NEXT_PUBLIC_API_KEY=propintel-dev-key-2024
```

## Authentication

The API client automatically handles authentication:

1. **Session Token** (Production): Uses NextAuth session cookies sent with `credentials: 'include'`
2. **API Key** (Development): Uses `X-Api-Key` header if `NEXT_PUBLIC_API_KEY` is set

## Type Safety

All API responses are fully typed. Import types as needed:

```typescript
import type {
  Job,
  Report,
  Scores,
  Recommendation,
  DashboardSummary,
  ScoreTrends,
  Alert,
} from "@/lib/api";
```

## Common Patterns

### Creating and Monitoring a Job

```typescript
import { useCreateJob, useJobQuery } from "@/hooks/use-jobs";

function AnalyzeSite() {
  const createJob = useCreateJob();
  const { data: job } = useJobQuery(createJob.data?.id ?? null);

  const handleSubmit = async (url: string) => {
    const result = await createJob.mutateAsync({
      targetUrl: url,
      config: { maxPages: 50 },
    });
    // Job ID is now available in createJob.data
  };

  return (
    <div>
      {job?.status === "analyzing" && (
        <p>Progress: {job.progress.pagesCrawled} / {job.progress.pagesTotal}</p>
      )}
      {job?.status === "completed" && (
        <p>Analysis complete!</p>
      )}
    </div>
  );
}
```

### Displaying Report Data

```typescript
import { useJobReport } from "@/hooks/use-jobs";
import type { Report } from "@/lib/api";

function ReportView({ jobId }: { jobId: string }) {
  const { data: report } = useJobReport(jobId, "json") as { data: Report | null };

  if (!report) return <div>Loading...</div>;

  return (
    <div>
      <h2>Scores</h2>
      <p>AEO Score: {report.scores.aeoVisibilityScore}</p>
      <p>LLMEO Score: {report.scores.llmeoScore}</p>
      <p>SEO Score: {report.scores.seoScore}</p>
      <p>Overall: {report.scores.overallScore}</p>

      <h2>Recommendations</h2>
      {report.aeoRecommendations.map((rec) => (
        <div key={rec.id}>
          <h3>{rec.title}</h3>
          <p>{rec.description}</p>
          <p>Priority: {rec.priority}</p>
          <p>Impact: {rec.impact}</p>
        </div>
      ))}
    </div>
  );
}
```

## API Reference

See the [Backend Integration Guide](../../../BACKEND_INTEGRATION_GUIDE.md) for complete API documentation.
