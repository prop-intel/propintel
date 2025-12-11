import { relations } from "drizzle-orm";
import { index, pgTableCreator } from "drizzle-orm/pg-core";
import { users } from "../auth/schema";

const createTable = pgTableCreator((name) => name);

export type JobStatus = 'pending' | 'queued' | 'crawling' | 'analyzing' | 'completed' | 'failed' | 'blocked';

export type JobConfig = {
  maxPages: number;
  maxDepth: number;
  pageTimeout: number;
  crawlDelay: number;
  maxJobDuration: number;
  viewport: { width: number; height: number };
  userAgent: string;
  followCanonical: boolean;
  respectRobotsTxt: boolean;
  skipExactDuplicates: boolean;
  urlExclusions: string[];
  maxFileSize: number;
};

export type JobProgress = {
  pagesCrawled: number;
  pagesTotal: number;
  currentPhase: string;
};

export type JobMetrics = {
  startedAt?: string;
  completedAt?: string;
  durationMs?: number;
  apiCallsCount: number;
  storageUsedBytes: number;
};

export type JobError = {
  code: string;
  message: string;
  details?: string;
};

export const jobs = createTable(
  "jobs",
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
    targetUrl: d.text("target_url").notNull(),
    status: d
      .varchar("status", { length: 50 })
      .$type<JobStatus>()
      .notNull()
      .default("pending"),
    config: d.jsonb("config").$type<JobConfig>(),
    competitors: d.jsonb("competitors").$type<string[]>().default([]),
    webhookUrl: d.text("webhook_url"),
    authConfig: d.jsonb("auth_config").$type<{
      type: 'basic' | 'cookie';
      credentials: Record<string, string>;
    }>(),
    llmModel: d.varchar("llm_model", { length: 100 }).default("gpt-4o-mini"),
    progress: d.jsonb("progress").$type<JobProgress>().default({
      pagesCrawled: 0,
      pagesTotal: 0,
      currentPhase: "pending",
    }),
    metrics: d.jsonb("metrics").$type<JobMetrics>().default({
      apiCallsCount: 0,
      storageUsedBytes: 0,
    }),
    error: d.jsonb("error").$type<JobError>(),
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
    index("jobs_user_id_idx").on(t.userId),
    index("jobs_status_idx").on(t.status),
    index("jobs_created_at_idx").on(t.createdAt),
  ]
);

export type PageData = {
  schemas: Array<{
    type: string;
    properties: Record<string, unknown>;
    isValid: boolean;
    errors?: string[];
  }>;
  links: {
    internal: string[];
    external: string[];
  };
  images: Array<{
    src: string;
    alt?: string;
    width?: number;
    height?: number;
    hasAlt: boolean;
  }>;
  headings: {
    h1: string[];
    h2: string[];
    h3: string[];
    h4: string[];
    h5: string[];
    h6: string[];
  };
  robotsMeta: {
    noindex: boolean;
    nofollow: boolean;
  };
  hreflangAlternates: Array<{
    lang: string;
    url: string;
  }>;
  warnings: string[];
};

export const crawledPages = createTable(
  "crawled_pages",
  (d) => ({
    id: d
      .varchar("id", { length: 255 })
      .notNull()
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    jobId: d
      .varchar("job_id", { length: 255 })
      .notNull()
      .references(() => jobs.id, { onDelete: "cascade" }),
    url: d.text("url").notNull(),
    canonicalUrl: d.text("canonical_url"),
    statusCode: d.integer("status_code"),
    contentType: d.varchar("content_type", { length: 255 }),
    title: d.text("title"),
    metaDescription: d.text("meta_description"),
    h1: d.text("h1"),
    wordCount: d.integer("word_count"),
    language: d.text("language"),
    lastModified: d.text("last_modified"),
    loadTimeMs: d.integer("load_time_ms"),
    data: d.jsonb("data").$type<PageData>(),
    snapshotS3Key: d.text("snapshot_s3_key"),
    crawledAt: d
      .timestamp("crawled_at", { mode: "date", withTimezone: true })
      .notNull()
      .defaultNow(),
  }),
  (t) => [index("crawled_pages_job_id_idx").on(t.jobId)]
);

export const reports = createTable(
  "reports",
  (d) => ({
    id: d
      .varchar("id", { length: 255 })
      .notNull()
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    jobId: d
      .varchar("job_id", { length: 255 })
      .notNull()
      .references(() => jobs.id, { onDelete: "cascade" })
      .unique(),
    s3KeyJson: d.text("s3_key_json"),
    s3KeyMarkdown: d.text("s3_key_markdown"),
    createdAt: d
      .timestamp("created_at", { mode: "date", withTimezone: true })
      .notNull()
      .defaultNow(),
  }),
  (t) => [index("reports_job_id_idx").on(t.jobId)]
);

export type AnalysisScores = {
  aeoVisibilityScore: number;
  llmeoScore: number;
  seoScore: number;
  overallScore: number;
};

export type AnalysisKeyMetrics = {
  citationRate: number;
  queriesAnalyzed: number;
  citationCount: number;
  topCompetitors: string[];
};

export type AnalysisSummary = {
  topFindings: string[];
  topRecommendations: string[];
  grade: string;
};

export const analyses = createTable(
  "analyses",
  (d) => ({
    id: d
      .varchar("id", { length: 255 })
      .notNull()
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    jobId: d
      .varchar("job_id", { length: 255 })
      .notNull()
      .references(() => jobs.id, { onDelete: "cascade" })
      .unique(),
    userId: d
      .varchar("user_id", { length: 255 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    domain: d.text("domain").notNull(),
    scores: d.jsonb("scores").$type<AnalysisScores>(),
    keyMetrics: d.jsonb("key_metrics").$type<AnalysisKeyMetrics>(),
    summary: d.jsonb("summary").$type<AnalysisSummary>(),
    reportS3Key: d.text("report_s3_key"),
    generatedAt: d
      .timestamp("generated_at", { mode: "date", withTimezone: true })
      .notNull()
      .defaultNow(),
  }),
  (t) => [
    index("analyses_user_id_idx").on(t.userId),
    index("analyses_domain_idx").on(t.domain),
    index("analyses_generated_at_idx").on(t.generatedAt),
  ]
);

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

export type Job = typeof jobs.$inferSelect;
export type NewJob = typeof jobs.$inferInsert;
export type CrawledPage = typeof crawledPages.$inferSelect;
export type NewCrawledPage = typeof crawledPages.$inferInsert;
export type Report = typeof reports.$inferSelect;
export type NewReport = typeof reports.$inferInsert;
export type Analysis = typeof analyses.$inferSelect;
export type NewAnalysis = typeof analyses.$inferInsert;
