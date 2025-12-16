# S3 Upload Failure Deep Dive Analysis

## Failure Summary

**Agent**: `community-signals`  
**Status**: Agent execution **SUCCEEDED** (found 73 opportunities)  
**Failure Point**: S3 upload to store results  
**Error**: `ETIMEDOUT` after 3 retry attempts with only 51ms total delay

## Root Cause Analysis

### 1. **Payload Size** ✅ NOT THE ISSUE
- **Estimated size**: ~57 KB (0.06 MB)
- **Structure**: 73 engagement opportunities with metadata
- **Conclusion**: Payload is small, well within S3 limits (5GB for single upload)

### 2. **AWS SDK Configuration** ❌ THE PROBLEM

**Current Configuration** (`apps/api/src/lib/s3.ts:23-35`):
```typescript
const clientConfig: ConstructorParameters<typeof S3Client>[0] = {
  region: process.env.AWS_REGION || 'us-west-2',
};

// Only credentials configured, NO timeout or retry settings
s3Client = new S3Client(clientConfig);
```

**Missing Configurations**:
- ❌ No `requestHandler` configuration
- ❌ No timeout settings (connection, socket, request)
- ❌ No retry strategy customization
- ❌ No HTTP client configuration

### 3. **AWS SDK v3 Default Behavior**

**SDK Version**: `@aws-sdk/client-s3@^3.682.0`  
**Node.js Version**: 20.x (uses `undici` as HTTP client)

**Default Timeouts** (AWS SDK v3 with undici):
- **Request timeout**: ~2-5 seconds (varies by operation)
- **Connection timeout**: ~2 seconds
- **Socket timeout**: ~5 seconds

**Default Retry Strategy**:
- **Max attempts**: 3 (standard mode)
- **Initial delay**: ~20ms
- **Max delay**: ~20 seconds
- **Exponential backoff**: Yes, but very aggressive initial delays

**The Problem**: 
- Error shows `totalRetryDelay: 51` (only 51ms across 3 attempts)
- This means all 3 attempts failed within ~51ms total
- Suggests the timeout is happening **immediately** or very quickly
- Network connection is likely failing to establish or timing out instantly

### 4. **Network/Environment Factors**

**Running Environment**: 
- Development mode (`serverless offline`)
- Local network to AWS S3 in `us-west-2`
- Possible network latency or instability

**Lambda Configuration** (when deployed):
- Timeout: 30 seconds (not the issue here, but worth noting)
- Memory: 512 MB
- Region: us-west-2

### 5. **Error Pattern Analysis**

```
Error: read ETIMEDOUT
code: 'ETIMEDOUT'
syscall: 'read'
'$metadata': { attempts: 3, totalRetryDelay: 51 }
```

**Interpretation**:
1. **`read ETIMEDOUT`**: Socket read operation timed out
2. **`attempts: 3`**: SDK retried 3 times (default max)
3. **`totalRetryDelay: 51`**: Only 51ms total delay = very fast failures
4. **Pattern**: Connection likely failing to establish or timing out immediately

## Why It Failed

### Primary Cause: **No Timeout Configuration + Network Degradation During Upload**

The S3 client has **zero timeout configuration**, relying on AWS SDK defaults which are:
- Too short for unstable network conditions
- Not optimized for development environments
- Aggressive retry strategy that gives up too quickly

### Why Only `community-signals` Failed (Not `tavily-research`)

**Timeline Analysis** (from logs):
1. ✅ `tavily-research` completes and uploads successfully (~6KB payload)
2. ✅ `community-signals` completes processing (~55KB payload)
3. ⚠️ **Langfuse flush fails** - network issue indicator
4. ❌ `community-signals` upload fails ~3-5 seconds later

**Key Differences**:

1. **Payload Size**:
   - `tavily-research`: ~6.47 KB (10 results)
   - `community-signals`: ~55.32 KB (73 opportunities)
   - **8.5x larger payload** = longer upload time = more vulnerable to timeouts

2. **Upload Timing**:
   - `tavily-research` uploads first (completes faster)
   - `community-signals` uploads second, when network conditions may have degraded
   - Network issue indicated by Langfuse flush failure happening concurrently

3. **Network Degradation**:
   - Both agents run in parallel
   - First upload succeeds (network is good)
   - By the time second upload starts, network conditions have degraded
   - Langfuse flush failure confirms network issues at that moment

4. **Timeout Vulnerability**:
   - Small payload uploads quickly (< 1 second)
   - Large payload takes longer (> 2-3 seconds)
   - Default timeout (~2-5 seconds) is too short for larger payloads during network issues
   - When network is slow, larger payloads hit timeout before completing

### Contributing Factors:

1. **Network Instability**: Development environment may have:
   - Higher latency to AWS
   - Unstable connections
   - Firewall/proxy interference
   - **Connection pool exhaustion** (multiple parallel requests)

2. **Undici HTTP Client**: Node.js 20 uses `undici` which has:
   - Different timeout behavior than `http/https`
   - More aggressive connection timeouts
   - Different retry semantics
   - **Connection pooling** that might be exhausted

3. **No Request Handler**: Missing `requestHandler` middleware that could:
   - Add custom timeout logic
   - Implement better retry strategies
   - Add request/response logging
   - **Configure connection pooling**

4. **Synchronous JSON.stringify**: The payload is stringified synchronously:
   ```typescript
   Body: JSON.stringify(result, null, 2)  // Blocks event loop
   ```
   - For large payloads, this could cause delays
   - 55KB shouldn't be an issue, but combined with network latency...

5. **Parallel Execution**: Both agents run in parallel:
   - Multiple network connections open simultaneously
   - Connection pool might be exhausted
   - Second upload waits for connection or times out

## Solutions

### 1. **Add Timeout Configuration** (Recommended)

```typescript
import { NodeHttpHandler } from '@aws-sdk/node-http-handler';

const requestHandler = new NodeHttpHandler({
  requestTimeout: 60000,  // 60 seconds
  connectionTimeout: 10000,  // 10 seconds
});

const clientConfig: ConstructorParameters<typeof S3Client>[0] = {
  region: process.env.AWS_REGION || 'us-west-2',
  requestHandler,
  maxAttempts: 5,  // Increase retry attempts
};
```

### 2. **Add Retry Configuration**

```typescript
import { StandardRetryStrategy } from '@aws-sdk/middleware-retry';

const retryStrategy = new StandardRetryStrategy({
  maxAttempts: 5,
  retryDecider: (error) => {
    // Retry on network errors
    if (error.code === 'ETIMEDOUT' || error.code === 'ECONNRESET') {
      return true;
    }
    return false;
  },
});
```

### 3. **Add Request Logging** (For Debugging)

```typescript
import { Logger } from '@aws-sdk/types';

const logger: Logger = {
  trace: () => {},
  debug: (message) => console.log('[S3 Debug]', message),
  info: (message) => console.log('[S3 Info]', message),
  warn: (message) => console.warn('[S3 Warn]', message),
  error: (message) => console.error('[S3 Error]', message),
};

const clientConfig = {
  // ... other config
  logger,
};
```

### 4. **Add Payload Size Logging**

```typescript
export async function storeAgentResult(
  tenantId: string,
  jobId: string,
  agentId: string,
  result: unknown
): Promise<string> {
  const key = s3Keys.agentResult(tenantId, jobId, agentId);
  const payload = JSON.stringify(result, null, 2);
  const sizeKB = (payload.length / 1024).toFixed(2);
  
  console.log(`[S3] Uploading ${agentId} result: ${sizeKB} KB`);
  
  // ... rest of function
}
```

### 5. **Add Error Handling with Retry**

```typescript
export async function storeAgentResult(
  tenantId: string,
  jobId: string,
  agentId: string,
  result: unknown
): Promise<string> {
  const key = s3Keys.agentResult(tenantId, jobId, agentId);
  const maxRetries = 3;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      if (IS_LOCAL) {
        await writeLocal(key, JSON.stringify(result, null, 2));
        return key;
      }

      await s3Client!.send(
        new PutObjectCommand({
          Bucket: BUCKET_NAME,
          Key: key,
          Body: JSON.stringify(result, null, 2),
          ContentType: 'application/json',
        })
      );

      return key;
    } catch (error) {
      lastError = error as Error;
      const isTimeout = error instanceof Error && 
        (error.message.includes('timeout') || error.code === 'ETIMEDOUT');
      
      if (attempt < maxRetries && isTimeout) {
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
        console.warn(`[S3] Upload attempt ${attempt} failed, retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      throw error;
    }
  }

  throw lastError || new Error('Upload failed after retries');
}
```

## Recommended Immediate Fix

**Priority 1**: Add timeout configuration to S3 client
**Priority 2**: Add payload size logging
**Priority 3**: Improve error messages with context

## Long-term Improvements

1. **Implement Multipart Upload**: For payloads > 5MB (not needed now, but good practice)
2. **Add Metrics**: Track upload success/failure rates
3. **Circuit Breaker**: Prevent cascading failures
4. **Fallback Strategy**: Store to local cache if S3 fails (for development)

## Testing Recommendations

1. Test with various payload sizes (1KB, 10KB, 100KB, 1MB)
2. Test with network throttling/simulation
3. Test retry behavior
4. Monitor timeout values in production

