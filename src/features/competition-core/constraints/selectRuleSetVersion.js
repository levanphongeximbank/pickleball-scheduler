import { RULE_SET_STATUS } from "../constants/ruleSetStatus.js";
import { RULE_ERROR_CODE } from "./ruleConstants.js";

/**
 * @typedef {import('../types/index.js').RuleSet} RuleSet
 * @typedef {import('../types/index.js').ConstraintContext} ConstraintContext
 */

function parseTime(value) {
  if (!value) {
    return null;
  }
  const time = Date.parse(String(value));
  return Number.isFinite(time) ? time : null;
}

/**
 * Select the effective rule set from a catalog at evaluation time.
 *
 * @param {RuleSet[]} ruleSets
 * @param {Partial<ConstraintContext>} [context]
 * @returns {RuleSet|null}
 */
export function selectRuleSetVersion(ruleSets = [], context = {}) {
  const evaluatedAt = parseTime(context.evaluatedAt) ?? Date.now();

  const candidates = (ruleSets || [])
    .filter((item) => item && Array.isArray(item.constraints))
    .filter((item) => {
      const status = item.status || RULE_SET_STATUS.ACTIVE;
      if (status === RULE_SET_STATUS.ARCHIVED) {
        return false;
      }
      if (status === RULE_SET_STATUS.LOCKED && item.lockedAt) {
        const lockedAt = parseTime(item.lockedAt);
        if (lockedAt != null && lockedAt > evaluatedAt) {
          return false;
        }
      }
      const effectiveFrom = parseTime(item.effectiveFrom);
      if (effectiveFrom != null && effectiveFrom > evaluatedAt) {
        return false;
      }
      return status === RULE_SET_STATUS.ACTIVE || status === RULE_SET_STATUS.LOCKED;
    })
    .sort((a, b) => {
      const aTime = parseTime(a.effectiveFrom) ?? 0;
      const bTime = parseTime(b.effectiveFrom) ?? 0;
      if (aTime !== bTime) {
        return bTime - aTime;
      }
      return String(b.version).localeCompare(String(a.version));
    });

  return candidates[0] || null;
}

/**
 * @param {RuleSet} ruleSet
 * @param {Partial<ConstraintContext>} [context]
 * @returns {{ ok: boolean, code?: string, message?: string }}
 */
export function validateRuleSetLifecycle(ruleSet, context = {}) {
  const evaluatedAt = parseTime(context.evaluatedAt) ?? Date.now();
  const status = ruleSet.status || RULE_SET_STATUS.ACTIVE;

  if (status === RULE_SET_STATUS.ARCHIVED) {
    return {
      ok: false,
      code: RULE_ERROR_CODE.RULE_SET_NOT_EFFECTIVE,
      message: `Rule set ${ruleSet.id}@${ruleSet.version} is archived.`,
    };
  }

  const effectiveFrom = parseTime(ruleSet.effectiveFrom);
  if (effectiveFrom != null && effectiveFrom > evaluatedAt) {
    return {
      ok: false,
      code: RULE_ERROR_CODE.RULE_SET_NOT_EFFECTIVE,
      message: `Rule set ${ruleSet.id}@${ruleSet.version} is not yet effective.`,
    };
  }

  if (status === RULE_SET_STATUS.LOCKED && ruleSet.lockedAt) {
    const lockedAt = parseTime(ruleSet.lockedAt);
    if (lockedAt != null && lockedAt > evaluatedAt) {
      return {
        ok: false,
        code: RULE_ERROR_CODE.RULE_SET_LOCKED,
        message: `Rule set ${ruleSet.id}@${ruleSet.version} is locked.`,
      };
    }
  }

  return { ok: true };
}
