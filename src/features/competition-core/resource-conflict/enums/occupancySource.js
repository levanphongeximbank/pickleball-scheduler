/**
 * CORE-14 — occupancy source provenance.
 *
 * Contract:
 * - source is a non-empty, case-sensitive provenance string;
 * - not trimmed / lower-cased / Unicode-normalized;
 * - excluded from CanonicalResourceKey, LogicalAssignmentKeyV1, and duplicate-concealing identity;
 * - excluded from finding identity unless a future versioned contract requires it;
 * - extensible: any non-empty string is valid (e.g. EXTERNAL_ADAPTER:<namespace>).
 *
 * OCCUPANCY_SOURCE constants are convenience well-known values, not a closed enum.
 */

export const OCCUPANCY_SOURCE = Object.freeze({
  SCHEDULE: "SCHEDULE",
  COURT_ASSIGNMENT: "COURT_ASSIGNMENT",
  REFEREE_ASSIGNMENT: "REFEREE_ASSIGNMENT",
  MANUAL: "MANUAL",
  EXTERNAL: "EXTERNAL",
  PROJECTED: "PROJECTED",
  CORE_11: "CORE_11",
  CORE_12: "CORE_12",
  CORE_13: "CORE_13",
  LEGACY_CC09: "LEGACY_CC09",
  ADAPTER: "ADAPTER",
});

/** Well-known constants only — not an exhaustive allowlist. */
export const OCCUPANCY_SOURCE_VALUES = Object.freeze([
  OCCUPANCY_SOURCE.SCHEDULE,
  OCCUPANCY_SOURCE.COURT_ASSIGNMENT,
  OCCUPANCY_SOURCE.REFEREE_ASSIGNMENT,
  OCCUPANCY_SOURCE.MANUAL,
  OCCUPANCY_SOURCE.EXTERNAL,
  OCCUPANCY_SOURCE.PROJECTED,
  OCCUPANCY_SOURCE.CORE_11,
  OCCUPANCY_SOURCE.CORE_12,
  OCCUPANCY_SOURCE.CORE_13,
  OCCUPANCY_SOURCE.LEGACY_CC09,
  OCCUPANCY_SOURCE.ADAPTER,
]);

const OCCUPANCY_SOURCE_SET = new Set(OCCUPANCY_SOURCE_VALUES);

/**
 * True when value equals a well-known OCCUPANCY_SOURCE constant.
 * Not required for ResourceOccupancy acceptance.
 * @param {unknown} value
 * @returns {value is string}
 */
export function isWellKnownOccupancySource(value) {
  return typeof value === "string" && OCCUPANCY_SOURCE_SET.has(value);
}

/**
 * @deprecated Use isWellKnownOccupancySource. Kept for Phase 1C import compatibility.
 * @param {unknown} value
 * @returns {value is string}
 */
export function isOccupancySource(value) {
  return isWellKnownOccupancySource(value);
}

/**
 * Validate extensible provenance: non-empty case-sensitive string (no silent normalize).
 * @param {unknown} value
 * @returns {{ ok: true, value: string } | { ok: false, reason: string }}
 */
export function resolveOccupancySource(value) {
  if (value == null || value === "") {
    return { ok: false, reason: "OCCUPANCY_SOURCE_REQUIRED" };
  }
  if (typeof value !== "string") {
    return { ok: false, reason: "OCCUPANCY_SOURCE_TYPE_INVALID" };
  }
  if (value.length === 0) {
    return { ok: false, reason: "OCCUPANCY_SOURCE_REQUIRED" };
  }
  return { ok: true, value };
}
