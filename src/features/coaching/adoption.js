/**
 * Coaching Platform Core adoption metadata (COACHING-01).
 * Describes contract availability — not Production readiness.
 * Kept outside platform/ so the adapter folder remains pure projection imports.
 */

export const COACHING_PLATFORM_ADOPTION = Object.freeze({
  module: "Coaching",
  phase: "COACHING-01",
  adapterStatus: "ADAPTER_AVAILABLE",
  capabilityCode: "COACHING_PUBLIC_FACADE",
  ownerModule: "Coaching",
  version: "1.0.0",
  durablePersistence: false,
  localStorageCanonical: false,
  authorizationModel: "action-based-fail-closed",
  notes: Object.freeze([
    "Platform adapter provides pure projections only.",
    "Application-layer authorizeCoaching enforces fail-closed decisions.",
    "No Supabase durable adapter in COACHING-01.",
    "Legacy browser store remains COMPATIBILITY_ONLY until COACHING-04.",
  ]),
});

/**
 * @returns {Readonly<object>}
 */
export function getCoachingPlatformAdoption() {
  return COACHING_PLATFORM_ADOPTION;
}
