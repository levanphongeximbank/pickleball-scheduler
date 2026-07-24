/**
 * Typed community communication access decision (COMMS-04).
 */

import {
  COMMUNITY_COMMUNICATION_ACCESS_DECISION,
  isCommunityCommunicationAccessDecision,
  isCommunityCommunicationDenyReason,
} from "../constants/communityCommunicationAccess.js";
import { COMMUNICATION_FOUNDATION_ERROR_CODE } from "../errors/errorCodes.js";
import { deepFreeze, failContract, optionalNonEmptyString } from "./shared.js";

/**
 * @typedef {Object} CommunityAccessDecisionContract
 * @property {string} decision — ALLOW | JOIN_REQUIRED | READ_ONLY | DENY
 * @property {string|null} reasonCode
 * @property {string|null} message
 */

/**
 * @param {object} input
 * @returns {Readonly<CommunityAccessDecisionContract>}
 */
export function createCommunityAccessDecisionContract(input = {}) {
  if (!isCommunityCommunicationAccessDecision(input.decision)) {
    failContract(
      COMMUNICATION_FOUNDATION_ERROR_CODE.INVALID_CONTRACT,
      `Unsupported community communication access decision: ${String(input.decision)}`,
      {
        decision: input.decision,
        allowed: Object.values(COMMUNITY_COMMUNICATION_ACCESS_DECISION),
      }
    );
  }

  let reasonCode = optionalNonEmptyString(input.reasonCode, "reasonCode");
  if (
    input.decision !== COMMUNITY_COMMUNICATION_ACCESS_DECISION.ALLOW &&
    reasonCode &&
    !isCommunityCommunicationDenyReason(reasonCode)
  ) {
    failContract(
      COMMUNICATION_FOUNDATION_ERROR_CODE.INVALID_CONTRACT,
      `Unsupported community reasonCode: ${reasonCode}`,
      { reasonCode }
    );
  }

  const message = optionalNonEmptyString(input.message, "message");

  return deepFreeze({
    decision: String(input.decision),
    reasonCode,
    message,
  });
}
