/**
 * CORE-14 Phase 1E — ResolutionRecommendation V1 factory + deterministic ID.
 * Identity excludes metadata. No wall-clock time or non-deterministic RNG.
 */

import { CORE14_FP_V1 } from "../constants/versions.js";
import { sortIdentifiers } from "../deterministic/compare.js";
import { fingerprintValue } from "../deterministic/fingerprint.js";
import {
  createCanonicalResourceKey,
  serializeCanonicalResourceKey,
} from "../domain/CanonicalResourceKey.js";
import { isResolutionActionType, isNonMutatingActionType } from "./actionTypes.js";
import { canonicalizeProposedChanges } from "./buildStructuredDelta.js";

export const RESOLUTION_RECOMMENDATION_VERSION = "core14-resolution-recommendation-v1";
export const CORE14_RID_V1 = "CORE14_RID_V1";

/**
 * @param {{
 *   conflictIds: readonly string[],
 *   actionType: string,
 *   targetAssignmentIds: readonly string[],
 *   targetOccupancyIds: readonly string[],
 *   proposedChanges: readonly object[],
 *   policyVersion: string,
 * }} material
 * @returns {string}
 */
export function createRecommendationId(material) {
  const payload = {
    recommendationIdVersion: CORE14_RID_V1,
    fingerprintVersion: CORE14_FP_V1,
    conflictIds: sortIdentifiers(material.conflictIds || []),
    actionType: material.actionType,
    targetAssignmentIds: sortIdentifiers(material.targetAssignmentIds || []),
    targetOccupancyIds: sortIdentifiers(material.targetOccupancyIds || []),
    proposedChanges: canonicalizeProposedChanges(material.proposedChanges || []),
    policyVersion: material.policyVersion,
  };
  const hex = fingerprintValue(payload, { includeMetadata: false });
  return `${CORE14_RID_V1}:${hex}`;
}

/**
 * @param {{
 *   conflictIds: readonly string[],
 *   actionType: string,
 *   targetAssignmentIds?: readonly string[],
 *   targetOccupancyIds?: readonly string[],
 *   proposedChanges?: readonly object[],
 *   affectedResourceKeys?: readonly object[],
 *   estimatedShiftMs?: number | null,
 *   changedAssignmentCount?: number,
 *   violatesLock?: boolean,
 *   affectsPublishedAssignment?: boolean,
 *   crossesScopeBoundary?: boolean,
 *   expectedResolvedConflictIds?: readonly string[],
 *   possibleSecondaryConflictIds?: readonly string[],
 *   validationStatus?: string | null,
 *   requiresManualApproval?: boolean,
 *   automaticEligible?: boolean,
 *   deterministicRank?: number,
 *   reasonCode?: string,
 *   policyVersion: string,
 *   metadata?: Record<string, unknown> | null,
 *   recommendationId?: string,
 * }} input
 */
export function createResolutionRecommendation(input) {
  if (!isResolutionActionType(input?.actionType)) {
    throw new Error("actionType must be a frozen ResolutionActionType");
  }
  if (typeof input?.policyVersion !== "string" || input.policyVersion.length === 0) {
    throw new Error("policyVersion is required");
  }

  const conflictIds = Object.freeze(sortIdentifiers(input.conflictIds || []));
  const targetAssignmentIds = Object.freeze(sortIdentifiers(input.targetAssignmentIds || []));
  const targetOccupancyIds = Object.freeze(sortIdentifiers(input.targetOccupancyIds || []));
  const proposedChanges = Object.freeze([...(input.proposedChanges || [])]);
  const expectedResolvedConflictIds = Object.freeze(
    sortIdentifiers(input.expectedResolvedConflictIds || conflictIds)
  );
  const possibleSecondaryConflictIds = Object.freeze(
    sortIdentifiers(input.possibleSecondaryConflictIds || [])
  );

  const affectedResourceKeys = Object.freeze(
    (input.affectedResourceKeys || []).map((k) => createCanonicalResourceKey(k))
  );

  const recommendationId =
    typeof input.recommendationId === "string" && input.recommendationId.length > 0
      ? input.recommendationId
      : createRecommendationId({
          conflictIds,
          actionType: input.actionType,
          targetAssignmentIds,
          targetOccupancyIds,
          proposedChanges,
          policyVersion: input.policyVersion,
        });

  const nonMutating = isNonMutatingActionType(input.actionType);
  const violatesLock = input.violatesLock === true;
  const affectsPublishedAssignment = input.affectsPublishedAssignment === true;
  const crossesScopeBoundary = input.crossesScopeBoundary === true;
  const requiresManualApproval =
    input.requiresManualApproval === true ||
    violatesLock ||
    affectsPublishedAssignment ||
    crossesScopeBoundary ||
    nonMutating;
  const automaticEligible =
    input.automaticEligible === true &&
    !requiresManualApproval &&
    !nonMutating;

  return Object.freeze({
    recommendationId,
    conflictIds,
    actionType: input.actionType,
    targetAssignmentIds,
    targetOccupancyIds,
    proposedChanges,
    affectedResourceKeys,
    estimatedShiftMs:
      typeof input.estimatedShiftMs === "number" && Number.isSafeInteger(input.estimatedShiftMs)
        ? input.estimatedShiftMs
        : 0,
    changedAssignmentCount:
      typeof input.changedAssignmentCount === "number" &&
      Number.isSafeInteger(input.changedAssignmentCount)
        ? input.changedAssignmentCount
        : targetAssignmentIds.length,
    violatesLock,
    affectsPublishedAssignment,
    crossesScopeBoundary,
    expectedResolvedConflictIds,
    possibleSecondaryConflictIds,
    validationStatus: input.validationStatus ?? null,
    requiresManualApproval,
    automaticEligible,
    deterministicRank:
      typeof input.deterministicRank === "number" && Number.isSafeInteger(input.deterministicRank)
        ? input.deterministicRank
        : 0,
    reasonCode:
      typeof input.reasonCode === "string" && input.reasonCode.length > 0
        ? input.reasonCode
        : input.actionType,
    policyVersion: input.policyVersion,
    metadata: input.metadata == null ? null : Object.freeze({ ...input.metadata }),
  });
}

/**
 * Contract-identity key for candidate dedupe (excludes rank/validation/metadata).
 * @param {object} recommendation
 * @returns {string}
 */
export function recommendationContractIdentity(recommendation) {
  return createRecommendationId({
    conflictIds: recommendation.conflictIds,
    actionType: recommendation.actionType,
    targetAssignmentIds: recommendation.targetAssignmentIds,
    targetOccupancyIds: recommendation.targetOccupancyIds,
    proposedChanges: recommendation.proposedChanges,
    policyVersion: recommendation.policyVersion,
  });
}

/**
 * @param {object} key
 * @returns {string}
 */
export function resourceKeyIdentity(key) {
  return serializeCanonicalResourceKey(createCanonicalResourceKey(key));
}
