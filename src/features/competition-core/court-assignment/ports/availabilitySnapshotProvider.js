/**
 * CORE-12 Phase 1D-B1 — AvailabilitySnapshotProvider (consumer-side port).
 *
 * Injected I/O-capable dependency. Deterministic assignment core never calls this.
 * Implementations may be sync or async; invocation helper always awaits.
 *
 * No concrete Venue CAA provider in Phase 1D-B1.
 */

export const AVAILABILITY_SNAPSHOT_PROVIDER_METHODS = Object.freeze([
  "resolveEligibilitySnapshot",
]);

/**
 * @typedef {import('../contracts/availabilityEligibilityQuery.js')} AvailabilityEligibilityQueryModule
 * @typedef {Awaited<ReturnType<typeof import('../contracts/eligibilitySnapshot.js').createEligibilitySnapshot>>} EligibilitySnapshot
 *
 * @typedef {{
 *   resolveEligibilitySnapshot: (
 *     query: object
 *   ) => EligibilitySnapshot | Promise<EligibilitySnapshot>
 * }} AvailabilitySnapshotProvider
 */

/**
 * @param {unknown} value
 * @returns {value is AvailabilitySnapshotProvider}
 */
export function isAvailabilitySnapshotProvider(value) {
  return (
    Boolean(value) &&
    typeof value === "object" &&
    typeof /** @type {{ resolveEligibilitySnapshot?: unknown }} */ (value)
      .resolveEligibilitySnapshot === "function"
  );
}
