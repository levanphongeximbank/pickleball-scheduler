/**
 * CORE-19 adapter — CORE-17 Result Validation gate mapping.
 *
 * Imports only from the CORE-17 public barrel.
 * Never calls state-changing finalization/acceptance commands.
 */

import {
  ACCEPTANCE_STATUS,
  LINEAGE_STATUS,
  RESULT_TYPE,
  isStandingsSafe,
  isScoreDifferentialEligible,
  resolveSideIdentity,
  ACCEPTANCE_FORBIDDEN_RESULT_TYPES,
} from "../../result-validation/index.js";
import { WORKFLOW_ERROR_CODE } from "../errors/workflowErrorCodes.js";
import { createTransitionPrerequisiteResult } from "../contracts/workflowDecisions.js";
import {
  compareStableString,
  isPlainObject,
} from "../utils/canonicalizeWorkflowPayload.js";

const DEPENDENCY = "core-17:result-validation";

/**
 * @param {unknown} result
 * @returns {string[]}
 */
function collectSideIssues(result) {
  if (!isPlainObject(result)) return ["Result shape missing"];
  const issues = [];
  const sideA = result.sideA || result.sides?.A || result.sides?.sideA;
  const sideB = result.sideB || result.sides?.B || result.sides?.sideB;
  if (sideA != null || sideB != null) {
    if (sideA != null && resolveSideIdentity(sideA) == null) {
      issues.push("Side A identity unresolved");
    }
    if (sideB != null && resolveSideIdentity(sideB) == null) {
      issues.push("Side B identity unresolved");
    }
  } else if (
    result.requireSideIdentity === true ||
    result.details?.requireSideIdentity === true
  ) {
    issues.push("Side identity required but bindings absent");
  }
  return issues.sort(compareStableString);
}

/**
 * Map a canonical validated result into a workflow gate prerequisite.
 *
 * @param {object} [input]
 * @param {object} [input.result]
 * @param {object} [input.validatedResult]
 * @param {string|null} [input.prerequisiteId]
 * @param {boolean} [input.requireSideIdentity]
 * @returns {Readonly<import('../contracts/workflowDecisions.js').TransitionPrerequisiteResult>}
 */
export function adaptCore17ResultValidationGate(input = {}) {
  const source = isPlainObject(input) ? input : {};
  const result =
    (isPlainObject(source.result) && source.result) ||
    (isPlainObject(source.validatedResult) && source.validatedResult) ||
    null;

  if (!result) {
    return createTransitionPrerequisiteResult({
      satisfied: false,
      code: WORKFLOW_ERROR_CODE.PREREQUISITE_NOT_SATISFIED,
      message: "Validated result is required for CORE-17 gate",
      dependencyRef: DEPENDENCY,
      details: {
        dependency: DEPENDENCY,
        dependencyCode: WORKFLOW_ERROR_CODE.PREREQUISITE_NOT_SATISFIED,
        prerequisiteId:
          source.prerequisiteId != null ? String(source.prerequisiteId) : null,
        blockingReasons: Object.freeze(["Validated result missing"]),
        warnings: Object.freeze([]),
      },
    });
  }

  const acceptanceStatus =
    result.acceptanceStatus != null ? String(result.acceptanceStatus) : null;
  const lineageStatus =
    result.lineageStatus != null ? String(result.lineageStatus) : null;
  const resultType = result.resultType != null ? String(result.resultType) : null;

  const blockingReasons = [];

  if (acceptanceStatus === ACCEPTANCE_STATUS.PENDING) {
    blockingReasons.push("Acceptance status is PENDING");
  }
  if (acceptanceStatus === ACCEPTANCE_STATUS.REJECTED) {
    blockingReasons.push("Acceptance status is REJECTED");
  }
  if (acceptanceStatus === ACCEPTANCE_STATUS.CORRECTION_REQUIRED) {
    blockingReasons.push("Acceptance status is CORRECTION_REQUIRED");
  }
  if (acceptanceStatus === ACCEPTANCE_STATUS.SUPERSEDED) {
    blockingReasons.push("Acceptance status is SUPERSEDED");
  }

  if (
    lineageStatus === LINEAGE_STATUS.SUPERSEDED ||
    (lineageStatus != null && lineageStatus !== LINEAGE_STATUS.ACTIVE)
  ) {
    blockingReasons.push(`Lineage status is ${lineageStatus}`);
  }

  if (resultType && ACCEPTANCE_FORBIDDEN_RESULT_TYPES.includes(resultType)) {
    blockingReasons.push(
      `Result type ${resultType} is forbidden for standings progression`
    );
  }

  const standingsSafe = isStandingsSafe(result);
  if (!standingsSafe) {
    blockingReasons.push("Result is not standings-safe");
  }

  const requireSideIdentity = source.requireSideIdentity === true;
  const sideIssues = requireSideIdentity
    ? collectSideIssues({
        ...result,
        requireSideIdentity: true,
      })
    : collectSideIssues(result).filter((msg) =>
        /unresolved/i.test(msg)
      );
  // Only block on unresolved sides when bindings were supplied or explicitly required.
  if (requireSideIdentity || result.sideA != null || result.sideB != null) {
    blockingReasons.push(...sideIssues);
  }

  const stableBlocking = Object.freeze(
    [...new Set(blockingReasons.map(String))].sort(compareStableString)
  );

  const satisfied =
    stableBlocking.length === 0 &&
    acceptanceStatus === ACCEPTANCE_STATUS.ACCEPTED &&
    lineageStatus === LINEAGE_STATUS.ACTIVE &&
    standingsSafe;

  const validationErrorCodes = Object.freeze(
    [
      ...(Array.isArray(result.validationErrorCodes)
        ? result.validationErrorCodes
        : []),
      ...(Array.isArray(result.errorCodes) ? result.errorCodes : []),
      result.errorCode,
      result.code,
    ]
      .filter(Boolean)
      .map(String)
      .sort(compareStableString)
  );

  return createTransitionPrerequisiteResult({
    satisfied,
    code: satisfied
      ? "RESULT_VALIDATION_GATE_PASSED"
      : WORKFLOW_ERROR_CODE.PREREQUISITE_NOT_SATISFIED,
    message: satisfied
      ? "Validated result is accepted, active, and standings-safe"
      : stableBlocking[0] || "Result validation gate blocked progression",
    dependencyRef: DEPENDENCY,
    details: {
      dependency: DEPENDENCY,
      dependencyCode: satisfied
        ? null
        : WORKFLOW_ERROR_CODE.PREREQUISITE_NOT_SATISFIED,
      prerequisiteId:
        source.prerequisiteId != null ? String(source.prerequisiteId) : null,
      acceptanceStatus,
      lineageStatus,
      resultType,
      outcome: result.outcome ?? null,
      technicalSubtype: result.technicalSubtype ?? null,
      standingsSafe,
      scoreDifferentialEligible: isScoreDifferentialEligible(result),
      validatedResultId: result.validatedResultId ?? result.resultId ?? null,
      matchId: result.matchId ?? null,
      validationErrorCodes,
      blockingReasons: stableBlocking,
      warnings: Object.freeze([]),
      // Reference enums without redefining them.
      acceptedStatus: ACCEPTANCE_STATUS.ACCEPTED,
      activeLineage: LINEAGE_STATUS.ACTIVE,
      completedResultType: RESULT_TYPE.COMPLETED,
    },
  });
}
