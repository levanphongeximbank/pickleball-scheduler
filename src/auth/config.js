/**
 * RBAC runtime config.
 * Mặc định tắt — app local-first hoạt động như cũ khi chưa có đăng nhập.
 * Bật qua VITE_RBAC_ENABLED=true hoặc authService.enableRbac().
 */
export const RBAC_STORAGE_KEY = "pickleball-rbac-v1";
export const AUTH_SESSION_KEY = "pickleball-auth-session-v1";

export function isRbacEnabledFromEnv() {
  return String(import.meta.env?.VITE_RBAC_ENABLED || "").toLowerCase() === "true";
}
