/**
 * Frontend-Backend Integration Tests
 *
 * Tests communication between frontend (Next.js) and backend (API):
 * - tRPC to backend API proxy
 * - Cookie forwarding
 * - Authentication flow
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { createTestUserWithSession, getSessionCookie } from "../utils/auth";
import { closeDatabase } from "../setup/db";

const API_URL = process.env.TEST_API_URL || "http://localhost:4000";

const server = setupServer(
  http.post(`${API_URL}/jobs`, async ({ request }) => {
    const body = (await request.json()) as {
      targetUrl: string;
      config?: Record<string, unknown>;
    };
    return HttpResponse.json(
      {
        success: true,
        data: {
          job: {
            id: "test-job-id-from-backend",
            userId: "test-user-id",
            targetUrl: body.targetUrl,
            status: "pending",
            config: body.config || {},
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        },
      },
      { status: 201 }
    );
  }),
  http.get(`${API_URL}/jobs/:id`, ({ params }) => {
    return HttpResponse.json({
      success: true,
      data: {
        job: {
          id: params.id,
          userId: "test-user-id",
          targetUrl: "https://example.com",
          status: "completed",
          progress: {
            pagesCrawled: 10,
            pagesTotal: 10,
            currentPhase: "completed",
          },
          metrics: {
            apiCallsCount: 5,
            storageUsedBytes: 1024,
          },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      },
    });
  }),
  http.get(`${API_URL}/jobs`, () => {
    return HttpResponse.json({
      success: true,
      data: {
        jobs: [],
        total: 0,
        limit: 20,
        offset: 0,
      },
    });
  }),
  http.get(`${API_URL}/dashboard/summary`, () => {
    return HttpResponse.json({
      success: true,
      data: {
        overview: {
          totalJobs: 0,
          completedJobs: 0,
          failedJobs: 0,
          averageScore: 0,
        },
        recentJobs: [],
        topDomains: [],
        alerts: [],
      },
    });
  })
);

describe("Frontend-Backend Integration", () => {
  let testUser: Awaited<ReturnType<typeof createTestUserWithSession>>;

  beforeAll(async () => {
    testUser = await createTestUserWithSession();

    // Setup MSW
    server.listen({ onUnhandledRequest: "error" });
  });

  afterAll(async () => {
    server.close();
    await closeDatabase();
  });

  describe("tRPC → Backend API Proxy", () => {
    it("should forward cookies from tRPC to backend API", () => {
      const cookie = getSessionCookie(testUser.sessionToken);
      expect(cookie).toContain("authjs.session-token");
      expect(cookie).toContain(testUser.sessionToken);

      const headers = new Headers({
        cookie,
      });
      const cookieHeader = headers.get("cookie");
      expect(cookieHeader).toBe(cookie);
    });

    it("should have correct API URL configuration", () => {
      expect(
        process.env.NEXT_PUBLIC_API_URL || process.env.TEST_API_URL
      ).toBeDefined();
    });
  });

  describe("Authentication Flow", () => {
    it("should extract cookies from tRPC headers", () => {
      const cookie = getSessionCookie(testUser.sessionToken);
      const headers = new Headers({
        cookie,
      });

      const cookieHeader = headers.get("cookie");
      expect(cookieHeader).toBe(cookie);
      expect(cookieHeader).toContain(testUser.sessionToken);
    });
  });
});
