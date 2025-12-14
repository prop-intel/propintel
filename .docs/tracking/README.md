# Tracking System

## Tracking Methods

### 1. Pixel Tracking (Simple)

Users add an invisible pixel to their HTML. When crawlers load the page and request the image, we detect them.

```html
<img
  src="https://propintel.vercel.app/api/pixel/TRACKING_ID"
  alt=""
  style="position:absolute;width:0;height:0;border:0"
/>
```

**Limitation:** Only works if the crawler loads images. Some AI agents fetch text-only.

### 2. Middleware Tracking (Advanced)

Users add middleware to their server that reports all requests to our API. Catches AI agents that don't load images.

```typescript
// In their middleware (e.g., Next.js middleware.ts)
const ua = request.headers.get("user-agent") ?? "";
const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "";

fetch("https://propintel.vercel.app/api/middleware-track", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    trackingId,
    userAgent: ua,
    path: request.nextUrl.pathname,
    ip,
  }),
});
```

### 3. Beacon Tracking (JavaScript)

A JavaScript-based beacon that fires when a known crawler is detected client-side. Falls back for crawlers that execute JavaScript.

```html
<script src="https://propintel.vercel.app/api/script/TRACKING_ID"></script>
```

## Key Files

| File                                               | Purpose                                     |
| -------------------------------------------------- | ------------------------------------------- |
| `apps/web/src/app/api/pixel/[trackingId]/route.ts` | Pixel tracking endpoint                     |
| `apps/web/src/app/api/middleware-track/route.ts`   | Middleware tracking endpoint                |
| `apps/web/src/app/api/beacon/route.ts`             | JavaScript beacon endpoint                  |
| `apps/web/src/lib/crawler-detection.ts`            | User-Agent pattern matching (24 crawlers)   |
| `apps/web/src/lib/track-visit.ts`                  | Shared tracking logic used by all endpoints |
| `apps/web/src/server/api/routers/tracking.ts`      | Generates snippets for all methods          |
| `apps/web/src/server/api/routers/admin.ts`         | Admin endpoints for unmatched user agents   |
| `apps/web/src/app/dashboard/tracking/page.tsx`     | Installation UI                             |

## Data Captured

- Crawler ID (gptbot, claudebot, etc.)
- User-Agent string
- Page path (from referer header or request)
- IP address
- Timestamp
- Source (`pixel`, `middleware`, or `beacon`)

## Supported Crawlers

- **OpenAI:** GPTBot, ChatGPT-User, OAI-SearchBot
- **Anthropic:** ClaudeBot, Claude-User, Claude-Web, Claude-SearchBot, anthropic-ai
- **Perplexity:** PerplexityBot, Perplexity-User
- **Google:** Googlebot, Google-Extended
- **Microsoft:** bingbot
- **Meta:** Meta-ExternalAgent, FacebookBot
- **Apple:** Applebot-Extended
- **Amazon:** Amazonbot
- **ByteDance:** Bytespider
- **Cohere:** cohere-ai
- **DeepSeek:** DeepseekBot
- **xAI:** xAI-Bot
- **DuckDuckGo:** DuckAssistBot
- **You.com:** YouBot
- **Common Crawl:** CCBot

## Adding New Crawlers

Add pattern to `CRAWLER_PATTERNS` in `apps/web/src/lib/crawler-detection.ts`:

```typescript
{ id: "new-crawler", pattern: /NewCrawlerBot/i },
```

## Unmatched User Agents

When a request comes in with a user agent that doesn't match any known crawler pattern, it's stored in the `unmatched_user_agents` table for admin review. This helps identify new crawlers that should be added to the detection patterns.

### Admin Dashboard

Admin users (role = 'admin') see an "Unmatched User Agents" section at the bottom of the dashboard. Features:

- View all unmatched user agents from the last 30 days
- Search by user agent string
- Pagination
- Delete individual records or clear all within timeframe

### Admin API Endpoints

All endpoints require admin role:

| Endpoint                         | Purpose                           |
| -------------------------------- | --------------------------------- |
| `admin.getUnmatchedUserAgents`   | Paginated list with search filter |
| `admin.getUnmatchedStats`        | Count totals grouped by source    |
| `admin.deleteUnmatchedUserAgent` | Delete single record by ID        |
| `admin.deleteAllUnmatched`       | Delete all records within N days  |
