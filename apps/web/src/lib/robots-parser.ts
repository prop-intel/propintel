export interface RobotsRule {
  userAgent: string;
  rules: Array<{
    type: "allow" | "disallow";
    path: string;
  }>;
}

export interface ParsedRobots {
  raw: string;
  rules: RobotsRule[];
  sitemaps: string[];
}

export function parseRobotsTxt(content: string): ParsedRobots {
  const lines = content.split("\n").map((line) => line.trim());
  const rules: RobotsRule[] = [];
  const sitemaps: string[] = [];

  let currentRule: RobotsRule | null = null;

  for (const line of lines) {
    // Skip comments and empty lines
    if (line.startsWith("#") || line === "") continue;

    const [directive, ...valueParts] = line.split(":");
    const value = valueParts.join(":").trim();

    const directiveLower = directive?.toLowerCase().trim();

    if (directiveLower === "user-agent") {
      if (currentRule) {
        rules.push(currentRule);
      }
      currentRule = { userAgent: value, rules: [] };
    } else if (directiveLower === "disallow" && currentRule) {
      currentRule.rules.push({ type: "disallow", path: value || "/" });
    } else if (directiveLower === "allow" && currentRule) {
      currentRule.rules.push({ type: "allow", path: value });
    } else if (directiveLower === "sitemap") {
      sitemaps.push(value);
    }
  }

  if (currentRule) {
    rules.push(currentRule);
  }

  return { raw: content, rules, sitemaps };
}

export function isCrawlerAllowed(
  robots: ParsedRobots,
  crawlerUserAgent: string,
  _path = "/"
): "allowed" | "blocked" | "partial" | "unknown" {
  // Find matching rules (specific user-agent or *)
  const matchingRules = robots.rules.filter(
    (rule) =>
      rule.userAgent === "*" ||
      rule.userAgent.toLowerCase() === crawlerUserAgent.toLowerCase() ||
      crawlerUserAgent.toLowerCase().includes(rule.userAgent.toLowerCase())
  );

  if (matchingRules.length === 0) {
    return "allowed"; // No rules = allowed by default
  }

  // Check specific user-agent first, then fallback to *
  const specificRules = matchingRules.filter(
    (r) => r.userAgent.toLowerCase() !== "*"
  );
  const rulesToCheck = specificRules.length > 0 ? specificRules : matchingRules;

  for (const rule of rulesToCheck) {
    // Check for complete block
    const hasRootDisallow = rule.rules.some(
      (r) => r.type === "disallow" && (r.path === "/" || r.path === "")
    );
    const hasAnyAllow = rule.rules.some((r) => r.type === "allow");

    if (hasRootDisallow && !hasAnyAllow) {
      return "blocked";
    }
    if (hasRootDisallow && hasAnyAllow) {
      return "partial";
    }
  }

  return "allowed";
}

// Common AI crawler user agents to check
export const AI_CRAWLER_USER_AGENTS = [
  { id: "gptbot", userAgent: "GPTBot", name: "GPTBot", company: "OpenAI" },
  { id: "chatgpt-user", userAgent: "ChatGPT-User", name: "ChatGPT-User", company: "OpenAI" },
  { id: "oai-searchbot", userAgent: "OAI-SearchBot", name: "OAI-SearchBot", company: "OpenAI" },
  { id: "claudebot", userAgent: "ClaudeBot", name: "ClaudeBot", company: "Anthropic" },
  { id: "claude-web", userAgent: "Claude-Web", name: "Claude-Web", company: "Anthropic" },
  { id: "anthropic-ai", userAgent: "anthropic-ai", name: "anthropic-ai", company: "Anthropic" },
  { id: "perplexitybot", userAgent: "PerplexityBot", name: "PerplexityBot", company: "Perplexity" },
  { id: "google-extended", userAgent: "Google-Extended", name: "Google-Extended", company: "Google" },
  { id: "bingbot", userAgent: "bingbot", name: "Bingbot", company: "Microsoft" },
  { id: "bytespider", userAgent: "Bytespider", name: "Bytespider", company: "ByteDance" },
  { id: "cohere-ai", userAgent: "cohere-ai", name: "cohere-ai", company: "Cohere" },
  { id: "meta-externalagent", userAgent: "Meta-ExternalAgent", name: "Meta-ExternalAgent", company: "Meta" },
  { id: "applebot-extended", userAgent: "Applebot-Extended", name: "Applebot-Extended", company: "Apple" },
];
