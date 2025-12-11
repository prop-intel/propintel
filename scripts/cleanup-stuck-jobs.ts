#!/usr/bin/env ts-node

/**
 * Manual script to clean up stuck jobs
 * Usage: npm run cleanup:jobs
 *        or: ts-node scripts/cleanup-stuck-jobs.ts
 */

import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { eq } from 'drizzle-orm';
import * as schema from '../shared/db/schema';

// Load env files
function loadEnvFile(filePath: string) {
  if (!existsSync(filePath)) return;
  const envContent = readFileSync(filePath, 'utf-8');
  envContent.split('\n').forEach((line) => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const match = trimmed.match(/^([^=]+)=(.*)$/);
      if (match && match[1] && match[2] !== undefined) {
        const key = match[1];
        const value = match[2].replace(/^["']|["']$/g, '');
        if (!process.env[key]) {
          process.env[key] = value;
        }
      }
    }
  });
}

loadEnvFile(resolve(process.cwd(), '.env'));
loadEnvFile(resolve(process.cwd(), 'backend/.env'));

const DATABASE_URL = process.env.DATABASE_URL || process.env.TEST_DATABASE_URL || 'postgresql://postgres:password@localhost:5432/propintel_test';

async function cleanupStuckJobs() {
  console.log('🧹 Cleaning up stuck jobs...\n');
  console.log(`Database: ${DATABASE_URL.replace(/:[^:@]+@/, ':****@')}\n`);

  const connection = postgres(DATABASE_URL, { max: 1 });
  const db = drizzle(connection, { schema });

  try {
    // Find all jobs in non-terminal states
    const stuckJobs = await connection`
      SELECT id, user_id, status, updated_at, created_at
      FROM jobs 
      WHERE status IN ('pending', 'crawling', 'analyzing', 'queued')
      ORDER BY updated_at ASC
    `;

    if (stuckJobs.length === 0) {
      console.log('✅ No stuck jobs found!');
      return;
    }

    console.log(`Found ${stuckJobs.length} stuck job(s):\n`);
    stuckJobs.forEach((job, index) => {
      console.log(`  ${index + 1}. Job ${job.id}`);
      console.log(`     Status: ${job.status}`);
      console.log(`     User: ${job.user_id}`);
      console.log(`     Created: ${job.created_at}`);
      console.log(`     Updated: ${job.updated_at}\n`);
    });

    // Update all stuck jobs to failed
    for (const job of stuckJobs) {
      await db.update(schema.jobs)
        .set({
          status: 'failed',
          error: {
            code: 'MANUAL_CLEANUP',
            message: 'Job was manually cleaned up',
            details: `Job was in ${job.status} status and cleaned up manually`,
          },
          updatedAt: new Date(),
          progress: {
            pagesCrawled: 0,
            pagesTotal: 0,
            currentPhase: 'error',
          },
        })
        .where(eq(schema.jobs.id, job.id));
    }

    console.log(`✅ Successfully cleaned up ${stuckJobs.length} stuck job(s)!`);
  } catch (error) {
    console.error('❌ Error cleaning up stuck jobs:', error);
    throw error;
  } finally {
    await connection.end();
  }
}

cleanupStuckJobs()
  .then(() => {
    console.log('\n✨ Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Failed:', error);
    process.exit(1);
  });
