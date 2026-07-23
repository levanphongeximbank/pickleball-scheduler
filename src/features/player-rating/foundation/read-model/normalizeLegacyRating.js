/**
 * Normalize legacy assessment / player-field rating shapes.
 * Legacy records are non-authoritative. Scale is UNKNOWN when unproven.
 */

import { requireExplicitPlayerRatingScope } from "../contracts/scopeContract.js";
import {
  createCurrentStateCandidate,
  optionalFiniteNumber,
  optionalNonEmptyString,
  optionalTimestamp,
} from "./currentStateCandidate.js";
import {
  PLAYER_RATING_READ_MODEL_ERROR_CODE,
  failReadModel,
} from "./ratingReadModelErrors.js";
import {
  CONFIDENCE_SCALE,
  PLAYER_ID_RESOLUTION_STATUS,
  PLAYER_RATING_SOURCE_SCALE,
  PLAYER_RATING_SOURCE_TYPE,
} from "./sourceTypes.js";

/**
 * @param {unknown} record
 * @param {{
 *   sourceType?: string,
 *   canonicalPlayerId?: string|null,
 *   scope?: unknown,
 *   tenantId?: string|null,
 *   treatAliasAsCanonical?: boolean,
 *   provenSourceScale?: string|null,
 * }} [options]
 * @returns {Readonly<import('./currentStateCandidate.js').PlayerRatingCurrentStateCandidate>}
 */
export function normalizeLegacyRating(record, options = {}) {
  if (!record || typeof record !== "object") {
    failReadModel(
      PLAYER_RATING_READ_MODEL_ERROR_CODE.INVALID_SOURCE_RECORD,
      "Legacy rating record must be an object"
    );
  }

  if (options.treatAliasAsCanonical === true) {
    failReadModel(
      PLAYER_RATING_READ_MODEL_ERROR_CODE.ALIAS_TREATED_AS_CANONICAL,
      "Legacy aliases must not be treated as confirmed canonical identity"
    );
  }

  const raw = /** @type {Record<string, unknown>} */ (record);
  const sourceType =
    options.sourceType === PLAYER_RATING_SOURCE_TYPE.LEGACY_PLAYER_FIELD
      ? PLAYER_RATING_SOURCE_TYPE.LEGACY_PLAYER_FIELD
      : PLAYER_RATING_SOURCE_TYPE.LEGACY_ASSESSMENT;

  const sourceRecordId =
    optionalNonEmptyString(raw.id) ||
    optionalNonEmptyString(raw.sourceRecordId) ||
    optionalNonEmptyString(raw.playerId) ||
    optionalNonEmptyString(raw.player_id) ||
    optionalNonEmptyString(raw.assessmentId) ||
    optionalNonEmptyString(raw.assessment_id);

  if (!sourceRecordId) {
    failReadModel(
      PLAYER_RATING_READ_MODEL_ERROR_CODE.INVALID_SOURCE_RECORD,
      "Legacy rating record requires a stable sourceRecordId or id"
    );
  }

  const aliases = [];
  const clubPlayerId =
    optionalNonEmptyString(raw.clubPlayerId) ||
    optionalNonEmptyString(raw.club_player_id) ||
    optionalNonEmptyString(raw.blobPlayerId);
  if (clubPlayerId) {
    aliases.push({ kind: "club_player_id", value: clubPlayerId });
  }
  const authUserId =
    optionalNonEmptyString(raw.authUserId) ||
    optionalNonEmptyString(raw.auth_user_id);
  if (authUserId) {
    aliases.push({ kind: "auth_user_id", value: authUserId });
  }

  const warnings = [
    "LEGACY_NON_AUTHORITATIVE",
    "NO_SCALE_CONVERSION_APPLIED",
  ];

  let sourceScale = PLAYER_RATING_SOURCE_SCALE.UNKNOWN;
  const proven = optionalNonEmptyString(options.provenSourceScale);
  if (proven) {
    sourceScale = proven;
  } else if (optionalNonEmptyString(raw.sourceScale) || optionalNonEmptyString(raw.source_scale)) {
    sourceScale =
      optionalNonEmptyString(raw.sourceScale) ||
      optionalNonEmptyString(raw.source_scale) ||
      PLAYER_RATING_SOURCE_SCALE.UNKNOWN;
  } else {
    warnings.push("UNKNOWN_LEGACY_SOURCE_SCALE");
  }

  if (sourceScale === PLAYER_RATING_SOURCE_SCALE.UNKNOWN) {
    warnings.push("AMBIGUOUS_OR_UNPROVEN_SCALE");
  }

  let playerId = null;
  let playerIdResolutionStatus = PLAYER_ID_RESOLUTION_STATUS.UNRESOLVED;
  const canonical = optionalNonEmptyString(options.canonicalPlayerId);
  if (canonical) {
    playerId = canonical;
    playerIdResolutionStatus = PLAYER_ID_RESOLUTION_STATUS.RESOLVED;
  } else if (aliases.length > 0) {
    playerIdResolutionStatus = PLAYER_ID_RESOLUTION_STATUS.ALIAS_ONLY;
    warnings.push("CANONICAL_PLAYER_ID_UNRESOLVED");
  } else {
    warnings.push("CANONICAL_PLAYER_ID_UNRESOLVED");
  }

  const scope =
    options.scope != null
      ? requireExplicitPlayerRatingScope(options.scope)
      : options.tenantId != null
        ? requireExplicitPlayerRatingScope(options.tenantId)
        : null;

  const tenantId =
    scope && scope.kind === "tenant"
      ? scope.tenantId
      : optionalNonEmptyString(options.tenantId);

  const assessmentResult =
    optionalFiniteNumber(raw.assessmentResult) ??
    optionalFiniteNumber(raw.assessment_result) ??
    optionalFiniteNumber(raw.suggestedRating) ??
    optionalFiniteNumber(raw.suggested_rating);

  const skillLevel = optionalFiniteNumber(raw.skillLevel);
  const level = optionalFiniteNumber(raw.level);
  const rating = optionalFiniteNumber(raw.rating);

  const primary =
    assessmentResult ?? skillLevel ?? level ?? rating ?? null;

  if (primary == null) {
    warnings.push("INCOMPLETE_LEGACY_RATING_FIELDS");
  }

  const effectiveAt =
    optionalTimestamp(raw.effectiveAt) ||
    optionalTimestamp(raw.effective_at) ||
    optionalTimestamp(raw.skillLevelLockedAt) ||
    optionalTimestamp(raw.updatedAt) ||
    optionalTimestamp(raw.updated_at) ||
    optionalTimestamp(raw.at);

  return createCurrentStateCandidate({
    sourceType,
    sourceRecordId,
    sourceScale,
    ratingMode:
      optionalNonEmptyString(raw.ratingMode) ||
      optionalNonEmptyString(raw.rating_mode) ||
      "overall",
    playerId,
    playerIdResolutionStatus,
    unresolvedIdentityMarker: clubPlayerId
      ? `club_player_id:${clubPlayerId}`
      : sourceRecordId,
    selfAssessedRating: skillLevel ?? level ?? rating ?? assessmentResult,
    provisionalRating: assessmentResult,
    displayRating: primary,
    confidence:
      optionalFiniteNumber(raw.confidence) ??
      optionalFiniteNumber(raw.rating_confidence),
    confidenceScale: CONFIDENCE_SCALE.UNKNOWN,
    status:
      optionalNonEmptyString(raw.status) ||
      optionalNonEmptyString(raw.rating_status) ||
      "legacy",
    effectiveAt,
    algorithmVersion: optionalNonEmptyString(raw.algorithmVersion),
    tenantId,
    scope,
    aliases,
    warnings,
    authoritativeForPublicPlayerRating: false,
    rawSourceMetadata: {
      store: sourceType === PLAYER_RATING_SOURCE_TYPE.LEGACY_PLAYER_FIELD
        ? "legacy_player_field"
        : "legacy_assessment",
      presentFields: [
        skillLevel != null ? "skillLevel" : null,
        level != null ? "level" : null,
        rating != null ? "rating" : null,
        assessmentResult != null ? "assessmentResult" : null,
      ].filter(Boolean),
      nonAuthoritative: true,
    },
  });
}
