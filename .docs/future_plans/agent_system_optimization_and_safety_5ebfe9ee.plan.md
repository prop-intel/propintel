---
name: Agent System Optimization and Safety
overview: Analyze the agent execution system to identify and fix infinite loop risks, stuck flow scenarios, and optimization opportunities. Add safeguards, timeouts, retry limits, and improved dependency resolution.
todos:
  - id: add-safety-guards
    content: Add maximum phase limit, overall execution timeout, per-agent timeouts, and retry limits to prevent infinite loops
    status: pending
  - id: improve-dependency-resolution
    content: Add pre-execution dependency validation, fix circular dependency detection, and validate dependency graph
    status: pending
  - id: enhance-error-recovery
    content: Implement graceful degradation for skipped agents, circuit breaker pattern, and context state verification
    status: pending
  - id: optimize-execution-flow
    content: Improve parallel execution logic, optimize plan generation, and add early termination conditions
    status: pending
    dependencies:
      - add-safety-guards
  - id: add-monitoring
    content: Add execution metrics, dependency tracking, and health checks for observability
    status: pending
    dependencies:
      - add-safety-guards
---

# Agent System Optimization and Safety Plan

## Overview

This plan addresses infinite loop risks, stuck flow scenarios, and optimization opportunities in the agent execution system. The analysis covers the orchestrator, executor, plan generator, and context manager.

## Current Architecture

The system uses:

- **OrchestratorAgent**: Coordinates phases and executes plans
- **Executor**: Runs individual agents with dependency checking
- **PlanGenerator**: Creates execution plans (LLM-based with static fallback)
- **ContextManager**: Manages agent state and results (S3-backed)

## Critical Issues Identified

### 1. Infinite Loop Risks

**Location**: `apps/api/src/agents/orchestrator/orchestrator-agent.ts:72-145`

- **No maximum phase limit**: The orchestrator loops through phases without a cap
- **No overall timeout**: Lambda timeout (900s) is the only limit
- **Result reasoner suggestions ignored**: Adjustments are logged but not applied, potentially causing repeated failures

**Risk**: If plan generator creates invalid plans repeatedly, orchestrator could loop indefinitely.

### 2. Stuck Flow Scenarios

**Location**: `apps/api/src/agents/executor.ts:25-58, 150-200`

- **Circular dependency handling**: `sortAgentsByDependencies` returns early on circular deps (line 35), potentially missing agents
- **No retry limits**: Failed agents with `retryable: true` have no max retry count
- **Dependency validation at execution time**: Errors only surface when agent runs, not during planning
- **Context state sync issues**: Dependencies may not be recognized if context isn't properly synced (as seen in error report)

**Risk**: Jobs can get stuck waiting for dependencies that will never complete.

### 3. Optimization Opportunities

- **Parallel execution logic**: Could be more aggressive about parallelization
- **Dependency resolution**: Could pre-validate all dependencies before execution
- **Error recovery**: Better handling of skipped/failed agents
- **Context compression**: More aggressive compression strategies

## Implementation Plan

### Phase 1: Add Safety Guards

#### 1.1 Maximum Phase Limit

**File**: `apps/api/src/agents/orchestrator/orchestrator-agent.ts`

- Add `MAX_PHASES` constant (default: 20)
- Track phase count and throw error if exceeded
- Log warning when approaching limit

#### 1.2 Overall Execution Timeout

**File**: `apps/api/src/agents/orchestrator/orchestrator-agent.ts`

- Add `EXECUTION_TIMEOUT_MS` constant (default: 840000 = 14 minutes, leaving buffer for Lambda)
- Make configurable via `ORCHESTRATOR_EXECUTION_TIMEOUT_MS` env var
- Track start time and check timeout before each phase
- Throw timeout error with current state and metrics
- Log warning at 80% of timeout

#### 1.3 Per-Agent Timeout

**File**: `apps/api/src/agents/executor.ts`

- Add timeout wrapper around `runAgent` calls
- Use agent's `estimatedDuration` * 5 as timeout (conservative multiplier)
- Min timeout: 30 seconds, Max timeout: 10 minutes
- Make configurable via `AGENT_TIMEOUT_MULTIPLIER` env var (default: 5)
- Mark agent as failed on timeout with detailed error

#### 1.4 Retry Limits with Exponential Backoff and Circuit Breaker

**File**: `apps/api/src/agents/executor.ts`

- Add `MAX_RETRIES` constant (default: 3, configurable via `AGENT_MAX_RETRIES` env var)
- Track retry count per agent in context metadata
- Implement exponential backoff: delay = baseDelay * (2 ^ retryCount) seconds
- Base delay: 2 seconds (configurable via `AGENT_RETRY_BASE_DELAY_MS`)
- Max delay: 30 seconds
- Circuit breaker pattern:
- Track consecutive failures per agent across all jobs (in-memory cache)
- After 3 consecutive failures, mark agent as "circuit open" for 5 minutes
- Skip agent automatically when circuit is open
- Reset circuit after successful execution or timeout
- Only retry if `retryable: true` and retry count < max and circuit is closed
- For `errorHandling: 'skip'`, mark as skipped after first failure (no retries)
- Log all retry attempts with backoff delay

### Phase 2: Improve Dependency Resolution

#### 2.1 Pre-Execution Dependency Validation

**File**: `apps/api/src/agents/orchestrator/orchestrator-agent.ts`

- Before executing plan, validate all dependencies are satisfiable
- Check that all required agents are either:
- Already completed
- In the plan
- Can be skipped (errorHandling: 'skip')
- Throw error if unsatisfiable dependencies detected

#### 2.2 Fix Circular Dependency Detection

**File**: `apps/api/src/agents/executor.ts:25-58`

- Instead of silently returning on circular deps, detect and report them
- Throw descriptive error with cycle details
- Validate registry at startup to catch cycles early

#### 2.3 Dependency Graph Validation

**File**: `apps/api/src/agents/registry.ts`

- Add function to validate entire dependency graph
- Check for cycles, missing agents, unreachable agents
- Call during plan validation

### Phase 3: Enhance Error Recovery

#### 3.1 Smart Degradation for Skipped/Failed Agents

**File**: `apps/api/src/agents/executor.ts:332-378`

- When agent with `errorHandling: 'skip'` fails, create intelligent default/empty result
- Analyze what data dependent agents actually need (not just what they declare)
- Provide minimal viable data structures:
- Empty arrays for list dependencies
- Zero values for numeric dependencies
- Default objects with safe fallbacks
- Ensure dependent agents can still run with partial data
- Already partially implemented for `visibility-scoring` - extend pattern to all agents
- Log degradation decisions for observability

#### 3.2 Circuit Breaker Pattern (Combined with Retries)

**File**: `apps/api/src/agents/executor.ts`

- Create `CircuitBreaker` class to track agent health:
- In-memory cache: `Map<agentId, { failures: number, lastFailure: timestamp, state: 'closed' | 'open' | 'half-open' }>`
- Configurable thresholds via env vars:
- `CIRCUIT_BREAKER_FAILURE_THRESHOLD` (default: 3)
- `CIRCUIT_BREAKER_TIMEOUT_MS` (default: 300000 = 5 minutes)
- Circuit states:
- **Closed**: Normal operation, retries allowed
- **Open**: Too many failures, skip agent immediately
- **Half-open**: After timeout, allow one attempt to test recovery
- Integration with retry logic:
- Check circuit state before attempting retry
- If circuit is open, skip agent and use smart degradation
- If circuit is half-open, allow one attempt (if successful, close circuit)
- Track failures globally (across all jobs) for system-wide protection
- Log circuit breaker state transitions with agent ID and reason

#### 3.3 Context State Verification

**File**: `apps/api/src/agents/context/context-manager.ts`

- Add method to verify agent result is actually stored in S3
- Before marking as completed, verify S3 upload succeeded
- Retry S3 operations with exponential backoff

### Phase 4: Optimize Execution Flow

#### 4.1 Improved Parallel Execution

**File**: `apps/api/src/agents/executor.ts:90-120`

- Better dependency-aware parallel execution
- Group agents by dependency depth
- Execute all agents at same depth in parallel
- More aggressive parallelization when safe

#### 4.2 Plan Optimization

**File**: `apps/api/src/agents/orchestrator/plan-generator.ts`

- After plan generation, optimize phase ordering
- Merge phases when possible
- Reorder to maximize parallelization
- Validate optimized plan still respects dependencies

#### 4.3 Early Termination Conditions

**File**: `apps/api/src/agents/orchestrator/orchestrator-agent.ts`

- Check for critical failures that make continuation pointless
- If all research agents fail, skip analysis phase
- If all analysis agents fail, generate minimal report
- Don't continue if core dependencies are permanently unavailable

### Phase 5: Monitoring and Observability

#### 5.1 Comprehensive Execution Metrics (CRITICAL)

**File**: `apps/api/src/agents/orchestrator/orchestrator-agent.ts`

- Track comprehensive metrics:
- Phase count, execution time per phase, total execution time
- Agent success/failure rates, retry counts, timeout occurrences
- Dependency resolution times, S3 operation latencies
- Circuit breaker activations, degradation decisions
- Context size, compression events, token estimates
- Log metrics at phase boundaries with structured JSON format
- Include metrics in final context for debugging
- Export metrics to CloudWatch (if available) or structured logs
- Add performance counters for hot paths

#### 5.2 Dependency Tracking

**File**: `apps/api/src/agents/executor.ts`

- Log dependency resolution decisions
- Track which dependencies were satisfied/missing
- Include in error messages for better debugging

#### 5.3 Health Checks

**File**: `apps/api/src/agents/orchestrator/orchestrator-agent.ts`

- Periodic health checks during long executions
- Verify context state is consistent
- Check for stuck conditions (same phase > 5 minutes)

## Files to Modify

1. `apps/api/src/agents/orchestrator/orchestrator-agent.ts` - Add timeouts, phase limits, pre-validation, metrics
2. `apps/api/src/agents/executor.ts` - Add retry limits, timeouts, circuit breaker, better error handling
3. `apps/api/src/agents/registry.ts` - Add dependency graph validation
4. `apps/api/src/agents/context/context-manager.ts` - Add state verification, S3 retry logic
5. `apps/api/src/agents/orchestrator/plan-generator.ts` - Add plan optimization

## New Environment Variables

All new configuration options will be environment variables with conservative defaults:

- `ORCHESTRATOR_MAX_PHASES` (default: 20) - Maximum number of phases allowed
- `ORCHESTRATOR_EXECUTION_TIMEOUT_MS` (default: 840000) - Overall execution timeout
- `AGENT_TIMEOUT_MULTIPLIER` (default: 5) - Multiplier for agent estimatedDuration
- `AGENT_MAX_RETRIES` (default: 3) - Maximum retry attempts per agent
- `AGENT_RETRY_BASE_DELAY_MS` (default: 2000) - Base delay for exponential backoff
- `CIRCUIT_BREAKER_FAILURE_THRESHOLD` (default: 3) - Failures before opening circuit
- `CIRCUIT_BREAKER_TIMEOUT_MS` (default: 300000) - Time before attempting half-open
- `CONTEXT_COMPRESSION_THRESHOLD` (default: 5) - Number of completed agents before compression
- `HEALTH_CHECK_INTERVAL_MS` (default: 300000) - Interval for health checks during execution

## Testing Strategy

1. **Unit Tests**: Test timeout logic, retry limits, dependency validation
2. **Integration Tests**: Test full orchestrator with various failure scenarios
3. **Edge Cases**: Circular dependencies, missing agents, S3 failures
4. **Load Tests**: Verify timeouts work under load

## Risk Mitigation

- **Backward Compatibility (STRICT)**: 
- All changes must maintain existing API contracts
- New features should be opt-in via feature flags where possible
- Default behavior should match current behavior
- Add new fields/options without removing existing ones
- Version any breaking changes if absolutely necessary
- **Configuration**:
- All timeouts/configurable values via environment variables
- Defaults should be conservative (fail safe, longer timeouts)
- Document all new env vars in README
- **Logging**: 
- Comprehensive structured logging for debugging
- Include context IDs, agent IDs, phase names in all logs
- Log all state transitions (pending -> running -> completed/failed)
- **Testing**:
- Unit tests for all new logic
- Integration tests for full orchestrator flows
- Regression tests to ensure backward compatibility

## Success Criteria

- No infinite loops possible (hard limits enforced)
- Jobs cannot get permanently stuck (timeouts + retries with circuit breakers)
- Better error messages for dependency issues with full context
- Improved parallelization where safe (dependency-aware)
- Comprehensive observability (metrics, logging, health checks)
- Strict backward compatibility maintained
- Smart degradation allows jobs to complete with partial results
- All critical paths instrumented with metrics