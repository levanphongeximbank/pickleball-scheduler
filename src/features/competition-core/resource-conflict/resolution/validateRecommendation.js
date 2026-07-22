/**
 * CORE-14 Phase 1E — dry-run recommendation validation (pure).
 * Does not call recommendation generation. Does not mutate caller data.
 */

import { SEVERITY } from "../enums/severity.js";
import { EVALUATION_STATUS } from "../enums/evaluationStatus.js";
import { INPUT_DIAGNOSTIC_CODE } from "../enums/diagnosticCode.js";
import { fingerprintCore14Material } from "../deterministic/fingerprint.js";
import { sortIdentifiers, compareUtf8Bytewise } from "../deterministic/compare.js";
import { createInputDiagnostic } from "../domain/InputDiagnostic.js";
import { detectResourceConflicts } from "../services/detectResourceConflicts.js";
import {
  isResolutionActionType,
  isNonMutatingActionType,
} from "./actionTypes.js";
import { projectRecommendation, indexOccupanciesById } from "./projectRecommendation.js";
import { compareFindingsWithContinuity } from "./rootConflictContinuityKey.js";

export const RESOLUTION_VALIDATION_STATUS = Object.freeze({
  COMPLETED: "COMPLETED",
  REJECTED_INVALID_RECOMMENDATION: "REJECTED_INVALID_RECOMMENDATION",
  DATA_UNAVAILABLE: "DATA_UNAVAILABLE",
  UNSUPPORTED: "UNSUPPORTED",
});

export const RESOLUTION_VALIDATION_STATUS_VALUES = Object.freeze([
  RESOLUTION_VALIDATION_STATUS.COMPLETED,
  RESOLUTION_VALIDATION_STATUS.REJECTED_INVALID_RECOMMENDATION,
  RESOLUTION_VALIDATION_STATUS.DATA_UNAVAILABLE,
  RESOLUTION_VALIDATION_STATUS.UNSUPPORTED,
]);

/**
 * @param {object} partial
 */
function createValidationResult(partial) {
  const secondaryHardConflictIds = Object.freeze(
    sortIdentifiers(partial.secondaryHardConflictIds || [])
  );
  const secondarySoftFindingIds = Object.freeze(
    sortIdentifiers(partial.secondarySoftFindingIds || [])
  );
  const resolvedConflictIds = Object.freeze(sortIdentifiers(partial.resolvedConflictIds || []));
  const unresolvedConflictIds = Object.freeze(
    sortIdentifiers(partial.unresolvedConflictIds || [])
  );
  const secondaryConflictIds = Object.freeze(
    sortIdentifiers(partial.secondaryConflictIds || [])
  );

  const evaluationStatus =
    partial.evaluationStatus || RESOLUTION_VALIDATION_STATUS.REJECTED_INVALID_RECOMMENDATION;
  const originalConflictsResolved = partial.originalConflictsResolved === true;
  const affectsLockedAssignments = partial.affectsLockedAssignments === true;
  const affectsPublishedAssignments = partial.affectsPublishedAssignments === true;
  const crossesScopeBoundary = partial.crossesScopeBoundary === true;
  const exceedsMaximumShift = partial.exceedsMaximumShift === true;
  const exceedsMaximumChangedAssignments =
    partial.exceedsMaximumChangedAssignments === true;
  const violatesAllowedActionPolicy = partial.violatesAllowedActionPolicy === true;
  const requiresManualApproval =
    partial.requiresManualApproval === true ||
    affectsLockedAssignments ||
    affectsPublishedAssignments ||
    crossesScopeBoundary ||
    exceedsMaximumShift ||
    exceedsMaximumChangedAssignments ||
    violatesAllowedActionPolicy ||
    !originalConflictsResolved ||
    secondaryHardConflictIds.length > 0 ||
    isNonMutatingActionType(partial.actionType);

  const automaticEligible =
    evaluationStatus === RESOLUTION_VALIDATION_STATUS.COMPLETED &&
    originalConflictsResolved &&
    secondaryHardConflictIds.length === 0 &&
    !affectsLockedAssignments &&
    !affectsPublishedAssignments &&
    !crossesScopeBoundary &&
    !exceedsMaximumShift &&
    !exceedsMaximumChangedAssignments &&
    !violatesAllowedActionPolicy &&
    requiresManualApproval === false &&
    partial.policyAutomaticEligibilityEnabled === true &&
    !isNonMutatingActionType(partial.actionType);

  const diagnostics = Object.freeze([...(partial.diagnostics || [])]);
  const projectedOccupancies = Object.freeze([...(partial.projectedOccupancies || [])]);
  const projectedDetectionResult = partial.projectedDetectionResult ?? null;

  const deterministicFingerprint =
    typeof partial.deterministicFingerprint === "string" &&
    partial.deterministicFingerprint.length > 0
      ? partial.deterministicFingerprint
      : fingerprintCore14Material({
          validationVersion: "core14-resolution-validation-v1",
          evaluationStatus,
          recommendationId: partial.recommendationId ?? null,
          originalConflictsResolved,
          resolvedConflictIds,
          unresolvedConflictIds,
          secondaryConflictIds,
          secondaryHardConflictIds,
          secondarySoftFindingIds,
          affectsLockedAssignments,
          affectsPublishedAssignments,
          crossesScopeBoundary,
          exceedsMaximumShift,
          exceedsMaximumChangedAssignments,
          violatesAllowedActionPolicy,
          requiresManualApproval,
          automaticEligible,
          projectedFindingIds: (projectedDetectionResult?.findings || []).map(
            (f) => f.findingId
          ),
        });

  return Object.freeze({
    evaluationStatus,
    recommendationId: partial.recommendationId ?? null,
    originalConflictsResolved,
    resolvedConflictIds,
    unresolvedConflictIds,
    secondaryConflictsIntroduced: secondaryConflictIds.length > 0,
    secondaryConflictIds,
    secondaryHardConflictIds,
    secondarySoftFindingIds,
    affectsLockedAssignments,
    affectsPublishedAssignments,
    crossesScopeBoundary,
    exceedsMaximumShift,
    exceedsMaximumChangedAssignments,
    violatesAllowedActionPolicy,
    requiresManualApproval,
    automaticEligible,
    projectedOccupancies,
    projectedDetectionResult,
    diagnostics,
    deterministicFingerprint,
  });
}

/**
 * Validate one ResolutionRecommendation via dry-run projection + Phase 1D detection.
 *
 * @param {{
 *   recommendation: object,
 *   baselineDetectionResult: object,
 *   occupancies: readonly object[],
 *   resolutionPolicy: object,
 *   capacityCheckEnabled?: boolean,
 *   capacityPolicy?: object | null,
 *   restPolicy?: object | null,
 *   availabilityMode?: string,
 *   availabilityCheckEnabled?: boolean,
 *   availabilityFacts?: readonly object[] | null,
 *   availabilityPort?: object | null,
 *   policyVersion?: string,
 *   requireAssignmentId?: boolean,
 *   requestId?: string | null,
 *   deterministicContext?: object | null,
 * }} request
 */
export function validateResolutionRecommendation(request = {}) {
  const recommendation = request.recommendation;
  const policy = request.resolutionPolicy;
  const baseline = request.baselineDetectionResult;
  const occupancies = Array.isArray(request.occupancies) ? request.occupancies : [];

  if (!recommendation || typeof recommendation !== "object") {
    return createValidationResult({
      evaluationStatus: RESOLUTION_VALIDATION_STATUS.REJECTED_INVALID_RECOMMENDATION,
      diagnostics: [
        createInputDiagnostic({
          code: INPUT_DIAGNOSTIC_CODE.UNSUPPORTED_CANONICAL_VALUE,
          message: "recommendation is required",
        }),
      ],
      requiresManualApproval: true,
      actionType: null,
      policyAutomaticEligibilityEnabled: false,
    });
  }

  if (!isResolutionActionType(recommendation.actionType)) {
    return createValidationResult({
      evaluationStatus: RESOLUTION_VALIDATION_STATUS.REJECTED_INVALID_RECOMMENDATION,
      recommendationId: recommendation.recommendationId ?? null,
      diagnostics: [
        createInputDiagnostic({
          code: INPUT_DIAGNOSTIC_CODE.UNSUPPORTED_CANONICAL_VALUE,
          message: "Unknown recommendation actionType",
          details: { actionType: recommendation.actionType ?? null },
        }),
      ],
      requiresManualApproval: true,
      actionType: recommendation.actionType,
      policyAutomaticEligibilityEnabled: false,
    });
  }

  if (!baseline || typeof baseline !== "object") {
    return createValidationResult({
      evaluationStatus: RESOLUTION_VALIDATION_STATUS.UNSUPPORTED,
      recommendationId: recommendation.recommendationId,
      diagnostics: [
        createInputDiagnostic({
          code: INPUT_DIAGNOSTIC_CODE.UNSUPPORTED_CANONICAL_VALUE,
          message: "baselineDetectionResult is required",
        }),
      ],
      requiresManualApproval: true,
      actionType: recommendation.actionType,
      policyAutomaticEligibilityEnabled: false,
    });
  }

  if (
    baseline.evaluationStatus === EVALUATION_STATUS.DATA_UNAVAILABLE ||
    baseline.planStatus === "NOT_EVALUATED"
  ) {
    // Authoritative availability failure / not evaluated baselines cannot certify validation.
    if (baseline.evaluationStatus === EVALUATION_STATUS.DATA_UNAVAILABLE) {
      return createValidationResult({
        evaluationStatus: RESOLUTION_VALIDATION_STATUS.DATA_UNAVAILABLE,
        recommendationId: recommendation.recommendationId,
        diagnostics: [
          createInputDiagnostic({
            code: INPUT_DIAGNOSTIC_CODE.AVAILABILITY_DATA_UNAVAILABLE,
            message: "Baseline detection was DATA_UNAVAILABLE; validation cannot complete",
          }),
        ],
        requiresManualApproval: true,
        actionType: recommendation.actionType,
        policyAutomaticEligibilityEnabled: false,
      });
    }
  }

  if (!policy || typeof policy !== "object") {
    return createValidationResult({
      evaluationStatus: RESOLUTION_VALIDATION_STATUS.REJECTED_INVALID_RECOMMENDATION,
      recommendationId: recommendation.recommendationId,
      diagnostics: [
        createInputDiagnostic({
          code: INPUT_DIAGNOSTIC_CODE.UNSUPPORTED_CANONICAL_VALUE,
          message: "resolutionPolicy is required for validation",
        }),
      ],
      requiresManualApproval: true,
      actionType: recommendation.actionType,
      policyAutomaticEligibilityEnabled: false,
    });
  }

  const allowed = new Set(policy.allowedActionTypes || []);
  const violatesAllowedActionPolicy =
    allowed.size > 0 && !allowed.has(recommendation.actionType);

  // Inspect affected occupancies for lock/published before projection semantics.
  const targetOccIds = new Set(recommendation.targetOccupancyIds || []);
  const targetAsgIds = new Set(recommendation.targetAssignmentIds || []);
  let affectsLockedAssignments = false;
  let affectsPublishedAssignments = false;
  for (const o of occupancies) {
    const hit =
      targetOccIds.has(o.occupancyId) ||
      (o.assignmentId && targetAsgIds.has(o.assignmentId));
    if (!hit) continue;
    if (o.locked === true) affectsLockedAssignments = true;
    if (o.published === true) affectsPublishedAssignments = true;
  }

  if (recommendation.violatesLock === true) affectsLockedAssignments = true;
  if (recommendation.affectsPublishedAssignment === true) {
    affectsPublishedAssignments = true;
  }

  const projection = projectRecommendation({
    occupancies,
    recommendation,
  });

  if (!projection.ok) {
    return createValidationResult({
      evaluationStatus: RESOLUTION_VALIDATION_STATUS.REJECTED_INVALID_RECOMMENDATION,
      recommendationId: recommendation.recommendationId,
      diagnostics: projection.diagnostics.map((d) =>
        createInputDiagnostic({
          code: d.code,
          message: d.message,
          details: d.details,
        })
      ),
      affectsLockedAssignments,
      affectsPublishedAssignments,
      requiresManualApproval: true,
      actionType: recommendation.actionType,
      policyAutomaticEligibilityEnabled: policy.automaticEligibilityEnabled === true,
      violatesAllowedActionPolicy,
    });
  }

  const projectedDetectionResult = detectResourceConflicts({
    occupancies: projection.projectedOccupancies,
    capacityCheckEnabled: request.capacityCheckEnabled,
    capacityPolicy: request.capacityPolicy,
    restPolicy: request.restPolicy,
    availabilityMode: request.availabilityMode,
    availabilityCheckEnabled: request.availabilityCheckEnabled,
    availabilityFacts: request.availabilityFacts,
    availabilityPort: request.availabilityPort,
    policyVersion: request.policyVersion,
    requireAssignmentId: request.requireAssignmentId,
    requestId: request.requestId,
    deterministicContext: request.deterministicContext,
  });

  if (projectedDetectionResult.evaluationStatus === EVALUATION_STATUS.DATA_UNAVAILABLE) {
    return createValidationResult({
      evaluationStatus: RESOLUTION_VALIDATION_STATUS.DATA_UNAVAILABLE,
      recommendationId: recommendation.recommendationId,
      projectedOccupancies: projection.projectedOccupancies,
      projectedDetectionResult,
      diagnostics: [...(projectedDetectionResult.inputDiagnostics || [])],
      affectsLockedAssignments,
      affectsPublishedAssignments,
      crossesScopeBoundary:
        projection.crossesScopeBoundary || recommendation.crossesScopeBoundary === true,
      requiresManualApproval: true,
      actionType: recommendation.actionType,
      policyAutomaticEligibilityEnabled: policy.automaticEligibilityEnabled === true,
      violatesAllowedActionPolicy,
    });
  }

  if (
    projectedDetectionResult.evaluationStatus === EVALUATION_STATUS.REJECTED_INVALID_INPUT
  ) {
    return createValidationResult({
      evaluationStatus: RESOLUTION_VALIDATION_STATUS.REJECTED_INVALID_RECOMMENDATION,
      recommendationId: recommendation.recommendationId,
      projectedOccupancies: projection.projectedOccupancies,
      projectedDetectionResult,
      diagnostics: [...(projectedDetectionResult.inputDiagnostics || [])],
      affectsLockedAssignments,
      affectsPublishedAssignments,
      crossesScopeBoundary:
        projection.crossesScopeBoundary || recommendation.crossesScopeBoundary === true,
      requiresManualApproval: true,
      actionType: recommendation.actionType,
      policyAutomaticEligibilityEnabled: policy.automaticEligibilityEnabled === true,
      violatesAllowedActionPolicy,
    });
  }

  const baselineOccupancyById = indexOccupanciesById(occupancies);
  const projectedOccupancyById = indexOccupanciesById(projection.projectedOccupancies);
  const targetConflictIds = recommendation.conflictIds || recommendation.expectedResolvedConflictIds || [];

  const comparison = compareFindingsWithContinuity(
    baseline.findings || [],
    projectedDetectionResult.findings || [],
    {
      targetConflictIds,
      baselineOccupancyById,
      projectedOccupancyById,
    }
  );

  // Secondary classification: prefer continuity-based novelty for HARD/SOFT split.
  const baselineIds = new Set((baseline.findings || []).map((f) => f.findingId));
  const secondaryIds = new Set(comparison.secondaryByContinuityIds);
  // Exact-ID secondary that is not continuity-novel still counts for exact ID tests,
  // but pre-existing continuity matches are excluded from secondaryByContinuityIds.
  for (const id of comparison.secondaryConflictIds) {
    // Keep exact secondary IDs for reporting; HARD/SOFT use continuity-novel set primarily.
    if (!baselineIds.has(id)) secondaryIds.add(id);
  }

  // Remove continuity-stable exact-ID changes: if continuity key existed in baseline,
  // do not treat as secondary for HARD introduction purposes.
  const continuitySecondary = new Set(comparison.secondaryByContinuityIds);
  const projectedById = new Map(
    (projectedDetectionResult.findings || []).map((f) => [f.findingId, f])
  );

  /** @type {string[]} */
  const secondaryHardConflictIds = [];
  /** @type {string[]} */
  const secondarySoftFindingIds = [];
  /** @type {string[]} */
  const secondaryConflictIds = [];

  for (const id of [...continuitySecondary].sort(compareUtf8Bytewise)) {
    const finding = projectedById.get(id);
    if (!finding) continue;
    secondaryConflictIds.push(id);
    if (finding.severity === SEVERITY.HARD) secondaryHardConflictIds.push(id);
    else if (finding.severity === SEVERITY.SOFT) secondarySoftFindingIds.push(id);
  }

  const estimatedShiftMs = Math.abs(
    typeof recommendation.estimatedShiftMs === "number"
      ? recommendation.estimatedShiftMs
      : projection.estimatedShiftMs
  );
  const exceedsMaximumShift =
    typeof policy.maximumShiftMs === "number" && estimatedShiftMs > policy.maximumShiftMs;
  const changedCount = projection.changedAssignmentIds.length;
  const exceedsMaximumChangedAssignments =
    typeof policy.maximumChangedAssignments === "number" &&
    changedCount > policy.maximumChangedAssignments;

  const crossesScopeBoundary =
    projection.crossesScopeBoundary ||
    recommendation.crossesScopeBoundary === true ||
    (policy.allowCrossScopeResourceChange !== true &&
      recommendation.crossesScopeBoundary === true);

  // Lock/published: even if policy allows touch, automaticEligible stays false via requiresManualApproval.
  const lockBlocked =
    affectsLockedAssignments &&
    (policy.allowTouchLocked !== true || policy.requireManualApprovalForLocked !== false);
  const publishedBlocked =
    affectsPublishedAssignments &&
    (policy.allowTouchPublished !== true ||
      policy.requireManualApprovalForPublished !== false);

  const originalConflictsResolved =
    comparison.unresolvedConflictIds.length === 0 &&
    (targetConflictIds.length === 0 || comparison.resolvedConflictIds.length > 0
      ? comparison.unresolvedConflictIds.length === 0
      : targetConflictIds.length === 0);

  // Refine: all targets resolved when every target id is in resolved set (continuity-aware).
  const allTargetsResolved =
    targetConflictIds.length === 0
      ? true
      : [...targetConflictIds].every((id) =>
          comparison.resolvedConflictIds.includes(id)
        ) && comparison.unresolvedConflictIds.length === 0;

  return createValidationResult({
    evaluationStatus: RESOLUTION_VALIDATION_STATUS.COMPLETED,
    recommendationId: recommendation.recommendationId,
    originalConflictsResolved: allTargetsResolved,
    resolvedConflictIds: comparison.resolvedConflictIds,
    unresolvedConflictIds: comparison.unresolvedConflictIds,
    secondaryConflictIds,
    secondaryHardConflictIds,
    secondarySoftFindingIds,
    affectsLockedAssignments,
    affectsPublishedAssignments,
    crossesScopeBoundary,
    exceedsMaximumShift,
    exceedsMaximumChangedAssignments,
    violatesAllowedActionPolicy,
    requiresManualApproval:
      recommendation.requiresManualApproval === true ||
      lockBlocked ||
      publishedBlocked ||
      crossesScopeBoundary ||
      exceedsMaximumShift ||
      exceedsMaximumChangedAssignments ||
      violatesAllowedActionPolicy ||
      !allTargetsResolved ||
      secondaryHardConflictIds.length > 0 ||
      isNonMutatingActionType(recommendation.actionType) ||
      (affectsLockedAssignments && policy.requireManualApprovalForLocked !== false) ||
      (affectsPublishedAssignments && policy.requireManualApprovalForPublished !== false),
    projectedOccupancies: projection.projectedOccupancies,
    projectedDetectionResult,
    diagnostics: [],
    actionType: recommendation.actionType,
    policyAutomaticEligibilityEnabled: policy.automaticEligibilityEnabled === true,
  });
}
