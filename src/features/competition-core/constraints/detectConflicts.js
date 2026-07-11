import { COMPETITION_CONSTRAINT_TYPE } from "../constants/constraintType.js";
import { CONSTRAINT_SEVERITY } from "../constants/constraintSeverity.js";
import { createConstraintConflict } from "../contracts/engineContracts.js";
import { RULE_ERROR_CODE } from "./ruleConstants.js";

/**
 * @typedef {import('../types/index.js').ConstraintDefinition} ConstraintDefinition
 * @typedef {import('../types/index.js').ConstraintConflict} ConstraintConflict
 * @typedef {import('./normalizeRule.js').RuleSet} RuleSet
 */

function pairKey(playerA, playerB) {
  return [String(playerA), String(playerB)].sort().join("|");
}

function getPartnerParams(constraint) {
  const params = constraint.params || {};
  const anchor = String(params.anchorPlayerId || "").trim();
  const targets = Array.isArray(params.targetPlayerIds)
    ? params.targetPlayerIds.map(String).filter(Boolean)
    : [];
  return { anchor, targets };
}

function isPartnerConstraint(type) {
  return (
    type === COMPETITION_CONSTRAINT_TYPE.MUST_PARTNER ||
    type === COMPETITION_CONSTRAINT_TYPE.MUST_NOT_PARTNER ||
    type === COMPETITION_CONSTRAINT_TYPE.PREFER_PARTNER ||
    type === COMPETITION_CONSTRAINT_TYPE.AVOID_PARTNER
  );
}

/**
 * Detect structural conflicts before running any optimizer.
 *
 * @param {RuleSet|{ constraints?: ConstraintDefinition[] }} ruleSet
 * @returns {ConstraintConflict[]}
 */
export function detectConstraintConflicts(ruleSet) {
  /** @type {ConstraintConflict[]} */
  const conflicts = [];
  const constraints = (ruleSet?.constraints || []).filter((item) => item?.enabled !== false);
  const seenIds = new Map();

  constraints.forEach((constraint) => {
    if (!constraint?.id) {
      return;
    }
    if (seenIds.has(constraint.id)) {
      conflicts.push(
        createConstraintConflict({
          code: RULE_ERROR_CODE.DUPLICATE_CONSTRAINT_ID,
          message: `Duplicate constraint id: ${constraint.id}`,
          constraints: [constraint, seenIds.get(constraint.id)],
        })
      );
      return;
    }
    seenIds.set(constraint.id, constraint);
  });

  /** @type {Map<string, ConstraintDefinition[]>} */
  const pairIndex = new Map();

  constraints.forEach((constraint) => {
    if (!isPartnerConstraint(constraint.type)) {
      return;
    }

    const { anchor, targets } = getPartnerParams(constraint);
    if (!anchor || !targets.length) {
      conflicts.push(
        createConstraintConflict({
          code: RULE_ERROR_CODE.INVALID_CONSTRAINT_PARAMS,
          message: `Constraint ${constraint.id} missing anchor/target players.`,
          constraints: [constraint],
        })
      );
      return;
    }

    targets.forEach((target) => {
      const key = pairKey(anchor, target);
      const bucket = pairIndex.get(key) || [];
      bucket.push(constraint);
      pairIndex.set(key, bucket);
    });
  });

  pairIndex.forEach((bucket, key) => {
    const hasMust = bucket.some((item) => item.type === COMPETITION_CONSTRAINT_TYPE.MUST_PARTNER);
    const hasMustNot = bucket.some(
      (item) => item.type === COMPETITION_CONSTRAINT_TYPE.MUST_NOT_PARTNER
    );
    const hasHardAvoid = bucket.some(
      (item) =>
        item.type === COMPETITION_CONSTRAINT_TYPE.AVOID_PARTNER &&
        item.severity === CONSTRAINT_SEVERITY.HARD
    );

    if (hasMust && hasMustNot) {
      conflicts.push(
        createConstraintConflict({
          code: RULE_ERROR_CODE.CONTRADICTORY_MUST_MUST_NOT,
          message: `Contradictory must/must-not partner on pair ${key}.`,
          constraints: bucket,
        })
      );
    }

    if (hasMust && hasHardAvoid) {
      conflicts.push(
        createConstraintConflict({
          code: RULE_ERROR_CODE.CONTRADICTORY_MUST_AVOID,
          message: `Contradictory must-partner and hard avoid on pair ${key}.`,
          constraints: bucket,
        })
      );
    }
  });

  /** @type {Map<string, ConstraintDefinition[]>} */
  const mustByAnchor = new Map();
  constraints
    .filter(
      (item) =>
        item.type === COMPETITION_CONSTRAINT_TYPE.MUST_PARTNER &&
        item.severity === CONSTRAINT_SEVERITY.HARD
    )
    .forEach((constraint) => {
      const { anchor, targets } = getPartnerParams(constraint);
      if (!anchor) {
        return;
      }
      const bucket = mustByAnchor.get(anchor) || [];
      bucket.push(constraint);
      mustByAnchor.set(anchor, bucket);
    });

  mustByAnchor.forEach((bucket, anchor) => {
    const uniqueTargets = new Set(
      bucket.flatMap((item) => getPartnerParams(item).targets)
    );
    if (uniqueTargets.size > 1) {
      conflicts.push(
        createConstraintConflict({
          code: RULE_ERROR_CODE.UNSATISFIABLE_MUST_PARTNER,
          message: `Anchor ${anchor} has multiple hard must-partner targets in a doubles context.`,
          constraints: bucket,
        })
      );
    }
  });

  return conflicts;
}

/**
 * @param {RuleSet} ruleSet
 * @returns {{ ok: boolean, conflicts: ConstraintConflict[] }}
 */
export function validateRuleSetConflicts(ruleSet) {
  const conflicts = detectConstraintConflicts(ruleSet);
  return { ok: conflicts.length === 0, conflicts };
}
