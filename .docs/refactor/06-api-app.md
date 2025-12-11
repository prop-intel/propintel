# Phase 6: API App Migration

## Goal
Move the Serverless Lambda backend to `apps/api/` and update all imports to use the new workspace packages.

## Prerequisites
- Phases 1-5 completed
- Web app working in `apps/web/`

## Risk Level: MEDIUM
The backend is already somewhat isolated. Main risk is import path updates.

## Current Structure

```
backend/
├── src/
│   ├── agents/           # AI analysis agents
│   ├── analysis/         # Analysis logic
│   ├── handlers/         # Lambda handlers
│   ├── lib/              # Utilities
│   ├── reports/          # Report generation
│   ├── server/           # Database client
│   ├── shared -> ../../shared  # Symlink to root shared
│   ├── tasks/            # Job processing
│   └── types/            # Backend-specific types
├── scripts/              # Test scripts
├── infrastructure/       # IaC configs
├── docs/                 # Documentation
├── serverless.yml        # Serverless Framework config
├── drizzle.config.ts     # Drizzle config
├── tsconfig.json         # TypeScript config
└── package.json          # Backend dependencies
```

## Target Structure

```
apps/api/
├── src/
│   ├── agents/
│   ├── analysis/
│   ├── handlers/
│   ├── lib/
│   ├── reports/
│   ├── server/
│   │   └── db/           # Thin DB wrapper
│   ├── tasks/
│   └── types/            # API-specific types only
├── scripts/
├── infrastructure/
├── docs/
├── serverless.yml
├── drizzle.config.ts
├── tsconfig.json
├── eslint.config.js
└── package.json
```

## Steps

### 6.1 Move backend directory

```bash
# Move the entire backend to apps/api
mv backend apps/api
```

### 6.2 Remove the symlink

```bash
# Remove the shared symlink (no longer needed)
rm apps/api/src/shared
```

### 6.3 Update apps/api/package.json

```json
{
  "name": "@propintel/api",
  "version": "1.0.0",
  "description": "PropIntel Crawler API with AWS Lambda",
  "private": true,
  "type": "module",
  "main": "src/handlers/job.ts",
  "scripts": {
    "dev": "serverless offline",
    "deploy": "serverless deploy --stage dev",
    "deploy:prod": "serverless deploy --stage prod",
    "lint": "eslint src",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:api": "tsx scripts/test-api.ts",
    "test:e2e": "tsx scripts/test-e2e.ts",
    "clean": "rm -rf dist .serverless node_modules"
  },
  "dependencies": {
    "@propintel/database": "workspace:*",
    "@propintel/types": "workspace:*",
    "@ai-sdk/openai": "^0.0.66",
    "@aws-sdk/client-ecs": "^3.682.0",
    "@aws-sdk/client-eventbridge": "^3.682.0",
    "@aws-sdk/client-s3": "^3.682.0",
    "@aws-sdk/client-sqs": "^3.682.0",
    "@aws-sdk/s3-request-presigner": "^3.682.0",
    "@sparticuz/chromium": "^130.0.0",
    "ai": "^3.4.0",
    "cheerio": "^1.0.0",
    "dotenv": "^17.2.3",
    "drizzle-orm": "^0.41.0",
    "langfuse": "^3.29.1",
    "pg": "^8.13.0",
    "puppeteer-core": "^23.6.0",
    "robots-parser": "^3.0.1",
    "uuid": "^10.0.0",
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "@propintel/eslint-config": "workspace:*",
    "@propintel/typescript-config": "workspace:*",
    "@types/aws-lambda": "^8.10.145",
    "@types/node": "^22.9.0",
    "@types/pg": "^8.11.10",
    "@types/uuid": "^10.0.0",
    "esbuild": "^0.24.0",
    "eslint": "^9.23.0",
    "playwright": "^1.48.0",
    "serverless": "^3.40.0",
    "serverless-dotenv-plugin": "^6.0.0",
    "serverless-esbuild": "^1.56.1",
    "serverless-offline": "^13.9.0",
    "tsx": "^4.19.0",
    "typescript": "^5.6.3",
    "vitest": "^4.0.15"
  },
  "engines": {
    "node": ">=20.0.0"
  }
}
```

### 6.4 Update apps/api/tsconfig.json

```json
{
  "extends": "@propintel/typescript-config/node.json",
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    }
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", ".serverless"]
}
```

### 6.5 Create apps/api/eslint.config.js

```javascript
import { createNodeConfig } from "@propintel/eslint-config/node";

export default createNodeConfig();
```

### 6.6 Update database client

Update `apps/api/src/server/db/index.ts`:

```typescript
import { Pool } from "pg";
import { createPgClient } from "@propintel/database";

function getDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;

  if (!url || !url.trim()) {
    return "postgresql://postgres:password@localhost:5432/propintel_test";
  }

  const trimmedUrl = url.trim();

  if (
    !trimmedUrl.includes("@") ||
    trimmedUrl.match(/^postgresql:\/\/localhost/) ||
    trimmedUrl.match(/^postgresql:\/\/127\.0\.0\.1/)
  ) {
    const match = trimmedUrl.match(
      /^postgresql:\/\/(?:localhost|127\.0\.0\.1)(?::(\d+))?(?:\/(.+))?$/
    );
    if (match) {
      const port = match[1] || "5432";
      const dbName = match[2] || "propintel_test";
      return `postgresql://postgres:password@localhost:${port}/${dbName}`;
    }
    return "postgresql://postgres:password@localhost:5432/propintel_test";
  }

  return trimmedUrl;
}

const pool = new Pool({
  connectionString: getDatabaseUrl(),
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

export const db = createPgClient(pool);
export { pool };

// Re-export schema for convenience
export * from "@propintel/database/schema";
```

### 6.7 Update imports throughout the codebase

**Find and replace patterns:**

| Old Import | New Import |
|------------|------------|
| `from "../../shared/db/schema"` | `from "@propintel/database"` |
| `from "../shared/db/schema"` | `from "@propintel/database"` |
| `from "../../shared/types"` | `from "@propintel/types"` |
| `from "../shared/types"` | `from "@propintel/types"` |

**Files likely needing updates:**
- All files in `src/handlers/`
- All files in `src/agents/`
- All files in `src/tasks/`
- `src/server/db/index.ts`

### 6.8 Update serverless.yml

The serverless config may need path updates if it references the old structure:

```yaml
# Ensure the package include/exclude patterns are correct
package:
  individually: true
  patterns:
    - "!node_modules/**"
    - "!.git/**"
    - "!docs/**"
    - "!scripts/**"
    - "!infrastructure/**"

# Update the esbuild config if needed
custom:
  esbuild:
    bundle: true
    minify: false
    sourcemap: true
    platform: node
    target: node20
    # Add external packages if workspace packages cause issues
    external:
      - "@propintel/database"
      - "@propintel/types"
```

### 6.9 Update drizzle.config.ts

```typescript
import { type Config } from "drizzle-kit";

export default {
  // Point to the database package schema
  schema: "../../packages/database/src/schema/index.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
} satisfies Config;
```

Alternatively, remove drizzle.config.ts from the API and run migrations from the database package only.

### 6.10 Update test scripts

Update `apps/api/scripts/test-api.ts` and other scripts to use new import paths:

```typescript
// Replace ts-node with tsx in scripts
// Update imports from shared to use @propintel packages
import { type JobStatus } from "@propintel/types";
import { jobs } from "@propintel/database";
```

### 6.11 Install dependencies

```bash
pnpm install
```

### 6.12 Verify the app

```bash
# Typecheck
pnpm --filter @propintel/api typecheck

# Lint
pnpm --filter @propintel/api lint

# Start local dev
pnpm --filter @propintel/api dev

# Run tests
pnpm --filter @propintel/api test:api
```

## Verification

After this phase:
- [ ] `apps/api/` directory exists with all source files
- [ ] Symlink to `/shared` is removed
- [ ] `pnpm install` completes without errors
- [ ] `pnpm --filter @propintel/api typecheck` passes
- [ ] `pnpm --filter @propintel/api lint` passes
- [ ] `pnpm --filter @propintel/api dev` starts serverless offline
- [ ] `pnpm --filter @propintel/api test:api` passes
- [ ] Deploy to AWS works (optional test)

## Common Issues and Solutions

### Issue: esbuild can't resolve workspace packages
**Solution**: Add workspace packages to `external` in serverless-esbuild config, or bundle them

### Issue: Import paths still reference `../../shared`
**Solution**: Search and replace all remaining relative imports to shared

### Issue: Drizzle can't find schema
**Solution**: Update drizzle.config.ts to point to database package, or keep a local reference

### Issue: ts-node scripts fail
**Solution**: Replace ts-node with tsx, which handles ESM better

## Files Moved

```
FROM                          TO
────                          ──
/backend/                →    apps/api/
```

## Files Modified/Created

```
apps/api/
├── package.json          # Updated with workspace deps
├── tsconfig.json         # Extends shared config
├── eslint.config.js      # NEW - uses shared config
├── serverless.yml        # May need esbuild updates
└── src/server/db/index.ts  # Updated to use @propintel/database
```

## Files Deleted

```
apps/api/src/shared       # Symlink removed
```

## Rollback

```bash
# Move back to original location
mv apps/api backend

# Recreate symlink
cd backend/src && ln -s ../../shared shared
```

## Notes

- The backend already uses a separate `package.json`, making migration simpler
- AWS Lambda deployments should continue to work with the updated paths
- Consider removing the API's own `drizzle.config.ts` and using the database package's
- Test deploys to a staging environment before production
