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
    category: "assistant",
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
    id: "claude-user",
    name: "Claude-User",
    company: "Anthropic",
    userAgentPattern: "Claude-User",
    category: "assistant",
    description: "User-triggered web access",
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
    category: "assistant",
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

  // Meta
  {
    id: "meta-externalagent",
    name: "Meta-ExternalAgent",
    company: "Meta",
    userAgentPattern: "Meta-ExternalAgent",
    category: "training",
    description: "Meta AI training",
  },
  {
    id: "facebookbot",
    name: "FacebookBot",
    company: "Meta",
    userAgentPattern: "FacebookBot",
    category: "search",
    description: "Facebook search and link previews",
  },

  // Amazon
  {
    id: "amazonbot",
    name: "Amazonbot",
    company: "Amazon",
    userAgentPattern: "Amazonbot",
    category: "search",
    description: "Alexa answers and Amazon search",
  },

  // Apple
  {
    id: "applebot-extended",
    name: "Applebot-Extended",
    company: "Apple",
    userAgentPattern: "Applebot-Extended",
    category: "training",
    description: "Apple Intelligence",
  },

  // ByteDance
  {
    id: "bytespider",
    name: "Bytespider",
    company: "ByteDance",
    userAgentPattern: "Bytespider",
    category: "training",
    description: "ByteDance/TikTok",
  },

  // Cohere
  {
    id: "cohere-ai",
    name: "cohere-ai",
    company: "Cohere",
    userAgentPattern: "cohere-ai",
    category: "training",
    description: "Cohere models",
  },

  // DeepSeek
  {
    id: "deepseekbot",
    name: "DeepseekBot",
    company: "DeepSeek",
    userAgentPattern: "DeepseekBot",
    category: "training",
    description: "DeepSeek AI training",
  },

  // xAI
  {
    id: "xai-bot",
    name: "xAI-Bot",
    company: "xAI",
    userAgentPattern: "xAI-Bot",
    category: "training",
    description: "Grok training",
  },

  // Common Crawl
  {
    id: "ccbot",
    name: "CCBot",
    company: "Common Crawl",
    userAgentPattern: "CCBot",
    category: "training",
    description: "Open dataset used by many AI models",
  },

  // DuckDuckGo
  {
    id: "duckassistbot",
    name: "DuckAssistBot",
    company: "DuckDuckGo",
    userAgentPattern: "DuckAssistBot",
    category: "assistant",
    description: "DuckDuckGo AI assistant",
  },

  // You.com
  {
    id: "youbot",
    name: "YouBot",
    company: "You.com",
    userAgentPattern: "YouBot",
    category: "search",
    description: "You.com AI search",
  },
];

async function seedCrawlers() {
  console.log("Seeding crawlers...");

  for (const crawler of crawlerSeedData) {
    try {
      await sql`
        INSERT INTO crawlers (id, name, company, user_agent_pattern, category, description, created_at)
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
