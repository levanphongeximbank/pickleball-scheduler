/**
 * Verification request/result contracts — no persistence or UI (Phase 1B).
 * Verified values require server-authorized actor context.
 */

import { PLAYER_RATING_FOUNDATION_ERROR_CODE } from "../errors/errorCodes.js";
import { requireSupportedRatingMode } from "./ratingModes.js";
import { requireExplicitPlayerRatingScope } from "./scopeContract.js";
import {
  deepFreeze,
  failContract,
  isNonEmptyString,
  requireNonEmptyString,
  requireValidTimestamp,
} from "./shared.js";

/**
 * @typedef {Object} RatingVerificationActorContext
 * @property {string} actorId
 * @property {boolean} serverAuthorized
 * @property {string} [permission]
 */

/**
 * @typedef {Object} RatingVerificationRequestContract
 * @property {string} playerId
 * @property {import('./scopeContract.js').PlayerRatingScope} scope
 * @property {'overall'|'singles'|'doubles'} ratingMode
 * @property {unknown} verifiedRating
 * @property {RatingVerificationActorContext} actor
 * @property {string} [reason]
 * @property {string} [correlationId]
 * @property {string|number} [effectiveAt]
 */

/**
 * @typedef {Object} RatingVerificationResultContract
 * @property {'accepted'|'rejected'} outcome
 * @property {string} playerId
 * @property {import('./scopeContract.js').PlayerRatingScope} scope
 * @property {'overall'|'singles'|'doubles'} ratingMode
 * @property {unknown} [verifiedRating]
 * @property {string} actorId
 * @property {string|number} decidedAt
 * @property {string} [eventId]
 * @property {string} [reason]
 */

/**
 * @param {unknown} actor
 * @returns {RatingVerificationActorContext}
 */
export function requireVerificationActorContext(actor) {
  if (!actor || typeof actor !== "object") {
    failContract(
      PLAYER_RATING_FOUNDATION_ERROR_CODE.UNAUTHORIZED_VERIFICATION,
      "Verification requires server-authorized actor context",
      { actor }
    );
  }

  const raw = /** @type {Record<string, unknown>} */ (actor);
  if (!isNonEmptyString(raw.actorId) || raw.serverAuthorized !== true) {
    failContract(
      PLAYER_RATING_FOUNDATION_ERROR_CODE.UNAUTHORIZED_VERIFICATION,
      "Verification actor must include actorId and serverAuthorized=true",
      { actor }
    );
  }

  /** @type {RatingVerificationActorContext} */
  const context = {
    actorId: String(raw.actorId).trim(),
    serverAuthorized: true,
  };
  if (isNonEmptyString(raw.permission)) {
    context.permission = String(raw.permission).trim();
  }
  return Object.freeze(context);
}

/**
 * @param {unknown} input
 * @returns {Readonly<RatingVerificationRequestContract>}
 */
export function createRatingVerificationRequestContract(input) {
  if (!input || typeof input !== "object") {
    requireNonEmptyString(null, "verificationRequest");
  }

  const raw = /** @type {Record<string, unknown>} */ (input);
  const playerId = requireNonEmptyString(raw.playerId, "playerId");
  const scope = requireExplicitPlayerRatingScope(raw.scope ?? raw.tenantId);
  const ratingMode = requireSupportedRatingMode(raw.ratingMode);
  const actor = requireVerificationActorContext(raw.actor);

  if (!("verifiedRating" in raw)) {
    failContract(
      PLAYER_RATING_FOUNDATION_ERROR_CODE.INVALID_RATING_CONTRACT,
      "Verification request requires verifiedRating",
      { field: "verifiedRating" }
    );
  }

  /** @type {RatingVerificationRequestContract} */
  const contract = {
    playerId,
    scope,
    ratingMode,
    verifiedRating: raw.verifiedRating,
    actor,
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
  if (raw.effectiveAt != null) {
    contract.effectiveAt = requireValidTimestamp(raw.effectiveAt, "effectiveAt");
  }

  return deepFreeze(contract);
}

/**
 * @param {unknown} input
 * @returns {Readonly<RatingVerificationResultContract>}
 */
export function createRatingVerificationResultContract(input) {
  if (!input || typeof input !== "object") {
    requireNonEmptyString(null, "verificationResult");
  }

  const raw = /** @type {Record<string, unknown>} */ (input);
  const outcome = requireNonEmptyString(raw.outcome, "outcome");
  if (outcome !== "accepted" && outcome !== "rejected") {
    failContract(
      PLAYER_RATING_FOUNDATION_ERROR_CODE.INVALID_RATING_CONTRACT,
      "Verification result outcome must be accepted or rejected",
      { outcome }
    );
  }

  /** @type {RatingVerificationResultContract} */
  const contract = {
    outcome: /** @type {'accepted'|'rejected'} */ (outcome),
    playerId: requireNonEmptyString(raw.playerId, "playerId"),
    scope: requireExplicitPlayerRatingScope(raw.scope ?? raw.tenantId),
    ratingMode: requireSupportedRatingMode(raw.ratingMode),
    actorId: requireNonEmptyString(raw.actorId, "actorId"),
    decidedAt: requireValidTimestamp(raw.decidedAt, "decidedAt"),
  };

  if ("verifiedRating" in raw) contract.verifiedRating = raw.verifiedRating;
  if (raw.eventId != null) {
    contract.eventId = requireNonEmptyString(raw.eventId, "eventId");
  }
  if (raw.reason != null) {
    contract.reason = requireNonEmptyString(raw.reason, "reason");
  }

  return deepFreeze(contract);
}
