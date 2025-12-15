# PropIntel Backend API Integration

This directory contains the frontend integration layer for the PropIntel backend API.

## Overview

The backend API client provides type-safe access to the PropIntel analysis service. It handles:

- **Authentication**: Session token validation via NextAuth cookies
- **Job Management**: Create analysis jobs (listing and status via tRPC)
- **Dashboard**: Get summary metrics, trends, and alerts

> **Note**: Reports are now fetched via tRPC routes that read directly from S3 storage for better performance.

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

// Dashboard summary
const summary = await api.dashboard.getSummary();

// Score trends
const trends = await api.dashboard.getTrends("example.com", 30);
```

> **Note**: Job listing, status polling, and **reports** should use tRPC routes for better performance.

### React Hooks

Use the provided React hooks for data fetching with automatic caching:

```typescript
import { useCreateJob } from "@/hooks/use-jobs";
import { useDashboardSummary, useScoreTrends } from "@/hooks/use-dashboard";
import { api } from "@/trpc/react";

// Create a new job
const createJob = useCreateJob();
createJob.mutate({
  targetUrl: "https://example.com",
});

// Get report via tRPC (reads directly from S3)
const { data: report } = api.job.getReport.useQuery(
  { id: jobId, format: "json" },
  { enabled: !!jobId }
);

// Dashboard data
const { data: summary } = useDashboardSummary();
const { data: trends } = useScoreTrends("example.com", 30);
```

> **Note**: For job status polling, use the tRPC `api.job.get` query with `refetchInterval`.

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
# Backend API URL (required, server-side only)
API_URL=https://xxx.execute-api.us-west-2.amazonaws.com

# API Key for development (optional, server-side only)
API_KEY=propintel-dev-key-2024
```

## Authentication

The API client automatically handles authentication:

1. **Session Token** (Production): Uses NextAuth session cookies sent with `credentials: 'include'`
2. **API Key** (Development): Uses `X-Api-Key` header if `API_KEY` is set

Note: These environment variables are server-side only. All API calls go through Next.js tRPC routes, never directly from the browser.

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
import { useCreateJob } from "@/hooks/use-jobs";
import { api } from "@/trpc/react";

function AnalyzeSite() {
  const createJob = useCreateJob();
  const [jobId, setJobId] = useState<string | null>(null);

  // Use tRPC for job status polling
  const { data: job } = api.job.get.useQuery(
    { id: jobId! },
    {
      enabled: !!jobId,
      refetchInterval: (query) => {
        const job = query.state.data;
        if (!job || ["completed", "failed"].includes(job.status)) return false;
        return 3000; // Poll every 3 seconds
      },
    }
  );

  const handleSubmit = async (url: string) => {
    const result = await createJob.mutateAsync({
      targetUrl: url,
      config: { maxPages: 50 },
    });
    setJobId(result.id);
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
import { api } from "@/trpc/react";
import type { Report } from "@/lib/api";

function ReportView({ jobId }: { jobId: string }) {
  const { data: report, isLoading } = api.job.getReport.useQuery(
    { id: jobId, format: "json" },
    { enabled: !!jobId }
  ) as { data: Report | null; isLoading: boolean };

  if (isLoading) return <div>Loading...</div>;
  if (!report) return <div>No report available</div>;

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
