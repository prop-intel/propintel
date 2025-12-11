import { getTestDb } from "../setup/db";
import { users, sessions } from "@propintel/database";
import bcrypt from "bcryptjs";
import { nanoid } from "nanoid";

export async function createTestUser(overrides?: {
  email?: string;
  name?: string;
  password?: string;
}) {
  const db = getTestDb();
  const email = overrides?.email || `test-${nanoid()}@example.com`;
  const name = overrides?.name || "Test User";
  const password = overrides?.password || "test-password-123";

  const hashedPassword = await bcrypt.hash(password, 10);

  const [user] = await db
    .insert(users)
    .values({
      email,
      name,
      password: hashedPassword,
      emailVerified: new Date(),
    })
    .returning();

  return user;
}

export async function createTestSession(userId: string) {
  const db = getTestDb();
  const sessionToken = nanoid(32);
  const expires = new Date();
  expires.setDate(expires.getDate() + 30);

  const [session] = await db
    .insert(sessions)
    .values({
      sessionToken,
      userId,
      expires,
    })
    .returning();

  return session;
}

export async function createTestUserWithSession(overrides?: {
  email?: string;
  name?: string;
  password?: string;
}) {
  const user = await createTestUser(overrides);
  const session = await createTestSession(user.id);

  return {
    user,
    session,
    sessionToken: session.sessionToken,
  };
}

export function getSessionCookie(sessionToken: string): string {
  return `authjs.session-token=${sessionToken}`;
}
