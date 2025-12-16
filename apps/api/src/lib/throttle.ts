/**
 * Throttling utility for LLM API calls
 *
 * Implements a semaphore-based throttling mechanism to limit
 * concurrent LLM API calls across all agents.
 */

export interface ThrottleConfig {
  maxConcurrent: number;
  queueTimeout?: number; // Max time to wait in queue (ms)
}

class LLMThrottle {
  private running = 0;
  private queue: Array<() => void> = [];

  constructor(private config: ThrottleConfig) {}

  async acquire(): Promise<void> {
    if (this.running < this.config.maxConcurrent) {
      this.running++;
      console.log(`[Throttle] Acquired immediately. Running: ${this.running}/${this.config.maxConcurrent}`);
      return;
    }

    // Wait in queue
    console.log(`[Throttle] Queueing request. Running: ${this.running}/${this.config.maxConcurrent}, Queue: ${this.queue.length}`);
    return new Promise((resolve, reject) => {
      let timeout: NodeJS.Timeout | null = null;

      const wrappedResolve = () => {
        if (timeout) clearTimeout(timeout);
        // Note: running++ is handled by the release() -> shift() flow
        resolve();
      };

      if (this.config.queueTimeout) {
        timeout = setTimeout(() => {
          // Find and remove from queue using wrappedResolve
          const index = this.queue.findIndex(fn => fn === wrappedResolve);
          if (index > -1) {
            this.queue.splice(index, 1);
            console.error(`[Throttle] Queue timeout after ${this.config.queueTimeout}ms. Queue: ${this.queue.length}`);
            reject(new Error(`Throttle queue timeout after ${this.config.queueTimeout}ms`));
          }
        }, this.config.queueTimeout);
      }

      this.queue.push(wrappedResolve);
    });
  }

  release(): void {
    const prevRunning = this.running;
    this.running--;

    if (this.queue.length > 0) {
      const next = this.queue.shift();
      if (next) {
        // Increment running count for the next queued request
        this.running++;
        console.log(`[Throttle] Released and started queued request. Running: ${prevRunning} -> ${this.running}, Queue: ${this.queue.length}`);
        next();
      }
    } else {
      console.log(`[Throttle] Released. Running: ${prevRunning} -> ${this.running}, Queue: empty`);
    }
  }

  async withThrottle<T>(fn: () => Promise<T>): Promise<T> {
    await this.acquire();
    try {
      return await fn();
    } finally {
      this.release();
    }
  }

  getStatus(): { running: number; queued: number } {
    return {
      running: this.running,
      queued: this.queue.length,
    };
  }
}

// Global throttle instance
const DEFAULT_CONFIG: ThrottleConfig = {
  maxConcurrent: parseInt(process.env.LLM_MAX_CONCURRENT || '3'),
  queueTimeout: 30000, // 30 seconds
};

export const llmThrottle = new LLMThrottle(DEFAULT_CONFIG);