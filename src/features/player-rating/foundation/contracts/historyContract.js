/**
 * Rating history entry contract — append-only at the contract level (Phase 1B).
 */

import { PLAYER_RATING_FOUNDATION_ERROR_CODE } from "../errors/errorCodes.js";
import { requireExplicitPlayerRatingScope } from "./scopeContract.js";
import {
  deepFreeze,
  failContract,
  requireNonEmptyString,
  requireValidTimestamp,
} from "./shared.js";

/**
 * @typedef {Object} RatingHistoryEntryContract
 * @property {string} eventId
 * @property {string} playerId
 * @property {import('./scopeContract.js').PlayerRatingScope} scope
 * @property {string} eventType
 * @property {unknown} [beforeState]
 * @property {unknown} afterState
 * @property {string|number} effectiveAt
 * @property {string|number} recordedAt
 * @property {string} [actorId]
 * @property {string} [reason]
 * @property {string} [correlationId]
 */

/**
 * @param {unknown} input
 * @returns {Readonly<RatingHistoryEntryContract>}
 */
export function createRatingHistoryEntryContract(input) {
  if (!input || typeof input !== "object") {
    requireNonEmptyString(null, "historyEntry");
  }

  const raw = /** @type {Record<string, unknown>} */ (input);
  const eventId = requireNonEmptyString(raw.eventId, "eventId");
  const playerId = requireNonEmptyString(raw.playerId, "playerId");
  const scope = requireExplicitPlayerRatingScope(raw.scope ?? raw.tenantId);
  const eventType = requireNonEmptyString(raw.eventType, "eventType");
  const effectiveAt = requireValidTimestamp(raw.effectiveAt, "effectiveAt");
  const recordedAt = requireValidTimestamp(raw.recordedAt, "recordedAt");

  if (!("afterState" in raw)) {
    failContract(
      PLAYER_RATING_FOUNDATION_ERROR_CODE.INVALID_RATING_CONTRACT,
      "History entry requires afterState",
      { field: "afterState" }
    );
  }

  /** @type {RatingHistoryEntryContract} */
  const contract = {
    eventId,
    playerId,
    scope,
    eventType,
    afterState: raw.afterState,
    effectiveAt,
    recordedAt,
  };

  if ("beforeState" in raw) contract.beforeState = raw.beforeState;
  if (raw.actorId != null) {
    contract.actorId = requireNonEmptyString(raw.actorId, "actorId");
  }
  if (raw.reason != null) {
    contract.reason = requireNonEmptyString(raw.reason, "reason");
  }
  if (raw.correlationId != null) {
    contract.correlationId = requireNonEmptyString(
      raw.correlationId,
      "correlationId"
    );
  }

  return deepFreeze(contract);
}

/**
 * Append-only guard: history contracts must not be rewritten in place.
 * @param {Readonly<RatingHistoryEntryContract>} entry
 * @param {string} field
 * @returns {never}
 */
export function assertHistoryAppendOnly(entry, field) {
  failContract(
    PLAYER_RATING_FOUNDATION_ERROR_CODE.HISTORY_MUTATION_FORBIDDEN,
    "Rating history is append-only; in-place mutation is forbidden",
    {
      eventId: entry?.eventId,
      field,
    }
  );
}
