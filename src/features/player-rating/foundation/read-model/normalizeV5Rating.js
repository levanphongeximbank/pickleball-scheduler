/**
 * Normalize Pick_VN V5 rating profile records into canonical candidates.
 * Preserves V5 1.5–6.0 scale. Does not declare V5 table authority.
 * profiles.id-based player_id remains alias/unresolved unless canonical supplied.
 */

import { requireExplicitPlayerRatingScope } from "../contracts/scopeContract.js";
import { isSupportedRatingMode } from "../contracts/ratingModes.js";
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
export function normalizeV5Rating(record, options = {}) {
  if (!record || typeof record !== "object") {
    failReadModel(
      PLAYER_RATING_READ_MODEL_ERROR_CODE.INVALID_SOURCE_RECORD,
      "V5 rating record must be an object"
    );
  }

  if (options.treatAliasAsCanonical === true) {
    failReadModel(
      PLAYER_RATING_READ_MODEL_ERROR_CODE.ALIAS_TREATED_AS_CANONICAL,
      "V5 profiles.id / player_id homonym must not be treated as confirmed canonical identity"
    );
  }

  const raw = /** @type {Record<string, unknown>} */ (record);
  const sourceRecordId =
    optionalNonEmptyString(raw.id) ||
    optionalNonEmptyString(raw.sourceRecordId) ||
    optionalNonEmptyString(raw.profile_id);

  if (!sourceRecordId) {
    failReadModel(
      PLAYER_RATING_READ_MODEL_ERROR_CODE.INVALID_SOURCE_RECORD,
      "V5 rating record requires id / sourceRecordId"
    );
  }

  const profilePlayerId =
    optionalNonEmptyString(raw.player_id) ||
    optionalNonEmptyString(raw.playerId) ||
    optionalNonEmptyString(raw.profilesId) ||
    optionalNonEmptyString(raw.profiles_id);

  const aliases = [];
  if (profilePlayerId) {
    aliases.push({ kind: "profiles.id", value: profilePlayerId });
    aliases.push({ kind: "v5_player_id_homonym", value: profilePlayerId });
  }

  const warnings = [
    "SOURCE_SCALE_PICK_VN_V5_1_5_TO_6_0_PRESERVED",
    "NO_SCALE_CONVERSION_APPLIED",
    "V5_TABLE_NOT_DECLARED_RUNTIME_SSOT",
    "PROFILES_ID_IS_ALIAS_OR_UNRESOLVED_UNLESS_CANONICAL_SUPPLIED",
  ];

  let playerId = null;
  const canonical = optionalNonEmptyString(options.canonicalPlayerId);
  let playerIdResolutionStatus;
  if (canonical) {
    playerId = canonical;
    playerIdResolutionStatus = PLAYER_ID_RESOLUTION_STATUS.RESOLVED;
  } else {
    playerIdResolutionStatus = profilePlayerId
      ? PLAYER_ID_RESOLUTION_STATUS.ALIAS_ONLY
      : PLAYER_ID_RESOLUTION_STATUS.UNRESOLVED;
    warnings.push("CANONICAL_PLAYER_ID_UNRESOLVED");
  }

  const tenantIdRaw =
    optionalNonEmptyString(raw.tenant_id) ||
    optionalNonEmptyString(raw.tenantId) ||
    optionalNonEmptyString(options.tenantId);

  const scope =
    options.scope != null
      ? requireExplicitPlayerRatingScope(options.scope)
      : tenantIdRaw != null
        ? requireExplicitPlayerRatingScope(tenantIdRaw)
        : null;

  const tenantId =
    scope && scope.kind === "tenant" ? scope.tenantId : tenantIdRaw;

  const modeRaw =
    optionalNonEmptyString(raw.rating_mode) ||
    optionalNonEmptyString(raw.ratingMode) ||
    "doubles";
  if (!isSupportedRatingMode(modeRaw) && modeRaw !== "overall") {
    warnings.push(`UNSUPPORTED_OR_OPEN_RATING_MODE:${modeRaw}`);
  }

  const selfAssessed =
    optionalFiniteNumber(raw.self_assessed_rating) ??
    optionalFiniteNumber(raw.selfAssessedRating);

  const provisional =
    optionalFiniteNumber(raw.provisional_rating) ??
    optionalFiniteNumber(raw.provisionalRating);

  const verified =
    optionalFiniteNumber(raw.verified_rating_mean) ??
    optionalFiniteNumber(raw.verifiedRatingMean) ??
    optionalFiniteNumber(raw.verified_rating) ??
    optionalFiniteNumber(raw.verifiedRating);

  const calculated =
    optionalFiniteNumber(raw.open_rating_mean) ??
    optionalFiniteNumber(raw.openRatingMean);

  const display =
    optionalFiniteNumber(raw.display_rating) ??
    optionalFiniteNumber(raw.displayRating);

  const confidence =
    optionalFiniteNumber(raw.reliability_score) ??
    optionalFiniteNumber(raw.reliabilityScore);

  const status =
    optionalNonEmptyString(raw.rating_status) ||
    optionalNonEmptyString(raw.ratingStatus);

  const effectiveAt =
    optionalTimestamp(raw.last_rated_at) ||
    optionalTimestamp(raw.lastRatedAt) ||
    optionalTimestamp(raw.updated_at) ||
    optionalTimestamp(raw.updatedAt) ||
    optionalTimestamp(raw.created_at) ||
    optionalTimestamp(raw.createdAt);

  const algorithmVersion =
    optionalNonEmptyString(raw.engine_version) ||
    optionalNonEmptyString(raw.engineVersion) ||
    optionalNonEmptyString(raw.algorithmVersion);

  const openDeviation =
    optionalFiniteNumber(raw.open_rating_deviation) ??
    optionalFiniteNumber(raw.openRatingDeviation);
  const verifiedDeviation =
    optionalFiniteNumber(raw.verified_rating_deviation) ??
    optionalFiniteNumber(raw.verifiedRatingDeviation);

  return createCurrentStateCandidate({
    sourceType: PLAYER_RATING_SOURCE_TYPE.PICK_VN_V5,
    sourceRecordId,
    sourceScale: PLAYER_RATING_SOURCE_SCALE.PICK_VN_V5_1_5_TO_6_0,
    ratingMode: modeRaw,
    playerId,
    playerIdResolutionStatus,
    unresolvedIdentityMarker: profilePlayerId
      ? `profiles.id:${profilePlayerId}`
      : sourceRecordId,
    selfAssessedRating: selfAssessed,
    provisionalRating: provisional,
    verifiedRating: verified,
    calculatedRating: calculated,
    displayRating: display,
    confidence,
    confidenceScale: CONFIDENCE_SCALE.PERCENT_0_100,
    status,
    effectiveAt,
    algorithmVersion,
    tenantId,
    scope,
    aliases,
    warnings,
    authoritativeForPublicPlayerRating: false,
    rawSourceMetadata: {
      store: "player_rating_profiles",
      isShadow:
        raw.is_shadow === true ||
        raw.isShadow === true ||
        raw.is_shadow == null,
      evidenceLevel:
        optionalFiniteNumber(raw.evidence_level) ??
        optionalFiniteNumber(raw.evidenceLevel),
      openRatingDeviation: openDeviation,
      verifiedRatingDeviation: verifiedDeviation,
      assessmentCount:
        optionalFiniteNumber(raw.assessment_count) ??
        optionalFiniteNumber(raw.assessmentCount),
      openMatchCount:
        optionalFiniteNumber(raw.open_match_count) ??
        optionalFiniteNumber(raw.openMatchCount),
      verifiedMatchCount:
        optionalFiniteNumber(raw.verified_match_count) ??
        optionalFiniteNumber(raw.verifiedMatchCount),
      ratingModeRaw: modeRaw,
      profilesIdHomonymPresent: Boolean(profilePlayerId),
      hasCanonicalPlayerIdExplicit: Boolean(canonical),
    },
  });
}
