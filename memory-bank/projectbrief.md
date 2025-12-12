# Project Brief: PropIntel

## Overview
PropIntel is an AI-native optimization platform that helps websites rank in Large Language Models (LLMs) and Answer Engines. It combines passive bot analytics with active AEO (Answer Engine Optimization) pipelines.

## Core Value Proposition
"SEO for the AI Era." PropIntel helps you understand not just *who* is crawling you, but *how* to get cited by them.

## Key Features
-   **AEO Pipeline**: Automatically discovers target queries, runs searches, and analyzes citation patterns.
-   **AI Search Simulation**: Uses agents (Tavily, Perplexity) to monitor your visibility in real-time.
-   **Competitor Benchmarking**: content-level comparison against domains that are winning the AI slot.
-   **Cursor Prompts**: Generates copy-paste prompts for your IDE to instantly optimize content.
-   **Crawler Analytics**: Traditional tracking of AI bot visits (GPTBot, ClaudeBot, etc.).

## Technical Stack
-   **Frontend**: Next.js 16 (React 19), Shadcn/UI, Framer Motion
-   **Backend**: Serverless (AWS Lambda, SQS, EventBridge), Node.js, TypeScript
-   **AI/Agents**: OpenAI, Tavily, Langfuse, Vercel AI SDK
-   **Database**: Postgres (Drizzle ORM), DynamoDB (for jobs/reports)
