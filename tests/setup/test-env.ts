/**
 * Test environment configuration
 */

export const TEST_CONFIG = {
  DATABASE_URL: process.env.TEST_DATABASE_URL || process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/propintel_test',
  API_URL: process.env.TEST_API_URL || 'http://localhost:4000',
  API_KEY: process.env.TEST_API_KEY || 'propintel-dev-key-2024',
  AWS_API_URL: process.env.AWS_API_URL,
};
