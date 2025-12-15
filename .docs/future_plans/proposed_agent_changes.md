# Agent Architecture Analysis & Proposal

## 1. Executive Summary

This document analyzes the current agent architecture of the PropIntel API and proposes significant structural improvements. The current architecture uses a functional approach with a hardcoded orchestration layer (`executor.ts`) and a central registry. While functional, it suffers from coupling (Open/Closed principle violations), lack of explicit contract enforcement, and scalability limits.

The proposed architecture introduces a standardized `Agent` interface, automatic dependency injection via a service registry, and a middleware pattern for observability and error handling.

## 2. Current Architecture Analysis

### 2.1 Overview
The system currently operates as a Directed Acyclic Graph (DAG) of agents, organized into four phases: Discovery, Research, Analysis, and Output.

- **Registry (`registry.ts`)**: Central definitions of metadata (inputs, outputs, timeouts).
- **Executor (`executor.ts`)**: Orchestrator that topologically sorts agents and executes them. It contains a large `switch` statement to dispatch execution to specific functions.
- **Context (`context-manager.ts`)**: Hybrid state management (in-memory summaries + S3 large payloads).
- **Observability**: Manual instrumentation using `createTrace` inside individual agent functions.

### 2.2 Strengths
- **Clear Separation of Phases**: The four-phase pipeline is logical and mirrors the business process.
- **State Management**: The `ContextManager` effectively handles the "context window" problem by summarizing intermediate results while keeping full data in cold storage (S3).
- **Parallelization**: The executor supports parallel execution of independent agents.

### 2.3 Weaknesses & Risks

1.  **Open/Closed Code Violations**: Adding a new agent requires modifying:
    -   `registry.ts` (metadata)
    -   `executor.ts` (dispatch logic)
    -   The agent implementation itself
    This makes the executor a "God Class" that knows about every specific agent implementation.

2.  **Lack of Strict Contracts**:
    -   `executor.ts` uses `unknown` return types and loose casting: `context.getAgentResult<T>`.
    -   There is no enforced interface (e.g., `interface Agent<In, Out>`) that implementations *must* adhere to, relying instead on convention.

3.  **Observability Boilerplate**: 
    -   Every agent function manually calls `createTrace`, `span.end`, and `safeFlush`. This leads to code duplication and inconsistency if a developer forgets to instrument a new agent.

4.  **Testing Complexity**:
    -   The monolithic `executor.ts` is hard to test in isolation without mocking the entire module graph.

5.  **Hardcoded Dispatch**:
    -   The `switch (agentId)` block in `executor.ts` (lines 328-638) is already 300+ lines long and will grow linearly with every new capability.

## 3. Best Practices & Industry Standards

Modern agentic systems (e.g., LangChain, AutoGen, Haystack) follow these patterns:

1.  **Protocol/Interface over Implementation**: Agents implement a standard `run(context)` method. The orchestrator calls this method blindly, without knowing *which* specific agent it is running.
2.  **Dependency Injection**: Agents are registered into a container/registry at startup. The orchestrator looks them up by ID.
3.  **Middleware/Chain of Responsibility**: Cross-cutting concerns like logging, tracing, retries, and rate-limiting are handled by wrappers or interceptors, not the business logic.
4.  **Schema Validation**: Inputs and outputs are validated against Pydantic/Zod schemas at the framework level.

## 4. Proposed Architecture Changes

We propose refactoring the system to use a class-based hierarchy with a Registry pattern.

### 4.1 New `Agent` Interface

Define a generic interface that all agents must implement. This enforces a contract.

```typescript
// src/agents/core/types.ts
import { ZodSchema } from "zod";

export interface AgentContext {
  jobId: string;
  tenantId: string;
  // ... existing context properties
}

export abstract class BaseAgent<TInput = any, TOutput = any> {
  abstract readonly id: string;
  abstract readonly name: string;
  abstract readonly description: string;
  
  // Define schemas for runtime validation
  abstract readonly inputSchema?: ZodSchema<TInput>;
  abstract readonly outputSchema?: ZodSchema<TOutput>;

  // Core execution logic (to be implemented)
  protected abstract execute(input: TInput, context: AgentContext): Promise<TOutput>;

  // Public entry point (wrapped with middleware)
  public async run(input: TInput, context: AgentContext): Promise<TOutput> {
    // 1. Validation
    // 2. Tracing start
    // 3. Execution
    // 4. Tracing end
    // 5. Error handling
  }
}
```

### 4.2 Dynamic Registry

Replace the static object in `registry.ts` with a dynamic registry map.

```typescript
// src/agents/core/registry.ts
export class AgentRegistry {
  private static agents = new Map<string, BaseAgent>();

  static register(agent: BaseAgent) {
    this.agents.set(agent.id, agent);
  }

  static get(id: string): BaseAgent | undefined {
    return this.agents.get(id);
  }
}

// Usage in app startup:
AgentRegistry.register(new PageAnalysisAgent());
AgentRegistry.register(new QueryGenerationAgent());
```

### 4.3 Refactored Executor

The executor no longer needs a switch statement.

```typescript
// src/agents/executor.ts (simplified)
async function executeAgent(agentId: string, context: ContextManager) {
  const agent = AgentRegistry.get(agentId);
  if (!agent) throw new Error(`Agent ${agentId} not found`);

  // Resolve inputs automatically based on metadata
  const inputs = await resolveInputs(agent, context);
  
  // Execute via standard interface
  const result = await agent.run(inputs, context.getContext());
  
  // Store result
  await context.storeAgentResult(agentId, result);
}
```

### 4.4 Automated Observability (Middleware)

Move the Langfuse tracing into the `BaseAgent.run` method.

```typescript
// Inside BaseAgent.run()
const trace = createTrace({ name: this.id, ... });
const span = trace.span({ name: "execution" });

try {
  const result = await this.execute(input, context);
  span.end({ output: result });
  return result;
} catch (err) {
  span.end({ level: "ERROR", error: err });
  throw err;
} finally {
  await safeFlush();
}
```

## 5. Migration Strategy

This refactor can be done incrementally:
1.  **Phase 1**: Define `BaseAgent` class and `AgentRegistry`.
2.  **Phase 2**: Wrap *one* existing agent (e.g., `citation-analysis`) into a class extending `BaseAgent`.
3.  **Phase 3**: Update `executor.ts` to check `AgentRegistry.get(id)` first. If found, use the new path. If not, fall back to the old `switch` statement.
4.  **Phase 4**: Port remaining agents one by one.
5.  **Phase 5**: Remove the `switch` statement and old registry.

## 6. Conclusion
Adopting this object-oriented, registry-based approach will significantly improve the maintainability and scalability of the PropIntel agent system. It solves the key issues of coupling and boilerplate while preserving the effective "multi-stage pipeline" logic that is currently working well.
