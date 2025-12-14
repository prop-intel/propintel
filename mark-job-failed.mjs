import pg from 'pg';
import { readFileSync } from 'fs';

const { Client } = pg;

// Load DATABASE_URL from .env
let DATABASE_URL;
try {
  const envContent = readFileSync('.env', 'utf-8');
  const envMatch = envContent.match(/DATABASE_URL=["']([^"']+)["']/);
  if (envMatch) DATABASE_URL = envMatch[1].trim();
} catch (e) {
  console.error('Could not read .env');
  process.exit(1);
}

const client = new Client({ connectionString: DATABASE_URL });

async function markFailed() {
  await client.connect();
  
  const jobId = '501ffd20-73b7-4e8c-ba6f-0f42643a65fb';
  const result = await client.query(
    `UPDATE jobs SET status = 'failed', error = 'Job stuck - manually cancelled' WHERE id = $1 AND status = 'analyzing' RETURNING id, status`,
    [jobId]
  );
  
  if (result.rowCount > 0) {
    console.log('✅ Marked job as failed:', result.rows[0].id);
  } else {
    console.log('Job not found or already not analyzing');
  }
  
  await client.end();
}

markFailed().catch(console.error);
