import { isGlobalRole } from "../../../auth/roles.js";
import { loadActiveTenantId } from "../../../data/tenantSession.js";
import { resolveEffectiveTenantId } from "../../tenant/services/tenantService.js";

/**
 * Resolve the venue/tenant id used for Phase 9 billing (tenant_id === venues.id).
 * Never returns demo placeholders — null means caller must show a clear error.
 */
export function resolveBillingTenantId({
  user,
  tenantIdOverride,
  currentTenantId,
} = {}) {
  const override = String(tenantIdOverride || "").trim();
  if (override) {
    return override;
  }

  const fromContext = String(currentTenantId || "").trim();
  if (fromContext) {
    return fromContext;
  }

  const fromUser = resolveEffectiveTenantId(user);
  if (fromUser) {
    return fromUser;
  }

  if (user && isGlobalRole(user.role)) {
    const adminTenant = String(loadActiveTenantId() || "").trim();
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
