import { guardPermission } from "../../../auth/guardAction.js";
import { PERMISSIONS } from "../../identity/constants/permissions.js";
import { isRbacEnabled } from "../../../auth/authService.js";
import { getCurrentUser } from "../../../auth/authService.js";
import {
  getTenantIntegrationSettings,
  saveTenantIntegrationSettings,
} from "../storage/integrationStorage.js";
import { getIntegrationEnvConfig } from "../config/integrationFlags.js";
import { buildProviderStatusMap } from "./integrationStatusService.js";
import {
  ensureIntegrationStoreHydrated,
  getIntegrationStore,
  persistIntegrationTenantSettings,
} from "../repositories/integrationStoreRuntime.js";

export function canManageIntegrations(user = getCurrentUser()) {
  if (!isRbacEnabled()) return { ok: true };
  if (!user) {
    return { ok: false, error: "Cần đăng nhập." };
  }

  const tenantId = user.venueId || user.tenantId || null;
  return guardPermission(
    PERMISSIONS.INTEGRATION_MANAGE,
    { venueId: tenantId, tenantId },
    { user }
  );
}

export async function hydrateIntegrationSettings(tenantId) {
  if (!tenantId) {
    return { ok: false, error: "tenantId required" };
  }
  const store = getIntegrationStore();
  return ensureIntegrationStoreHydrated(store, { tenantId });
}

export function getIntegrationOverview(tenantId) {
  const env = getIntegrationEnvConfig();
  const tenantSettings = getTenantIntegrationSettings(tenantId);

  return {
    tenantId,
    settings: tenantSettings,
    providers: buildProviderStatusMap(tenantSettings, env),
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
  const user = getCurrentUser();
  void persistIntegrationTenantSettings(getIntegrationStore(), tenantId, {
    updatedBy: user?.id || null,
  });
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
