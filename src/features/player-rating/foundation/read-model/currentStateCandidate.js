/**
 * Canonical current-state candidate DTO (Phase 1C read model).
 * Immutable, deterministic, no scale conversion, no SSOT selection.
 */

import { deepFreeze, isNonEmptyString } from "../contracts/shared.js";
import {
  CONFIDENCE_SCALE,
  PLAYER_ID_RESOLUTION_STATUS,
  PLAYER_RATING_SOURCE_SCALE,
  PLAYER_RATING_SOURCE_TYPE,
} from "./sourceTypes.js";
import {
  PLAYER_RATING_READ_MODEL_ERROR_CODE,
  failReadModel,
} from "./ratingReadModelErrors.js";

/**
 * @typedef {Object} PlayerRatingAlias
 * @property {string} kind
 * @property {string} value
 */

/**
 * @typedef {Object} PlayerRatingCurrentStateCandidate
 * @property {string} candidateId
 * @property {string|null} playerId
 * @property {string} playerIdResolutionStatus
 * @property {string} sourceType
 * @property {string} sourceRecordId
 * @property {string} sourceScale
 * @property {string} ratingMode
 * @property {unknown} [selfAssessedRating]
 * @property {unknown} [provisionalRating]
 * @property {unknown} [verifiedRating]
 * @property {unknown} [calculatedRating]
 * @property {unknown} [displayRating]
 * @property {unknown} [confidence]
 * @property {string} [confidenceScale]
 * @property {string|null} status
 * @property {string|number|null} effectiveAt
 * @property {string|null} algorithmVersion
 * @property {string|null} tenantId
 * @property {import('../contracts/scopeContract.js').PlayerRatingScope|null} scope
 * @property {ReadonlyArray<PlayerRatingAlias>} aliases
 * @property {ReadonlyArray<string>} warnings
 * @property {Readonly<Record<string, unknown>>} rawSourceMetadata
 * @property {boolean} authoritativeForPublicPlayerRating
 */

/**
 * Stable candidate identity from source fields (no random / wall-clock IDs).
 *
 * @param {{
 *   sourceType: string,
 *   sourceRecordId: string,
 *   ratingMode: string,
 *   playerId?: string|null,
 *   unresolvedIdentityMarker?: string|null,
 * }} parts
 * @returns {string}
 */
export function buildCandidateId(parts) {
  const identity =
    isNonEmptyString(parts.playerId)
      ? `player:${String(parts.playerId).trim()}`
      : `unresolved:${String(parts.unresolvedIdentityMarker || "none").trim()}`;
  return [
    String(parts.sourceType),
    String(parts.sourceRecordId),
    String(parts.ratingMode),
    identity,
  ].join("|");
}

/**
 * Deterministic sort key fields (documented order).
 * @param {PlayerRatingCurrentStateCandidate} candidate
 * @returns {string}
 */
export function candidateSortKey(candidate) {
  const identity =
    candidate.playerId != null && candidate.playerId !== ""
      ? `player:${candidate.playerId}`
      : `unresolved:${candidate.candidateId}`;
  return [
    identity,
    candidate.sourceType,
    candidate.ratingMode,
    candidate.sourceRecordId,
    candidate.candidateId,
  ].join("\u0001");
}

/**
 * @param {PlayerRatingCurrentStateCandidate[]} candidates
 * @returns {PlayerRatingCurrentStateCandidate[]}
 */
export function sortCandidatesDeterministically(candidates) {
  return [...candidates].sort((a, b) => {
    const ka = candidateSortKey(a);
    const kb = candidateSortKey(b);
    if (ka < kb) return -1;
    if (ka > kb) return 1;
    return 0;
  });
}

/**
 * @param {unknown} value
 * @returns {number|null}
 */
export function optionalFiniteNumber(value) {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/**
 * @param {unknown} value
 * @returns {string|null}
 */
export function optionalNonEmptyString(value) {
  if (!isNonEmptyString(value)) return null;
  return String(value).trim();
}

/**
 * @param {unknown} value
 * @returns {string|number|null}
 */
export function optionalTimestamp(value) {
  if (value == null || value === "") return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const ms = Date.parse(value);
    if (Number.isFinite(ms)) return value.trim();
  }
  return null;
}

/**
 * Build an immutable canonical current-state candidate.
 *
 * @param {Record<string, unknown>} input
 * @returns {Readonly<PlayerRatingCurrentStateCandidate>}
 */
export function createCurrentStateCandidate(input) {
  if (!input || typeof input !== "object") {
    failReadModel(
      PLAYER_RATING_READ_MODEL_ERROR_CODE.INVALID_SOURCE_RECORD,
      "Current-state candidate input must be an object"
    );
  }

  const sourceType = optionalNonEmptyString(input.sourceType);
  if (!sourceType) {
    failReadModel(
      PLAYER_RATING_READ_MODEL_ERROR_CODE.UNSUPPORTED_SOURCE_TYPE,
      "sourceType is required",
      { sourceType: input.sourceType }
    );
  }

  const sourceRecordId = optionalNonEmptyString(input.sourceRecordId);
  if (!sourceRecordId) {
    failReadModel(
      PLAYER_RATING_READ_MODEL_ERROR_CODE.INVALID_SOURCE_RECORD,
      "sourceRecordId is required"
    );
  }

  const ratingMode = optionalNonEmptyString(input.ratingMode) || "overall";
  const sourceScale =
    optionalNonEmptyString(input.sourceScale) ||
    PLAYER_RATING_SOURCE_SCALE.UNKNOWN;

  const playerIdResolutionStatus =
    optionalNonEmptyString(input.playerIdResolutionStatus) ||
    PLAYER_ID_RESOLUTION_STATUS.UNRESOLVED;

  let playerId = null;
  if (input.playerId != null && input.playerId !== "") {
    if (!isNonEmptyString(input.playerId)) {
      failReadModel(
        PLAYER_RATING_READ_MODEL_ERROR_CODE.INVALID_SOURCE_RECORD,
        "canonical playerId must be a non-empty string when supplied",
        { playerId: input.playerId }
      );
    }
    playerId = String(input.playerId).trim();
  }

  if (
    playerId != null &&
    playerIdResolutionStatus !== PLAYER_ID_RESOLUTION_STATUS.RESOLVED
  ) {
    failReadModel(
      PLAYER_RATING_READ_MODEL_ERROR_CODE.ALIAS_TREATED_AS_CANONICAL,
      "playerId may only be set when playerIdResolutionStatus is RESOLVED",
      { playerId, playerIdResolutionStatus }
    );
  }

  if (
    playerId == null &&
    playerIdResolutionStatus === PLAYER_ID_RESOLUTION_STATUS.RESOLVED
  ) {
    failReadModel(
      PLAYER_RATING_READ_MODEL_ERROR_CODE.INVALID_SOURCE_RECORD,
      "RESOLVED playerIdResolutionStatus requires canonical playerId"
    );
  }

  const aliases = Array.isArray(input.aliases)
    ? input.aliases
        .filter(
          (a) =>
            a &&
            typeof a === "object" &&
            isNonEmptyString(/** @type {{ kind?: unknown }} */ (a).kind) &&
            isNonEmptyString(/** @type {{ value?: unknown }} */ (a).value)
        )
        .map((a) =>
          Object.freeze({
            kind: String(/** @type {{ kind: string }} */ (a).kind).trim(),
            value: String(/** @type {{ value: string }} */ (a).value).trim(),
          })
        )
    : [];

  const warnings = Array.isArray(input.warnings)
    ? input.warnings.map((w) => String(w))
    : [];

  const unresolvedIdentityMarker =
    optionalNonEmptyString(input.unresolvedIdentityMarker) ||
    (aliases.length > 0
      ? `${aliases[0].kind}:${aliases[0].value}`
      : sourceRecordId);

  const candidateId =
    optionalNonEmptyString(input.candidateId) ||
    buildCandidateId({
      sourceType,
      sourceRecordId,
      ratingMode,
      playerId,
      unresolvedIdentityMarker,
    });

  const rawSourceMetadata =
    input.rawSourceMetadata && typeof input.rawSourceMetadata === "object"
      ? /** @type {Record<string, unknown>} */ ({ ...input.rawSourceMetadata })
      : {};

  /** @type {PlayerRatingCurrentStateCandidate} */
  const candidate = {
    candidateId,
    playerId,
    playerIdResolutionStatus,
    sourceType,
    sourceRecordId,
    sourceScale,
    ratingMode,
    status:
      input.status == null ? null : optionalNonEmptyString(input.status),
    effectiveAt: optionalTimestamp(input.effectiveAt),
    algorithmVersion: optionalNonEmptyString(input.algorithmVersion),
    tenantId: optionalNonEmptyString(input.tenantId),
    scope:
      input.scope && typeof input.scope === "object"
        ? /** @type {import('../contracts/scopeContract.js').PlayerRatingScope} */ (
            input.scope
          )
        : null,
    aliases,
    warnings,
    rawSourceMetadata,
    authoritativeForPublicPlayerRating:
      input.authoritativeForPublicPlayerRating === true,
  };

  if ("selfAssessedRating" in input) {
    candidate.selfAssessedRating = input.selfAssessedRating;
  }
  if ("provisionalRating" in input) {
    candidate.provisionalRating = input.provisionalRating;
  }
  if ("verifiedRating" in input) {
    candidate.verifiedRating = input.verifiedRating;
  }
  if ("calculatedRating" in input) {
    candidate.calculatedRating = input.calculatedRating;
  }
  if ("displayRating" in input) {
    candidate.displayRating = input.displayRating;
  }
  if ("confidence" in input) {
    candidate.confidence = input.confidence;
  }
  if ("confidenceScale" in input) {
    candidate.confidenceScale =
      optionalNonEmptyString(input.confidenceScale) || CONFIDENCE_SCALE.UNKNOWN;
  }

  return deepFreeze(candidate);
}

export {
  CONFIDENCE_SCALE,
  PLAYER_ID_RESOLUTION_STATUS,
  PLAYER_RATING_SOURCE_SCALE,
  PLAYER_RATING_SOURCE_TYPE,
};
