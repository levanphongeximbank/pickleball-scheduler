/**
 * CORE-14 Phase 1E — proposeResourceConflictResolutions (pure / dormant).
 * Consumes caller-supplied candidate options only. Never invents inventory.
 * Never recursively calls recommendation generation during validation.
 */

import { EVALUATION_STATUS } from "../enums/evaluationStatus.js";
import { PLAN_STATUS } from "../enums/planStatus.js";
import { INPUT_DIAGNOSTIC_CODE } from "../enums/diagnosticCode.js";
import { RESOURCE_KIND } from "../enums/resourceKind.js";
import { sortIdentifiers, compareUtf8Bytewise } from "../deterministic/compare.js";
import { createInputDiagnostic } from "../domain/InputDiagnostic.js";
import {
  createCanonicalResourceKey,
  serializeCanonicalResourceKey,
} from "../domain/CanonicalResourceKey.js";
import { validateResourceOccupancy } from "../domain/ResourceOccupancy.js";
import { normalizeResolutionPolicy } from "../resolution/resolutionPolicy.js";
import {
  RESOLUTION_ACTION_TYPE,
  isNonMutatingActionType,
} from "../resolution/actionTypes.js";
import { getPermittedActionsForFinding } from "../resolution/conflictActionMapping.js";
import {
  buildMoveAssignmentTimeDelta,
  buildReassignCourtDelta,
  buildReassignRefereeDelta,
  buildInsertRestGapDelta,
  buildReduceCapacityUsageDelta,
  buildManualReviewDelta,
  buildNoSafeAutomaticResolutionDelta,
} from "../resolution/buildStructuredDelta.js";
import {
  createResolutionRecommendation,
  recommendationContractIdentity,
} from "../resolution/buildRecommendations.js";
import { validateResolutionRecommendation } from "../resolution/validateRecommendation.js";
import { rankRecommendations } from "../resolution/rankRecommendations.js";
import { createRecommendationResult } from "../resolution/recommendationResult.js";
import { sameResourceScope } from "../resolution/projectRecommendation.js";

/**
 * Select which occupancy among a conflict pair to mutate (deterministic).
 * Prefers unlocked/unpublished; then higher occupancyId (UTF-8).
 * @param {readonly object[]} occupancies
 * @param {readonly string[]} occupancyIds
 * @returns {object | null}
 */
function selectMutableOccupancy(occupancies, occupancyIds) {
  const byId = new Map(occupancies.map((o) => [o.occupancyId, o]));
  const targets = sortIdentifiers(occupancyIds)
    .map((id) => byId.get(id))
    .filter(Boolean);
  if (targets.length === 0) return null;
  const unlocked = targets.filter((o) => o.locked !== true && o.published !== true);
  const pool = unlocked.length > 0 ? unlocked : targets;
  pool.sort((a, b) => compareUtf8Bytewise(a.occupancyId, b.occupancyId));
  return pool[pool.length - 1];
}

/**
 * @param {object} finding
 * @param {readonly object[]} occupancies
 * @param {object} policy
 * @returns {object[]}
 */
function materializeCandidatesForFinding(finding, occupancies, policy) {
  const resourceKind = finding.resourceKey?.resourceKind;
  const permitted = getPermittedActionsForFinding(finding.code, resourceKind).filter(
    (action) =>
      (policy.allowedActionTypes || []).length === 0 ||
      policy.allowedActionTypes.includes(action)
  );

  const target = selectMutableOccupancy(occupancies, finding.occupancyIds || []);
  /** @type {object[]} */
  const candidates = [];
  if (!target) {
    return candidates;
  }

  const conflictIds = [finding.findingId];
  const lockedHit = (finding.occupancyIds || []).some((id) => {
    const o = occupancies.find((x) => x.occupancyId === id);
    return o?.locked === true;
  });
  const publishedHit = (finding.occupancyIds || []).some((id) => {
    const o = occupancies.find((x) => x.occupancyId === id);
    return o?.published === true;
  });

  const protectionBlocksAutomatic =
    (lockedHit && policy.allowTouchLocked !== true) ||
    (publishedHit && policy.allowTouchPublished !== true);

  const automaticActions = permitted.filter((a) => !isNonMutatingActionType(a));

  for (const actionType of automaticActions) {
    if (protectionBlocksAutomatic) {
      continue;
    }

    if (actionType === RESOLUTION_ACTION_TYPE.MOVE_ASSIGNMENT_TIME) {
      for (const window of policy.candidateTimeWindows || []) {
        if (
          policy.allowedEvaluationStartMs != null &&
          window.startMs < policy.allowedEvaluationStartMs
        ) {
          continue;
        }
        if (
          policy.allowedEvaluationEndMs != null &&
          window.endMs > policy.allowedEvaluationEndMs
        ) {
          continue;
        }
        const duration = target.endMs - target.startMs;
        const proposedStartMs = window.startMs;
        const proposedEndMs =
          window.endMs - window.startMs === duration
            ? window.endMs
            : proposedStartMs + duration;
        if (proposedEndMs <= proposedStartMs) continue;
        const shiftMs = proposedStartMs - target.startMs;
        if (Math.abs(shiftMs) > policy.maximumShiftMs) continue;

        const delta = buildMoveAssignmentTimeDelta({
          targetAssignmentId: target.assignmentId,
          targetOccupancyIds: [target.occupancyId],
          previousStartMs: target.startMs,
          previousEndMs: target.endMs,
          proposedStartMs,
          proposedEndMs,
        });
        candidates.push(
          draftRecommendation({
            conflictIds,
            actionType,
            target,
            proposedChanges: [delta],
            affectedResourceKeys: [finding.resourceKey],
            estimatedShiftMs: shiftMs,
            lockedHit,
            publishedHit,
            crossesScopeBoundary: false,
            policy,
            reasonCode: "CANDIDATE_TIME_WINDOW",
          })
        );
      }
    }

    if (actionType === RESOLUTION_ACTION_TYPE.INSERT_REST_GAP) {
      for (const window of policy.candidateTimeWindows || []) {
        const duration = target.endMs - target.startMs;
        const proposedStartMs = window.startMs;
        const proposedEndMs = proposedStartMs + duration;
        if (proposedEndMs <= proposedStartMs) continue;
        const shiftMs = proposedStartMs - target.startMs;
        if (Math.abs(shiftMs) > policy.maximumShiftMs) continue;
        const resultingRestMs = Math.abs(shiftMs);
        const delta = buildInsertRestGapDelta({
          targetAssignmentId: target.assignmentId,
          targetOccupancyIds: [target.occupancyId],
          previousStartMs: target.startMs,
          previousEndMs: target.endMs,
          proposedStartMs,
          proposedEndMs,
          resultingRestMs,
        });
        candidates.push(
          draftRecommendation({
            conflictIds,
            actionType,
            target,
            proposedChanges: [delta],
            affectedResourceKeys: [finding.resourceKey],
            estimatedShiftMs: shiftMs,
            lockedHit,
            publishedHit,
            crossesScopeBoundary: false,
            policy,
            reasonCode: "CANDIDATE_REST_GAP",
          })
        );
      }
    }

    if (actionType === RESOLUTION_ACTION_TYPE.REASSIGN_COURT) {
      if (resourceKind !== RESOURCE_KIND.COURT && finding.code !== "RESOURCE_UNAVAILABLE") {
        continue;
      }
      if (
        finding.code === "RESOURCE_UNAVAILABLE" &&
        resourceKind !== RESOURCE_KIND.COURT
      ) {
        continue;
      }
      for (const court of policy.candidateCourtResources || []) {
        const proposed = createCanonicalResourceKey(court);
        if (proposed.resourceKind !== RESOURCE_KIND.COURT) continue;
        const previous = createCanonicalResourceKey(target.resourceKey);
        if (serializeCanonicalResourceKey(previous) === serializeCanonicalResourceKey(proposed)) {
          continue;
        }
        const crosses = !sameResourceScope(previous, proposed);
        if (crosses && policy.allowCrossScopeResourceChange !== true) {
          continue;
        }
        const delta = buildReassignCourtDelta({
          targetAssignmentId: target.assignmentId,
          targetOccupancyIds: [target.occupancyId],
          previousCourtResourceKey: previous,
          proposedCourtResourceKey: proposed,
        });
        candidates.push(
          draftRecommendation({
            conflictIds,
            actionType,
            target,
            proposedChanges: [delta],
            affectedResourceKeys: [previous, proposed],
            estimatedShiftMs: 0,
            lockedHit,
            publishedHit,
            crossesScopeBoundary: crosses,
            policy,
            reasonCode: "CANDIDATE_COURT",
          })
        );
      }
    }

    if (actionType === RESOLUTION_ACTION_TYPE.REASSIGN_REFEREE) {
      if (
        resourceKind !== RESOURCE_KIND.REFEREE &&
        !(finding.code === "RESOURCE_UNAVAILABLE" && resourceKind === RESOURCE_KIND.REFEREE)
      ) {
        if (finding.code !== "REFEREE_TIME_OVERLAP") continue;
      }
      for (const ref of policy.candidateRefereeResources || []) {
        const proposed = createCanonicalResourceKey(ref);
        if (proposed.resourceKind !== RESOURCE_KIND.REFEREE) continue;
        const previous = createCanonicalResourceKey(target.resourceKey);
        if (serializeCanonicalResourceKey(previous) === serializeCanonicalResourceKey(proposed)) {
          continue;
        }
        const crosses = !sameResourceScope(previous, proposed);
        if (crosses && policy.allowCrossScopeResourceChange !== true) {
          continue;
        }
        const delta = buildReassignRefereeDelta({
          targetAssignmentId: target.assignmentId,
          targetOccupancyIds: [target.occupancyId],
          previousRefereeResourceKey: previous,
          proposedRefereeResourceKey: proposed,
        });
        candidates.push(
          draftRecommendation({
            conflictIds,
            actionType,
            target,
            proposedChanges: [delta],
            affectedResourceKeys: [previous, proposed],
            estimatedShiftMs: 0,
            lockedHit,
            publishedHit,
            crossesScopeBoundary: crosses,
            policy,
            reasonCode: "CANDIDATE_REFEREE",
          })
        );
      }
    }

    if (actionType === RESOLUTION_ACTION_TYPE.REDUCE_CAPACITY_USAGE) {
      for (const cap of policy.candidateCapacityValues || []) {
        if (typeof cap !== "number" || !Number.isSafeInteger(cap) || cap <= 0) continue;
        if (cap >= target.capacityUnits) continue;
        const delta = buildReduceCapacityUsageDelta({
          targetAssignmentId: target.assignmentId,
          targetOccupancyIds: [target.occupancyId],
          previousCapacityUnits: target.capacityUnits,
          proposedCapacityUnits: cap,
        });
        candidates.push(
          draftRecommendation({
            conflictIds,
            actionType,
            target,
            proposedChanges: [delta],
            affectedResourceKeys: [finding.resourceKey],
            estimatedShiftMs: 0,
            lockedHit,
            publishedHit,
            crossesScopeBoundary: false,
            policy,
            reasonCode: "CANDIDATE_CAPACITY",
          })
        );
      }
    }
  }

  return candidates;
}

/**
 * @param {object} args
 */
function draftRecommendation(args) {
  const {
    conflictIds,
    actionType,
    target,
    proposedChanges,
    affectedResourceKeys,
    estimatedShiftMs,
    lockedHit,
    publishedHit,
    crossesScopeBoundary,
    policy,
    reasonCode,
  } = args;

  const requiresManualApproval =
    lockedHit ||
    publishedHit ||
    crossesScopeBoundary ||
    (lockedHit && policy.requireManualApprovalForLocked !== false) ||
    (publishedHit && policy.requireManualApprovalForPublished !== false) ||
    crossesScopeBoundary;

  return createResolutionRecommendation({
    conflictIds,
    actionType,
    targetAssignmentIds: target.assignmentId ? [target.assignmentId] : [],
    targetOccupancyIds: [target.occupancyId],
    proposedChanges,
    affectedResourceKeys,
    estimatedShiftMs,
    changedAssignmentCount: 1,
    violatesLock: lockedHit,
    affectsPublishedAssignment: publishedHit,
    crossesScopeBoundary,
    expectedResolvedConflictIds: conflictIds,
    requiresManualApproval,
    automaticEligible: false, // set after validation
    reasonCode,
    policyVersion: policy.policyVersion,
  });
}

/**
 * @param {object} finding
 * @param {object} policy
 * @param {string[]} blockedConstraints
 * @param {boolean} preferNoSafe
 */
function buildFallbackRecommendation(finding, policy, blockedConstraints, preferNoSafe) {
  const actionType = preferNoSafe
    ? RESOLUTION_ACTION_TYPE.NO_SAFE_AUTOMATIC_RESOLUTION
    : RESOLUTION_ACTION_TYPE.MARK_FOR_MANUAL_REVIEW;
  const delta = preferNoSafe
    ? buildNoSafeAutomaticResolutionDelta({
        reason: "NO_SAFE_AUTOMATIC_CANDIDATE",
        blockedConstraints,
      })
    : buildManualReviewDelta({
        reason: "NO_SAFE_DETERMINISTIC_CANDIDATE",
        blockedConstraints,
      });

  const permitted = getPermittedActionsForFinding(
    finding.code,
    finding.resourceKey?.resourceKind
  );
  if (!permitted.includes(actionType)) {
    if (permitted.includes(RESOLUTION_ACTION_TYPE.MARK_FOR_MANUAL_REVIEW)) {
      return buildFallbackRecommendation(finding, policy, blockedConstraints, false);
    }
    if (permitted.includes(RESOLUTION_ACTION_TYPE.NO_SAFE_AUTOMATIC_RESOLUTION)) {
      return buildFallbackRecommendation(finding, policy, blockedConstraints, true);
    }
  }

  return createResolutionRecommendation({
    conflictIds: [finding.findingId],
    actionType,
    targetAssignmentIds: sortIdentifiers(finding.assignmentIds || []),
    targetOccupancyIds: sortIdentifiers(finding.occupancyIds || []),
    proposedChanges: [delta],
    affectedResourceKeys: finding.resourceKey ? [finding.resourceKey] : [],
    estimatedShiftMs: 0,
    changedAssignmentCount: 0,
    violatesLock: blockedConstraints.includes("LOCKED"),
    affectsPublishedAssignment: blockedConstraints.includes("PUBLISHED"),
    crossesScopeBoundary: blockedConstraints.includes("CROSS_SCOPE"),
    expectedResolvedConflictIds: [finding.findingId],
    requiresManualApproval: true,
    automaticEligible: false,
    reasonCode: preferNoSafe ? "NO_SAFE_AUTOMATIC_RESOLUTION" : "MARK_FOR_MANUAL_REVIEW",
    policyVersion: policy.policyVersion,
  });
}

/**
 * Propose dormant resolution recommendations.
 *
 * @param {{
 *   baselineDetectionResult: object,
 *   occupancies?: readonly object[],
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
 *   metadata?: Record<string, unknown> | null,
 * }} request
 */
export function proposeResourceConflictResolutions(request = {}) {
  const policyResult = normalizeResolutionPolicy(request.resolutionPolicy);
  if (!policyResult.ok) {
    return createRecommendationResult({
      evaluationStatus: EVALUATION_STATUS.REJECTED_INVALID_INPUT,
      diagnostics: policyResult.diagnostics.map((d) =>
        createInputDiagnostic({
          code: d.code,
          message: d.message,
          details: d.details,
        })
      ),
      metadata: request.metadata ?? null,
    });
  }
  const policy = policyResult.value;

  const baseline = request.baselineDetectionResult;
  if (!baseline || typeof baseline !== "object") {
    return createRecommendationResult({
      evaluationStatus: EVALUATION_STATUS.UNSUPPORTED,
      diagnostics: [
        createInputDiagnostic({
          code: INPUT_DIAGNOSTIC_CODE.UNSUPPORTED_CANONICAL_VALUE,
          message: "baselineDetectionResult is required",
        }),
      ],
      metadata: request.metadata ?? null,
    });
  }

  if (
    baseline.evaluationStatus === EVALUATION_STATUS.DATA_UNAVAILABLE ||
    baseline.planStatus === PLAN_STATUS.NOT_EVALUATED ||
    baseline.evaluationStatus === EVALUATION_STATUS.REJECTED_INVALID_INPUT
  ) {
    return createRecommendationResult({
      evaluationStatus:
        baseline.evaluationStatus === EVALUATION_STATUS.DATA_UNAVAILABLE
          ? EVALUATION_STATUS.DATA_UNAVAILABLE
          : EVALUATION_STATUS.UNSUPPORTED,
      baselineDetectionFingerprint: baseline.deterministicFingerprint ?? null,
      diagnostics: [
        createInputDiagnostic({
          code:
            baseline.evaluationStatus === EVALUATION_STATUS.DATA_UNAVAILABLE
              ? INPUT_DIAGNOSTIC_CODE.AVAILABILITY_DATA_UNAVAILABLE
              : INPUT_DIAGNOSTIC_CODE.UNSUPPORTED_CANONICAL_VALUE,
          message:
            "Recommendation generation rejected when baseline detection was NOT_EVALUATED / unavailable",
        }),
      ],
      unresolvedConflictCount: baseline.unresolvedConflictCount ?? 0,
      metadata: request.metadata ?? null,
    });
  }

  // Normalize occupancies via copies (validate produces frozen copies).
  const rawOccupancies = Array.isArray(request.occupancies) ? request.occupancies : [];
  /** @type {object[]} */
  const occupancies = [];
  /** @type {object[]} */
  const diagnostics = [];
  for (let i = 0; i < rawOccupancies.length; i += 1) {
    const result = validateResourceOccupancy(rawOccupancies[i]);
    if (!result.ok) {
      for (const d of result.diagnostics) {
        diagnostics.push(
          createInputDiagnostic({
            code: d.code,
            message: d.message,
            path: d.path ?? `occupancies[${i}]`,
            details: d.details,
          })
        );
      }
      continue;
    }
    occupancies.push(result.value);
  }
  if (diagnostics.length > 0) {
    return createRecommendationResult({
      evaluationStatus: EVALUATION_STATUS.REJECTED_INVALID_INPUT,
      baselineDetectionFingerprint: baseline.deterministicFingerprint ?? null,
      diagnostics,
      metadata: request.metadata ?? null,
    });
  }

  const findings = [...(baseline.findings || [])].sort((a, b) =>
    compareUtf8Bytewise(a.findingId, b.findingId)
  );

  /** @type {object[]} */
  let rawCandidates = [];
  /** @type {Map<string, object[]>} */
  const perConflict = new Map();

  for (const finding of findings) {
    const produced = materializeCandidatesForFinding(finding, occupancies, policy);
    perConflict.set(finding.findingId, produced);
    rawCandidates = rawCandidates.concat(produced);
  }

  // Deduplicate contract-identical candidates.
  /** @type {Map<string, object>} */
  const deduped = new Map();
  for (const c of rawCandidates) {
    const id = recommendationContractIdentity(c);
    if (!deduped.has(id)) deduped.set(id, c);
  }
  rawCandidates = [...deduped.values()];

  // Enforce per-conflict candidate limit (deterministic order by recommendationId).
  /** @type {object[]} */
  const limited = [];
  const byConflict = new Map();
  for (const c of rawCandidates) {
    for (const conflictId of c.conflictIds) {
      if (!byConflict.has(conflictId)) byConflict.set(conflictId, []);
      byConflict.get(conflictId).push(c);
    }
  }
  /** @type {Set<string>} */
  const acceptedIds = new Set();
  for (const finding of findings) {
    const list = (byConflict.get(finding.findingId) || []).sort((a, b) =>
      compareUtf8Bytewise(a.recommendationId, b.recommendationId)
    );
    for (let i = 0; i < list.length && i < policy.maximumCandidatesPerConflict; i += 1) {
      acceptedIds.add(list[i].recommendationId);
    }
  }
  for (const c of rawCandidates) {
    if (acceptedIds.has(c.recommendationId)) limited.push(c);
  }

  // Validate candidates (dry-run) — never calls propose recursively.
  /** @type {object[]} */
  const validated = [];
  /** @type {Map<string, object>} */
  const validationById = new Map();
  let rejectedCandidateCount = 0;
  let evaluatedCandidateCount = 0;

  for (const candidate of limited.sort((a, b) =>
    compareUtf8Bytewise(a.recommendationId, b.recommendationId)
  )) {
    evaluatedCandidateCount += 1;
    const validation = validateResolutionRecommendation({
      recommendation: candidate,
      baselineDetectionResult: baseline,
      occupancies,
      resolutionPolicy: policy,
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
    validationById.set(candidate.recommendationId, validation);

    if (validation.evaluationStatus !== "COMPLETED") {
      rejectedCandidateCount += 1;
      continue;
    }

    const updated = createResolutionRecommendation({
      ...candidate,
      recommendationId: candidate.recommendationId,
      violatesLock: validation.affectsLockedAssignments || candidate.violatesLock,
      affectsPublishedAssignment:
        validation.affectsPublishedAssignments || candidate.affectsPublishedAssignment,
      crossesScopeBoundary:
        validation.crossesScopeBoundary || candidate.crossesScopeBoundary,
      requiresManualApproval: validation.requiresManualApproval,
      automaticEligible: validation.automaticEligible,
      validationStatus: validation.evaluationStatus,
      possibleSecondaryConflictIds: validation.secondaryConflictIds,
      metadata: candidate.metadata,
    });
    validated.push(updated);
    validationById.set(updated.recommendationId, validation);
  }

  // Fallbacks per unresolved finding with no surviving mutation candidate.
  const survivingConflictIds = new Set();
  for (const r of validated) {
    for (const id of r.conflictIds) survivingConflictIds.add(id);
  }

  for (const finding of findings) {
    const hasCandidate = validated.some((r) => r.conflictIds.includes(finding.findingId));
    if (hasCandidate) continue;

    const lockedHit = (finding.occupancyIds || []).some((id) => {
      const o = occupancies.find((x) => x.occupancyId === id);
      return o?.locked === true;
    });
    const publishedHit = (finding.occupancyIds || []).some((id) => {
      const o = occupancies.find((x) => x.occupancyId === id);
      return o?.published === true;
    });

    /** @type {string[]} */
    const blocked = [];
    if (lockedHit) blocked.push("LOCKED");
    if (publishedHit) blocked.push("PUBLISHED");
    if ((perConflict.get(finding.findingId) || []).length === 0) {
      blocked.push("NO_CALLER_CANDIDATE");
    }

    const preferNoSafe =
      lockedHit ||
      publishedHit ||
      finding.code === "VENUE_UNAVAILABLE" ||
      finding.code === "RESOURCE_UNAVAILABLE";

    const fallback = buildFallbackRecommendation(
      finding,
      policy,
      blocked,
      preferNoSafe &&
        getPermittedActionsForFinding(finding.code, finding.resourceKey?.resourceKind).includes(
          RESOLUTION_ACTION_TYPE.NO_SAFE_AUTOMATIC_RESOLUTION
        )
    );
    validated.push(fallback);
  }

  // Global recommendation limit.
  let ranked = rankRecommendations(validated, validationById);
  if (ranked.length > policy.maximumRecommendationCount) {
    ranked = ranked.slice(0, policy.maximumRecommendationCount).map((r, index) =>
      Object.freeze({ ...r, deterministicRank: index + 1 })
    );
  }

  return createRecommendationResult({
    evaluationStatus: EVALUATION_STATUS.COMPLETED,
    baselineDetectionFingerprint: baseline.deterministicFingerprint ?? null,
    recommendations: ranked,
    evaluatedCandidateCount,
    rejectedCandidateCount,
    unresolvedConflictCount: baseline.unresolvedConflictCount ?? baseline.hardFindingCount ?? 0,
    diagnostics: [],
    metadata: request.metadata ?? null,
  });
}
