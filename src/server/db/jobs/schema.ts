import { relations } from "drizzle-orm";
import { index, pgTableCreator } from "drizzle-orm/pg-core";
import { users } from "../auth/schema";

/**
 * PropIntel Backend Schema - Jobs, Pages, Reports, Analyses
 *
 * These tables are used by the PropIntel backend API for crawl jobs
 * and analysis data. They reference auth_user for ownership.
 */

/**
 * Table creator without prefix for app tables
 */
const createTable = pgTableCreator((name) => name);

// ===================
// Jobs Table
// ===================

export const jobs = createTable(
  "jobs",
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
    targetUrl: d.text().notNull(),
    status: d
      .varchar({ length: 50 })
      .notNull()
      .default("pending"), // pending, queued, crawling, analyzing, completed, failed, blocked
    config: d.jsonb(), // CrawlConfig object
    competitors: d.jsonb().default([]), // string[]
    webhookUrl: d.text(),
    authConfig: d.jsonb(), // { type, credentials }
    llmModel: d.varchar({ length: 100 }).default("gpt-4o-mini"),
    progress: d.jsonb().default({
      pagesCrawled: 0,
      pagesTotal: 0,
      currentPhase: "pending",
    }),
    metrics: d.jsonb().default({
      apiCallsCount: 0,
      storageUsedBytes: 0,
    }),
    error: d.jsonb(), // { code, message, details }
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
    index("jobs_user_id_idx").on(t.userId),
    index("jobs_status_idx").on(t.status),
    index("jobs_created_at_idx").on(t.createdAt),
  ]
);

// ===================
// Crawled Pages Table
// ===================

export const crawledPages = createTable(
  "crawled_pages",
  (d) => ({
    id: d
      .varchar({ length: 255 })
      .notNull()
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    jobId: d
      .varchar({ length: 255 })
      .notNull()
      .references(() => jobs.id, { onDelete: "cascade" }),
    url: d.text().notNull(),
    canonicalUrl: d.text(),
    statusCode: d.integer(),
    contentType: d.varchar({ length: 255 }),
    title: d.text(),
    metaDescription: d.text(),
    h1: d.text(),
    wordCount: d.integer(),
    pageData: d.jsonb(), // Full page analysis data
    snapshotS3Key: d.text(),
    crawledAt: d
      .timestamp({ mode: "date", withTimezone: true })
      .notNull()
      .defaultNow(),
  }),
  (t) => [index("crawled_pages_job_id_idx").on(t.jobId)]
);

// ===================
// Reports Table
// ===================

export const reports = createTable(
  "reports",
  (d) => ({
    id: d
      .varchar({ length: 255 })
      .notNull()
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    jobId: d
      .varchar({ length: 255 })
      .notNull()
      .references(() => jobs.id, { onDelete: "cascade" })
      .unique(),
    s3KeyJson: d.text(),
    s3KeyMarkdown: d.text(),
    createdAt: d
      .timestamp({ mode: "date", withTimezone: true })
      .notNull()
      .defaultNow(),
  }),
  (t) => [index("reports_job_id_idx").on(t.jobId)]
);

// ===================
// Analyses Table (Summary data for fast queries)
// ===================

export const analyses = createTable(
  "analyses",
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
    jobId: d
      .varchar({ length: 255 })
      .notNull()
      .references(() => jobs.id, { onDelete: "cascade" })
      .unique(),
    domain: d.text().notNull(),
    scores: d.jsonb(), // { aeoVisibilityScore, llmeoScore, seoScore, overallScore }
    keyMetrics: d.jsonb(), // { citationRate, queriesAnalyzed, citationCount, topCompetitors }
    summary: d.jsonb(), // { topFindings, topRecommendations, grade }
    reportS3Key: d.text(),
    generatedAt: d
      .timestamp({ mode: "date", withTimezone: true })
      .notNull()
      .defaultNow(),
  }),
  (t) => [
    index("analyses_user_id_idx").on(t.userId),
    index("analyses_domain_idx").on(t.domain),
    index("analyses_generated_at_idx").on(t.generatedAt),
  ]
);

// ===================
// Relations
// ===================

export const jobsRelations = relations(jobs, ({ one, many }) => ({
  user: one(users, {
    fields: [jobs.userId],
    references: [users.id],
  }),
  pages: many(crawledPages),
  report: one(reports),
  analysis: one(analyses),
}));

export const crawledPagesRelations = relations(crawledPages, ({ one }) => ({
  job: one(jobs, {
    fields: [crawledPages.jobId],
    references: [jobs.id],
  }),
}));

export const reportsRelations = relations(reports, ({ one }) => ({
  job: one(jobs, {
    fields: [reports.jobId],
    references: [jobs.id],
  }),
}));

export const analysesRelations = relations(analyses, ({ one }) => ({
  user: one(users, {
    fields: [analyses.userId],
    references: [users.id],
  }),
  job: one(jobs, {
    fields: [analyses.jobId],
    references: [jobs.id],
  }),
}));

// ===================
// Type Exports
// ===================

export type Job = typeof jobs.$inferSelect;
export type NewJob = typeof jobs.$inferInsert;
export type CrawledPage = typeof crawledPages.$inferSelect;
export type NewCrawledPage = typeof crawledPages.$inferInsert;
export type Report = typeof reports.$inferSelect;
export type NewReport = typeof reports.$inferInsert;
export type Analysis = typeof analyses.$inferSelect;
export type NewAnalysis = typeof analyses.$inferInsert;
