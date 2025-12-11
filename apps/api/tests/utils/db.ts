import { getTestDb } from "../setup/db";
import { jobs } from "@propintel/database";

export async function createTestJob(
  userId: string,
  overrides?: {
    targetUrl?: string;
    status?: string;
    config?: Record<string, unknown>;
  }
) {
  const db = getTestDb();
  const targetUrl = overrides?.targetUrl || "https://example.com";
  const status = overrides?.status || "pending";
  const config = overrides?.config || {
    maxPages: 10,
    maxDepth: 2,
  };

  const [job] = await db
    .insert(jobs)
    .values({
      userId,
      targetUrl,
      status,
      config,
    })
    .returning();

  return job;
}
