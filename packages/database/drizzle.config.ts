import { type Config } from "drizzle-kit";

export default {
  schema: "./src/schema/index.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  tablesFilter: [
    "auth_*",
    "sites",
    "site_urls",
    "crawlers",
    "crawler_visits",
    "jobs",
    "crawled_pages",
    "reports",
    "analyses",
  ],
} satisfies Config;
