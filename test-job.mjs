import http from 'http';

const API_URL = 'http://localhost:4000';
const API_KEY = 'propintel-dev-key-2024';
const USER_ID = '00000000-0000-0000-0000-000000000001';
const TARGET_URL = 'https://gauntlet.ai';

async function request(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, API_URL);
    const options = {
      method,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
      },
    };
    
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, data });
        }
      });
    });
    
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function main() {
  console.log('🚀 Creating job for:', TARGET_URL);
  
  // Create job
  const createRes = await request('POST', '/jobs', {
    targetUrl: TARGET_URL,
    userId: USER_ID,
    config: { maxPages: 5, maxDepth: 2 }
  });
  
  if (!createRes.data.success) {
    console.error('❌ Failed to create job:', createRes.data);
    process.exit(1);
  }
  
  const jobId = createRes.data.data.job.id;
  console.log('✅ Job created:', jobId);
  
  // Poll for status
  let lastStatus = '';
  let lastPhase = '';
  const startTime = Date.now();
  const timeout = 5 * 60 * 1000; // 5 minutes
  
  while (Date.now() - startTime < timeout) {
    const statusRes = await request('GET', `/jobs/${jobId}`);
    const job = statusRes.data.data?.job;
    
    if (!job) {
      console.log('⏳ Waiting for job data...');
      await new Promise(r => setTimeout(r, 3000));
      continue;
    }
    
    const status = job.status;
    const phase = job.progress?.currentPhase || 'unknown';
    
    if (status !== lastStatus || phase !== lastPhase) {
      const elapsed = Math.round((Date.now() - startTime) / 1000);
      console.log(`[${elapsed}s] Status: ${status} | Phase: ${phase}`);
      lastStatus = status;
      lastPhase = phase;
    }
    
    if (status === 'completed') {
      console.log('✅ Job completed successfully!');
      console.log('📊 Final metrics:', JSON.stringify(job.metrics, null, 2));
      process.exit(0);
    }
    
    if (status === 'failed') {
      console.log('❌ Job failed:', job.error);
      process.exit(1);
    }
    
    await new Promise(r => setTimeout(r, 3000));
  }
  
  console.log('⏰ Timeout waiting for job');
  process.exit(1);
}

main().catch(e => { console.error(e); process.exit(1); });
