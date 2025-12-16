<div align="center">

# Brandsight

**Answer Engine Optimization (AEO) Analysis Platform**

*Understand how AI search engines see your content*

[![Next.js](https://img.shields.io/badge/Next.js-16-black?style=for-the-badge&logo=next.js&logoColor=white)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![AWS Lambda](https://img.shields.io/badge/AWS-Lambda-FF9900?style=for-the-badge&logo=aws-lambda&logoColor=white)](https://aws.amazon.com/lambda/)
[![OpenAI](https://img.shields.io/badge/OpenAI-GPT--4o-412991?style=for-the-badge&logo=openai&logoColor=white)](https://openai.com/)

[![Node.js](https://img.shields.io/badge/Node.js-20+-339933?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org/)
[![pnpm](https://img.shields.io/badge/pnpm-9+-F69220?style=flat-square&logo=pnpm&logoColor=white)](https://pnpm.io/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?style=flat-square&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Drizzle](https://img.shields.io/badge/Drizzle-ORM-C5F74F?style=flat-square&logo=drizzle&logoColor=black)](https://orm.drizzle.team/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-CSS-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![tRPC](https://img.shields.io/badge/tRPC-11-2596BE?style=flat-square&logo=trpc&logoColor=white)](https://trpc.io/)

</div>

---

A multi-agent AI system that analyzes how AI search engines perceive your content and generates actionable recommendations to improve visibility in ChatGPT, Perplexity, Google AI Overviews, and other AI-powered search experiences.

---

## What is Brandsight?

Brandsight crawls your website and runs it through an **11-agent AI pipeline** orchestrated by an LLM-driven planner that simulates how modern AI search engines discover, evaluate, and cite content. It generates an **AEO Visibility Score** (0-100) along with specific recommendations to improve your content's chances of being cited in AI-generated answers.

The pipeline includes discovery (page analysis, query generation, competitor identification), research (web search, community signals), analysis (citation patterns, content comparison, visibility scoring), and output (recommendations, Cursor prompts, reports).

Unlike traditional SEO tools, Brandsight focuses on the emerging "Answer Engine" paradigm—where AI systems synthesize information from multiple sources rather than simply ranking links.

---

## Architecture Overview

```mermaid
flowchart TB
    subgraph Client["Frontend"]
        UI[Next.js Dashboard]
    end

    subgraph API["Serverless API"]
        Lambda[Lambda Functions]
        SQS[SQS Queue]
    end

    subgraph Pipeline["Orchestrator Agent"]
        PG[Plan Generator]
        EX[Executor]
        CM[Context Manager]
        RR[Result Reasoner]
    end

    subgraph Agents["Agent Pipeline"]
        subgraph Discovery
            PA[page-analysis]
            QG[query-generation]
            CD[competitor-discovery]
        end
        subgraph Research
            TR[tavily-research]
            CS[community-signals]
        end
        subgraph Analysis
            CA[citation-analysis]
            CC[content-comparison]
            VS[visibility-scoring]
        end
        subgraph Output
            REC[recommendations]
            CP[cursor-prompt]
        end
    end

    subgraph External["External Services"]
        OpenAI[OpenAI GPT-4o]
        Tavily[Tavily Search]
        S3[S3 Storage]
        DB[(PostgreSQL)]
    end

    UI -->|Create Job| Lambda
    Lambda -->|Enqueue| SQS
    SQS -->|Trigger| PG
    PG -->|Plan| EX
    EX -->|Execute| Discovery --> Research --> Analysis --> Output
    EX <-->|Store/Retrieve| CM
    CM -->|Full Results| S3
    RR -->|Reason| EX
    
    Discovery & Research & Analysis & Output -->|LLM Calls| OpenAI
    Research -->|Web Search| Tavily
    Lambda -->|Update Status| DB
```

---

## The Agent System

Brandsight's core differentiator is its **multi-agent pipeline** that breaks down AEO analysis into specialized tasks. The system uses an **Orchestrator** pattern with LLM-driven plan generation, dependency-aware execution, and S3-backed context management.

### Orchestration Architecture

```mermaid
flowchart TB
    subgraph Orchestrator["OrchestratorAgent"]
        Init[initialize] --> PG[PlanGenerator]
        PG -->|LLM creates| Plan[ExecutionPlan]
        Plan --> Execute
        
        subgraph Execute[execute loop]
            Phase[For each phase]
            Phase --> Mark[Mark agents running]
            Mark --> EX[Executor.executeAgents]
            EX --> Store[Store results in Context]
            Store --> RR[ResultReasoner]
            RR --> Compress{Near limit?}
            Compress -->|Yes| Comp[Compress context]
            Compress -->|No| Next[Next phase]
            Comp --> Next
        end
    end
    
    subgraph Context["ContextManager"]
        Summaries[In-memory summaries]
        S3[S3 full results]
        SG[SummaryGenerator]
    end
    
    Store --> SG
    SG --> Summaries
    Store --> S3
    EX -->|getAgentResult| S3
```

**Key Classes:**
- `OrchestratorAgent` — Main coordinator that manages the pipeline lifecycle
- `PlanGenerator` — Uses LLM to create an optimized execution plan with dependency validation
- `Executor` — Runs agents (parallel or sequential), resolves dependencies via topological sort
- `ResultReasoner` — Analyzes phase results and suggests plan adjustments
- `ContextManager` — Lightweight in-memory state with S3 backing for full results
- `SummaryGenerator` — LLM-based summarization of agent outputs for efficient context

### Pipeline Phases

The standard execution plan has **5 phases** with intelligent parallelization and dependency management:

| Phase | Agents | Execution | Dependencies | Est. Duration |
|-------|--------|-----------|--------------|---------------|
| **1. Discovery** | `page-analysis` → `query-generation` → `competitor-discovery` | Sequential | `pages` (from crawler) | ~30s |
| **2. Research** | `tavily-research`, `community-signals` | Parallel | `query-generation` | ~30s |
| **3. Analysis** | `citation-analysis`, `content-comparison` | Parallel | `tavily-research`, `page-analysis`, `competitor-discovery` | ~30s |
| **4. Scoring** | `visibility-scoring` | Sequential | `citation-analysis`, `content-comparison` | ~5s |
| **5. Output** | `recommendations` → `cursor-prompt` | Sequential | `visibility-scoring` | ~25s |

**Plan Validation:**
- LLM-generated plans are validated against the agent registry dependencies
- Invalid plans are automatically fixed or fall back to a static optimized plan
- Disabled agents (`perplexity`, `google-aio`) are filtered out automatically

### Agent Registry

Each agent has defined inputs (dependencies), outputs, and error handling:

| Agent | Category | Inputs | Description |
|-------|----------|--------|-------------|
| `page-analysis` | Discovery | — | Extracts topic, intent, entities, business context, and competitor profile from crawled pages using LLM |
| `query-generation` | Discovery | `page-analysis` | Generates 10-15 natural language target queries (how-to, what-is, comparison, best, why) |
| `competitor-discovery` | Discovery | `query-generation` | Identifies **real business competitors** (not content platforms), uses LLM validation to filter out YouTube, Medium, etc. |
| `tavily-research` | Research | `query-generation` | Batch searches all queries via Tavily API (10 results per query, concurrency: 3) |
| `community-signals` | Research | `query-generation` | Searches Reddit and Twitter/X for engagement opportunities (questions, recommendations, comparisons) |
| `llm-brand-probe` | Research | `page-analysis`, `query-generation`, `competitor-discovery` | **(Optional/GEO)** Probes LLMs directly with 50 prompts to measure brand visibility in AI responses |
| `citation-analysis` | Analysis | `tavily-research` | Analyzes citation patterns: rate, position, query types winning/losing, gap identification |
| `content-comparison` | Analysis | `page-analysis`, `competitor-discovery`, `tavily-research` | LLM-powered comparison against competitor content snippets to identify gaps and structural differences |
| `visibility-scoring` | Analysis | `citation-analysis`, `content-comparison` | Calculates weighted AEO visibility score (0-100) with optional GEO integration |
| `recommendations` | Output | `visibility-scoring`, `content-comparison` | LLM generates 5-8 prioritized recommendations with competitor examples and target queries |
| `cursor-prompt` | Output | `recommendations` | Generates comprehensive Cursor IDE prompt targeting missed opportunities and content gaps |
| `report-generator` | Output | `cursor-prompt`, `recommendations` | Assembles final report combining AEO (50%), LLMEO (30%), and SEO (20%) scores |

### How It Works

1. **Initialize** — `OrchestratorAgent` creates a `ContextManager` and calls the `PlanGenerator`
2. **Plan** — LLM analyzes URL/domain and generates a validated execution plan with 5 phases
3. **Crawl** — Fetches up to 50 pages (with SPA detection), stores as `pages` in context
4. **Discovery Phase** (sequential):
   - `page-analysis` — LLM extracts topic, intent, entities, business category, competitor profile
   - `query-generation` — LLM creates 10-15 target queries across types (how-to, what-is, comparison, best, why)
   - `competitor-discovery` — Identifies real business competitors (filters content platforms via LLM validation)
5. **Research Phase** (parallel):
   - `tavily-research` — Batch searches all queries (10 results each, concurrency: 3)
   - `community-signals` — Searches Reddit/Twitter for engagement opportunities
6. **Analysis Phase** (parallel):
   - `citation-analysis` — Computes citation rate, rank quality, query type patterns, gaps
   - `content-comparison` — LLM compares your content vs competitor snippets
7. **Scoring Phase** — `visibility-scoring` calculates weighted AEO score (0-100)
8. **Reason** — After each phase, `ResultReasoner` analyzes summaries and can suggest plan adjustments
9. **Output Phase** (sequential):
   - `recommendations` — LLM generates 5-8 prioritized recommendations with competitor examples
   - `cursor-prompt` — LLM creates comprehensive Cursor IDE prompt
10. **Report** — `report-generator` assembles final AEO report with combined scores

### Execution Engine

The `Executor` handles agent execution with intelligent dependency management:

```typescript
// Parallel execution with dependency awareness
executeAgents(agentIds, runInParallel, context, tenantId, jobId, model)
```

**Features:**
- **Topological sorting** — Agents are sorted by dependencies before execution
- **Parallel batching** — Agents with satisfied dependencies run in parallel
- **Deferred execution** — Agents waiting on dependencies run after their deps complete
- **Deadlock detection** — Throws error if circular dependencies detected
- **Graceful degradation** — Disabled agents (`perplexity`, `google-aio`) are skipped with placeholder results

**Error Handling per Agent (from registry):**
- `retry` — Retry on failure (most agents)
- `skip` — Continue pipeline if agent fails (`community-signals`, `llm-brand-probe`)
- `fail` — Halt pipeline on failure

### Context Management

The `ContextManager` maintains lightweight in-memory summaries while offloading full data to S3:

- **In-memory summaries** — Each agent result is summarized via LLM (`SummaryGenerator`) with key findings, metrics, and status
- **S3 storage** — Full agent results stored at `{tenantId}/{jobId}/agents/{agentId}.json`
- **On-demand retrieval** — `getAgentResult<T>()` fetches full data from S3 when needed by dependent agents
- **Automatic compression** — When approaching 80% of 100K token limit, oldest summaries are compressed via LLM
- **Agent status tracking** — `pending` → `running` → `completed` | `failed`
- **Dependency resolution** — Executor uses summaries to verify dependencies before running agents

### Visibility Score Formula

The AEO Visibility Score is calculated from 5 weighted components:

```
AEO Visibility Score = 
    Citation Rate (35%)         — How often you appear in search results
  + Rank Quality (25%)          — Position when you do appear (top 3 = bonus)
  + Competitive Position (20%)  — Your citation rate vs top competitor
  + Query Breadth (10%)         — Coverage across query types (how-to, what-is, etc.)
  - Gap Penalty (10%)           — Penalty for queries where you're absent
```

**With GEO Enabled** (optional `llm-brand-probe` agent):

```
AEO Visibility Score (GEO Mode) = 
    Citation Rate (28%) + Rank Quality (20%) + Competitive Position (15%)
  + Query Breadth (8%) + GEO Score (20%) - Gap Penalty (9%)
```

**GEO Score Components:**
- Overall mention rate in LLM responses (30%)
- Primary recommendation rate (25%)
- Position quality when listed (15%)
- Category breadth across prompt types (10%)
- Head-to-head wins vs competitors (10%)
- Sentiment analysis (10%)

---

## Key Features

- **AEO Visibility Score** — Single metric (0-100) measuring AI search visibility
- **Target Query Generation** — AI-generated queries your content should answer
- **Competitor Analysis** — See who's winning the queries you should own
- **Content Gap Detection** — Identify what's missing vs. top performers
- **Engagement Opportunities** — Discover discussions on Reddit, X, and Hacker News where you can add value
- **Cursor Prompts** — Copy-paste prompts to fix issues with AI assistance
- **LLMEO & SEO Scores** — Traditional optimization metrics included
- **Webhook Notifications** — Get notified when analysis completes
- **Scheduled Crawls** — Monitor visibility over time

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Monorepo** | Turborepo + pnpm |
| **Frontend** | Next.js 16, React 19, tRPC, Tailwind CSS, shadcn/ui |
| **Backend** | AWS Lambda, API Gateway, SQS, S3, ECS Fargate |
| **Database** | PostgreSQL + Drizzle ORM |
| **AI/LLM** | OpenAI GPT-4o-mini, Vercel AI SDK (`generateObject`, `generateText`) |
| **Search** | Tavily API (batch search with concurrency control) |
| **Auth** | NextAuth.js v5 |
| **Observability** | Langfuse (LLM tracing with traces, spans, generations) |

### LLM Configuration

All agent LLM calls use consistent configuration:

- **Model**: `gpt-4o-mini` (default, configurable)
- **Timeout**: 60 seconds per call (`AbortSignal.timeout`)
- **Temperature**: 0 for deterministic outputs, 0.3-0.7 for creative tasks
- **Structured Output**: Zod schemas via `generateObject` for type-safe responses
- **Tracing**: All LLM calls traced via Langfuse with token usage tracking

---

## Quick Start

### Prerequisites

- Node.js 20+
- pnpm 9+
- PostgreSQL database
- API keys: OpenAI, Tavily

### Installation

```bash
# Clone the repository
git clone https://github.com/your-org/propintel.git
cd propintel

# Install dependencies
pnpm install

# Copy environment variables
cp .env.example .env
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env

# Start local database (Docker)
./start-database.sh

# Run database migrations
pnpm db:migrate

# Start development servers
pnpm dev
```

### Environment Variables

Key variables to configure:

```bash
# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/propintel

# OpenAI (required for analysis)
OPENAI_API_KEY=sk-...

# Tavily (required for web search)
TAVILY_API_KEY=tvly-...

# Auth (for web app)
AUTH_SECRET=your-secret
AUTH_GOOGLE_ID=...
AUTH_GOOGLE_SECRET=...

# Optional: LLM observability
LANGFUSE_PUBLIC_KEY=...
LANGFUSE_SECRET_KEY=...
```

---

## Project Structure

```
propintel/
├── apps/
│   ├── api/                    # Serverless backend
│   │   ├── src/
│   │   │   ├── agents/         # AI agent implementations
│   │   │   │   ├── orchestrator/   # Core orchestration
│   │   │   │   │   ├── orchestrator-agent.ts  # Main coordinator
│   │   │   │   │   ├── plan-generator.ts      # LLM-driven execution planning
│   │   │   │   │   └── result-reasoner.ts     # Post-phase reasoning
│   │   │   │   ├── context/        # State management
│   │   │   │   │   ├── context-manager.ts     # S3-backed context
│   │   │   │   │   └── summary-generator.ts   # LLM summarization
│   │   │   │   ├── discovery/      # Discovery agents
│   │   │   │   │   ├── page-analysis.ts       # Content extraction
│   │   │   │   │   ├── query-generation.ts    # Target query generation
│   │   │   │   │   └── competitor-discovery.ts
│   │   │   │   ├── research/       # Research agents
│   │   │   │   │   ├── tavily-research.ts     # Web search via Tavily
│   │   │   │   │   ├── community-agent.ts     # Reddit/Twitter opportunities
│   │   │   │   │   ├── perplexity-agent.ts    # Perplexity API (optional)
│   │   │   │   │   └── llm-brand-probe.ts     # Direct LLM brand probing
│   │   │   │   ├── analysis/       # Analysis agents
│   │   │   │   │   ├── citation-analysis.ts   # Citation pattern analysis
│   │   │   │   │   ├── content-comparison.ts  # Competitor content comparison
│   │   │   │   │   └── visibility-scoring.ts  # AEO score calculation
│   │   │   │   ├── output/         # Output agents
│   │   │   │   │   ├── recommendation.ts      # Prioritized recommendations
│   │   │   │   │   ├── cursor-prompt.ts       # Cursor IDE prompt generation
│   │   │   │   │   └── report-generator.ts    # Final report assembly
│   │   │   │   ├── executor.ts     # Agent execution engine
│   │   │   │   └── registry.ts     # Agent metadata & dependencies
│   │   │   ├── handlers/       # Lambda function handlers
│   │   │   ├── lib/            # Utilities (crawler, AI client, S3, Tavily)
│   │   │   └── analysis/       # LLMEO/SEO analysis modules
│   │   └── serverless.yml      # AWS infrastructure definition
│   │
│   └── web/                    # Next.js frontend
│       └── src/
│           ├── app/            # App Router pages
│           ├── components/     # UI components
│           │   └── analysis/   # Analysis result cards
│           ├── server/         # tRPC routers, auth config
│           └── contexts/       # React contexts
│
├── packages/
│   ├── database/               # Drizzle ORM schemas & migrations
│   └── types/                  # Shared TypeScript types
│
└── .docs/                      # Architecture documentation
```

---

## API Reference

### Core Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/jobs` | Create a new analysis job |
| `GET` | `/health` | Health check |

> **Note**: Job status, listing, and **reports** are accessed via tRPC through the Next.js frontend for better performance and direct S3 access.

### Dashboard Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/dashboard/summary` | Dashboard metrics overview |
| `GET` | `/dashboard/trends` | Score trends over time |
| `GET` | `/alerts` | Active alerts and notifications |

### Create Job Request

```bash
curl -X POST https://api.propintel.dev/jobs \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <session-token>" \
  -d '{
    "targetUrl": "https://example.com",
    "config": {
      "maxPages": 50,
      "maxDepth": 3
    }
  }'
```

### Job Status Response

```json
{
  "success": true,
  "data": {
    "job": {
      "id": "uuid",
      "status": "analyzing",
      "progress": {
        "currentPhase": "aeo-research",
        "pagesCrawled": 25,
        "agentSummaries": { ... }
      }
    }
  }
}
```

---

## Development

### Available Scripts

```bash
# Development
pnpm dev              # Start all apps in dev mode
pnpm dev:web          # Start only frontend
pnpm dev:api          # Start only backend (serverless-offline)

# Database
pnpm db:generate      # Generate migration from schema changes
pnpm db:migrate       # Run pending migrations
pnpm db:studio        # Open Drizzle Studio

# Testing
pnpm test             # Run all tests
pnpm test:check       # Run test data validation

# Code Quality
pnpm lint             # Run ESLint
pnpm typecheck        # Run TypeScript checks
pnpm format:write     # Format code with Prettier
```

### Running Tests

```bash
# Run all tests
pnpm test

# Run API integration tests
cd apps/api && pnpm test

# Run with coverage
cd apps/api && pnpm test -- --coverage
```

---

## Deployment

### AWS Deployment

The API is designed to run on AWS using the Serverless Framework:

```bash
# Deploy to dev
cd apps/api
npx serverless deploy --stage dev

# Deploy to production
npx serverless deploy --stage prod
```

Infrastructure created:
- API Gateway HTTP API
- Lambda functions (7 total)
- SQS queue + DLQ
- S3 bucket (report storage)
- ECS cluster (SPA rendering)
- VPC with public subnets

### Frontend Deployment

The Next.js app can be deployed to Vercel or any Node.js hosting:

```bash
cd apps/web
pnpm build
```

---

## Documentation

Detailed documentation is available in the `.docs/` folder:

| Document | Description |
|----------|-------------|
| [Architecture Overview](.docs/architecture.md) | High-level system design |
| [Agent Architecture](.docs/agent_architecture.md) | Deep dive into the AI pipeline |
| [API Architecture](apps/api/ARCHITECTURE.md) | Comprehensive backend documentation |
| [Frontend Architecture](.docs/frontend-architecture.md) | Next.js patterns and conventions |
| [User Flow](.docs/userflow.md) | End-to-end user journey |

---

## License

Proprietary - All rights reserved.

---

## Contributing

This is a private repository. For internal contribution guidelines, see the team documentation.
