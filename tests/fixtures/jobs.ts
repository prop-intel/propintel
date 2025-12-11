/**
 * Job test fixtures
 */

import { faker } from '@faker-js/faker';

export function createJobFixture(overrides?: {
  targetUrl?: string;
  maxPages?: number;
  maxDepth?: number;
}) {
  return {
    targetUrl: overrides?.targetUrl || faker.internet.url(),
    config: {
      maxPages: overrides?.maxPages || 10,
      maxDepth: overrides?.maxDepth || 2,
      pageTimeout: 30000,
      crawlDelay: 1000,
      maxJobDuration: 600000,
      viewport: { width: 1920, height: 1080 },
      userAgent: 'PropIntel Test Bot',
      followCanonical: true,
      respectRobotsTxt: true,
      skipExactDuplicates: true,
      urlExclusions: [],
      maxFileSize: 10485760,
    },
    competitors: [],
    llmModel: 'gpt-4o-mini',
  };
}

export function createJobFixtures(count: number) {
  return Array.from({ length: count }, () => createJobFixture());
}
