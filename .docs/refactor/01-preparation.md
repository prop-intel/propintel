# Phase 1: Preparation

## Goal
Set up the Turborepo workspace infrastructure without moving any existing code.

## Prerequisites
- Node.js 20+
- Git repository with clean working tree (commit or stash changes)

## Steps

### 1.1 Install pnpm globally

```bash
npm install -g pnpm
```

Verify installation:
```bash
pnpm --version
```

### 1.2 Create workspace configuration

Create `pnpm-workspace.yaml` at the project root:

```yaml
packages:
  - "apps/*"
  - "packages/*"
```

### 1.3 Create directory structure

```bash
mkdir -p apps
mkdir -p packages
```

### 1.4 Create root package.json for workspace

Replace the current root `package.json` with a workspace root configuration.

**Important**: Save the current dependencies somewhere - you'll need them for `apps/web/package.json` in Phase 5.

Create new root `package.json`:

```json
{
  "name": "propintel",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "build": "turbo run build",
    "dev": "turbo run dev",
    "lint": "turbo run lint",
    "typecheck": "turbo run typecheck",
    "test": "turbo run test",
    "format:check": "prettier --check \"**/*.{ts,tsx,js,jsx,mdx}\" --cache --ignore-path .gitignore",
    "format:write": "prettier --write \"**/*.{ts,tsx,js,jsx,mdx}\" --cache --ignore-path .gitignore",
    "clean": "turbo run clean && rm -rf node_modules"
  },
  "devDependencies": {
    "prettier": "^3.5.3",
    "turbo": "^2.3.0"
  },
  "packageManager": "pnpm@9.15.0",
  "engines": {
    "node": ">=20.0.0"
  }
}
```

### 1.5 Create turbo.json

Create `turbo.json` at the project root:

```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": [".next/**", "!.next/cache/**", "dist/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "lint": {
      "dependsOn": ["^build"]
    },
    "typecheck": {
      "dependsOn": ["^build"]
    },
    "test": {
      "dependsOn": ["^build"]
    },
    "clean": {
      "cache": false
    }
  }
}
```

### 1.6 Update .gitignore

Add Turborepo cache to `.gitignore`:

```gitignore
# Turborepo
.turbo
```

### 1.7 Create .npmrc for pnpm

Create `.npmrc` at the project root:

```ini
auto-install-peers=true
strict-peer-dependencies=false
```

### 1.8 Initial install (will be empty for now)

```bash
pnpm install
```

This will create `pnpm-lock.yaml` and initialize the workspace.

## Verification

After this phase:
- [ ] `pnpm --version` works
- [ ] `pnpm-workspace.yaml` exists
- [ ] `turbo.json` exists
- [ ] `apps/` directory exists (empty)
- [ ] `packages/` directory exists (empty)
- [ ] `pnpm install` completes without errors
- [ ] `.turbo` is in `.gitignore`

## Notes

- The existing code still works at this point - we haven't moved anything
- The old `node_modules` can be deleted after pnpm is set up
- Keep the old `package-lock.json` until migration is complete (for rollback)

## Files Created
- `pnpm-workspace.yaml`
- `turbo.json`
- `.npmrc`

## Files Modified
- `package.json` (replaced with workspace root)
- `.gitignore` (added .turbo)

## Rollback
```bash
git checkout package.json .gitignore
rm pnpm-workspace.yaml turbo.json .npmrc pnpm-lock.yaml
rm -rf apps packages .turbo
```
