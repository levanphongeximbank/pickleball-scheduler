import {
  DEFAULT_API_RATE_LIMITS,
  RATE_LIMIT_HEADER_NAMES,
  RATE_LIMIT_WINDOWS,
  buildRateLimitKey,
} from "../constants/rateLimitDesign.js";

const counters = new Map();

function bucketIndex(nowMs, windowSeconds) {
  return Math.floor(nowMs / (windowSeconds * 1000));
}

function getCount(key) {
  return counters.get(key) || 0;
}

function increment(key) {
  const next = getCount(key) + 1;
  counters.set(key, next);
  return next;
}

export function resetRateLimitCounters() {
  counters.clear();
}

/**
 * Phase 11C — in-memory rate limit guard (staging/test foundation).
 * Production-scale enforcement deferred to Redis/Supabase counter store.
 */
export function checkRateLimit(
  { tenantId, clientId, limits = DEFAULT_API_RATE_LIMITS } = {},
  now = Date.now()
) {
  if (!tenantId || !clientId) {
    return { ok: true, headers: {} };
  }

  const minuteBucket = bucketIndex(now, RATE_LIMIT_WINDOWS.MINUTE);
  const minuteKey = buildRateLimitKey(
    tenantId,
    clientId,
    RATE_LIMIT_WINDOWS.MINUTE,
    minuteBucket
  );
  const envMinute = parseInt(
    String(globalThis.process?.env?.API_RATE_LIMIT_REQUESTS_PER_MINUTE || ""),
    10
  );
  const minuteLimit =
    limits.requestsPerMinute ??
    (Number.isFinite(envMinute) && envMinute > 0
      ? envMinute
      : DEFAULT_API_RATE_LIMITS.requestsPerMinute);
  const current = getCount(minuteKey);

  if (current >= minuteLimit) {
    const resetAt = (minuteBucket + 1) * RATE_LIMIT_WINDOWS.MINUTE * 1000;
    return {
      ok: false,
      statusCode: 429,
      code: "rate_limited",
      message: "Vượt giới hạn request theo phút.",
      headers: {
        [RATE_LIMIT_HEADER_NAMES.LIMIT]: String(minuteLimit),
        [RATE_LIMIT_HEADER_NAMES.REMAINING]: "0",
        [RATE_LIMIT_HEADER_NAMES.RESET]: String(Math.ceil(resetAt / 1000)),
        [RATE_LIMIT_HEADER_NAMES.RETRY_AFTER]: String(
          Math.max(1, Math.ceil((resetAt - now) / 1000))
        ),
      },
    };
  }

  const used = increment(minuteKey);
  const remaining = Math.max(0, minuteLimit - used);
  const resetAt = (minuteBucket + 1) * RATE_LIMIT_WINDOWS.MINUTE * 1000;

  return {
    ok: true,
    headers: {
      [RATE_LIMIT_HEADER_NAMES.LIMIT]: String(minuteLimit),
      [RATE_LIMIT_HEADER_NAMES.REMAINING]: String(remaining),
      [RATE_LIMIT_HEADER_NAMES.RESET]: String(Math.ceil(resetAt / 1000)),
    },
  };
}
