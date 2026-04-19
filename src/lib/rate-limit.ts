/**
 * Minimal in-memory rate limiter. Good enough for a single-user local app.
 * For multi-user deployments, replace with Redis/Upstash.
 *
 * Usage:
 *   const { ok, retryAfter } = rateLimit("search:" + userId, 30, 60_000);
 */

interface Bucket {
  count: number;
  resetAt: number;
}
const buckets = new Map<string, Bucket>();

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number
): { ok: boolean; retryAfter: number; remaining: number } {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfter: 0, remaining: limit - 1 };
  }
  if (b.count >= limit) {
    return { ok: false, retryAfter: Math.max(0, b.resetAt - now), remaining: 0 };
  }
  b.count += 1;
  return { ok: true, retryAfter: 0, remaining: limit - b.count };
}
