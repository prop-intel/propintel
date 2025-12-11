# Phase 3: Types Package

## Goal
Create a shared types package that provides TypeScript interfaces and types used by both frontend and backend applications.

## Prerequisites
- Phase 1 & 2 completed
- Config packages available

## Current State
The project has shared types in `shared/types/index.ts`:
- `JobStatus` - Job state enum
- `ApiResponse<T>` - Generic API response wrapper

## Steps

### 3.1 Create types package structure

Create `packages/types/package.json`:

```json
{
  "name": "@propintel/types",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": {
      "types": "./src/index.ts",
      "import": "./src/index.ts"
    }
  },
  "scripts": {
    "typecheck": "tsc --noEmit",
    "lint": "eslint src"
  },
  "devDependencies": {
    "@propintel/eslint-config": "workspace:*",
    "@propintel/typescript-config": "workspace:*",
    "eslint": "^9.23.0",
    "typescript": "^5.8.2"
  }
}
```

### 3.2 Create TypeScript config

Create `packages/types/tsconfig.json`:

```json
{
  "extends": "@propintel/typescript-config/library.json",
  "compilerOptions": {
    "baseUrl": ".",
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

### 3.3 Create ESLint config

Create `packages/types/eslint.config.js`:

```javascript
import { createNodeConfig } from "@propintel/eslint-config/node";

export default createNodeConfig();
```

### 3.4 Create source files

Create `packages/types/src/index.ts`:

```typescript
/**
 * Shared TypeScript types used by both frontend and backend
 * @module @propintel/types
 */

export * from "./jobs";
export * from "./api";
```

Create `packages/types/src/jobs.ts`:

```typescript
/**
 * Job-related types shared between frontend and backend
 */

/**
 * Possible states of a job in the system
 */
export type JobStatus =
  | "pending"
  | "queued"
  | "crawling"
  | "analyzing"
  | "completed"
  | "failed"
  | "blocked";

/**
 * Job priority levels
 */
export type JobPriority = "low" | "normal" | "high";
```

Create `packages/types/src/api.ts`:

```typescript
/**
 * API-related types for request/response handling
 */

/**
 * Standard API error structure
 */
export interface ApiError {
  code: string;
  message: string;
  details?: string;
}

/**
 * Request metadata
 */
export interface ApiMeta {
  requestId: string;
  timestamp: string;
}

/**
 * Generic API response wrapper
 * @typeParam T - The type of data returned on success
 */
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: ApiError;
  meta?: ApiMeta;
}

/**
 * Paginated response wrapper
 * @typeParam T - The type of items in the list
 */
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}
```

### 3.5 Install dependencies

```bash
pnpm install
```

### 3.6 Verify the package

```bash
# Run typecheck
pnpm --filter @propintel/types typecheck

# Run lint
pnpm --filter @propintel/types lint
```

## Verification

After this phase:
- [ ] `packages/types/` directory exists with all files
- [ ] `pnpm install` completes without errors
- [ ] `pnpm --filter @propintel/types typecheck` passes
- [ ] `pnpm --filter @propintel/types lint` passes

## Files Created

```
packages/types/
├── package.json
├── tsconfig.json
├── eslint.config.js
└── src/
    ├── index.ts
    ├── jobs.ts
    └── api.ts
```

## Usage (for future phases)

### In apps/web or apps/api:

```typescript
import { type JobStatus, type ApiResponse } from "@propintel/types";

const status: JobStatus = "pending";

const response: ApiResponse<{ id: string }> = {
  success: true,
  data: { id: "123" }
};
```

## Notes

- This package uses TypeScript source directly (no build step)
- The `exports` field points to `.ts` files - Turborepo handles this
- Additional types can be added as the project grows
- Database-related types will live in `@propintel/database` package

## Rollback
```bash
rm -rf packages/types
```
