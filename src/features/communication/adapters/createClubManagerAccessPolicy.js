/**
 * Club access policy: elevate PIN / ADMIN / ANNOUNCEMENT SEND / TEAM / MANAGEMENT
 * only when Club SoT externalRoleFacts.isClubManagerOrOwner is true.
 * Regular active members keep GENERAL send/read via domain rules (policy ALLOW pass-through).
 */

import { CLUB_CHANNEL_KIND } from "../constants/clubChannelKinds.js";
import { CLUB_COMMUNICATION_ACCESS_DECISION } from "../constants/clubCommunicationAccess.js";
import { createDefaultClubCommunicationAccessPolicy } from "../ports/clubCommunicationPolicyPorts.js";
import { createDenyAllTeamAccessPolicy } from "../ports/clubCommunicationPolicyPorts.js";

function isManagerOrOwner(externalRoleFacts) {
  if (!externalRoleFacts || typeof externalRoleFacts !== "object") return false;
  if (externalRoleFacts.isClubManagerOrOwner === true) return true;
  const roles = Array.isArray(externalRoleFacts.clubRoles)
    ? externalRoleFacts.clubRoles
    : [];
  return roles.some((r) =>
    ["club_owner", "president", "vice_president"].includes(String(r))
  );
}

/**
 * @returns {import("../ports/clubCommunicationPolicyPorts.js").ClubCommunicationAccessPolicy}
 */
export function createClubManagerAccessPolicy() {
  const fallback = createDefaultClubCommunicationAccessPolicy();
  return {
    async evaluate(input = {}) {
      if (isManagerOrOwner(input.externalRoleFacts)) {
        const kind = input.channelKind;
        const action = input.action;
        if (
          action === "ADMIN" ||
          action === "PIN" ||
          (kind === CLUB_CHANNEL_KIND.ANNOUNCEMENT && action === "SEND") ||
          kind === CLUB_CHANNEL_KIND.TEAM ||
          kind === CLUB_CHANNEL_KIND.MANAGEMENT
        ) {
          return {
            decision: CLUB_COMMUNICATION_ACCESS_DECISION.ALLOW,
            reasonCode: "CLUB_MANAGER_OR_OWNER",
          };
        }
      }
      return fallback.evaluate(input);
    },
  };
}

/**
 * Team channels: allow only managers/owners (fail-closed otherwise).
 */
export function createClubManagerTeamAccessPolicy() {
  const deny = createDenyAllTeamAccessPolicy();
  return {
    async canAccessTeamChannel(input = {}) {
      if (isManagerOrOwner(input.externalRoleFacts)) {
        return { allowed: true, reasonCode: "CLUB_MANAGER_OR_OWNER" };
      }
      return deny.canAccessTeamChannel(input);
    },
  };
}
