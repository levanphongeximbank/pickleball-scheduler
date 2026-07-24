/**
 * Club membership fact contract — Communication projection of Club SoT (COMMS-03).
 */

import {
  CLUB_MEMBERSHIP_STATUS,
  isClubMembershipStatus,
} from "../constants/clubMembershipStatus.js";
import { COMMUNICATION_FOUNDATION_ERROR_CODE } from "../errors/errorCodes.js";
import { createParticipantId, requireOpaqueId } from "./identifiers.js";
import { deepFreeze, failContract } from "./shared.js";

/**
 * @typedef {Object} ClubMembershipFactContract
 * @property {string} clubId
 * @property {string} participantId
 * @property {string} status
 * @property {object|null} externalRoleFacts — opaque Club policy facts; not Communication SoT
 */

/**
 * @param {object} input
 * @returns {Readonly<ClubMembershipFactContract>}
 */
export function createClubMembershipFactContract(input = {}) {
  const clubId = requireOpaqueId(input.clubId, "clubId");
  const participantId = createParticipantId(input.participantId);
  if (!isClubMembershipStatus(input.status)) {
    failContract(
      COMMUNICATION_FOUNDATION_ERROR_CODE.INVALID_CONTRACT,
      `Unsupported club membership status: ${String(input.status)}`,
      {
        status: input.status,
        allowed: Object.values(CLUB_MEMBERSHIP_STATUS),
      }
    );
  }

  let externalRoleFacts = null;
  if (input.externalRoleFacts != null) {
    if (
      typeof input.externalRoleFacts !== "object" ||
      Array.isArray(input.externalRoleFacts)
    ) {
      failContract(
        COMMUNICATION_FOUNDATION_ERROR_CODE.INVALID_CONTRACT,
        "externalRoleFacts must be a plain object when provided",
        { field: "externalRoleFacts" }
      );
    }
    externalRoleFacts = Object.freeze({ ...input.externalRoleFacts });
  }

  return deepFreeze({
    clubId,
    participantId,
    status: String(input.status),
    externalRoleFacts,
  });
}
