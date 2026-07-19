/**
 * Explicit rule priority within the same authority source — CORE-01.
 * Used only as the second step of the deterministic comparator.
 */

export const RULE_PRIORITY = Object.freeze({
  LOW: "low",
  MEDIUM: "medium",
  HIGH: "high",
  CRITICAL: "critical",
});

/** @type {ReadonlySet<string>} */
export const RULE_PRIORITY_VALUES = new Set(Object.values(RULE_PRIORITY));

/** Numeric rank — higher wins (aligned with Private Pairing). */
export const RULE_PRIORITY_RANK = Object.freeze({
  [RULE_PRIORITY.LOW]: 1,
  [RULE_PRIORITY.MEDIUM]: 2,
  [RULE_PRIORITY.HIGH]: 3,
  [RULE_PRIORITY.CRITICAL]: 4,
});

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isRulePriority(value) {
  return typeof value === "string" && RULE_PRIORITY_VALUES.has(value);
}

/**
 * @param {{ priority?: string|number }|null|undefined} rule
 * @returns {number}
 */
export function resolveRulePriorityRank(rule) {
  if (rule == null) {
    return 0;
  }
  const raw = rule.priority;
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return raw;
  }
  if (isRulePriority(raw)) {
    return RULE_PRIORITY_RANK[raw] ?? 0;
  }
  return 0;
}
