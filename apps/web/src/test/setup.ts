import "@testing-library/jest-dom";

// Set test environment variables
process.env.NODE_ENV = "test";
process.env.DATABASE_URL = process.env.DATABASE_URL || "postgresql://postgres:password@localhost:5432/propintel_test";
process.env.AUTH_SECRET = process.env.AUTH_SECRET || "test-secret-key-for-testing-only";
process.env.AUTH_GOOGLE_ID = process.env.AUTH_GOOGLE_ID || "test-google-id";
process.env.AUTH_GOOGLE_SECRET = process.env.AUTH_GOOGLE_SECRET || "test-google-secret";
process.env.SKIP_ENV_VALIDATION = "true";
