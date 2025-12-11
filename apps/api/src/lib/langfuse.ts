import { Langfuse } from 'langfuse';

// Only initialize Langfuse if credentials are configured
const isConfigured = Boolean(
  process.env.LANGFUSE_PUBLIC_KEY && process.env.LANGFUSE_SECRET_KEY
);

export const langfuse = isConfigured
  ? new Langfuse({
      publicKey: process.env.LANGFUSE_PUBLIC_KEY!,
      secretKey: process.env.LANGFUSE_SECRET_KEY!,
      baseUrl: process.env.LANGFUSE_BASE_URL || 'https://us.cloud.langfuse.com',
    })
  : null;

// Helper to create a trace (returns no-op if Langfuse not configured)
export function createTrace(config: {
  name: string;
  userId: string;
  metadata?: Record<string, unknown>;
}) {
  if (langfuse) {
    return langfuse.trace(config);
  }
  // Return a no-op trace object
  return {
    generation: () => ({
      end: () => { /* no-op when Langfuse not configured */ },
    }),
  };
}

// Helper to flush Langfuse (no-op if not configured)
export async function flushLangfuse(): Promise<void> {
  if (langfuse) {
    await langfuse.flushAsync();
  }
}

// Log once at startup if Langfuse is not configured
if (!isConfigured) {
  console.log('[Langfuse] Not configured - tracing disabled. Set LANGFUSE_PUBLIC_KEY and LANGFUSE_SECRET_KEY to enable.');
}
