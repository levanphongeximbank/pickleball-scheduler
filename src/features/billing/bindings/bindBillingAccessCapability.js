/**
 * Composition binding — Billing internals → Platform billing access capability.
 * TenantContext must not import billing repositories/runtime directly.
 */
import { bindBillingAccessCapability } from "../../../core/platform/app/billingAccessCapability.js";
import {
  assertSubscriptionOperational,
  runSubscriptionMaintenance,
} from "../bridges/subscriptionAccessBridge.js";
import {
  BILLING_STORE_MODES,
  getBillingStore,
  resolveBillingStoreMode,
} from "../repositories/billingRepository.js";
import {
  ensureBillingStoreHydrated,
  resetBillingStoreHydration,
} from "../repositories/billingStoreRuntime.js";
import { syncLegacySubscriptionsFromBilling } from "../../../domain/venueService.js";
import { isSubscriptionOperationalExemptRole } from "../guards/operationalRoutePolicy.js";

let bound = false;

async function ensureSessionReady({ rbacEnabled, isAuthenticated, userId } = {}) {
  if (
    resolveBillingStoreMode() === BILLING_STORE_MODES.SUPABASE &&
    rbacEnabled &&
    isAuthenticated &&
    userId
  ) {
    const store = getBillingStore();
    resetBillingStoreHydration(store);
    await ensureBillingStoreHydrated(store);
    syncLegacySubscriptionsFromBilling();
  }
  return { ok: true };
}

export function bindBillingAccessCapabilityFromModule() {
  if (bound) {
    return;
  }
  bindBillingAccessCapability({
    ensureSessionReady,
    runMaintenance: () => {
      runSubscriptionMaintenance();
    },
    assertOperational: (tenantId) => assertSubscriptionOperational(tenantId),
    isExemptRole: (user) => isSubscriptionOperationalExemptRole(user),
  });
  bound = true;
}
