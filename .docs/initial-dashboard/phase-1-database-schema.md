# Phase 1: Database Schema Design and Migrations

## Overview

Design and implement the database schema for sites, URLs, crawler visits, and crawler definitions. This phase establishes the data foundation for all subsequent features.

## Dependencies

- None (foundational phase)

## Files to Create

### `src/server/db/sites/schema.ts`

New schema file for site-related tables with Drizzle ORM.

```typescript
import { relations } from "drizzle-orm";
import { index, pgTableCreator, primaryKey } from "drizzle-orm/pg-core";
import { users } from "../auth/schema";

const createTable = pgTableCreator((name) => name);

// Sites table - User's tracked websites
export const sites = createTable("sites", (d) => ({
  id: d.varchar({ length: 255 }).notNull().primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: d.varchar({ length: 255 }).notNull().references(() => users.id, { onDelete: "cascade" }),
  domain: d.varchar({ length: 255 }).notNull(),
  name: d.varchar({ length: 255 }),
  trackingId: d.varchar({ length: 64 }).notNull().unique(),
  createdAt: d.timestamp({ mode: "date", withTimezone: true }).notNull().defaultNow(),
  updatedAt: d.timestamp({ mode: "date", withTimezone: true }).notNull().defaultNow(),
}), (t) => [
  index("sites_user_id_idx").on(t.userId),
  index("sites_tracking_id_idx").on(t.trackingId),
]);

// Site URLs table - Discovered/tracked URLs per site
export const siteUrls = createTable("site_urls", (d) => ({
  id: d.varchar({ length: 255 }).notNull().primaryKey().$defaultFn(() => crypto.randomUUID()),
  siteId: d.varchar({ length: 255 }).notNull().references(() => sites.id, { onDelete: "cascade" }),
  path: d.text().notNull(),
  title: d.varchar({ length: 500 }),
  firstSeen: d.timestamp({ mode: "date", withTimezone: true }).notNull().defaultNow(),
  lastCrawled: d.timestamp({ mode: "date", withTimezone: true }),
  crawlCount: d.integer().default(0),
}), (t) => [
  index("site_urls_site_id_idx").on(t.siteId),
]);

// Crawlers table - AI crawler definitions (reference/lookup)
export const crawlers = createTable("crawlers", (d) => ({
  id: d.varchar({ length: 50 }).notNull().primaryKey(),
  name: d.varchar({ length: 100 }).notNull(),
  company: d.varchar({ length: 100 }).notNull(),
  userAgentPattern: d.text().notNull(),
  description: d.text(),
  category: d.varchar({ length: 50 }), // "training", "search", "browsing"
  createdAt: d.timestamp({ mode: "date", withTimezone: true }).notNull().defaultNow(),
}));

// Crawler visits table - AI crawler visit events
export const crawlerVisits = createTable("crawler_visits", (d) => ({
  id: d.varchar({ length: 255 }).notNull().primaryKey().$defaultFn(() => crypto.randomUUID()),
  siteId: d.varchar({ length: 255 }).notNull().references(() => sites.id, { onDelete: "cascade" }),
  urlId: d.varchar({ length: 255 }).references(() => siteUrls.id, { onDelete: "set null" }),
  crawlerId: d.varchar({ length: 50 }).references(() => crawlers.id),
  userAgent: d.text().notNull(),
  ipAddress: d.varchar({ length: 45 }),
  path: d.text().notNull(),
  visitedAt: d.timestamp({ mode: "date", withTimezone: true }).notNull().defaultNow(),
  responseCode: d.integer(),
  metadata: d.jsonb(),
}), (t) => [
  index("crawler_visits_site_id_idx").on(t.siteId),
  index("crawler_visits_visited_at_idx").on(t.visitedAt),
  index("crawler_visits_crawler_id_idx").on(t.crawlerId),
]);

// Relations
export const sitesRelations = relations(sites, ({ one, many }) => ({
  user: one(users, { fields: [sites.userId], references: [users.id] }),
  urls: many(siteUrls),
  visits: many(crawlerVisits),
}));

export const siteUrlsRelations = relations(siteUrls, ({ one, many }) => ({
  site: one(sites, { fields: [siteUrls.siteId], references: [sites.id] }),
  visits: many(crawlerVisits),
}));

export const crawlerVisitsRelations = relations(crawlerVisits, ({ one }) => ({
  site: one(sites, { fields: [crawlerVisits.siteId], references: [sites.id] }),
  url: one(siteUrls, { fields: [crawlerVisits.urlId], references: [siteUrls.id] }),
  crawler: one(crawlers, { fields: [crawlerVisits.crawlerId], references: [crawlers.id] }),
}));
```

### `src/server/db/seed/crawlers.ts`

Seed data for AI crawlers.

```typescript
export const crawlerSeedData = [
  // OpenAI
  { id: "gptbot", name: "GPTBot", company: "OpenAI", userAgentPattern: "GPTBot", category: "training", description: "Training data collection" },
  { id: "chatgpt-user", name: "ChatGPT-User", company: "OpenAI", userAgentPattern: "ChatGPT-User", category: "browsing", description: "Real-time browsing (~75% of AI crawler traffic)" },
  { id: "oai-searchbot", name: "OAI-SearchBot", company: "OpenAI", userAgentPattern: "OAI-SearchBot", category: "search", description: "SearchGPT indexing" },

  // Anthropic
  { id: "claudebot", name: "ClaudeBot", company: "Anthropic", userAgentPattern: "ClaudeBot", category: "training", description: "Training data collection" },
  { id: "claude-web", name: "Claude-Web", company: "Anthropic", userAgentPattern: "Claude-Web", category: "browsing", description: "Web access features" },
  { id: "claude-searchbot", name: "Claude-SearchBot", company: "Anthropic", userAgentPattern: "Claude-SearchBot", category: "search", description: "Search functionality" },
  { id: "anthropic-ai", name: "anthropic-ai", company: "Anthropic", userAgentPattern: "anthropic-ai", category: "training", description: "General Anthropic crawler" },

  // Perplexity
  { id: "perplexitybot", name: "PerplexityBot", company: "Perplexity", userAgentPattern: "PerplexityBot", category: "search", description: "Official crawler" },
  { id: "perplexity-user", name: "Perplexity-User", company: "Perplexity", userAgentPattern: "Perplexity-User", category: "browsing", description: "User-triggered searches" },

  // Google
  { id: "googlebot", name: "Googlebot", company: "Google", userAgentPattern: "Googlebot", category: "search", description: "Also used for AI Overviews" },
  { id: "google-extended", name: "Google-Extended", company: "Google", userAgentPattern: "Google-Extended", category: "training", description: "Gemini training (can block separately)" },

  // Microsoft
  { id: "bingbot", name: "Bingbot", company: "Microsoft", userAgentPattern: "bingbot", category: "search", description: "Bing search + Copilot" },

  // Others
  { id: "bytespider", name: "Bytespider", company: "ByteDance", userAgentPattern: "Bytespider", category: "training", description: "ByteDance/TikTok" },
  { id: "cohere-ai", name: "cohere-ai", company: "Cohere", userAgentPattern: "cohere-ai", category: "training", description: "Cohere models" },
  { id: "meta-externalagent", name: "Meta-ExternalAgent", company: "Meta", userAgentPattern: "Meta-ExternalAgent", category: "training", description: "Meta AI" },
  { id: "applebot-extended", name: "Applebot-Extended", company: "Apple", userAgentPattern: "Applebot-Extended", category: "training", description: "Apple Intelligence" },
];
```

## Files to Modify

### `src/server/db/schema.ts`

Add re-exports for new site schemas:

```typescript
// Add after existing exports
export {
  sites,
  sitesRelations,
  siteUrls,
  siteUrlsRelations,
  crawlers,
  crawlerVisits,
  crawlerVisitsRelations,
} from "./sites/schema";
```

### `drizzle.config.ts`

Update tablesFilter to include new tables:

```typescript
// Change from:
tablesFilter: ["auth_*"],

// To:
tablesFilter: ["auth_*", "sites", "site_urls", "crawlers", "crawler_visits"],
```

### `src/server/db/auth/schema.ts`

Add sites relation to users:

```typescript
export const usersRelations = relations(users, ({ many }) => ({
  accounts: many(accounts),
  sites: many(sites), // Add this line
}));
```

## Commands to Run

```bash
# Generate migration
npm run db:generate

# Push schema to database
npm run db:push

# Or run migration
npm run db:migrate

# Seed crawlers (create a script or run manually)
npm run db:seed
```

## Acceptance Criteria

- [ ] All tables created with proper relationships and indexes
- [ ] Migrations run successfully
- [ ] Crawler seed data inserted (16 crawlers)
- [ ] Schema types exported and available for use in tRPC routers
- [ ] User relation added to auth schema for sites
- [ ] Can verify tables exist in Drizzle Studio (`npm run db:studio`)
