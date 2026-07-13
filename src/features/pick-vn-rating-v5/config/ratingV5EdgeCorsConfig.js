/**
 * Rating V5 Edge CORS — single configuration surface.
 * Production allowlist is set via RATING_V5_CORS_ORIGINS (comma-separated).
 * Canonical owner-confirmed list: docs/v5/rating-v5/V5-P1_PRODUCTION_CORS_ALLOWLIST.json
 */

export const RATING_V5_CORS_ENV_KEY = "RATING_V5_CORS_ORIGINS";

/** Substrings that must never appear in a Production allowlist. */
export const BLOCKED_CORS_MARKERS = [
  "__vercel_preview__",
  "__localhost_qa__",
];

/** Wildcard patterns forbidden on Production. */
export const BLOCKED_CORS_PATTERNS = [
  /^\*$/,
  /^https?:\/\/\*\.vercel\.app$/i,
  /^https?:\/\/\*$/i,
];

export function normalizeOrigin(origin) {
  return String(origin || "").trim().replace(/\/$/, "");
}

export function isBlockedCorsOrigin(origin) {
  const normalized = normalizeOrigin(origin);
  if (!normalized) return true;
  if (BLOCKED_CORS_MARKERS.some((marker) => normalized.includes(marker))) {
    return true;
  }
  return BLOCKED_CORS_PATTERNS.some((pattern) => pattern.test(normalized));
}

/**
 * Parse comma-separated env value into an allowlist.
 * Throws on wildcards or blocked QA/preview markers.
 */
export function parseRatingV5CorsAllowlist(envValue) {
  const raw = String(envValue ?? "").trim();
  if (!raw) return [];

  const origins = raw.split(",").map(normalizeOrigin).filter(Boolean);
  for (const origin of origins) {
    if (isBlockedCorsOrigin(origin)) {
      throw new Error(`rating_v5_cors_blocked_origin:${origin}`);
    }
  }
  return origins;
}

export function resolveRatingV5CorsAllowlistFromEnv(env = {}) {
  const fromKey = env[RATING_V5_CORS_ENV_KEY] ?? env.ratingV5CorsOrigins;
  if (typeof fromKey === "string" && fromKey.trim()) {
    return parseRatingV5CorsAllowlist(fromKey);
  }
  if (Array.isArray(env.allowedOrigins)) {
    return parseRatingV5CorsAllowlist(env.allowedOrigins.join(","));
  }
  return [];
}

export function isOriginAllowedForRatingV5(origin, allowedOrigins = []) {
  const normalized = normalizeOrigin(origin);
  if (!normalized || isBlockedCorsOrigin(normalized)) {
    return false;
  }
  const list = Array.isArray(allowedOrigins) ? allowedOrigins.map(normalizeOrigin) : [];
  if (list.length === 0) {
    return false;
  }
  return list.includes(normalized);
}
