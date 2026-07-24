/**
 * CM-07 lifecycle interruption actions (immutable decision record kinds).
 */

export const COMPETITION_LIFECYCLE_ACTION = Object.freeze({
  SUSPEND: "SUSPEND",
  RESUME: "RESUME",
  CANCEL: "CANCEL",
});

export const COMPETITION_LIFECYCLE_ACTION_VALUES = Object.freeze(
  Object.values(COMPETITION_LIFECYCLE_ACTION)
);

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isCompetitionLifecycleAction(value) {
  return (
    typeof value === "string" &&
    COMPETITION_LIFECYCLE_ACTION_VALUES.includes(value)
  );
}
