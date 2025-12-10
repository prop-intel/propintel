// Crawler patterns for detection
export const CRAWLER_PATTERNS = [
  { id: "gptbot", pattern: /GPTBot/i },
  { id: "chatgpt-user", pattern: /ChatGPT-User/i },
  { id: "oai-searchbot", pattern: /OAI-SearchBot/i },
  { id: "claudebot", pattern: /ClaudeBot/i },
  { id: "claude-web", pattern: /Claude-Web/i },
  { id: "claude-searchbot", pattern: /Claude-SearchBot/i },
  { id: "anthropic-ai", pattern: /anthropic-ai/i },
  { id: "perplexitybot", pattern: /PerplexityBot/i },
  { id: "perplexity-user", pattern: /Perplexity-User/i },
  { id: "googlebot", pattern: /Googlebot/i },
  { id: "google-extended", pattern: /Google-Extended/i },
  { id: "bingbot", pattern: /bingbot/i },
  { id: "bytespider", pattern: /Bytespider/i },
  { id: "cohere-ai", pattern: /cohere-ai/i },
  { id: "meta-externalagent", pattern: /Meta-ExternalAgent/i },
  { id: "applebot-extended", pattern: /Applebot-Extended/i },
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
