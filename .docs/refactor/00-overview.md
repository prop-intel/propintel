# Turborepo Migration Plan

## Overview

This plan migrates the existing manual monorepo structure to a proper Turborepo workspace with pnpm. The migration is broken into 7 phases, each designed to be completed independently with a working codebase at the end of each phase.

## Problem Statement

The current structure couples frontend and backend type checking/linting:
- Next.js deploys fail when backend has type errors
- No clear boundary between packages
- Duplicate dependency installations
- No build caching or task orchestration

## Target Structure

```
capstone/
├── apps/
│   ├── web/                    # Next.js frontend
│   └── api/                    # Serverless backend
├── packages/
│   ├── database/               # Drizzle schemas + client
│   ├── types/                  # Shared TypeScript types
│   ├── eslint-config/          # Shared ESLint config
│   └── typescript-config/      # Shared tsconfig
├── turbo.json
├── package.json
└── pnpm-workspace.yaml
```

## Phases

| Phase | Name | Description | Risk Level |
|-------|------|-------------|------------|
| 1 | [Preparation](./01-preparation.md) | Install pnpm, create workspace root, turbo.json | Low |
| 2 | [Config Packages](./02-config-packages.md) | Create typescript-config and eslint-config packages | Low |
| 3 | [Types Package](./03-types-package.md) | Extract shared types to packages/types | Low |
| 4 | [Database Package](./04-database-package.md) | Extract schemas and DB client to packages/database | Medium |
| 5 | [Web App](./05-web-app.md) | Move Next.js app to apps/web | High |
| 6 | [API App](./06-api-app.md) | Move backend to apps/api | Medium |
| 7 | [Cleanup](./07-cleanup.md) | Remove old files, update CI/CD, documentation | Low |

## Dependency Graph

```
                    ┌─────────────────┐
                    │  typescript-    │
                    │  config         │
                    └────────┬────────┘
                             │
        ┌────────────────────┼────────────────────┐
        │                    │                    │
        ▼                    ▼                    ▼
┌───────────────┐    ┌───────────────┐    ┌───────────────┐
│   apps/web    │    │   apps/api    │    │   packages/   │
│   (Next.js)   │    │   (Lambda)    │    │   database    │
└───────┬───────┘    └───────┬───────┘    └───────┬───────┘
        │                    │                    │
        └────────────────────┼────────────────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │  packages/      │
                    │  types          │
                    └─────────────────┘
```

## Migration Order Rationale

1. **Preparation first** - Need workspace infrastructure before anything else
2. **Config packages second** - Everything depends on shared configs
3. **Types third** - Has no dependencies, depended on by database
4. **Database fourth** - Depends on types, depended on by both apps
5. **Web app fifth** - Highest risk, most code to move
6. **API app sixth** - Simpler move, already somewhat isolated
7. **Cleanup last** - Only after everything works

## Success Criteria

After each phase:
- [ ] All existing tests pass
- [ ] Type checking passes for affected packages
- [ ] Linting passes for affected packages
- [ ] Local development works
- [ ] (Where applicable) Deploy succeeds

## Rollback Strategy

Each phase should be committed separately. If a phase fails:
1. Revert the commits from that phase
2. Address the issue
3. Re-attempt the phase

## Estimated Package Dependencies

### apps/web
```json
{
  "dependencies": {
    "@propintel/database": "workspace:*",
    "@propintel/types": "workspace:*"
  },
  "devDependencies": {
    "@propintel/eslint-config": "workspace:*",
    "@propintel/typescript-config": "workspace:*"
  }
}
```

### apps/api
```json
{
  "dependencies": {
    "@propintel/database": "workspace:*",
    "@propintel/types": "workspace:*"
  },
  "devDependencies": {
    "@propintel/eslint-config": "workspace:*",
    "@propintel/typescript-config": "workspace:*"
  }
}
```

### packages/database
```json
{
  "dependencies": {
    "@propintel/types": "workspace:*"
  },
  "devDependencies": {
    "@propintel/typescript-config": "workspace:*"
  }
}
```
