/**
 * Rate Limiter for RPC Calls
 * Prevents rate limiting by throttling requests
 */

class RateLimiter {
  private queue: Array<() => Promise<any>> = [];
  private processing = false;
  private lastRequestTime = 0;
  private minDelay = 200; // Minimum 200ms between requests
  private maxConcurrent = 3; // Max 3 concurrent requests
  private activeRequests = 0;

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          const result = await fn();
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });

      this.processQueue();
    });
  }

  private async processQueue() {
    if (this.processing || this.activeRequests >= this.maxConcurrent) {
      return;
    }

    if (this.queue.length === 0) {
      return;
    }

    this.processing = true;

    while (this.queue.length > 0 && this.activeRequests < this.maxConcurrent) {
      const now = Date.now();
      const timeSinceLastRequest = now - this.lastRequestTime;

      if (timeSinceLastRequest < this.minDelay) {
        await this.delay(this.minDelay - timeSinceLastRequest);
      }

      const task = this.queue.shift();
      if (task) {
        this.activeRequests++;
        this.lastRequestTime = Date.now();

        task()
          .finally(() => {
            this.activeRequests--;
            this.processQueue();
          });
      }
    }

    this.processing = false;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export const rpcRateLimiter = new RateLimiter();

/**
 * Retry function with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  initialDelay: number = 1000
): Promise<T> {
  let lastError: any;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;

      // Don't retry on certain errors
      if (error.code === 'BAD_DATA' || error.code === 'INVALID_ARGUMENT') {
        throw error;
      }

      // Check if it's a rate limit error
      const isRateLimit = 
        error.code === -32029 ||
        error.message?.includes('Rate limited') ||
        error.message?.includes('rate limit') ||
        error.message?.includes('too many requests');

      if (isRateLimit && attempt < maxRetries - 1) {
        const delay = initialDelay * Math.pow(2, attempt);
        console.warn(`Rate limited, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }

      // If not rate limit or last attempt, throw
      if (!isRateLimit || attempt === maxRetries - 1) {
        throw error;
      }
    }
  }

  throw lastError;
}

