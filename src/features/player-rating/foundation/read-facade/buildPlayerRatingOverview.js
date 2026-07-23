/**
 * Build one immutable Player Rating overview DTO (Phase 1H).
 * Composes candidates + history + snapshots. Does not select a winner,
 * convert scales, or declare a runtime SSOT.
 */

import {
  requireSupportedRatingMode,
} from "../contracts/ratingModes.js";
import { requireExplicitPlayerRatingScope } from "../contracts/scopeContract.js";
import {
  clonePlain,
  deepFreeze,
  isNonEmptyString,
} from "../contracts/shared.js";
import { PLAYER_ID_RESOLUTION_STATUS } from "../read-model/sourceTypes.js";
import {
  failReadFacade,
  PLAYER_RATING_READ_FACADE_REUSED_ERROR_CODE,
} from "./readFacadeErrors.js";
import {
  PLAYER_RATING_READ_FACADE_AVAILABILITY_STATUS,
} from "./readFacadeStatus.js";

/**
 * @param {import('../read-model/currentStateCandidate.js').PlayerRatingCurrentStateCandidate[]} candidates
 * @returns {string}
 */
function resolveOverviewPlayerIdStatus(candidates) {
  if (!candidates.length) {
    return PLAYER_ID_RESOLUTION_STATUS.UNRESOLVED;
  }

  const statuses = [
    ...new Set(candidates.map((c) => c.playerIdResolutionStatus)),
  ];
  if (
    statuses.length === 1 &&
    statuses[0] === PLAYER_ID_RESOLUTION_STATUS.RESOLVED
  ) {
    return PLAYER_ID_RESOLUTION_STATUS.RESOLVED;
  }
  if (statuses.includes(PLAYER_ID_RESOLUTION_STATUS.ALIAS_ONLY)) {
    return PLAYER_ID_RESOLUTION_STATUS.ALIAS_ONLY;
  }
  if (statuses.includes(PLAYER_ID_RESOLUTION_STATUS.UNRESOLVED)) {
    return PLAYER_ID_RESOLUTION_STATUS.UNRESOLVED;
  }
  return PLAYER_ID_RESOLUTION_STATUS.UNRESOLVED;
}

/**
 * @param {{
 *   candidates: ReadonlyArray<unknown>,
 *   rejected: ReadonlyArray<unknown>,
 *   identityConflicts: ReadonlyArray<unknown>,
 *   scaleConflicts: ReadonlyArray<unknown>,
 *   modeConflicts: ReadonlyArray<unknown>,
 *   history: ReadonlyArray<unknown>,
 *   snapshots: ReadonlyArray<unknown>,
 * }} parts
 * @returns {string}
 */
export function deriveAvailabilityStatus(parts) {
  if (parts.identityConflicts.length > 0) {
    return PLAYER_RATING_READ_FACADE_AVAILABILITY_STATUS.IDENTITY_CONFLICT;
  }

  const hasCandidates = parts.candidates.length > 0;
  const hasHistory = parts.history.length > 0;
  const hasSnapshots = parts.snapshots.length > 0;
  const hasAny = hasCandidates || hasHistory || hasSnapshots;

  if (!hasAny) {
    return PLAYER_RATING_READ_FACADE_AVAILABILITY_STATUS.NO_RATING_DATA;
  }

  // Partial when rejected/conflict signals exist, or only history/snapshots without candidates.
  if (
    parts.rejected.length > 0 ||
    parts.scaleConflicts.length > 0 ||
    parts.modeConflicts.length > 0 ||
    (!hasCandidates && (hasHistory || hasSnapshots))
  ) {
    return PLAYER_RATING_READ_FACADE_AVAILABILITY_STATUS.PARTIAL_DATA;
  }

  return PLAYER_RATING_READ_FACADE_AVAILABILITY_STATUS.AVAILABLE;
}

/**
 * @param {unknown} playerId
 * @param {string} field
 * @returns {string|null}
 */
function optionalCanonicalPlayerId(playerId, field) {
  if (playerId == null || playerId === "") {
    return null;
  }
  if (!isNonEmptyString(playerId)) {
    failReadFacade(
      PLAYER_RATING_READ_FACADE_REUSED_ERROR_CODE.CANONICAL_PLAYER_ID_UNRESOLVED,
      `Invalid canonical playerId: ${field}`,
      { field, playerId }
    );
  }
  return String(playerId).trim();
}

/**
 * @param {{
 *   playerId?: unknown,
 *   scope: unknown,
 *   ratingMode?: unknown,
 *   collection: {
 *     candidates: ReadonlyArray<import('../read-model/currentStateCandidate.js').PlayerRatingCurrentStateCandidate>,
 *     rejected: ReadonlyArray<Record<string, unknown>>,
 *     warnings: ReadonlyArray<string>,
 *     identityConflicts: ReadonlyArray<Record<string, unknown>>,
 *     scaleConflicts: ReadonlyArray<Record<string, unknown>>,
 *     modeConflicts: ReadonlyArray<Record<string, unknown>>,
 *     sourceSummary: Readonly<Record<string, number>>,
 *   },
 *   history: ReadonlyArray<unknown>,
 *   snapshots: ReadonlyArray<unknown>,
 * }} input
 */
export function buildPlayerRatingOverview(input) {
  if (!input || typeof input !== "object") {
    failReadFacade(
      PLAYER_RATING_READ_FACADE_REUSED_ERROR_CODE.INVALID_RATING_CONTRACT,
      "getPlayerRatingOverview input must be an object"
    );
  }

  const scope = requireExplicitPlayerRatingScope(input.scope);
  const ratingMode =
    input.ratingMode != null
      ? requireSupportedRatingMode(input.ratingMode)
      : null;

  const suppliedPlayerId = optionalCanonicalPlayerId(input.playerId, "playerId");
  const collection = input.collection;
  if (!collection || typeof collection !== "object") {
    failReadFacade(
      PLAYER_RATING_READ_FACADE_REUSED_ERROR_CODE.INVALID_RATING_CONTRACT,
      "Overview requires a candidate collection result"
    );
  }

  const candidates = [...(collection.candidates || [])];
  const rejected = [...(collection.rejected || [])];
  const identityConflicts = [...(collection.identityConflicts || [])];
  const scaleConflicts = [...(collection.scaleConflicts || [])];
  const modeConflicts = [...(collection.modeConflicts || [])];
  const warnings = [...(collection.warnings || [])].sort();
  const sourceSummary = clonePlain(collection.sourceSummary || {});
  const history = [...(input.history || [])];
  const snapshots = [...(input.snapshots || [])];

  const resolvedFromCandidates = [
    ...new Set(
      candidates
        .filter(
          (c) =>
            c.playerIdResolutionStatus === PLAYER_ID_RESOLUTION_STATUS.RESOLVED &&
            isNonEmptyString(c.playerId)
        )
        .map((c) => /** @type {string} */ (c.playerId))
    ),
  ].sort();

  let overviewPlayerId = suppliedPlayerId;
  if (overviewPlayerId == null && resolvedFromCandidates.length === 1) {
    overviewPlayerId = resolvedFromCandidates[0];
  } else if (
    overviewPlayerId != null &&
    resolvedFromCandidates.length === 1 &&
    resolvedFromCandidates[0] !== overviewPlayerId
  ) {
    // Supplied canonical id differs from resolved candidate ids — surface as conflict data
    // without promoting aliases; fail-closed path is handled by the collector when enabled.
    identityConflicts.push({
      type: "SUPPLIED_VS_CANDIDATE_PLAYER_ID_CONFLICT",
      playerIds: [overviewPlayerId, resolvedFromCandidates[0]].sort(),
      candidateIds: candidates.map((c) => c.candidateId).sort(),
    });
  }

  const availabilityStatus = deriveAvailabilityStatus({
    candidates,
    rejected,
    identityConflicts,
    scaleConflicts,
    modeConflicts,
    history,
    snapshots,
  });

  return deepFreeze({
    playerId: overviewPlayerId,
    playerIdResolutionStatus: resolveOverviewPlayerIdStatus(candidates),
    scope: clonePlain(scope),
    ratingMode,
    candidates,
    candidateCount: candidates.length,
    history,
    historyCount: history.length,
    snapshots,
    snapshotCount: snapshots.length,
    identityConflicts,
    scaleConflicts,
    modeConflicts,
    rejectedRecords: rejected,
    warnings,
    sourceSummary: Object.freeze({ ...sourceSummary }),
    availabilityStatus,
  });
}
