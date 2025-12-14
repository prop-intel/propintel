/**
 * Traced Agent Wrapper
 *
 * Provides a higher-order function that wraps any agent with proper
 * Langfuse tracing, error handling, and non-blocking flush.
 *
 * Usage:
 * ```typescript
 * const myAgentCore = async (input: MyInput, ctx: TraceContext) => {
 *   const result = await generateObject({ ... });
 *   ctx.generation.update({ usage: result.usage });
 *   return result.object;
 * };
 *
 * export const myAgent = withTracing(myAgentCore);
 *
 * // Call with:
 * const result = await myAgent(
 *   { domain, data },
 *   { name: 'my-agent', model: 'gpt-4o-mini', tenantId, jobId }
 * );
 * ```
 */

// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { langfuse, safeFlush, createTrace } from "./langfuse";

// ===================
// Types
// ===================

/**
 * No-op generation object for when Langfuse is not configured
 */
interface NoOpGeneration {
  end: (data?: unknown) => void;
  update: (data?: unknown) => void;
}

/**
 * No-op trace object for when Langfuse is not configured
 */
interface NoOpTrace {
  generation: (config: { name: string; model: string }) => NoOpGeneration;
  span: (config: { name: string }) => { end: () => void };
}

/**
 * Context passed to traced agent functions
 */
export interface TraceContext {
  trace: ReturnType<typeof createTrace> | NoOpTrace;
  generation: NoOpGeneration | ReturnType<ReturnType<NonNullable<typeof langfuse>["trace"]>["generation"]>;
}

/**
 * Options for traced agent execution
 */
export interface TracedAgentOptions {
  name: string;
  model: string;
  tenantId: string;
  jobId: string;
  metadata?: Record<string, unknown>;
}

// ===================
// No-Op Helpers
// ===================

function createNoOpGeneration(): NoOpGeneration {
  return {
    end: () => {
      /* no-op */
    },
    update: () => {
      /* no-op */
    },
  };
}

function createNoOpTrace(): NoOpTrace {
  return {
    generation: () => createNoOpGeneration(),
    span: () => ({
      end: () => {
        /* no-op */
      },
    }),
  };
}

// ===================
// Higher-Order Function
// ===================

/**
 * Higher-order function that wraps any agent with proper
 * tracing, error handling, and non-blocking flush.
 *
 * Benefits:
 * - Automatic trace/generation creation
 * - Non-blocking flush (never hangs)
 * - Consistent error handling
 * - Clean agent code (focused on business logic)
 */
export function withTracing<TInput, TOutput>(
  agentFn: (input: TInput, ctx: TraceContext) => Promise<TOutput>
) {
  return async (input: TInput, options: TracedAgentOptions): Promise<TOutput> => {
    // Create trace (or no-op if Langfuse not configured)
    const trace = langfuse
      ? langfuse.trace({
          name: options.name,
          userId: options.tenantId,
          metadata: { jobId: options.jobId, ...options.metadata },
        })
      : createNoOpTrace();

    // Create generation within the trace
    const generation = trace.generation({
      name: `${options.name}-generation`,
      model: options.model,
    });

    try {
      // Execute the agent function with trace context
      const result = await agentFn(input, { trace, generation });

      // Mark generation as successful
      generation.end({ output: result, level: "DEFAULT" });

      // Non-blocking flush - don't await in critical path
      void safeFlush();

      return result;
    } catch (error) {
      // Mark generation as failed
      generation.end({
        output: null,
        level: "ERROR",
        statusMessage: (error as Error).message,
      });

      // Still try to flush errors, but don't block
      void safeFlush();

      throw error;
    }
  };
}
