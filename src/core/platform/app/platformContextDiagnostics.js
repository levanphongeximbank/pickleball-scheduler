/**
 * Wave 1 — Preview/dev-gated platform-context lifecycle diagnostics.
 * Never log tokens, passwords, secrets, or personal data.
 */

export const PLATFORM_CONTEXT_EVENT = Object.freeze({
  AUTH_BOOTSTRAP_START: "AUTH_BOOTSTRAP_START",
  AUTH_RESTORE_OK: "AUTH_RESTORE_OK",
  AUTH_SESSION_CLEAR: "AUTH_SESSION_CLEAR",
  TENANT_HINT_READ: "TENANT_HINT_READ",
  CLUB_HINT_READ: "CLUB_HINT_READ",
  CLUB_HINT_PENDING: "CLUB_HINT_PENDING",
  CLUB_AUTHORITY_READY: "CLUB_AUTHORITY_READY",
  CLUB_HINT_VALID: "CLUB_HINT_VALID",
  CLUB_HINT_INVALID: "CLUB_HINT_INVALID",
  CLUB_HINT_CLEARED: "CLUB_HINT_CLEARED",
  EXPLICIT_TENANT_SWITCH: "EXPLICIT_TENANT_SWITCH",
});

function isPlatformContextDebugEnabled() {
  const env = typeof import.meta !== "undefined" && import.meta.env ? import.meta.env : {};
  return Boolean(
    env.DEV ||
      env.VITE_ENABLE_PLATFORM_CONTEXT_DEBUG === "true" ||
      env.VITE_VERCEL_PREVIEW === "true"
  );
}

/**
 * @param {string} event
 * @param {Record<string, string|number|boolean|null|undefined>} [detail]
 */
export function logPlatformContextEvent(event, detail = {}) {
  if (!isPlatformContextDebugEnabled()) {
    return;
  }
  const safe = {};
  for (const [key, value] of Object.entries(detail || {})) {
    if (value == null || typeof value === "boolean" || typeof value === "number") {
      safe[key] = value;
      continue;
    }
    const text = String(value);
    // Ids only — truncate long values; never emit secrets-looking keys.
    if (/token|password|secret|email|phone/i.test(key)) {
      continue;
    }
    safe[key] = text.length > 64 ? `${text.slice(0, 12)}…` : text;
  }
  console.info(`[platform-context] ${event}`, safe);
}
