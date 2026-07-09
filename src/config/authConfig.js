/** Auth feature flags & redirect helpers (Phase 19B). */

export const MIN_PASSWORD_LENGTH = 6;

/** Mật khẩu mặc định khi admin/super admin reset user trên Production. */
export const ADMIN_DEFAULT_RESET_PASSWORD = "123456789";

function readViteEnv(key) {
  const nodeEnv = typeof globalThis.process !== "undefined" ? globalThis.process.env : {};
  if (nodeEnv?.[key] !== undefined && String(nodeEnv[key]).trim()) {
    return String(nodeEnv[key]).trim();
  }
  if (typeof import.meta !== "undefined" && import.meta.env?.[key] !== undefined) {
    return import.meta.env[key];
  }
  return undefined;
}

/** Public self-service signup — default OFF until owner approves. */
export function isAuthSignupEnabled() {
  return readViteEnv("VITE_AUTH_SIGNUP_ENABLED") === "true";
}

/**
 * Origin for Supabase email links (signup confirm, password reset).
 * Uses current browser origin — never hard-code localhost on Production deploy.
 */
export function getAuthRedirectOrigin() {
  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin;
  }

  const configured = String(readViteEnv("VITE_APP_URL") || "").trim();
  return configured.replace(/\/$/, "");
}

export function getLoginRedirectUrl() {
  const origin = getAuthRedirectOrigin();
  return origin ? `${origin}/login` : "/login";
}

export function getResetPasswordRedirectUrl() {
  const origin = getAuthRedirectOrigin();
  return origin ? `${origin}/reset-password` : "/reset-password";
}
