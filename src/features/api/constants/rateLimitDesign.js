/**
 * Phase 11A — API rate limit design (not enforced until Phase 11B edge middleware).
 * Keys are scoped per tenant + api_client + window.
 */

export const RATE_LIMIT_WINDOWS = Object.freeze({
  MINUTE: 60,
  HOUR: 3600,
  DAY: 86400,
});

/** Default quotas when VITE_API_ENABLED=true (staging). */
export const DEFAULT_API_RATE_LIMITS = Object.freeze({
  requestsPerMinute: 120,
  requestsPerHour: 3_000,
  requestsPerDay: 30_000,
  burstAllowance: 20,
});

export const RATE_LIMIT_HEADER_NAMES = Object.freeze({
  LIMIT: "X-RateLimit-Limit",
  REMAINING: "X-RateLimit-Remaining",
  RESET: "X-RateLimit-Reset",
  RETRY_AFTER: "Retry-After",
});

/**
 * Storage key pattern for future Redis/Supabase counter:
 * ratelimit:{tenantId}:{clientId}:{windowBucket}
 */
export function buildRateLimitKey(tenantId, clientId, windowSeconds, bucketIndex) {
  return `ratelimit:${tenantId}:${clientId}:${windowSeconds}:${bucketIndex}`;
}
