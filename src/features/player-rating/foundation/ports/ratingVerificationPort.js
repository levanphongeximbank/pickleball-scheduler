/**
 * RatingVerificationPort — verification workflow interface (Phase 1B).
 */

import { matchesPortMethods, throwPortUnimplemented } from "./portHelpers.js";
import { requireVerificationActorContext } from "../contracts/verificationContract.js";

/**
 * @typedef {Object} RatingVerificationPort
 * @property {(request: unknown) => Promise<unknown>} verifyRating
 */

export const RATING_VERIFICATION_PORT_METHODS = Object.freeze(["verifyRating"]);

/**
 * @param {unknown} port
 * @returns {boolean}
 */
export function matchesRatingVerificationPort(port) {
  return matchesPortMethods(port, RATING_VERIFICATION_PORT_METHODS);
}

/**
 * @returns {RatingVerificationPort}
 */
export function createUnimplementedRatingVerificationPort() {
  return {
    async verifyRating(request) {
      if (request && typeof request === "object") {
        requireVerificationActorContext(
          /** @type {{ actor?: unknown }} */ (request).actor
        );
      } else {
        requireVerificationActorContext(null);
      }
      throwPortUnimplemented("RatingVerificationPort", "verifyRating");
    },
  };
}
