/**
 * Allowlist-based overview redaction / projection (Phase 1I).
 */

import { clonePlain, deepFreeze, isNonEmptyString } from "../contracts/shared.js";
import { createPlayerRatingPrivacyPolicy } from "./createPlayerRatingPrivacyPolicy.js";
import { PLAYER_RATING_PRIVACY_PROJECTION_LEVEL } from "./privacyProjectionLevels.js";
import {
  redactPlayerRatingCandidate,
  stripExcludedKeys,
} from "./redactPlayerRatingCandidate.js";
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
 * @param {unknown} entry
 * @param {string} level
 * @param {ReturnType<typeof createPlayerRatingPrivacyPolicy>} policy
 */
function redactHistoryEntry(entry, level, policy) {
  if (!entry || typeof entry !== "object") return null;
  const raw = /** @type {Record<string, unknown>} */ (clonePlain(entry));

  if (level === PLAYER_RATING_PRIVACY_PROJECTION_LEVEL.INTERNAL_SYSTEM) {
    return stripExcludedKeys(raw, policy.alwaysExcludedProfileKeys);
  }

  if (level === PLAYER_RATING_PRIVACY_PROJECTION_LEVEL.PUBLIC) {
    // Public consumers do not receive history ledger rows.
    return null;
  }

  if (level === PLAYER_RATING_PRIVACY_PROJECTION_LEVEL.PLAYER_SELF) {
    /** @type {Record<string, unknown>} */
    const out = {
      eventId: raw.eventId ?? null,
      eventType: raw.eventType ?? null,
      effectiveAt: raw.effectiveAt ?? null,
      recordedAt: raw.recordedAt ?? null,
      ratingMode: raw.ratingMode ?? null,
    };
    if (raw.afterState && typeof raw.afterState === "object") {
      const after = /** @type {Record<string, unknown>} */ (raw.afterState);
      out.afterStateSummary = {
        status: after.status ?? null,
        ratingMode: after.ratingMode ?? null,
        value: after.value ?? null,
      };
    }
    return out;
  }

  // AUTHORIZED_REVIEWER — limited actor/audit, no full secret-bearing blobs.
  /** @type {Record<string, unknown>} */
  const out = {
    eventId: raw.eventId ?? null,
    playerId: raw.playerId ?? null,
    eventType: raw.eventType ?? null,
    effectiveAt: raw.effectiveAt ?? null,
    recordedAt: raw.recordedAt ?? null,
    ratingMode: raw.ratingMode ?? null,
    scope: raw.scope ?? null,
  };
  if ("actorId" in raw) out.actorId = raw.actorId;
  if ("reason" in raw) out.reason = raw.reason;
  if ("beforeState" in raw) {
    out.beforeState = stripExcludedKeys(
      raw.beforeState,
      policy.alwaysExcludedProfileKeys
    );
  }
  if ("afterState" in raw) {
    out.afterState = stripExcludedKeys(
      raw.afterState,
      policy.alwaysExcludedProfileKeys
    );
  }
  // correlationId / operationId remain server-only.
  return out;
}

/**
 * @param {unknown} snapshot
 * @param {string} level
 * @param {ReturnType<typeof createPlayerRatingPrivacyPolicy>} policy
 */
function redactSnapshot(snapshot, level, policy) {
  if (!snapshot || typeof snapshot !== "object") return null;
  const raw = /** @type {Record<string, unknown>} */ (clonePlain(snapshot));

  if (level === PLAYER_RATING_PRIVACY_PROJECTION_LEVEL.INTERNAL_SYSTEM) {
    return stripExcludedKeys(raw, policy.alwaysExcludedProfileKeys);
  }

  if (level === PLAYER_RATING_PRIVACY_PROJECTION_LEVEL.PUBLIC) {
    return null;
  }

  /** @type {Record<string, unknown>} */
  const out = {
    snapshotId: raw.snapshotId ?? null,
    playerId: raw.playerId ?? null,
    ratingMode: raw.ratingMode ?? null,
    ratingValue: raw.ratingValue ?? null,
    sourceScale: raw.sourceScale ?? null,
    effectiveAt: raw.effectiveAt ?? null,
    createdAt: raw.createdAt ?? null,
  };
  if (level === PLAYER_RATING_PRIVACY_PROJECTION_LEVEL.AUTHORIZED_REVIEWER) {
    out.scope = raw.scope ?? null;
    out.sourceStateVersion = raw.sourceStateVersion ?? null;
  }
  return out;
}

/**
 * Redact rejected records so private nested fields cannot leak.
 * @param {unknown} record
 * @param {string} level
 */
function redactRejectedRecord(record, level) {
  if (!record || typeof record !== "object") return null;
  const raw = /** @type {Record<string, unknown>} */ (clonePlain(record));

  if (level === PLAYER_RATING_PRIVACY_PROJECTION_LEVEL.INTERNAL_SYSTEM) {
    return raw;
  }

  /** @type {Record<string, unknown>} */
  const out = {
    reason: isNonEmptyString(raw.reason) ? String(raw.reason) : "REJECTED",
    sourceType: raw.sourceType ?? null,
  };
  if (isNonEmptyString(raw.code)) out.code = String(raw.code);
  if (isNonEmptyString(raw.errorCode)) out.errorCode = String(raw.errorCode);
  return out;
}

/**
 * @param {unknown} conflict
 */
function redactConflict(conflict) {
  if (!conflict || typeof conflict !== "object") return null;
  const raw = /** @type {Record<string, unknown>} */ (clonePlain(conflict));
  /** @type {Record<string, unknown>} */
  const out = {};
  if ("type" in raw) out.type = raw.type;
  if (Array.isArray(raw.playerIds)) {
    out.playerIds = [...raw.playerIds].map(String).sort();
  }
  if (Array.isArray(raw.candidateIds)) {
    out.candidateIds = [...raw.candidateIds].map(String).sort();
  }
  if (Array.isArray(raw.scales)) {
    out.scales = [...raw.scales].map(String).sort();
  }
  if (Array.isArray(raw.modes)) {
    out.modes = [...raw.modes].map(String).sort();
  }
  return out;
}

/**
 * @param {unknown} overview
 * @param {{
 *   projectionLevel: string,
 *   privacyPolicy?: ReturnType<typeof createPlayerRatingPrivacyPolicy>,
 * }} options
 */
export function redactPlayerRatingOverview(overview, options) {
  if (!options || typeof options !== "object") {
    failSecurityPrivacy(
      PLAYER_RATING_SECURITY_PRIVACY_ERROR_CODE.INVALID_RATING_CONTRACT,
      "redactPlayerRatingOverview requires options"
    );
  }

  const policy = options.privacyPolicy || createPlayerRatingPrivacyPolicy();
  const level = options.projectionLevel;

  if (!overview || typeof overview !== "object") {
    failSecurityPrivacy(
      PLAYER_RATING_SECURITY_PRIVACY_ERROR_CODE.INVALID_RATING_CONTRACT,
      "Overview projection requires an overview object"
    );
  }

  const source = /** @type {Record<string, unknown>} */ (clonePlain(overview));

  if (level === PLAYER_RATING_PRIVACY_PROJECTION_LEVEL.INTERNAL_SYSTEM) {
    const cleaned = /** @type {Record<string, unknown>} */ (
      stripExcludedKeys(source, policy.alwaysExcludedProfileKeys)
    );
    if (Array.isArray(cleaned.candidates)) {
      cleaned.candidates = cleaned.candidates.map((c) =>
        redactPlayerRatingCandidate(c, { projectionLevel: level, privacyPolicy: policy })
      );
    }
    return deepFreeze(cleaned);
  }

  const candidates = Array.isArray(source.candidates)
    ? source.candidates.map((c) =>
        redactPlayerRatingCandidate(c, {
          projectionLevel: level,
          privacyPolicy: policy,
        })
      )
    : [];

  /** @type {Record<string, unknown>} */
  const out = {
    projectionLevel: level,
    ratingMode: source.ratingMode ?? null,
    availabilityStatus: source.availabilityStatus ?? null,
    candidateCount: candidates.length,
    candidates,
    warnings: filterPublicWarnings(source.warnings, policy.publicWarningAllowlist),
    identityConflicts: Array.isArray(source.identityConflicts)
      ? source.identityConflicts.map(redactConflict).filter(Boolean)
      : [],
    scaleConflicts: Array.isArray(source.scaleConflicts)
      ? source.scaleConflicts.map(redactConflict).filter(Boolean)
      : [],
    modeConflicts: Array.isArray(source.modeConflicts)
      ? source.modeConflicts.map(redactConflict).filter(Boolean)
      : [],
    rejectedRecords: Array.isArray(source.rejectedRecords)
      ? source.rejectedRecords
          .map((r) => redactRejectedRecord(r, level))
          .filter(Boolean)
      : [],
    sourceSummary:
      source.sourceSummary && typeof source.sourceSummary === "object"
        ? clonePlain(source.sourceSummary)
        : {},
  };

  if (
    level === PLAYER_RATING_PRIVACY_PROJECTION_LEVEL.PUBLIC &&
    !policy.exposePublicPlayerId
  ) {
    out.playerId = null;
  } else {
    out.playerId = source.playerId ?? null;
  }

  out.playerIdResolutionStatus = source.playerIdResolutionStatus ?? null;

  if (level !== PLAYER_RATING_PRIVACY_PROJECTION_LEVEL.PUBLIC) {
    // Scope is internal tenant metadata for public; allowed for self/reviewer.
    out.scope = source.scope ?? null;
  }

  if (level === PLAYER_RATING_PRIVACY_PROJECTION_LEVEL.PLAYER_SELF) {
    const history = Array.isArray(source.history)
      ? source.history
          .map((h) => redactHistoryEntry(h, level, policy))
          .filter(Boolean)
      : [];
    const snapshots = Array.isArray(source.snapshots)
      ? source.snapshots
          .map((s) => redactSnapshot(s, level, policy))
          .filter(Boolean)
      : [];
    out.historySummary = history;
    out.historyCount = history.length;
    out.snapshotSummary = snapshots;
    out.snapshotCount = snapshots.length;
  }

  if (level === PLAYER_RATING_PRIVACY_PROJECTION_LEVEL.AUTHORIZED_REVIEWER) {
    const history = Array.isArray(source.history)
      ? source.history
          .map((h) => redactHistoryEntry(h, level, policy))
          .filter(Boolean)
      : [];
    const snapshots = Array.isArray(source.snapshots)
      ? source.snapshots
          .map((s) => redactSnapshot(s, level, policy))
          .filter(Boolean)
      : [];
    out.history = history;
    out.historyCount = history.length;
    out.snapshots = snapshots;
    out.snapshotCount = snapshots.length;
  }

  return deepFreeze(out);
}
