/**
 * Backend API Integration Tests
 *
 * Tests backend API endpoints to verify:
 * - Health check endpoint
 * - Job CRUD operations
 * - Authentication (API key and session token)
 * - Error handling
 * - Schema-dependent operations
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { makeBackendApiRequest, parseApiResponse } from "../utils/api";
import { createTestUserWithSession } from "../utils/auth";
import { closeDatabase } from "../setup/db";

const API_URL = process.env.TEST_API_URL || "http://localhost:4000";
const API_KEY = process.env.TEST_API_KEY || "propintel-dev-key-2024";

describe("Backend API Integration", () => {
  let testUser: Awaited<ReturnType<typeof createTestUserWithSession>>;

  beforeAll(async () => {
    testUser = await createTestUserWithSession();
  });

  afterAll(async () => {
    await closeDatabase();
  });

  describe("Health Check", () => {
    it("should return healthy status", async () => {
      const response = await makeBackendApiRequest(API_URL, "/health");
      expect(response.status).toBe(200);

      const data = await parseApiResponse<{ status: string }>(response);
      expect(data.status).toBe("healthy");
    });
  });

  describe("Authentication", () => {
    it("should authenticate with API key", async () => {
      const response = await makeBackendApiRequest(API_URL, "/dashboard/summary", {
        method: "GET",
        apiKey: API_KEY,
      });

      // Should not return 401 (unauthorized)
      expect(response.status).not.toBe(401);
    });

    it("should authenticate with session token", async () => {
      const response = await makeBackendApiRequest(API_URL, "/dashboard/summary", {
        method: "GET",
        sessionToken: testUser.sessionToken,
      });

      expect(response.status).not.toBe(401);
    });

    it("should authenticate with session cookie", async () => {
      const cookie = `authjs.session-token=${testUser.sessionToken}`;
      const response = await makeBackendApiRequest(API_URL, "/dashboard/summary", {
        method: "GET",
        cookie,
      });

      expect(response.status).not.toBe(401);
    });

    it("should reject unauthenticated requests", async () => {
      const response = await makeBackendApiRequest(API_URL, "/jobs", {
        method: "POST",
        body: { targetUrl: "https://example.com" },
        // No auth headers
      });

      expect(response.status).toBe(401);
    });
  });

  describe("Job Operations", () => {
    it("should create a job with API key", async () => {
      // Use unique URL to avoid deduplication
      const uniqueUrl = `https://example.com/apikey-test-${Date.now()}`;
      const response = await makeBackendApiRequest(API_URL, "/jobs", {
        method: "POST",
        apiKey: API_KEY,
        body: {
          targetUrl: uniqueUrl,
          userId: testUser.user.id, // Required when using API key auth
          config: {
            maxPages: 5,
            maxDepth: 2,
          },
        },
      });

      expect(response.status).toBe(201);

      const data = await parseApiResponse<{
        success: boolean;
        data: { job: { id: string; status: string } };
      }>(response);

      expect(data.success).toBe(true);
      expect(data.data.job).toBeDefined();
      expect(data.data.job.id).toBeDefined();
      expect(data.data.job.status).toBe("queued");
    });

    it("should create a job with session token", async () => {
      // Use unique URL to avoid deduplication
      const uniqueUrl = `https://example.com/session-test-${Date.now()}`;
      const response = await makeBackendApiRequest(API_URL, "/jobs", {
        method: "POST",
        sessionToken: testUser.sessionToken,
        body: {
          targetUrl: uniqueUrl,
          config: {
            maxPages: 5,
            maxDepth: 2,
          },
        },
      });

      expect(response.status).toBe(201);

      const data = await parseApiResponse<{
        success: boolean;
        data: { job: { id: string; userId: string } };
      }>(response);

      expect(data.success).toBe(true);
      expect(data.data.job.userId).toBe(testUser.user.id);
    });
  });

  describe("Schema-Dependent Operations", () => {
    it("should read from shared auth_user table", async () => {
      // This test verifies backend can query the shared auth_user table
      // by creating a user via frontend and querying via backend API
      const response = await makeBackendApiRequest(API_URL, "/dashboard/summary", {
        method: "GET",
        sessionToken: testUser.sessionToken,
      });

      // If backend can't read from auth_user, this would fail
      expect(response.status).not.toBe(401);
      expect(response.status).not.toBe(500);
    });

    it("should create jobs with user references from shared schema", async () => {
      // Use unique URL to avoid deduplication
      const uniqueUrl = `https://example.com/schema-test-${Date.now()}`;
      const response = await makeBackendApiRequest(API_URL, "/jobs", {
        method: "POST",
        sessionToken: testUser.sessionToken,
        body: {
          targetUrl: uniqueUrl,
        },
      });

      expect(response.status).toBe(201);

      const data = await parseApiResponse<{
        success: boolean;
        data: { job: { userId: string } };
      }>(response);

      // Verify the job was created with correct user reference
      expect(data.data.job.userId).toBe(testUser.user.id);
    });
  });

  describe("Error Handling", () => {
    it("should return 400 when API key auth is used without userId", async () => {
      const response = await makeBackendApiRequest(API_URL, "/jobs", {
        method: "POST",
        apiKey: API_KEY,
        body: {
          targetUrl: "https://example.com",
          // Missing userId - required when using API key auth
        },
      });

      expect(response.status).toBe(400);

      const data = await parseApiResponse<{
        success: boolean;
        error: { code: string; message: string };
      }>(response);

      expect(data.error.code).toBe("MISSING_USER_ID");
    });

    it("should return 400 for missing targetUrl", async () => {
      const response = await makeBackendApiRequest(API_URL, "/jobs", {
        method: "POST",
        apiKey: API_KEY,
        body: {
          userId: testUser.user.id,
          // Missing required targetUrl
          config: {},
        },
      });

      expect(response.status).toBe(400);
    });

    it("should return proper error format", async () => {
      // Test error format using report endpoint with invalid job ID
      const response = await makeBackendApiRequest(API_URL, "/jobs/invalid-id/report", {
        method: "GET",
        apiKey: API_KEY,
      });

      if (response.status !== 200) {
        const error = await parseApiResponse<{
          success: boolean;
          error: { code: string; message: string };
        }>(response);

        expect(error.success).toBe(false);
        expect(error.error).toBeDefined();
        expect(error.error.code).toBeDefined();
        expect(error.error.message).toBeDefined();
      }
    });
  });
});
