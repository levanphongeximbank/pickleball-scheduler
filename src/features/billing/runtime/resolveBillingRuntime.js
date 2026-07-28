import {
  assertBillingLocalAuthorityAllowed,
  isPlatformHardCutoverEnabled,
} from "../../platform-hard-cutover/index.js";
import {
  BILLING_LEGACY_DEMO_BANNER,
  BILLING_MISSING_SCOPE_USER_MESSAGE,
  BILLING_RUNTIME_ERROR_CODE,
  BILLING_RUNTIME_MODE,
  BILLING_UNAVAILABLE_USER_MESSAGE,
} from "./constants.js";

export function resolveBillingRuntime({ env, tenantId, storeMode } = {}) {
  if (isPlatformHardCutoverEnabled(env)) {
    const blocked = assertBillingLocalAuthorityAllowed(env);
    return {
      mode: BILLING_RUNTIME_MODE.UNAVAILABLE,
      allowsWrites: false,
      allowsDemoMutations: false,
      isHardCutover: true,
      code: blocked.code || BILLING_RUNTIME_ERROR_CODE.AUTHORITY_UNAVAILABLE,
      message: BILLING_UNAVAILABLE_USER_MESSAGE,
      legacyBlocked: true,
      tenantId: tenantId || null,
      storeMode: storeMode || "unknown",
    };
  }

  if (!tenantId) {
    return {
      mode: BILLING_RUNTIME_MODE.MISSING_SCOPE,
      allowsWrites: false,
      allowsDemoMutations: false,
      isHardCutover: false,
      code: BILLING_RUNTIME_ERROR_CODE.TENANT_MISSING,
      message: BILLING_MISSING_SCOPE_USER_MESSAGE,
      legacyBlocked: false,
      tenantId: null,
      storeMode: storeMode || "unknown",
    };
  }

  if (storeMode === "local" || storeMode === "memory" || !storeMode) {
    return {
      mode: BILLING_RUNTIME_MODE.LEGACY_LOCAL,
      allowsWrites: true,
      allowsDemoMutations: true,
      isHardCutover: false,
      code: null,
      message: BILLING_LEGACY_DEMO_BANNER,
      legacyBlocked: false,
      tenantId,
      storeMode: storeMode || "local",
    };
  }

  return {
    mode: BILLING_RUNTIME_MODE.DURABLE,
    allowsWrites: true,
    allowsDemoMutations: false,
    isHardCutover: false,
    code: null,
    message: null,
    legacyBlocked: false,
    tenantId,
    storeMode,
  };
}
