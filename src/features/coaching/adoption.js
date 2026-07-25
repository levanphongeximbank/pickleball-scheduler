/**
 * Coaching Platform Core adoption metadata (COACHING-01 + COACHING-04 runtime note).
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
  durableRuntimeDefault: false,
  localStorageCanonical: false,
  localStorageRetired: false,
  authorizationModel: "action-based-fail-closed",
  notes: Object.freeze([
    "Platform adapter provides pure projections only.",
    "Application-layer authorizeCoaching enforces fail-closed decisions.",
    "No Supabase durable adapter in COACHING-01.",
    "COACHING-04 runtime boundary authored under features/coaching/runtime/.",
    "Durable runtime default remains false — UI composition stays on legacy adapter.",
    "localStorage not retired (LOCALSTORAGE_RETIRED=false); detect/classify helpers only.",
    "Pages must use runtime gateway / useCoachingCollection — not coachingService directly.",
    "No silent fallback from durable failure to legacy success.",
    "Legacy browser store remains COMPATIBILITY_ONLY until Owner-authorized retirement.",
  ]),
});

/**
 * @returns {Readonly<object>}
 */
export function getCoachingPlatformAdoption() {
  return COACHING_PLATFORM_ADOPTION;
}
