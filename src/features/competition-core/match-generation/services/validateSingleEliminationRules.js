/**
 * CORE-09 Phase 1D — validate EvaluatedMatchGenerationRules for SE executor.
 */

import {
  BYE_POLICY,
  BRACKET_SIZE_POLICY,
  THIRD_PLACE_POLICY,
} from "../contracts/evaluatedMatchGenerationRules.js";
import { createMatchGenerationIssue } from "../contracts/matchGenerationIssue.js";
import { MATCH_GENERATION_STRATEGY } from "../enums/matchGenerationStrategy.js";
import { MATCH_GENERATION_ISSUE_CODE } from "../errors/matchGenerationIssueCodes.js";
import { sortMatchGenerationIssues } from "./asciiCompare.js";

/** Strategies with Phase 1D Single Elimination executor. */
export const PHASE_1D_EXECUTABLE_STRATEGIES = Object.freeze(
  new Set([MATCH_GENERATION_STRATEGY.SINGLE_ELIMINATION])
);

/** Bracket policies accepted by Phase 1D SE. */
export const PHASE_1D_BRACKET_SIZE_POLICIES = Object.freeze(
  new Set([
    BRACKET_SIZE_POLICY.POWER_OF_TWO,
    BRACKET_SIZE_POLICY.NEXT_POWER_OF_TWO,
    BRACKET_SIZE_POLICY.EXACT,
  ])
);

/** Bye policies accepted by Phase 1D SE (Draw owns recipient selection). */
export const PHASE_1D_BYE_POLICIES = Object.freeze(
  new Set([
    BYE_POLICY.NONE,
    BYE_POLICY.TOP_SEEDS,
    BYE_POLICY.BOTTOM_SEEDS,
    BYE_POLICY.EXPLICIT_PLACEMENTS,
  ])
);

/**
 * @param {import('../contracts/matchGenerationRequest.js').MatchGenerationRequest} request
 * @param {import('../contracts/evaluatedMatchGenerationRules.js').EvaluatedMatchGenerationRules} rules
 * @param {{ participantCount?: number, byeCount?: number }} [dims]
 * @returns {import('../contracts/matchGenerationIssue.js').MatchGenerationIssue[]}
 */
export function validateSingleEliminationRuleBinding(
  request,
  rules,
  dims = {}
) {
  /** @type {import('../contracts/matchGenerationIssue.js').MatchGenerationIssue[]} */
  const issues = [];

  if (!rules || typeof rules !== "object") {
    issues.push(
      createMatchGenerationIssue({
        code: MATCH_GENERATION_ISSUE_CODE.INVALID_REQUEST,
        path: "evaluatedRules",
        message: "EvaluatedMatchGenerationRules snapshot is missing",
      })
    );
    return sortMatchGenerationIssues(issues);
  }

  if (!String(rules.ruleEvaluationFingerprint || "").trim()) {
    issues.push(
      createMatchGenerationIssue({
        code: MATCH_GENERATION_ISSUE_CODE.RULE_FINGERPRINT_MISSING,
        path: "evaluatedRules.ruleEvaluationFingerprint",
        message: "Rule evaluation fingerprint is missing",
      })
    );
  }

  const requestFp = String(
    request?.evaluatedRuleReference?.ruleEvaluationFingerprint || ""
  ).trim();
  const rulesFp = String(rules.ruleEvaluationFingerprint || "").trim();
  if (requestFp && rulesFp && requestFp !== rulesFp) {
    issues.push(
      createMatchGenerationIssue({
        code: MATCH_GENERATION_ISSUE_CODE.RULE_FINGERPRINT_MISMATCH,
        path: "evaluatedRules.ruleEvaluationFingerprint",
        message: "Rule fingerprint does not match request binding",
      })
    );
  }

  const strategy = String(request?.strategy || "").trim();
  const ruleStrategy = String(rules.generationStrategy || "").trim();

  if (!PHASE_1D_EXECUTABLE_STRATEGIES.has(strategy)) {
    issues.push(
      createMatchGenerationIssue({
        code: MATCH_GENERATION_ISSUE_CODE.STRATEGY_UNSUPPORTED,
        path: "strategy",
        message: "Phase 1D executor does not support this strategy",
        details: { strategy },
      })
    );
  }

  if (strategy && ruleStrategy && strategy !== ruleStrategy) {
    issues.push(
      createMatchGenerationIssue({
        code: MATCH_GENERATION_ISSUE_CODE.RULE_STRATEGY_MISMATCH,
        path: "evaluatedRules.generationStrategy",
        message: "Request strategy conflicts with evaluated rule strategy",
        details: { requestStrategy: strategy, ruleStrategy },
      })
    );
  }

  if (strategy === MATCH_GENERATION_STRATEGY.SINGLE_ELIMINATION) {
    const encounterCount = rules.encounterCount;
    if (
      typeof encounterCount !== "number" ||
      !Number.isInteger(encounterCount) ||
      encounterCount !== 1
    ) {
      issues.push(
        createMatchGenerationIssue({
          code: MATCH_GENERATION_ISSUE_CODE.ENCOUNTER_COUNT_UNSUPPORTED,
          path: "evaluatedRules.encounterCount",
          message: "Single Elimination requires encounterCount 1",
          details: { encounterCount: encounterCount ?? null },
        })
      );
    }

    if (!PHASE_1D_BRACKET_SIZE_POLICIES.has(rules.bracketSizePolicy)) {
      issues.push(
        createMatchGenerationIssue({
          code: MATCH_GENERATION_ISSUE_CODE.UNSUPPORTED_GENERATION_POLICY,
          path: "evaluatedRules.bracketSizePolicy",
          message: "bracketSizePolicy is unsupported for Phase 1D",
          details: { bracketSizePolicy: rules.bracketSizePolicy ?? null },
        })
      );
    }

    if (!PHASE_1D_BYE_POLICIES.has(rules.byePolicy)) {
      issues.push(
        createMatchGenerationIssue({
          code: MATCH_GENERATION_ISSUE_CODE.UNSUPPORTED_GENERATION_POLICY,
          path: "evaluatedRules.byePolicy",
          message: "byePolicy is unsupported for Phase 1D",
          details: { byePolicy: rules.byePolicy ?? null },
        })
      );
    }

    const byeCount =
      typeof dims.byeCount === "number" ? dims.byeCount : null;
    if (
      byeCount !== null &&
      byeCount > 0 &&
      rules.byePolicy === BYE_POLICY.NONE
    ) {
      issues.push(
        createMatchGenerationIssue({
          code: MATCH_GENERATION_ISSUE_CODE.UNSUPPORTED_GENERATION_POLICY,
          path: "evaluatedRules.byePolicy",
          message:
            "byePolicy NONE cannot execute Single Elimination when B − N byes are required; Draw must allocate byes under TOP_SEEDS, BOTTOM_SEEDS, or EXPLICIT_PLACEMENTS",
          details: { byeCount, byePolicy: rules.byePolicy },
        })
      );
    }

    const third = rules.thirdPlacePolicy;
    if (
      third !== THIRD_PLACE_POLICY.NONE &&
      third !== THIRD_PLACE_POLICY.PLAYOFF
    ) {
      issues.push(
        createMatchGenerationIssue({
          code: MATCH_GENERATION_ISSUE_CODE.UNSUPPORTED_GENERATION_POLICY,
          path: "evaluatedRules.thirdPlacePolicy",
          message: "thirdPlacePolicy is unsupported for Phase 1D",
          details: { thirdPlacePolicy: third ?? null },
        })
      );
    }

    const consolation = rules.consolationOrPlacementPolicy;
    if (
      consolation != null &&
      String(consolation).trim() !== "" &&
      String(consolation).trim().toUpperCase() !== "NONE"
    ) {
      issues.push(
        createMatchGenerationIssue({
          code: MATCH_GENERATION_ISSUE_CODE.UNSUPPORTED_GENERATION_POLICY,
          path: "evaluatedRules.consolationOrPlacementPolicy",
          message:
            "Consolation/placement brackets beyond optional third-place are not supported in Phase 1D",
          details: { consolationOrPlacementPolicy: consolation },
        })
      );
    }

    if (rules.rematchRestrictions === true) {
      issues.push(
        createMatchGenerationIssue({
          code: MATCH_GENERATION_ISSUE_CODE.UNSUPPORTED_GENERATION_POLICY,
          path: "evaluatedRules.rematchRestrictions",
          message:
            "rematchRestrictions is not executable by Phase 1D Single Elimination",
        })
      );
    }

    if (rules.sameClubRestrictions === true) {
      issues.push(
        createMatchGenerationIssue({
          code: MATCH_GENERATION_ISSUE_CODE.UNSUPPORTED_GENERATION_POLICY,
          path: "evaluatedRules.sameClubRestrictions",
          message:
            "sameClubRestrictions is not executable by Phase 1D Single Elimination",
        })
      );
    }

    const constraints = Array.isArray(rules.formatSpecificConstraints)
      ? rules.formatSpecificConstraints
      : [];
    if (constraints.length > 0) {
      issues.push(
        createMatchGenerationIssue({
          code: MATCH_GENERATION_ISSUE_CODE.UNSUPPORTED_GENERATION_POLICY,
          path: "evaluatedRules.formatSpecificConstraints",
          message:
            "Unknown formatSpecificConstraints reached the Phase 1D executor",
          details: { constraints: [...constraints] },
        })
      );
    }
  }

  return sortMatchGenerationIssues(issues);
}
