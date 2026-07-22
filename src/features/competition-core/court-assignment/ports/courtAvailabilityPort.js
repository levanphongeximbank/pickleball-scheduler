/**
 * CORE-12 — CourtAvailabilityPort (consumer-side boundary only).
 *
 * Production implementation (Phase 1D+) MUST delegate to the canonical
 * Venue & Court Competition Availability Adapter
 * (`getCompetitionCourtAvailability` or approved successor).
 *
 * Phase 1B: contract + fail-closed / fixed test doubles only.
 * Do NOT fetch inventory or calculate availability inside the pure assigner.
 */

export const COURT_AVAILABILITY_PORT_METHODS = Object.freeze([
  "resolveAvailability",
]);

/**
 * @typedef {{
 *   clubId: string,
 *   venueId: string,
 *   courtIds?: string[],
 *   civilWindows?: object[],
 *   clusterId?: string|null,
 *   expectedFingerprint?: string|null,
 * }} AvailabilityQuery
 *
 * @typedef {{
 *   courts: object[],
 *   fingerprint: string,
 *   snapshotId: string,
 *   snapshotVersion: string,
 * }} AvailabilitySnapshot
 *
 * @typedef {{
 *   resolveAvailability: (query: AvailabilityQuery) => AvailabilitySnapshot
 * }} CourtAvailabilityPort
 */

/**
 * Fail-closed port — production must not invent courts.
 * @returns {CourtAvailabilityPort}
 */
export function createFailClosedCourtAvailabilityPort() {
  return Object.freeze({
    // Port arity retained for callers; query unused — fail-closed Phase 1B double.
    resolveAvailability() {
      throw Object.freeze({
        name: "CourtAvailabilityPortError",
        code: "AVAILABILITY_DATA_UNAVAILABLE",
        message:
          "CourtAvailabilityPort is fail-closed in Phase 1B; wire Competition Availability Adapter in Phase 1D",
      });
    },
  });
}

/**
 * Fixed snapshot test double (models adapter semantics without live wiring).
 * @param {AvailabilitySnapshot} snapshot
 * @returns {CourtAvailabilityPort}
 */
export function createFixedCourtAvailabilityPort(snapshot) {
  const frozen = Object.freeze({
    courts: Object.freeze([...(snapshot.courts ?? [])]),
    fingerprint: String(snapshot.fingerprint),
    snapshotId: String(snapshot.snapshotId),
    snapshotVersion: String(snapshot.snapshotVersion),
  });
  return Object.freeze({
    // Port arity retained for callers; query unused — fixed Phase 1B double.
    resolveAvailability() {
      return frozen;
    },
  });
}
