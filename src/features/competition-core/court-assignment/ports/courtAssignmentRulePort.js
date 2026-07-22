/**
 * CORE-12 — CourtAssignmentRulePort (read-only; no second rule engine).
 * Phase 1B: contract + test doubles only.
 */

export const COURT_ASSIGNMENT_RULE_PORT_METHODS = Object.freeze([
  "resolveEvaluatedRules",
]);

/**
 * @returns {{ resolveEvaluatedRules: (request: unknown) => object }}
 */
export function createEmptyCourtAssignmentRulePort() {
  return Object.freeze({
    resolveEvaluatedRules(_request) {
      return Object.freeze({
        ruleSetId: null,
        ruleSetVersion: null,
        ruleEvaluationFingerprint: null,
        hardConstraints: Object.freeze([]),
        softConstraints: Object.freeze([]),
      });
    },
  });
}

/**
 * @param {object} rules
 */
export function createFixedCourtAssignmentRulePort(rules) {
  const frozen = Object.freeze({ ...rules });
  return Object.freeze({
    resolveEvaluatedRules(_request) {
      return frozen;
    },
  });
}
