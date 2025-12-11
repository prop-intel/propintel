# Phase 7: Cleanup and CI/CD

## Goal
Remove old files, update CI/CD pipelines, and finalize the monorepo structure.

## Prerequisites
- Phases 1-6 completed
- Both apps working and tested

## Risk Level: LOW
Mostly cleanup and CI updates. Low risk of breaking changes.

## Steps

### 7.1 Remove old root-level files

Delete files that have been moved or are no longer needed:

```bash
# Remove old source directories
rm -rf src
rm -rf public
rm -rf shared

# Remove old config files (now in apps/web)
rm -f next.config.ts
rm -f postcss.config.js
rm -f tailwind.config.ts  # if exists

# Remove old lock file
rm -f package-lock.json

# Remove old drizzle directory (moved to packages/database)
rm -rf drizzle

# Remove old test files at root (moved to apps/web)
rm -rf tests

# Remove scripts that are now app-specific
rm -rf scripts  # or keep if they're truly workspace-level
```

### 7.2 Update root package.json

Ensure the root package.json is minimal workspace config:

```json
{
  "name": "propintel",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "build": "turbo run build",
    "dev": "turbo run dev",
    "dev:web": "turbo run dev --filter=@propintel/web",
    "dev:api": "turbo run dev --filter=@propintel/api",
    "lint": "turbo run lint",
    "typecheck": "turbo run typecheck",
    "test": "turbo run test",
    "test:all": "turbo run test",
    "format:check": "prettier --check \"**/*.{ts,tsx,js,jsx,mdx}\" --cache --ignore-path .gitignore",
    "format:write": "prettier --write \"**/*.{ts,tsx,js,jsx,mdx}\" --cache --ignore-path .gitignore",
    "clean": "turbo run clean && rm -rf node_modules",
    "db:generate": "turbo run db:generate --filter=@propintel/database",
    "db:migrate": "turbo run db:migrate --filter=@propintel/database",
    "db:push": "turbo run db:push --filter=@propintel/database",
    "db:studio": "turbo run db:studio --filter=@propintel/database"
  },
  "devDependencies": {
    "prettier": "^3.5.3",
    "prettier-plugin-tailwindcss": "^0.6.11",
    "turbo": "^2.3.0"
  },
  "packageManager": "pnpm@9.15.0",
  "engines": {
    "node": ">=20.0.0"
  }
}
```

### 7.3 Update .gitignore

Update root `.gitignore` for monorepo structure:

```gitignore
# Dependencies
node_modules
.pnpm-store

# Build outputs
dist
.next
.serverless

# Turborepo
.turbo

# Environment
.env
.env.local
.env.*.local

# IDE
.idea
.vscode/*
!.vscode/extensions.json
!.vscode/settings.json

# OS
.DS_Store
Thumbs.db

# Logs
*.log
npm-debug.log*

# Test coverage
coverage

# Cache
.cache
*.tsbuildinfo
```

### 7.4 Update CI/CD workflow

Replace `.github/workflows/ci.yml`:

```yaml
name: CI

on:
  pull_request:
    branches: [main]
  push:
    branches: [main]

env:
  TURBO_TOKEN: ${{ secrets.TURBO_TOKEN }}
  TURBO_TEAM: ${{ vars.TURBO_TEAM }}

jobs:
  build:
    name: Build and Test
    runs-on: ubuntu-latest

    steps:
      - name: Checkout
        uses: actions/checkout@v4
        with:
          fetch-depth: 2  # For Turborepo change detection

      - name: Setup pnpm
        uses: pnpm/action-setup@v4
        with:
          version: 9

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: "pnpm"

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Lint
        run: pnpm lint

      - name: Type check
        run: pnpm typecheck

      - name: Test
        run: pnpm test
        env:
          SKIP_ENV_VALIDATION: true
          NODE_ENV: test

      - name: Build
        run: pnpm build
        env:
          SKIP_ENV_VALIDATION: true

  # Optional: Deploy web app
  deploy-web:
    name: Deploy Web
    needs: build
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main' && github.event_name == 'push'

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup pnpm
        uses: pnpm/action-setup@v4
        with:
          version: 9

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: "pnpm"

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Build web app
        run: pnpm turbo run build --filter=@propintel/web
        env:
          SKIP_ENV_VALIDATION: true

      # Add your deployment steps here
      # - name: Deploy to Vercel
      #   run: ...

  # Optional: Deploy API
  deploy-api:
    name: Deploy API
    needs: build
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main' && github.event_name == 'push'

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup pnpm
        uses: pnpm/action-setup@v4
        with:
          version: 9

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: "pnpm"

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      # Add your API deployment steps here
      # - name: Deploy to AWS
      #   working-directory: apps/api
      #   run: pnpm deploy
```

### 7.5 Create VSCode workspace settings (optional)

Create `.vscode/settings.json`:

```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "typescript.preferences.importModuleSpecifier": "non-relative",
  "eslint.workingDirectories": [
    { "pattern": "apps/*" },
    { "pattern": "packages/*" }
  ],
  "files.associations": {
    "*.css": "tailwindcss"
  }
}
```

Create `.vscode/extensions.json`:

```json
{
  "recommendations": [
    "esbenp.prettier-vscode",
    "dbaeumer.vscode-eslint",
    "bradlc.vscode-tailwindcss",
    "prisma.prisma"
  ]
}
```

### 7.6 Update README.md

Update the root README to reflect the new structure:

```markdown
# PropIntel

AI-powered website analysis platform.

## Structure

This is a monorepo managed with [Turborepo](https://turbo.build/).

### Apps

- `apps/web` - Next.js frontend application
- `apps/api` - AWS Lambda serverless API

### Packages

- `packages/database` - Drizzle ORM schemas and database client
- `packages/types` - Shared TypeScript types
- `packages/eslint-config` - Shared ESLint configuration
- `packages/typescript-config` - Shared TypeScript configuration

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm 9+

### Installation

```bash
pnpm install
```

### Development

```bash
# Start all apps
pnpm dev

# Start only web app
pnpm dev:web

# Start only API
pnpm dev:api
```

### Build

```bash
pnpm build
```

### Test

```bash
pnpm test
```

### Database

```bash
# Generate migrations
pnpm db:generate

# Run migrations
pnpm db:migrate

# Open Drizzle Studio
pnpm db:studio
```

## Environment Variables

Copy `.env.example` files in each app:

```bash
cp apps/web/.env.example apps/web/.env
cp apps/api/.env.example apps/api/.env
```
```

### 7.7 Verify Turborepo caching

Test that Turborepo caching works:

```bash
# First build (no cache)
pnpm build

# Second build (should be cached)
pnpm build
# Should see "cache hit" messages
```

### 7.8 Optional: Set up remote caching

If using Vercel for remote caching:

```bash
npx turbo login
npx turbo link
```

Add to CI workflow (already included in step 7.4):
```yaml
env:
  TURBO_TOKEN: ${{ secrets.TURBO_TOKEN }}
  TURBO_TEAM: ${{ vars.TURBO_TEAM }}
```

### 7.9 Final verification

Run complete verification:

```bash
# Clean everything
pnpm clean

# Fresh install
pnpm install

# Run all checks
pnpm lint
pnpm typecheck
pnpm test
pnpm build

# Verify each app works
pnpm dev:web   # Test in browser
pnpm dev:api   # Test API endpoints
```

## Verification Checklist

After this phase:
- [ ] All old files removed from root
- [ ] `pnpm install` works from clean state
- [ ] `pnpm build` completes successfully
- [ ] `pnpm test` passes all tests
- [ ] `pnpm lint` passes
- [ ] `pnpm typecheck` passes
- [ ] CI workflow runs successfully
- [ ] Web app deploys correctly
- [ ] API deploys correctly
- [ ] Database migrations work
- [ ] Turborepo caching works

## Files Deleted

```
/src/                     # Moved to apps/web/src
/public/                  # Moved to apps/web/public
/shared/                  # Moved to packages/database
/backend/                 # Moved to apps/api
/drizzle/                 # Moved to packages/database/drizzle
/tests/                   # Moved to apps/web/tests
/scripts/                 # Moved to respective apps (if app-specific)
/next.config.ts           # Moved to apps/web
/postcss.config.js        # Moved to apps/web
/package-lock.json        # Replaced by pnpm-lock.yaml
```

## Files Updated

```
/.gitignore               # Updated for monorepo
/.github/workflows/ci.yml # Updated for Turborepo + pnpm
/package.json             # Minimal workspace root
/README.md                # Updated documentation
```

## Files Created

```
/.vscode/settings.json    # VSCode workspace settings
/.vscode/extensions.json  # Recommended extensions
```

## Final Project Structure

```
propintel/
├── apps/
│   ├── web/              # Next.js frontend
│   │   ├── src/
│   │   ├── public/
│   │   ├── package.json
│   │   └── ...
│   └── api/              # Serverless API
│       ├── src/
│       ├── serverless.yml
│       ├── package.json
│       └── ...
├── packages/
│   ├── database/         # Drizzle schemas + client
│   │   ├── src/
│   │   ├── drizzle/
│   │   └── package.json
│   ├── types/            # Shared types
│   │   ├── src/
│   │   └── package.json
│   ├── eslint-config/    # Shared ESLint
│   │   └── package.json
│   └── typescript-config/# Shared tsconfig
│       └── package.json
├── .github/
│   └── workflows/
│       └── ci.yml
├── .vscode/
│   ├── settings.json
│   └── extensions.json
├── .docs/
│   └── refactor/         # These planning docs
├── turbo.json
├── pnpm-workspace.yaml
├── pnpm-lock.yaml
├── package.json
├── .gitignore
└── README.md
```

## Post-Migration Tasks

1. **Update deployment configs** - Vercel, AWS, etc.
2. **Update environment variables** - In CI/CD and hosting platforms
3. **Inform team** - Document the new workflow
4. **Archive backup branch** - After confirming everything works
5. **Delete migration docs** - Or keep for reference

## Rollback

If the entire migration needs to be rolled back:

```bash
git checkout backup/pre-web-migration
```

Or restore from individual phase rollback instructions.
