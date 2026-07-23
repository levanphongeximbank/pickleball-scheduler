/**
 * RatingAdjustmentAuditPort — adjustment audit interface (Phase 1B).
 */

import { matchesPortMethods, throwPortUnimplemented } from "./portHelpers.js";
import { requireAdjustmentActorContext } from "../contracts/adjustmentContract.js";

/**
 * @typedef {Object} RatingAdjustmentAuditPort
 * @property {(audit: unknown) => Promise<unknown>} recordAdjustmentAudit
 * @property {(request: unknown) => Promise<unknown>} [requestAdjustment]
 */

export const RATING_ADJUSTMENT_AUDIT_PORT_METHODS = Object.freeze([
  "recordAdjustmentAudit",
]);

/**
 * @param {unknown} port
 * @returns {boolean}
 */
export function matchesRatingAdjustmentAuditPort(port) {
  return matchesPortMethods(port, RATING_ADJUSTMENT_AUDIT_PORT_METHODS);
}

/**
 * @returns {RatingAdjustmentAuditPort}
 */
export function createUnimplementedRatingAdjustmentAuditPort() {
  return {
    async recordAdjustmentAudit(audit) {
      if (audit && typeof audit === "object" && "actor" in /** @type {object} */ (audit)) {
        requireAdjustmentActorContext(
          /** @type {{ actor?: unknown }} */ (audit).actor
        );
      }
      throwPortUnimplemented(
        "RatingAdjustmentAuditPort",
        "recordAdjustmentAudit"
      );
    },
    async requestAdjustment(request) {
      if (request && typeof request === "object") {
        requireAdjustmentActorContext(
          /** @type {{ actor?: unknown }} */ (request).actor
        );
      } else {
        requireAdjustmentActorContext(null);
      }
      throwPortUnimplemented(
        "RatingAdjustmentAuditPort",
        "requestAdjustment"
      );
    },
  };
}
