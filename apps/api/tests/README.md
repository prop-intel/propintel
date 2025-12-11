# API Tests

Integration and unit tests for the PropIntel API.

## Quick Start

Run all tests:

```bash
pnpm test
```

## Test Structure

```
tests/
├── setup.ts              # Global test setup
├── setup/
│   └── db.ts             # Database utilities
├── utils/
│   ├── auth.ts           # Authentication helpers
│   ├── api.ts            # API request helpers
│   └── db.ts             # Database test utilities
├── mocks/
│   ├── handlers.ts       # MSW handlers for API mocking
│   └── aws.ts            # AWS service mocks
├── fixtures/
│   ├── users.ts          # User test data
│   └── jobs.ts           # Job test data
└── integration/
    ├── backend-api.test.ts      # Backend API endpoint tests
    ├── auth-flow.test.ts        # Authentication flow tests
    ├── aws-deployment.test.ts   # AWS deployment verification
    ├── e2e-workflow.test.ts     # End-to-end workflow tests
    ├── frontend-backend.test.ts # Frontend-backend integration
    └── schema.test.ts           # Schema compatibility tests
```

## Prerequisites

### Database

Tests require a PostgreSQL database. Set `TEST_DATABASE_URL` or `DATABASE_URL`:

```bash
TEST_DATABASE_URL=postgresql://postgres:password@localhost:5432/propintel_test
```

### Backend API

Most tests use MSW (Mock Service Worker) to mock the backend API. For real backend tests:

1. Start the backend: `pnpm dev`
2. Set `TEST_API_URL` (default: `http://localhost:4000`)

## Environment Variables

- `TEST_DATABASE_URL` - Test database connection string
- `TEST_API_URL` - Backend API URL (default: `http://localhost:4000`)
- `TEST_API_KEY` - API key for testing (default: `propintel-dev-key-2024`)
- `AWS_API_URL` - Deployed AWS API URL (for AWS deployment tests)

## Test Categories

### Backend API Tests (`backend-api.test.ts`)
Tests API endpoints: health check, authentication, job CRUD operations.

### Auth Flow Tests (`auth-flow.test.ts`)
Tests NextAuth session validation with the backend.

### AWS Deployment Tests (`aws-deployment.test.ts`)
Verifies deployed Lambda functions work correctly. Requires `AWS_API_URL`.

### E2E Workflow Tests (`e2e-workflow.test.ts`)
Tests complete user workflows through the API.

### Schema Tests (`schema.test.ts`)
Verifies shared database schema compatibility.

## Writing Tests

### Database Test Example

```typescript
import { describe, it, expect, afterAll } from 'vitest';
import { getTestDb, closeDatabase } from '../setup/db';
import { createTestUser } from '../utils/auth';

describe('My Feature', () => {
  afterAll(async () => {
    await closeDatabase();
  });

  it('should do something', async () => {
    const user = await createTestUser();
    // Your test here
  });
});
```

### API Test Example

```typescript
import { describe, it, expect } from 'vitest';
import { makeBackendApiRequest, parseApiResponse } from '../utils/api';

describe('API Test', () => {
  it('should call API', async () => {
    const response = await makeBackendApiRequest(
      'http://localhost:4000',
      '/health'
    );
    const data = await parseApiResponse<{ status: string }>(response);
    expect(data.status).toBe('healthy');
  });
});
```
