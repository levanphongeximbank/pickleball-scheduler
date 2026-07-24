/**
 * Community restriction fact (COMMS-04) — Communication-owned moderation evidence.
 */

import {
  COMMUNITY_RESTRICTION_SCOPE,
  COMMUNITY_RESTRICTION_STATUS,
  isCommunityRestrictionScope,
  isCommunityRestrictionStatus,
} from "../constants/communityRestrictionStatus.js";
import { COMMUNICATION_FOUNDATION_ERROR_CODE } from "../errors/errorCodes.js";
import { createParticipantId, requireOpaqueId } from "./identifiers.js";
import {
  deepFreeze,
  failContract,
  optionalNonEmptyString,
  requireValidTimestamp,
} from "./shared.js";

/**
 * @typedef {Object} CommunityRestrictionContract
 * @property {string} tenantId
 * @property {string} participantId
 * @property {string} status
 * @property {string} scope
 * @property {string|null} channelKey
 * @property {string|null} reasonCode
 * @property {string|null} reason
 * @property {string|number} updatedAt
 */

/**
 * @param {object} input
 * @returns {Readonly<CommunityRestrictionContract>}
 */
export function createCommunityRestrictionContract(input = {}) {
  const tenantId = requireOpaqueId(input.tenantId, "tenantId");
  const participantId = createParticipantId(input.participantId);
  const status =
    input.status == null
      ? COMMUNITY_RESTRICTION_STATUS.NONE
      : input.status;
  if (!isCommunityRestrictionStatus(status)) {
    failContract(
      COMMUNICATION_FOUNDATION_ERROR_CODE.INVALID_CONTRACT,
      `Unsupported community restriction status: ${String(status)}`,
      {
        status,
        allowed: Object.values(COMMUNITY_RESTRICTION_STATUS),
      }
    );
  }
  const scope =
    input.scope == null
      ? COMMUNITY_RESTRICTION_SCOPE.COMMUNITY
      : input.scope;
  if (!isCommunityRestrictionScope(scope)) {
    failContract(
      COMMUNICATION_FOUNDATION_ERROR_CODE.INVALID_CONTRACT,
      `Unsupported community restriction scope: ${String(scope)}`,
      {
        scope,
        allowed: Object.values(COMMUNITY_RESTRICTION_SCOPE),
      }
    );
  }
  const channelKey = optionalNonEmptyString(input.channelKey, "channelKey");
  if (scope === COMMUNITY_RESTRICTION_SCOPE.CHANNEL && !channelKey) {
    failContract(
      COMMUNICATION_FOUNDATION_ERROR_CODE.INVALID_CONTRACT,
      "CHANNEL restriction requires channelKey",
      { scope, field: "channelKey" }
    );
  }

  return deepFreeze({
    tenantId,
    participantId,
    status: String(status),
    scope: String(scope),
    channelKey,
    reasonCode: optionalNonEmptyString(input.reasonCode, "reasonCode"),
    reason: optionalNonEmptyString(input.reason, "reason"),
    updatedAt: requireValidTimestamp(input.updatedAt, "updatedAt"),
  });
}
