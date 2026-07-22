/**
 * CORE-14 Phase 1F — dormant CORE-10 optimizer projector (shape-only).
 * Does not calculate global objective scores or select preferred recommendations.
 * Does not import CORE-10 evaluator implementation.
 */

import { CORE14_PROJECTOR_CONTRACT_V1 } from "../constants/versions.js";
import { SEVERITY } from "../enums/severity.js";
import { INPUT_DIAGNOSTIC_CODE } from "../enums/diagnosticCode.js";
import { createInputDiagnostic } from "../domain/InputDiagnostic.js";
import { compareFindings } from "../catalogs/severityPolicy.js";
import { compareRecommendations } from "../resolution/rankRecommendations.js";
import { fingerprintCore14Material } from "../deterministic/fingerprint.js";
import { deepFreezeClone, isPlainObject } from "../deterministic/serialize.js";
import { compareUtf8Bytewise } from "../deterministic/compare.js";

/**
 * @param {unknown} input
 * @returns {Readonly<object>}
 */
export function projectConflictResultForOptimizer(input) {
  if (!isPlainObject(input)) {
    return Object.freeze({
      projectorContractVersion: CORE14_PROJECTOR_CONTRACT_V1,
      consumer: "CORE_10_OPTIMIZER",
      hardConstraints: Object.freeze([]),
      softPenalties: Object.freeze([]),
      unresolvedConflictCount: 0,
      candidateLocalMoves: Object.freeze([]),
      conflictKeys: Object.freeze([]),
      recommendationIds: Object.freeze([]),
      validationStatus: null,
      planValiditySummary: null,
      globalObjectiveScore: null,
      selectedRecommendationId: null,
      diagnostics: Object.freeze([
        createInputDiagnostic({
          code: INPUT_DIAGNOSTIC_CODE.ADAPTER_RECORD_INVALID,
          message: "optimizer projector input must be a plain object",
        }),
      ]),
      deterministicFingerprint: fingerprintCore14Material({
        projector: "projectConflictResultForOptimizer",
        empty: true,
      }),
      metadata: Object.freeze({ weightsAssignedByCore14: false }),
    });
  }

  const findings = Array.isArray(input.findings) ? [...input.findings] : [];
  const recommendations = Array.isArray(input.recommendations) ? [...input.recommendations] : [];
  findings.sort(compareFindings);
  recommendations.sort(compareRecommendations);

  /** @type {object[]} */
  const hardConstraints = [];
  /** @type {object[]} */
  const softPenalties = [];

  for (const finding of findings) {
    const severity = finding?.severity;
    const entry = Object.freeze({
      conflictKey: typeof finding?.findingId === "string" ? finding.findingId : null,
      findingCode: finding?.code ?? null,
      severity,
      resourceKey: finding?.resourceKey ?? null,
      occupancyIds: Object.freeze([...(finding?.occupancyIds || [])]),
      planBlocking: severity === SEVERITY.HARD,
    });
    if (severity === SEVERITY.HARD) {
      hardConstraints.push(entry);
    } else {
      softPenalties.push(entry);
    }
  }

  const candidateLocalMoves = recommendations.map((rec) =>
    Object.freeze({
      recommendationId: rec?.recommendationId ?? null,
      actionType: rec?.actionType ?? null,
      rootFindingIds: Object.freeze([...(rec?.rootFindingIds || [])]),
      automaticEligible: rec?.automaticEligible === true,
      requiresManualApproval: rec?.requiresManualApproval === true,
      proposedChanges: rec?.proposedChanges ?? null,
    })
  );

  const conflictKeys = hardConstraints
    .map((c) => c.conflictKey)
    .filter((k) => typeof k === "string")
    .sort(compareUtf8Bytewise);
  const recommendationIds = candidateLocalMoves
    .map((m) => m.recommendationId)
    .filter((k) => typeof k === "string")
    .sort(compareUtf8Bytewise);

  const callerWeights =
    input.callerPolicyWeights == null
      ? null
      : isPlainObject(input.callerPolicyWeights)
        ? deepFreezeClone({ ...input.callerPolicyWeights })
        : null;

  const planValiditySummary = Object.freeze({
    evaluationStatus: input.evaluationStatus ?? null,
    planStatus: input.planStatus ?? null,
    hardFindingCount: hardConstraints.length,
    softFindingCount: softPenalties.length,
  });

  const projected = Object.freeze({
    projectorContractVersion: CORE14_PROJECTOR_CONTRACT_V1,
    consumer: "CORE_10_OPTIMIZER",
    hardConstraints: Object.freeze(hardConstraints),
    softPenalties: Object.freeze(softPenalties),
    unresolvedConflictCount: hardConstraints.length + softPenalties.length,
    candidateLocalMoves: Object.freeze(candidateLocalMoves),
    conflictKeys: Object.freeze(conflictKeys),
    recommendationIds: Object.freeze(recommendationIds),
    validationStatus: input.validationStatus ?? null,
    planValiditySummary,
    globalObjectiveScore: null,
    selectedRecommendationId: null,
    callerPolicyWeights: callerWeights,
    diagnostics: Object.freeze([]),
    deterministicFingerprint: fingerprintCore14Material({
      projector: "projectConflictResultForOptimizer",
      conflictKeys,
      recommendationIds,
      hardCodes: hardConstraints.map((c) => c.findingCode),
      softCodes: softPenalties.map((c) => c.findingCode),
      planValiditySummary,
    }),
    metadata: Object.freeze({
      weightsAssignedByCore14: false,
      globalScoreCalculated: false,
      recommendationGloballySelected: false,
      hardConflictsDowngraded: false,
    }),
  });

  return projected;
}
