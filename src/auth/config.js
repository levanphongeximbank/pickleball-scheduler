/**
 * RBAC runtime config.
 * Local dev: mặc định tắt (workflow cũ). Set VITE_RBAC_ENABLED=true để test guard.
 * Production build: mặc định bật khi biến env không được set (deny-by-default).
 */
export const RBAC_STORAGE_KEY = "pickleball-rbac-v1";
export const AUTH_SESSION_KEY = "pickleball-auth-session-v1";

export function isRbacEnabledFromEnv() {
  const raw = import.meta.env?.VITE_RBAC_ENABLED;
  if (raw !== undefined && String(raw).trim() !== "") {
    return String(raw).toLowerCase() === "true";
  }
  return import.meta.env?.PROD === true;
}
