/**
 * Append-only rating history service (Phase 1D).
 * Caller-supplied IDs/timestamps only. No current-rating mutation.
 */

import { createRatingHistoryEntryContract } from "../contracts/historyContract.js";
import { assertHistoryAppendOnly } from "../contracts/historyContract.js";
import { requireSupportedRatingMode } from "../contracts/ratingModes.js";
import {
  clonePlain,
  deepFreeze,
  failContract,
  isNonEmptyString,
  requireNonEmptyString,
} from "../contracts/shared.js";
import { PLAYER_RATING_FOUNDATION_ERROR_CODE } from "../errors/errorCodes.js";
import {
  compareHistoryEntriesAscending,
  sortDeterministically,
} from "./ordering.js";
import { requireQueryScope, scopesMatch } from "./scopeMatch.js";

/**
 * @typedef {Readonly<{
 *   eventId: string,
 *   playerId: string,
 *   scope: import('../contracts/scopeContract.js').PlayerRatingScope,
 *   eventType: string,
 *   beforeState?: unknown,
 *   afterState: unknown,
 *   effectiveAt: string|number,
 *   recordedAt: string|number,
 *   actorId?: string,
 *   reason?: string,
 *   correlationId?: string,
 *   ratingMode?: 'overall'|'singles'|'doubles',
 * }>} StoredRatingHistoryEntry
 */

/**
 * @param {unknown} input
 * @returns {StoredRatingHistoryEntry}
 */
export function buildStoredHistoryEntry(input) {
  if (!input || typeof input !== "object") {
    requireNonEmptyString(null, "historyEntry");
  }

  const raw = /** @type {Record<string, unknown>} */ (input);

  if (!isNonEmptyString(raw.playerId)) {
    failContract(
      PLAYER_RATING_FOUNDATION_ERROR_CODE.CANONICAL_PLAYER_ID_UNRESOLVED,
      "History append requires a non-empty canonical playerId",
      { playerId: raw.playerId }
    );
  }

  if (
    raw.playerIdResolutionStatus != null &&
    String(raw.playerIdResolutionStatus).trim() !== "" &&
    String(raw.playerIdResolutionStatus).trim() !== "RESOLVED"
  ) {
    failContract(
      PLAYER_RATING_FOUNDATION_ERROR_CODE.CANONICAL_PLAYER_ID_UNRESOLVED,
      "History append rejects unresolved or alias player identity",
      { playerIdResolutionStatus: raw.playerIdResolutionStatus }
    );
  }

  const contract = createRatingHistoryEntryContract(raw);

  /** @type {Record<string, unknown>} */
  const stored = {
    eventId: contract.eventId,
    playerId: contract.playerId,
    scope: clonePlain(contract.scope),
    eventType: contract.eventType,
    afterState: clonePlain(contract.afterState),
    effectiveAt: contract.effectiveAt,
    recordedAt: contract.recordedAt,
  };

  if ("beforeState" in contract) {
    stored.beforeState = clonePlain(contract.beforeState);
  }
  if (contract.actorId != null) stored.actorId = contract.actorId;
  if (contract.reason != null) stored.reason = contract.reason;
  if (contract.correlationId != null) {
    stored.correlationId = contract.correlationId;
  }

  if (raw.ratingMode != null) {
    stored.ratingMode = requireSupportedRatingMode(raw.ratingMode);
  }

  return /** @type {StoredRatingHistoryEntry} */ (deepFreeze(stored));
}

/**
 * Append a validated history entry into an in-memory store map.
 *
 * @param {{ byEventId: Map<string, StoredRatingHistoryEntry> }} store
 * @param {unknown} input
 * @returns {StoredRatingHistoryEntry}
 */
export function appendRatingHistory(store, input) {
  const entry = buildStoredHistoryEntry(input);
  if (store.byEventId.has(entry.eventId)) {
    failContract(
      PLAYER_RATING_FOUNDATION_ERROR_CODE.HISTORY_ENTRY_DUPLICATE,
      `Duplicate history eventId: ${entry.eventId}`,
      { eventId: entry.eventId }
    );
  }
  store.byEventId.set(entry.eventId, entry);
  return entry;
}

/**
 * @param {{ byEventId: Map<string, StoredRatingHistoryEntry> }} store
 * @param {unknown} eventId
 * @returns {StoredRatingHistoryEntry}
 */
export function getRatingHistoryByEventId(store, eventId) {
  const id = requireNonEmptyString(eventId, "eventId");
  const entry = store.byEventId.get(id);
  if (!entry) {
    failContract(
      PLAYER_RATING_FOUNDATION_ERROR_CODE.HISTORY_ENTRY_NOT_FOUND,
      `History entry not found: ${id}`,
      { eventId: id }
    );
  }
  return entry;
}

/**
 * @param {{ byEventId: Map<string, StoredRatingHistoryEntry> }} store
 * @param {unknown} playerId
 * @param {unknown} scope
 * @param {{ ratingMode?: string }} [options]
 * @returns {StoredRatingHistoryEntry[]}
 */
export function listRatingHistory(store, playerId, scope, options = {}) {
  const canonicalPlayerId = requireNonEmptyString(playerId, "playerId");
  const queryScope = requireQueryScope(scope);
  const modeFilter =
    options && options.ratingMode != null
      ? requireSupportedRatingMode(options.ratingMode)
      : null;

  /** @type {StoredRatingHistoryEntry[]} */
  const matched = [];
  for (const entry of store.byEventId.values()) {
    if (entry.playerId !== canonicalPlayerId) continue;
    if (!scopesMatch(entry.scope, queryScope)) continue;
    if (modeFilter != null) {
      const entryMode =
        entry.ratingMode != null
          ? entry.ratingMode
          : entry.afterState &&
              typeof entry.afterState === "object" &&
              /** @type {{ ratingMode?: unknown }} */ (entry.afterState)
                .ratingMode != null
            ? String(
                /** @type {{ ratingMode: unknown }} */ (entry.afterState)
                  .ratingMode
              )
            : null;
      if (entryMode !== modeFilter) continue;
    }
    matched.push(entry);
  }

  return sortDeterministically(matched, compareHistoryEntriesAscending);
}

/**
 * @param {string} field
 * @returns {never}
 */
export function rejectHistoryMutation(field = "unknown") {
  assertHistoryAppendOnly(
    /** @type {any} */ ({ eventId: null }),
    field
  );
}
