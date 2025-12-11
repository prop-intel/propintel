import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import { eq } from 'drizzle-orm';
import { db, authSession, authUser } from '../server/db';
import type { AuthUser } from '@propintel/database';

let devUserCache: AuthUser | null = null;

const DEV_USER_ID = '00000000-0000-0000-0000-000000000001';

const DEV_API_KEYS: Record<string, { userId: string; name: string }> = {
  'propintel-dev-key-2024': { userId: DEV_USER_ID, name: 'Development User' },
};

async function ensureDevUserExists(userId: string, name: string): Promise<AuthUser> {
  if (devUserCache?.id === userId) {
    return devUserCache;
  }

  const existingUser = await db.query.authUser.findFirst({
    where: eq(authUser.id, userId),
  });

  if (existingUser) {
    devUserCache = existingUser;
    return existingUser;
  }

  const [newUser] = await db.insert(authUser).values({
    id: userId,
    name,
    email: 'dev@propintel.local',
    emailVerified: new Date(),
    role: 'user',
  }).returning();

  if (!newUser) {
    throw new Error('Failed to create dev user');
  }

  devUserCache = newUser;
  return newUser;
}

export interface AuthContext {
  user: AuthUser;
  userId: string;
  isAuthenticated: boolean;
}

export interface AuthError {
  code: string;
  message: string;
}

export type AuthResult = 
  | { success: true; context: AuthContext }
  | { success: false; error: AuthError };

export async function validateSession(
  sessionToken: string
): Promise<{ userId: string; user: AuthUser } | null> {
  const session = await db.query.authSession.findFirst({
    where: eq(authSession.sessionToken, sessionToken),
    with: {
      user: true,
    },
  });

  if (!session || session.expires < new Date() || !session.user) {
    return null;
  }

  if (!session.user) {
    return null;
  }

  return {
    userId: session.userId,
    user: session.user,
  };
}

function extractSessionToken(event: APIGatewayProxyEventV2): string | null {
  const authHeaders = event.headers || {};
  const authHeader = authHeaders.authorization || authHeaders.Authorization || authHeaders.AUTHORIZATION;
  
  if (authHeader) {
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : authHeader.trim();
    if (token) {
      return token;
    }
  }

  const cookieHeader = authHeaders.cookie || authHeaders.Cookie || authHeaders.COOKIE;
  if (cookieHeader) {
    const match = /authjs\.session-token=([^;]+)/i.exec(cookieHeader);
    if (match?.[1]) {
      return match[1].trim();
    }
    const legacyMatch = /next-auth\.session-token=([^;]+)/i.exec(cookieHeader);
    if (legacyMatch?.[1]) {
      return legacyMatch[1].trim();
    }
  }

  const cookies = event.cookies || [];
  for (const cookie of cookies) {
    if (cookie.startsWith('authjs.session-token=')) {
      return cookie.replace('authjs.session-token=', '').split(';')[0]?.trim() ?? null;
    }
    if (cookie.startsWith('next-auth.session-token=')) {
      return cookie.replace('next-auth.session-token=', '').split(';')[0]?.trim() ?? null;
    }
  }

  return null;
}

export async function authenticateRequest(
  event: APIGatewayProxyEventV2
): Promise<AuthResult> {
  const apiKey = event.headers['x-api-key'] || event.headers['X-Api-Key'];
  if (apiKey) {
    const devUserConfig = DEV_API_KEYS[apiKey];
    if (devUserConfig) {
      const user = await ensureDevUserExists(devUserConfig.userId, devUserConfig.name);
      return {
        success: true,
        context: {
          user,
          userId: user.id,
          isAuthenticated: true,
        },
      };
    }
    return {
      success: false,
      error: {
        code: 'INVALID_API_KEY',
        message: 'Invalid API key',
      },
    };
  }

  const sessionToken = extractSessionToken(event);
  if (!sessionToken) {
    return {
      success: false,
      error: {
        code: 'MISSING_AUTH',
        message: 'No session token provided. Include Authorization header or session cookie.',
      },
    };
  }

  const sessionData = await validateSession(sessionToken);

  if (!sessionData) {
    return {
      success: false,
      error: {
        code: 'INVALID_SESSION',
        message: 'Invalid or expired session token',
      },
    };
  }

  return {
    success: true,
    context: {
      user: sessionData.user,
      userId: sessionData.userId,
      isAuthenticated: true,
    },
  };
}

const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(
  userId: string,
  limit = 1000, // Increased from 100 to 1000 requests per minute
  windowMs = 60000
): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const key = `rate:${userId}`;
  const current = rateLimitStore.get(key);

  // Clean up expired entries periodically (every 1000 calls)
  if (Math.random() < 0.001) {
    for (const [k, v] of rateLimitStore.entries()) {
      if (v.resetAt < now) {
        rateLimitStore.delete(k);
      }
    }
  }

  if (!current || current.resetAt < now) {
    rateLimitStore.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1, resetAt: now + windowMs };
  }

  if (current.count >= limit) {
    return { allowed: false, remaining: 0, resetAt: current.resetAt };
  }

  current.count++;
  rateLimitStore.set(key, current);
  return { allowed: true, remaining: limit - current.count, resetAt: current.resetAt };
}

export function canAccessJob(userId: string, jobUserId: string): boolean {
  return userId === jobUserId;
}

export function canCreateJob(_userId: string): { allowed: boolean; reason?: string } {
  return { allowed: true };
}

export async function validateRequest(
  event: APIGatewayProxyEventV2
): Promise<{ success: true; userId: string } | { success: false; error: string }> {
  const result = await authenticateRequest(event);
  if (!result.success) {
    return { success: false, error: result.error.message };
  }
  return { success: true, userId: result.context.userId };
}

/** @deprecated Use validateRequest instead */
export const validateApiKey = validateRequest;
