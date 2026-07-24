/**
 * Typed club communication access decision (COMMS-03).
 */

import {
  CLUB_COMMUNICATION_ACCESS_DECISION,
  isClubCommunicationAccessDecision,
  isClubCommunicationDenyReason,
} from "../constants/clubCommunicationAccess.js";
import { COMMUNICATION_FOUNDATION_ERROR_CODE } from "../errors/errorCodes.js";
import { deepFreeze, failContract, optionalNonEmptyString } from "./shared.js";

/**
 * @typedef {Object} ClubAccessDecisionContract
 * @property {string} decision — ALLOW | DENY
 * @property {string|null} reasonCode
 * @property {string|null} message
 */

/**
 * @param {object} input
 * @returns {Readonly<ClubAccessDecisionContract>}
 */
export function createClubAccessDecisionContract(input = {}) {
  if (!isClubCommunicationAccessDecision(input.decision)) {
    failContract(
      COMMUNICATION_FOUNDATION_ERROR_CODE.INVALID_CONTRACT,
      `Unsupported club communication access decision: ${String(input.decision)}`,
      {
        decision: input.decision,
        allowed: Object.values(CLUB_COMMUNICATION_ACCESS_DECISION),
      }
    );
  }

  let reasonCode = optionalNonEmptyString(input.reasonCode, "reasonCode");
  if (
    input.decision === CLUB_COMMUNICATION_ACCESS_DECISION.DENY &&
    reasonCode &&
    !isClubCommunicationDenyReason(reasonCode)
  ) {
    failContract(
      COMMUNICATION_FOUNDATION_ERROR_CODE.INVALID_CONTRACT,
      `Unsupported club deny reasonCode: ${reasonCode}`,
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
