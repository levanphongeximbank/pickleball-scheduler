/**
 * NEWS-03 — Secret redaction helpers (never log raw credentials).
 */

const SECRET_LIKE =
  /(service_role|access_token|bearer\s+[a-z0-9._-]+|eyJ[a-zA-Z0-9_-]{10,}|password|secret|apikey|api_key|postgres:\/\/[^\s"']+)/gi;

/**
 * @param {unknown} value
 * @returns {string}
 */
export function redactNews03SecretLike(value) {
  const text = value == null ? "" : String(value);
  return text.replace(SECRET_LIKE, "[REDACTED]");
}

/**
 * @param {unknown} err
 * @returns {string}
 */
export function redactNews03Error(err) {
  if (err == null) return "";
  if (typeof err === "string") return redactNews03SecretLike(err);
  const msg = err?.message || String(err);
  return redactNews03SecretLike(msg);
}

/**
 * Presence map only — never values.
 * @param {Record<string, string|undefined>} env
 * @param {string[]} keys
 */
export function news03EnvPresence(env, keys) {
  /** @type {Record<string, 'PRESENT'|'ABSENT'>} */
  const out = {};
  for (const key of keys) {
    const v = env[key];
    out[key] = v != null && String(v).trim() !== "" ? "PRESENT" : "ABSENT";
  }
  return Object.freeze(out);
}
