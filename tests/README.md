# Testing Guide

## Quick Start

Run all tests with automatic setup:

```bash
npm run test:all
```

This command will:
- ✅ Check if database is running, start it if needed
- ✅ Run database migrations
- ✅ Check backend API status
- ✅ Run all integration tests
- ✅ Provide helpful error messages and tips

## Test Commands

- `npm run test:all` - Run all tests with automatic setup
- `npm run test:integration` - Run integration tests only
- `npm run test:watch` - Run tests in watch mode
- `npm run test:ui` - Open Vitest UI

## Prerequisites

### Database

The test runner will automatically try to start the database using `./start-database.sh`. 

To manually start the database:

```bash
./start-database.sh
```

Or set `TEST_DATABASE_URL` in your `.env` file to point to your test database.

### Backend API

Most tests use MSW (Mock Service Worker) to mock the backend API, so you don't need the backend running.

If you want to test against a real backend API:

1. Start the backend: `cd backend && npm run dev`
2. Set `USE_REAL_BACKEND=true` (optional, tests will detect if backend is running)

## Environment Variables

Tests load environment variables from:
1. System environment variables (highest priority)
2. `.env` file (root)
3. `backend/.env` file
4. Fallback defaults in `tests/setup.ts`

Key test environment variables:
- `TEST_DATABASE_URL` - Test database connection string
- `TEST_API_URL` - Backend API URL (default: `http://localhost:4000`)
- `USE_REAL_BACKEND` - Use real backend instead of mocks

## Test Structure

```
tests/
├── setup.ts              # Global test setup
├── setup/
│   ├── db.ts            # Database utilities
│   └── test-env.ts      # Test environment config
├── utils/
│   ├── auth.ts          # Authentication helpers
│   ├── api.ts           # API request helpers
│   └── db.ts            # Database test utilities
├── mocks/
│   ├── handlers.ts      # MSW handlers for backend API
│   └── aws.ts          # AWS service mocks
├── fixtures/
│   ├── users.ts        # User test data
│   └── jobs.ts         # Job test data
└── integration/
    ├── schema.test.ts           # Schema compatibility tests
    ├── backend-api.test.ts     # Backend API integration
    ├── frontend-backend.test.ts # Frontend-backend communication
    ├── auth-flow.test.ts       # Authentication flow
    ├── e2e-workflow.test.ts    # End-to-end workflows
    └── aws-deployment.test.ts  # AWS deployment verification
```

## Troubleshooting

### Database Connection Errors

If you see `ECONNREFUSED` errors:
1. Ensure PostgreSQL is running: `./start-database.sh`
2. Check `TEST_DATABASE_URL` in `.env`
3. Verify database is accessible: `psql $TEST_DATABASE_URL`

### Backend API Errors

If tests fail with backend connection errors:
- Tests use MSW mocks by default, so backend doesn't need to be running
- If testing against real backend, ensure it's running on the port specified in `TEST_API_URL`

### Port Already in Use

If you see port conflicts:
- Database: Change `TEST_DATABASE_URL` port or stop existing database
- Backend: Change `TEST_API_URL` port or stop existing backend

## Writing Tests

### Example: Database Test

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

### Example: API Test with Mocks

```typescript
import { describe, it, expect } from 'vitest';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';

const server = setupServer(
  http.get('/api/test', () => {
    return HttpResponse.json({ success: true });
  })
);

describe('API Test', () => {
  beforeAll(() => server.listen());
  afterAll(() => server.close());

  it('should call API', async () => {
    const response = await fetch('/api/test');
    const data = await response.json();
    expect(data.success).toBe(true);
  });
});
```
