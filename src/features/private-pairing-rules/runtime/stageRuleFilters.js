import {
  OPPONENT_RELATION_TYPES,
  PARTNER_RELATION_TYPES,
  PRIVATE_PAIRING_CONSTRAINT_TYPE,
} from "../constants/constraintTypes.js";

/** Soft opponent-history repeat rules applicable during matchup/schedule. */
const OPPONENT_STAGE_REPEAT_TYPES = Object.freeze([
  PRIVATE_PAIRING_CONSTRAINT_TYPE.MAX_OPPONENT_REPEAT,
  PRIVATE_PAIRING_CONSTRAINT_TYPE.MIN_OPPONENT_REPEAT,
]);

/** Group placement rules — group draw only. */
const GROUP_RELATION_TYPES = Object.freeze([
  PRIVATE_PAIRING_CONSTRAINT_TYPE.SAME_GROUP,
  PRIVATE_PAIRING_CONSTRAINT_TYPE.DIFFERENT_GROUP,
]);

const OPPONENT_STAGE_TYPE_SET = new Set([
  ...OPPONENT_RELATION_TYPES,
  ...OPPONENT_STAGE_REPEAT_TYPES,
]);

const GROUP_STAGE_TYPE_SET = new Set([...GROUP_RELATION_TYPES]);

const EXCLUDED_FROM_OPPONENT_STAGE = new Set([
  ...PARTNER_RELATION_TYPES,
  ...GROUP_RELATION_TYPES,
  PRIVATE_PAIRING_CONSTRAINT_TYPE.MAX_PARTNER_REPEAT,
  PRIVATE_PAIRING_CONSTRAINT_TYPE.MIN_PARTNER_REPEAT,
]);

const EXCLUDED_FROM_GROUP_STAGE = new Set([
  ...PARTNER_RELATION_TYPES,
  ...OPPONENT_RELATION_TYPES,
  PRIVATE_PAIRING_CONSTRAINT_TYPE.MAX_PARTNER_REPEAT,
  PRIVATE_PAIRING_CONSTRAINT_TYPE.MIN_PARTNER_REPEAT,
  PRIVATE_PAIRING_CONSTRAINT_TYPE.MAX_OPPONENT_REPEAT,
  PRIVATE_PAIRING_CONSTRAINT_TYPE.MIN_OPPONENT_REPEAT,
]);

/**
 * Rules applicable while generating/ranking matchups (opponent stage).
 * Partner / group rules are excluded so they are not mis-applied.
 *
 * @param {import('../contracts/normalizePrivatePairingRule.js').PrivatePairingRule[]} [rules]
 */
export function filterRulesForOpponentStage(rules = []) {
  return (rules || []).filter((rule) => {
    const type = rule?.constraintType;
    if (!type) return false;
    if (EXCLUDED_FROM_OPPONENT_STAGE.has(type)) return false;
    return OPPONENT_STAGE_TYPE_SET.has(type);
  });
}

/**
 * Rules applicable while dividing entries/teams into groups.
 * Partner / opponent rules are excluded so they are not mis-applied.
 *
 * @param {import('../contracts/normalizePrivatePairingRule.js').PrivatePairingRule[]} [rules]
 */
export function filterRulesForGroupStage(rules = []) {
  return (rules || []).filter((rule) => {
    const type = rule?.constraintType;
    if (!type) return false;
    if (EXCLUDED_FROM_GROUP_STAGE.has(type)) return false;
    return GROUP_STAGE_TYPE_SET.has(type);
  });
}

/**
 * @param {string} constraintType
 * @returns {boolean}
 */
export function isOpponentStageConstraintType(constraintType) {
  return OPPONENT_STAGE_TYPE_SET.has(constraintType);
}

/**
 * @param {string} constraintType
 * @returns {boolean}
 */
export function isGroupStageConstraintType(constraintType) {
  return GROUP_STAGE_TYPE_SET.has(constraintType);
}

/**
 * @param {string} constraintType
 * @returns {boolean}
 */
export function isExcludedFromOpponentStage(constraintType) {
  return EXCLUDED_FROM_OPPONENT_STAGE.has(constraintType);
}

/**
 * @param {string} constraintType
 * @returns {boolean}
 */
export function isExcludedFromGroupStage(constraintType) {
  return EXCLUDED_FROM_GROUP_STAGE.has(constraintType);
}

export {
  OPPONENT_STAGE_TYPE_SET,
  GROUP_STAGE_TYPE_SET,
  EXCLUDED_FROM_OPPONENT_STAGE,
  EXCLUDED_FROM_GROUP_STAGE,
  GROUP_RELATION_TYPES,
  OPPONENT_STAGE_REPEAT_TYPES,
};
