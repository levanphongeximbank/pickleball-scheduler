/**
 * Platform-owned Billing Access capability (Wave 2).
 *
 * TenantContext consumes only this contract for subscription/access semantics.
 * Billing module binds the implementation at the composition root.
 * When billing authority is required and unbound → fail-closed.
 */

/** @type {{
 *   ensureSessionReady: (args: object) => Promise<object>,
 *   runMaintenance: () => void,
 *   assertOperational: (tenantId: string) => object,
 *   isExemptRole: (user: object|null) => boolean,
 * } | null} */
let bound = null;

/**
 * @param {{
 *   ensureSessionReady: (args: object) => Promise<object>,
 *   runMaintenance: () => void,
 *   assertOperational: (tenantId: string) => object,
 *   isExemptRole: (user: object|null) => boolean,
 * }} impl
 */
export function bindBillingAccessCapability(impl) {
  if (
    !impl ||
    typeof impl.ensureSessionReady !== "function" ||
    typeof impl.runMaintenance !== "function" ||
    typeof impl.assertOperational !== "function" ||
    typeof impl.isExemptRole !== "function"
  ) {
    throw new Error(
      "bindBillingAccessCapability requires ensureSessionReady, runMaintenance, assertOperational, isExemptRole"
    );
  }
  bound = {
    ensureSessionReady: impl.ensureSessionReady,
    runMaintenance: impl.runMaintenance,
    assertOperational: impl.assertOperational,
    isExemptRole: impl.isExemptRole,
  };
}

export function isBillingAccessCapabilityBound() {
  return bound != null;
}

/**
 * @returns {typeof bound & { bound: boolean }}
 */
export function getBillingAccessCapability() {
  if (!bound) {
    return {
      bound: false,
      async ensureSessionReady() {
        return { ok: true, skipped: true, reason: "BILLING_NOT_CONFIGURED" };
      },
      runMaintenance() {},
      assertOperational() {
        return {
          ok: false,
          error: "Billing access capability is not bound.",
          code: "BILLING_NOT_CONFIGURED",
        };
      },
      isExemptRole() {
        return false;
      },
    };
  }
  return { bound: true, ...bound };
}

/** Test helper */
export function __resetBillingAccessCapabilityForTests() {
  bound = null;
}
