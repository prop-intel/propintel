<div align="center">

# PropIntel

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

## What is PropIntel?

PropIntel crawls your website and runs it through a 12-agent AI pipeline that simulates how modern AI search engines discover, evaluate, and cite content. It generates an **AEO Visibility Score** (0-100) along with specific recommendations to improve your content's chances of being cited in AI-generated answers.

Unlike traditional SEO tools, PropIntel focuses on the emerging "Answer Engine" paradigm—where AI systems synthesize information from multiple sources rather than simply ranking links.

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

    subgraph Pipeline["Orchestrator"]
        Orch[Orchestrator Agent]
    end

    subgraph Agents["AI Agent Pipeline"]
        D[Discovery]
        R[Research]
        A[Analysis]
        O[Output]
    end

    subgraph External["External Services"]
        OpenAI[OpenAI]
        Tavily[Tavily Search]
        S3[S3 Storage]
        DB[(PostgreSQL)]
    end

    UI -->|Create Job| Lambda
    Lambda -->|Enqueue| SQS
    SQS -->|Trigger| Orch
    Orch --> D --> R --> A --> O
    
    D & R & A & O -->|LLM Calls| OpenAI
    R -->|Web Search| Tavily
    O -->|Store Report| S3
    Orch -->|Update Status| DB
```

---

## The Agent System

PropIntel's core differentiator is its **multi-agent pipeline** that breaks down AEO analysis into specialized tasks:

### Pipeline Phases

| Phase | Agents | Purpose |
|-------|--------|---------|
| **Discovery** | `page-analysis`, `query-generation`, `competitor-discovery` | Understand what your page is about and what queries it should answer |
| **Research** | `tavily-research`, `google-aio`, `perplexity`, `community-signals` | Search the web to see where you currently appear (or don't) |
| **Analysis** | `citation-analysis`, `content-comparison`, `visibility-scoring` | Calculate your AEO score and identify gaps vs. competitors |
| **Output** | `recommendations`, `cursor-prompt`, `report-generator` | Generate actionable fixes and ready-to-use prompts |

### How It Works

1. **Crawl** — Fetches up to 50 pages from your site (with SPA detection and rendering support)
2. **Analyze** — Extracts topic, intent, entities, and key information from your content
3. **Generate Queries** — Creates 10-15 natural language queries your page should rank for
4. **Research** — Searches each query via Tavily API to see who's being cited
5. **Score** — Calculates visibility based on citation rate, rank quality, and competitive position
6. **Recommend** — Generates prioritized fixes with Cursor IDE-ready prompts

### Visibility Score Formula

```
AEO Visibility Score = 
    Citation Rate (35%) + 
    Rank Quality (25%) + 
    Competitive Position (20%) + 
    Query Breadth (10%) + 
    Content Depth (10%)
```

---

## Key Features

- **AEO Visibility Score** — Single metric (0-100) measuring AI search visibility
- **Target Query Generation** — AI-generated queries your content should answer
- **Competitor Analysis** — See who's winning the queries you should own
- **Content Gap Detection** — Identify what's missing vs. top performers
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
| **AI/LLM** | OpenAI GPT-4o-mini, Vercel AI SDK |
| **Search** | Tavily API |
| **Auth** | NextAuth.js v5 |
| **Observability** | Langfuse (LLM tracing) |

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
│   │   │   │   ├── orchestrator/   # Plan generation & execution
│   │   │   │   ├── discovery/      # Page analysis, query generation
│   │   │   │   ├── research/       # Tavily, Perplexity, community signals
│   │   │   │   ├── analysis/       # Citation patterns, visibility scoring
│   │   │   │   └── output/         # Recommendations, report generation
│   │   │   ├── handlers/       # Lambda function handlers
│   │   │   ├── lib/            # Utilities (crawler, AI client, S3, etc.)
│   │   │   └── analysis/       # LLMEO/SEO analysis modules
│   │   └── serverless.yml      # AWS infrastructure definition
│   │
│   └── web/                    # Next.js frontend
│       └── src/
│           ├── app/            # App Router pages
│           ├── components/     # UI components
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
| `GET` | `/jobs` | List all jobs for user |
| `GET` | `/jobs/{id}` | Get job status and progress |
| `GET` | `/jobs/{id}/report` | Download analysis report (JSON or Markdown) |
| `GET` | `/health` | Health check |

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
