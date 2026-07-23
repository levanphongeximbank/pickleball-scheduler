/**
 * History / audit entry builders for Phase 1E workflows.
 */

import { createRatingHistoryEntryContract } from "../contracts/historyContract.js";
import {
  clonePlain,
  deepFreeze,
  requireNonEmptyString,
  requireValidTimestamp,
} from "../contracts/shared.js";
import { requireSupportedRatingMode } from "../contracts/ratingModes.js";
import { requireExplicitPlayerRatingScope } from "../contracts/scopeContract.js";
import { RATING_HISTORY_EVENT_TYPE } from "./constants.js";
import { buildStoredAdjustmentAuditEntry } from "./createInMemoryRatingAdjustmentAuditAdapter.js";

/**
 * @param {unknown} input
 * @returns {Readonly<Record<string, unknown>>}
 */
export function buildVerificationHistoryEntry(input) {
  if (!input || typeof input !== "object") {
    requireNonEmptyString(null, "verificationHistoryEntry");
  }
  const raw = /** @type {Record<string, unknown>} */ (input);
  const occurredAt = requireValidTimestamp(raw.occurredAt, "occurredAt");
  const entry = createRatingHistoryEntryContract({
    eventId: requireNonEmptyString(raw.eventId ?? raw.operationId, "eventId"),
    playerId: requireNonEmptyString(raw.playerId, "playerId"),
    scope: requireExplicitPlayerRatingScope(raw.scope ?? raw.tenantId),
    eventType: RATING_HISTORY_EVENT_TYPE.VERIFIED,
    beforeState: raw.beforeState,
    afterState: raw.afterState,
    effectiveAt: occurredAt,
    recordedAt: occurredAt,
    actorId: requireNonEmptyString(raw.actorId, "actorId"),
    reason: requireNonEmptyString(raw.reason, "reason"),
    correlationId: requireNonEmptyString(raw.correlationId, "correlationId"),
  });

  return deepFreeze({
    ...clonePlain(entry),
    ratingMode: requireSupportedRatingMode(raw.ratingMode),
    operationId: requireNonEmptyString(raw.operationId, "operationId"),
  });
}

/**
 * @param {unknown} input
 * @returns {Readonly<Record<string, unknown>>}
 */
export function buildAdjustmentHistoryEntry(input) {
  if (!input || typeof input !== "object") {
    requireNonEmptyString(null, "adjustmentHistoryEntry");
  }
  const raw = /** @type {Record<string, unknown>} */ (input);
  const occurredAt = requireValidTimestamp(raw.occurredAt, "occurredAt");
  const entry = createRatingHistoryEntryContract({
    eventId: requireNonEmptyString(raw.eventId ?? raw.operationId, "eventId"),
    playerId: requireNonEmptyString(raw.playerId, "playerId"),
    scope: requireExplicitPlayerRatingScope(raw.scope ?? raw.tenantId),
    eventType: RATING_HISTORY_EVENT_TYPE.ADJUSTED,
    beforeState: raw.beforeState,
    afterState: raw.afterState,
    effectiveAt: occurredAt,
    recordedAt: occurredAt,
    actorId: requireNonEmptyString(raw.actorId, "actorId"),
    reason: requireNonEmptyString(raw.reason, "reason"),
    correlationId: requireNonEmptyString(raw.correlationId, "correlationId"),
  });

  return deepFreeze({
    ...clonePlain(entry),
    ratingMode: requireSupportedRatingMode(raw.ratingMode),
    operationId: requireNonEmptyString(raw.operationId, "operationId"),
    targetField: requireNonEmptyString(raw.targetField, "targetField"),
  });
}

/**
 * @param {unknown} input
 * @returns {Readonly<Record<string, unknown>>}
 */
export function buildAdjustmentAuditEntry(input) {
  return buildStoredAdjustmentAuditEntry(input);
}
