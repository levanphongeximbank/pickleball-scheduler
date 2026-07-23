/**
 * Collect multiple source rating records into immutable candidate sets.
 * Does not select a winner, merge, average, or convert scales.
 */

import { requireExplicitPlayerRatingScope } from "../contracts/scopeContract.js";
import { deepFreeze, isNonEmptyString } from "../contracts/shared.js";
import {
  sortCandidatesDeterministically,
} from "./currentStateCandidate.js";
import { normalizeLegacyRating } from "./normalizeLegacyRating.js";
import { normalizeV2Rating } from "./normalizeV2Rating.js";
import { normalizeV5Rating } from "./normalizeV5Rating.js";
import {
  PLAYER_RATING_READ_MODEL_ERROR_CODE,
  failReadModel,
} from "./ratingReadModelErrors.js";
import {
  isKnownPlayerRatingSourceType,
  isNonAuthoritativeSourceType,
  isNormalizableSourceType,
  PLAYER_ID_RESOLUTION_STATUS,
  PLAYER_RATING_SOURCE_TYPE,
} from "./sourceTypes.js";

/**
 * @typedef {Object} RatingSourceInput
 * @property {string} sourceType
 * @property {unknown} record
 * @property {string} [canonicalPlayerId]
 * @property {unknown} [scope]
 * @property {string} [tenantId]
 * @property {boolean} [treatAliasAsCanonical]
 * @property {string} [provenSourceScale]
 * @property {string} [inputKey]
 */

/**
 * @param {unknown} input
 * @returns {{
 *   sources: RatingSourceInput[],
 *   scope: unknown,
 *   failClosedOnIdentityConflict: boolean,
 * }}
 */
function parseCollectorInput(input) {
  if (!input || typeof input !== "object") {
    failReadModel(
      PLAYER_RATING_READ_MODEL_ERROR_CODE.INVALID_SOURCE_RECORD,
      "collectRatingCandidates input must be an object"
    );
  }

  const raw = /** @type {Record<string, unknown>} */ (input);
  const sources = Array.isArray(raw.sources)
    ? raw.sources
    : Array.isArray(raw.records)
      ? raw.records
      : null;

  if (!sources) {
    failReadModel(
      PLAYER_RATING_READ_MODEL_ERROR_CODE.INVALID_SOURCE_RECORD,
      "collectRatingCandidates requires sources[]"
    );
  }

  return {
    sources: /** @type {RatingSourceInput[]} */ (sources),
    scope: raw.scope,
    failClosedOnIdentityConflict: raw.failClosedOnIdentityConflict !== false,
  };
}

/**
 * @param {RatingSourceInput} source
 * @param {unknown} defaultScope
 */
function normalizeOne(source, defaultScope) {
  if (!source || typeof source !== "object") {
    return {
      ok: false,
      rejected: {
        reason: "INVALID_SOURCE_ENVELOPE",
        sourceType: PLAYER_RATING_SOURCE_TYPE.UNKNOWN,
        record: source,
        errorCode: PLAYER_RATING_READ_MODEL_ERROR_CODE.INVALID_SOURCE_RECORD,
      },
    };
  }

  const sourceType = source.sourceType;
  if (!isNonEmptyString(sourceType)) {
    return {
      ok: false,
      rejected: {
        reason: "MISSING_SOURCE_TYPE",
        sourceType: PLAYER_RATING_SOURCE_TYPE.UNKNOWN,
        record: source.record ?? null,
        errorCode: PLAYER_RATING_READ_MODEL_ERROR_CODE.UNSUPPORTED_SOURCE_TYPE,
      },
    };
  }

  if (!isKnownPlayerRatingSourceType(sourceType)) {
    return {
      ok: false,
      rejected: {
        reason: "UNSUPPORTED_SOURCE_TYPE",
        sourceType: String(sourceType),
        record: source.record ?? null,
        errorCode: PLAYER_RATING_READ_MODEL_ERROR_CODE.UNSUPPORTED_SOURCE_TYPE,
      },
    };
  }

  if (sourceType === PLAYER_RATING_SOURCE_TYPE.UNKNOWN) {
    return {
      ok: false,
      rejected: {
        reason: "UNKNOWN_SOURCE_TYPE",
        sourceType,
        record: source.record ?? null,
        errorCode: PLAYER_RATING_READ_MODEL_ERROR_CODE.UNSUPPORTED_SOURCE_TYPE,
      },
    };
  }

  if (isNonAuthoritativeSourceType(sourceType)) {
    return {
      ok: false,
      rejected: {
        reason: "NON_AUTHORITATIVE_SIGNAL_NOT_PUBLIC_PLAYER_RATING",
        sourceType,
        record: source.record ?? null,
        errorCode: null,
        classified: true,
      },
    };
  }

  if (!isNormalizableSourceType(sourceType)) {
    return {
      ok: false,
      rejected: {
        reason: "UNSUPPORTED_SOURCE_TYPE",
        sourceType,
        record: source.record ?? null,
        errorCode: PLAYER_RATING_READ_MODEL_ERROR_CODE.UNSUPPORTED_SOURCE_TYPE,
      },
    };
  }

  if (source.canonicalPlayerId != null && source.canonicalPlayerId !== "") {
    if (!isNonEmptyString(source.canonicalPlayerId)) {
      failReadModel(
        PLAYER_RATING_READ_MODEL_ERROR_CODE.INVALID_SOURCE_RECORD,
        "canonicalPlayerId must be a non-empty string when supplied",
        { canonicalPlayerId: source.canonicalPlayerId }
      );
    }
  }

  const scope = source.scope ?? defaultScope;
  if (scope != null) {
    requireExplicitPlayerRatingScope(scope);
  }

  const options = {
    canonicalPlayerId: source.canonicalPlayerId,
    scope,
    tenantId: source.tenantId,
    treatAliasAsCanonical: source.treatAliasAsCanonical === true,
    provenSourceScale: source.provenSourceScale,
    sourceType,
  };

  try {
    let candidate;
    if (sourceType === PLAYER_RATING_SOURCE_TYPE.PICK_VN_V2) {
      candidate = normalizeV2Rating(source.record, options);
    } else if (sourceType === PLAYER_RATING_SOURCE_TYPE.PICK_VN_V5) {
      candidate = normalizeV5Rating(source.record, options);
    } else {
      candidate = normalizeLegacyRating(source.record, options);
    }
    return { ok: true, candidate };
  } catch (err) {
    const code =
      err && typeof err === "object" && "code" in err
        ? /** @type {{ code?: string }} */ (err).code
        : PLAYER_RATING_READ_MODEL_ERROR_CODE.INVALID_SOURCE_RECORD;
    return {
      ok: false,
      rejected: {
        reason: "NORMALIZATION_FAILED",
        sourceType,
        record: source.record ?? null,
        errorCode: code || PLAYER_RATING_READ_MODEL_ERROR_CODE.INVALID_SOURCE_RECORD,
        message:
          err instanceof Error ? err.message : "Normalization failed",
      },
    };
  }
}

/**
 * Detect conflicts across accepted candidates (no winner selection).
 * @param {import('./currentStateCandidate.js').PlayerRatingCurrentStateCandidate[]} candidates
 */
function detectConflicts(candidates) {
  /** @type {Array<Record<string, unknown>>} */
  const identityConflicts = [];
  /** @type {Array<Record<string, unknown>>} */
  const scaleConflicts = [];
  /** @type {Array<Record<string, unknown>>} */
  const modeConflicts = [];
  /** @type {string[]} */
  const warnings = [];

  const resolvedIds = [
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

  if (resolvedIds.length > 1) {
    identityConflicts.push({
      type: "CANONICAL_PLAYER_ID_CONFLICT",
      playerIds: resolvedIds,
      candidateIds: candidates
        .filter((c) => resolvedIds.includes(/** @type {string} */ (c.playerId)))
        .map((c) => c.candidateId)
        .sort(),
    });
  }

  const scales = [
    ...new Set(candidates.map((c) => c.sourceScale).filter(Boolean)),
  ].sort();
  if (scales.length > 1) {
    scaleConflicts.push({
      type: "SOURCE_SCALE_CONFLICT",
      scales,
      candidateIds: candidates.map((c) => c.candidateId).sort(),
    });
    warnings.push("MULTIPLE_SOURCE_SCALES_PRESENT_NO_CONVERSION");
  }

  const modes = [
    ...new Set(candidates.map((c) => c.ratingMode).filter(Boolean)),
  ].sort();
  if (modes.length > 1) {
    modeConflicts.push({
      type: "RATING_MODE_CONFLICT",
      modes,
      candidateIds: candidates.map((c) => c.candidateId).sort(),
    });
    warnings.push("MULTIPLE_RATING_MODES_PRESENT_NO_MERGE");
  }

  return { identityConflicts, scaleConflicts, modeConflicts, warnings, resolvedIds };
}

/**
 * Stable fingerprint for exact-duplicate detection (excludes object identity).
 * @param {import('./currentStateCandidate.js').PlayerRatingCurrentStateCandidate} candidate
 */
function candidateFingerprint(candidate) {
  return JSON.stringify(candidate);
}

/**
 * Deterministic de-dupe by candidateId only when fingerprints match.
 * Conflicting payloads with the same candidateId fail closed.
 * @param {import('./currentStateCandidate.js').PlayerRatingCurrentStateCandidate[]} candidates
 */
function dedupeByCandidateId(candidates) {
  /** @type {Map<string, import('./currentStateCandidate.js').PlayerRatingCurrentStateCandidate>} */
  const map = new Map();
  /** @type {string[]} */
  const warnings = [];
  for (const candidate of candidates) {
    const existing = map.get(candidate.candidateId);
    if (existing) {
      if (candidateFingerprint(existing) === candidateFingerprint(candidate)) {
        warnings.push(`DEDUPE_EXACT_CANDIDATE_ID:${candidate.candidateId}`);
        continue;
      }
      failReadModel(
        PLAYER_RATING_READ_MODEL_ERROR_CODE.CANDIDATE_IDENTITY_COLLISION,
        "Distinct payloads collided on the same candidateId",
        { candidateId: candidate.candidateId }
      );
    }
    map.set(candidate.candidateId, candidate);
  }
  return { candidates: [...map.values()], warnings };
}

/**
 * Collect rating source inputs into immutable candidate / rejection sets.
 * Does not select an authoritative SSOT.
 *
 * @param {unknown} input
 * @returns {Readonly<{
 *   candidates: ReadonlyArray<import('./currentStateCandidate.js').PlayerRatingCurrentStateCandidate>,
 *   rejected: ReadonlyArray<Record<string, unknown>>,
 *   warnings: ReadonlyArray<string>,
 *   identityConflicts: ReadonlyArray<Record<string, unknown>>,
 *   scaleConflicts: ReadonlyArray<Record<string, unknown>>,
 *   modeConflicts: ReadonlyArray<Record<string, unknown>>,
 *   sourceSummary: Readonly<Record<string, number>>,
 * }>}
 */
export function collectRatingCandidates(input) {
  const parsed = parseCollectorInput(input);
  if (parsed.scope != null) {
    requireExplicitPlayerRatingScope(parsed.scope);
  }

  /** @type {import('./currentStateCandidate.js').PlayerRatingCurrentStateCandidate[]} */
  const accepted = [];
  /** @type {Record<string, unknown>[]} */
  const rejected = [];
  /** @type {string[]} */
  const warnings = [];
  /** @type {Record<string, number>} */
  const sourceSummary = {};

  for (let i = 0; i < parsed.sources.length; i += 1) {
    const source = parsed.sources[i];
    const typeKey =
      source && typeof source === "object" && isNonEmptyString(source.sourceType)
        ? String(source.sourceType)
        : PLAYER_RATING_SOURCE_TYPE.UNKNOWN;
    sourceSummary[typeKey] = (sourceSummary[typeKey] || 0) + 1;

    const result = normalizeOne(source, parsed.scope);
    if (result.ok && result.candidate) {
      accepted.push(result.candidate);
    } else if (result.rejected) {
      rejected.push(
        deepFreeze({
          index: i,
          inputKey:
            source && typeof source === "object" && source.inputKey
              ? String(source.inputKey)
              : `index:${i}`,
          ...result.rejected,
        })
      );
      if (result.rejected.reason === "MISSING_SOURCE_TYPE") {
        // Required source type missing — fail closed for that envelope.
        failReadModel(
          PLAYER_RATING_READ_MODEL_ERROR_CODE.UNSUPPORTED_SOURCE_TYPE,
          "Required sourceType is missing on source input",
          { index: i }
        );
      }
    }
  }

  const deduped = dedupeByCandidateId(accepted);
  warnings.push(...deduped.warnings);

  // Collision of distinct payloads sharing one candidateId after normalize is already
  // handled by exact de-dupe. Distinct candidateIds with same sourceRecordId are kept.

  const sorted = sortCandidatesDeterministically(deduped.candidates);
  const conflicts = detectConflicts(sorted);
  warnings.push(...conflicts.warnings);

  if (
    parsed.failClosedOnIdentityConflict &&
    conflicts.identityConflicts.length > 0
  ) {
    failReadModel(
      PLAYER_RATING_READ_MODEL_ERROR_CODE.CANONICAL_PLAYER_ID_CONFLICT,
      "Conflicting canonical playerIds appear in one collection",
      {
        identityConflicts: conflicts.identityConflicts,
        playerIds: conflicts.resolvedIds,
      }
    );
  }

  return deepFreeze({
    candidates: sorted,
    rejected,
    warnings: [...warnings].sort(),
    identityConflicts: conflicts.identityConflicts,
    scaleConflicts: conflicts.scaleConflicts,
    modeConflicts: conflicts.modeConflicts,
    sourceSummary: Object.freeze({ ...sourceSummary }),
  });
}
