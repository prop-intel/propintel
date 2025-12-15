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

/**
 * Maximum retry attempts before giving up
 */
export const MAX_RETRIES = 3;

/**
 * Base delay for exponential backoff (milliseconds)
 * Actual delays: 1s, 2s, 4s
 */
const BASE_DELAY_MS = 1000;

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

/**
 * Provider type for type safety
 */
export type LLMProvider = typeof openai;

// ===================
// Retry Logic
// ===================

/**
 * Execute a function with exponential backoff retry logic
 *
 * @param fn - The async function to execute
 * @param agentName - Name of the calling agent (for logging)
 * @param providerName - Name of the provider being used (for logging)
 * @param maxRetries - Maximum number of retry attempts
 * @returns The result of the function
 * @throws The last error if all retries fail
 *
 * @example
 * ```typescript
 * const result = await withRetry(
 *   () => generateObject({ model: openai('gpt-4o-mini'), ... }),
 *   'Page Analysis',
 *   'OpenAI'
 * );
 * ```
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  agentName: string,
  providerName: string,
  maxRetries = MAX_RETRIES
): Promise<T> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      const isLastAttempt = attempt === maxRetries;
      const errorMsg = (error as Error).message;

      if (isLastAttempt) {
        console.error(
          `[${agentName}] All ${maxRetries} attempts failed with ${providerName}`
        );
        throw error;
      }

      // Exponential backoff: 1s, 2s, 4s
      const delay = BASE_DELAY_MS * Math.pow(2, attempt - 1);
      console.log(
        `[${agentName}] ${providerName} attempt ${attempt} failed: ${errorMsg}`
      );
      console.log(
        `[${agentName}] Retrying in ${delay}ms... (${attempt}/${maxRetries})`
      );
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  // TypeScript requires this, but it's unreachable
  throw new Error("Unreachable");
}

// ===================
// Provider Fallback
// ===================

/**
 * Execute a function with provider fallback
 *
 * Tries the primary provider (OpenAI) first, then falls back to
 * OpenRouter if available and the primary fails.
 *
 * @param fn - Function that takes a provider and returns a promise
 * @param agentName - Name of the calling agent (for logging)
 * @returns The result of the function
 * @throws The last error if all providers fail
 *
 * @example
 * ```typescript
 * const result = await withProviderFallback(
 *   (provider) => generateObject({ model: provider('gpt-4o-mini'), ... }),
 *   'Page Analysis'
 * );
 * ```
 */
export async function withProviderFallback<T>(
  fn: (provider: LLMProvider) => Promise<T>,
  agentName: string
): Promise<T> {
  // Try OpenAI first with retries
  try {
    console.log(`[${agentName}] Trying OpenAI...`);
    const result = await withRetry(() => fn(openai), agentName, "OpenAI");
    return result;
  } catch (openaiError) {
    // If OpenRouter key is available, try it as fallback
    if (process.env.OPENROUTER_API_KEY) {
      console.log(`[${agentName}] OpenAI failed, falling back to OpenRouter...`);
      try {
        const result = await withRetry(() => fn(openrouter), agentName, "OpenRouter");
        return result;
      } catch (openrouterError) {
        console.error(`[${agentName}] Both providers failed`);
        throw openrouterError;
      }
    }
    throw openaiError;
  }
}

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

