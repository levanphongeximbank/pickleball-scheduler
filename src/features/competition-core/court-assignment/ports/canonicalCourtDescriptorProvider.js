/**
 * CORE-12 Phase 1D-B2 Option A — CanonicalCourtDescriptorProvider (consumer-side).
 *
 * Injected dependency that returns a Venue Phase 3B descriptor envelope.
 * Implementations may wrap the Venue Competition descriptor public facade at
 * the Integrator/composition root. CORE-12 never imports Venue internals.
 *
 * Sync or Promise-returning implementations are both valid; callers await.
 */

export const CANONICAL_COURT_DESCRIPTOR_PROVIDER_METHODS = Object.freeze([
  "resolveDescriptors",
]);

/**
 * @typedef {{
 *   resolveDescriptors: (request: object) => object | Promise<object>
 * }} CanonicalCourtDescriptorProvider
 */

/**
 * @param {unknown} value
 * @returns {value is CanonicalCourtDescriptorProvider}
 */
export function isCanonicalCourtDescriptorProvider(value) {
  return (
    Boolean(value) &&
    typeof value === "object" &&
    typeof /** @type {{ resolveDescriptors?: unknown }} */ (value)
      .resolveDescriptors === "function"
  );
}
