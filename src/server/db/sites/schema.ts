import { relations } from "drizzle-orm";
import { index, pgTableCreator } from "drizzle-orm/pg-core";
import { users } from "../auth/schema";

/**
 * Table creator without prefix for app tables
 */
const createTable = pgTableCreator((name) => name);

// Sites table - User's tracked websites
export const sites = createTable(
  "sites",
  (d) => ({
    id: d
      .varchar({ length: 255 })
      .notNull()
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: d
      .varchar({ length: 255 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    domain: d.varchar({ length: 255 }).notNull(),
    name: d.varchar({ length: 255 }),
    trackingId: d.varchar({ length: 64 }).notNull().unique(),
    createdAt: d
      .timestamp({ mode: "date", withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: d
      .timestamp({ mode: "date", withTimezone: true })
      .notNull()
      .defaultNow(),
  }),
  (t) => [
    index("sites_user_id_idx").on(t.userId),
    index("sites_tracking_id_idx").on(t.trackingId),
  ]
);

// Site URLs table - Discovered/tracked URLs per site
export const siteUrls = createTable(
  "site_urls",
  (d) => ({
    id: d
      .varchar({ length: 255 })
      .notNull()
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    siteId: d
      .varchar({ length: 255 })
      .notNull()
      .references(() => sites.id, { onDelete: "cascade" }),
    path: d.text().notNull(),
    title: d.varchar({ length: 500 }),
    firstSeen: d
      .timestamp({ mode: "date", withTimezone: true })
      .notNull()
      .defaultNow(),
    lastCrawled: d.timestamp({ mode: "date", withTimezone: true }),
    crawlCount: d.integer().default(0),
  }),
  (t) => [index("site_urls_site_id_idx").on(t.siteId)]
);

// Crawlers table - AI crawler definitions (reference/lookup)
export const crawlers = createTable("crawlers", (d) => ({
  id: d.varchar({ length: 50 }).notNull().primaryKey(),
  name: d.varchar({ length: 100 }).notNull(),
  company: d.varchar({ length: 100 }).notNull(),
  userAgentPattern: d.text().notNull(),
  description: d.text(),
  category: d.varchar({ length: 50 }), // "training", "search", "browsing"
  createdAt: d
    .timestamp({ mode: "date", withTimezone: true })
    .notNull()
    .defaultNow(),
}));

// Crawler visits table - AI crawler visit events
export const crawlerVisits = createTable(
  "crawler_visits",
  (d) => ({
    id: d
      .varchar({ length: 255 })
      .notNull()
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    siteId: d
      .varchar({ length: 255 })
      .notNull()
      .references(() => sites.id, { onDelete: "cascade" }),
    urlId: d
      .varchar({ length: 255 })
      .references(() => siteUrls.id, { onDelete: "set null" }),
    crawlerId: d.varchar({ length: 50 }).references(() => crawlers.id),
    userAgent: d.text().notNull(),
    ipAddress: d.varchar({ length: 45 }),
    path: d.text().notNull(),
    visitedAt: d
      .timestamp({ mode: "date", withTimezone: true })
      .notNull()
      .defaultNow(),
    responseCode: d.integer(),
    metadata: d.jsonb(),
  }),
  (t) => [
    index("crawler_visits_site_id_idx").on(t.siteId),
    index("crawler_visits_visited_at_idx").on(t.visitedAt),
    index("crawler_visits_crawler_id_idx").on(t.crawlerId),
  ]
);

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
  site: one(sites, {
    fields: [crawlerVisits.siteId],
    references: [sites.id],
  }),
  url: one(siteUrls, {
    fields: [crawlerVisits.urlId],
    references: [siteUrls.id],
  }),
  crawler: one(crawlers, {
    fields: [crawlerVisits.crawlerId],
    references: [crawlers.id],
  }),
}));
