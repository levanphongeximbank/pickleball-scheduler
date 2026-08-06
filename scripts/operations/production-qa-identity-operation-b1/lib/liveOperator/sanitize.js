/**
 * Sanitize errors/logs — never echo secret material.
 */

const SECRETISH =
  /(service_role|secret[_-]?key|eyJ[A-Za-z0-9_-]{20,}|sb_secret_|Bearer\s+[A-Za-z0-9._-]+)/gi;

export function redactSecrets(value) {
  if (value == null) return value;
  if (typeof value === "string") {
    return value.replace(SECRETISH, "[REDACTED]");
  }
  if (typeof value === "object") {
    try {
      return JSON.parse(
        JSON.stringify(value).replace(SECRETISH, "[REDACTED]")
      );
    } catch {
      return "[REDACTED_OBJECT]";
    }
  }
  return value;
}

export function sanitizeError(err) {
  const message = redactSecrets(String(err?.message || err || "unknown_error"));
  return { ok: false, reason: message };
}
