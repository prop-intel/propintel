import { pgTableCreator } from "drizzle-orm/pg-core";

/**
 * This is an example of how to use the multi-project schema feature of Drizzle ORM. Use the same
 * database instance for multiple projects.
 *
 * @see https://orm.drizzle.team/docs/goodies#multi-project-schema
 */
export const createTable = pgTableCreator((name) => name);

// Re-export auth schemas for convenience
export {
  users,
  usersRelations,
  accounts,
  accountsRelations,
  sessions,
  sessionsRelations,
  verificationTokens,
} from "./auth/schema";

// Re-export site schemas
export {
  sites,
  sitesRelations,
  siteUrls,
  siteUrlsRelations,
  crawlers,
  crawlerVisits,
  crawlerVisitsRelations,
} from "./sites/schema";

// Re-export jobs schemas
export {
  jobs,
  jobsRelations,
  crawledPages,
  crawledPagesRelations,
  reports,
  reportsRelations,
  analyses,
  analysesRelations,
} from "./jobs/schema";

// Re-export job types
export type {
  Job,
  NewJob,
  CrawledPage,
  NewCrawledPage,
  Report,
  NewReport,
  Analysis,
  NewAnalysis,
} from "./jobs/schema";
