/**
 * Normalize Pick_VN V2 rating records into canonical candidates.
 * Preserves V2 1.0–8.0 scale. Does not convert to V5.
 * auth_user_id remains alias only.
 */

import { requireExplicitPlayerRatingScope } from "../contracts/scopeContract.js";
import { isNonEmptyString } from "../contracts/shared.js";
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
 *   canonicalPlayerId?: string|null,
 *   scope?: unknown,
 *   tenantId?: string|null,
 *   treatAliasAsCanonical?: boolean,
 * }} [options]
 * @returns {Readonly<import('./currentStateCandidate.js').PlayerRatingCurrentStateCandidate>}
 */
export function normalizeV2Rating(record, options = {}) {
  if (!record || typeof record !== "object") {
    failReadModel(
      PLAYER_RATING_READ_MODEL_ERROR_CODE.INVALID_SOURCE_RECORD,
      "V2 rating record must be an object"
    );
  }

  if (options.treatAliasAsCanonical === true) {
    failReadModel(
      PLAYER_RATING_READ_MODEL_ERROR_CODE.ALIAS_TREATED_AS_CANONICAL,
      "V2 auth_user_id / aliases must not be treated as confirmed canonical identity"
    );
  }

  const raw = /** @type {Record<string, unknown>} */ (record);
  const sourceRecordId =
    optionalNonEmptyString(raw.id) ||
    optionalNonEmptyString(raw.sourceRecordId) ||
    optionalNonEmptyString(raw.rating_id);

  if (!sourceRecordId) {
    failReadModel(
      PLAYER_RATING_READ_MODEL_ERROR_CODE.INVALID_SOURCE_RECORD,
      "V2 rating record requires id / sourceRecordId"
    );
  }

  const aliases = [];
  const authUserId =
    optionalNonEmptyString(raw.authUserId) ||
    optionalNonEmptyString(raw.auth_user_id);
  if (authUserId) {
    aliases.push({ kind: "auth_user_id", value: authUserId });
  }
  const vprAthleteId =
    optionalNonEmptyString(raw.vprAthleteId) ||
    optionalNonEmptyString(raw.vpr_athlete_id);
  if (vprAthleteId) {
    aliases.push({ kind: "vpr_athlete_id", value: vprAthleteId });
  }

  const warnings = [
    "SOURCE_SCALE_PICK_VN_V2_1_0_TO_8_0_PRESERVED",
    "NO_SCALE_CONVERSION_APPLIED",
    "AUTH_USER_ID_IS_ALIAS_ONLY",
  ];

  let playerId = null;
  let playerIdResolutionStatus = PLAYER_ID_RESOLUTION_STATUS.ALIAS_ONLY;
  const canonical = optionalNonEmptyString(options.canonicalPlayerId);
  if (canonical) {
    playerId = canonical;
    playerIdResolutionStatus = PLAYER_ID_RESOLUTION_STATUS.RESOLVED;
  } else if (aliases.length === 0) {
    playerIdResolutionStatus = PLAYER_ID_RESOLUTION_STATUS.UNRESOLVED;
    warnings.push("CANONICAL_PLAYER_ID_UNRESOLVED");
  } else {
    warnings.push("CANONICAL_PLAYER_ID_UNRESOLVED");
  }

  if (
    isNonEmptyString(raw.playerId) &&
    raw.playerIdIsCanonical === true &&
    !canonical
  ) {
    // Explicit flag required — never promote opaque field silently.
    playerId = String(raw.playerId).trim();
    playerIdResolutionStatus = PLAYER_ID_RESOLUTION_STATUS.RESOLVED;
  } else if (isNonEmptyString(raw.playerId) && !canonical) {
    aliases.push({ kind: "declared_player_id_unconfirmed", value: String(raw.playerId).trim() });
    warnings.push("DECLARED_PLAYER_ID_NOT_TREATED_AS_CANONICAL");
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

  const selfAssessed =
    optionalFiniteNumber(raw.selfDeclaredRating) ??
    optionalFiniteNumber(raw.self_declared_rating) ??
    optionalFiniteNumber(raw.selfAssessedRating) ??
    optionalFiniteNumber(raw.self_assessed_rating);

  const provisional =
    optionalFiniteNumber(raw.provisionalRating) ??
    optionalFiniteNumber(raw.provisional_rating);

  const verified =
    optionalFiniteNumber(raw.verifiedRating) ??
    optionalFiniteNumber(raw.verified_rating);

  const display =
    optionalFiniteNumber(raw.currentRating) ??
    optionalFiniteNumber(raw.current_rating);

  const confidence =
    optionalFiniteNumber(raw.ratingConfidence) ??
    optionalFiniteNumber(raw.rating_confidence);

  const status =
    optionalNonEmptyString(raw.ratingStatus) ||
    optionalNonEmptyString(raw.rating_status);

  const effectiveAt =
    optionalTimestamp(raw.lastRatingUpdatedAt) ||
    optionalTimestamp(raw.last_rating_updated_at) ||
    optionalTimestamp(raw.updatedAt) ||
    optionalTimestamp(raw.updated_at) ||
    optionalTimestamp(raw.createdAt) ||
    optionalTimestamp(raw.created_at);

  const historyRefs = [];
  const history = raw.ratingHistory ?? raw.rating_history;
  if (Array.isArray(history)) {
    for (const entry of history) {
      if (entry && typeof entry === "object") {
        const at = optionalTimestamp(/** @type {Record<string, unknown>} */ (entry).at);
        if (at != null) historyRefs.push({ at });
      }
    }
  }

  return createCurrentStateCandidate({
    sourceType: PLAYER_RATING_SOURCE_TYPE.PICK_VN_V2,
    sourceRecordId,
    sourceScale: PLAYER_RATING_SOURCE_SCALE.PICK_VN_V2_1_0_TO_8_0,
    ratingMode: optionalNonEmptyString(raw.ratingMode) ||
      optionalNonEmptyString(raw.rating_mode) ||
      "overall",
    playerId,
    playerIdResolutionStatus,
    unresolvedIdentityMarker: authUserId
      ? `auth_user_id:${authUserId}`
      : sourceRecordId,
    selfAssessedRating: selfAssessed,
    provisionalRating: provisional,
    verifiedRating: verified,
    displayRating: display,
    confidence,
    confidenceScale: CONFIDENCE_SCALE.UNIT_0_1,
    status,
    effectiveAt,
    algorithmVersion: optionalNonEmptyString(raw.algorithmVersion),
    tenantId,
    scope,
    aliases,
    warnings,
    authoritativeForPublicPlayerRating: false,
    rawSourceMetadata: {
      store: "pick_vn_player_ratings",
      historyReferenceCount: historyRefs.length,
      historyRefs: historyRefs.slice(0, 8),
      ratingMatchCount:
        optionalFiniteNumber(raw.ratingMatchCount) ??
        optionalFiniteNumber(raw.rating_match_count),
      hasAssessmentAnswers: Boolean(
        raw.assessmentAnswers || raw.assessment_answers
      ),
    },
  });
}
