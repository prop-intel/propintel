# Superprompt: How It Works Page Generation

**Context:**
We are building the "How It Works" page for **PropIntel**, a SaaS platform that helps brands optimize their visibility in AI Answer Engines (AEO). The current web landscape has shifted from traditional Search (SEO) to AI-driven Answers (LLMEO). Our tool analyzes this shift.

**Objective:**
Generate a comprehensive, visually engaging, and technically accurate "How It Works" page copy and structure. The page should demystify the "black box" of AI optimization for marketing professionals.

**Source Material Reference:**
*Use the following internal architecture to ensure technical accuracy:*

1.  **Phase 1: Discovery (The "DNA" Check)**
    *   **What happens:** We crawl the user's site.
    *   **Agents:** `page-analysis` (extracts entities/intent), `query-generation` (predicts what users ask to find this page).
    *   **User Benefit:** "We understand your content like an LLM does."

2.  **Phase 2: Research (The Simulation)**
    *   **What happens:** We act like a real user.
    *   **Agents:** `tavily-research` (live web search), `llm-brand-probe` (direct LLM knowledge), `perplexity-agent` (checking AI citations).
    *   **User Benefit:** "We don't guess—we simulate real AI searches to see if you win the answer slot."

3.  **Phase 3: Analysis (The Scoring)**
    *   **What happens:** We compare you vs. the winner.
    *   **Agents:** `content-comparison` (gap analysis), `visibility-scoring` (0-100 score).
    *   **User Benefit:** "Know exactly why competitors are ranking above you."

4.  **Phase 4: Action (The Fix)**
    *   **What happens:** We generate the code to fix it.
    *   **Agents:** `recommendation` (prioritized list), `cursor-prompt` (copy-paste code for developers).
    *   **User Benefit:** "Turn insights into action instantly with AI-generated code."

**Content Requirements:**

1.  **Headline & Subhead:**
    *   Hook the user immediately. Something about "See the world through an AI's eyes."
2.  **The 4-Step Process:**
    *   Break down the phases above into simple, marketing-friendly steps.
    *   Use the "Agent" terminology lightly—focus on the *result* of the agent's work.
3.  **Visual Suggestions & Diagrams:**
    *   **Architecture Flowchart:** Request a Mermaid diagram showing the flow from URL Input -> Orchestrator -> Parallel Agents -> Report.
    *   **Comparison Chart:** Request a visual comparison of "Old Way (SEO)" vs "New Way (AEO)" using a table or side-by-side graphic description.
    *   **UI Mockups:** Describe what UI elements should accompany each step (e.g., "Show a terminal window scanning code," "Show a side-by-side comparison chart").
    *   *Constraint:* Ensure diagrams are simplified for a non-technical marketing audience, avoiding overly complex cluster subgraphs unless necessary for clarity.
4.  **FAQ Section:**
    *   Answer: "How is this different from SEO?", "Do you support SearchGPT?", "How fast is it?"
5.  **Final CTA:**
    *   Push them to "Start a Free Analysis."

**Tone:**
*   **Professional yet visionary.** (Metaphor: Navigating uncharted waters.)
*   ** authoritative.** We aren't guessing; we are simulating the actual technology.
*   **Action-oriented.** Don't just analyze; fix.

**Project Constraints:**
*   Target audience: CMOs, SEO leads, Growth Engineers.
*   Must align with the existing "About" page narrative (The shift from search to answers).
