# Phase 2: Config Packages

## Goal
Create shared TypeScript and ESLint configuration packages that all other packages will extend.

## Prerequisites
- Phase 1 completed
- Workspace structure in place

## Steps

### 2.1 Create typescript-config package

Create `packages/typescript-config/package.json`:

```json
{
  "name": "@propintel/typescript-config",
  "version": "0.0.0",
  "private": true,
  "license": "MIT",
  "publishConfig": {
    "access": "public"
  }
}
```

Create `packages/typescript-config/base.json`:

```json
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "compilerOptions": {
    "esModuleInterop": true,
    "skipLibCheck": true,
    "target": "es2022",
    "allowJs": true,
    "resolveJsonModule": true,
    "moduleDetection": "force",
    "isolatedModules": true,
    "verbatimModuleSyntax": true,
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "checkJs": true,
    "noEmit": true,
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "incremental": true
  }
}
```

Create `packages/typescript-config/next.json`:

```json
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "extends": "./base.json",
  "compilerOptions": {
    "lib": ["dom", "dom.iterable", "ES2022"],
    "jsx": "react-jsx",
    "plugins": [{ "name": "next" }]
  }
}
```

Create `packages/typescript-config/node.json`:

```json
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "extends": "./base.json",
  "compilerOptions": {
    "lib": ["ES2022"],
    "module": "NodeNext",
    "moduleResolution": "NodeNext"
  }
}
```

Create `packages/typescript-config/library.json`:

```json
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "extends": "./base.json",
  "compilerOptions": {
    "lib": ["ES2022"],
    "declaration": true,
    "declarationMap": true,
    "noEmit": false,
    "outDir": "dist"
  }
}
```

### 2.2 Create eslint-config package

Create `packages/eslint-config/package.json`:

```json
{
  "name": "@propintel/eslint-config",
  "version": "0.0.0",
  "private": true,
  "license": "MIT",
  "type": "module",
  "exports": {
    "./base": "./base.js",
    "./next": "./next.js",
    "./node": "./node.js"
  },
  "dependencies": {
    "@eslint/eslintrc": "^3.3.1",
    "eslint-plugin-drizzle": "^0.2.3",
    "typescript-eslint": "^8.27.0"
  },
  "peerDependencies": {
    "eslint": "^9.0.0"
  }
}
```

Create `packages/eslint-config/base.js`:

```javascript
import tseslint from 'typescript-eslint';
// @ts-ignore -- no types for this plugin
import drizzle from "eslint-plugin-drizzle";

/**
 * Base ESLint config for all packages
 * @param {Object} options
 * @param {string} options.tsconfigPath - Path to tsconfig.json
 */
export function createBaseConfig(options = {}) {
  return tseslint.config(
    {
      files: ['**/*.ts', '**/*.tsx'],
      plugins: {
        drizzle,
      },
      extends: [
        ...tseslint.configs.recommended,
        ...tseslint.configs.recommendedTypeChecked,
        ...tseslint.configs.stylisticTypeChecked
      ],
      rules: {
        "@typescript-eslint/array-type": "off",
        "@typescript-eslint/consistent-type-definitions": "off",
        "@typescript-eslint/consistent-type-imports": [
          "warn",
          { prefer: "type-imports", fixStyle: "inline-type-imports" },
        ],
        "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
        "@typescript-eslint/require-await": "off",
        "@typescript-eslint/no-misused-promises": [
          "error",
          { checksVoidReturn: { attributes: false } },
        ],
        "drizzle/enforce-delete-with-where": [
          "error",
          { drizzleObjectName: ["db", "ctx.db"] },
        ],
        "drizzle/enforce-update-with-where": [
          "error",
          { drizzleObjectName: ["db", "ctx.db"] },
        ],
      },
    },
    {
      linterOptions: {
        reportUnusedDisableDirectives: true
      },
      languageOptions: {
        parserOptions: {
          projectService: true
        }
      }
    }
  );
}

export default createBaseConfig;
```

Create `packages/eslint-config/next.js`:

```javascript
import { FlatCompat } from "@eslint/eslintrc";
import { createBaseConfig } from "./base.js";

/**
 * ESLint config for Next.js apps
 * @param {string} dirname - import.meta.dirname from the consuming config
 */
export function createNextConfig(dirname) {
  const compat = new FlatCompat({
    baseDirectory: dirname,
  });

  return [
    { ignores: ['.next'] },
    ...compat.extends("next/core-web-vitals"),
    ...createBaseConfig()
  ];
}

export default createNextConfig;
```

Create `packages/eslint-config/node.js`:

```javascript
import { createBaseConfig } from "./base.js";

/**
 * ESLint config for Node.js packages (Lambda, libraries)
 */
export function createNodeConfig() {
  return [
    { ignores: ['dist', 'node_modules', '.serverless'] },
    ...createBaseConfig()
  ];
}

export default createNodeConfig;
```

### 2.3 Install dependencies

```bash
pnpm install
```

## Verification

After this phase:
- [ ] `packages/typescript-config/` contains base.json, next.json, node.json, library.json
- [ ] `packages/eslint-config/` contains base.js, next.js, node.js
- [ ] `pnpm install` completes without errors

## Files Created

```
packages/
├── typescript-config/
│   ├── package.json
│   ├── base.json
│   ├── next.json
│   ├── node.json
│   └── library.json
└── eslint-config/
    ├── package.json
    ├── base.js
    ├── next.js
    └── node.js
```

## Usage (for future phases)

### In apps/web/tsconfig.json:
```json
{
  "extends": "@propintel/typescript-config/next.json",
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

### In apps/web/eslint.config.js:
```javascript
import { createNextConfig } from "@propintel/eslint-config/next";

export default createNextConfig(import.meta.dirname);
```

### In apps/api/tsconfig.json:
```json
{
  "extends": "@propintel/typescript-config/node.json",
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules"]
}
```

### In apps/api/eslint.config.js:
```javascript
import { createNodeConfig } from "@propintel/eslint-config/node";

export default createNodeConfig();
```

## Rollback
```bash
rm -rf packages/typescript-config packages/eslint-config
```
