/**
 * MatchResultRatingPort — interface only (Phase 1B).
 * No rating algorithm. No Competition Engine imports. No result ingestion.
 */

import { PLAYER_RATING_FOUNDATION_ERROR_CODE } from "../errors/errorCodes.js";
import { PlayerRatingFoundationError } from "../errors/PlayerRatingFoundationError.js";
import { createRatingApplicationIdentityContract } from "../contracts/idempotencyContract.js";
import { createRatingReversalIdentityContract } from "../contracts/reversalContract.js";
import { matchesPortMethods } from "./portHelpers.js";

/**
 * @typedef {Object} MatchResultRatingPort
 * @property {(applicationIdentity: unknown, evidence?: unknown) => Promise<unknown>} applyRatingFromMatchResult
 * @property {(reversalIdentity: unknown, evidence?: unknown) => Promise<unknown>} reverseRatingApplication
 */

export const MATCH_RESULT_RATING_PORT_METHODS = Object.freeze([
  "applyRatingFromMatchResult",
  "reverseRatingApplication",
]);

/**
 * @param {unknown} port
 * @returns {boolean}
 */
export function matchesMatchResultRatingPort(port) {
  return matchesPortMethods(port, MATCH_RESULT_RATING_PORT_METHODS);
}

/**
 * Default MatchResultRatingPort: validates identity contracts, then fails closed.
 * Explicitly contains no algorithm and no result ingestion.
 * @returns {MatchResultRatingPort}
 */
export function createUnimplementedMatchResultRatingPort() {
  return {
    async applyRatingFromMatchResult(applicationIdentity) {
      createRatingApplicationIdentityContract(applicationIdentity);
      throw new PlayerRatingFoundationError(
        PLAYER_RATING_FOUNDATION_ERROR_CODE.MATCH_RESULT_RATING_INTEGRATION_UNAVAILABLE,
        "MatchResultRatingPort.applyRatingFromMatchResult is unavailable; no rating algorithm in Phase 1B",
        { operation: "applyRatingFromMatchResult" }
      );
    },
    async reverseRatingApplication(reversalIdentity) {
      createRatingReversalIdentityContract(reversalIdentity);
      throw new PlayerRatingFoundationError(
        PLAYER_RATING_FOUNDATION_ERROR_CODE.MATCH_RESULT_RATING_INTEGRATION_UNAVAILABLE,
        "MatchResultRatingPort.reverseRatingApplication is unavailable; no rating algorithm in Phase 1B",
        { operation: "reverseRatingApplication" }
      );
    },
  };
}

/**
 * Sentinel confirming this module ships without an algorithm implementation.
 */
export const MATCH_RESULT_RATING_ALGORITHM = Object.freeze({
  status: "unimplemented",
  phase: "1B",
  hasAlgorithm: false,
});
