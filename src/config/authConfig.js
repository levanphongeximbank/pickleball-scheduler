/** Auth feature flags & redirect helpers (Phase 19B). */

export const MIN_PASSWORD_LENGTH = 6;

function readViteEnv(key) {
  if (typeof import.meta === "undefined" || !import.meta.env) {
    return undefined;
  }
  return import.meta.env[key];
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
