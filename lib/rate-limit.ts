/**
 * Simple in-memory rate limiter. Limits requests per IP per window.
 *
 * NOTE: This resets on server restart and doesn't work across multiple
 * Vercel serverless instances. Good enough for a wedding site with
 * ~130 guests. If we need distributed rate limiting later, swap to
 * Upstash Redis.
 */

const hitCounts = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(
  ip: string,
  maxRequests: number = 10,
  windowMs: number = 60_000
): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const entry = hitCounts.get(ip);

  if (!entry || now > entry.resetAt) {
    hitCounts.set(ip, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: maxRequests - 1 };
  }

  entry.count++;

  if (entry.count > maxRequests) {
    return { allowed: false, remaining: 0 };
  }

  return { allowed: true, remaining: maxRequests - entry.count };
}
