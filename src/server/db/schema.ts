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
