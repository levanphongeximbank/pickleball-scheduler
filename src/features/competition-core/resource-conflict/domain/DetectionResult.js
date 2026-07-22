/**
 * CORE-14 — DetectionResult factory.
 * Does not overload a single ok field. No hidden timestamps.
 */

import { isEvaluationStatus, EVALUATION_STATUS } from "../enums/evaluationStatus.js";
import { isPlanStatus, PLAN_STATUS } from "../enums/planStatus.js";
import {
  isAvailabilityCertification,
  AVAILABILITY_CERTIFICATION,
} from "../enums/availabilityCertification.js";
import { DOMAIN_CONTRACT_ERROR_CODE } from "../enums/domainContractErrorCode.js";
import { ResourceConflictContractError } from "../errors/ResourceConflictContractError.js";
import { compareDiagnostics, compareFindings } from "../catalogs/severityPolicy.js";
import { fingerprintCore14Material } from "../deterministic/fingerprint.js";
import { SEVERITY } from "../enums/severity.js";

/**
 * Pure result factory — evaluationStatus and planStatus remain separate.
 *
 * @param {{
 *   evaluationStatus: string,
 *   planStatus: string,
 *   findings?: readonly object[],
 *   inputDiagnostics?: readonly object[],
 *   externalDiagnostics?: readonly object[],
 *   evaluatedOccupancyCount?: number,
 *   evaluatedResourceCount?: number,
 *   availabilityCertification?: string,
 *   recommendations?: readonly object[],
 *   deterministicFingerprint?: string | null,
 *   policyVersion?: string,
 *   availabilityMode?: string | null,
 *   metadata?: Record<string, unknown> | null,
 * }} input
 */
export function createDetectionResult(input) {
  if (!isEvaluationStatus(input?.evaluationStatus)) {
    throw new ResourceConflictContractError(
      DOMAIN_CONTRACT_ERROR_CODE.INVALID_EVALUATION_STATUS,
      "evaluationStatus must be a frozen EvaluationStatus value",
      { evaluationStatus: input?.evaluationStatus ?? null }
    );
  }
  if (!isPlanStatus(input?.planStatus)) {
    throw new ResourceConflictContractError(
      DOMAIN_CONTRACT_ERROR_CODE.INVALID_PLAN_STATUS,
      "planStatus must be a frozen PlanStatus value",
      { planStatus: input?.planStatus ?? null }
    );
  }

  const availabilityCertification = input.availabilityCertification == null
    ? AVAILABILITY_CERTIFICATION.NOT_EVALUATED
    : input.availabilityCertification;
  if (!isAvailabilityCertification(availabilityCertification)) {
    throw new ResourceConflictContractError(
      DOMAIN_CONTRACT_ERROR_CODE.INVALID_AVAILABILITY_CERTIFICATION,
      "availabilityCertification must be a frozen value",
      { availabilityCertification }
    );
  }

  const findings = [...(input.findings || [])].sort(compareFindings);
  const inputDiagnostics = [...(input.inputDiagnostics || [])].sort(compareDiagnostics);
  const externalDiagnostics = [...(input.externalDiagnostics || [])];
  const recommendations = [...(input.recommendations || [])];

  let hardFindingCount = 0;
  let softFindingCount = 0;
  for (const f of findings) {
    if (f?.severity === SEVERITY.HARD) hardFindingCount += 1;
    else if (f?.severity === SEVERITY.SOFT) softFindingCount += 1;
  }

  const evaluatedOccupancyCount =
    typeof input.evaluatedOccupancyCount === "number" && Number.isSafeInteger(input.evaluatedOccupancyCount)
      ? input.evaluatedOccupancyCount
      : 0;
  const evaluatedResourceCount =
    typeof input.evaluatedResourceCount === "number" && Number.isSafeInteger(input.evaluatedResourceCount)
      ? input.evaluatedResourceCount
      : 0;

  const policyVersion = input.policyVersion || "core14-detection-request-result-v1";
  const findingIds = findings.map((f) => String(f.findingId || "")).filter(Boolean);

  const deterministicFingerprint =
    typeof input.deterministicFingerprint === "string" && input.deterministicFingerprint.length > 0
      ? input.deterministicFingerprint
      : fingerprintCore14Material({
          policyVersion,
          availabilityMode: input.availabilityMode ?? null,
          availabilityCertification,
          sortedFindingIds: findingIds,
          hardFindingCount,
          softFindingCount,
          planStatus: input.planStatus,
          evaluationStatus: input.evaluationStatus,
          evaluatedOccupancyCount,
          evaluatedResourceCount,
        });

  return Object.freeze({
    evaluationStatus: input.evaluationStatus,
    planStatus: input.planStatus,
    findings: Object.freeze(findings),
    inputDiagnostics: Object.freeze(inputDiagnostics),
    externalDiagnostics: Object.freeze(externalDiagnostics),
    evaluatedOccupancyCount,
    evaluatedResourceCount,
    hardFindingCount,
    softFindingCount,
    unresolvedConflictCount: hardFindingCount,
    recommendationCount: recommendations.length,
    recommendations: Object.freeze(recommendations),
    availabilityCertification,
    deterministicFingerprint,
    metadata: input.metadata == null ? null : Object.freeze({ ...input.metadata }),
  });
}

/**
 * Convenience: rejected invalid input result (no ok field).
 * @param {readonly object[]} inputDiagnostics
 * @param {object} [extra]
 */
export function createRejectedInvalidInputResult(inputDiagnostics, extra = {}) {
  return createDetectionResult({
    evaluationStatus: EVALUATION_STATUS.REJECTED_INVALID_INPUT,
    planStatus: PLAN_STATUS.NOT_EVALUATED,
    findings: [],
    inputDiagnostics,
    availabilityCertification: AVAILABILITY_CERTIFICATION.NOT_EVALUATED,
    ...extra,
  });
}
