/**
 * CORE-14 Phase 1E — recommendation ranking (frozen order).
 * Does not use caller input order as a tie-break.
 */

import { compareUtf8Bytewise, compareSafeInteger } from "../deterministic/compare.js";
import {
  getActionTypeOrdinal,
  RESOLUTION_ACTION_TYPE,
  isNonMutatingActionType,
} from "./actionTypes.js";

/**
 * @param {object} recommendation
 * @returns {object}
 */
function rankingView(recommendation) {
  const validation = recommendation._validation || null;
  const validationCompleted =
    validation == null
      ? recommendation.validationStatus === "COMPLETED" ||
        recommendation.validationStatus == null
      : validation.evaluationStatus === "COMPLETED";
  const originalResolved =
    validation == null
      ? recommendation.expectedResolvedConflictIds?.length > 0
      : validation.originalConflictsResolved === true;
  const secondaryHard =
    validation == null
      ? 0
      : Array.isArray(validation.secondaryHardConflictIds)
        ? validation.secondaryHardConflictIds.length
        : 0;
  const secondarySoft =
    validation == null
      ? 0
      : Array.isArray(validation.secondarySoftFindingIds)
        ? validation.secondarySoftFindingIds.length
        : 0;

  return {
    violatesLock: recommendation.violatesLock === true,
    affectsPublishedAssignment: recommendation.affectsPublishedAssignment === true,
    validationCompleted,
    originalResolved,
    secondaryHard,
    secondarySoft,
    requiresManualApproval: recommendation.requiresManualApproval === true,
    automaticEligible: recommendation.automaticEligible === true,
    changedAssignmentCount:
      typeof recommendation.changedAssignmentCount === "number"
        ? recommendation.changedAssignmentCount
        : 0,
    estimatedShiftAbs: Math.abs(
      typeof recommendation.estimatedShiftMs === "number"
        ? recommendation.estimatedShiftMs
        : 0
    ),
    actionOrdinal: getActionTypeOrdinal(recommendation.actionType),
    isManual: recommendation.actionType === RESOLUTION_ACTION_TYPE.MARK_FOR_MANUAL_REVIEW,
    isNoSafe:
      recommendation.actionType === RESOLUTION_ACTION_TYPE.NO_SAFE_AUTOMATIC_RESOLUTION,
    targetAssignmentIds: [...(recommendation.targetAssignmentIds || [])],
    targetOccupancyIds: [...(recommendation.targetOccupancyIds || [])],
    recommendationId: String(recommendation.recommendationId || ""),
    isNonMutating: isNonMutatingActionType(recommendation.actionType),
  };
}

/**
 * Compare two recommendations per frozen ranking contract.
 * @param {object} a
 * @param {object} b
 * @returns {number}
 */
export function compareRecommendations(a, b) {
  const left = rankingView(a);
  const right = rankingView(b);

  // Manual-review after validated safe mutation candidates; no-safe last.
  if (left.isNoSafe !== right.isNoSafe) return left.isNoSafe ? 1 : -1;
  if (left.isManual !== right.isManual) return left.isManual ? 1 : -1;

  if (left.violatesLock !== right.violatesLock) return left.violatesLock ? 1 : -1;
  if (left.affectsPublishedAssignment !== right.affectsPublishedAssignment) {
    return left.affectsPublishedAssignment ? 1 : -1;
  }
  if (left.validationCompleted !== right.validationCompleted) {
    return left.validationCompleted ? -1 : 1;
  }
  if (left.originalResolved !== right.originalResolved) {
    return left.originalResolved ? -1 : 1;
  }
  if ((left.secondaryHard === 0) !== (right.secondaryHard === 0)) {
    return left.secondaryHard === 0 ? -1 : 1;
  }
  {
    const c = compareSafeInteger(left.secondaryHard, right.secondaryHard);
    if (c !== 0) return c;
  }
  {
    const c = compareSafeInteger(left.secondarySoft, right.secondarySoft);
    if (c !== 0) return c;
  }
  if (left.requiresManualApproval !== right.requiresManualApproval) {
    return left.requiresManualApproval ? 1 : -1;
  }
  if (left.automaticEligible !== right.automaticEligible) {
    return left.automaticEligible ? -1 : 1;
  }
  {
    const c = compareSafeInteger(left.changedAssignmentCount, right.changedAssignmentCount);
    if (c !== 0) return c;
  }
  {
    const c = compareSafeInteger(left.estimatedShiftAbs, right.estimatedShiftAbs);
    if (c !== 0) return c;
  }
  {
    const c = compareSafeInteger(left.actionOrdinal, right.actionOrdinal);
    if (c !== 0) return c;
  }
  {
    const aIds = left.targetAssignmentIds.join("\u0000");
    const bIds = right.targetAssignmentIds.join("\u0000");
    const c = compareUtf8Bytewise(aIds, bIds);
    if (c !== 0) return c;
  }
  {
    const aIds = left.targetOccupancyIds.join("\u0000");
    const bIds = right.targetOccupancyIds.join("\u0000");
    const c = compareUtf8Bytewise(aIds, bIds);
    if (c !== 0) return c;
  }
  return compareUtf8Bytewise(left.recommendationId, right.recommendationId);
}

/**
 * Sort a copy and assign deterministicRank 1..N.
 * Attaches optional _validation for ranking when provided via map.
 *
 * @param {readonly object[]} recommendations
 * @param {ReadonlyMap<string, object> | null} [validationByRecommendationId]
 * @returns {object[]}
 */
export function rankRecommendations(
  recommendations,
  validationByRecommendationId = null
) {
  const decorated = (recommendations || []).map((r) => {
    const validation =
      validationByRecommendationId && validationByRecommendationId.get(r.recommendationId);
    return validation ? { ...r, _validation: validation } : { ...r };
  });
  decorated.sort(compareRecommendations);
  return decorated.map((r, index) => {
    const { _validation, ...rest } = r;
    return Object.freeze({
      ...rest,
      deterministicRank: index + 1,
      automaticEligible:
        rest.automaticEligible === true &&
        (_validation
          ? _validation.automaticEligible === true
          : rest.automaticEligible === true),
      validationStatus: _validation
        ? _validation.evaluationStatus
        : rest.validationStatus ?? null,
    });
  });
}
