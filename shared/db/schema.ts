import { pgTableCreator } from "drizzle-orm/pg-core";

export const createTable = pgTableCreator((name) => name);

export {
  users,
  usersRelations,
  accounts,
  accountsRelations,
  sessions,
  sessionsRelations,
  verificationTokens,
  // Backend compatibility aliases
  authUser,
  authUserRelations,
  authAccount,
  authAccountRelations,
  authSession,
  authSessionRelations,
  authVerificationToken,
} from "./auth/schema";

export {
  sites,
  sitesRelations,
  siteUrls,
  siteUrlsRelations,
  crawlers,
  crawlerVisits,
  crawlerVisitsRelations,
} from "./sites/schema";

export type {
  Site,
  NewSite,
  SiteUrl,
  NewSiteUrl,
  Crawler,
  NewCrawler,
  CrawlerVisit,
  NewCrawlerVisit,
} from "./sites/schema";

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

export type {
  Job,
  NewJob,
  JobStatus,
  JobConfig,
  JobProgress,
  JobMetrics,
  JobError,
  PageData,
  CrawledPage,
  NewCrawledPage,
  Report,
  NewReport,
  Analysis,
  NewAnalysis,
  AnalysisScores,
  AnalysisKeyMetrics,
  AnalysisSummary,
} from "./jobs/schema";
