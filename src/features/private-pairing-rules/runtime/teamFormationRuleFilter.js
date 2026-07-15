import {
  OPPONENT_RELATION_TYPES,
  PARTNER_RELATION_TYPES,
  PRIVATE_PAIRING_CONSTRAINT_TYPE,
} from "../constants/constraintTypes.js";

/** Soft partner-history repeat rules applicable during team formation. */
const TEAM_FORMATION_REPEAT_TYPES = Object.freeze([
  PRIVATE_PAIRING_CONSTRAINT_TYPE.MAX_PARTNER_REPEAT,
  PRIVATE_PAIRING_CONSTRAINT_TYPE.MIN_PARTNER_REPEAT,
]);

/** Group placement rules — deferred to group draw, not team composition. */
const GROUP_RELATION_TYPES = Object.freeze([
  PRIVATE_PAIRING_CONSTRAINT_TYPE.SAME_GROUP,
  PRIVATE_PAIRING_CONSTRAINT_TYPE.DIFFERENT_GROUP,
]);

const TEAM_FORMATION_TYPE_SET = new Set([
  ...PARTNER_RELATION_TYPES,
  ...TEAM_FORMATION_REPEAT_TYPES,
]);

const EXCLUDED_FROM_TEAM_FORMATION = new Set([
  ...OPPONENT_RELATION_TYPES,
  ...GROUP_RELATION_TYPES,
  PRIVATE_PAIRING_CONSTRAINT_TYPE.MAX_OPPONENT_REPEAT,
  PRIVATE_PAIRING_CONSTRAINT_TYPE.MIN_OPPONENT_REPEAT,
]);

/**
 * Rules applicable while composing teammates into teams (MLP formation).
 * Opponent / group rules are excluded so they are not mis-applied.
 *
 * @param {import('../contracts/normalizePrivatePairingRule.js').PrivatePairingRule[]} [rules]
 * @returns {import('../contracts/normalizePrivatePairingRule.js').PrivatePairingRule[]}
 */
export function filterRulesForTeamFormation(rules = []) {
  return (rules || []).filter((rule) => {
    const type = rule?.constraintType;
    if (!type) return false;
    if (EXCLUDED_FROM_TEAM_FORMATION.has(type)) return false;
    return TEAM_FORMATION_TYPE_SET.has(type);
  });
}

/**
 * @param {string} constraintType
 * @returns {boolean}
 */
export function isTeamFormationConstraintType(constraintType) {
  return TEAM_FORMATION_TYPE_SET.has(constraintType);
}

/**
 * @param {string} constraintType
 * @returns {boolean}
 */
export function isExcludedFromTeamFormation(constraintType) {
  return EXCLUDED_FROM_TEAM_FORMATION.has(constraintType);
}

export {
  TEAM_FORMATION_TYPE_SET,
  EXCLUDED_FROM_TEAM_FORMATION,
  GROUP_RELATION_TYPES,
  TEAM_FORMATION_REPEAT_TYPES,
};
