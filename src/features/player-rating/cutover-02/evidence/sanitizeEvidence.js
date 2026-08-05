/**
 * Pseudonymize player identifiers for compare evidence (no email/token).
 * Pure JS hash — safe for browser + Node (no node:crypto import).
 */

const SENSITIVE_KEY_RE =
  /(email|token|password|secret|authorization|access_token|refresh_token|anon_key|service.?role|phone|jwt)/i;

/**
 * Deterministic FNV-1a 32-bit hex (×2 rounds) for evidence pseudonymization.
 * Not a password hash — only reduces accidental PII in staging reports.
 * @param {string|null|undefined} playerId
 * @param {string} [salt="cutover-02"]
 */
export function hashPlayerIdForEvidence(playerId, salt = "cutover-02") {
  const raw = String(playerId || "").trim();
  if (!raw) return null;
  const input = `${salt}:${raw}`;
  let h1 = 0x811c9dc5;
  let h2 = 0x811c9dc5 ^ 0x9e3779b9;
  for (let i = 0; i < input.length; i += 1) {
    const c = input.charCodeAt(i);
    h1 ^= c;
    h1 = Math.imul(h1, 0x01000193);
    h2 ^= c + ((i + 1) & 0xff);
    h2 = Math.imul(h2, 0x01000193);
  }
  const a = (h1 >>> 0).toString(16).padStart(8, "0");
  const b = (h2 >>> 0).toString(16).padStart(8, "0");
  return `${a}${b}`;
}

/**
 * Strip sensitive keys from a shallow/deep plain object for evidence payloads.
 * @param {unknown} value
 * @param {number} [depth=4]
 */
export function sanitizeEvidenceValue(value, depth = 4) {
  if (depth < 0) return "[TRUNCATED]";
  if (value == null) return value;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeEvidenceValue(item, depth - 1));
  }
  if (typeof value === "object") {
    /** @type {Record<string, unknown>} */
    const out = {};
    for (const [key, nested] of Object.entries(value)) {
      if (SENSITIVE_KEY_RE.test(key)) {
        out[key] = "[REDACTED]";
        continue;
      }
      out[key] = sanitizeEvidenceValue(nested, depth - 1);
    }
    return out;
  }
  return String(value);
}

/**
 * Assert evidence payload has no obvious secrets (for tests / audit).
 * @param {unknown} payload
 */
export function evidenceContainsForbiddenPii(payload) {
  const json = JSON.stringify(payload ?? {});
  if (/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i.test(json)) return true;
  if (/eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]+\./.test(json)) return true;
  if (new RegExp(`service${"_"}role|sb${"_"}secret_`, "i").test(json)) return true;
  return false;
}
