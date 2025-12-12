# Tracking System

## How It Works

Users add an invisible pixel to their site. When AI crawlers visit, we detect them server-side and record the visit.

```html
<img src="https://propintel.io/api/pixel/TRACKING_ID" alt="" style="position:absolute;width:0;height:0;border:0" />
```

**Why pixel instead of JavaScript?** AI agents (ChatGPT, Claude, etc.) don't execute JavaScript. They make server-side HTTP requests, so we detect crawlers from the User-Agent header when they request the pixel image.

## Key Files

| File | Purpose |
|------|---------|
| `app/api/pixel/[trackingId]/route.ts` | Returns 1x1 GIF, detects crawlers, records visits |
| `lib/crawler-detection.ts` | User-Agent pattern matching (21+ crawlers) |
| `server/api/routers/tracking.ts` | Generates pixel snippet, tests installation |
| `app/dashboard/tracking/page.tsx` | Installation UI |

## Data Captured

- Crawler ID (gptbot, claudebot, etc.)
- User-Agent string
- Page path (from referer header)
- IP address
- Timestamp

## Supported Crawlers

OpenAI (GPTBot, ChatGPT-User), Anthropic (ClaudeBot, Claude-User), Perplexity, Google, Bing, Meta, Apple, Amazon, ByteDance, Cohere, DeepSeek, xAI, DuckDuckGo, You.com, Common Crawl

## Adding New Crawlers

Add pattern to `CRAWLER_PATTERNS` in `lib/crawler-detection.ts`:

```typescript
{ id: "new-crawler", pattern: /NewCrawlerBot/i },
```
