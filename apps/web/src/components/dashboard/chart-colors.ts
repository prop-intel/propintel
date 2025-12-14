// Shared company colors for charts
export const companyColors: Record<string, string> = {
  OpenAI: "#10a37f",
  Anthropic: "#d4a27f",
  Perplexity: "#20b8cd",
  Google: "#4285f4",
  Microsoft: "#00a4ef",
  ByteDance: "#000000",
  Cohere: "#39594d",
  Meta: "#0668e1",
  Apple: "#555555",
};

// URL line colors for multi-line charts
export const urlColors = [
  "#8884d8",
  "#82ca9d",
  "#ffc658",
  "#ff7300",
  "#00C49F",
  "#FFBB28",
  "#FF8042",
  "#0088FE",
  "#00C49F",
  "#FFBB28",
];

export function getCompanyColor(company: string): string {
  return companyColors[company] ?? "#888888";
}

export function getUrlColor(index: number): string {
  return urlColors[index % urlColors.length] ?? "#888888";
}
