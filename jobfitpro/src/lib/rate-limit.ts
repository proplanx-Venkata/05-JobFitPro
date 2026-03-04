import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { NextResponse } from "next/server";

// Rate limiter is only active when Upstash env vars are configured.
// Without them the helper is a no-op, so the app works in development
// and CI without any Redis instance.
function makeRateLimiter(requests: number, windowSeconds: number) {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;

  return new Ratelimit({
    redis: new Redis({ url, token }),
    limiter: Ratelimit.slidingWindow(requests, `${windowSeconds} s`),
    analytics: false,
  });
}

// Per-user limits on AI-heavy routes (sliding window)
const limiters = {
  // Resume upload triggers parse — 10/hour is generous
  upload: makeRateLimiter(10, 3600),
  // JD ingest triggers Claude clean — 10/hour
  jd: makeRateLimiter(10, 3600),
  // Rewrite is the most expensive call — 5/hour
  rewrite: makeRateLimiter(5, 3600),
  // Cover letter — 5/hour
  coverLetter: makeRateLimiter(5, 3600),
  // Interview turn — 60/hour (20 per session, up to 3 sessions/hour)
  interviewTurn: makeRateLimiter(60, 3600),
  // ATS score — 10/hour
  ats: makeRateLimiter(10, 3600),
  // Interview prep — 5/hour
  interviewPrep: makeRateLimiter(5, 3600),
} as const;

export type RateLimitKey = keyof typeof limiters;

/**
 * Checks the rate limit for a given user and route key.
 * Returns null if the request is allowed.
 * Returns a 429 NextResponse if the limit is exceeded.
 * No-ops (returns null) when Upstash is not configured.
 */
export async function checkRateLimit(
  userId: string,
  key: RateLimitKey
): Promise<NextResponse | null> {
  const limiter = limiters[key];
  if (!limiter) return null; // Upstash not configured — allow through

  const { success, limit, remaining, reset } = await limiter.limit(
    `${key}:${userId}`
  );

  if (!success) {
    const retryAfter = Math.ceil((reset - Date.now()) / 1000);
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      {
        status: 429,
        headers: {
          "X-RateLimit-Limit": String(limit),
          "X-RateLimit-Remaining": String(remaining),
          "Retry-After": String(retryAfter),
        },
      }
    );
  }

  return null;
}
