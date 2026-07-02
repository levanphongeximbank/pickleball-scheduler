import { guardPermission } from "../../../auth/guardAction.js";
import { getCurrentUser, isRbacEnabled } from "../../../auth/authService.js";
import { PERMISSIONS } from "../../identity/constants/permissions.js";

/** RBAC gate — PLAYER and roles without api.manage cannot manage API keys. */
export function canManageApiKeys(user = getCurrentUser()) {
  if (!isRbacEnabled()) return { ok: true };
  if (!user) {
    return { ok: false, error: "Cần đăng nhập." };
  }

  const tenantId = user.venueId || user.tenantId || null;
  return guardPermission(PERMISSIONS.API_MANAGE, { venueId: tenantId, tenantId }, { user });
}
