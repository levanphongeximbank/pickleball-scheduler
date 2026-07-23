/**
 * CORE-19 — compose prerequisite results.
 * Aggregates only; does not run dependency calculations.
 */

import { WORKFLOW_ERROR_CODE } from "../errors/workflowErrorCodes.js";
import { createTransitionPrerequisiteResult } from "../contracts/workflowDecisions.js";
import {
  compareStableString,
  isPlainObject,
} from "../utils/canonicalizeWorkflowPayload.js";

/**
 * @param {unknown} result
 * @returns {boolean}
 */
function isMandatory(result) {
  if (!isPlainObject(result)) return true;
  if (result.mandatory === false) return false;
  if (isPlainObject(result.details) && result.details.mandatory === false) {
    return false;
  }
  if (isPlainObject(result.details) && result.details.blocking === false) {
    return false;
  }
  return true;
}

/**
 * @param {unknown} result
 * @returns {boolean}
 */
function isNonBlockingWarning(result) {
  if (!isPlainObject(result)) return false;
  if (result.satisfied === true && result.details?.warning === true) return true;
  if (result.satisfied === true && result.details?.nonBlocking === true) return true;
  if (
    result.satisfied !== true &&
    isMandatory(result) === false &&
    (result.code || result.message)
  ) {
    return true;
  }
  return false;
}

/**
 * @param {unknown} value
 * @returns {string}
 */
function resultSortKey(value) {
  if (!isPlainObject(value)) return "";
  return [
    String(value.code ?? ""),
    String(value.dependencyRef ?? ""),
    String(value.details?.prerequisiteId ?? ""),
    String(value.message ?? ""),
  ].join("|");
}

/**
 * @param {unknown} results
 * @returns {unknown[]}
 */
function toList(results) {
  if (results == null) return [];
  if (Array.isArray(results)) return results;
  if (isPlainObject(results) && Array.isArray(results.results)) {
    return results.results;
  }
  if (isPlainObject(results)) return [results];
  return [];
}

/**
 * @typedef {Object} ComposedPrerequisiteResults
 * @property {boolean} satisfied
 * @property {ReadonlyArray<import('../contracts/workflowDecisions.js').TransitionPrerequisiteResult>} results
 * @property {ReadonlyArray<string>} warnings
 * @property {ReadonlyArray<string>} failedPrerequisiteIds
 * @property {ReadonlyArray<string>} dependencyReferences
 * @property {ReadonlyArray<string>} errorCodes
 * @property {ReadonlyArray<string>} blockingReasons
 * @property {Readonly<import('../contracts/workflowDecisions.js').TransitionPrerequisiteResult>} summary
 */

/**
 * Compose prerequisite results.
 *
 * @param {unknown} results
 * @returns {Readonly<ComposedPrerequisiteResults>}
 */
export function composePrerequisiteResults(results) {
  const list = toList(results).filter((item) => item != null);

  const prepared = list
    .map((item) => ({
      raw: item,
      result: createTransitionPrerequisiteResult(item),
      mandatory: isMandatory(item),
      warningOnly: isNonBlockingWarning(item),
    }))
    .sort((a, b) =>
      compareStableString(resultSortKey(a.result), resultSortKey(b.result))
    );

  const normalizedResults = Object.freeze(prepared.map((item) => item.result));

  const warnings = [];
  for (const item of prepared) {
    if (item.warningOnly) {
      warnings.push(
        item.result.message || item.result.code || "Prerequisite warning"
      );
    }
    const detailWarnings = item.result.details?.warnings;
    if (Array.isArray(detailWarnings)) {
      for (const w of detailWarnings) {
        warnings.push(String(w));
      }
    }
  }
  const stableWarnings = Object.freeze(
    [...new Set(warnings.map(String))].sort(compareStableString)
  );

  const failures = prepared.filter(
    (item) => item.mandatory && item.result.satisfied !== true && !item.warningOnly
  );

  const failedPrerequisiteIds = Object.freeze(
    failures
      .map((item) =>
        item.result.details?.prerequisiteId != null
          ? String(item.result.details.prerequisiteId)
          : item.result.code
      )
      .filter(Boolean)
      .sort(compareStableString)
  );

  const dependencyReferences = Object.freeze(
    [
      ...new Set(
        failures
          .map((item) => item.result.dependencyRef)
          .filter((ref) => typeof ref === "string" && ref.length > 0)
      ),
    ].sort(compareStableString)
  );

  const errorCodes = Object.freeze(
    failures
      .map((item) => item.result.code)
      .filter(Boolean)
      .sort(compareStableString)
  );

  const blockingReasons = Object.freeze(
    failures
      .map(
        (item) =>
          item.result.message || item.result.code || "Prerequisite not satisfied"
      )
      .sort(compareStableString)
  );

  const satisfied = failures.length === 0;

  const summary = createTransitionPrerequisiteResult({
    satisfied,
    code: satisfied
      ? "PREREQUISITES_SATISFIED"
      : WORKFLOW_ERROR_CODE.PREREQUISITE_NOT_SATISFIED,
    message: satisfied
      ? "All mandatory prerequisites satisfied"
      : "One or more mandatory prerequisites are not satisfied",
    dependencyRef: dependencyReferences[0] || null,
    details: {
      dependency: "prerequisites",
      dependencyCode: satisfied
        ? null
        : WORKFLOW_ERROR_CODE.PREREQUISITE_NOT_SATISFIED,
      failedPrerequisiteIds,
      dependencyReferences,
      errorCodes,
      blockingReasons,
      warnings: stableWarnings,
      composedCount: prepared.length,
    },
  });

  return Object.freeze({
    satisfied,
    results: normalizedResults,
    warnings: stableWarnings,
    failedPrerequisiteIds,
    dependencyReferences,
    errorCodes,
    blockingReasons,
    summary,
  });
}
