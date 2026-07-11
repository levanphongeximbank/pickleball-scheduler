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
 * @param {RuleSet|{ constraints?: ConstraintDefinition[] }|ConstraintDefinition[]} constraintsOrRuleSet
 * @param {Partial<import('../types/index.js').ConstraintContext>} [context]
 * @returns {ConstraintConflict[]}
 */
export function detectConstraintConflicts(constraintsOrRuleSet, context = {}) {
  /** @type {ConstraintConflict[]} */
  const conflicts = [];
  const constraints = Array.isArray(constraintsOrRuleSet)
    ? constraintsOrRuleSet
    : (constraintsOrRuleSet?.constraints || []).filter((item) => item?.enabled !== false);
  const teamSize = Number(context.teamSize ?? 2);
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
    if (uniqueTargets.size > Math.max(teamSize - 1, 0)) {
      conflicts.push(
        createConstraintConflict({
          code: RULE_ERROR_CODE.MUST_PARTNER_COMPONENT_EXCEEDS_TEAM_SIZE,
          message: `Anchor ${anchor} has ${uniqueTargets.size} hard must-partner targets but team size is ${teamSize}.`,
          constraints: bucket,
        })
      );
    } else if (uniqueTargets.size > 1 && teamSize <= 2) {
      conflicts.push(
        createConstraintConflict({
          code: RULE_ERROR_CODE.UNSATISFIABLE_MUST_PARTNER,
          message: `Anchor ${anchor} has multiple hard must-partner targets in a doubles context.`,
          constraints: bucket,
        })
      );
    }
  });

  const hasMixedHard = constraints.some(
    (item) =>
      item.type === COMPETITION_CONSTRAINT_TYPE.MIXED_TEAM_COMPOSITION &&
      item.severity === CONSTRAINT_SEVERITY.HARD
  );
  const hasSameGenderOnly = constraints.some((item) => {
    const eventType = String(item.params?.eventType || item.params?.composition || "").toLowerCase();
    return (
      item.type === COMPETITION_CONSTRAINT_TYPE.GENDER_ELIGIBILITY &&
      item.severity === CONSTRAINT_SEVERITY.HARD &&
      eventType &&
      eventType !== "mixed_double"
    );
  });
  if (hasMixedHard && hasSameGenderOnly) {
    conflicts.push(
      createConstraintConflict({
        code: RULE_ERROR_CODE.CONTRADICTORY_MIXED_GENDER,
        message: "Contradictory mixed-team and same-gender eligibility rules.",
        constraints: constraints.filter(
          (item) =>
            item.type === COMPETITION_CONSTRAINT_TYPE.MIXED_TEAM_COMPOSITION ||
            item.type === COMPETITION_CONSTRAINT_TYPE.GENDER_ELIGIBILITY
        ),
      })
    );
  }

  const skillCaps = constraints.filter((item) => item.type === COMPETITION_CONSTRAINT_TYPE.SKILL_CAP);
  const skillDiffs = constraints.filter(
    (item) => item.type === COMPETITION_CONSTRAINT_TYPE.TEAM_SKILL_DIFFERENCE
  );
  [...skillCaps, ...skillDiffs].forEach((constraint) => {
    const maxDiff = Number(constraint.params?.maxDiff);
    if (!Number.isFinite(maxDiff) || maxDiff < 0) {
      conflicts.push(
        createConstraintConflict({
          code: RULE_ERROR_CODE.INVALID_CONSTRAINT_PARAMS,
          message: `Constraint ${constraint.id} has invalid maxDiff.`,
          constraints: [constraint],
        })
      );
    }
  });
  if (skillCaps.length && skillDiffs.length) {
    const capValues = new Set(skillCaps.map((item) => Number(item.params?.maxDiff ?? 0.5)));
    const diffValues = new Set(skillDiffs.map((item) => Number(item.params?.maxDiff ?? 0.5)));
    if (capValues.size > 1 || diffValues.size > 1) {
      conflicts.push(
        createConstraintConflict({
          code: RULE_ERROR_CODE.CONTRADICTORY_SKILL_CAP,
          message: "Contradictory skill cap thresholds in the same rule set.",
          constraints: [...skillCaps, ...skillDiffs],
        })
      );
    }
  }

  if (context.playersById) {
    constraints
      .filter((item) => item.type === COMPETITION_CONSTRAINT_TYPE.CHECKIN_REQUIRED)
      .forEach((constraint) => {
        Object.entries(context.playersById).forEach(([playerId, snapshot]) => {
          if (snapshot?.checkedIn === false && snapshot?.available === false) {
            conflicts.push(
              createConstraintConflict({
                code: RULE_ERROR_CODE.CONTRADICTORY_AVAILABILITY,
                message: `Player ${playerId} is unavailable and not checked in under check-in rules.`,
                constraints: [constraint],
              })
            );
          }
        });
      });
  }

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
