import { Langfuse } from "langfuse";

// ===================
// Configuration
// ===================

// Only initialize Langfuse if credentials are configured
const isConfigured = Boolean(
  process.env.LANGFUSE_PUBLIC_KEY && process.env.LANGFUSE_SECRET_KEY,
);

// Timeout for flush operations - observability should never block business logic
const FLUSH_TIMEOUT_MS = 3000;
const SHUTDOWN_TIMEOUT_MS = 5000;

export const langfuse = isConfigured
  ? new Langfuse({
      publicKey: process.env.LANGFUSE_PUBLIC_KEY!,
      secretKey: process.env.LANGFUSE_SECRET_KEY!,
      baseUrl: process.env.LANGFUSE_BASE_URL || "https://us.cloud.langfuse.com",
    })
  : null;

// ===================
// Trace Helpers
// ===================

// Helper to create a trace (returns no-op if Langfuse not configured)
export function createTrace(config: {
  name: string;
  userId: string;
  metadata?: Record<string, unknown>;
}):
  | ReturnType<NonNullable<typeof langfuse>["trace"]>
  | {
      generation: () => { end: () => void; update: () => void };
      span: () => { end: () => void };
    } {
  if (langfuse) {
    return langfuse.trace(config);
  }
  // Return a no-op trace object
  return {
    generation: () => ({
      end: () => {
        /* no-op when Langfuse not configured */
      },
      update: () => {
        /* no-op when Langfuse not configured */
      },
    }),
    span: () => ({
      end: () => {
        /* no-op when Langfuse not configured */
      },
    }),
  };
}

// ===================
// Flush Helpers (Timeout-Protected)
// ===================

/**
 * Helper to flush Langfuse (no-op if not configured)
 * @deprecated Use safeFlush() instead - this can hang indefinitely
 */
export async function flushLangfuse(): Promise<void> {
  if (langfuse) {
    await langfuse.flushAsync();
  }
}

/**
 * Non-blocking flush with timeout. Observability failures
 * should NEVER break business logic.
 *
 * Use this in agent code after LLM calls complete.
 */
export async function safeFlush(): Promise<void> {
  if (!langfuse) return;
  try {
    await Promise.race([
      langfuse.flushAsync(),
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error("Langfuse flush timeout")),
          FLUSH_TIMEOUT_MS,
        ),
      ),
    ]);
  } catch (error) {
    // Log locally, don't propagate - observability is best-effort
    console.warn(
      "[Langfuse] Flush failed (non-fatal):",
      (error as Error).message,
    );
  }
}

/**
 * Fire-and-forget flush. Use when you truly don't need confirmation.
 * Does not block at all - schedules flush and returns immediately.
 */
export function fireAndForgetFlush(): void {
  if (!langfuse) return;
  langfuse.flushAsync().catch((err: unknown) => {
    console.warn("[Langfuse] Background flush error:", (err as Error).message);
  });
}

/**
 * Graceful shutdown for Lambda - call at END of handler.
 * This is the only place we actually wait for Langfuse to finish,
 * with a timeout to prevent Lambda from hanging.
 */
export async function gracefulShutdown(): Promise<void> {
  if (!langfuse) return;
  try {
    await Promise.race([
      langfuse.shutdownAsync(),
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error("Shutdown timeout")),
          SHUTDOWN_TIMEOUT_MS,
        ),
      ),
    ]);
  } catch {
    console.warn("[Langfuse] Shutdown timeout, some events may be lost");
  }
}

// ===================
// Startup Logging
// ===================

// Log once at startup if Langfuse is not configured
if (!isConfigured) {
  console.log(
    "[Langfuse] Not configured - tracing disabled. Set LANGFUSE_PUBLIC_KEY and LANGFUSE_SECRET_KEY to enable.",
  );
}
