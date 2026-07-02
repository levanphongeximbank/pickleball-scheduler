import { getProviderStatus } from "../config/integrationFlags.js";
import { getIntegrationProvider } from "../constants/integrationRegistry.js";
import { INTEGRATION_STATUS } from "../constants/integrationStatus.js";

/**
 * Resolve tenant integration status (Phase 11A).
 * Does not perform network I/O.
 */
export function resolveProviderIntegrationStatus(providerId, options = {}) {
  const provider = getIntegrationProvider(providerId);
  if (!provider) {
    return INTEGRATION_STATUS.DISABLED;
  }

  const tenantEnabled = Boolean(options.tenantEnabled);
  const envConfig = options.envConfig || null;
  const hasTenantConfig = Boolean(options.hasTenantConfig);

  if (provider.mockOnly) {
    return tenantEnabled ? INTEGRATION_STATUS.MOCK_ONLY : INTEGRATION_STATUS.DISABLED;
  }

  if (!tenantEnabled) {
    return INTEGRATION_STATUS.DISABLED;
  }

  if (envConfig) {
    const envStatus = getProviderStatus(envConfig);
    if (envStatus === "error") {
      return INTEGRATION_STATUS.ERROR;
    }
    if (envStatus === "active") {
      return INTEGRATION_STATUS.CONFIGURED;
    }
  }

  if (hasTenantConfig) {
    return INTEGRATION_STATUS.CONFIGURED;
  }

  return INTEGRATION_STATUS.DISABLED;
}

export function buildProviderStatusMap(tenantSettings, envConfig) {
  const providers = {};
  for (const providerId of ["zalo", "email", "sms", "vnpay", "momo", "stripe", "mock_payment"]) {
    const meta = getIntegrationProvider(providerId);
    if (!meta) continue;

    const tenantEnabled = Boolean(tenantSettings?.[meta.tenantField]);
    const envSlice = meta.envConfigKey ? envConfig?.[meta.envConfigKey] : null;
    const hasTenantConfig =
      providerId === "zalo" ? Boolean(tenantSettings?.zaloConfig?.appId) : false;

    providers[providerId === "mock_payment" ? "mockPayment" : providerId] = {
      status: resolveProviderIntegrationStatus(providerId, {
        tenantEnabled,
        envConfig: envSlice,
        hasTenantConfig,
      }),
      configured: tenantEnabled,
    };
  }
  return providers;
}
