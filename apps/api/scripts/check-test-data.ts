/**
 * Check test data in the database
 */

import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import { Pool } from "pg";

// Load environment variables
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

loadEnvFile(resolve(process.cwd(), "../../.env"));
loadEnvFile(resolve(process.cwd(), ".env"));

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 1
});

async function check() {
  const client = await pool.connect();
  try {
    // Count test users
    const users = await client.query(`
      SELECT id, email FROM auth_user
      WHERE email LIKE 'test-%' OR email LIKE '%@example.com'
      ORDER BY email
    `);
    console.log("Test users found:", users.rows.length);
    if (users.rows.length > 0) {
      console.log("Sample emails:", users.rows.slice(0, 10).map(r => r.email));
    }

    // Count test jobs
    const jobs = await client.query(`
      SELECT id, target_url, user_id FROM jobs
      WHERE target_url LIKE '%example.com%'
    `);
    console.log("\nTest jobs found:", jobs.rows.length);
    if (jobs.rows.length > 0) {
      console.log("Sample URLs:", jobs.rows.slice(0, 5).map(r => r.target_url));
    }

    // Count test sessions
    const sessions = await client.query(`
      SELECT COUNT(*) as count FROM auth_session s
      JOIN auth_user u ON s.user_id = u.id
      WHERE u.email LIKE 'test-%' OR u.email LIKE '%@example.com'
    `);
    console.log("\nTest sessions found:", sessions.rows[0].count);

    // Check for orphaned sessions (users that don't exist)
    const orphanedSessions = await client.query(`
      SELECT s.session_token, s.user_id
      FROM auth_session s
      LEFT JOIN auth_user u ON s.user_id = u.id
      WHERE u.id IS NULL
    `);
    console.log("\nOrphaned sessions (user deleted but session remains):", orphanedSessions.rows.length);

  } finally {
    client.release();
    await pool.end();
  }
}

check().catch(console.error);
