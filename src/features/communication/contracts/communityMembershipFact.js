/**
 * Community membership fact contract — Communication projection of external SoT (COMMS-04).
 */

import {
  COMMUNITY_MEMBERSHIP_STATUS,
  isCommunityMembershipStatus,
} from "../constants/communityMembershipStatus.js";
import { COMMUNICATION_FOUNDATION_ERROR_CODE } from "../errors/errorCodes.js";
import { createParticipantId, requireOpaqueId } from "./identifiers.js";
import { deepFreeze, failContract } from "./shared.js";

/**
 * @typedef {Object} CommunityMembershipFactContract
 * @property {string} tenantId
 * @property {string} participantId
 * @property {string} status
 * @property {object|null} externalRoleFacts — opaque policy facts; not Communication SoT
 */

/**
 * @param {object} input
 * @returns {Readonly<CommunityMembershipFactContract>}
 */
export function createCommunityMembershipFactContract(input = {}) {
  const tenantId = requireOpaqueId(input.tenantId, "tenantId");
  const participantId = createParticipantId(input.participantId);
  if (!isCommunityMembershipStatus(input.status)) {
    failContract(
      COMMUNICATION_FOUNDATION_ERROR_CODE.INVALID_CONTRACT,
      `Unsupported community membership status: ${String(input.status)}`,
      {
        status: input.status,
        allowed: Object.values(COMMUNITY_MEMBERSHIP_STATUS),
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
    tenantId,
    participantId,
    status: String(input.status),
    externalRoleFacts,
  });
}
