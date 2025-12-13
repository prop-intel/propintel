/**
 * Authentication Flow Tests
 *
 * Verifies NextAuth sessions work with backend:
 * - User login creates session in database
 * - Backend can validate session token
 * - Backend can validate session cookie
 * - Session expiration handling
 * - Invalid session rejection
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { eq } from "drizzle-orm";
import { sessions } from "@propintel/database";
import { getTestDb, closeDatabase } from "../setup/db";
import {
  createTestUser,
  createTestSession,
  getSessionCookie,
} from "../utils/auth";
import { makeBackendApiRequest } from "../utils/api";

const API_URL = process.env.TEST_API_URL || "http://localhost:4000";
const API_KEY = process.env.TEST_API_KEY || "propintel-dev-key-2024";

describe("Authentication Flow", () => {
  // Shared test user - created once, reused across all tests
  let testUser: Awaited<ReturnType<typeof createTestUser>>;

  beforeAll(async () => {
    testUser = await createTestUser();
  });

  afterAll(async () => {
    await closeDatabase();
  });

  describe("Session Creation", () => {
    it("should create session in database when user logs in", async () => {
      const db = getTestDb();
      const session = await createTestSession(testUser.id);

      // Verify session exists in database
      const dbSession = await db.query.sessions.findFirst({
        where: eq(sessions.sessionToken, session.sessionToken),
      });

      expect(dbSession).toBeDefined();
      expect(dbSession?.userId).toBe(testUser.id);
      expect(dbSession?.sessionToken).toBe(session.sessionToken);
    });

    it("should link session to correct user", async () => {
      const db = getTestDb();
      const session = await createTestSession(testUser.id);

      const dbSession = await db.query.sessions.findFirst({
        where: eq(sessions.sessionToken, session.sessionToken),
        with: {
          user: true,
        },
      });

      expect(dbSession?.user).toBeDefined();
      expect(dbSession?.user.id).toBe(testUser.id);
      expect(dbSession?.user.email).toBe(testUser.email);
    });
  });

  describe("Backend Session Validation", () => {
    it("should validate session token via Authorization header", async () => {
      const session = await createTestSession(testUser.id);

      const response = await makeBackendApiRequest(API_URL, "/jobs", {
        method: "GET",
        sessionToken: session.sessionToken,
      });

      // Should not return 401 if session is valid
      expect(response.status).not.toBe(401);
    });

    it("should validate session token via cookie", async () => {
      const session = await createTestSession(testUser.id);
      const cookie = getSessionCookie(session.sessionToken);

      const response = await makeBackendApiRequest(API_URL, "/jobs", {
        method: "GET",
        cookie,
      });

      // Should not return 401 if session is valid
      expect(response.status).not.toBe(401);
    });

    it("should reject invalid session token", async () => {
      const response = await makeBackendApiRequest(API_URL, "/jobs", {
        method: "GET",
        sessionToken: "invalid-session-token-12345",
      });

      expect(response.status).toBe(401);
    });

    it("should reject expired session", async () => {
      const db = getTestDb();

      // Create expired session with unique token
      const expiredToken = `expired-token-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const expiredDate = new Date();
      expiredDate.setDate(expiredDate.getDate() - 1); // Yesterday

      await db.insert(sessions).values({
        sessionToken: expiredToken,
        userId: testUser.id,
        expires: expiredDate,
      });

      const response = await makeBackendApiRequest(API_URL, "/jobs", {
        method: "GET",
        sessionToken: expiredToken,
      });

      // Backend should reject expired sessions
      expect(response.status).toBe(401);
    });
  });

  describe("Session Cookie Format", () => {
    it("should format cookie correctly for NextAuth", () => {
      const sessionToken = "test-session-token-12345";
      const cookie = getSessionCookie(sessionToken);

      expect(cookie).toBe(`authjs.session-token=${sessionToken}`);
    });

    it("should extract session token from cookie", () => {
      const sessionToken = "test-session-token-12345";
      const cookie = getSessionCookie(sessionToken);

      // Simulate cookie parsing
      const cookieParts = cookie.split("=");
      expect(cookieParts[0]).toBe("authjs.session-token");
      expect(cookieParts[1]).toBe(sessionToken);
    });
  });

  describe("User-Session Relationship", () => {
    it("should allow backend to query user from session", async () => {
      const db = getTestDb();
      const session = await createTestSession(testUser.id);

      // Backend should be able to query user via session
      const dbSession = await db.query.sessions.findFirst({
        where: eq(sessions.sessionToken, session.sessionToken),
        with: {
          user: true,
        },
      });

      expect(dbSession?.user).toBeDefined();
      expect(dbSession?.user.id).toBe(testUser.id);
    });

    it("should handle multiple sessions for same user", async () => {
      const db = getTestDb();
      const session1 = await createTestSession(testUser.id);
      const session2 = await createTestSession(testUser.id);

      expect(session1.sessionToken).not.toBe(session2.sessionToken);

      // Both sessions should be valid
      const dbSessions = await db.query.sessions.findMany({
        where: eq(sessions.userId, testUser.id),
      });

      expect(dbSessions.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe("API Key Fallback", () => {
    it("should allow API key authentication for development", async () => {
      const response = await makeBackendApiRequest(API_URL, "/jobs", {
        method: "GET",
        apiKey: API_KEY,
      });

      // API key should work
      expect(response.status).not.toBe(401);
    });

    it("should prioritize API key over session token when both provided", async () => {
      const session = await createTestSession(testUser.id);

      // When both API key and session are provided, API key is checked first
      // This is by design - API key indicates a trusted server-to-server call
      const response = await makeBackendApiRequest(API_URL, "/jobs", {
        method: "GET",
        sessionToken: session.sessionToken,
        apiKey: API_KEY, // Both provided, API key takes precedence
      });

      // Should work - API key is valid
      expect(response.status).not.toBe(401);
    });
  });
});
