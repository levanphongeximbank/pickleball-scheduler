/**
 * Merge approval port helpers (CUSTOMER-06).
 * Fail-closed by default — merge requires explicit approval.
 */

import { CUSTOMER_ERROR_CODES } from "../errors/codes.js";
import { throwCustomerError } from "../errors/CustomerError.js";

/**
 * @typedef {{
 *   authorize: (args: {
 *     scope: object,
 *     proposal: object,
 *     actorReference?: string|null,
 *     approvalReference?: string|null,
 *   }) => Promise<{ approved: boolean, reference?: string|null, reason?: string|null }>| { approved: boolean, reference?: string|null, reason?: string|null }
 * }} MergeApprovalPort
 */

/**
 * @returns {MergeApprovalPort}
 */
export function createFailClosedMergeApproval() {
  return Object.freeze({
    async authorize() {
      return Object.freeze({
        approved: false,
        reference: null,
        reason: "Merge approval port is fail-closed.",
      });
    },
  });
}

/**
 * Test helper — authorizes when any approvalReference is provided,
 * or always when options.always === true.
 *
 * @param {{ always?: boolean }} [options]
 * @returns {MergeApprovalPort}
 */
export function createInMemoryAllowAllMergeApproval(options = {}) {
  const always = options.always !== false;
  return Object.freeze({
    async authorize({ approvalReference } = {}) {
      if (always || (approvalReference && String(approvalReference).trim())) {
        return Object.freeze({
          approved: true,
          reference: approvalReference
            ? String(approvalReference)
            : "allow-all",
          reason: null,
        });
      }
      return Object.freeze({
        approved: false,
        reference: null,
        reason: "approvalReference required",
      });
    },
  });
}

/**
 * Require a usable MergeApprovalPort (fail-closed).
 * @param {MergeApprovalPort|null|undefined} port
 * @returns {MergeApprovalPort}
 */
export function requireMergeApprovalPort(port) {
  if (!port || typeof port.authorize !== "function") {
    throwCustomerError(
      CUSTOMER_ERROR_CODES.MERGE_APPROVAL_REQUIRED,
      "MergeApprovalPort is required to approve or execute merges.",
      { adapter: "MergeApprovalPort" }
    );
  }
  return port;
}
