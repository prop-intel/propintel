/**
 * Schema Compatibility Tests
 *
 * Tests that the shared database schema works correctly
 * across both frontend and backend applications.
 */

import { describe, it, expect, afterAll } from "vitest";
import { eq } from "drizzle-orm";
import { authUser, users, jobs, sites } from "@propintel/database";
import { getTestDb, closeDatabase } from "../setup/db";
import { createTestUser } from "../utils/auth";

describe("Schema Compatibility", () => {
  afterAll(async () => {
    await closeDatabase();
  });

  it("should import shared schemas from database package", () => {
    expect(authUser).toBeDefined();
    expect(users).toBeDefined();
    expect(jobs).toBeDefined();
    expect(sites).toBeDefined();
  });

  it("should have authUser alias reference users table", () => {
    // authUser should be the same reference as users
    expect(authUser).toBe(users);
  });

  it("should query users table using authUser alias", async () => {
    const db = getTestDb();
    const testUser = await createTestUser();

    const result = await db.query.authUser.findFirst({
      where: eq(authUser.id, testUser.id),
    });

    expect(result).toBeDefined();
    expect(result?.id).toBe(testUser.id);
    expect(result?.email).toBe(testUser.email);
  });

  it("should query users table using users export", async () => {
    const db = getTestDb();
    const testUser = await createTestUser();

    const result = await db.query.users.findFirst({
      where: eq(users.id, testUser.id),
    });

    expect(result).toBeDefined();
    expect(result?.id).toBe(testUser.id);
  });

  it("should create jobs with user references", async () => {
    const db = getTestDb();
    const testUser = await createTestUser();

    const [job] = await db
      .insert(jobs)
      .values({
        userId: testUser.id,
        targetUrl: "https://example.com",
        status: "pending",
        config: {
          maxPages: 10,
          maxDepth: 2,
        },
      })
      .returning();

    expect(job).toBeDefined();
    expect(job.userId).toBe(testUser.id);

    const retrievedJob = await db.query.jobs.findFirst({
      where: eq(jobs.id, job.id),
    });

    expect(retrievedJob).toBeDefined();
    expect(retrievedJob?.userId).toBe(testUser.id);
  });

  it("should use relations from shared schema", async () => {
    const db = getTestDb();
    const testUser = await createTestUser();
    const [job] = await db
      .insert(jobs)
      .values({
        userId: testUser.id,
        targetUrl: "https://example.com",
        status: "pending",
        config: {
          maxPages: 10,
          maxDepth: 2,
        },
      })
      .returning();

    const jobWithUser = await db.query.jobs.findFirst({
      where: eq(jobs.id, job.id),
      with: {
        user: true,
      },
    });

    expect(jobWithUser).toBeDefined();
    expect(jobWithUser?.user).toBeDefined();
    expect(jobWithUser?.user.id).toBe(testUser.id);
  });

  it("should export correct types from shared schema", async () => {
    const testUser = await createTestUser();

    type AuthUserType = typeof authUser.$inferSelect;
    const userFromBackend: AuthUserType = testUser;
    expect(userFromBackend.id).toBe(testUser.id);
  });

  it("should handle schema imports in different contexts", async () => {
    // Verify exports from @propintel/database
    const dbPackage = await import("@propintel/database");
    expect(dbPackage.users).toBeDefined();
    expect(dbPackage.authUser).toBeDefined();
    expect(dbPackage.jobs).toBeDefined();
    expect(dbPackage.sites).toBeDefined();
    expect(dbPackage.authUser).toBe(dbPackage.users);
  });
});
