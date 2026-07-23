/**
 * Rating reversal identity — separate from application identity (Phase 1B).
 * Transaction rollback is not reversal.
 */

import { PLAYER_RATING_FOUNDATION_ERROR_CODE } from "../errors/errorCodes.js";
import { createRatingApplicationIdentityContract } from "./idempotencyContract.js";
import {
  deepFreeze,
  failContract,
  requireNonEmptyString,
} from "./shared.js";

/**
 * @typedef {Object} RatingReversalIdentityContract
 * @property {string} reversalId
 * @property {import('./idempotencyContract.js').RatingApplicationIdentityContract} originalApplicationIdentity
 * @property {string} [reason]
 * @property {string} [correlationId]
 */

/**
 * @param {unknown} input
 * @returns {Readonly<RatingReversalIdentityContract>}
 */
export function createRatingReversalIdentityContract(input) {
  if (!input || typeof input !== "object") {
    failContract(
      PLAYER_RATING_FOUNDATION_ERROR_CODE.INVALID_RATING_CONTRACT,
      "Reversal identity requires reversalId and originalApplicationIdentity",
      { fields: ["reversalId", "originalApplicationIdentity"] }
    );
  }

  const raw = /** @type {Record<string, unknown>} */ (input);
  const reversalId = requireNonEmptyString(raw.reversalId, "reversalId");

  if (!raw.originalApplicationIdentity) {
    failContract(
      PLAYER_RATING_FOUNDATION_ERROR_CODE.RATING_APPLICATION_NOT_FOUND_FOR_REVERSAL,
      "Reversal must reference an original application identity",
      { field: "originalApplicationIdentity" }
    );
  }

  const originalApplicationIdentity = createRatingApplicationIdentityContract(
    raw.originalApplicationIdentity
  );

  /** @type {RatingReversalIdentityContract} */
  const contract = {
    reversalId,
    originalApplicationIdentity,
  };

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
 * @param {RatingReversalIdentityContract} identity
 * @returns {string}
 */
export function buildRatingReversalIdentityKey(identity) {
  const complete = createRatingReversalIdentityContract(identity);
  return `${complete.reversalId}|${[
    complete.originalApplicationIdentity.tenantId,
    complete.originalApplicationIdentity.matchId,
    complete.originalApplicationIdentity.resultRevision,
    complete.originalApplicationIdentity.playerId,
    complete.originalApplicationIdentity.ratingType,
    complete.originalApplicationIdentity.algorithmVersion,
  ].join("|")}`;
}
