export interface RetryOptions {
  maxRetries: number;
  baseDelayMs: number;
  shouldRetry?: (error: unknown) => boolean;
}

const defaults: RetryOptions = {
  maxRetries: 3,
  baseDelayMs: 500,
};

/** Retry an async function with exponential backoff (500ms, 1s, 2s, …). */
export async function withRetry<T>(
  fn: () => Promise<T>,
  opts?: Partial<RetryOptions>,
): Promise<T> {
  const { maxRetries, baseDelayMs, shouldRetry } = { ...defaults, ...opts };

  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (shouldRetry && !shouldRetry(err)) throw err;
      if (attempt === maxRetries) break;
      await sleep(baseDelayMs * 2 ** attempt);
    }
  }
  throw lastError;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
