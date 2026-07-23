/**
 * Manual adjustment request/result + audit contracts (Phase 1B).
 * Adjusted values require server-authorized actor context.
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
 * @typedef {Object} RatingAdjustmentActorContext
 * @property {string} actorId
 * @property {boolean} serverAuthorized
 * @property {string} [permission]
 */

/**
 * @typedef {Object} RatingAdjustmentRequestContract
 * @property {string} playerId
 * @property {import('./scopeContract.js').PlayerRatingScope} scope
 * @property {'overall'|'singles'|'doubles'} ratingMode
 * @property {unknown} adjustedRating
 * @property {string} reason
 * @property {RatingAdjustmentActorContext} actor
 * @property {string} [correlationId]
 * @property {string|number} [effectiveAt]
 */

/**
 * @typedef {Object} RatingAdjustmentAuditContract
 * @property {string} auditId
 * @property {string} playerId
 * @property {import('./scopeContract.js').PlayerRatingScope} scope
 * @property {'overall'|'singles'|'doubles'} ratingMode
 * @property {string} actorId
 * @property {string} reason
 * @property {unknown} beforeState
 * @property {unknown} afterState
 * @property {string|number} adjustedAt
 * @property {string} [correlationId]
 */

/**
 * @param {unknown} actor
 * @returns {RatingAdjustmentActorContext}
 */
export function requireAdjustmentActorContext(actor) {
  if (!actor || typeof actor !== "object") {
    failContract(
      PLAYER_RATING_FOUNDATION_ERROR_CODE.UNAUTHORIZED_MANUAL_ADJUSTMENT,
      "Manual adjustment requires server-authorized actor context",
      { actor }
    );
  }

  const raw = /** @type {Record<string, unknown>} */ (actor);
  if (!isNonEmptyString(raw.actorId) || raw.serverAuthorized !== true) {
    failContract(
      PLAYER_RATING_FOUNDATION_ERROR_CODE.UNAUTHORIZED_MANUAL_ADJUSTMENT,
      "Adjustment actor must include actorId and serverAuthorized=true",
      { actor }
    );
  }

  /** @type {RatingAdjustmentActorContext} */
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
 * @returns {Readonly<RatingAdjustmentRequestContract>}
 */
export function createRatingAdjustmentRequestContract(input) {
  if (!input || typeof input !== "object") {
    requireNonEmptyString(null, "adjustmentRequest");
  }

  const raw = /** @type {Record<string, unknown>} */ (input);
  const playerId = requireNonEmptyString(raw.playerId, "playerId");
  const scope = requireExplicitPlayerRatingScope(raw.scope ?? raw.tenantId);
  const ratingMode = requireSupportedRatingMode(raw.ratingMode);
  const reason = requireNonEmptyString(raw.reason, "reason");
  const actor = requireAdjustmentActorContext(raw.actor);

  if (!("adjustedRating" in raw)) {
    failContract(
      PLAYER_RATING_FOUNDATION_ERROR_CODE.INVALID_RATING_CONTRACT,
      "Adjustment request requires adjustedRating",
      { field: "adjustedRating" }
    );
  }

  /** @type {RatingAdjustmentRequestContract} */
  const contract = {
    playerId,
    scope,
    ratingMode,
    adjustedRating: raw.adjustedRating,
    reason,
    actor,
  };

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
 * @returns {Readonly<RatingAdjustmentAuditContract>}
 */
export function createRatingAdjustmentAuditContract(input) {
  if (!input || typeof input !== "object") {
    requireNonEmptyString(null, "adjustmentAudit");
  }

  const raw = /** @type {Record<string, unknown>} */ (input);

  if (!("beforeState" in raw) || !("afterState" in raw)) {
    failContract(
      PLAYER_RATING_FOUNDATION_ERROR_CODE.INVALID_RATING_CONTRACT,
      "Adjustment audit requires beforeState and afterState",
      { fields: ["beforeState", "afterState"] }
    );
  }

  /** @type {RatingAdjustmentAuditContract} */
  const contract = {
    auditId: requireNonEmptyString(raw.auditId, "auditId"),
    playerId: requireNonEmptyString(raw.playerId, "playerId"),
    scope: requireExplicitPlayerRatingScope(raw.scope ?? raw.tenantId),
    ratingMode: requireSupportedRatingMode(raw.ratingMode),
    actorId: requireNonEmptyString(raw.actorId, "actorId"),
    reason: requireNonEmptyString(raw.reason, "reason"),
    beforeState: raw.beforeState,
    afterState: raw.afterState,
    adjustedAt: requireValidTimestamp(raw.adjustedAt, "adjustedAt"),
  };

  if (raw.correlationId != null) {
    contract.correlationId = requireNonEmptyString(
      raw.correlationId,
      "correlationId"
    );
  }

  return deepFreeze(contract);
}
