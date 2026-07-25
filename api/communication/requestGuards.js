/**
 * COMMS-ACT-06 — minimal request abuse guards for Communication hosts.
 * In-memory only (per serverless isolate). Not a substitute for edge WAF.
 */

const DEFAULT_MAX_BODY_BYTES = 32 * 1024; // 32 KiB
const DEFAULT_WINDOW_MS = 60_000;
const DEFAULT_MAX_REQUESTS = 60;
const textEncoder = new TextEncoder();

/** @type {Map<string, { count: number, resetAt: number }>} */
const buckets = new Map();

/**
 * @param {unknown} body
 * @returns {number}
 */
function measureBodyBytes(body) {
  if (body == null) return 0;
  if (typeof body === "string") return textEncoder.encode(body).byteLength;
  if (body instanceof Uint8Array) return body.byteLength;
  try {
    return textEncoder.encode(JSON.stringify(body)).byteLength;
  } catch {
    return -1;
  }
}

/**
 * @param {unknown} body
 * @param {{ maxBytes?: number }} [options]
 */
export function assertCommunicationRequestSize(body, options = {}) {
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BODY_BYTES;
  const size = measureBodyBytes(body);
  if (size < 0) {
    return {
      ok: false,
      code: "REQUEST_BODY_INVALID",
      error: "Không đọc được kích thước request body.",
    };
  }
  if (size > maxBytes) {
    return {
      ok: false,
      code: "REQUEST_BODY_TOO_LARGE",
      error: `Request body vượt giới hạn ${maxBytes} bytes.`,
    };
  }
  return { ok: true, bytes: size, maxBytes };
}

/**
 * @param {import('http').IncomingMessage} req
 * @param {{ windowMs?: number, maxRequests?: number, keyPrefix?: string }} [options]
 */
export function assertCommunicationRateLimit(req, options = {}) {
  const windowMs = options.windowMs ?? DEFAULT_WINDOW_MS;
  const maxRequests = options.maxRequests ?? DEFAULT_MAX_REQUESTS;
  const prefix = options.keyPrefix || "comms";
  const auth = String(req.headers?.authorization || "").slice(0, 48);
  const fwd = String(req.headers?.["x-forwarded-for"] || "")
    .split(",")[0]
    .trim();
  const key = `${prefix}:${fwd || "unknown"}:${auth || "anon"}`;
  const now = Date.now();
  let bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    bucket = { count: 0, resetAt: now + windowMs };
    buckets.set(key, bucket);
  }
  bucket.count += 1;
  if (bucket.count > maxRequests) {
    return {
      ok: false,
      code: "RATE_LIMITED",
      error: "Quá nhiều request Communication — thử lại sau.",
      retryAfterSec: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
    };
  }
  return {
    ok: true,
    remaining: Math.max(0, maxRequests - bucket.count),
    resetAt: bucket.resetAt,
  };
}

/** Test helper — clear isolate buckets. */
export function resetCommunicationRequestGuardState() {
  buckets.clear();
}
