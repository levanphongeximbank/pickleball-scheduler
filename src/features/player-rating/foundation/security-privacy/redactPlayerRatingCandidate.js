/**
 * Allowlist-based candidate redaction / projection (Phase 1I).
 * Creates new immutable outputs; never mutates source objects.
 */

import { clonePlain, deepFreeze } from "../contracts/shared.js";
import { createPlayerRatingPrivacyPolicy } from "./createPlayerRatingPrivacyPolicy.js";
import { PLAYER_RATING_PRIVACY_PROJECTION_LEVEL } from "./privacyProjectionLevels.js";
import {
  PLAYER_RATING_SECURITY_PRIVACY_ERROR_CODE,
  failSecurityPrivacy,
} from "./securityPrivacyErrors.js";

/**
 * @param {unknown} warnings
 * @param {ReadonlyArray<string>} allowlist
 * @returns {string[]}
 */
function filterPublicWarnings(warnings, allowlist) {
  if (!Array.isArray(warnings)) return [];
  const allow = new Set(allowlist);
  return warnings
    .map((w) => String(w))
    .filter((w) => {
      if (allow.has(w)) return true;
      if (w.startsWith("UNSUPPORTED_OR_OPEN_RATING_MODE:")) return true;
      return false;
    })
    .sort();
}

/**
 * Strip always-excluded profile / secret keys recursively.
 * @param {unknown} value
 * @param {ReadonlyArray<string>} excludedKeys
 * @returns {unknown}
 */
export function stripExcludedKeys(value, excludedKeys) {
  if (value == null || typeof value !== "object") return value;
  if (Array.isArray(value)) {
    return value.map((item) => stripExcludedKeys(item, excludedKeys));
  }
  const excluded = new Set(excludedKeys);
  /** @type {Record<string, unknown>} */
  const out = {};
  for (const [key, child] of Object.entries(
    /** @type {Record<string, unknown>} */ (value)
  )) {
    if (excluded.has(key)) continue;
    out[key] = stripExcludedKeys(child, excludedKeys);
  }
  return out;
}

/**
 * @param {Record<string, unknown>} out
 * @returns {Record<string, unknown>}
 */
function orderKeys(out) {
  /** @type {Record<string, unknown>} */
  const ordered = {};
  for (const key of Object.keys(out).sort()) {
    ordered[key] = out[key];
  }
  return ordered;
}

/**
 * @param {unknown} candidate
 * @param {{
 *   projectionLevel: string,
 *   privacyPolicy?: ReturnType<typeof createPlayerRatingPrivacyPolicy>,
 * }} options
 */
export function redactPlayerRatingCandidate(candidate, options) {
  if (!options || typeof options !== "object") {
    failSecurityPrivacy(
      PLAYER_RATING_SECURITY_PRIVACY_ERROR_CODE.INVALID_RATING_CONTRACT,
      "redactPlayerRatingCandidate requires options"
    );
  }

  const policy = options.privacyPolicy || createPlayerRatingPrivacyPolicy();
  const level = options.projectionLevel;

  if (!candidate || typeof candidate !== "object") {
    return deepFreeze(null);
  }

  const source = /** @type {Record<string, unknown>} */ (
    clonePlain(candidate)
  );

  if (level === PLAYER_RATING_PRIVACY_PROJECTION_LEVEL.INTERNAL_SYSTEM) {
    const cleaned = stripExcludedKeys(
      source,
      policy.alwaysExcludedProfileKeys
    );
    return deepFreeze(
      orderKeys(/** @type {Record<string, unknown>} */ (cleaned))
    );
  }

  /** @type {Record<string, unknown>} */
  const out = {};

  if (level === PLAYER_RATING_PRIVACY_PROJECTION_LEVEL.PUBLIC) {
    out.candidateId = source.candidateId ?? null;
    out.playerId = policy.exposePublicPlayerId ? (source.playerId ?? null) : null;
    out.playerIdResolutionStatus = source.playerIdResolutionStatus ?? null;
    out.sourceType = source.sourceType ?? null;
    out.sourceScale = source.sourceScale ?? null;
    out.ratingMode = source.ratingMode ?? null;
    out.status = source.status ?? null;
    out.effectiveAt = source.effectiveAt ?? null;
    out.authoritativeForPublicPlayerRating =
      source.authoritativeForPublicPlayerRating === true;
    out.warnings = filterPublicWarnings(
      source.warnings,
      policy.publicWarningAllowlist
    );
    // Never substitute another rating field when displayRating is absent.
    if ("displayRating" in source) {
      out.displayRating = source.displayRating;
    }
    if (policy.exposePublicVerifiedRating && "verifiedRating" in source) {
      out.verifiedRating = source.verifiedRating;
    }
  } else if (level === PLAYER_RATING_PRIVACY_PROJECTION_LEVEL.PLAYER_SELF) {
    out.candidateId = source.candidateId ?? null;
    out.playerId = source.playerId ?? null;
    out.playerIdResolutionStatus = source.playerIdResolutionStatus ?? null;
    out.sourceType = source.sourceType ?? null;
    out.sourceScale = source.sourceScale ?? null;
    out.ratingMode = source.ratingMode ?? null;
    out.status = source.status ?? null;
    out.effectiveAt = source.effectiveAt ?? null;
    out.authoritativeForPublicPlayerRating =
      source.authoritativeForPublicPlayerRating === true;
    out.warnings = filterPublicWarnings(
      source.warnings,
      policy.publicWarningAllowlist
    );
    if ("displayRating" in source) out.displayRating = source.displayRating;
    if ("selfAssessedRating" in source) {
      out.selfAssessedRating = source.selfAssessedRating;
    }
    if ("provisionalRating" in source) {
      out.provisionalRating = source.provisionalRating;
    }
    if ("verifiedRating" in source) out.verifiedRating = source.verifiedRating;
    if (policy.exposeSelfConfidenceSummary) {
      if ("confidence" in source) out.confidence = source.confidence;
      if ("confidenceScale" in source) {
        out.confidenceScale = source.confidenceScale;
      }
    }
    if (policy.exposeSelfReliabilityInternals && "reliability" in source) {
      out.reliability = source.reliability;
    }
    if (policy.exposeSelfDeviationInternals && "deviation" in source) {
      out.deviation = source.deviation;
    }
  } else if (
    level === PLAYER_RATING_PRIVACY_PROJECTION_LEVEL.AUTHORIZED_REVIEWER
  ) {
    out.candidateId = source.candidateId ?? null;
    out.playerId = source.playerId ?? null;
    out.playerIdResolutionStatus = source.playerIdResolutionStatus ?? null;
    out.sourceType = source.sourceType ?? null;
    out.sourceRecordId = source.sourceRecordId ?? null;
    out.sourceScale = source.sourceScale ?? null;
    out.ratingMode = source.ratingMode ?? null;
    out.status = source.status ?? null;
    out.effectiveAt = source.effectiveAt ?? null;
    out.algorithmVersion = source.algorithmVersion ?? null;
    out.tenantId = source.tenantId ?? null;
    out.scope = source.scope ?? null;
    out.aliases = Array.isArray(source.aliases)
      ? clonePlain(source.aliases)
      : [];
    out.warnings = Array.isArray(source.warnings)
      ? [...source.warnings].map((w) => String(w)).sort()
      : [];
    out.authoritativeForPublicPlayerRating =
      source.authoritativeForPublicPlayerRating === true;
    if ("displayRating" in source) out.displayRating = source.displayRating;
    if ("selfAssessedRating" in source) {
      out.selfAssessedRating = source.selfAssessedRating;
    }
    if ("provisionalRating" in source) {
      out.provisionalRating = source.provisionalRating;
    }
    if ("verifiedRating" in source) out.verifiedRating = source.verifiedRating;
    if ("calculatedRating" in source) {
      out.calculatedRating = source.calculatedRating;
    }
    if ("confidence" in source) out.confidence = source.confidence;
    if ("confidenceScale" in source) {
      out.confidenceScale = source.confidenceScale;
    }

    const meta =
      source.rawSourceMetadata && typeof source.rawSourceMetadata === "object"
        ? /** @type {Record<string, unknown>} */ (source.rawSourceMetadata)
        : null;
    if (meta) {
      /** @type {Record<string, unknown>} */
      const reviewMetrics = {};
      for (const key of [
        "evidenceLevel",
        "openRatingDeviation",
        "verifiedRatingDeviation",
        "assessmentCount",
        "openMatchCount",
        "verifiedMatchCount",
      ]) {
        if (key in meta) reviewMetrics[key] = meta[key];
      }
      out.reviewMetrics = orderKeys(reviewMetrics);
    }
  } else {
    failSecurityPrivacy(
      PLAYER_RATING_SECURITY_PRIVACY_ERROR_CODE.RATING_PROJECTION_LEVEL_UNSUPPORTED,
      "Unsupported projection level for candidate redaction",
      { projectionLevel: String(level) }
    );
  }

  return deepFreeze(orderKeys(out));
}
