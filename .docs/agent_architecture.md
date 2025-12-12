# AI Agent Architecture

This document details the multi-agent system powering PropIntel's AEO (Answer Engine Optimization) analysis. Each agent simulates a specific aspect of how AI Answer Engines (like Perplexity, SearchGPT, or Google Overviews) understand and rank content.

## 1. Orchestrator Agent
**Intent**: The conductor of the symphony. It manages the lifecycle of a job, ensuring data flows correctly between agents and handling error states.
**Logic**: Uses a sequential execution plan but evaluates "reasoning" steps after each phase to decide if it should pivot (e.g., if a page is 404, stop; if a page is thin, maybe double-check).

## 2. Discovery Agent
**Intent**: "Understand the Content's DNA."
This agent acts like the indexing crawler of a search engine. It doesn't care about the outside world yet; it only cares about what the page *says* it is.

### Type & Amount of Information Gathered
-   **Page DNA**: Topic, User Intent (Informational vs. Transactional), Content Type (Blog/Landing Page).
-   **Key Entities**: Extracting 10-20 key entities (people, places, concepts) mentioned.
-   **Predicted Queries**: Generates **10-15 Target Queries** that the page *should* be ranking for.
    -   *Types*: "How-to", "What Is", "Best X vs Y".
    -   *Logic*: "If I were a user looking for this exact page, what would I ask an AI?"

## 3. Research Agent
**Intent**: "Simulate the User & Validator."
This agent goes out into the real world (Tavily Search API) to validate the assumptions made by the Discovery agent.

### Type & Amount of Information Gathered
-   **Search Results**: Performs **10+ Live Web Searches** (one for each target query) to see what *actually* ranks.
-   **Community Signals**: Scans **Reddit, HackerNews, GitHub, and X/Twitter** for brand mentions.
    -   *Data*: Comment counts, sentiment analysis (Positive/Negative), and "Training Data Likely" indicators (e.g., massive Reddit threads).
-   **Citation Data**: Specifically tracks if the client's URL appears in the top results vs. just being "mentioned" casually.

## 4. Analysis Agent (The "Brain")
**Intent**: "Compare and Score."
This agent takes the internal representation (Discovery) and the external reality (Research) and finds the discrepancies.

### Type & Amount of Information Gathered
-   **Visibility Score (0-100)**: A composite metric calculated from Citation Rate (35%), Rank Quality (25%), Competitive Position (20%), and Query Breadth (10%).
-   **Competitor Insights**: Analyzes the **Top 3 Competitors** across all queries.
    -   *Data*: Their citation rate, their top winning queries, and *why* they are winning.
-   **Content Gaps**: Identifies specific queries where competitors appear but the client does not.
    -   *Logic*: "Competitor A ranks for 'How to maximize ROI' because they have a table of data. You do not."
-   **Structural Analysis**: Compares formatting (Lists vs. Paragraphs, Tables, Schemas).

## 5. Output Agent
**Intent**: "Turn Insight into Action."
This agent translates the raw analysis into human-readable and machine-executable advice.

### Type & Amount of Information Gathered
-   **Recommendations**: Generates **5-8 Prioritized Actions** (High/Medium/Low Impact).
    -   *Format*: Title, Description, and *Competitor Reference* ("Do what Domain X does here").
-   **Cursor Prompt**: A **Copy-Paste Optimization Prompt**.
    -   *Intent*: The user can paste this directly into Cursor/VS Code. It contains the exact context, the missing queries, and the specific instructions for an AI coder to "fix" the page content automatically.
