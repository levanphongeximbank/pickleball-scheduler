/**
 * Typed direct messaging access decision (COMMS-02).
 */

import {
  DIRECT_MESSAGING_ACCESS_DECISION,
  DIRECT_MESSAGING_DENY_REASON,
  isDirectMessagingAccessDecision,
  isDirectMessagingDenyReason,
} from "../constants/directMessagingAccess.js";
import { COMMUNICATION_FOUNDATION_ERROR_CODE } from "../errors/errorCodes.js";
import { deepFreeze, failContract, optionalNonEmptyString } from "./shared.js";

/**
 * @typedef {Object} DirectAccessDecisionContract
 * @property {string} decision — ALLOW | REQUEST_REQUIRED | DENY
 * @property {string|null} reasonCode
 * @property {string|null} message
 */

/**
 * @param {object} input
 * @returns {Readonly<DirectAccessDecisionContract>}
 */
export function createDirectAccessDecisionContract(input = {}) {
  if (!isDirectMessagingAccessDecision(input.decision)) {
    failContract(
      COMMUNICATION_FOUNDATION_ERROR_CODE.INVALID_CONTRACT,
      `Unsupported direct messaging access decision: ${String(input.decision)}`,
      {
        decision: input.decision,
        allowed: Object.values(DIRECT_MESSAGING_ACCESS_DECISION),
      }
    );
  }

  let reasonCode = optionalNonEmptyString(input.reasonCode, "reasonCode");
  if (
    input.decision === DIRECT_MESSAGING_ACCESS_DECISION.DENY &&
    reasonCode &&
    !isDirectMessagingDenyReason(reasonCode)
  ) {
    failContract(
      COMMUNICATION_FOUNDATION_ERROR_CODE.INVALID_CONTRACT,
      `Unsupported deny reasonCode: ${reasonCode}`,
      {
        reasonCode,
        allowed: Object.values(DIRECT_MESSAGING_DENY_REASON),
      }
    );
  }

  if (
    input.decision !== DIRECT_MESSAGING_ACCESS_DECISION.DENY &&
    reasonCode == null
  ) {
    // non-deny may omit reason
  }

  const message = optionalNonEmptyString(input.message, "message");

  return deepFreeze({
    decision: String(input.decision),
    reasonCode,
    message,
  });
}
