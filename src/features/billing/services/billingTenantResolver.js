import { isGlobalRole } from "../../../auth/roles.js";
import { loadActiveTenantId } from "../../../data/tenantSession.js";
import { resolveEffectiveTenantId } from "../../tenant/services/tenantService.js";

/** Legacy/demo ids that must never be used for Supabase billing (venues.id). */
export const INVALID_BILLING_TENANT_IDS = Object.freeze([
  "tenant-demo",
  "tenant_demo",
  "demo-tenant",
]);

/**
 * Normalize tenant/venue id for billing. Returns null if empty or blocklisted.
 */
export function sanitizeBillingTenantId(value) {
  const id = String(value || "").trim();
  if (!id) {
    return null;
  }

  const lower = id.toLowerCase();
  if (INVALID_BILLING_TENANT_IDS.some((blocked) => blocked.toLowerCase() === lower)) {
    return null;
  }

  return id;
}

/**
 * Resolve the venue/tenant id used for Phase 9 billing (tenant_id === venues.id).
 * Never returns demo placeholders — null means caller must show a clear error.
 */
export function resolveBillingTenantId({
  user,
  tenantIdOverride,
  currentTenantId,
} = {}) {
  const override = sanitizeBillingTenantId(tenantIdOverride);
  if (override) {
    return override;
  }

  const fromContext = sanitizeBillingTenantId(currentTenantId);
  if (fromContext) {
    return fromContext;
  }

  const fromUser = sanitizeBillingTenantId(resolveEffectiveTenantId(user));
  if (fromUser) {
    return fromUser;
  }

  if (user && isGlobalRole(user.role)) {
    const adminTenant = sanitizeBillingTenantId(loadActiveTenantId());
    if (adminTenant) {
      return adminTenant;
    }
  }

  return null;
}

export function formatBillingTenantError({ code, message } = {}) {
  const normalized = String(message || code || "").toLowerCase();

  if (code === "TENANT_MISSING" || !code && !message) {
    return "Không tìm thấy tenant/venue hợp lệ cho user.";
  }

  if (normalized.includes("tenant_not_found")) {
    return "Tenant/venue không tồn tại trên Supabase — kiểm tra profiles.venue_id khớp venues.id.";
  }

  if (normalized.includes("tenant_required")) {
    return "Profile chưa gán venue_id — liên hệ SUPER_ADMIN để gán venue.";
  }

  if (normalized.includes("access_denied")) {
    return "Không có quyền tạo trial cho tenant này.";
  }

  if (code === "RPC_NOT_APPLIED") {
    return "Trial RPC chưa apply trên staging — apply docs/supabase-billing-phase9-trial-rpc.sql";
  }

  return message || "Không thể xử lý billing cho tenant hiện tại.";
}
