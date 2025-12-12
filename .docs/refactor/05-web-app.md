# Phase 5: Web App Migration

## Goal
Move the Next.js frontend application to `apps/web/` and update all imports to use the new workspace packages.

## Prerequisites
- Phases 1-4 completed
- All shared packages created and working

## Risk Level: HIGH
This phase moves the largest amount of code. Recommend creating a backup branch before starting.

```bash
git checkout -b backup/pre-web-migration
git checkout main  # or your working branch
```

## Current Structure

```
/
├── src/                    # Next.js app source
│   ├── app/               # App router pages
│   ├── components/        # React components
│   ├── contexts/          # React contexts
│   ├── hooks/             # Custom hooks
│   ├── lib/               # Utilities
│   ├── server/            # Server-side code (tRPC, auth, db)
│   ├── stores/            # Zustand stores
│   ├── styles/            # Global styles
│   ├── trpc/              # tRPC client config
│   └── middleware.ts      # Next.js middleware
├── public/                # Static assets
├── next.config.ts         # Next.js config
├── tailwind.config.ts     # Tailwind config (if exists)
├── postcss.config.js      # PostCSS config
├── package.json           # Root package (currently frontend)
└── tsconfig.json          # TypeScript config
```

## Target Structure

```
apps/web/
├── src/
│   ├── app/
│   ├── components/
│   ├── contexts/
│   ├── hooks/
│   ├── lib/
│   ├── server/
│   │   ├── api/           # tRPC routers
│   │   ├── auth/          # NextAuth config
│   │   ├── actions/       # Server actions
│   │   └── db/            # DB client (thin wrapper)
│   ├── stores/
│   ├── styles/
│   └── trpc/
├── public/
├── package.json
├── tsconfig.json
├── next.config.ts
├── eslint.config.js
├── postcss.config.js
└── env.ts                 # Environment validation
```

## Steps

### 5.1 Create the apps/web directory structure

```bash
mkdir -p apps/web
```

### 5.2 Move source files

```bash
# Move main source directory
mv src apps/web/src

# Move public assets
mv public apps/web/public

# Move Next.js specific files
mv next.config.ts apps/web/
mv postcss.config.js apps/web/
mv middleware.ts apps/web/src/  # If not already in src

# Move environment validation
mv src/env.ts apps/web/src/env.ts  # Or create new one
```

### 5.3 Create apps/web/package.json

```json
{
  "name": "@propintel/web",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "next dev --turbo",
    "build": "next build",
    "start": "next start",
    "lint": "eslint .",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest watch",
    "clean": "rm -rf .next node_modules"
  },
  "dependencies": {
    "@propintel/database": "workspace:*",
    "@propintel/types": "workspace:*",
    "@ai-sdk/openai": "^2.0.80",
    "@ai-sdk/react": "^2.0.109",
    "@auth/drizzle-adapter": "^1.7.2",
    "@hookform/resolvers": "^5.2.2",
    "@radix-ui/react-accordion": "^1.2.12",
    "@radix-ui/react-alert-dialog": "^1.1.15",
    "@radix-ui/react-aspect-ratio": "^1.1.8",
    "@radix-ui/react-avatar": "^1.1.11",
    "@radix-ui/react-checkbox": "^1.3.3",
    "@radix-ui/react-collapsible": "^1.1.12",
    "@radix-ui/react-context-menu": "^2.2.16",
    "@radix-ui/react-dialog": "^1.1.15",
    "@radix-ui/react-dropdown-menu": "^2.1.16",
    "@radix-ui/react-hover-card": "^1.1.15",
    "@radix-ui/react-label": "^2.1.8",
    "@radix-ui/react-menubar": "^1.1.16",
    "@radix-ui/react-navigation-menu": "^1.2.14",
    "@radix-ui/react-popover": "^1.1.15",
    "@radix-ui/react-progress": "^1.1.8",
    "@radix-ui/react-radio-group": "^1.3.8",
    "@radix-ui/react-scroll-area": "^1.2.10",
    "@radix-ui/react-select": "^2.2.6",
    "@radix-ui/react-separator": "^1.1.8",
    "@radix-ui/react-slider": "^1.3.6",
    "@radix-ui/react-slot": "^1.2.4",
    "@radix-ui/react-switch": "^1.2.6",
    "@radix-ui/react-tabs": "^1.1.13",
    "@radix-ui/react-toggle": "^1.1.10",
    "@radix-ui/react-toggle-group": "^1.1.11",
    "@radix-ui/react-tooltip": "^1.2.8",
    "@radix-ui/react-use-controllable-state": "^1.2.2",
    "@t3-oss/env-nextjs": "^0.12.0",
    "@tanstack/react-query": "^5.69.0",
    "@trpc/client": "^11.0.0",
    "@trpc/react-query": "^11.0.0",
    "@trpc/server": "^11.0.0",
    "@xyflow/react": "^12.10.0",
    "ai": "^5.0.108",
    "class-variance-authority": "^0.7.1",
    "clsx": "^2.1.1",
    "cmdk": "^1.1.1",
    "date-fns": "^4.1.0",
    "drizzle-orm": "^0.41.0",
    "embla-carousel-react": "^8.6.0",
    "input-otp": "^1.4.2",
    "lucide-react": "^0.556.0",
    "motion": "^12.23.25",
    "next": "^16.0.7",
    "next-auth": "5.0.0-beta.30",
    "next-themes": "^0.4.6",
    "postgres": "^3.4.4",
    "react": "^19.2.1",
    "react-day-picker": "^9.12.0",
    "react-dom": "^19.2.1",
    "react-hook-form": "^7.68.0",
    "react-resizable-panels": "^3.0.6",
    "recharts": "^2.15.4",
    "server-only": "^0.0.1",
    "shiki": "^3.19.0",
    "sonner": "^2.0.7",
    "streamdown": "^1.6.10",
    "superjson": "^2.2.1",
    "tailwind-merge": "^3.4.0",
    "tokenlens": "^1.3.1",
    "use-stick-to-bottom": "^1.1.1",
    "vaul": "^1.1.2",
    "zod": "^3.25.76",
    "zustand": "^5.0.9"
  },
  "devDependencies": {
    "@propintel/eslint-config": "workspace:*",
    "@propintel/typescript-config": "workspace:*",
    "@faker-js/faker": "^10.1.0",
    "@tailwindcss/postcss": "^4.0.15",
    "@testing-library/jest-dom": "^6.9.1",
    "@testing-library/react": "^16.3.0",
    "@types/node": "^20.14.10",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@vitejs/plugin-react": "^5.1.2",
    "@vitest/ui": "^4.0.15",
    "eslint": "^9.23.0",
    "eslint-config-next": "^15.2.3",
    "msw": "^2.12.4",
    "msw-trpc": "^2.0.1",
    "postcss": "^8.5.3",
    "tailwindcss": "^4.0.15",
    "tw-animate-css": "^1.4.0",
    "typescript": "^5.8.2",
    "vitest": "^4.0.15"
  }
}
```

### 5.4 Create apps/web/tsconfig.json

```json
{
  "extends": "@propintel/typescript-config/next.json",
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": [
    "next-env.d.ts",
    "**/*.ts",
    "**/*.tsx",
    ".next/types/**/*.ts"
  ],
  "exclude": ["node_modules"]
}
```

### 5.5 Create apps/web/eslint.config.js

```javascript
import { createNextConfig } from "@propintel/eslint-config/next";

export default createNextConfig(import.meta.dirname);
```

### 5.6 Update database imports

Update `apps/web/src/server/db/index.ts`:

```typescript
import postgres from "postgres";
import { createPostgresClient } from "@propintel/database";
import { env } from "@/env";

/**
 * Cache the database connection in development to avoid
 * creating a new connection on every HMR update.
 */
const globalForDb = globalThis as unknown as {
  conn: postgres.Sql | undefined;
};

const conn = globalForDb.conn ?? postgres(env.DATABASE_URL);
if (env.NODE_ENV !== "production") globalForDb.conn = conn;

export const db = createPostgresClient(conn);
```

Remove or simplify `apps/web/src/server/db/schema.ts`:

```typescript
// Re-export from shared package for convenience
export * from "@propintel/database/schema";
```

### 5.7 Update imports throughout the codebase

**Find and replace patterns:**

| Old Import | New Import |
|------------|------------|
| `from "../../../shared/db/schema"` | `from "@propintel/database"` |
| `from "../../shared/db/schema"` | `from "@propintel/database"` |
| `from "@/server/db/schema"` | `from "@propintel/database"` |
| `from "../../../shared/types"` | `from "@propintel/types"` |
| `from "../../shared/types"` | `from "@propintel/types"` |

**Files likely needing updates:**
- `src/server/db/index.ts`
- `src/server/api/routers/*.ts`
- `src/server/auth/config.ts`
- Any file importing from `shared/`

### 5.8 Update next.config.ts

Ensure Next.js can resolve workspace packages:

```typescript
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Enable experimental features for monorepo support
  transpilePackages: [
    "@propintel/database",
    "@propintel/types",
  ],
  // ... rest of your config
};

export default nextConfig;
```

### 5.9 Update vitest.config.ts (if using Vitest)

Create `apps/web/vitest.config.ts`:

```typescript
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}", "tests/**/*.test.{ts,tsx}"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
```

### 5.10 Create/update environment file

Create `apps/web/.env.example`:

```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/propintel"

# NextAuth
AUTH_SECRET="your-auth-secret"
AUTH_URL="http://localhost:3000"

# OAuth (optional)
AUTH_GOOGLE_ID=""
AUTH_GOOGLE_SECRET=""

# API (server-side only)
API_URL="http://localhost:3001"
```

### 5.11 Install dependencies

```bash
pnpm install
```

### 5.12 Verify the app

```bash
# Typecheck
pnpm --filter @propintel/web typecheck

# Lint
pnpm --filter @propintel/web lint

# Dev server
pnpm --filter @propintel/web dev

# Build
pnpm --filter @propintel/web build
```

## Verification

After this phase:
- [ ] `apps/web/` directory exists with all source files
- [ ] `pnpm install` completes without errors
- [ ] `pnpm --filter @propintel/web typecheck` passes
- [ ] `pnpm --filter @propintel/web lint` passes
- [ ] `pnpm --filter @propintel/web dev` starts the dev server
- [ ] `pnpm --filter @propintel/web build` completes successfully
- [ ] All pages render correctly
- [ ] Authentication works
- [ ] Database queries work

## Common Issues and Solutions

### Issue: Module not found for workspace packages
**Solution**: Ensure `transpilePackages` is set in `next.config.ts`

### Issue: Path alias `@/` not resolving
**Solution**: Check `tsconfig.json` has correct `paths` configuration

### Issue: Type errors from old shared imports
**Solution**: Run find/replace to update all import paths

### Issue: Environment variables not loading
**Solution**: Create `.env` in `apps/web/` (not root)

## Files Moved

```
FROM                          TO
────                          ──
/src/                    →    apps/web/src/
/public/                 →    apps/web/public/
/next.config.ts          →    apps/web/next.config.ts
/postcss.config.js       →    apps/web/postcss.config.js
/tailwind.config.ts      →    apps/web/tailwind.config.ts (if exists)
```

## Files Created

```
apps/web/
├── package.json
├── tsconfig.json
├── eslint.config.js
├── vitest.config.ts
└── .env.example
```

## Rollback

```bash
# Move everything back
mv apps/web/src src
mv apps/web/public public
mv apps/web/next.config.ts .
mv apps/web/postcss.config.js .

# Remove apps/web
rm -rf apps/web
```

## Notes

- This is the highest-risk phase - test thoroughly
- Keep old files as backup until verified working
- The root `package.json` no longer contains frontend deps after this
- `.env` file should be in `apps/web/`, not root
- Tests should continue to work with updated paths
