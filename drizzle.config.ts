import { type Config } from "drizzle-kit";

import { env } from "@/env";

export default {
  schema: "./src/server/db/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: env.DATABASE_URL,
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
