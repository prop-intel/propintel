# Quick Demo Guide

This guide walks you through testing your deployed PropIntel API.

## Prerequisites

- **Base URL**: `https://wy3hcfsec6.execute-api.us-west-2.amazonaws.com`
- **API Key**: The key configured in your `config/tenants.json` (e.g., `your-secure-api-key`)

> [!TIP]
> **Variable Setup**
> Set these in your terminal to copy/paste commands easily:
> ```bash
> export API_URL="https://wy3hcfsec6.execute-api.us-west-2.amazonaws.com"
> export API_KEY="propintel-dev-key-2024"
> ```

---

## 1. Interactive Testing (Easiest)

Open your browser and navigate to:
`$API_URL/docs`

This loads the Swagger UI where you can:
1. Click **Authorize** and enter your API Key.
2. Select `POST /jobs`, click **Try it out**, and hit **Execute**.
3. See real responses immediately.

---

## 2. Command Line Testing

### A. Check Health
Ensure the service is running.

```bash
curl "$API_URL/health"
```
**Expected:** `{"status":"healthy",...}`

### B. Start a Crawl Job
Analyze an example site.

```bash
curl -X POST "$API_URL/jobs" \
  -H "X-Api-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "targetUrl": "https://example.com",
    "config": { "maxPages": 10 }
  }'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "job": {
      "id": "JOB_ID_HERE",
      "status": "queued",
      ...
    }
  }
}
```
> **Action:** Copy the `id` from the response (referred to as `JOB_ID`).

### C. Check Job Status
Poll until status is `completed`.

```bash
# Replace JOB_ID with the ID from the previous step
curl -H "X-Api-Key: $API_KEY" "$API_URL/jobs/JOB_ID"
```

**Phases:** `queued` -> `crawling` -> `analyzing` -> `completed`

### D. Get the Report
Once `completed`, fetch the full AEO analysis.

```bash
curl -H "X-Api-Key: $API_KEY" "$API_URL/jobs/JOB_ID/report"
```

**Markdown Format:**
Get a human-readable version:
```bash
curl -H "X-Api-Key: $API_KEY" "$API_URL/jobs/JOB_ID/report?format=md"
```

---

## 3. Troubleshooting

- **403 Forbidden**: Check your `X-Api-Key` header.
- **Job stuck in 'queued'**: Ensure your SQS queue and Orchestrator Lambda are triggering correctly in AWS Console.
- **Empty Report**: Verify the `targetUrl` is accessible and not blocking bots.
