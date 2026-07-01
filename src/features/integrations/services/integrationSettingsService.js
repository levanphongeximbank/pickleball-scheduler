import { guardPermission } from "../../../auth/guardAction.js";
import { PERMISSIONS } from "../../identity/constants/permissions.js";
import { isRbacEnabled } from "../../../auth/authService.js";
import { ROLES, normalizeRole } from "../../identity/constants/roles.js";
import { getCurrentUser } from "../../../auth/authService.js";
import {
  getTenantIntegrationSettings,
  saveTenantIntegrationSettings,
} from "../storage/integrationStorage.js";
import {
  getIntegrationEnvConfig,
  getProviderStatus,
} from "../config/integrationFlags.js";

const INTEGRATION_ROLES = new Set([
  ROLES.SUPER_ADMIN,
  ROLES.COURT_OWNER,
  ROLES.CLUB_OWNER,
]);

export function canManageIntegrations(user = getCurrentUser()) {
  if (!isRbacEnabled()) return { ok: true };
  if (!user) {
    return { ok: false, error: "Cần đăng nhập." };
  }

  const role = normalizeRole(user.role);
  if (INTEGRATION_ROLES.has(role)) {
    return { ok: true };
  }

  const permCheck = guardPermission(PERMISSIONS.INTEGRATION_MANAGE);
  if (!permCheck.ok) {
    return { ok: false, error: "Không có quyền cấu hình tích hợp." };
  }
  return { ok: true };
}

export function getIntegrationOverview(tenantId) {
  const env = getIntegrationEnvConfig();
  const tenantSettings = getTenantIntegrationSettings(tenantId);

  return {
    tenantId,
    settings: tenantSettings,
    providers: {
      zalo: {
        status: tenantSettings.zaloEnabled ? "active" : "not_configured",
        configured: Boolean(tenantSettings.zaloConfig?.appId),
      },
      vnpay: {
        status: tenantSettings.vnpayEnabled
          ? getProviderStatus(env.vnpay)
          : "not_configured",
      },
      momo: {
        status: tenantSettings.momoEnabled
          ? getProviderStatus(env.momo)
          : "not_configured",
      },
      stripe: {
        status: tenantSettings.stripeEnabled
          ? getProviderStatus(env.stripe)
          : "not_configured",
      },
      email: {
        status: tenantSettings.emailEnabled
          ? getProviderStatus(env.email)
          : "not_configured",
      },
      sms: {
        status: tenantSettings.smsEnabled
          ? getProviderStatus(env.sms)
          : "not_configured",
      },
      mockPayment: {
        status: tenantSettings.mockPaymentEnabled ? "active" : "inactive",
      },
    },
    callbackUrls: {
      vnpay: env.vnpay.callbackUrl || "/api/v1/payments/vnpay/callback",
      momo: env.momo.callbackUrl || "/api/v1/payments/momo/callback",
      stripe: "/api/v1/payments/stripe/callback",
    },
  };
}

export function updateIntegrationSettings(tenantId, patch) {
  const access = canManageIntegrations();
  if (!access.ok) return access;
  const settings = saveTenantIntegrationSettings(tenantId, patch);
  return { ok: true, settings };
}

export function toggleIntegrationProvider(tenantId, provider, enabled) {
  const fieldMap = {
    vnpay: "vnpayEnabled",
    momo: "momoEnabled",
    stripe: "stripeEnabled",
    mock: "mockPaymentEnabled",
    zalo: "zaloEnabled",
    email: "emailEnabled",
    sms: "smsEnabled",
  };
  const field = fieldMap[provider];
  if (!field) {
    return { ok: false, error: "Provider không hợp lệ." };
  }
  return updateIntegrationSettings(tenantId, { [field]: Boolean(enabled) });
}
