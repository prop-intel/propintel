/**
 * Database test utilities
 */

import { db } from '../../src/server/db';
import { users, jobs, sites } from '../../shared/db/schema';
import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';

/**
 * Create a test job
 */
export async function createTestJob(userId: string, overrides?: {
  targetUrl?: string;
  status?: string;
}) {
  const [job] = await db
    .insert(jobs)
    .values({
      userId,
      targetUrl: overrides?.targetUrl || 'https://example.com',
      status: (overrides?.status || 'pending') as 'pending' | 'queued' | 'crawling' | 'analyzing' | 'completed' | 'failed' | 'blocked',
      config: {
        maxPages: 10,
        maxDepth: 2,
      },
    })
    .returning();

  return job;
}

/**
 * Create a test site
 */
export async function createTestSite(userId: string, overrides?: {
  domain?: string;
  name?: string;
}) {
  const [site] = await db
    .insert(sites)
    .values({
      userId,
      domain: overrides?.domain || 'example.com',
      name: overrides?.name || 'Test Site',
      trackingId: nanoid(32),
    })
    .returning();

  return site;
}

/**
 * Get user by email
 */
export async function getUserByEmail(email: string) {
  return db.query.users.findFirst({
    where: eq(users.email, email),
  });
}

/**
 * Clean up test data
 */
export async function cleanupTestData(userId: string) {
  // Delete in correct order (respecting foreign keys)
  await db.delete(jobs).where(eq(jobs.userId, userId));
  await db.delete(sites).where(eq(sites.userId, userId));
}
