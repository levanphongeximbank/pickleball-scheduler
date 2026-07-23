/**
 * Rating application idempotency identity (Phase 1B).
 * No durable idempotency store in this phase.
 */

import { PLAYER_RATING_FOUNDATION_ERROR_CODE } from "../errors/errorCodes.js";
import {
  deepFreeze,
  failContract,
  requireNonEmptyString,
} from "./shared.js";

/**
 * @typedef {Object} RatingApplicationIdentityContract
 * @property {string} tenantId
 * @property {string} matchId
 * @property {string} resultRevision
 * @property {string} playerId
 * @property {string} ratingType
 * @property {string} algorithmVersion
 */

export const RATING_APPLICATION_IDENTITY_FIELDS = Object.freeze([
  "tenantId",
  "matchId",
  "resultRevision",
  "playerId",
  "ratingType",
  "algorithmVersion",
]);

/**
 * @param {unknown} input
 * @returns {Readonly<RatingApplicationIdentityContract>}
 */
export function createRatingApplicationIdentityContract(input) {
  if (!input || typeof input !== "object") {
    failContract(
      PLAYER_RATING_FOUNDATION_ERROR_CODE.INVALID_RATING_CONTRACT,
      "Idempotency identity requires a complete object",
      { fields: [...RATING_APPLICATION_IDENTITY_FIELDS] }
    );
  }

  const raw = /** @type {Record<string, unknown>} */ (input);
  /** @type {RatingApplicationIdentityContract} */
  const contract = {
    tenantId: requireNonEmptyString(raw.tenantId, "tenantId"),
    matchId: requireNonEmptyString(raw.matchId, "matchId"),
    resultRevision: requireNonEmptyString(raw.resultRevision, "resultRevision"),
    playerId: requireNonEmptyString(raw.playerId, "playerId"),
    ratingType: requireNonEmptyString(raw.ratingType, "ratingType"),
    algorithmVersion: requireNonEmptyString(
      raw.algorithmVersion,
      "algorithmVersion"
    ),
  };

  return deepFreeze(contract);
}

/**
 * Stable string key for comparison / future ledger use (not a store).
 * @param {RatingApplicationIdentityContract} identity
 * @returns {string}
 */
export function buildRatingApplicationIdentityKey(identity) {
  const complete = createRatingApplicationIdentityContract(identity);
  return [
    complete.tenantId,
    complete.matchId,
    complete.resultRevision,
    complete.playerId,
    complete.ratingType,
    complete.algorithmVersion,
  ].join("|");
}
