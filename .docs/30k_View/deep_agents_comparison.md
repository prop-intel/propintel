# Deep Agents Architecture Comparison

This document compares BrandSight's current agent architecture against the "Deep Agents" pattern popularized by LangChain and seen in tools like Claude Code, Manus, and Deep Research.

## What Are Deep Agents?

Deep Agents are an advanced architecture for handling complex, multi-step tasks requiring sustained reasoning, tool use, and memory. They combine four key patterns to plan, manage persistent state, and delegate work to specialized sub-agents.

## The Four Pillars of Deep Agents

| Pillar | Description | BrandSight Status |
|--------|-------------|------------------|
| **Detailed Prompts** | Long, complex system prompts with examples and behavioral instructions | Partial - each agent has prompts but not extensively documented |
| **Planning Tool** | Built-in task/todo tool for breaking down complex tasks and tracking progress | Yes - `createExecutionPlan()` uses LLM to generate execution plans |
| **Sub-Agents** | Ability to dynamically spawn specialized sub-agents for task delegation | No - fixed 12 agents in predetermined structure |
| **File System** | Persistent storage for memory, notes, and agent collaboration | Yes - S3 used for context storage between agents |

## Architecture Comparison

### Deep Agents Pattern (Recursive)
```
Agent receives task
  → Plans and breaks down
  → Spawns Sub-Agent A for subtask 1
      → Sub-Agent A discovers complexity
      → Spawns Sub-Sub-Agent for deeper work
  → Spawns Sub-Agent B for subtask 2
  → Aggregates results
  → Can spawn more agents if needed
```

### BrandSight Pattern (Pipeline)
```
Orchestrator receives job
  → LLM generates execution plan
  → Phase 1: page-analysis → query-generation → competitor-discovery (sequential)
  → Phase 2: tavily-research, perplexity, community-signals, llm-brand-probe (parallel)
  → Phase 3: citation-analysis, content-comparison → visibility-scoring
  → Phase 4: recommendations → cursor-prompt → report-generator
  → LLM reasons after each phase (can stop early)
```

## What BrandSight Has

- **LLM-driven planning**: Orchestrator uses OpenAI to generate execution plans
- **Inter-phase reasoning**: After each phase, LLM evaluates results and can stop/adjust
- **Persistent context**: S3 storage for sharing data between agents
- **Specialized agents**: 12 purpose-built agents for specific tasks
- **Parallel execution**: Research agents run concurrently

## What BrandSight Lacks (vs Deep Agents)

1. **Dynamic agent spawning**: Cannot create new agents at runtime based on discovered complexity
2. **Recursive delegation**: Agents cannot spawn sub-agents themselves
3. **Arbitrary depth**: Pipeline is flat (1 level), not nested
4. **Adaptive agent count**: Always runs the same 12 agents regardless of task complexity

### Example of Missing Capability

A true Deep Agent could:
- Discover a page has 5 distinct product categories
- Spawn 5 separate `page-analysis` sub-agents (one per category)
- Each sub-agent could spawn its own `query-generation` agent
- Results aggregate back up the chain

BrandSight instead:
- Runs single `page-analysis` agent for all content
- Fixed pipeline regardless of content complexity

## Assessment

**BrandSight is ~60% Deep Agent compliant.**

| Capability | Score |
|------------|-------|
| Planning Tool | 100% |
| File System / Memory | 100% |
| Specialized Agents | 80% |
| Dynamic Sub-Agent Spawning | 0% |
| Recursive Depth | 0% |

## Potential Evolution Path

To become a full Deep Agent architecture:

1. **Add `spawn_agent` tool** to orchestrator and agents
2. **Make agents recursive** - allow any agent to delegate to sub-agents
3. **Dynamic agent registry** - create agent instances on-demand vs. fixed pool
4. **Hierarchical context** - parent agents aggregate child agent results
5. **Depth limits** - prevent infinite recursion with configurable max depth

## References

- [Deep Agents - LangChain Blog](https://blog.langchain.com/deep-agents/)
- [GitHub - langchain-ai/deepagents](https://github.com/langchain-ai/deepagents)
- [Agents 2.0: From Shallow Loops to Deep Agents](https://www.philschmid.de/agents-2.0-deep-agents)
- [Deep Agents Overview - LangChain Docs](https://docs.langchain.com/oss/python/deepagents/overview)
