/** @typedef {import('../types/ruleSetStatus.js').RuleSetStatusValue} RuleSetStatusValue */

export const RULE_SET_STATUS = Object.freeze({
  DRAFT: "draft",
  ACTIVE: "active",
  LOCKED: "locked",
  ARCHIVED: "archived",
});

/** @type {ReadonlySet<RuleSetStatusValue>} */
export const RULE_SET_STATUS_VALUES = new Set(Object.values(RULE_SET_STATUS));

/**
 * @param {unknown} value
 * @returns {value is RuleSetStatusValue}
 */
export function isRuleSetStatus(value) {
  return typeof value === "string" && RULE_SET_STATUS_VALUES.has(/** @type {RuleSetStatusValue} */ (value));
}
