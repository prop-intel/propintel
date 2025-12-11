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
      const response = await makeBackendApiRequest(API_URL, "/jobs", {
        method: "GET",
        apiKey: API_KEY,
      });

      // Should not return 401 (unauthorized)
      expect(response.status).not.toBe(401);
    });

    it("should authenticate with session token", async () => {
      const response = await makeBackendApiRequest(API_URL, "/jobs", {
        method: "GET",
        sessionToken: testUser.sessionToken,
      });

      expect(response.status).not.toBe(401);
    });

    it("should authenticate with session cookie", async () => {
      const cookie = `authjs.session-token=${testUser.sessionToken}`;
      const response = await makeBackendApiRequest(API_URL, "/jobs", {
        method: "GET",
        cookie,
      });

      expect(response.status).not.toBe(401);
    });

    it("should reject unauthenticated requests", async () => {
      const response = await makeBackendApiRequest(API_URL, "/jobs", {
        method: "GET",
        // No auth headers
      });

      expect(response.status).toBe(401);
    });
  });

  describe("Job Operations", () => {
    it("should create a job with API key", async () => {
      const response = await makeBackendApiRequest(API_URL, "/jobs", {
        method: "POST",
        apiKey: API_KEY,
        body: {
          targetUrl: "https://example.com",
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
      const response = await makeBackendApiRequest(API_URL, "/jobs", {
        method: "POST",
        sessionToken: testUser.sessionToken,
        body: {
          targetUrl: "https://example.com",
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

    it("should retrieve a job by ID", async () => {
      // First create a job
      const createResponse = await makeBackendApiRequest(API_URL, "/jobs", {
        method: "POST",
        apiKey: API_KEY,
        body: {
          targetUrl: "https://example.com",
        },
      });

      const createData = await parseApiResponse<{
        success: boolean;
        data: { job: { id: string } };
      }>(createResponse);

      const jobId = createData.data.job.id;

      // Then retrieve it
      const getResponse = await makeBackendApiRequest(
        API_URL,
        `/jobs/${jobId}`,
        {
          method: "GET",
          apiKey: API_KEY,
        }
      );

      expect(getResponse.status).toBe(200);

      const getData = await parseApiResponse<{
        success: boolean;
        data: { job: { id: string } };
      }>(getResponse);

      expect(getData.success).toBe(true);
      expect(getData.data.job.id).toBe(jobId);
    });

    it("should list jobs", async () => {
      const response = await makeBackendApiRequest(API_URL, "/jobs?limit=10", {
        method: "GET",
        apiKey: API_KEY,
      });

      expect(response.status).toBe(200);

      const data = await parseApiResponse<{
        success: boolean;
        data: {
          jobs: unknown[];
          pagination: { limit: number; offset: number; hasMore: boolean };
        };
      }>(response);

      expect(data.success).toBe(true);
      expect(Array.isArray(data.data.jobs)).toBe(true);
      expect(data.data.pagination).toBeDefined();
      expect(typeof data.data.pagination.hasMore).toBe("boolean");
    });

    it("should return 404 for non-existent job", async () => {
      const response = await makeBackendApiRequest(
        API_URL,
        "/jobs/non-existent-id-12345",
        {
          method: "GET",
          apiKey: API_KEY,
        }
      );

      expect(response.status).toBe(404);
    });
  });

  describe("Schema-Dependent Operations", () => {
    it("should read from shared auth_user table", async () => {
      // This test verifies backend can query the shared auth_user table
      // by creating a user via frontend and querying via backend API
      const response = await makeBackendApiRequest(API_URL, "/jobs", {
        method: "GET",
        sessionToken: testUser.sessionToken,
      });

      // If backend can't read from auth_user, this would fail
      expect(response.status).not.toBe(401);
      expect(response.status).not.toBe(500);
    });

    it("should create jobs with user references from shared schema", async () => {
      const response = await makeBackendApiRequest(API_URL, "/jobs", {
        method: "POST",
        sessionToken: testUser.sessionToken,
        body: {
          targetUrl: "https://example.com",
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
    it("should return 400 for invalid job data", async () => {
      const response = await makeBackendApiRequest(API_URL, "/jobs", {
        method: "POST",
        apiKey: API_KEY,
        body: {
          // Missing required targetUrl
          config: {},
        },
      });

      expect(response.status).toBe(400);
    });

    it("should return proper error format", async () => {
      const response = await makeBackendApiRequest(API_URL, "/jobs/invalid-id", {
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
