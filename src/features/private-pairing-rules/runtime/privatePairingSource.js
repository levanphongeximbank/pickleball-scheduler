/**
 * Private-pairing SOURCE authority ladder.
 *
 * Spec: SUPER_ADMIN > TOURNAMENT > CLUB > SESSION > DEFAULT.
 * Phase 1 derives `source` from the existing `scopeType` (no DB column yet);
 * an explicit `source` on the rule always wins if provided (future DB field).
 */

import { RULE_PRIORITY } from "../constants/enums.js";
import { PRIVATE_PAIRING_SCOPE } from "../constants/scopes.js";
import {
  OPPONENT_RELATION_TYPES,
  PARTNER_RELATION_TYPES,
  PRIVATE_PAIRING_CONSTRAINT_TYPE,
} from "../constants/constraintTypes.js";

export const PRIVATE_PAIRING_SOURCE = Object.freeze({
  SUPER_ADMIN: "SUPER_ADMIN",
  TOURNAMENT: "TOURNAMENT",
  CLUB: "CLUB",
  SESSION: "SESSION",
  DEFAULT: "DEFAULT",
});

/** @type {ReadonlySet<string>} */
export const PRIVATE_PAIRING_SOURCE_VALUES = new Set(Object.values(PRIVATE_PAIRING_SOURCE));

/** Numeric authority — higher wins in the business-rule layer. */
export const PRIVATE_PAIRING_SOURCE_PRIORITY = Object.freeze({
  [PRIVATE_PAIRING_SOURCE.SUPER_ADMIN]: 1000,
  [PRIVATE_PAIRING_SOURCE.TOURNAMENT]: 800,
  [PRIVATE_PAIRING_SOURCE.CLUB]: 600,
  [PRIVATE_PAIRING_SOURCE.SESSION]: 400,
  [PRIVATE_PAIRING_SOURCE.DEFAULT]: 0,
});

/** Canonical descending authority order (for audit diagnostics). */
export const PRIVATE_PAIRING_SOURCE_ORDER = Object.freeze([
  PRIVATE_PAIRING_SOURCE.SUPER_ADMIN,
  PRIVATE_PAIRING_SOURCE.TOURNAMENT,
  PRIVATE_PAIRING_SOURCE.CLUB,
  PRIVATE_PAIRING_SOURCE.SESSION,
  PRIVATE_PAIRING_SOURCE.DEFAULT,
]);

export const PRIVATE_PAIRING_OPERATION = Object.freeze({
  TEAM_FORMATION: "TEAM_FORMATION",
  PARTNER_PAIRING: "PARTNER_PAIRING",
  GROUP_DRAW: "GROUP_DRAW",
  ALL: "ALL",
});

/** @type {ReadonlySet<string>} */
export const PRIVATE_PAIRING_OPERATION_VALUES = new Set(Object.values(PRIVATE_PAIRING_OPERATION));

const SCOPE_TO_SOURCE = Object.freeze({
  [PRIVATE_PAIRING_SCOPE.GLOBAL]: PRIVATE_PAIRING_SOURCE.SUPER_ADMIN,
  [PRIVATE_PAIRING_SCOPE.TENANT]: PRIVATE_PAIRING_SOURCE.SUPER_ADMIN,
  [PRIVATE_PAIRING_SCOPE.TOURNAMENT]: PRIVATE_PAIRING_SOURCE.TOURNAMENT,
  [PRIVATE_PAIRING_SCOPE.TOURNAMENT_EVENT]: PRIVATE_PAIRING_SOURCE.TOURNAMENT,
  [PRIVATE_PAIRING_SCOPE.CLUB]: PRIVATE_PAIRING_SOURCE.CLUB,
  [PRIVATE_PAIRING_SCOPE.VENUE]: PRIVATE_PAIRING_SOURCE.CLUB,
  [PRIVATE_PAIRING_SCOPE.DAILY_PLAY_SESSION]: PRIVATE_PAIRING_SOURCE.SESSION,
  [PRIVATE_PAIRING_SCOPE.ROUND]: PRIVATE_PAIRING_SOURCE.SESSION,
  [PRIVATE_PAIRING_SCOPE.MATCH_DAY]: PRIVATE_PAIRING_SOURCE.SESSION,
});

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isPrivatePairingSource(value) {
  return typeof value === "string" && PRIVATE_PAIRING_SOURCE_VALUES.has(value);
}

/**
 * Derive the authority source from an explicit source or the rule scopeType.
 *
 * @param {string|{ source?: string, scopeType?: string }} ruleOrScopeType
 * @returns {string}
 */
export function derivePrivatePairingSource(ruleOrScopeType) {
  if (ruleOrScopeType && typeof ruleOrScopeType === "object") {
    if (isPrivatePairingSource(ruleOrScopeType.source)) {
      return ruleOrScopeType.source;
    }
    return SCOPE_TO_SOURCE[ruleOrScopeType.scopeType] || PRIVATE_PAIRING_SOURCE.DEFAULT;
  }
  return SCOPE_TO_SOURCE[ruleOrScopeType] || PRIVATE_PAIRING_SOURCE.DEFAULT;
}

/**
 * Numeric source priority. Explicit numeric `sourcePriority` wins if provided,
 * so a future DB column can override the derived ladder without code changes.
 *
 * @param {{ source?: string, sourcePriority?: number, scopeType?: string }} rule
 * @returns {number}
 */
export function resolveRuleSourcePriority(rule) {
  const explicit = Number(rule?.sourcePriority);
  if (Number.isFinite(explicit)) {
    return explicit;
  }
  const source = derivePrivatePairingSource(rule || {});
  return PRIVATE_PAIRING_SOURCE_PRIORITY[source] ?? 0;
}

const TEAM_FORMATION_TYPES = new Set([
  ...PARTNER_RELATION_TYPES,
  PRIVATE_PAIRING_CONSTRAINT_TYPE.MAX_PARTNER_REPEAT,
  PRIVATE_PAIRING_CONSTRAINT_TYPE.MIN_PARTNER_REPEAT,
]);

const PARTNER_PAIRING_TYPES = new Set([
  ...PARTNER_RELATION_TYPES,
  ...OPPONENT_RELATION_TYPES,
  PRIVATE_PAIRING_CONSTRAINT_TYPE.MAX_PARTNER_REPEAT,
  PRIVATE_PAIRING_CONSTRAINT_TYPE.MIN_PARTNER_REPEAT,
  PRIVATE_PAIRING_CONSTRAINT_TYPE.MAX_OPPONENT_REPEAT,
  PRIVATE_PAIRING_CONSTRAINT_TYPE.MIN_OPPONENT_REPEAT,
]);

const GROUP_DRAW_TYPES = new Set([
  PRIVATE_PAIRING_CONSTRAINT_TYPE.SAME_GROUP,
  PRIVATE_PAIRING_CONSTRAINT_TYPE.DIFFERENT_GROUP,
]);

/**
 * Which business operations a constraintType participates in.
 * Diagnostic/declarative — the runtime stage filters remain the enforcement path.
 *
 * @param {string} constraintType
 * @returns {string[]}
 */
export function derivePrivatePairingOperations(constraintType) {
  const operations = [];
  if (TEAM_FORMATION_TYPES.has(constraintType)) {
    operations.push(PRIVATE_PAIRING_OPERATION.TEAM_FORMATION);
  }
  if (PARTNER_PAIRING_TYPES.has(constraintType)) {
    operations.push(PRIVATE_PAIRING_OPERATION.PARTNER_PAIRING);
  }
  if (GROUP_DRAW_TYPES.has(constraintType)) {
    operations.push(PRIVATE_PAIRING_OPERATION.GROUP_DRAW);
  }
  return operations;
}

/**
 * @param {{ operations?: string[], constraintType?: string }} rule
 * @param {string} operation
 * @returns {boolean}
 */
export function ruleMatchesOperation(rule, operation) {
  if (operation === PRIVATE_PAIRING_OPERATION.ALL) {
    return true;
  }
  const operations = Array.isArray(rule?.operations)
    ? rule.operations
    : derivePrivatePairingOperations(rule?.constraintType);
  return operations.includes(operation);
}

const RULE_PRIORITY_NUM = Object.freeze({
  [RULE_PRIORITY.LOW]: 1,
  [RULE_PRIORITY.MEDIUM]: 2,
  [RULE_PRIORITY.HIGH]: 3,
  [RULE_PRIORITY.CRITICAL]: 4,
});

/**
 * Authority comparator (higher = wins). Ladder:
 * sourcePriority → explicit rule priority → ruleSetVersion → updatedAt → stable id.
 * Never uses creation time as the primary key.
 *
 * @param {object} a
 * @param {object} b
 * @returns {number} >0 when `a` outranks `b`
 */
export function compareRuleAuthority(a, b) {
  const pa = resolveRuleSourcePriority(a);
  const pb = resolveRuleSourcePriority(b);
  if (pa !== pb) {
    return pa - pb;
  }
  const priA = RULE_PRIORITY_NUM[a?.priority] ?? 0;
  const priB = RULE_PRIORITY_NUM[b?.priority] ?? 0;
  if (priA !== priB) {
    return priA - priB;
  }
  const va = Number(a?.ruleSetVersion) || 0;
  const vb = Number(b?.ruleSetVersion) || 0;
  if (va !== vb) {
    return va - vb;
  }
  const ua = Date.parse(a?.updatedAt || a?.metadata?.updatedAt || "") || 0;
  const ub = Date.parse(b?.updatedAt || b?.metadata?.updatedAt || "") || 0;
  if (ua !== ub) {
    return ua - ub;
  }
  return String(a?.id ?? "").localeCompare(String(b?.id ?? ""));
}
