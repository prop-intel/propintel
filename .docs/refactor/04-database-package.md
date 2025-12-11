# Phase 4: Database Package

## Goal
Create a shared database package that provides Drizzle ORM schemas, client factory, and database types for both frontend and backend applications.

## Prerequisites
- Phase 1, 2 & 3 completed
- Config and types packages available

## Current State

### Schema Locations (duplicated/symlinked)
- `/shared/db/` - Primary schema location
- `/src/server/db/schema.ts` - Re-exports from shared
- `/backend/src/shared` - Symlink to `/shared`

### Database Clients
- Frontend (`/src/server/db/index.ts`): Uses `postgres` (postgres-js) library
- Backend (`/backend/src/server/db/index.ts`): Uses `pg` (node-postgres) library

### Tables
- `auth_*` - Authentication (users, accounts, sessions, verification_tokens)
- `sites` - Tracked websites
- `site_urls` - URLs within sites
- `crawlers` - Known crawlers/bots
- `crawler_visits` - Crawler visit logs
- `jobs` - Analysis jobs
- `crawled_pages` - Crawled page data
- `reports` - Generated reports
- `analyses` - Analysis results

## Steps

### 4.1 Create database package structure

Create `packages/database/package.json`:

```json
{
  "name": "@propintel/database",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": {
      "types": "./src/index.ts",
      "import": "./src/index.ts"
    },
    "./schema": {
      "types": "./src/schema/index.ts",
      "import": "./src/schema/index.ts"
    },
    "./client": {
      "types": "./src/client/index.ts",
      "import": "./src/client/index.ts"
    }
  },
  "scripts": {
    "typecheck": "tsc --noEmit",
    "lint": "eslint src",
    "db:generate": "drizzle-kit generate",
    "db:migrate": "drizzle-kit migrate",
    "db:push": "drizzle-kit push",
    "db:studio": "drizzle-kit studio"
  },
  "dependencies": {
    "@propintel/types": "workspace:*",
    "drizzle-orm": "^0.41.0"
  },
  "devDependencies": {
    "@propintel/eslint-config": "workspace:*",
    "@propintel/typescript-config": "workspace:*",
    "@types/pg": "^8.16.0",
    "drizzle-kit": "^0.30.5",
    "eslint": "^9.23.0",
    "pg": "^8.16.3",
    "postgres": "^3.4.4",
    "typescript": "^5.8.2"
  },
  "peerDependencies": {
    "pg": "^8.0.0",
    "postgres": "^3.0.0"
  },
  "peerDependenciesMeta": {
    "pg": {
      "optional": true
    },
    "postgres": {
      "optional": true
    }
  }
}
```

### 4.2 Create TypeScript config

Create `packages/database/tsconfig.json`:

```json
{
  "extends": "@propintel/typescript-config/library.json",
  "compilerOptions": {
    "baseUrl": ".",
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "drizzle"]
}
```

### 4.3 Create ESLint config

Create `packages/database/eslint.config.js`:

```javascript
import { createNodeConfig } from "@propintel/eslint-config/node";

export default createNodeConfig();
```

### 4.4 Create Drizzle config

Create `packages/database/drizzle.config.ts`:

```typescript
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
```

### 4.5 Move and organize schema files

Create directory structure:
```
packages/database/src/
├── index.ts
├── schema/
│   ├── index.ts
│   ├── auth.ts
│   ├── sites.ts
│   └── jobs.ts
└── client/
    ├── index.ts
    ├── postgres.ts    # For postgres-js (frontend)
    └── pg.ts          # For node-postgres (backend)
```

**Move schemas from `/shared/db/` to `packages/database/src/schema/`:**

Create `packages/database/src/schema/index.ts`:

```typescript
import { pgTableCreator } from "drizzle-orm/pg-core";

export const createTable = pgTableCreator((name) => name);

// Auth schemas
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
} from "./auth";

// Site schemas
export {
  sites,
  sitesRelations,
  siteUrls,
  siteUrlsRelations,
  crawlers,
  crawlerVisits,
  crawlerVisitsRelations,
} from "./sites";

export type {
  Site,
  NewSite,
  SiteUrl,
  NewSiteUrl,
  Crawler,
  NewCrawler,
  CrawlerVisit,
  NewCrawlerVisit,
} from "./sites";

// Job schemas
export {
  jobs,
  jobsRelations,
  crawledPages,
  crawledPagesRelations,
  reports,
  reportsRelations,
  analyses,
  analysesRelations,
} from "./jobs";

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
} from "./jobs";
```

Copy the contents of existing schema files:
- `/shared/db/auth/schema.ts` → `packages/database/src/schema/auth.ts`
- `/shared/db/sites/schema.ts` → `packages/database/src/schema/sites.ts`
- `/shared/db/jobs/schema.ts` → `packages/database/src/schema/jobs.ts`

Update internal imports to use relative paths (e.g., `./index` instead of `../../shared/db/schema`).

### 4.6 Create database client factory

Create `packages/database/src/client/index.ts`:

```typescript
export { createPostgresClient, type PostgresDatabase } from "./postgres";
export { createPgClient, type PgDatabase } from "./pg";
```

Create `packages/database/src/client/postgres.ts` (for Next.js frontend):

```typescript
import { drizzle } from "drizzle-orm/postgres-js";
import type postgres from "postgres";
import * as schema from "../schema";

export type PostgresDatabase = ReturnType<typeof drizzle<typeof schema>>;

/**
 * Create a Drizzle database client using postgres-js
 * Use this in Next.js/frontend applications
 */
export function createPostgresClient(connection: postgres.Sql): PostgresDatabase {
  return drizzle(connection, { schema });
}
```

Create `packages/database/src/client/pg.ts` (for Lambda backend):

```typescript
import { drizzle } from "drizzle-orm/node-postgres";
import type { Pool } from "pg";
import * as schema from "../schema";

export type PgDatabase = ReturnType<typeof drizzle<typeof schema>>;

/**
 * Create a Drizzle database client using node-postgres
 * Use this in Node.js/Lambda applications
 */
export function createPgClient(pool: Pool): PgDatabase {
  return drizzle(pool, { schema });
}
```

### 4.7 Create main export

Create `packages/database/src/index.ts`:

```typescript
// Re-export all schemas
export * from "./schema";

// Re-export client factories
export { createPostgresClient, type PostgresDatabase } from "./client/postgres";
export { createPgClient, type PgDatabase } from "./client/pg";
```

### 4.8 Move migrations

Move existing migrations:
```bash
mv drizzle packages/database/drizzle
```

### 4.9 Install dependencies

```bash
pnpm install
```

### 4.10 Verify the package

```bash
# Run typecheck
pnpm --filter @propintel/database typecheck

# Run lint
pnpm --filter @propintel/database lint
```

## Verification

After this phase:
- [ ] `packages/database/` directory exists with all files
- [ ] All schema files moved from `/shared/db/`
- [ ] Migrations moved to `packages/database/drizzle/`
- [ ] `pnpm install` completes without errors
- [ ] `pnpm --filter @propintel/database typecheck` passes
- [ ] `pnpm --filter @propintel/database lint` passes
- [ ] `pnpm --filter @propintel/database db:studio` opens Drizzle Studio

## Files Created

```
packages/database/
├── package.json
├── tsconfig.json
├── eslint.config.js
├── drizzle.config.ts
├── drizzle/              # Moved from /drizzle
│   └── ... migrations
└── src/
    ├── index.ts
    ├── schema/
    │   ├── index.ts
    │   ├── auth.ts
    │   ├── sites.ts
    │   └── jobs.ts
    └── client/
        ├── index.ts
        ├── postgres.ts
        └── pg.ts
```

## Usage (for future phases)

### In apps/web:

```typescript
// apps/web/src/server/db/index.ts
import postgres from "postgres";
import { createPostgresClient } from "@propintel/database";
import { env } from "@/env";

const globalForDb = globalThis as unknown as {
  conn: postgres.Sql | undefined;
};

const conn = globalForDb.conn ?? postgres(env.DATABASE_URL);
if (env.NODE_ENV !== "production") globalForDb.conn = conn;

export const db = createPostgresClient(conn);

// Re-export types for convenience
export type { PostgresDatabase } from "@propintel/database";
```

### In apps/api:

```typescript
// apps/api/src/server/db/index.ts
import { Pool } from "pg";
import { createPgClient } from "@propintel/database";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

export const db = createPgClient(pool);
export { pool };

// Re-export types for convenience
export type { PgDatabase } from "@propintel/database";
```

### Importing schemas:

```typescript
import { users, jobs, sites, type Job, type Site } from "@propintel/database";
// or
import { users, jobs } from "@propintel/database/schema";
```

## Notes

- The package uses peer dependencies for `pg` and `postgres` to avoid bundling both
- Each app installs only the driver it needs
- Migrations remain in the database package and are run from there
- The `drizzle.config.ts` needs `DATABASE_URL` in environment

## Files to Delete (in Phase 7)

- `/shared/db/` - Entire directory
- `/src/server/db/schema.ts` - Will be replaced with import from package
- `/backend/src/shared` - Symlink no longer needed
- `/drizzle/` - Moved to package

## Rollback

```bash
# Move migrations back
mv packages/database/drizzle drizzle

# Remove package
rm -rf packages/database
```
