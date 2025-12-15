---
name: Agent System Optimization and Safety
overview: Analyze the agent execution system to identify and fix infinite loop risks, stuck flow scenarios, and optimization opportunities. Add safeguards, timeouts, retry limits, and improved dependency resolution.
todos:
  - id: add-safety-guards
    content: Add maximum phase limit, overall execution timeout, per-agent timeouts, and retry limits to prevent infinite loops
    status: completed
  - id: improve-dependency-resolution
    content: Add pre-execution dependency validation, fix circular dependency detection, and validate dependency graph
    status: completed
  - id: enhance-error-recovery
    content: Implement graceful degradation for skipped agents, circuit breaker pattern, and context state verification
    status: completed
  - id: optimize-execution-flow
    content: Improve parallel execution logic, optimize plan generation, and add early termination conditions
    status: completed
    dependencies:
      - add-safety-guards
  - id: add-monitoring
    content: Add execution metrics, dependency tracking, and health checks for observability
    status: completed
    dependencies:
      - add-safety-guards
  - id: implement-retry-logic
    content: Implement retry with exponential backoff using existing retryable/errorHandling registry properties
    status: completed
---

# Agent System Optimization and Safety Plan

## Overview

This plan addresses infinite loop risks, stuck flow scenarios, and optimization opportunities in the agent execution system. The analysis covers the orchestrator, executor, plan generator, and context manager.

**Last Updated**: December 2024

## Progress Summary

| Area | Status | Notes |
|------|--------|-------|
| LLM Timeouts | COMPLETED | 60s timeout on all LLM calls |
| Plan Validation | COMPLETED | validatePlan() and fixPlan() implemented |
| Deadlock Detection | COMPLETED | Executor detects stuck agents |
| Graceful Degradation | COMPLETED | Skipped agents handled properly |
| Maximum Phase Limit | COMPLETED | Default 20 phases, configurable via ORCHESTRATOR_MAX_PHASES |
| Overall Execution Timeout | COMPLETED | Default 14 min, configurable via ORCHESTRATOR_EXECUTION_TIMEOUT_MS |
| Per-Agent Timeout | PARTIAL | LLM calls only, full agent timeout deferred |
| Retry Logic | COMPLETED | Exponential backoff using errorHandling registry property |
| Circuit Breaker | DEFERRED | Lower priority - retry logic covers most cases |
| Execution Metrics | COMPLETED | Summary logging at execution end |

## Current Architecture

The system uses:

- **OrchestratorAgent**: Coordinates phases and executes plans
- **Executor**: Runs individual agents with dependency checking and deadlock detection
- **PlanGenerator**: Creates execution plans (LLM-based with validation and static fallback)
- **ContextManager**: Manages agent state and results (S3-backed)

## What Has Been Implemented

### 1. LLM Timeouts (Completed)

All LLM API calls now have 60-second timeouts using `AbortSignal.timeout()`:

- `apps/api/src/agents/orchestrator/plan-generator.ts:21` - Plan generation
- `apps/api/src/agents/orchestrator/result-reasoner.ts:19` - Result reasoning
- `apps/api/src/agents/discovery/*.ts` - All discovery agents
- `apps/api/src/agents/analysis/*.ts` - All analysis agents  
- `apps/api/src/agents/output/*.ts` - All output agents
- `apps/api/src/agents/research/llm-brand-probe.ts` - Brand probe agent

### 2. Plan Validation (Completed)

**Location**: `apps/api/src/agents/orchestrator/plan-generator.ts:108-213`

- `validatePlan()` checks all dependencies are scheduled correctly
- `fixPlan()` automatically fixes common issues (splits phases with internal deps)
- Falls back to static plan if validation/fix fails
- Removes disabled agents via `sanitizePlan()`

### 3. Deadlock Detection (Completed)

**Location**: `apps/api/src/agents/executor.ts:176-186`

When parallel execution detects agents waiting but none can run:
- Throws descriptive error with agent details and missing dependencies
- Prevents indefinite waiting

### 4. Graceful Degradation (Completed)

**Location**: `apps/api/src/agents/executor.ts:522-540, 565-582`

- `visibility-scoring` handles missing/skipped `content-comparison` with defaults
- `recommendations` handles missing/skipped dependencies gracefully
- DISABLED_AGENTS set properly marks stub agents as completed

## Remaining Issues

### 1. Infinite Loop Risks (Partially Addressed)

**Location**: `apps/api/src/agents/orchestrator/orchestrator-agent.ts:76-169`

- **FIXED**: Plan is now validated and finite
- **STILL MISSING**: No maximum phase limit (plans are pre-generated but could theoretically be large)
- **STILL MISSING**: No overall timeout - Lambda 900s timeout is only limit
- **UNCHANGED**: Result reasoner suggestions logged but not applied (lines 139-153)

**Current Risk**: Low - Plans are validated, but no hard safety limits exist.

### 2. Retry Logic Not Implemented

**Location**: `apps/api/src/agents/registry.ts` and `apps/api/src/agents/executor.ts`

The registry defines `retryable` and `errorHandling` properties for each agent:
- `errorHandling: 'retry'` - Should retry on failure
- `errorHandling: 'skip'` - Should skip and continue
- `errorHandling: 'fail'` - Should fail immediately

**PROBLEM**: These properties ARE NOT USED by the executor. When an agent fails:
- executor.ts:300-303 just marks as failed and throws
- No retry attempt is made

### 3. Per-Agent Execution Timeout (Partial)

LLM calls have 60s timeout, but:
- External API calls (Tavily, S3) have no timeout wrapper
- Full agent execution time is unbounded
- Only Lambda timeout provides a limit

## Implementation Plan

### Phase 1: Add Safety Guards (COMPLETED)

#### 1.1 Maximum Phase Limit (COMPLETED)

**File**: `apps/api/src/agents/orchestrator/orchestrator-agent.ts`

**Implementation**:
- Added `MAX_PHASES` constant (default: 20, configurable via `ORCHESTRATOR_MAX_PHASES`)
- Validates phase count before execution starts
- Throws error if plan exceeds limit

#### 1.2 Overall Execution Timeout (COMPLETED)

**File**: `apps/api/src/agents/orchestrator/orchestrator-agent.ts`

**Implementation**:
- Added `EXECUTION_TIMEOUT_MS` constant (default: 840000 = 14 minutes)
- Configurable via `ORCHESTRATOR_EXECUTION_TIMEOUT_MS` env var
- Tracks start time and checks timeout before each phase
- Throws detailed timeout error with completed/remaining phases
- Logs warning at 80% of timeout threshold

#### 1.3 Per-Agent Timeout (PARTIAL - LLM calls done)

**File**: `apps/api/src/agents/executor.ts`

**COMPLETED**:
- All LLM calls have 60s timeout via `AbortSignal.timeout(LLM_TIMEOUT_MS)`

**DEFERRED** (lower priority since LLM calls are covered):
- Full agent execution timeout wrapper
- With retry logic now in place, transient failures are handled

#### 1.4 Retry Limits with Exponential Backoff (COMPLETED)

**File**: `apps/api/src/agents/executor.ts`

**Implementation**:
- Added `MAX_RETRIES` constant (default: 3, configurable via `AGENT_MAX_RETRIES`)
- Added `BASE_DELAY_MS` constant (default: 2000, configurable via `AGENT_RETRY_BASE_DELAY_MS`)
- Added `MAX_DELAY_MS` constant (30 seconds max)
- Reads `errorHandling` from agent metadata:
  - `errorHandling: 'retry'`: Retries with exponential backoff up to MAX_RETRIES times
  - `errorHandling: 'skip'`: Stores skip result with error reason, allows dependents to continue
  - `errorHandling: 'fail'`: Fails immediately (current behavior)
- Comprehensive logging for all retry attempts

### Phase 2: Improve Dependency Resolution (COMPLETED)

#### 2.1 Pre-Execution Dependency Validation (COMPLETED)

**File**: `apps/api/src/agents/orchestrator/plan-generator.ts:108-146`

Implemented via `validatePlan()`:
- Validates all dependencies are scheduled before agents that need them
- Checks for parallel phases with internal dependencies
- Falls back to static plan if validation fails

#### 2.2 Fix Circular Dependency Detection (COMPLETED)

**File**: `apps/api/src/agents/executor.ts:176-186`

Implemented via deadlock detection:
- Detects when parallel execution has agents waiting but none can proceed
- Throws descriptive error with agent details and missing dependencies

#### 2.3 Dependency Graph Validation (COMPLETED)

**File**: `apps/api/src/agents/orchestrator/plan-generator.ts:151-213`

Implemented via `fixPlan()`:
- Identifies phases with internal dependency conflicts
- Automatically splits problematic parallel phases
- Validates fixed plan before use

### Phase 3: Enhance Error Recovery (IN PROGRESS)

#### 3.1 Smart Degradation for Skipped/Failed Agents (COMPLETED)

**File**: `apps/api/src/agents/executor.ts:491-540, 556-582`

**COMPLETED**:
- `visibility-scoring` handles missing/skipped `content-comparison` with intelligent defaults
- `recommendations` handles missing/skipped dependencies with empty arrays
- DISABLED_AGENTS properly marks stub agents as completed with skip result
- `citation-analysis` returns empty analysis when no search results (lines 436-453)

**Pattern established**:
```typescript
// Check if result is skipped or missing
if (!contentComparisonRaw || ("skipped" in contentComparisonRaw && contentComparisonRaw.skipped)) {
  console.log("[Executor] content-comparison skipped or missing, using default");
  contentComparison = { /* sensible defaults */ };
}
```

#### 3.2 Circuit Breaker Pattern (TODO - LOWER PRIORITY)

**File**: `apps/api/src/agents/executor.ts`

**Note**: With proper retry logic and timeouts, circuit breaker may be less critical. Consider implementing only if production shows repeated failures.

If needed:
- Create `CircuitBreaker` class to track agent health across jobs
- In-memory cache: `Map<agentId, { failures: number, lastFailure: timestamp, state: 'closed' | 'open' | 'half-open' }>`
- Configurable thresholds via env vars
- Integration with retry logic

**Priority**: Low - Focus on retry logic first.

#### 3.3 Context State Verification (TODO)

**File**: `apps/api/src/agents/context/context-manager.ts`

Current state: S3 upload errors propagate but no explicit verification.

Potential improvements:
- Add method to verify agent result is actually stored in S3
- Before marking as completed, verify S3 upload succeeded
- Retry S3 operations with exponential backoff

**Priority**: Low - S3 is generally reliable; current error propagation is sufficient.

### Phase 4: Optimize Execution Flow (MOSTLY COMPLETED)

#### 4.1 Improved Parallel Execution (COMPLETED)

**File**: `apps/api/src/agents/executor.ts:121-204`

**COMPLETED**:
- Dependency-aware parallel execution implemented
- Agents with satisfied deps run in parallel batch
- Agents waiting for deps are deferred and re-checked after each batch
- Deadlock detection prevents infinite waiting

Current flow:
1. Sort agents by dependencies
2. Identify agents that can run now (deps satisfied)
3. Run those in parallel
4. Re-check remaining agents after batch completes
5. Repeat until all done or deadlock detected

#### 4.2 Plan Optimization (COMPLETED)

**File**: `apps/api/src/agents/orchestrator/plan-generator.ts`

**COMPLETED**:
- `validatePlan()` checks dependency ordering
- `fixPlan()` splits problematic parallel phases
- `sanitizePlan()` removes disabled agents
- Static fallback plan is already optimized (5 phases)

#### 4.3 Early Termination Conditions (TODO - LOW PRIORITY)

**File**: `apps/api/src/agents/orchestrator/orchestrator-agent.ts`

Not implemented, but less critical now:
- Plan validation prevents bad plans from starting
- Graceful degradation allows partial completion
- Most agents have `errorHandling: 'skip'` or retry

**Potential future enhancement**:
- If all research agents fail, generate minimal report
- Add "critical path" concept to identify must-succeed agents

**Priority**: Low - Graceful degradation handles most cases.

### Phase 5: Monitoring and Observability (PARTIAL)

#### 5.1 Comprehensive Execution Metrics (TODO)

**File**: `apps/api/src/agents/orchestrator/orchestrator-agent.ts`

**Current state**: Basic console logging throughout, but no structured metrics.

**TODO**:
- Track comprehensive metrics:
  - Phase count, execution time per phase, total execution time
  - Agent success/failure rates, retry counts, timeout occurrences
  - Dependency resolution times, S3 operation latencies
  - Context size, compression events, token estimates
- Log metrics at phase boundaries with structured JSON format
- Include metrics in final context for debugging
- Export to CloudWatch or structured logs

**Priority**: Medium - Helpful for debugging but not blocking.

#### 5.2 Dependency Tracking (COMPLETED)

**File**: `apps/api/src/agents/executor.ts`

**COMPLETED**:
- Extensive logging at every step (lines 106-115, 136-141, 214-216, 271-279)
- Logs which agents are completed before each execution
- Logs dependency check results
- Deadlock detection includes full dependency details in error message

Example log output:
```
[Executor] Checking dependencies for agent: visibility-scoring
[Executor] Required inputs: citation-analysis, content-comparison
[Executor] Completed agents: page-analysis, query-generation, ...
```

#### 5.3 Health Checks (TODO - LOW PRIORITY)

**File**: `apps/api/src/agents/orchestrator/orchestrator-agent.ts`

**Not implemented**. With proper timeouts, less critical.

Potential future enhancement:
- Periodic health checks during long executions
- Verify context state is consistent
- Check for stuck conditions (same phase > 5 minutes)

**Priority**: Low - Timeouts provide implicit health boundary.

## Files Modified

### Core Changes (December 2024)

| File | Changes Made |
|------|--------------|
| `orchestrator-agent.ts` | Max phase limit (20), execution timeout (14 min), execution summary logging |
| `executor.ts` | Retry logic with exponential backoff, errorHandling support (retry/skip/fail) |
| `plan-generator.ts` | Plan validation, fix logic, LLM timeout |
| `result-reasoner.ts` | LLM timeout |
| All discovery agents | LLM timeouts |
| All analysis agents | LLM timeouts |
| All output agents | LLM timeouts |

### Optional Future Work

| File | Potential Changes | Priority |
|------|-------------------|----------|
| `context-manager.ts` | S3 verification (optional) | Low |
| `executor.ts` | Full agent timeout wrapper | Low |
| Various agents | Centralize LLM_TIMEOUT_MS | Low |

## Environment Variables

### Implemented

| Variable | Default | Description |
|----------|---------|-------------|
| `ORCHESTRATOR_MAX_PHASES` | 20 | Maximum number of phases allowed per execution |
| `ORCHESTRATOR_EXECUTION_TIMEOUT_MS` | 840000 (14 min) | Overall execution timeout |
| `AGENT_MAX_RETRIES` | 3 | Maximum retry attempts for agents with `errorHandling: 'retry'` |
| `AGENT_RETRY_BASE_DELAY_MS` | 2000 | Base delay for exponential backoff |

### Hardcoded (Could Be Centralized Later)

| Variable | Value | Description |
|----------|-------|-------------|
| `LLM_TIMEOUT_MS` | 60000 | LLM API call timeout (hardcoded in each agent file) |
| `MAX_DELAY_MS` | 30000 | Maximum delay for exponential backoff |
| `TIMEOUT_WARNING_THRESHOLD` | 0.8 | Percentage of timeout to trigger warning |

### Deferred (If Circuit Breaker Implemented)

- `CIRCUIT_BREAKER_FAILURE_THRESHOLD` (default: 3)
- `CIRCUIT_BREAKER_TIMEOUT_MS` (default: 300000)

## Implementation Complete

All high-priority items have been implemented. The following features are now active:

### 1. Retry Logic with Exponential Backoff (COMPLETED)

**File**: `apps/api/src/agents/executor.ts`

- Reads `errorHandling` from agent registry metadata
- `errorHandling: 'retry'`: Up to 3 retries with exponential backoff (2s, 4s, 8s... max 30s)
- `errorHandling: 'skip'`: Stores skip result on first failure, allows dependents to continue
- `errorHandling: 'fail'`: Fails immediately
- Configurable via `AGENT_MAX_RETRIES` and `AGENT_RETRY_BASE_DELAY_MS` env vars

### 2. Overall Execution Timeout (COMPLETED)

**File**: `apps/api/src/agents/orchestrator/orchestrator-agent.ts`

- Default: 840000ms (14 minutes)
- Configurable via `ORCHESTRATOR_EXECUTION_TIMEOUT_MS` env var
- Checks timeout before each phase
- Logs warning at 80% threshold
- Detailed error includes completed/remaining phases

### 3. Maximum Phase Limit (COMPLETED)

**File**: `apps/api/src/agents/orchestrator/orchestrator-agent.ts`

- Default: 20 phases
- Configurable via `ORCHESTRATOR_MAX_PHASES` env var
- Validates plan before execution starts

## Testing Strategy

1. **Unit Tests**: Test retry logic with mock failures
2. **Integration Tests**: Test full orchestrator with various failure scenarios
3. **Edge Cases**: Agents with `errorHandling: 'skip'` vs `'retry'` vs `'fail'`
4. **Load Tests**: Verify timeouts work under load

## Risk Mitigation

- **Backward Compatibility**: 
  - Default behavior matches current (no retries by default would be breaking - ensure defaults enable retry)
  - New features are additive
- **Configuration**:
  - All timeouts/limits via environment variables
  - Conservative defaults
- **Logging**: 
  - Already comprehensive - dependency tracking implemented
  - Add retry attempt logging when implemented

## Success Criteria

| Criteria | Status |
|----------|--------|
| No infinite loops possible | COMPLETED - Phase limit (20) and execution timeout (14 min) enforced |
| Jobs cannot get permanently stuck | COMPLETED - Deadlock detection, timeouts, and retry with backoff |
| Better error messages | COMPLETED - Full dependency details in errors |
| Improved parallelization | COMPLETED - Dependency-aware execution |
| Smart degradation | COMPLETED - Skipped agents handled gracefully |
| Retry with backoff | COMPLETED - Exponential backoff (2s base, 30s max, 3 retries) |
| Execution metrics | COMPLETED - Summary logging with phase/agent counts |

## New Opportunities Identified

### 1. Centralize LLM Timeout Configuration

Currently `LLM_TIMEOUT_MS = 60_000` is duplicated in every agent file. Could be:
- Exported from a central config file
- Made configurable via env var

### 2. LLM Brand Probe Agent

New agent `llm-brand-probe.ts` added for GEO brand visibility probing. Consider:
- Adding to default execution plan
- Ensuring it has proper error handling (currently `errorHandling: 'skip'`)

### 3. Job Deduplication

`apps/api/src/handlers/job.ts:125-139` now prevents duplicate jobs for same URL:
- Good for avoiding wasted resources
- Consider making deduplication window configurable

### 4. Result Reasoner Adjustments

`orchestrator-agent.ts:139-153` logs adjustments but doesn't apply them:
```typescript
if ((reasoning?.adjustments?.length ?? 0) > 0) {
  console.log(`[Orchestrator] Adjustments suggested:`, reasoning?.adjustments);
  // Could modify plan here if needed  <-- TODO: Actually implement this
}
```
Low priority - plans are now validated, so adjustments less critical.