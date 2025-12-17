import { type CrawledPageData } from "@/lib/storage/s3";

interface GeneratorOptions {
  maxPages?: number;
  includeSchemas?: boolean;
}

// Alias for the page type used by generator
type PageData = CrawledPageData;

/**
 * Generates llms.txt content following the llmstxt.org specification.
 * This creates an index file with links and brief descriptions.
 */
export function generateLlmsTxt(
  pages: PageData[],
  siteName: string,
  domain: string,
  options: GeneratorOptions = {}
): string {
  const { maxPages = 100 } = options;

  // Sort pages: homepage first, then by word count (more content = more important)
  const sortedPages = [...pages].sort((a, b) => {
    const aIsHome = isHomepage(a.url, domain);
    const bIsHome = isHomepage(b.url, domain);
    if (aIsHome && !bIsHome) return -1;
    if (!aIsHome && bIsHome) return 1;
    return (b.wordCount ?? 0) - (a.wordCount ?? 0);
  });

  const limitedPages = sortedPages.slice(0, maxPages);
  const homepage = limitedPages.find((p) => isHomepage(p.url, domain));

  const lines: string[] = [];

  // H1: Site name (required)
  lines.push(`# ${siteName}`);
  lines.push("");

  // Blockquote: Site summary
  const summary =
    homepage?.metaDescription ?? `Website content for ${domain}`;
  lines.push(`> ${summary}`);
  lines.push("");

  // Pages section
  lines.push("## Pages");
  lines.push("");

  for (const page of limitedPages) {
    const title = getPageTitle(page);
    const description = getPageDescription(page);
    lines.push(`- [${title}](${page.url}): ${description}`);
  }

  return lines.join("\n");
}

/**
 * Generates llms-full.txt content with complete page information.
 * This includes all content in a single file for direct LLM consumption.
 */
export function generateLlmsFullTxt(
  pages: PageData[],
  siteName: string,
  domain: string,
  options: GeneratorOptions = {}
): string {
  const { maxPages = 50 } = options;

  // Sort pages: homepage first, then by word count
  const sortedPages = [...pages].sort((a, b) => {
    const aIsHome = isHomepage(a.url, domain);
    const bIsHome = isHomepage(b.url, domain);
    if (aIsHome && !bIsHome) return -1;
    if (!aIsHome && bIsHome) return 1;
    return (b.wordCount ?? 0) - (a.wordCount ?? 0);
  });

  const limitedPages = sortedPages.slice(0, maxPages);
  const homepage = limitedPages.find((p) => isHomepage(p.url, domain));

  const lines: string[] = [];

  // H1: Site name
  lines.push(`# ${siteName}`);
  lines.push("");

  // Blockquote: Site summary
  const summary =
    homepage?.metaDescription ?? `Complete website content for ${domain}`;
  lines.push(`> ${summary}`);
  lines.push("");

  // Each page as a section
  for (const page of limitedPages) {
    const title = getPageTitle(page);
    lines.push(`## ${title}`);
    lines.push("");
    lines.push(`**URL:** ${page.url}`);
    lines.push("");

    if (page.metaDescription) {
      lines.push(page.metaDescription);
      lines.push("");
    }

    // Include headings structure if available
    const headings = page.headings;
    if (headings) {
      const allHeadings = [
        ...(headings.h2 ?? []),
        ...(headings.h3 ?? []),
      ].filter(Boolean);

      if (allHeadings.length > 0) {
        lines.push("**Topics covered:**");
        for (const heading of allHeadings.slice(0, 10)) {
          lines.push(`- ${heading}`);
        }
        lines.push("");
      }
    }

    // Include schema types if present
    const schemas = page.schemas;
    if (schemas && schemas.length > 0) {
      const types = schemas.map((s) => s.type).filter(Boolean);
      if (types.length > 0) {
        lines.push(`**Content types:** ${types.join(", ")}`);
        lines.push("");
      }
    }

    if (page.wordCount) {
      lines.push(`*${page.wordCount.toLocaleString()} words*`);
      lines.push("");
    }

    lines.push("---");
    lines.push("");
  }

  return lines.join("\n");
}

function isHomepage(url: string, domain: string): boolean {
  try {
    const parsed = new URL(url);
    return (
      parsed.pathname === "/" ||
      parsed.pathname === "" ||
      parsed.pathname === "/index.html"
    );
  } catch {
    return url.includes(domain) && !url.includes(domain + "/");
  }
}

function getPageTitle(page: PageData): string {
  if (page.title) {
    return truncate(page.title, 80);
  }
  if (page.h1) {
    return truncate(page.h1, 80);
  }
  // Extract from URL path
  try {
    const parsed = new URL(page.url);
    const path = parsed.pathname.replace(/\/$/, "").split("/").pop();
    if (path) {
      return path
        .replace(/[-_]/g, " ")
        .replace(/\.\w+$/, "")
        .replace(/\b\w/g, (c) => c.toUpperCase());
    }
  } catch {
    // Ignore URL parsing errors
  }
  return "Untitled Page";
}

function getPageDescription(page: PageData): string {
  if (page.metaDescription) {
    return truncate(page.metaDescription, 150);
  }
  if (page.h1 && page.h1 !== page.title) {
    return truncate(page.h1, 150);
  }
  const h2s = page.headings?.h2;
  if (h2s && h2s.length > 0) {
    return truncate(h2s.slice(0, 2).join("; "), 150);
  }
  if (page.wordCount) {
    return `Page with ${page.wordCount.toLocaleString()} words of content`;
  }
  return "Page content";
}

function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3).trim() + "...";
}
