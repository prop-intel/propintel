# Tracking System

## Tracking Methods

### 1. Pixel Tracking (Simple)

Users add an invisible pixel to their HTML. When crawlers load the page and request the image, we detect them.

```html
<img src="https://propintel.io/api/pixel/TRACKING_ID" ... />
```

**Limitation:** Only works if the crawler loads images. Some AI agents fetch text-only.

### 2. Middleware Tracking (Advanced)

Users add middleware to their server that reports all requests to our API. Catches AI agents that don't load images.

```typescript
// In their middleware
const ip = request.ip || request.headers.get('x-forwarded-for')?.split(',')[0] || '';

fetch('https://propintel.io/api/middleware-track', {
  method: 'POST',
  body: JSON.stringify({ trackingId, userAgent, path, ip }),
});
```

## Key Files

| File | Purpose |
|------|---------|
| `app/api/pixel/[trackingId]/route.ts` | Pixel tracking endpoint |
| `app/api/middleware-track/route.ts` | Middleware tracking endpoint |
| `lib/crawler-detection.ts` | User-Agent pattern matching (21+ crawlers) |
| `server/api/routers/tracking.ts` | Generates snippets for both methods |
| `app/dashboard/tracking/page.tsx` | Installation UI |

## Data Captured

- Crawler ID (gptbot, claudebot, etc.)
- User-Agent string
- Page path (from referer header)
- IP address
- Timestamp
- Source (`pixel` or `middleware`)

## Supported Crawlers

OpenAI (GPTBot, ChatGPT-User), Anthropic (ClaudeBot, Claude-User), Perplexity, Google, Bing, Meta, Apple, Amazon, ByteDance, Cohere, DeepSeek, xAI, DuckDuckGo, You.com, Common Crawl

## Adding New Crawlers

Add pattern to `CRAWLER_PATTERNS` in `lib/crawler-detection.ts`:

```typescript
{ id: "new-crawler", pattern: /NewCrawlerBot/i },
```
