/**
 * CORE-19 — compose guard decisions.
 * Distinguishes hard denial from advisory/warning output.
 * Does not convert soft scores into hard rejections.
 */

import { WORKFLOW_ERROR_CODE } from "../errors/workflowErrorCodes.js";
import { createTransitionGuardDecision } from "../contracts/workflowDecisions.js";
import {
  compareStableString,
  isPlainObject,
} from "../utils/canonicalizeWorkflowPayload.js";

/**
 * @param {unknown} decision
 * @returns {boolean}
 */
function isMandatory(decision) {
  if (!isPlainObject(decision)) return true;
  if (decision.mandatory === false) return false;
  if (isPlainObject(decision.details) && decision.details.mandatory === false) {
    return false;
  }
  if (isPlainObject(decision.details) && decision.details.blocking === false) {
    return false;
  }
  return true;
}

/**
 * Soft/advisory signals must not become hard denials unless explicitly mandatory+blocking.
 * @param {unknown} decision
 * @returns {boolean}
 */
function isAdvisoryOnly(decision) {
  if (!isPlainObject(decision)) return false;
  const details = isPlainObject(decision.details) ? decision.details : {};
  if (details.advisory === true) return true;
  if (details.soft === true) return true;
  if (details.warning === true && decision.allowed === true) return true;
  if (details.decisionStatus === "SCORED" || details.decisionStatus === "REQUIRES_REVIEW") {
    return decision.allowed !== false || isMandatory(decision) === false;
  }
  return false;
}

/**
 * @param {unknown} value
 * @returns {string}
 */
function decisionSortKey(value) {
  if (!isPlainObject(value)) return "";
  return [
    String(value.code ?? ""),
    String(value.dependencyRef ?? ""),
    String(value.details?.decisionId ?? ""),
    String(value.message ?? ""),
  ].join("|");
}

/**
 * @param {unknown} decisions
 * @returns {unknown[]}
 */
function toList(decisions) {
  if (decisions == null) return [];
  if (Array.isArray(decisions)) return decisions;
  if (isPlainObject(decisions) && Array.isArray(decisions.decisions)) {
    return decisions.decisions;
  }
  if (isPlainObject(decisions)) return [decisions];
  return [];
}

/**
 * @typedef {Object} ComposedGuardDecisions
 * @property {boolean} allowed
 * @property {ReadonlyArray<import('../contracts/workflowDecisions.js').TransitionGuardDecision>} decisions
 * @property {ReadonlyArray<string>} warnings
 * @property {ReadonlyArray<string>} blockingReasons
 * @property {ReadonlyArray<string>} dependencyReferences
 * @property {Readonly<import('../contracts/workflowDecisions.js').TransitionGuardDecision>} summary
 */

/**
 * Compose guard decisions.
 *
 * @param {unknown} decisions
 * @returns {Readonly<ComposedGuardDecisions>}
 */
export function composeGuardDecisions(decisions) {
  const list = toList(decisions).filter((item) => item != null);

  const prepared = list
    .map((item) => ({
      raw: item,
      decision: createTransitionGuardDecision(item),
      mandatory: isMandatory(item),
      advisory: isAdvisoryOnly(item),
    }))
    .sort((a, b) =>
      compareStableString(decisionSortKey(a.decision), decisionSortKey(b.decision))
    );

  const normalized = Object.freeze(prepared.map((item) => item.decision));

  const warnings = [];
  for (const item of prepared) {
    if (item.advisory || item.decision.details?.warning === true) {
      warnings.push(
        item.decision.message || item.decision.code || "Guard advisory"
      );
    }
    const detailWarnings = item.decision.details?.warnings;
    if (Array.isArray(detailWarnings)) {
      for (const w of detailWarnings) warnings.push(String(w));
    }
    // Soft score notes preserved as warnings, never as hard denial by composition alone.
    if (
      item.decision.allowed === true &&
      typeof item.decision.details?.softScore === "number"
    ) {
      warnings.push(
        item.decision.message ||
          item.decision.code ||
          `Soft score ${item.decision.details.softScore}`
      );
    }
  }
  const stableWarnings = Object.freeze(
    [...new Set(warnings.map(String))].sort(compareStableString)
  );

  const hardDenials = prepared.filter((item) => {
    if (item.decision.allowed === true) return false;
    if (item.advisory && item.mandatory === false) return false;
    // Soft/advisory without explicit mandatory blocking must not hard-deny.
    if (
      item.advisory &&
      item.raw?.details?.blocking !== true &&
      item.raw?.mandatory !== true
    ) {
      return false;
    }
    return item.mandatory;
  });

  const blockingReasons = Object.freeze(
    hardDenials
      .map(
        (item) =>
          item.decision.message || item.decision.code || "Guard rejected"
      )
      .sort(compareStableString)
  );

  const dependencyReferences = Object.freeze(
    [
      ...new Set(
        hardDenials
          .map((item) => item.decision.dependencyRef)
          .filter((ref) => typeof ref === "string" && ref.length > 0)
      ),
    ].sort(compareStableString)
  );

  const allowed = hardDenials.length === 0;

  const summary = createTransitionGuardDecision({
    allowed,
    code: allowed ? "GUARDS_ALLOWED" : WORKFLOW_ERROR_CODE.GUARD_REJECTED,
    message: allowed
      ? "All mandatory guards allow the transition"
      : "One or more mandatory guards rejected the transition",
    dependencyRef: dependencyReferences[0] || null,
    details: {
      dependency: "guards",
      dependencyCode: allowed ? null : WORKFLOW_ERROR_CODE.GUARD_REJECTED,
      blockingReasons,
      warnings: stableWarnings,
      dependencyReferences,
      composedCount: prepared.length,
      hardDenial: allowed !== true,
      advisoryOnly: allowed === true && stableWarnings.length > 0,
    },
  });

  return Object.freeze({
    allowed,
    decisions: normalized,
    warnings: stableWarnings,
    blockingReasons,
    dependencyReferences,
    summary,
  });
}
