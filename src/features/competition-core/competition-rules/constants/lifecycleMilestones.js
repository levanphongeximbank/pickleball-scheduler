/**
 * Lifecycle milestones used as evidence for rule-mutation locks.
 * This layer answers "may a rule class mutate?" — it does NOT mutate lifecycle (CORE-15).
 */

export const LIFECYCLE_MILESTONE = Object.freeze({
  BEFORE_REGISTRATION: "BEFORE_REGISTRATION",
  AFTER_REGISTRATION_EXISTS: "AFTER_REGISTRATION_EXISTS",
  AFTER_PARTICIPANTS_FINALIZED: "AFTER_PARTICIPANTS_FINALIZED",
  AFTER_GROUP_DRAW: "AFTER_GROUP_DRAW",
  AFTER_MATCH_CREATION: "AFTER_MATCH_CREATION",
  AFTER_MATCH_START: "AFTER_MATCH_START",
  AFTER_ACCEPTED_RESULT: "AFTER_ACCEPTED_RESULT",
});

/** Ordered severity — later milestones imply earlier ones for lock evaluation. */
export const LIFECYCLE_MILESTONE_ORDER = Object.freeze([
  LIFECYCLE_MILESTONE.BEFORE_REGISTRATION,
  LIFECYCLE_MILESTONE.AFTER_REGISTRATION_EXISTS,
  LIFECYCLE_MILESTONE.AFTER_PARTICIPANTS_FINALIZED,
  LIFECYCLE_MILESTONE.AFTER_GROUP_DRAW,
  LIFECYCLE_MILESTONE.AFTER_MATCH_CREATION,
  LIFECYCLE_MILESTONE.AFTER_MATCH_START,
  LIFECYCLE_MILESTONE.AFTER_ACCEPTED_RESULT,
]);

/**
 * @param {string} milestone
 * @returns {number}
 */
export function lifecycleMilestoneRank(milestone) {
  const idx = LIFECYCLE_MILESTONE_ORDER.indexOf(milestone);
  return idx >= 0 ? idx : -1;
}

/**
 * @param {string} current
 * @param {string} required
 * @returns {boolean} true if current has reached or passed required
 */
export function hasReachedMilestone(current, required) {
  const c = lifecycleMilestoneRank(current);
  const r = lifecycleMilestoneRank(required);
  if (c < 0 || r < 0) return false;
  return c >= r;
}
