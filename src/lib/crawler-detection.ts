// Crawler patterns for detection
export const CRAWLER_PATTERNS = [
  // OpenAI
  { id: "gptbot", pattern: /GPTBot/i },
  { id: "chatgpt-user", pattern: /ChatGPT-User/i },
  { id: "oai-searchbot", pattern: /OAI-SearchBot/i },
  // Anthropic
  { id: "claudebot", pattern: /ClaudeBot/i },
  { id: "claude-user", pattern: /Claude-User/i },
  { id: "claude-web", pattern: /Claude-Web/i },
  { id: "claude-searchbot", pattern: /Claude-SearchBot/i },
  { id: "anthropic-ai", pattern: /anthropic-ai/i },
  // Perplexity
  { id: "perplexitybot", pattern: /PerplexityBot/i },
  { id: "perplexity-user", pattern: /Perplexity-User/i },
  // Google
  { id: "googlebot", pattern: /Googlebot/i },
  { id: "google-extended", pattern: /Google-Extended/i },
  // Microsoft
  { id: "bingbot", pattern: /bingbot/i },
  // ByteDance
  { id: "bytespider", pattern: /Bytespider/i },
  // Cohere
  { id: "cohere-ai", pattern: /cohere-ai/i },
  // Meta
  { id: "meta-externalagent", pattern: /Meta-ExternalAgent/i },
  { id: "facebookbot", pattern: /FacebookBot/i },
  // Apple
  { id: "applebot-extended", pattern: /Applebot-Extended/i },
  // Amazon
  { id: "amazonbot", pattern: /Amazonbot/i },
  // DeepSeek
  { id: "deepseekbot", pattern: /DeepseekBot/i },
  // xAI
  { id: "xai-bot", pattern: /xAI-Bot/i },
  // Common Crawl
  { id: "ccbot", pattern: /CCBot/i },
  // DuckDuckGo
  { id: "duckassistbot", pattern: /DuckAssistBot/i },
  // You.com
  { id: "youbot", pattern: /YouBot/i },
] as const;

export function detectCrawler(userAgent: string): string | null {
  for (const crawler of CRAWLER_PATTERNS) {
    if (crawler.pattern.test(userAgent)) {
      return crawler.id;
    }
  }
  return null;
}

export function isAiCrawler(userAgent: string): boolean {
  return detectCrawler(userAgent) !== null;
}
