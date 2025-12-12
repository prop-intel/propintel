# PropIntel Backend Integration Guide for Frontend

This document describes the PropIntel backend API and how to integrate it with the frontend application. Use this as context when implementing frontend features.

---

## Overview

PropIntel is an AEO (Answer Engine Optimization), LLMEO (LLM Engine Optimization), and SEO analysis platform. The backend is a serverless API built on AWS that:

1. **Crawls websites** and extracts SEO/content data
2. **Analyzes content** for AI search visibility (ChatGPT, Perplexity, Google AI)
3. **Generates reports** with scores, recommendations, and Cursor-ready prompts
4. **Tracks trends** over time with dashboard metrics and alerts

---

## Authentication

The backend supports **two authentication methods**:

### 1. Session Token Authentication (Primary - for Frontend)

The backend validates NextAuth.js v5 session tokens from the shared PostgreSQL database.

**How it works:**
- Frontend uses NextAuth.js for authentication (Google OAuth, credentials)
- Session tokens are stored in `auth_session` table
- Backend validates tokens via `Authorization: Bearer <session-token>` header OR session cookie

**Cookie names supported:**
- `authjs.session-token` (NextAuth v5)
- `next-auth.session-token` (legacy)

### 2. API Key Authentication (Development/Testing)

For development: `X-Api-Key: propintel-dev-key-2024`

---

## Shared Database Schema

The frontend and backend share the same PostgreSQL database. The auth tables are managed by the frontend (NextAuth), and the backend tables are managed by the backend.

### Auth Tables (Frontend-owned, Backend reads)

```sql
-- auth_user (managed by NextAuth)
id: UUID (primary key)
name: text
email: text (unique)
email_verified: timestamp
image: text
password: text (hashed, for credentials auth)
role: text (default: 'user')

-- auth_session (managed by NextAuth)
session_token: varchar(255) (primary key)
user_id: UUID (references auth_user)
expires: timestamp

-- auth_account (managed by NextAuth)
user_id, type, provider, provider_account_id, tokens...
```

### Backend Tables

```sql
-- jobs
id: UUID
user_id: UUID (references auth_user)
target_url: text
status: 'pending' | 'queued' | 'crawling' | 'analyzing' | 'completed' | 'failed' | 'blocked'
config: JSONB (crawl settings)
competitors: JSONB (array of competitor URLs)
webhook_url: text
llm_model: text (default: 'gpt-4o-mini')
progress: JSONB { pagesCrawled, pagesTotal, currentPhase }
metrics: JSONB { startedAt, completedAt, durationMs, apiCallsCount }
error: JSONB { code, message, details }
created_at, updated_at: timestamp

-- analyses (summary data for fast dashboard queries)
id: UUID
job_id: UUID
user_id: UUID
domain: text
scores: JSONB { aeoVisibilityScore, llmeoScore, seoScore, overallScore }
key_metrics: JSONB { citationRate, queriesAnalyzed, citationCount, topCompetitors }
summary: JSONB { topFindings, topRecommendations, grade }
report_s3_key: text
generated_at: timestamp
```

---

## API Endpoints

**Base URL:** Your deployed API Gateway URL (e.g., `https://xxx.execute-api.us-west-2.amazonaws.com`)

### Jobs API

#### Create Job
```http
POST /jobs
Content-Type: application/json
Authorization: Bearer <session-token>

{
  "targetUrl": "https://example.com",
  "config": {
    "maxPages": 50,
    "maxDepth": 3
  },
  "competitors": ["https://competitor1.com"],
  "webhookUrl": "https://your-app.com/webhook",
  "llmModel": "gpt-4o-mini"
}
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "job": {
      "id": "uuid",
      "status": "queued",
      "targetUrl": "https://example.com",
      "progress": {
        "pagesCrawled": 0,
        "pagesTotal": 0,
        "currentPhase": "pending"
      },
      "createdAt": "2024-01-01T00:00:00Z"
    }
  },
  "meta": {
    "requestId": "uuid",
    "timestamp": "ISO-8601"
  }
}
```

#### Get Job Status
```http
GET /jobs/{id}
Authorization: Bearer <session-token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "job": {
      "id": "uuid",
      "status": "analyzing",
      "targetUrl": "https://example.com",
      "progress": {
        "pagesCrawled": 25,
        "pagesTotal": 50,
        "currentPhase": "Running AEO analysis"
      },
      "metrics": {
        "startedAt": "ISO-8601",
        "apiCallsCount": 15
      }
    }
  }
}
```

#### List Jobs
```http
GET /jobs?limit=20&offset=0
Authorization: Bearer <session-token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "jobs": [...],
    "pagination": {
      "limit": 20,
      "offset": 0,
      "hasMore": true
    }
  }
}
```

#### Get Report
```http
GET /jobs/{id}/report?format=json
Authorization: Bearer <session-token>
```

**Query params:**
- `format`: `json` (default) or `md` (markdown)

**Response (JSON format):**
```json
{
  "meta": {
    "jobId": "uuid",
    "tenantId": "user-id",
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
    "pageAnalysis": {
      "topic": "...",
      "intent": "informational",
      "entities": ["..."],
      "summary": "..."
    },
    "targetQueries": [
      { "query": "...", "type": "how-to", "relevanceScore": 85 }
    ],
    "citations": [
      {
        "query": "how to ...",
        "yourPosition": "cited",
        "yourRank": 2,
        "topResults": [
          { "domain": "competitor.com", "url": "...", "rank": 1 }
        ]
      }
    ],
    "competitors": [
      {
        "domain": "competitor.com",
        "citationCount": 8,
        "citationRate": 80,
        "averageRank": 1.5,
        "strengths": ["..."]
      }
    ],
    "gaps": [
      {
        "query": "...",
        "yourPosition": "absent",
        "winningDomain": "competitor.com",
        "winningUrl": "...",
        "suggestedAction": "Create content about..."
      }
    ],
    "topPerformingQueries": ["..."],
    "missedOpportunities": ["..."],
    "keyFindings": ["..."]
  },
  "aeoRecommendations": [
    {
      "id": "rec-1",
      "priority": "high",
      "category": "visibility",
      "title": "Add FAQ schema",
      "description": "...",
      "impact": "Could increase visibility by 15%",
      "effort": "low",
      "targetQueries": ["..."],
      "competitorExample": {
        "domain": "...",
        "url": "...",
        "whatTheyDoBetter": "..."
      }
    }
  ],
  "cursorPrompt": {
    "prompt": "Copy this into Cursor to optimize your content...",
    "sections": [
      { "name": "FAQ Section", "action": "add", "content": "..." }
    ],
    "version": "v1.0"
  },
  "llmeoAnalysis": {
    "score": 75,
    "schemaAnalysis": { "score": 80, "schemasFound": ["Article", "FAQ"] },
    "semanticClarity": { "score": 70, "issues": [] },
    "contentDepth": { "score": 75, "thinContentPages": [] }
  },
  "seoAnalysis": {
    "score": 82,
    "indexability": { "score": 90 },
    "metadata": { "score": 85 },
    "structure": { "score": 80 },
    "performance": { "score": 75, "averageLoadTime": 1200 },
    "images": { "score": 70, "missingAlt": ["..."] }
  },
  "recommendations": [...],
  "llmSummary": {
    "strengths": ["..."],
    "weaknesses": ["..."],
    "opportunities": ["..."],
    "nextSteps": ["..."]
  }
}
```

---

### Dashboard API

#### Get Dashboard Summary
```http
GET /dashboard/summary
Authorization: Bearer <session-token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "overview": {
      "totalJobs": 50,
      "completedJobs": 45,
      "failedJobs": 2,
      "averageScore": 68,
      "scoreChange": 5
    },
    "recentJobs": [
      {
        "jobId": "uuid",
        "domain": "example.com",
        "status": "completed",
        "aeoScore": 72,
        "completedAt": "ISO-8601"
      }
    ],
    "topDomains": [
      {
        "domain": "example.com",
        "jobCount": 10,
        "latestScore": 72,
        "trend": "up"
      }
    ],
    "alerts": [
      {
        "type": "score_drop",
        "severity": "warning",
        "message": "example.com AEO score dropped by 12 points",
        "domain": "example.com",
        "createdAt": "ISO-8601"
      }
    ]
  }
}
```

#### Get Score Trends
```http
GET /dashboard/trends?domain=example.com&days=30
Authorization: Bearer <session-token>
```

**Query params:**
- `domain`: Filter by domain (optional, defaults to all)
- `days`: Number of days (default: 30)

**Response:**
```json
{
  "success": true,
  "data": {
    "domain": "example.com",
    "period": "30 days",
    "trends": [
      {
        "date": "2024-01-01",
        "aeoScore": 65,
        "llmeoScore": 70,
        "seoScore": 80,
        "citationRate": 35
      }
    ]
  }
}
```

#### Get Alerts
```http
GET /alerts
Authorization: Bearer <session-token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "alerts": [
      {
        "type": "score_drop" | "new_competitor" | "gap_identified" | "error",
        "severity": "critical" | "warning" | "info",
        "message": "...",
        "domain": "example.com",
        "createdAt": "ISO-8601"
      }
    ]
  }
}
```

---

### Health Check
```http
GET /health
```
No authentication required.

---

## Job Status Flow

```
pending → queued → crawling → analyzing → completed
                                       ↘ failed
                                       ↘ blocked
```

**Status meanings:**
- `pending`: Job created, waiting to be queued
- `queued`: Job in processing queue
- `crawling`: Actively crawling pages
- `analyzing`: Running AEO/LLMEO/SEO analysis
- `completed`: Analysis complete, report available
- `failed`: Error during processing
- `blocked`: Site blocked crawler access

---

## Primary Scores

| Score | Weight | Description |
|-------|--------|-------------|
| **AEO Visibility Score** | 50% | How often content appears in AI search (ChatGPT, Perplexity) |
| LLMEO Score | 30% | LLM optimization readiness (schema, semantic clarity) |
| SEO Score | 20% | Traditional search engine optimization |
| **Overall Score** | - | Weighted combination of all three |

All scores are 0-100.

---

## Error Responses

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable message",
    "details": "Optional additional info"
  },
  "meta": {
    "requestId": "uuid",
    "timestamp": "ISO-8601"
  }
}
```

**Common error codes:**
- `MISSING_AUTH`: No session token provided
- `INVALID_SESSION`: Session expired or invalid
- `INVALID_API_KEY`: Invalid API key
- `RATE_LIMIT_EXCEEDED`: Too many requests (100/min limit)
- `CONCURRENT_LIMIT`: Max concurrent jobs (5) reached
- `NOT_FOUND`: Resource not found
- `NOT_READY`: Report not ready (job not completed)
- `INVALID_URL`: Invalid target URL format
- `MISSING_FIELD`: Required field missing

---

## Frontend Integration Patterns

### 1. API Client Setup

```typescript
// lib/api.ts
// Note: API_URL is server-side only - calls go through Next.js tRPC routes
const API_URL = process.env.API_URL;

async function apiRequest<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    credentials: 'include', // Send session cookie
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  const data = await res.json();

  if (!data.success) {
    throw new Error(data.error?.message || 'API Error');
  }

  return data.data;
}

export const api = {
  jobs: {
    create: (targetUrl: string, config?: object) =>
      apiRequest('/jobs', {
        method: 'POST',
        body: JSON.stringify({ targetUrl, ...config }),
      }),
    get: (id: string) => apiRequest(`/jobs/${id}`),
    list: (limit = 20, offset = 0) =>
      apiRequest(`/jobs?limit=${limit}&offset=${offset}`),
    getReport: (id: string, format: 'json' | 'md' = 'json') =>
      apiRequest(`/jobs/${id}/report?format=${format}`),
  },
  dashboard: {
    getSummary: () => apiRequest('/dashboard/summary'),
    getTrends: (domain?: string, days = 30) =>
      apiRequest(`/dashboard/trends?${domain ? `domain=${domain}&` : ''}days=${days}`),
    getAlerts: () => apiRequest('/alerts'),
  },
};
```

### 2. Job Polling Hook

Jobs take 30s-5min to complete. Use polling:

```typescript
// hooks/useJob.ts
import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';

export function useJob(jobId: string | null) {
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const isTerminal = (status: string) =>
    ['completed', 'failed', 'blocked'].includes(status);

  useEffect(() => {
    if (!jobId) return;

    setLoading(true);
    const poll = async () => {
      try {
        const { job } = await api.jobs.get(jobId);
        setJob(job);

        if (isTerminal(job.status)) {
          setLoading(false);
          return;
        }
      } catch (err) {
        setError(err.message);
        setLoading(false);
        return;
      }
    };

    poll();
    const interval = setInterval(poll, 3000);

    return () => clearInterval(interval);
  }, [jobId]);

  return { job, loading, error };
}
```

### 3. Report Display Components

Key data to display:

```typescript
// Score cards
scores.aeoVisibilityScore  // Primary metric (0-100)
scores.llmeoScore
scores.seoScore
scores.overallScore

// AEO insights
aeoAnalysis.citationRate      // % of queries where you appear
aeoAnalysis.queriesAnalyzed   // Number of queries tested
aeoAnalysis.gaps              // Where competitors beat you
aeoAnalysis.topPerformingQueries
aeoAnalysis.missedOpportunities

// Recommendations list
aeoRecommendations.map(rec => ({
  priority: rec.priority,     // 'high' | 'medium' | 'low'
  category: rec.category,     // 'visibility' | 'content' | 'structure' | 'authority'
  title: rec.title,
  description: rec.description,
  impact: rec.impact,
  effort: rec.effort,
}))

// Cursor prompt (copy to clipboard)
cursorPrompt.prompt
```

### 4. Dashboard Data

```typescript
// Overview metrics
overview.averageScore      // Average AEO score
overview.scoreChange       // Change vs previous period (signed)
overview.totalJobs
overview.completedJobs
overview.failedJobs

// Recent jobs list
recentJobs.map(j => ({
  id: j.jobId,
  domain: j.domain,
  score: j.aeoScore,
  status: j.status,
  date: j.completedAt,
}))

// Top domains with trends
topDomains.map(d => ({
  domain: d.domain,
  score: d.latestScore,
  trend: d.trend,  // 'up' | 'down' | 'stable'
  jobCount: d.jobCount,
}))

// Alerts
alerts.map(a => ({
  type: a.type,
  severity: a.severity,
  message: a.message,
}))
```

---

## TypeScript Types

```typescript
// Job
interface Job {
  id: string;
  status: 'pending' | 'queued' | 'crawling' | 'analyzing' | 'completed' | 'failed' | 'blocked';
  targetUrl: string;
  progress: {
    pagesCrawled: number;
    pagesTotal: number;
    currentPhase: string;
  };
  metrics: {
    startedAt?: string;
    completedAt?: string;
    durationMs?: number;
  };
  error?: {
    code: string;
    message: string;
  };
  createdAt: string;
  updatedAt: string;
}

// Report Scores
interface Scores {
  aeoVisibilityScore: number;
  llmeoScore: number;
  seoScore: number;
  overallScore: number;
  confidence: number;
}

// Recommendation
interface Recommendation {
  id: string;
  priority: 'high' | 'medium' | 'low';
  category: string;
  title: string;
  description: string;
  impact: string;
  effort: 'low' | 'medium' | 'high';
}

// Dashboard Summary
interface DashboardSummary {
  overview: {
    totalJobs: number;
    completedJobs: number;
    failedJobs: number;
    averageScore: number;
    scoreChange: number;
  };
  recentJobs: {
    jobId: string;
    domain: string;
    status: string;
    aeoScore: number;
    completedAt: string;
  }[];
  topDomains: {
    domain: string;
    jobCount: number;
    latestScore: number;
    trend: 'up' | 'down' | 'stable';
  }[];
  alerts: Alert[];
}

// Alert
interface Alert {
  type: 'score_drop' | 'new_competitor' | 'gap_identified' | 'error';
  severity: 'critical' | 'warning' | 'info';
  message: string;
  domain?: string;
  createdAt: string;
}
```

---

## Environment Variables

Frontend needs:

```env
# API URL (deployed backend, server-side only)
API_URL=https://xxx.execute-api.us-west-2.amazonaws.com

# Shared database connection (same as backend)
DATABASE_URL=postgresql://user:pass@host:5432/propintel
```

---

## Important Notes

1. **Session sharing**: Frontend and backend share the same PostgreSQL database for auth. The frontend manages users/sessions via NextAuth, and the backend validates sessions from the same tables.

2. **CORS**: The backend has CORS enabled (`Access-Control-Allow-Origin: *`). For production, you may want to restrict this.

3. **Rate limiting**: 100 requests/minute per user. Show appropriate UI feedback on 429 responses.

4. **Job limits**: Maximum 5 concurrent jobs per user. Check `getActiveJobCount` before creating new jobs.

5. **Polling interval**: Poll job status every 3 seconds. Stop polling when status is terminal (`completed`, `failed`, `blocked`).

6. **Report availability**: Reports are only available when job status is `completed`. The `/jobs/{id}/report` endpoint returns 409 if job is not complete.

7. **Markdown reports**: Pass `format=md` to get markdown-formatted reports suitable for display or download.
