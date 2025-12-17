/**
 * Shared LLM Utilities
 *
 * Provides retry logic and provider fallback for all LLM-calling agents.
 * Centralizes resilience patterns to ensure consistent behavior across the system.
 */

import { createOpenAI } from "@ai-sdk/openai";

// ===================
// Configuration
// ===================

/**
 * Default timeout for LLM API calls (60 seconds)
 * Long enough for complex prompts, short enough to fail fast
 */
export const LLM_TIMEOUT_MS = 60_000;

// ===================
// Provider Initialization
// ===================

/**
 * Primary OpenAI provider
 */
export const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY || "",
});

/**
 * Fallback OpenRouter provider (uses OpenAI-compatible API)
 * OpenRouter provides access to multiple models including OpenAI, Anthropic, etc.
 */
export const openrouter = createOpenAI({
  apiKey: process.env.OPENROUTER_API_KEY || "",
  baseURL: "https://openrouter.ai/api/v1",
});

export function getOpenAIClient() {
  return createOpenAI({
    apiKey: process.env.OPENAI_API_KEY || "",
  });
}

/**
 * Provider type for type safety
 */
export type LLMProvider = typeof openai;

// ===================
// Provider Fallback
// ===================

/**
 * Passthrough function (fallback disabled)
 */
// export async function withProviderFallback<T>(
//   fn: (provider: LLMProvider) => Promise<T>,
//   _agentName: string
// ): Promise<T> {
//   return fn(openai);
// }

export async function withProviderFallback<T>(
  fn: (provider: LLMProvider) => Promise<T>,
  agentName: string,
): Promise<T> {
  const client = getOpenAIClient();
  try {
    return await fn(client);
  } catch (error) {
    console.error(
      `\x1b[41m\x1b[37m [${agentName}] OpenAI error: \x1b[0m`,
      error,
    );
    throw error;
  }
}

// /**
//  * Execute a function with provider fallback
//  *
//  * Tries the primary provider (OpenAI) first, then falls back to
//  * OpenRouter if available and the primary fails.
//  *
//  * @param fn - Function that takes a provider and returns a promise
//  * @param agentName - Name of the calling agent (for logging)
//  * @returns The result of the function
//  * @throws The last error if all providers fail
//  *
//  * @example
//  * ```typescript
//  * const result = await withProviderFallback(
//  *   (provider) => generateObject({ model: provider('gpt-4o-mini'), ... }),
//  *   'Page Analysis'
//  * );
//  * ```
//  */
// export async function withProviderFallback<T>(
//   fn: (provider: LLMProvider) => Promise<T>,
//   agentName: string
// ): Promise<T> {
//   // Try OpenAI first with retries
//   try {
//     console.log(`[${agentName}] Trying OpenAI...`);
//     const result = await withRetry(() => fn(openai), agentName, "OpenAI");
//     return result;
//   } catch (openaiError) {
//     // If OpenRouter key is available, try it as fallback
//     if (process.env.OPENROUTER_API_KEY) {
//       console.log(`[${agentName}] OpenAI failed, falling back to OpenRouter...`);
//       try {
//         const result = await withRetry(() => fn(openrouter), agentName, "OpenRouter");
//         return result;
//       } catch (openrouterError) {
//         console.error(`[${agentName}] Both providers failed`);
//         throw openrouterError;
//       }
//     }
//     throw openaiError;
//   }
// }

// ===================
// Convenience Helpers
// ===================

/**
 * Check if OpenRouter fallback is configured
 */
export function hasOpenRouterFallback(): boolean {
  return Boolean(process.env.OPENROUTER_API_KEY);
}

/**
 * Get the configured providers info (for logging/debugging)
 */
export function getProviderInfo(): {
  primary: string;
  fallback: string | null;
} {
  return {
    primary: "OpenAI",
    fallback: hasOpenRouterFallback() ? "OpenRouter" : null,
  };
}

/**
 * Check if an error is likely a timeout
 */
export function isTimeoutError(error: Error): boolean {
  const msg = error.message.toLowerCase();
  return msg.includes("abort") || msg.includes("timeout");
}

/**
 * Check if an error is likely a rate limit
 */
export function isRateLimitError(error: Error): boolean {
  const msg = error.message.toLowerCase();
  return (
    msg.includes("rate limit") ||
    msg.includes("429") ||
    msg.includes("too many requests")
  );
}
