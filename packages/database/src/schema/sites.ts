import { relations } from "drizzle-orm";
import { index, pgTableCreator } from "drizzle-orm/pg-core";
import { users } from "./auth";

const createTable = pgTableCreator((name) => name);

export const sites = createTable(
  "sites",
  (d) => ({
    id: d
      .varchar("id", { length: 255 })
      .notNull()
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: d
      .varchar("user_id", { length: 255 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    domain: d.varchar("domain", { length: 255 }).notNull(),
    name: d.varchar("name", { length: 255 }),
    trackingId: d.varchar("tracking_id", { length: 64 }).notNull().unique(),
    createdAt: d
      .timestamp("created_at", { mode: "date", withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: d
      .timestamp("updated_at", { mode: "date", withTimezone: true })
      .notNull()
      .defaultNow(),
  }),
  (t) => [
    index("sites_user_id_idx").on(t.userId),
    index("sites_tracking_id_idx").on(t.trackingId),
  ]
);

export const siteUrls = createTable(
  "site_urls",
  (d) => ({
    id: d
      .varchar("id", { length: 255 })
      .notNull()
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    siteId: d
      .varchar("site_id", { length: 255 })
      .notNull()
      .references(() => sites.id, { onDelete: "cascade" }),
    path: d.text("path").notNull(),
    title: d.varchar("title", { length: 500 }),
    firstSeen: d
      .timestamp("first_seen", { mode: "date", withTimezone: true })
      .notNull()
      .defaultNow(),
    lastCrawled: d.timestamp("last_crawled", { mode: "date", withTimezone: true }),
    crawlCount: d.integer("crawl_count").default(0),
  }),
  (t) => [index("site_urls_site_id_idx").on(t.siteId)]
);

export const crawlers = createTable("crawlers", (d) => ({
  id: d.varchar("id", { length: 50 }).notNull().primaryKey(),
  name: d.varchar("name", { length: 100 }).notNull(),
  company: d.varchar("company", { length: 100 }).notNull(),
  userAgentPattern: d.text("user_agent_pattern").notNull(),
  description: d.text("description"),
  category: d.varchar("category", { length: 50 }),
  createdAt: d
    .timestamp("created_at", { mode: "date", withTimezone: true })
    .notNull()
    .defaultNow(),
}));

export const crawlerVisits = createTable(
  "crawler_visits",
  (d) => ({
    id: d
      .varchar("id", { length: 255 })
      .notNull()
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    siteId: d
      .varchar("site_id", { length: 255 })
      .notNull()
      .references(() => sites.id, { onDelete: "cascade" }),
    urlId: d
      .varchar("url_id", { length: 255 })
      .references(() => siteUrls.id, { onDelete: "set null" }),
    crawlerId: d.varchar("crawler_id", { length: 50 }).references(() => crawlers.id),
    userAgent: d.text("user_agent").notNull(),
    ipAddress: d.varchar("ip_address", { length: 45 }),
    path: d.text("path").notNull(),
    visitedAt: d
      .timestamp("visited_at", { mode: "date", withTimezone: true })
      .notNull()
      .defaultNow(),
    responseCode: d.integer("response_code"),
    metadata: d.jsonb("metadata"),
  }),
  (t) => [
    index("crawler_visits_site_id_idx").on(t.siteId),
    index("crawler_visits_visited_at_idx").on(t.visitedAt),
    index("crawler_visits_crawler_id_idx").on(t.crawlerId),
  ]
);

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

export type Site = typeof sites.$inferSelect;
export type NewSite = typeof sites.$inferInsert;
export type SiteUrl = typeof siteUrls.$inferSelect;
export type NewSiteUrl = typeof siteUrls.$inferInsert;
export type Crawler = typeof crawlers.$inferSelect;
export type NewCrawler = typeof crawlers.$inferInsert;
export type CrawlerVisit = typeof crawlerVisits.$inferSelect;
export type NewCrawlerVisit = typeof crawlerVisits.$inferInsert;
