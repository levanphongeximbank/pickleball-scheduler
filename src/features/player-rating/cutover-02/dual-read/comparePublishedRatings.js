/**
 * Dual-read comparison boundary.
 *
 * Contract:
 * - Always return published V2 value to caller (never promote V5).
 * - Comparison failures fail-open for published response.
 * - No backfill, no mutate, no auto-promote.
 */

import {
  isDualReadCompareEnabled,
  isPlayerInDualReadCohort,
  isTenantAllowedForCutover02,
  resolveCutover02Config,
} from "../config/featureFlags.js";
import { hashPlayerIdForEvidence, sanitizeEvidenceValue } from "../evidence/sanitizeEvidence.js";
import { compareRawRatingPair, resolveScaleMappingPolicy } from "./scaleMapping.js";
import { classifyDualReadCompareOutcome } from "./classifyCompareOutcome.js";
import { getPlayerCurrentRating } from "../../../../models/player.js";

/** @type {Array<Record<string, unknown>>} */
const evidenceSink = [];

export function __resetDualReadEvidenceForTests() {
  evidenceSink.length = 0;
}

export function __getDualReadEvidenceForTests() {
  return evidenceSink.slice();
}

/**
 * @param {Record<string, unknown>} evidence
 */
function emitEvidence(evidence, emitter) {
  const safe = sanitizeEvidenceValue(evidence);
  evidenceSink.push(safe);
  if (typeof emitter === "function") {
    try {
      emitter(safe);
    } catch {
      // Evidence sink must never break user flow.
    }
  }
  return safe;
}

/**
 * Extract V2 published numeric from player-like object (same path as product).
 * @param {unknown} player
 * @param {number|null} [fallback=null]
 */
export function readPublishedV2RatingValue(player, fallback = null) {
  if (!player) {
    return fallback;
  }
  try {
    // Prefer explicit current_rating without inventing 3.5 when absent.
    const raw = /** @type {Record<string, unknown>} */ (player);
    if (raw.current_rating !== undefined && raw.current_rating !== null && raw.current_rating !== "") {
      return getPlayerCurrentRating(player, fallback ?? 3.5);
    }
    if (
      (raw.skillLevel != null && raw.skillLevel !== "") ||
      (raw.level != null && raw.level !== "") ||
      (raw.rating != null && raw.rating !== "")
    ) {
      return getPlayerCurrentRating(player, fallback ?? 3.5);
    }
    return fallback;
  } catch (err) {
    const error = err instanceof Error ? err.message : "V2_READ_ERROR";
    return { __error: error };
  }
}

/**
 * Normalize optional V5 shadow candidate input (already fetched by caller).
 * @param {unknown} v5Record
 */
export function normalizeV5ShadowCandidate(v5Record) {
  if (v5Record == null) {
    return { present: false, rating: null, invalidated: false, error: null };
  }
  if (typeof v5Record === "object" && v5Record && "__error" in v5Record) {
    return {
      present: false,
      rating: null,
      invalidated: false,
      error: String(/** @type {{ __error?: unknown }} */ (v5Record).__error || "V5_READ_ERROR"),
    };
  }
  const raw = /** @type {Record<string, unknown>} */ (v5Record);
  const invalidated =
    raw.invalidated === true ||
    raw.is_invalidated === true ||
    String(raw.status || "").toLowerCase() === "invalidated";
  const ratingRaw =
    raw.display_rating ??
    raw.displayRating ??
    raw.rating_mean ??
    raw.ratingMean ??
    raw.current_rating ??
    null;
  const rating = Number(ratingRaw);
  return {
    present: Number.isFinite(rating),
    rating: Number.isFinite(rating) ? rating : null,
    invalidated,
    isShadow: raw.is_shadow !== false,
    tenantId: raw.tenant_id ?? raw.tenantId ?? null,
    playerId: raw.player_id ?? raw.playerId ?? null,
    updatedAt: raw.updated_at ?? raw.updatedAt ?? raw.effective_at ?? null,
    stale: raw.stale === true,
    error: null,
  };
}

/**
 * Dual-read compare sidecar. Returns published V2 always.
 *
 * @param {{
 *   player?: unknown,
 *   v2Rating?: number|null,
 *   v2Error?: string|null,
 *   v5Record?: unknown,
 *   playerId?: string|null,
 *   tenantId?: string|null,
 *   env?: Record<string, unknown>,
 *   emit?: (evidence: Record<string, unknown>) => void,
 *   now?: string,
 * }} input
 */
export function comparePublishedRatingDualRead(input = {}) {
  const config = resolveCutover02Config(input.env);
  const playerId = String(input.playerId || "").trim() || null;
  const tenantId = input.tenantId != null ? String(input.tenantId) : null;

  let publishedRating = null;
  let v2Error = input.v2Error ? String(input.v2Error) : null;

  if (input.v2Rating != null && Number.isFinite(Number(input.v2Rating))) {
    publishedRating = Number(input.v2Rating);
  } else if (input.player) {
    const read = readPublishedV2RatingValue(input.player, null);
    if (read && typeof read === "object" && "__error" in read) {
      v2Error = String(read.__error);
      publishedRating = null;
    } else {
      publishedRating = read;
    }
  }

  const baseResult = Object.freeze({
    publishedAuthority: "V2",
    publishedRating,
    compareRan: false,
    evidence: null,
    config: Object.freeze({
      dualReadCompareEnabled: config.dualReadCompareEnabled,
      productionDenied: config.productionDenied,
      denyReason: config.denyReason,
    }),
  });

  const cohortOk = isPlayerInDualReadCohort(playerId, config);
  const tenantOk = isTenantAllowedForCutover02(tenantId, config);
  if (!config.dualReadCompareEnabled || !cohortOk || !tenantOk) {
    return baseResult;
  }

  try {
    const mappingPolicy = resolveScaleMappingPolicy({
      status: config.scaleMappingStatus,
      strategy: config.scaleMappingStrategy,
    });
    const v5 = normalizeV5ShadowCandidate(input.v5Record);

    const v2 = {
      present: publishedRating != null && Number.isFinite(publishedRating),
      rating: publishedRating,
      error: v2Error,
      tenantId,
      playerId,
      stale: false,
    };

    const classification = classifyDualReadCompareOutcome({
      v2,
      v5,
      expectedTenantId: tenantId,
      expectedPlayerId: playerId,
      mappingApproved: mappingPolicy.approvedEquivalence,
    });

    const rawCompare = compareRawRatingPair(v2.rating, v5.rating, mappingPolicy);

    const evidence = emitEvidence(
      {
        kind: "dual_read_compare",
        at: input.now || new Date().toISOString(),
        playerIdHash: hashPlayerIdForEvidence(playerId),
        tenantId: tenantId || null,
        publishedAuthority: "V2",
        publishedRating,
        v2: {
          present: v2.present,
          rating: v2.rating,
          scaleId: rawCompare.scaleIds.v2,
          errorCode: v2Error ? "READ_ERROR_V2" : null,
        },
        v5: {
          present: v5.present,
          rating: v5.rating,
          scaleId: rawCompare.scaleIds.v5,
          invalidated: v5.invalidated === true,
          isShadow: v5.isShadow !== false,
          errorCode: v5.error ? "READ_ERROR_V5" : null,
        },
        classification,
        rawCompare,
        mapping: {
          status: mappingPolicy.status,
          strategy: mappingPolicy.strategy,
          OWNER_APPROVAL_REQUIRED: mappingPolicy.OWNER_APPROVAL_REQUIRED,
        },
      },
      input.emit
    );

    // Fail-open: even on V2 error, never promote V5 as publishedRating.
    return Object.freeze({
      publishedAuthority: "V2",
      publishedRating: v2Error ? null : publishedRating,
      compareRan: true,
      evidence,
      config: baseResult.config,
    });
  } catch (err) {
    emitEvidence(
      {
        kind: "dual_read_compare_error",
        at: input.now || new Date().toISOString(),
        playerIdHash: hashPlayerIdForEvidence(playerId),
        errorCode: "COMPARE_INTERNAL_ERROR",
        message: err instanceof Error ? err.message : "compare_failed",
        publishedAuthority: "V2",
        publishedRating,
      },
      input.emit
    );
    return Object.freeze({
      publishedAuthority: "V2",
      publishedRating,
      compareRan: false,
      evidence: null,
      config: baseResult.config,
      compareError: true,
    });
  }
}

/**
 * Convenience: published rating from player with optional V5 sidecar compare.
 * Never changes return semantics of getPlayerCurrentRating.
 */
export function getPublishedRatingWithOptionalCompare(player, options = {}) {
  const fallback = options.fallback !== undefined ? options.fallback : 3.5;
  const published = getPlayerCurrentRating(player, fallback);

  if (!isDualReadCompareEnabled(options.env)) {
    return published;
  }

  comparePublishedRatingDualRead({
    player,
    v2Rating: published,
    v5Record: options.v5Record,
    playerId: options.playerId || player?.id || player?.auth_user_id || null,
    tenantId: options.tenantId || null,
    env: options.env,
    emit: options.emit,
  });

  return published;
}
