import { Pool } from "pg";
import { createPgClient } from "@propintel/database";

function getDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;

  if (!url || !url.trim()) {
    return "postgresql://postgres:password@localhost:5432/propintel_test";
  }

  const trimmedUrl = url.trim();

  if (
    !trimmedUrl.includes("@") ||
    trimmedUrl.match(/^postgresql:\/\/localhost/) ||
    trimmedUrl.match(/^postgresql:\/\/127\.0\.0\.1/)
  ) {
    const match = trimmedUrl.match(
      /^postgresql:\/\/(?:localhost|127\.0\.0\.1)(?::(\d+))?(?:\/(.+))?$/
    );
    if (match) {
      const port = match[1] || "5432";
      const dbName = match[2] || "propintel_test";
      return `postgresql://postgres:password@localhost:${port}/${dbName}`;
    }
    return "postgresql://postgres:password@localhost:5432/propintel_test";
  }

  return trimmedUrl;
}

const pool = new Pool({
  connectionString: getDatabaseUrl(),
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

export const db = createPgClient(pool);
export { pool };

// Re-export schema for convenience
export * from "@propintel/database";
