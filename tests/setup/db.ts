import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { eq, inArray, lt } from 'drizzle-orm';
import * as schema from '../../shared/db/schema';

// Get DATABASE_URL with proper fallback - ensure it has credentials
function getTestDatabaseUrl(): string {
  const url = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/propintel_test';
  
  // If URL doesn't have credentials, add default ones
  if (!url.includes('@') || url.startsWith('postgresql://localhost') || url.startsWith('postgresql://127.0.0.1')) {
    return 'postgresql://postgres:password@localhost:5432/propintel_test';
  }
  
  return url;
}

let connection: postgres.Sql | null = null;
let testDb: ReturnType<typeof drizzle> | null = null;
let currentDatabaseUrl: string | null = null;

export function getTestDb() {
  const databaseUrl = getTestDatabaseUrl();
  
  // Recreate connection if URL changed or doesn't exist
  if (!connection || currentDatabaseUrl !== databaseUrl) {
    if (connection) {
      connection.end().catch(() => {});
    }
    currentDatabaseUrl = databaseUrl;
    connection = postgres(databaseUrl, {
      max: 1,
    });
    testDb = drizzle(connection, { schema });
  }
  
  return testDb!;
}

export async function cleanupDatabase() {
  try {
    const conn = connection || postgres(getTestDatabaseUrl(), { max: 1 });
    
    // Use a single transaction to avoid deadlocks and ensure atomic cleanup
    await conn.begin(async (sql) => {
      // Delete in dependency order to avoid foreign key issues
      await sql`DELETE FROM crawled_pages`;
      await sql`DELETE FROM reports`;
      await sql`DELETE FROM analyses`;
      await sql`DELETE FROM jobs`;
      await sql`DELETE FROM crawler_visits`;
      await sql`DELETE FROM site_urls`;
      await sql`DELETE FROM sites`;
      await sql`DELETE FROM auth_session`;
      await sql`DELETE FROM auth_account`;
      await sql`DELETE FROM auth_verification_token`;
      await sql`DELETE FROM auth_user`;
    });
    
    if (conn !== connection) {
      await conn.end();
    }
  } catch (error) {
    // Ignore deadlock errors - they're expected in parallel test execution
    if (error && typeof error === 'object' && 'code' in error && error.code === '40P01') {
      // Deadlock detected - this is OK, just retry once
      try {
        const conn = connection || postgres(getTestDatabaseUrl(), { max: 1 });
        await conn.begin(async (sql) => {
          await sql`DELETE FROM crawled_pages`;
          await sql`DELETE FROM reports`;
          await sql`DELETE FROM analyses`;
          await sql`DELETE FROM jobs`;
          await sql`DELETE FROM crawler_visits`;
          await sql`DELETE FROM site_urls`;
          await sql`DELETE FROM sites`;
          await sql`DELETE FROM auth_session`;
          await sql`DELETE FROM auth_account`;
          await sql`DELETE FROM auth_verification_token`;
          await sql`DELETE FROM auth_user`;
        });
        if (conn !== connection) {
          await conn.end();
        }
      } catch (retryError) {
        console.warn('Database cleanup warning (after retry):', retryError);
      }
    } else {
      console.warn('Database cleanup warning:', error);
    }
  }
}

export async function closeDatabase() {
  if (connection) {
    await connection.end();
    connection = null;
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
    // Ensure connection is established with correct credentials
    const db = getTestDb();
    const conn = connection || postgres(getTestDatabaseUrl(), { max: 1 });
    
    // Find ALL jobs that are stuck in pending/crawling/analyzing/queued status
    // In test mode, we clean up all stuck jobs regardless of age
    const stuckJobs = await conn`
      SELECT id, user_id, status 
      FROM jobs 
      WHERE status IN ('pending', 'crawling', 'analyzing', 'queued')
    `;

    if (stuckJobs.length > 0) {
      console.log(`🧹 Cleaning up ${stuckJobs.length} stuck job(s)...`);
      
      const errorObj = JSON.stringify({
        code: 'STUCK_JOB_CLEANUP',
        message: 'Job was stuck and cleaned up by test setup',
        details: 'Job was cleaned up automatically before tests',
      });
      
      const progressObj = JSON.stringify({
        pagesCrawled: 0,
        pagesTotal: 0,
        currentPhase: 'error',
      });

      // Use direct SQL for reliability
      for (const job of stuckJobs) {
        await conn`
          UPDATE jobs 
          SET 
            status = 'failed',
            error = ${errorObj}::jsonb,
            progress = ${progressObj}::jsonb,
            updated_at = NOW()
          WHERE id = ${job.id}
        `;
      }
      
      console.log(`✅ Cleaned up ${stuckJobs.length} stuck job(s)`);
    } else {
      console.log('✅ No stuck jobs found');
    }
    
    // Close temporary connection if we created one
    if (conn !== connection) {
      await conn.end();
    }
  } catch (error) {
    console.warn('Failed to cleanup stuck jobs:', error);
    // Don't throw - allow tests to continue even if cleanup fails
  }
}
