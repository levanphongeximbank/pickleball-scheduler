/**
 * CORE-09 Phase 1C — validate bound EvaluatedMatchGenerationRules for RR executors.
 */

import {
  ROUND_ROBIN_MODE,
  BYE_POLICY,
} from "../contracts/evaluatedMatchGenerationRules.js";
import { createMatchGenerationIssue } from "../contracts/matchGenerationIssue.js";
import { MATCH_GENERATION_STRATEGY } from "../enums/matchGenerationStrategy.js";
import { MATCH_GENERATION_ISSUE_CODE } from "../errors/matchGenerationIssueCodes.js";
import { sortMatchGenerationIssues } from "./asciiCompare.js";

/** Strategies with Phase 1C executors. */
export const PHASE_1C_EXECUTABLE_STRATEGIES = Object.freeze(
  new Set([
    MATCH_GENERATION_STRATEGY.ROUND_ROBIN,
    MATCH_GENERATION_STRATEGY.GROUP_ROUND_ROBIN,
  ])
);

/**
 * @param {import('../contracts/matchGenerationRequest.js').MatchGenerationRequest} request
 * @param {import('../contracts/evaluatedMatchGenerationRules.js').EvaluatedMatchGenerationRules} rules
 * @returns {import('../contracts/matchGenerationIssue.js').MatchGenerationIssue[]}
 */
export function validateRoundRobinRuleBinding(request, rules) {
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

  if (!PHASE_1C_EXECUTABLE_STRATEGIES.has(strategy)) {
    issues.push(
      createMatchGenerationIssue({
        code: MATCH_GENERATION_ISSUE_CODE.STRATEGY_UNSUPPORTED,
        path: "strategy",
        message: "Phase 1C executor does not support this strategy",
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

  if (
    strategy === MATCH_GENERATION_STRATEGY.ROUND_ROBIN ||
    strategy === MATCH_GENERATION_STRATEGY.GROUP_ROUND_ROBIN
  ) {
    const mode = rules.roundRobinMode;
    if (
      mode !== ROUND_ROBIN_MODE.SINGLE &&
      mode !== ROUND_ROBIN_MODE.DOUBLE
    ) {
      issues.push(
        createMatchGenerationIssue({
          code: MATCH_GENERATION_ISSUE_CODE.ROUND_ROBIN_MODE_UNSUPPORTED,
          path: "evaluatedRules.roundRobinMode",
          message: "Round robin mode is unsupported for Phase 1C",
          details: { roundRobinMode: mode ?? null },
        })
      );
    }

    const encounterCount = rules.encounterCount;
    if (
      typeof encounterCount !== "number" ||
      !Number.isInteger(encounterCount) ||
      (encounterCount !== 1 && encounterCount !== 2)
    ) {
      issues.push(
        createMatchGenerationIssue({
          code: MATCH_GENERATION_ISSUE_CODE.ENCOUNTER_COUNT_UNSUPPORTED,
          path: "evaluatedRules.encounterCount",
          message: "Encounter count is unsupported for Phase 1C",
          details: { encounterCount: encounterCount ?? null },
        })
      );
    } else if (mode === ROUND_ROBIN_MODE.SINGLE && encounterCount !== 1) {
      issues.push(
        createMatchGenerationIssue({
          code: MATCH_GENERATION_ISSUE_CODE.ENCOUNTER_COUNT_UNSUPPORTED,
          path: "evaluatedRules.encounterCount",
          message: "SINGLE roundRobinMode requires encounterCount 1",
          details: { roundRobinMode: mode, encounterCount },
        })
      );
    } else if (mode === ROUND_ROBIN_MODE.DOUBLE && encounterCount !== 2) {
      issues.push(
        createMatchGenerationIssue({
          code: MATCH_GENERATION_ISSUE_CODE.ENCOUNTER_COUNT_UNSUPPORTED,
          path: "evaluatedRules.encounterCount",
          message: "DOUBLE roundRobinMode requires encounterCount 2",
          details: { roundRobinMode: mode, encounterCount },
        })
      );
    }

    if (mode === ROUND_ROBIN_MODE.DOUBLE && rules.rematchRestrictions === true) {
      issues.push(
        createMatchGenerationIssue({
          code: MATCH_GENERATION_ISSUE_CODE.UNSUPPORTED_GENERATION_POLICY,
          path: "evaluatedRules.rematchRestrictions",
          message:
            "rematchRestrictions forbids double round-robin rematch generation",
        })
      );
    }

    if (rules.sameClubRestrictions === true) {
      issues.push(
        createMatchGenerationIssue({
          code: MATCH_GENERATION_ISSUE_CODE.UNSUPPORTED_GENERATION_POLICY,
          path: "evaluatedRules.sameClubRestrictions",
          message:
            "sameClubRestrictions is not executable by Phase 1C Match Generator",
        })
      );
    }

    if (rules.byePolicy !== BYE_POLICY.NONE) {
      issues.push(
        createMatchGenerationIssue({
          code: MATCH_GENERATION_ISSUE_CODE.UNSUPPORTED_GENERATION_POLICY,
          path: "evaluatedRules.byePolicy",
          message:
            "Phase 1C round robin uses deterministic circle bye rotation only (byePolicy NONE)",
          details: { byePolicy: rules.byePolicy },
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
            "Unknown formatSpecificConstraints reached the Phase 1C executor",
          details: { constraints: [...constraints] },
        })
      );
    }
  }

  return sortMatchGenerationIssues(issues);
}

/**
 * @param {import('../contracts/evaluatedMatchGenerationRules.js').EvaluatedMatchGenerationRules} rules
 * @returns {{ legs: 1|2, encounterCount: 1|2 }}
 */
export function resolveRoundRobinLegs(rules) {
  const mode = rules.roundRobinMode;
  const encounterCount = rules.encounterCount;
  if (mode === ROUND_ROBIN_MODE.DOUBLE || encounterCount === 2) {
    return { legs: 2, encounterCount: 2 };
  }
  return { legs: 1, encounterCount: 1 };
}
