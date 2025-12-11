export const testJobs = {
  basic: {
    targetUrl: "https://example.com",
    config: {
      maxPages: 10,
      maxDepth: 2,
    },
  },
  large: {
    targetUrl: "https://large-site.example.com",
    config: {
      maxPages: 100,
      maxDepth: 5,
    },
  },
  minimal: {
    targetUrl: "https://minimal.example.com",
    config: {
      maxPages: 1,
      maxDepth: 1,
    },
  },
};
