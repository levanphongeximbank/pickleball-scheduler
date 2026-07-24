/**
 * INT-05 / BG-03 — Player Rating → RankingRatingSnapshotProviderPort adapter.
 *
 * Consumes injected rating reads only. Does not calculate or mutate rating history.
 * Prepares seeding input without rewriting CORE-07 Seeding Engine.
 */

import {
  CORE07_SNAPSHOT_PROVIDER_PORT_VERSION,
  isRankingRatingSnapshotProviderPort,
} from "../../../competition-core/seeding/ports/RankingRatingSnapshotProviderPort.js";
import {
  INTEGRATION_ERROR_CODE,
  INTEGRATION_SOURCE,
  RATING_COMPLETENESS,
} from "../constants.js";
import { optionalNonEmptyString } from "../context/requireIntegrationContext.js";
import { normalizeAdapterError, throwIntegrationError } from "../errors.js";

/**
 * Deterministic fingerprint for snapshot integrity (read-only).
 * @param {string} payload
 * @returns {string}
 */
function fingerprint(payload) {
  let h = 2166136261;
  const s = String(payload);
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return `fnv1a32:${(h >>> 0).toString(16).padStart(8, "0")}`;
}

/**
 * @param {unknown} value
 * @returns {number|null}
 */
function optionalFiniteNumber(value) {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/**
 * Normalize a single entry rating read into subject value.
 * @param {string} entryId
 * @param {unknown} raw
 */
function normalizeSubjectValue(entryId, raw) {
  if (raw == null) {
    return {
      entryId,
      available: false,
      ratingValue: null,
      rankingPosition: null,
      sourceSystem: null,
      reasonCodes: [INTEGRATION_ERROR_CODE.RATING_UNAVAILABLE],
    };
  }

  if (typeof raw !== "object") {
    return {
      entryId,
      available: false,
      ratingValue: null,
      rankingPosition: null,
      sourceSystem: null,
      reasonCodes: [INTEGRATION_ERROR_CODE.RATING_UNAVAILABLE],
    };
  }

  const row = /** @type {Record<string, unknown>} */ (raw);
  if (row.available === false) {
    return {
      entryId,
      available: false,
      ratingValue: null,
      rankingPosition: null,
      sourceSystem: optionalNonEmptyString(row.sourceSystem),
      reasonCodes: Array.isArray(row.reasonCodes)
        ? row.reasonCodes.map(String)
        : [INTEGRATION_ERROR_CODE.RATING_UNAVAILABLE],
    };
  }

  const ratingValue =
    optionalFiniteNumber(row.ratingValue) ??
    optionalFiniteNumber(row.displayRating) ??
    optionalFiniteNumber(row.value);
  const rankingPosition = optionalFiniteNumber(row.rankingPosition);

  if (ratingValue == null && rankingPosition == null) {
    return {
      entryId,
      available: false,
      ratingValue: null,
      rankingPosition: null,
      sourceSystem: optionalNonEmptyString(row.sourceSystem),
      reasonCodes: [INTEGRATION_ERROR_CODE.RATING_UNAVAILABLE],
    };
  }

  return {
    entryId,
    available: true,
    ratingValue,
    rankingPosition,
    sourceSystem:
      optionalNonEmptyString(row.sourceSystem) || INTEGRATION_SOURCE.PLAYER_RATING_READ,
    reasonCodes: [],
  };
}

/**
 * @param {{
 *   resolveRatings?: (input: {
 *     entryIds: string[],
 *     seedingScope: unknown,
 *     effectiveAt: string|number,
 *     snapshotRef?: string|null,
 *   }) => Record<string, unknown>|Map<string, unknown>|Array<{ entryId: string, [k: string]: unknown }>,
 *   sourceSystem?: string,
 *   sourceVersion?: string,
 *   requireComplete?: boolean,
 * }} [deps]
 * @returns {import('../../../competition-core/seeding/ports/RankingRatingSnapshotProviderPort.js').RankingRatingSnapshotProviderPort}
 */
export function createRankingRatingSnapshotFromRatingAdapter(deps = {}) {
  const resolveRatings = deps.resolveRatings;
  const sourceSystem =
    optionalNonEmptyString(deps.sourceSystem) || INTEGRATION_SOURCE.PLAYER_RATING_READ;
  const sourceVersion =
    optionalNonEmptyString(deps.sourceVersion) || "e2e-01-rating-snapshot-v1";
  const requireComplete = deps.requireComplete === true;

  return {
    contractVersion: CORE07_SNAPSHOT_PROVIDER_PORT_VERSION,
    getSnapshot(input) {
      if (!input || typeof input !== "object") {
        throwIntegrationError(
          INTEGRATION_ERROR_CODE.INVALID_REQUEST,
          "Rating snapshot request is required",
          { failClosed: true }
        );
      }

      const entryIds = Array.isArray(input.entryIds)
        ? input.entryIds.map((id) => String(id)).filter(Boolean)
        : [];
      const effectiveAt = input.effectiveAt;
      if (effectiveAt == null || effectiveAt === "") {
        throwIntegrationError(
          INTEGRATION_ERROR_CODE.INVALID_REQUEST,
          "effectiveAt is required for rating snapshot",
          { failClosed: true }
        );
      }

      if (typeof resolveRatings !== "function") {
        throwIntegrationError(
          INTEGRATION_ERROR_CODE.RATING_UNAVAILABLE,
          "Rating resolve function is not injected",
          { failClosed: true }
        );
      }

      let rawMap;
      try {
        rawMap = resolveRatings({
          entryIds: [...entryIds],
          seedingScope: input.seedingScope,
          effectiveAt,
          snapshotRef: input.snapshotRef ?? null,
        });
      } catch (err) {
        throw normalizeAdapterError(
          err,
          INTEGRATION_ERROR_CODE.RATING_UNAVAILABLE,
          "Rating resolve failed"
        );
      }

      /** @type {Map<string, unknown>} */
      const byId = new Map();
      if (rawMap instanceof Map) {
        for (const [k, v] of rawMap.entries()) {
          byId.set(String(k), v);
        }
      } else if (Array.isArray(rawMap)) {
        for (const row of rawMap) {
          if (row && typeof row === "object" && row.entryId != null) {
            byId.set(String(row.entryId), row);
          }
        }
      } else if (rawMap && typeof rawMap === "object") {
        for (const [k, v] of Object.entries(rawMap)) {
          byId.set(String(k), v);
        }
      }

      const subjectValues = entryIds.map((entryId) =>
        normalizeSubjectValue(entryId, byId.get(entryId))
      );
      const missing = subjectValues.filter((s) => !s.available);
      const available = subjectValues.filter((s) => s.available);

      let completenessState = RATING_COMPLETENESS.COMPLETE;
      if (entryIds.length === 0 || available.length === 0) {
        completenessState = RATING_COMPLETENESS.EMPTY;
      } else if (missing.length > 0) {
        completenessState = RATING_COMPLETENESS.PARTIAL;
      }

      if (requireComplete && completenessState !== RATING_COMPLETENESS.COMPLETE) {
        throwIntegrationError(
          INTEGRATION_ERROR_CODE.RATING_UNAVAILABLE,
          "Complete rating snapshot required but ratings are missing",
          {
            failClosed: true,
            details: {
              missingEntryIds: missing.map((m) => m.entryId),
              completenessState,
            },
          }
        );
      }

      const scopeRef =
        input.seedingScope && typeof input.seedingScope === "object"
          ? { ...input.seedingScope }
          : input.seedingScope ?? null;

      const snapshotId = fingerprint(
        JSON.stringify({
          entryIds,
          effectiveAt,
          completenessState,
          subjectValues,
          scopeRef,
        })
      );

      // Freeze subject values so callers cannot mutate canonical reads.
      const frozenSubjects = Object.freeze(
        subjectValues.map((s) => Object.freeze({ ...s }))
      );

      return Object.freeze({
        snapshotId,
        sourceSystem,
        sourceVersion,
        capturedAt: effectiveAt,
        effectiveAt,
        subjectValues: frozenSubjects,
        completenessState,
        missingDataMetadata:
          missing.length > 0
            ? Object.freeze(
                missing.map((m) =>
                  Object.freeze({
                    entryId: m.entryId,
                    reasonCodes: Object.freeze([...(m.reasonCodes || [])]),
                  })
                )
              )
            : null,
        checksum: snapshotId,
        fingerprint: snapshotId,
        scopeRef:
          scopeRef && typeof scopeRef === "object"
            ? Object.freeze({ ...scopeRef })
            : scopeRef,
      });
    },
  };
}

/**
 * @param {unknown} port
 * @returns {boolean}
 */
export function isRankingRatingSnapshotFromRatingAdapter(port) {
  return isRankingRatingSnapshotProviderPort(port);
}
