// Standalone seed script for crawlers
// Run with: node --env-file=.env src/server/db/seed/seed-crawlers.mjs

import postgres from "postgres";

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error("DATABASE_URL environment variable is required");
  process.exit(1);
}

const sql = postgres(DATABASE_URL);

const crawlerSeedData = [
  // OpenAI
  {
    id: "gptbot",
    name: "GPTBot",
    company: "OpenAI",
    userAgentPattern: "GPTBot",
    category: "training",
    description: "Training data collection",
  },
  {
    id: "chatgpt-user",
    name: "ChatGPT-User",
    company: "OpenAI",
    userAgentPattern: "ChatGPT-User",
    category: "browsing",
    description: "Real-time browsing (~75% of AI crawler traffic)",
  },
  {
    id: "oai-searchbot",
    name: "OAI-SearchBot",
    company: "OpenAI",
    userAgentPattern: "OAI-SearchBot",
    category: "search",
    description: "SearchGPT indexing",
  },

  // Anthropic
  {
    id: "claudebot",
    name: "ClaudeBot",
    company: "Anthropic",
    userAgentPattern: "ClaudeBot",
    category: "training",
    description: "Training data collection",
  },
  {
    id: "claude-web",
    name: "Claude-Web",
    company: "Anthropic",
    userAgentPattern: "Claude-Web",
    category: "browsing",
    description: "Web access features",
  },
  {
    id: "claude-searchbot",
    name: "Claude-SearchBot",
    company: "Anthropic",
    userAgentPattern: "Claude-SearchBot",
    category: "search",
    description: "Search functionality",
  },
  {
    id: "anthropic-ai",
    name: "anthropic-ai",
    company: "Anthropic",
    userAgentPattern: "anthropic-ai",
    category: "training",
    description: "General Anthropic crawler",
  },

  // Perplexity
  {
    id: "perplexitybot",
    name: "PerplexityBot",
    company: "Perplexity",
    userAgentPattern: "PerplexityBot",
    category: "search",
    description: "Official crawler",
  },
  {
    id: "perplexity-user",
    name: "Perplexity-User",
    company: "Perplexity",
    userAgentPattern: "Perplexity-User",
    category: "browsing",
    description: "User-triggered searches",
  },

  // Google
  {
    id: "googlebot",
    name: "Googlebot",
    company: "Google",
    userAgentPattern: "Googlebot",
    category: "search",
    description: "Also used for AI Overviews",
  },
  {
    id: "google-extended",
    name: "Google-Extended",
    company: "Google",
    userAgentPattern: "Google-Extended",
    category: "training",
    description: "Gemini training (can block separately)",
  },

  // Microsoft
  {
    id: "bingbot",
    name: "Bingbot",
    company: "Microsoft",
    userAgentPattern: "bingbot",
    category: "search",
    description: "Bing search + Copilot",
  },

  // Others
  {
    id: "bytespider",
    name: "Bytespider",
    company: "ByteDance",
    userAgentPattern: "Bytespider",
    category: "training",
    description: "ByteDance/TikTok",
  },
  {
    id: "cohere-ai",
    name: "cohere-ai",
    company: "Cohere",
    userAgentPattern: "cohere-ai",
    category: "training",
    description: "Cohere models",
  },
  {
    id: "meta-externalagent",
    name: "Meta-ExternalAgent",
    company: "Meta",
    userAgentPattern: "Meta-ExternalAgent",
    category: "training",
    description: "Meta AI",
  },
  {
    id: "applebot-extended",
    name: "Applebot-Extended",
    company: "Apple",
    userAgentPattern: "Applebot-Extended",
    category: "training",
    description: "Apple Intelligence",
  },
];

async function seedCrawlers() {
  console.log("Seeding crawlers...");

  for (const crawler of crawlerSeedData) {
    try {
      await sql`
        INSERT INTO crawlers (id, name, company, "userAgentPattern", category, description, "createdAt")
        VALUES (
          ${crawler.id},
          ${crawler.name},
          ${crawler.company},
          ${crawler.userAgentPattern},
          ${crawler.category},
          ${crawler.description},
          NOW()
        )
        ON CONFLICT (id) DO NOTHING
      `;
      console.log(`  ✓ ${crawler.name}`);
    } catch (err) {
      console.error(`  ✗ ${crawler.name}:`, err.message);
    }
  }

  console.log(`\nSeeded ${crawlerSeedData.length} crawlers`);
}

seedCrawlers()
  .then(() => {
    console.log("Done!");
    process.exit(0);
  })
  .catch((err) => {
    console.error("Error seeding crawlers:", err);
    process.exit(1);
  });
