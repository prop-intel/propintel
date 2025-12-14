# Superprompt: How It Works Page Generation

**Context:**
We are building the "How It Works" page for **BrandSight**, a SaaS platform that helps brands optimize their visibility in AI Answer Engines (AEO). The current web landscape has shifted from traditional Search (SEO) to AI-driven Answers (LLMEO/GEO). Our tool analyzes this shift.

**Objective:**
Generate a comprehensive, visually engaging, and technically accurate "How It Works" page copy and structure. The page should demystify the "black box" of AI optimization for marketing professionals.

**Source Material Reference:**
*Use the following internal architecture to ensure technical accuracy:*

1.  **Phase 1: Discovery (The "DNA" Check)**
    *   **What happens:** We crawl your site (up to 50 pages, 3 levels deep) and analyze the content.
    *   **Agents:** `page-analysis` (extracts topic, intent, entities), `query-generation` (predicts 10-15 queries users ask to find this page), `competitor-discovery` (identifies competing domains).
    *   **User Benefit:** "We understand your content like an LLM does."

2.  **Phase 2: Research (The Simulation)**
    *   **What happens:** We act like real users and AI systems searching for answers.
    *   **Agents:** 
        - `tavily-research` (live web search for each target query)
        - `llm-brand-probe` (probes GPT-4 directly to measure brand recognition - GEO)
        - `perplexity` (queries Perplexity for AI-generated citations)
        - `community-signals` (scans Reddit, X/Twitter for brand mentions and engagement opportunities)
    *   **User Benefit:** "We don't guess--we simulate real AI searches and directly probe LLMs to see if they know your brand."

3.  **Phase 3: Analysis (The Scoring)**
    *   **What happens:** We analyze citation patterns and compare you to the competition.
    *   **Agents:** 
        - `citation-analysis` (patterns, frequency, position in results)
        - `content-comparison` (gap analysis vs top competitors)
        - `visibility-scoring` (calculates 0-100 AEO Visibility Score)
    *   **User Benefit:** "Know exactly why competitors are ranking above you in AI answers."

4.  **Phase 4: Output (The Fix)**
    *   **What happens:** We generate actionable recommendations and AI-ready code.
    *   **Agents:** 
        - `recommendations` (5-8 prioritized actions: High/Medium/Low impact)
        - `cursor-prompt` (copy-paste prompts for AI-assisted implementation)
        - `report-generator` (compiles the final AEO report)
    *   **User Benefit:** "Turn insights into action instantly with AI-generated code."

**Visibility Score Formula:**
The AEO Visibility Score (0-100) is calculated from 5 weighted components:

| Component | Weight | Description |
|-----------|--------|-------------|
| Citation Rate | 35% | How often you appear in AI search results |
| Rank Quality | 25% | Your position when you do appear (top 3 = bonus) |
| Competitive Position | 20% | How you compare to top competitors |
| Query Breadth | 10% | Coverage across different query types |
| Gap Penalty | -10% | Penalty for missed opportunities |

*Note: When GEO (LLM Brand Probe) data is available, weights shift to include a 20% GEO Score component.*

**Content Requirements:**

1.  **Headline & Subhead:**
    *   Hook the user immediately. Something about "See the world through an AI's eyes."

2.  **The 4-Step Process:**
    *   Break down the phases above into simple, marketing-friendly steps.
    *   Use the "Agent" terminology lightly--focus on the *result* of the agent's work.

3.  **Visual Suggestions & Diagrams:**
    *   **Architecture Flowchart:** Request a Mermaid diagram showing the flow from URL Input -> Crawler -> Discovery -> Research -> Analysis -> Output.
    *   **Comparison Chart:** Request a visual comparison of "Old Way (SEO)" vs "New Way (AEO/GEO)" using a table or side-by-side graphic description.
    *   **UI Mockups:** Describe what UI elements should accompany each step (e.g., "Show a terminal window scanning code," "Show a side-by-side comparison chart").
    *   *Constraint:* Ensure diagrams are simplified for a non-technical marketing audience.

4.  **Key Differentiators:**
    *   **Bot Traffic Tracking:** We also track which AI crawlers visit your site (GPTBot, ClaudeBot, etc.)
    *   **robots.txt & llms.txt Analysis:** We analyze your site's crawler permissions
    *   **Community Signals:** We find engagement opportunities on Reddit and X/Twitter
    *   **GEO Probing:** We directly ask LLMs about your brand to measure AI recognition

5.  **FAQ Section:**
    *   Answer: "How is this different from SEO?", "What is GEO?", "How fast is it?", "Do you support multiple LLMs?"

6.  **Final CTA:**
    *   Push them to "Start a Free Analysis."

**Tone:**
*   **Professional yet visionary.** (Metaphor: Navigating uncharted waters.)
*   **Authoritative.** We aren't guessing; we are simulating the actual technology.
*   **Action-oriented.** Don't just analyze; fix.

**Project Constraints:**
*   Target audience: CMOs, SEO leads, Growth Engineers.
*   Must align with the existing "About" page narrative (The shift from search to answers).
