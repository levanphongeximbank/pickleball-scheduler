/**
 * CORE-19 adapter — CORE-01 Rule Engine / Constraints guard mapping.
 *
 * Imports only from the CORE-01 public barrel.
 * May execute pure evaluation explicitly; does not persist or mutate.
 */

import {
  evaluateCandidate,
  evaluateCanonicalRules,
  evaluateHardRules,
  RULES_DECISION_STATUS,
} from "../../constraints/index.js";
import { WORKFLOW_ERROR_CODE } from "../errors/workflowErrorCodes.js";
import { createTransitionGuardDecision } from "../contracts/workflowDecisions.js";
import {
  compareStableString,
  isPlainObject,
} from "../utils/canonicalizeWorkflowPayload.js";

const DEPENDENCY = "core-01:constraints";

/**
 * @param {unknown} evaluation
 * @returns {string|null}
 */
function resolveDecisionStatus(evaluation) {
  if (!isPlainObject(evaluation)) return null;
  if (typeof evaluation.decisionStatus === "string") return evaluation.decisionStatus;
  if (isPlainObject(evaluation.validation) && evaluation.validation.ok === false) {
    if (Array.isArray(evaluation.conflicts) && evaluation.conflicts.length > 0) {
      return RULES_DECISION_STATUS.CONFLICT;
    }
    return RULES_DECISION_STATUS.REJECTED;
  }
  if (evaluation.feasible === false || evaluation.eligible === false) {
    return RULES_DECISION_STATUS.REJECTED;
  }
  if (
    Array.isArray(evaluation.hardViolations) &&
    evaluation.hardViolations.length > 0
  ) {
    return RULES_DECISION_STATUS.REJECTED;
  }
  if (Array.isArray(evaluation.conflicts) && evaluation.conflicts.length > 0) {
    return RULES_DECISION_STATUS.CONFLICT;
  }
  if (typeof evaluation.softScore === "number" && evaluation.feasible !== false) {
    return RULES_DECISION_STATUS.SCORED;
  }
  return RULES_DECISION_STATUS.ACCEPTED;
}

/**
 * @param {unknown} evaluation
 * @returns {string[]}
 */
function collectExplanations(evaluation) {
  if (!isPlainObject(evaluation)) return [];
  const out = [];
  for (const item of evaluation.hardViolations || []) {
    out.push(
      String(item?.reasonCode || item?.code || item?.message || "HARD_VIOLATION")
    );
  }
  for (const item of evaluation.conflicts || []) {
    out.push(String(item?.code || item?.message || "CONFLICT"));
  }
  for (const item of evaluation.explanations || []) {
    out.push(String(item?.code || item?.reasonCode || item?.message || "EXPLANATION"));
  }
  for (const item of evaluation.softNotes || []) {
    out.push(String(item?.code || item?.reasonCode || item?.message || "SOFT_NOTE"));
  }
  return [...new Set(out.map(String))].sort(compareStableString);
}

/**
 * @param {unknown} evaluation
 * @returns {string[]}
 */
function collectRuleCodes(evaluation) {
  if (!isPlainObject(evaluation)) return [];
  const codes = [];
  for (const item of [
    ...(evaluation.hardViolations || []),
    ...(evaluation.conflicts || []),
    ...(evaluation.explanations || []),
  ]) {
    const code = item?.reasonCode || item?.code || item?.ruleCode;
    if (code != null && String(code).length > 0) codes.push(String(code));
  }
  return [...new Set(codes)].sort(compareStableString);
}

/**
 * Map CORE-01 evaluation output into TransitionGuardDecision.
 *
 * Blocking: rejection, conflict, failed hard constraint, ineligibility.
 * Soft/advisory remains warning unless mandatoryBlocking is true.
 *
 * @param {object} [input]
 * @param {object} [input.evaluation] — precomputed CORE-01 evaluation
 * @param {object} [input.candidate]
 * @param {object|array} [input.ruleSet]
 * @param {object} [input.context]
 * @param {object} [input.options]
 * @param {"evaluateCandidate"|"evaluateCanonicalRules"|"evaluateHardRules"} [input.mode]
 * @param {boolean} [input.mandatoryBlocking] — when true, soft/advisory may hard-deny only if evaluation already hard-fails; soft scores still never invent hard denial
 * @param {string|null} [input.operation]
 * @param {string|null} [input.decisionId]
 * @returns {Readonly<import('../contracts/workflowDecisions.js').TransitionGuardDecision>}
 */
export function adaptCore01GuardDecision(input = {}) {
  const source = isPlainObject(input) ? input : {};
  let evaluation = source.evaluation;

  if (!isPlainObject(evaluation)) {
    const mode = source.mode || "evaluateCandidate";
    if (mode === "evaluateCanonicalRules") {
      evaluation = evaluateCanonicalRules(
        source.ruleSet,
        source.context || {},
        source.options || {}
      );
    } else if (mode === "evaluateHardRules") {
      const hardResult = evaluateHardRules(
        source.ruleSet || source.constraints || [],
        source.context || {}
      );
      const violations = Array.isArray(hardResult)
        ? hardResult
        : hardResult?.violations || hardResult?.hardViolations || [];
      evaluation = {
        feasible: hardResult?.feasible !== false && violations.length === 0,
        eligible: true,
        hardViolations: violations,
        softScore: 0,
        softNotes: [],
        explanations: violations,
        validation: { ok: violations.length === 0 },
        engineVersion: hardResult?.engineVersion ?? null,
      };
    } else if (source.candidate != null) {
      evaluation = evaluateCandidate(
        source.candidate,
        source.ruleSet,
        source.context || {},
        source.options || {}
      );
    } else {
      evaluation = {};
    }
  }

  const decisionStatus = resolveDecisionStatus(evaluation);
  const explanations = collectExplanations(evaluation);
  const ruleCodes = collectRuleCodes(evaluation);
  const softScore =
    typeof evaluation.softScore === "number" ? evaluation.softScore : null;

  const hardBlock =
    decisionStatus === RULES_DECISION_STATUS.REJECTED ||
    decisionStatus === RULES_DECISION_STATUS.CONFLICT ||
    evaluation.feasible === false ||
    evaluation.eligible === false ||
    (Array.isArray(evaluation.hardViolations) &&
      evaluation.hardViolations.length > 0) ||
    (Array.isArray(evaluation.conflicts) && evaluation.conflicts.length > 0) ||
    (isPlainObject(evaluation.validation) && evaluation.validation.ok === false);

  const advisory =
    !hardBlock &&
    (decisionStatus === RULES_DECISION_STATUS.SCORED ||
      decisionStatus === RULES_DECISION_STATUS.REQUIRES_REVIEW ||
      softScore != null ||
      (Array.isArray(evaluation.softNotes) && evaluation.softNotes.length > 0));

  // Soft/advisory never silently hard-denies. mandatoryBlocking only applies to
  // already-hard outcomes; it does not convert soft scores into rejection.
  const allowed = !hardBlock;

  const warnings = advisory
    ? Object.freeze(
        [
          ...explanations,
          softScore != null ? `SOFT_SCORE:${softScore}` : null,
        ]
          .filter(Boolean)
          .sort(compareStableString)
      )
    : Object.freeze([]);

  const message = hardBlock
    ? explanations[0] ||
      `CORE-01 guard denied (${decisionStatus || "REJECTED"})`
    : advisory
      ? explanations[0] ||
        `CORE-01 advisory/soft result (${decisionStatus || "SCORED"})`
      : "CORE-01 guard allowed";

  return createTransitionGuardDecision({
    allowed,
    code: hardBlock
      ? WORKFLOW_ERROR_CODE.GUARD_REJECTED
      : decisionStatus || RULES_DECISION_STATUS.ACCEPTED,
    message,
    dependencyRef: DEPENDENCY,
    details: {
      dependency: DEPENDENCY,
      dependencyCode: hardBlock
        ? WORKFLOW_ERROR_CODE.GUARD_REJECTED
        : decisionStatus,
      decisionId: source.decisionId != null ? String(source.decisionId) : null,
      decisionStatus,
      operation: source.operation != null ? String(source.operation) : null,
      ruleCodes: Object.freeze(ruleCodes),
      explanation: Object.freeze(explanations),
      explanations: Object.freeze(explanations),
      softScore,
      advisory: advisory === true,
      soft: advisory === true,
      warning: advisory === true,
      warnings,
      hardDenial: hardBlock === true,
      mandatoryBlocking: source.mandatoryBlocking === true,
      feasible: evaluation.feasible !== false,
      eligible: evaluation.eligible !== false,
      engineVersion: evaluation.engineVersion ?? null,
      ruleSetId: evaluation.ruleSetId ?? null,
      ruleSetVersion: evaluation.ruleSetVersion ?? null,
    },
  });
}
