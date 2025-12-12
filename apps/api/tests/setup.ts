import { beforeAll } from "vitest";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import { cleanupStuckJobs } from "./setup/db";

function loadEnvFile(filePath: string) {
  if (!existsSync(filePath)) {
    return;
  }

  const envContent = readFileSync(filePath, "utf-8");
  envContent.split("\n").forEach((line) => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#")) {
      const match = trimmed.match(/^([^=]+)=(.*)$/);
      if (match && match[1] && match[2] !== undefined) {
        const key = match[1];
        const value = match[2];
        if (!process.env[key]) {
          const cleanValue = value.replace(/^["']|["']$/g, "");
          process.env[key] = cleanValue;
        }
      }
    }
  });
}

// Load environment files
loadEnvFile(resolve(process.cwd(), "../../.env"));
loadEnvFile(resolve(process.cwd(), ".env"));

// Set NODE_ENV if not already set
if (!process.env.NODE_ENV) {
  Object.defineProperty(process.env, "NODE_ENV", {
    value: "test",
    writable: true,
    enumerable: true,
    configurable: true,
  });
}

// Set test database URL
const defaultTestDbUrl =
  "postgresql://postgres:password@localhost:5432/propintel_test";
if (
  !process.env.DATABASE_URL ||
  (process.env.DATABASE_URL.includes("localhost") &&
    !process.env.DATABASE_URL.includes("@")) ||
  process.env.DATABASE_URL.startsWith("postgresql://localhost") ||
  process.env.DATABASE_URL.startsWith("postgresql://127.0.0.1")
) {
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || defaultTestDbUrl;
} else {
  process.env.DATABASE_URL =
    process.env.DATABASE_URL ||
    process.env.TEST_DATABASE_URL ||
    defaultTestDbUrl;
}

// Set other test environment variables
process.env.AUTH_SECRET =
  process.env.AUTH_SECRET || "test-secret-key-for-testing-only";
process.env.AUTH_GOOGLE_ID = process.env.AUTH_GOOGLE_ID || "test-google-id";
process.env.AUTH_GOOGLE_SECRET =
  process.env.AUTH_GOOGLE_SECRET || "test-google-secret";
process.env.API_URL =
  process.env.API_URL || "http://localhost:4000";
process.env.API_KEY =
  process.env.API_KEY || "propintel-dev-key-2024";
process.env.SKIP_ENV_VALIDATION = process.env.SKIP_ENV_VALIDATION || "true";
process.env.IS_OFFLINE = process.env.IS_OFFLINE || "true";

// Clean up stuck jobs before tests run
beforeAll(async () => {
  await cleanupStuckJobs();
});
