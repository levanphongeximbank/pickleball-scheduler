/**
 * Idempotent operation identity for verification / adjustment (Phase 1E).
 * Distinct from match-result application identity.
 */

import { PLAYER_RATING_FOUNDATION_ERROR_CODE } from "../errors/errorCodes.js";
import { requireSupportedRatingMode } from "../contracts/ratingModes.js";
import {
  getScopeTenantId,
  requireExplicitPlayerRatingScope,
} from "../contracts/scopeContract.js";
import {
  clonePlain,
  deepFreeze,
  failContract,
  requireNonEmptyString,
} from "../contracts/shared.js";
import { RATING_OPERATION_TYPE } from "./constants.js";
import { scopesMatch } from "../history-snapshot/scopeMatch.js";

/**
 * @typedef {Object} RatingOperationIdentity
 * @property {string} playerId
 * @property {import('../contracts/scopeContract.js').PlayerRatingScope} scope
 * @property {'overall'|'singles'|'doubles'} ratingMode
 * @property {string} operationId
 * @property {'VERIFICATION'|'ADJUSTMENT'} operationType
 */

/**
 * @param {unknown} input
 * @returns {Readonly<RatingOperationIdentity>}
 */
export function createRatingOperationIdentity(input) {
  if (!input || typeof input !== "object") {
    failContract(
      PLAYER_RATING_FOUNDATION_ERROR_CODE.INVALID_RATING_CONTRACT,
      "Rating operation identity requires a complete object",
      { input }
    );
  }

  const raw = /** @type {Record<string, unknown>} */ (input);
  const operationType = requireNonEmptyString(raw.operationType, "operationType");
  if (
    operationType !== RATING_OPERATION_TYPE.VERIFICATION &&
    operationType !== RATING_OPERATION_TYPE.ADJUSTMENT
  ) {
    failContract(
      PLAYER_RATING_FOUNDATION_ERROR_CODE.INVALID_RATING_CONTRACT,
      "operationType must be VERIFICATION or ADJUSTMENT",
      { operationType }
    );
  }

  /** @type {RatingOperationIdentity} */
  const identity = {
    playerId: requireNonEmptyString(raw.playerId, "playerId"),
    scope: requireExplicitPlayerRatingScope(raw.scope ?? raw.tenantId),
    ratingMode: requireSupportedRatingMode(raw.ratingMode),
    operationId: requireNonEmptyString(raw.operationId, "operationId"),
    operationType: /** @type {'VERIFICATION'|'ADJUSTMENT'} */ (operationType),
  };

  return deepFreeze(clonePlain(identity));
}

/**
 * Stable string key for operation ledger / replay.
 * @param {RatingOperationIdentity|unknown} identity
 * @returns {string}
 */
export function buildRatingOperationIdentityKey(identity) {
  const complete = createRatingOperationIdentity(identity);
  const tenantPart =
    complete.scope.kind === "global"
      ? "global"
      : `tenant:${getScopeTenantId(complete.scope)}${
          complete.scope.kind === "tenant" && complete.scope.venueId
            ? `:venue:${complete.scope.venueId}`
            : ""
        }`;
  return [
    complete.operationType,
    complete.playerId,
    tenantPart,
    complete.ratingMode,
    complete.operationId,
  ].join("|");
}

/**
 * @param {RatingOperationIdentity} a
 * @param {RatingOperationIdentity} b
 * @returns {boolean}
 */
export function ratingOperationIdentitiesEqual(a, b) {
  return (
    a.playerId === b.playerId &&
    a.ratingMode === b.ratingMode &&
    a.operationId === b.operationId &&
    a.operationType === b.operationType &&
    scopesMatch(a.scope, b.scope)
  );
}
