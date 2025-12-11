import { describe, it, expect, afterAll } from 'vitest';
import { authUser, users, jobs, sites } from '../../shared/db/schema';
import { db as frontendDb } from '../../src/server/db';
import { eq } from 'drizzle-orm';
import { getTestDb, closeDatabase } from '../setup/db';
import { createTestUser } from '../utils/auth';

describe('Schema Compatibility', () => {
  afterAll(async () => {
    await closeDatabase();
  });

  it('should import shared schemas from backend', () => {
    expect(authUser).toBeDefined();
    expect(users).toBeDefined();
    expect(jobs).toBeDefined();
    expect(sites).toBeDefined();
  });

  it('should have authUser alias reference users table', () => {
    // authUser should be the same reference as users
    expect(authUser).toBe(users);
  });

  it('should query users table using authUser alias from backend', async () => {
    const testUser = await createTestUser();
    const backendDb = getTestDb();

    const result = await backendDb.query.authUser.findFirst({
      where: eq(authUser.id, testUser.id),
    });

    expect(result).toBeDefined();
    expect(result?.id).toBe(testUser.id);
    expect(result?.email).toBe(testUser.email);
  });

  it('should query users table using users from frontend', async () => {
    const testUser = await createTestUser();

    const result = await frontendDb.query.users.findFirst({
      where: eq(users.id, testUser.id),
    });

    expect(result).toBeDefined();
    expect(result?.id).toBe(testUser.id);
  });

  it('should create jobs with user references from backend', async () => {
    const testUser = await createTestUser();
    const backendDb = getTestDb();

    const [job] = await backendDb
      .insert(jobs)
      .values({
        userId: testUser.id,
        targetUrl: 'https://example.com',
        status: 'pending',
        config: {
          maxPages: 10,
          maxDepth: 2,
        },
      })
      .returning();

    expect(job).toBeDefined();
    expect(job.userId).toBe(testUser.id);

    const retrievedJob = await backendDb.query.jobs.findFirst({
      where: eq(jobs.id, job.id),
    });

    expect(retrievedJob).toBeDefined();
    expect(retrievedJob?.userId).toBe(testUser.id);
  });

  it('should use relations from shared schema', async () => {
    const testUser = await createTestUser();
    const backendDb = getTestDb();
    const [job] = await backendDb
      .insert(jobs)
      .values({
        userId: testUser.id,
        targetUrl: 'https://example.com',
        status: 'pending',
        config: {
          maxPages: 10,
          maxDepth: 2,
        },
      })
      .returning();

    const jobWithUser = await backendDb.query.jobs.findFirst({
      where: eq(jobs.id, job.id),
      with: {
        user: true,
      },
    });

    expect(jobWithUser).toBeDefined();
    expect(jobWithUser?.user).toBeDefined();
    expect(jobWithUser?.user.id).toBe(testUser.id);
  });

  it('should export correct types from shared schema', async () => {
    const testUser = await createTestUser();
    
    type AuthUserType = typeof authUser.$inferSelect;
    const userFromBackend: AuthUserType = testUser;
    expect(userFromBackend.id).toBe(testUser.id);
  });

  it('should handle schema imports in different contexts', async () => {
    const frontendExports = await import('../../src/server/db/schema');
    expect(frontendExports.users).toBeDefined();
    expect(frontendExports.authUser).toBeDefined();
    expect(frontendExports.jobs).toBeDefined();
    expect(frontendExports.sites).toBeDefined();
    expect(frontendExports.authUser).toBe(frontendExports.users);
  });
});
