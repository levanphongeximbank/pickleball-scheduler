/**
 * Rating snapshot contract — immutable at the contract level (Phase 1B).
 */

import { PLAYER_RATING_FOUNDATION_ERROR_CODE } from "../errors/errorCodes.js";
import { requireSupportedRatingMode } from "./ratingModes.js";
import { requireExplicitPlayerRatingScope } from "./scopeContract.js";
import {
  deepFreeze,
  failContract,
  requireNonEmptyString,
  requireValidTimestamp,
} from "./shared.js";

/**
 * @typedef {Object} RatingSnapshotContract
 * @property {string} snapshotId
 * @property {string} playerId
 * @property {import('./scopeContract.js').PlayerRatingScope} scope
 * @property {'overall'|'singles'|'doubles'} ratingMode
 * @property {unknown} [ratingValue]
 * @property {unknown} [projectedState]
 * @property {string} sourceStateVersion
 * @property {string|number} effectiveAt
 * @property {string|number} createdAt
 * @property {string} [correlationId]
 */

/**
 * @param {unknown} input
 * @returns {Readonly<RatingSnapshotContract>}
 */
export function createRatingSnapshotContract(input) {
  if (!input || typeof input !== "object") {
    requireNonEmptyString(null, "snapshot");
  }

  const raw = /** @type {Record<string, unknown>} */ (input);
  const snapshotId = requireNonEmptyString(raw.snapshotId, "snapshotId");
  const playerId = requireNonEmptyString(raw.playerId, "playerId");
  const scope = requireExplicitPlayerRatingScope(raw.scope ?? raw.tenantId);
  const ratingMode = requireSupportedRatingMode(raw.ratingMode);
  const sourceStateVersion = requireNonEmptyString(
    raw.sourceStateVersion,
    "sourceStateVersion"
  );
  const effectiveAt = requireValidTimestamp(raw.effectiveAt, "effectiveAt");
  const createdAt = requireValidTimestamp(raw.createdAt, "createdAt");

  if (!("ratingValue" in raw) && !("projectedState" in raw)) {
    failContract(
      PLAYER_RATING_FOUNDATION_ERROR_CODE.INVALID_RATING_CONTRACT,
      "Snapshot requires ratingValue or projectedState",
      { fields: ["ratingValue", "projectedState"] }
    );
  }

  /** @type {RatingSnapshotContract} */
  const contract = {
    snapshotId,
    playerId,
    scope,
    ratingMode,
    sourceStateVersion,
    effectiveAt,
    createdAt,
  };

  if ("ratingValue" in raw) contract.ratingValue = raw.ratingValue;
  if ("projectedState" in raw) contract.projectedState = raw.projectedState;
  if (raw.correlationId != null) {
    contract.correlationId = requireNonEmptyString(
      raw.correlationId,
      "correlationId"
    );
  }

  return deepFreeze(contract);
}

/**
 * Immutable guard: snapshots must not change after creation.
 * @param {Readonly<RatingSnapshotContract>} snapshot
 * @param {string} field
 * @param {unknown} _value
 * @returns {never}
 */
export function assertSnapshotImmutable(snapshot, field, _value) {
  failContract(
    PLAYER_RATING_FOUNDATION_ERROR_CODE.SNAPSHOT_MUTATION_FORBIDDEN,
    "Rating snapshot is immutable; mutation is forbidden",
    {
      snapshotId: snapshot?.snapshotId,
      field,
    }
  );
}
