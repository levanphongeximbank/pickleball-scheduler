/**
 * CORE-12 Phase 1D-B2 Option A — VenueEligibilityProvider (consumer-side port).
 *
 * Injected dependency that returns eligibility evidence for an exact query
 * window. Implementations may wrap the Venue Competition availability public
 * facade at the Integrator/composition root. CORE-12 never imports Venue internals.
 *
 * Sync or Promise-returning implementations are both valid; callers await.
 */

export const VENUE_ELIGIBILITY_PROVIDER_METHODS = Object.freeze([
  "resolveEligibility",
]);

/**
 * @typedef {{
 *   resolveEligibility: (request: object) => object | Promise<object>
 * }} VenueEligibilityProvider
 */

/**
 * @param {unknown} value
 * @returns {value is VenueEligibilityProvider}
 */
export function isVenueEligibilityProvider(value) {
  return (
    Boolean(value) &&
    typeof value === "object" &&
    typeof /** @type {{ resolveEligibility?: unknown }} */ (value)
      .resolveEligibility === "function"
  );
}
