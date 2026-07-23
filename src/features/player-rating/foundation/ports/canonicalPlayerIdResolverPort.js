/**
 * CanonicalPlayerIdResolverPort — interface only (Phase 1B).
 * Canonical ID behavior remains behind this port; no PM runtime wiring here.
 */

import { PLAYER_RATING_FOUNDATION_ERROR_CODE } from "../errors/errorCodes.js";
import { PlayerRatingFoundationError } from "../errors/PlayerRatingFoundationError.js";
import { requireExplicitPlayerRatingScope } from "../contracts/scopeContract.js";
import { matchesPortMethods, throwPortUnimplemented } from "./portHelpers.js";

/**
 * @typedef {Object} CanonicalPlayerIdResolutionResult
 * @property {'MAPPED'|'DERIVED'|'UNMAPPED'|'INVALID'|'AMBIGUOUS'} outcome
 * @property {string|null} playerId
 * @property {string} [reason]
 */

/**
 * @typedef {Object} CanonicalPlayerIdResolverPort
 * @property {(reference: unknown, scope: unknown) => Promise<CanonicalPlayerIdResolutionResult>} resolveCanonicalPlayerId
 */

export const CANONICAL_PLAYER_ID_RESOLVER_PORT_METHODS = Object.freeze([
  "resolveCanonicalPlayerId",
]);

/**
 * @param {unknown} port
 * @returns {boolean}
 */
export function matchesCanonicalPlayerIdResolverPort(port) {
  return matchesPortMethods(port, CANONICAL_PLAYER_ID_RESOLVER_PORT_METHODS);
}

/**
 * Default port: fails closed — unresolved / unimplemented.
 * @returns {CanonicalPlayerIdResolverPort}
 */
export function createUnimplementedCanonicalPlayerIdResolverPort() {
  return {
    async resolveCanonicalPlayerId(reference, scope) {
      requireExplicitPlayerRatingScope(scope);
      throw new PlayerRatingFoundationError(
        PLAYER_RATING_FOUNDATION_ERROR_CODE.CANONICAL_PLAYER_ID_UNRESOLVED,
        "Canonical player ID unresolved: CanonicalPlayerIdResolverPort is unimplemented",
        { reference }
      );
    },
  };
}

/**
 * Explicit unresolved outcome helper (no adapter).
 * @param {string} [reason]
 * @returns {CanonicalPlayerIdResolutionResult}
 */
export function unresolvedCanonicalPlayerIdResult(reason = "unresolved") {
  return Object.freeze({
    outcome: "UNMAPPED",
    playerId: null,
    reason,
  });
}

/**
 * @param {string} operation
 * @returns {never}
 */
export function rejectCanonicalResolverOperation(operation) {
  return throwPortUnimplemented("CanonicalPlayerIdResolverPort", operation);
}
