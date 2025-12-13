/**
 * Cleanup test data from the database
 *
 * Removes only test data (users with test-* emails and example.com jobs)
 * Safe to run against any database - won't delete real user data
 *
 * Usage: pnpm test:cleanup
 */

import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

// Load environment variables (same logic as tests/setup.ts)
function loadEnvFile(filePath: string) {
  if (!existsSync(filePath)) return;
  const envContent = readFileSync(filePath, "utf-8");
  envContent.split("\n").forEach((line) => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#")) {
      const match = trimmed.match(/^([^=]+)=(.*)$/);
      if (match && match[1] && match[2] !== undefined) {
        const key = match[1];
        const value = match[2].replace(/^["']|["']$/g, "");
        if (!process.env[key]) {
          process.env[key] = value;
        }
      }
    }
  });
}

// Load .env files
loadEnvFile(resolve(process.cwd(), "../../.env"));
loadEnvFile(resolve(process.cwd(), ".env"));

import { cleanupTestData, closeDatabase } from "../tests/setup/db";

async function main() {
  console.log("Starting test data cleanup...");

  try {
    await cleanupTestData();
    console.log("Test data cleanup completed successfully");
  } catch (error) {
    console.error("Cleanup failed:", error);
    process.exit(1);
  } finally {
    await closeDatabase();
  }
}

main();
