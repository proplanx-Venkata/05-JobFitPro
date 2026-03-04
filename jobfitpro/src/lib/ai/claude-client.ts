import Anthropic from "@anthropic-ai/sdk";

// Singleton client — one instance shared across all Claude lib functions
export const anthropic = new Anthropic(); // reads ANTHROPIC_API_KEY from env

/**
 * Wraps a Claude API call with exponential backoff retries.
 * Retries on 429 (rate limit) and 529 (API overloaded) only.
 * All other errors are re-thrown immediately.
 *
 * Delays: 1s → 2s → 4s (with ±200ms jitter). Max 3 retries.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 3
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const isRetryable =
        err instanceof Anthropic.RateLimitError ||
        (err instanceof Anthropic.APIError && err.status === 529);

      if (isRetryable && attempt < maxRetries) {
        lastError = err;
        const baseDelay = 1000 * 2 ** attempt; // 1s, 2s, 4s
        const jitter = Math.random() * 400 - 200; // ±200ms
        const delay = Math.min(baseDelay + jitter, 10_000);
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }

      throw err;
    }
  }

  throw lastError;
}
