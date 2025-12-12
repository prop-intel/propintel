# Frontend Integration Guide

This guide describes how to integrate the PropIntel API into your frontend application.

## Authentication & Security

The API uses API Key authentication via the `X-Api-Key` header.

> [!WARNING]
> **Do not expose your main API Key in client-side code.**
> In a production environment, you should proxy requests through your own backend API or use Next.js API Routes / Lambda functions to keep your PropIntel API key secret.

### Proxy Pattern (Recommended)

**Client** -> **Your Backend (Next.js API Route)** -> **PropIntel API**

## API Client Setup

Here is a typed wrapper using `axios` that you can copy into your project.

### `lib/api-client.ts`

```typescript
import axios from 'axios';

// Use your backend proxy URL in production, or direct URL for local dev
// Note: API_URL is server-side only - calls go through Next.js tRPC routes
const API_BASE_URL = process.env.API_URL || '/api/propintel';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export interface Job {
  id: string;
  status: 'pending' | 'queued' | 'crawling' | 'analyzing' | 'completed' | 'failed';
  scores?: {
    overallScore: number;
    aeoVisibilityScore: number;
  };
}

// Start a new job
export const createJob = async (url: string): Promise<Job> => {
  const { data } = await apiClient.post('/jobs', { targetUrl: url });
  return data.data.job;
};

// Get job status
export const getJob = async (jobId: string): Promise<Job> => {
  const { data } = await apiClient.get(`/jobs/${jobId}`);
  return data.data.job;
};
```

## React Hook: useCrawlJob

Since crawl jobs take time (seconds to minutes), you need to poll for status. Here is a reusable React hook that handles polling.

### `hooks/useCrawlJob.ts`

```typescript
import { useState, useEffect, useCallback } from 'react';
import { createJob, getJob, Job } from '../lib/api-client';

export function useCrawlJob() {
  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startJob = async (url: string) => {
    try {
      setLoading(true);
      setError(null);
      const newJob = await createJob(url);
      setJob(newJob);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to start job');
      setLoading(false);
    }
  };

  // Poll for updates while job is active
  useEffect(() => {
    if (!job || ['completed', 'failed', 'blocked'].includes(job.status)) {
      if (job?.status === 'completed') setLoading(false);
      return;
    }

    const intervalId = setInterval(async () => {
      try {
        const updatedJob = await getJob(job.id);
        setJob(updatedJob);
        
        if (updatedJob.status === 'failed' || updatedJob.status === 'blocked') {
          setError('Job failed during processing');
          setLoading(false);
        }
      } catch (err) {
        console.error('Polling error', err);
      }
    }, 3000); // Poll every 3 seconds

    return () => clearInterval(intervalId);
  }, [job]);

  return { job, startJob, loading, error };
}
```

## Usage Example

```tsx
import { useCrawlJob } from '../hooks/useCrawlJob';

export default function Analyzer() {
  const { job, startJob, loading, error } = useCrawlJob();

  return (
    <div>
      <button onClick={() => startJob('https://example.com')} disabled={loading}>
        {loading ? 'Analyzing...' : 'Analyze Site'}
      </button>

      {error && <div className="error">{error}</div>}

      {job && job.status === 'completed' && (
        <div className="results">
          <h2>Score: {job.scores?.overallScore}</h2>
          <p>AEO Visibility: {job.scores?.aeoVisibilityScore}</p>
        </div>
      )}
    </div>
  );
}
```

## Error Handling

Common error codes you might see:

| Code | Meaning | UI Recommendation |
|------|---------|-------------------|
| `RATE_LIMIT_EXCEEDED` | Too many requests | Show "Please wait..." toast |
| `SITE_BLOCKED` | Crawler blocked | "We could not access this site" |
| `INVALID_URL` | Bad URL format | Form validation error |

