/**
 * Check if a job is stuck
 * 
 * Usage: tsx scripts/check-stuck-job.ts [jobId]
 */

import { getJobById } from '../src/lib/db';

const JOB_ID = process.argv[2] || '5e0f2457-5141-49b6-8d21-a60443d86264';

async function checkJob() {
  try {
    console.log(`Checking job: ${JOB_ID}\n`);
    
    const job = await getJobById(JOB_ID);
    if (!job) {
      console.log('❌ Job not found');
      return;
    }

    const now = new Date();
    const updatedAt = new Date(job.updatedAt);
    const createdAt = new Date(job.createdAt);
    const timeSinceUpdate = (now.getTime() - updatedAt.getTime()) / 1000 / 60; // minutes
    const totalTime = (now.getTime() - createdAt.getTime()) / 1000 / 60; // minutes

    const isStuck = 
      (job.status === 'analyzing' || job.status === 'crawling') &&
      timeSinceUpdate > 10 && // No update in 10+ minutes
      totalTime > 15; // Job running for 15+ minutes

    console.log('Job Status:');
    console.log(`  ID: ${job.id}`);
    console.log(`  Status: ${job.status}`);
    console.log(`  Current Phase: ${(job.progress as { currentPhase?: string })?.currentPhase || 'unknown'}`);
    console.log(`  Created: ${createdAt.toISOString()}`);
    console.log(`  Last Updated: ${updatedAt.toISOString()}`);
    console.log(`  Time since last update: ${timeSinceUpdate.toFixed(1)} minutes`);
    console.log(`  Total runtime: ${totalTime.toFixed(1)} minutes`);
    console.log(`  Is Stuck: ${isStuck ? '⚠️  YES' : '✅ NO'}`);
    
    if (isStuck) {
      console.log('\n⚠️  This job appears to be stuck!');
      console.log('Possible causes:');
      console.log('1. S3 upload timeout (check logs for ETIMEDOUT)');
      console.log('2. Agent execution hanging (check executor logs)');
      console.log('3. Network issues');
      console.log('\nConsider:');
      console.log('1. Checking logs for errors');
      console.log('2. Manually marking job as failed');
      console.log('3. Restarting the job');
    } else if (job.status === 'analyzing' || job.status === 'crawling') {
      console.log('\n✅ Job is still running (not stuck yet)');
      console.log(`   Last update was ${timeSinceUpdate.toFixed(1)} minutes ago`);
    } else if (job.status === 'completed') {
      console.log('\n✅ Job completed successfully');
    } else if (job.status === 'failed') {
      console.log('\n❌ Job failed');
    }
  } catch (error) {
    console.error('Error checking job:', error);
    process.exit(1);
  }
}

checkJob().then(() => process.exit(0)).catch((error) => {
  console.error(error);
  process.exit(1);
});

