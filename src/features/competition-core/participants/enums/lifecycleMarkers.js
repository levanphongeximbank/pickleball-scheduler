/**
 * Competition lifecycle markers owned as canonical names (OD-04, OD-09).
 * UI lock is not SSOT.
 */

export const COMPETITION_LIFECYCLE_MARKER = Object.freeze({
  ROSTER_LOCKED: "ROSTER_LOCKED",
  SEED_LOCKED: "SEED_LOCKED",
  DRAW_LOCKED: "DRAW_LOCKED",
  IN_PROGRESS: "IN_PROGRESS",
  COMPLETED: "COMPLETED",
});

export const COMPETITION_LIFECYCLE_MARKER_VALUES = new Set(
  Object.values(COMPETITION_LIFECYCLE_MARKER)
);

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isCompetitionLifecycleMarker(value) {
  return typeof value === "string" && COMPETITION_LIFECYCLE_MARKER_VALUES.has(value);
}
