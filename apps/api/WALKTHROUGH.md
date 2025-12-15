# PropIntel API Walkthrough

A step-by-step guide to using the PropIntel AEO/LLMEO/SEO Crawler API, from initial setup to generating your first analysis report.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Getting Started](#getting-started)
3. [Your First Crawl Job](#your-first-crawl-job)
4. [Monitoring Job Progress](#monitoring-job-progress)
5. [Retrieving Reports](#retrieving-reports)
6. [Understanding the Report](#understanding-the-report)
7. [Advanced Usage](#advanced-usage)
8. [Common Workflows](#common-workflows)
9. [Troubleshooting](#troubleshooting)

## Prerequisites

Before you begin, ensure you have:

- ✅ An API key from your PropIntel administrator
- ✅ Access to the API endpoint URL
- ✅ `curl` or a similar HTTP client (or use your preferred programming language)
- ✅ Basic understanding of REST APIs

## Getting Started

> [!TIP]
> **New: Interactive Docs**
> You can now verify connection and explore endpoints directly in your browser using our new Swagger UI at `/docs`.

### Step 1: Verify API Access

First, let's verify your API key works by checking the health endpoint:

**Using curl:**
```bash
curl -H "X-Api-Key: your-api-key-here" \
  https://your-api-endpoint.execute-api.us-west-2.amazonaws.com/health
```

**Using PowerShell:**
```powershell
$headers = @{"X-Api-Key" = "your-api-key-here"}
Invoke-RestMethod -Uri "https://your-api-endpoint.execute-api.us-west-2.amazonaws.com/health" -Method GET -Headers $headers
```

**Expected Response:**
```json
{
  "status": "healthy",
  "service": "propintel-api",
  "version": "1.0.0",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "environment": "dev"
}
```

If you see this response, you're ready to proceed!

### Step 2: Understand Job Lifecycle

A crawl job goes through these stages:

1. **pending** → Job created, waiting to be queued
2. **queued** → Job in processing queue
3. **crawling** → Actively crawling pages
4. **analyzing** → Running AEO/LLMEO/SEO analysis
5. **completed** → Report ready for download
6. **failed** → Error occurred (check error details)
7. **blocked** → Site blocked access (CAPTCHA, 403, etc.)

## Your First Crawl Job

### Step 1: Create a Crawl Job

Let's analyze a simple website to get started. We'll use `example.com` as our target.

**Using curl:**
```bash
curl -X POST \
  -H "X-Api-Key: your-api-key-here" \
  -H "Content-Type: application/json" \
  -d '{
    "targetUrl": "https://example.com"
  }' \
  https://your-api-endpoint.execute-api.us-west-2.amazonaws.com/jobs
```

**Using PowerShell:**
```powershell
$headers = @{
    "X-Api-Key" = "your-api-key-here"
    "Content-Type" = "application/json"
}
$body = @{
    targetUrl = "https://example.com"
} | ConvertTo-Json

Invoke-RestMethod -Uri "https://your-api-endpoint.execute-api.us-west-2.amazonaws.com/jobs" -Method POST -Headers $headers -Body $body
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "job": {
      "id": "f9904399-84db-4200-9a2a-185c58431356",
      "tenantId": "tenant-dev-001",
      "targetUrl": "https://example.com",
      "status": "queued",
      "config": {
        "maxPages": 50,
        "maxDepth": 3,
        "pageTimeout": 30000,
        "crawlDelay": 1000
      },
      "progress": {
        "pagesCrawled": 0,
        "pagesTotal": 0,
        "currentPhase": "pending"
      },
      "createdAt": "2024-01-01T12:00:00.000Z",
      "updatedAt": "2024-01-01T12:00:00.000Z"
    }
  },
  "meta": {
    "requestId": "bea34de0-ec5e-4392-94d6-bbe101350508",
    "timestamp": "2024-01-01T12:00:00.000Z"
  }
}
```

**Important:** Save the `job.id` from the response - you'll need it to check status and retrieve the report!

### Step 2: Customize Crawl Configuration (Optional)

You can customize the crawl behavior by providing a `config` object:

```json
{
  "targetUrl": "https://example.com",
  "config": {
    "maxPages": 100,        // Increase page limit
    "maxDepth": 5,          // Crawl deeper
    "pageTimeout": 60000,   // 60 second timeout per page
    "maxJobDuration": 1800000  // 30 minutes total
  }
}
```

**Available Configuration Options:**

| Option | Default | Description |
|--------|---------|-------------|
| `maxPages` | 50 | Maximum pages to crawl |
| `maxDepth` | 3 | Maximum link depth to follow |
| `pageTimeout` | 30000 | Timeout per page (ms) |
| `crawlDelay` | 1000 | Delay between requests (ms, adaptive) |
| `maxJobDuration` | 900000 | Maximum job duration (ms, 15 min) |
| `followCanonical` | true | Follow canonical URLs |
| `respectRobotsTxt` | true | Respect robots.txt rules |
| `skipExactDuplicates` | true | Skip duplicate content |

## Monitoring Job Progress

### Step 1: Check Job Status

Poll the job status endpoint to monitor progress:

**Using curl:**
```bash
curl -H "X-Api-Key: your-api-key-here" \
  https://your-api-endpoint.execute-api.us-west-2.amazonaws.com/jobs/{job-id}
```

**Using PowerShell:**
```powershell
$headers = @{"X-Api-Key" = "your-api-key-here"}
$jobId = "f9904399-84db-4200-9a2a-185c58431356"
Invoke-RestMethod -Uri "https://your-api-endpoint.execute-api.us-west-2.amazonaws.com/jobs/$jobId" -Method GET -Headers $headers
```

**Response (In Progress):**
```json
{
  "success": true,
  "data": {
    "job": {
      "id": "f9904399-84db-4200-9a2a-185c58431356",
      "status": "crawling",
      "progress": {
        "pagesCrawled": 15,
        "pagesTotal": 25,
        "currentPhase": "crawling"
      },
      "metrics": {
        "startedAt": "2024-01-01T12:00:05.000Z",
        "apiCallsCount": 0,
        "storageUsedBytes": 0
      }
    }
  }
}
```

**Response (Completed):**
```json
{
  "success": true,
  "data": {
    "job": {
      "id": "f9904399-84db-4200-9a2a-185c58431356",
      "status": "completed",
      "progress": {
        "pagesCrawled": 25,
        "pagesTotal": 25,
        "currentPhase": "completed"
      },
      "metrics": {
        "startedAt": "2024-01-01T12:00:05.000Z",
        "completedAt": "2024-01-01T12:00:45.000Z",
        "durationMs": 40000,
        "apiCallsCount": 3,
        "storageUsedBytes": 524288
      }
    }
  }
}
```

### Step 2: Polling Strategy

For production applications, implement polling with exponential backoff:

**JavaScript Example:**
```javascript
async function waitForJobCompletion(apiKey, jobId, maxWaitTime = 300000) {
  const startTime = Date.now();
  const pollInterval = 5000; // 5 seconds
  
  while (Date.now() - startTime < maxWaitTime) {
    const response = await fetch(
      `https://your-api-endpoint/jobs/${jobId}`,
      { headers: { 'X-Api-Key': apiKey } }
    );
    const { data } = await response.json();
    
    if (data.job.status === 'completed') {
      return data.job;
    }
    
    if (data.job.status === 'failed' || data.job.status === 'blocked') {
      throw new Error(`Job failed: ${data.job.error?.message}`);
    }
    
    await new Promise(resolve => setTimeout(resolve, pollInterval));
  }
  
  throw new Error('Job timeout');
}
```

**PowerShell Example:**
```powershell
function Wait-ForJobCompletion {
    param(
        [string]$ApiKey,
        [string]$JobId,
        [int]$MaxWaitSeconds = 300
    )
    
    $startTime = Get-Date
    $pollInterval = 5
    
    while (((Get-Date) - $startTime).TotalSeconds -lt $MaxWaitSeconds) {
        $headers = @{"X-Api-Key" = $ApiKey}
        $job = Invoke-RestMethod -Uri "https://your-api-endpoint/jobs/$JobId" -Method GET -Headers $headers
        
        if ($job.data.job.status -eq "completed") {
            return $job.data.job
        }
        
        if ($job.data.job.status -in @("failed", "blocked")) {
            throw "Job failed: $($job.data.job.error.message)"
        }
        
        Start-Sleep -Seconds $pollInterval
    }
    
    throw "Job timeout after $MaxWaitSeconds seconds"
}
```

## Retrieving Reports

> **Note**: Reports are now accessed via the web dashboard or tRPC routes for better performance and security. The tRPC routes read directly from S3 storage.

Once the job status is `completed`, view the report in the PropIntel dashboard at `/results/{job-id}`.

For programmatic access, use the tRPC `job.getReport` endpoint from an authenticated session.

## Understanding the Report

### Report Structure

The report contains several key sections:

#### 1. Meta Information
```json
{
  "meta": {
    "jobId": "f9904399-84db-4200-9a2a-185c58431356",
    "domain": "example.com",
    "generatedAt": "2024-01-01T12:00:45.000Z",
    "pagesAnalyzed": 25,
    "crawlDuration": 40000
  }
}
```

#### 2. Scores
```json
{
  "scores": {
    "aeoVisibilityScore": 85,  // AEO Visibility (0-100) - PRIMARY
    "llmeoScore": 75,          // LLMEO score (0-100)
    "seoScore": 82,            // SEO score (0-100)
    "overallScore": 81,        // Weighted (50% AEO, 30% LLMEO, 20% SEO)
    "confidence": 0.95         // Data quality confidence (0-1)
  }
}
```

#### 3. AEO Analysis (New)
```json
{
  "aeoAnalysis": {
    "visibilityScore": 85,
    "queriesAnalyzed": 50,
    "citationRate": 45, // % of queries where your domain is cited
    "pageAnalysis": {
      "topic": "Real Estate Intelligence",
      "intent": "commercial",
      "contentType": "landing"
    },
    "citations": [
      {
        "query": "best real estate api",
        "yourPosition": "cited",
        "yourRank": 3,
        "winningDomain": "competitor.com"
      }
    ],
    "gaps": [
      {
        "query": "property data api pricing",
        "yourPosition": "absent",
        "winningReason": "Competitor has dedicated pricing page with table",
        "suggestedAction": "Create /pricing page with comparison table"
      }
    ]
  }
}
```

#### 4. LLMEO Analysis
```json
{
  "llmeoAnalysis": {
    "score": 75,
    "schemaAnalysis": {
      "score": 80,
      "schemasFound": ["WebSite", "Organization"],
      "missingRecommended": ["Article", "FAQPage", "BreadcrumbList"],
      "invalidSchemas": []
    },
    "semanticClarity": {
      "score": 70,
      "issues": ["Missing meta descriptions on 5 pages"],
      "suggestions": ["Add descriptive meta descriptions"]
    },
    "contentDepth": {
      "score": 65,
      "thinContentPages": ["/about", "/contact"],
      "comprehensivePages": ["/blog/post-1"]
    },
    "freshness": {
      "score": 90,
      "stalePages": [],
      "recentPages": ["/blog/post-1", "/blog/post-2"]
    }
  }
}
```

#### 5. SEO Analysis
```json
{
  "seoAnalysis": {
    "score": 82,
    "indexability": {
      "score": 95,
      "noindexPages": [],
      "blockedByRobots": []
    },
    "metadata": {
      "score": 75,
      "missingTitles": [],
      "missingDescriptions": ["/page1", "/page2"],
      "duplicateTitles": []
    },
    "structure": {
      "score": 85,
      "missingH1": [],
      "multipleH1": ["/page3"],
      "headingHierarchyIssues": []
    },
    "performance": {
      "score": 80,
      "slowPages": ["/heavy-page"],
      "averageLoadTime": 2500
    },
    "images": {
      "score": 90,
      "missingAlt": ["/image1.jpg", "/image2.jpg"],
      "totalImages": 50,
      "imagesWithAlt": 45
    }
  }
}
```

#### 6. Recommendations

Prioritized, actionable recommendations:

```json
{
  "recommendations": [
    {
      "id": "rec-1",
      "priority": "high",
      "category": "llmeo",
      "title": "Implement Missing Schema Markup",
      "description": "Add Article, FAQPage, and BreadcrumbList schemas",
      "impact": "High - Enhances visibility in search results",
      "effort": "medium",
      "codeSnippet": "<script type=\"application/ld+json\">...</script>",
      "affectedPages": []
    }
  ]
}
```

#### 7. LLM Summary

AI-generated insights:

```json
{
  "llmSummary": {
    "strengths": [
      "Strong technical SEO foundation",
      "Good page load performance"
    ],
    "weaknesses": [
      "Missing structured data on key pages",
      "Some pages lack meta descriptions"
    ],
    "opportunities": [
      "Add FAQ schema for common questions",
      "Implement breadcrumb navigation"
    ],
    "nextSteps": [
      "High: Add Article schema to blog posts",
      "Medium: Create meta descriptions for all pages"
    ]
  }
}
```

#### 8. Copy-Ready Prompt

A prompt you can use with AI writing assistants:

```json
{
  "copyReadyPrompt": "Improve your website's LLMEO and SEO by: 1) Adding Article schema markup to blog posts...",
  "promptVersion": "v1.0"
}
```

## Advanced Usage

### Adding Competitors

Compare your site against competitors:

```json
{
  "targetUrl": "https://yoursite.com",
  "competitors": [
    "https://competitor1.com",
    "https://competitor2.com"
  ]
}
```

The report will include a `competitorComparison` section with side-by-side analysis.

### Webhook Notifications

Get notified when jobs complete:

```json
{
  "targetUrl": "https://example.com",
  "webhookUrl": "https://your-app.com/webhooks/propintel"
}
```

When the job completes, PropIntel will POST the full report to your webhook URL.

### Custom LLM Model

Specify which OpenAI model to use:

```json
{
  "targetUrl": "https://example.com",
  "llmModel": "gpt-4o"  // Options: gpt-4o, gpt-4o-mini, gpt-3.5-turbo
}
```

### Authenticated Sites

Crawl sites requiring authentication:

```json
{
  "targetUrl": "https://example.com",
  "authConfig": {
    "type": "basic",
    "credentials": {
      "username": "your-username",
      "password": "your-password"
    }
  }
}
```

Or cookie-based auth:

```json
{
  "authConfig": {
    "type": "cookie",
    "credentials": {
      "sessionId": "your-session-id",
      "csrfToken": "your-csrf-token"
    }
  }
}
```

## Common Workflows

### Workflow 1: Quick Site Analysis

**Goal:** Get a quick overview of a website's AEO/LLMEO/SEO health

```bash
# 1. Create job
JOB_ID=$(curl -X POST \
  -H "X-Api-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"targetUrl": "https://example.com"}' \
  https://your-api-endpoint/jobs | jq -r '.data.job.id')

# 2. Wait for completion (simplified - use polling in production)
sleep 60

# 3. View report in dashboard
echo "View report at: https://your-dashboard/results/$JOB_ID"

# Note: Reports are accessed via the web dashboard or tRPC routes
# for better performance and direct S3 access.
```

### Workflow 2: Competitor Benchmarking

**Goal:** Compare your site against competitors

```powershell
# Create job with competitors
$body = @{
    targetUrl = "https://yoursite.com"
    competitors = @(
        "https://competitor1.com",
        "https://competitor2.com"
    )
} | ConvertTo-Json

$response = Invoke-RestMethod -Uri "https://your-api-endpoint/jobs" `
    -Method POST -Headers @{"X-Api-Key" = $API_KEY; "Content-Type" = "application/json"} `
    -Body $body

$jobId = $response.data.job.id

# Wait for completion
$job = Wait-ForJobCompletion -ApiKey $API_KEY -JobId $jobId

# View report in dashboard
Write-Host "View report at: https://your-dashboard/results/$jobId"

# Note: Reports are accessed via the web dashboard or tRPC routes
# for better performance and direct S3 access.
```

### Workflow 3: Integration with CI/CD

**Goal:** Automatically analyze site after deployments

```yaml
# GitHub Actions example
- name: Analyze Site
  run: |
    JOB_ID=$(curl -X POST \
      -H "X-Api-Key: ${{ secrets.PROPINTEL_API_KEY }}" \
      -H "Content-Type: application/json" \
      -d '{"targetUrl": "https://staging.example.com"}' \
      https://api.propintel.com/jobs | jq -r '.data.job.id')

    echo "JOB_ID=$JOB_ID" >> $GITHUB_ENV

- name: Wait for Analysis
  run: |
    # Poll until complete
    while true; do
      STATUS=$(curl -H "X-Api-Key: ${{ secrets.PROPINTEL_API_KEY }}" \
        https://api.propintel.com/jobs/${{ env.JOB_ID }} | jq -r '.data.job.status')

      if [ "$STATUS" = "completed" ]; then
        echo "Analysis complete. View report at: https://dashboard.propintel.com/results/${{ env.JOB_ID }}"
        break
      fi
      sleep 10
    done

# Note: For score validation in CI, use the tRPC API from an authenticated
# session or add a webhook notification to receive the score.
```

## Troubleshooting

### Job Stuck in "queued" Status

**Symptoms:** Job remains in `queued` status for more than 5 minutes

**Possible Causes:**
- Orchestrator Lambda not processing messages
- SQS queue issues
- Lambda concurrency limits reached

**Solutions:**
1. Check CloudWatch logs for the orchestrator function
2. Verify SQS queue has messages
3. Check Lambda function configuration

### Job Fails with "PROCESSING_ERROR"

**Symptoms:** Job status is `failed` with error code `PROCESSING_ERROR`

**Possible Causes:**
- Target site is blocking crawler
- Network connectivity issues
- LLM API quota exceeded

**Solutions:**
1. Check the `error.details` field in the job response
2. Verify target site is accessible
3. Check OpenAI API quota and billing

### Low Scores in Report

**Symptoms:** AEO, LLMEO, or SEO scores are unexpectedly low

**Possible Causes:**
- Missing schema markup
- Poor metadata quality
- Thin content pages

**Solutions:**
1. Review the `recommendations` section for prioritized fixes
2. Check `llmeoAnalysis` and `seoAnalysis` for specific issues
3. Implement high-priority recommendations first

### Rate Limit Errors

**Symptoms:** API returns `429 Too Many Requests`

**Solution:**
- Implement exponential backoff
- Respect rate limits (100 requests/minute per tenant)
- Cache job status instead of polling frequently

### Timeout Errors

**Symptoms:** Job times out before completion

**Solutions:**
1. Increase `maxJobDuration` in crawl config
2. Reduce `maxPages` if site is very large
3. Check target site performance

## Next Steps

Now that you've completed the walkthrough:

1. **Explore the API**: Try different crawl configurations
2. **Integrate**: Add PropIntel to your workflow
3. **Monitor**: Set up alerts for job failures
4. **Optimize**: Use recommendations to improve your site

For more information:
- See [README.md](README.md) for detailed API documentation
- Check `_docs/backend_prd.md` for architecture details
- Review CloudWatch logs for debugging

## Support

If you encounter issues:
1. Check the [Troubleshooting](#troubleshooting) section
2. Review CloudWatch logs for detailed error messages
3. Open an issue on GitHub with:
   - Job ID
   - Error message
   - Steps to reproduce

