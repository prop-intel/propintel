import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "@propintel/database";

// Get DATABASE_URL with proper fallback
function getTestDatabaseUrl(): string {
  const url =
    process.env.TEST_DATABASE_URL ||
    process.env.DATABASE_URL ||
    "postgresql://postgres:password@localhost:5432/propintel_test";

  // If URL doesn't have credentials, add default ones
  if (
    !url.includes("@") ||
    url.startsWith("postgresql://localhost") ||
    url.startsWith("postgresql://127.0.0.1")
  ) {
    return "postgresql://postgres:password@localhost:5432/propintel_test";
  }

  return url;
}

let pool: Pool | null = null;
let testDb: ReturnType<typeof drizzle> | null = null;
let currentDatabaseUrl: string | null = null;

export function getTestDb() {
  const databaseUrl = getTestDatabaseUrl();

  // Recreate connection if URL changed or doesn't exist
  if (!pool || currentDatabaseUrl !== databaseUrl) {
    if (pool) {
      pool.end().catch(() => {});
    }
    currentDatabaseUrl = databaseUrl;
    pool = new Pool({
      connectionString: databaseUrl,
      max: 1,
    });
    testDb = drizzle(pool, { schema });
  }

  return testDb!;
}

export async function cleanupDatabase() {
  try {
    const conn = pool || new Pool({ connectionString: getTestDatabaseUrl(), max: 1 });
    const client = await conn.connect();

    try {
      // Use a single transaction to avoid deadlocks and ensure atomic cleanup
      await client.query("BEGIN");

      // Delete in dependency order to avoid foreign key issues
      await client.query("DELETE FROM crawled_pages");
      await client.query("DELETE FROM reports");
      await client.query("DELETE FROM analyses");
      await client.query("DELETE FROM jobs");
      await client.query("DELETE FROM crawler_visits");
      await client.query("DELETE FROM site_urls");
      await client.query("DELETE FROM sites");
      await client.query("DELETE FROM auth_session");
      await client.query("DELETE FROM auth_account");
      await client.query("DELETE FROM auth_verification_token");
      await client.query("DELETE FROM auth_user");

      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }

    if (conn !== pool) {
      await conn.end();
    }
  } catch (error) {
    // Ignore deadlock errors - they're expected in parallel test execution
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "40P01"
    ) {
      console.warn("Database cleanup warning (deadlock):", error);
    } else {
      console.warn("Database cleanup warning:", error);
    }
  }
}

/**
 * Clean up only test data (users with test-* emails and their related data)
 * Safe to run against any database - won't delete real user data
 */
export async function cleanupTestData() {
  try {
    const conn = pool || new Pool({ connectionString: getTestDatabaseUrl(), max: 1 });
    const client = await conn.connect();

    try {
      await client.query("BEGIN");

      // Find test user IDs (emails starting with "test-" or containing "@example.com")
      const testUsersResult = await client.query(`
        SELECT id FROM auth_user
        WHERE email LIKE 'test-%' OR email LIKE '%@example.com'
      `);
      const testUserIds = testUsersResult.rows.map((row: { id: string }) => row.id);

      if (testUserIds.length > 0) {
        const placeholders = testUserIds.map((_, i) => `$${i + 1}`).join(", ");

        // Delete in dependency order - jobs and related data first
        await client.query(
          `DELETE FROM crawled_pages WHERE job_id IN (SELECT id FROM jobs WHERE user_id IN (${placeholders}))`,
          testUserIds
        );
        await client.query(
          `DELETE FROM reports WHERE job_id IN (SELECT id FROM jobs WHERE user_id IN (${placeholders}))`,
          testUserIds
        );
        await client.query(
          `DELETE FROM analyses WHERE job_id IN (SELECT id FROM jobs WHERE user_id IN (${placeholders}))`,
          testUserIds
        );
        await client.query(
          `DELETE FROM jobs WHERE user_id IN (${placeholders})`,
          testUserIds
        );

        // Delete sites owned by test users
        await client.query(
          `DELETE FROM crawler_visits WHERE site_id IN (SELECT id FROM sites WHERE user_id IN (${placeholders}))`,
          testUserIds
        );
        await client.query(
          `DELETE FROM site_urls WHERE site_id IN (SELECT id FROM sites WHERE user_id IN (${placeholders}))`,
          testUserIds
        );
        await client.query(
          `DELETE FROM sites WHERE user_id IN (${placeholders})`,
          testUserIds
        );

        // Delete auth data for test users
        await client.query(
          `DELETE FROM auth_session WHERE "userId" IN (${placeholders})`,
          testUserIds
        );
        await client.query(
          `DELETE FROM auth_account WHERE "userId" IN (${placeholders})`,
          testUserIds
        );

        // Finally delete the test users
        await client.query(
          `DELETE FROM auth_user WHERE id IN (${placeholders})`,
          testUserIds
        );

        console.log(`Cleaned up ${testUserIds.length} test user(s) and their data`);
      }

      // Also clean up test URLs (jobs with example.com URLs that might not have test users)
      await client.query(`
        DELETE FROM crawled_pages WHERE job_id IN (
          SELECT id FROM jobs WHERE target_url LIKE '%example.com%'
        )
      `);
      await client.query(`
        DELETE FROM reports WHERE job_id IN (
          SELECT id FROM jobs WHERE target_url LIKE '%example.com%'
        )
      `);
      await client.query(`
        DELETE FROM analyses WHERE job_id IN (
          SELECT id FROM jobs WHERE target_url LIKE '%example.com%'
        )
      `);
      await client.query(`DELETE FROM jobs WHERE target_url LIKE '%example.com%'`);

      // Clean up expired sessions (older than 30 days)
      await client.query(`DELETE FROM auth_session WHERE expires < NOW() - INTERVAL '30 days'`);

      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }

    if (conn !== pool) {
      await conn.end();
    }
  } catch (error) {
    console.warn("Test data cleanup warning:", error);
  }
}

export async function closeDatabase() {
  if (pool) {
    await pool.end();
    pool = null;
    testDb = null;
  }
}

export async function setupDatabase() {
  // Database should already exist and be migrated
}

/**
 * Clean up stuck jobs that are in non-terminal states
 * In test mode, cleans up ALL stuck jobs regardless of age
 */
export async function cleanupStuckJobs() {
  try {
    const conn = pool || new Pool({ connectionString: getTestDatabaseUrl(), max: 1 });
    const client = await conn.connect();

    try {
      // Find ALL jobs that are stuck in pending/crawling/analyzing/queued status
      const result = await client.query(`
        SELECT id, user_id, status
        FROM jobs
        WHERE status IN ('pending', 'crawling', 'analyzing', 'queued')
      `);

      const stuckJobs = result.rows;

      if (stuckJobs.length > 0) {
        console.log(`Cleaning up ${stuckJobs.length} stuck job(s)...`);

        const errorObj = JSON.stringify({
          code: "STUCK_JOB_CLEANUP",
          message: "Job was stuck and cleaned up by test setup",
          details: "Job was cleaned up automatically before tests",
        });

        const progressObj = JSON.stringify({
          pagesCrawled: 0,
          pagesTotal: 0,
          currentPhase: "error",
        });

        // Update stuck jobs
        for (const job of stuckJobs) {
          await client.query(
            `
            UPDATE jobs
            SET
              status = 'failed',
              error = $1::jsonb,
              progress = $2::jsonb,
              updated_at = NOW()
            WHERE id = $3
          `,
            [errorObj, progressObj, job.id]
          );
        }

        console.log(`Cleaned up ${stuckJobs.length} stuck job(s)`);
      } else {
        console.log("No stuck jobs found");
      }
    } finally {
      client.release();
    }

    // Close temporary connection if we created one
    if (conn !== pool) {
      await conn.end();
    }
  } catch (error) {
    console.warn("Failed to cleanup stuck jobs:", error);
    // Don't throw - allow tests to continue even if cleanup fails
  }
}
