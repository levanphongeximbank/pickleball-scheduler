export const RELATION_MODE = Object.freeze({
  ANY_OF: "ANY_OF",
  ALL_OF: "ALL_OF",
});

/** @type {ReadonlySet<string>} */
export const RELATION_MODE_VALUES = new Set(Object.values(RELATION_MODE));

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isRelationMode(value) {
  return typeof value === "string" && RELATION_MODE_VALUES.has(value);
}

export const RULE_VISIBILITY = Object.freeze({
  PRIVATE: "private",
  DISCLOSED: "disclosed",
  PUBLIC: "public",
});

/** @type {ReadonlySet<string>} */
export const RULE_VISIBILITY_VALUES = new Set(Object.values(RULE_VISIBILITY));

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isRuleVisibility(value) {
  return typeof value === "string" && RULE_VISIBILITY_VALUES.has(value);
}

export const RULE_PRIORITY = Object.freeze({
  LOW: "low",
  MEDIUM: "medium",
  HIGH: "high",
  CRITICAL: "critical",
});

/** @type {ReadonlySet<string>} */
export const RULE_PRIORITY_VALUES = new Set(Object.values(RULE_PRIORITY));

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isRulePriority(value) {
  return typeof value === "string" && RULE_PRIORITY_VALUES.has(value);
}

export const REASON_CATEGORY = Object.freeze({
  PLAYER_REQUEST: "PLAYER_REQUEST",
  FAMILY_RELATIONSHIP: "FAMILY_RELATIONSHIP",
  COACHING_REQUIREMENT: "COACHING_REQUIREMENT",
  MEDICAL_OR_SAFETY: "MEDICAL_OR_SAFETY",
  CONFLICT_AVOIDANCE: "CONFLICT_AVOIDANCE",
  TEAM_BALANCE: "TEAM_BALANCE",
  EVENT_OPERATION: "EVENT_OPERATION",
  SPECIAL_GUEST: "SPECIAL_GUEST",
  OTHER: "OTHER",
});

/** @type {ReadonlySet<string>} */
export const REASON_CATEGORY_VALUES = new Set(Object.values(REASON_CATEGORY));

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isReasonCategory(value) {
  return typeof value === "string" && REASON_CATEGORY_VALUES.has(value);
}

export const COMPETITION_CLASS = Object.freeze({
  DAILY_PLAY: "DAILY_PLAY",
  INTERNAL: "INTERNAL",
  OFFICIAL: "OFFICIAL",
  CERTIFIED: "CERTIFIED",
  VPR_RANKED: "VPR_RANKED",
});

/** @type {ReadonlySet<string>} */
export const RESTRICTED_COMPETITION_CLASSES = new Set([
  COMPETITION_CLASS.OFFICIAL,
  COMPETITION_CLASS.CERTIFIED,
  COMPETITION_CLASS.VPR_RANKED,
]);
