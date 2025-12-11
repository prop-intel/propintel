import pg from 'pg';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const { Client } = pg;

// Load .env file manually
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const envPath = join(__dirname, '.env');

let DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  try {
    const envContent = readFileSync(envPath, 'utf-8');
    const envMatch = envContent.match(/DATABASE_URL=["']([^"']+)["']/);
    if (envMatch) {
      DATABASE_URL = envMatch[1].trim();
    }
  } catch (e) {
    console.error('❌ Could not read .env file:', e.message);
    process.exit(1);
  }
}

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL not found in .env file!');
  process.exit(1);
}

// Show which database we're connecting to (mask password)
const dbDisplay = DATABASE_URL.replace(/:[^:@]+@/, ':****@');
console.log(`\n🔗 Connecting to database: ${dbDisplay}\n`);

const client = new Client({
  connectionString: DATABASE_URL,
});

const USER_EMAIL = process.argv[2] || 'natalyscst@gmail.com';
const CLEAN_ALL = process.argv.includes('--all');

async function cleanUserJobs() {
  try {
    await client.connect();
    
    // List all users first to see what exists
    const allUsersResult = await client.query(`
      SELECT id, email, name 
      FROM auth_user 
      ORDER BY email
    `);
    console.log(`\nFound ${allUsersResult.rows.length} users in database:`);
    allUsersResult.rows.forEach((u, i) => {
      console.log(`  ${i + 1}. ${u.email} (${u.name || 'no name'}) - ID: ${u.id}`);
    });

    // Find user by email - try case insensitive
    let userResult = await client.query(`
      SELECT id, email, name 
      FROM auth_user 
      WHERE LOWER(email) = LOWER($1)
    `, [USER_EMAIL]);

    if (userResult.rows.length === 0) {
      console.log(`\n❌ User with email ${USER_EMAIL} not found`);
      
      // Check if there are any jobs and show their user info
      const jobsCheck = await client.query(`
        SELECT DISTINCT j.user_id, u.email, u.name, COUNT(*) as job_count
        FROM jobs j
        LEFT JOIN auth_user u ON j.user_id = u.id
        GROUP BY j.user_id, u.email, u.name
        ORDER BY job_count DESC
      `);
      
      if (jobsCheck.rows.length > 0) {
        console.log(`\nFound jobs for these users:`);
        jobsCheck.rows.forEach((row, i) => {
          console.log(`  ${i + 1}. ${row.email || 'Unknown'} (${row.name || 'no name'}) - ${row.job_count} jobs`);
        });
        console.log(`\n💡 Tip: Use one of the emails above, or provide a user ID directly`);
      }
      
      await client.end();
      return;
    }

    const user = userResult.rows[0];
    console.log(`\nFound user: ${user.name || user.email} (ID: ${user.id})\n`);

    // Get count of jobs before deletion (all time and today)
    const jobCountResult = await client.query(`
      SELECT 
        COUNT(*) as total_count,
        COUNT(*) FILTER (WHERE DATE(created_at) = CURRENT_DATE) as today_count
      FROM jobs 
      WHERE user_id = $1
    `, [user.id]);
    const totalCount = parseInt(jobCountResult.rows[0].total_count);
    const todayCount = parseInt(jobCountResult.rows[0].today_count);

    console.log(`📊 Job Statistics:`);
    console.log(`   Total jobs: ${totalCount}`);
    console.log(`   Jobs created today: ${todayCount}\n`);

    if (totalCount === 0) {
      console.log(`✅ No jobs found for this user`);
      await client.end();
      return;
    }

    // Show recent jobs
    const recentJobs = await client.query(`
      SELECT id, target_url, status, created_at 
      FROM jobs 
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT 10
    `, [user.id]);

    if (recentJobs.rows.length > 0) {
      console.log(`Recent jobs:`);
      recentJobs.rows.forEach((job, i) => {
        const isToday = new Date(job.created_at).toDateString() === new Date().toDateString();
        console.log(`  ${i + 1}. ${job.target_url} - ${job.status} (${job.created_at}) ${isToday ? '⭐ TODAY' : ''}`);
      });
      console.log('');
    }

    console.log(`Found ${totalCount} jobs to delete (${todayCount} from today)\n`);

    // Delete in order (respecting foreign key constraints)
    // 1. Delete crawled pages (references jobs)
    const pagesResult = await client.query(`
      DELETE FROM crawled_pages 
      WHERE job_id IN (SELECT id FROM jobs WHERE user_id = $1)
      RETURNING id
    `, [user.id]);
    console.log(`✅ Deleted ${pagesResult.rows.length} crawled pages`);

    // 2. Delete reports (references jobs)
    const reportsResult = await client.query(`
      DELETE FROM reports 
      WHERE job_id IN (SELECT id FROM jobs WHERE user_id = $1)
      RETURNING id
    `, [user.id]);
    console.log(`✅ Deleted ${reportsResult.rows.length} reports`);

    // 3. Delete analyses (references jobs)
    const analysesResult = await client.query(`
      DELETE FROM analyses 
      WHERE job_id IN (SELECT id FROM jobs WHERE user_id = $1)
      RETURNING id
    `, [user.id]);
    console.log(`✅ Deleted ${analysesResult.rows.length} analyses`);

    // 4. Delete jobs
    const jobsResult = await client.query(`
      DELETE FROM jobs 
      WHERE user_id = $1
      RETURNING id, target_url, status
    `, [user.id]);
    console.log(`✅ Deleted ${jobsResult.rows.length} jobs`);

    console.log(`\n🎉 Successfully cleaned all jobs for ${USER_EMAIL}`);
    console.log(`   Total jobs deleted: ${jobsResult.rows.length}`);
    console.log(`   Total pages deleted: ${pagesResult.rows.length}`);
    console.log(`   Total reports deleted: ${reportsResult.rows.length}`);
    console.log(`   Total analyses deleted: ${analysesResult.rows.length}\n`);

    await client.end();
  } catch (error) {
    console.error('❌ Error cleaning jobs:', error.message);
    await client.end();
    process.exit(1);
  }
}

cleanUserJobs();
