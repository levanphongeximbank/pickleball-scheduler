/**
 * Club Communication access + team access policy ports (COMMS-03).
 * Club / Team governance roles arrive only through adapters.
 */

import { matchesPortMethods, throwPortUnimplemented } from "./portHelpers.js";
import { CLUB_COMMUNICATION_ACCESS_DECISION } from "../constants/clubCommunicationAccess.js";

/**
 * @typedef {Object} ClubCommunicationAccessPolicy
 * @property {(input: object) => Promise<{ decision: string, reasonCode?: string|null }>|{ decision: string, reasonCode?: string|null }} evaluate
 */

export const CLUB_COMMUNICATION_ACCESS_POLICY_METHODS = Object.freeze([
  "evaluate",
]);

/**
 * @param {unknown} port
 * @returns {boolean}
 */
export function matchesClubCommunicationAccessPolicy(port) {
  return matchesPortMethods(port, CLUB_COMMUNICATION_ACCESS_POLICY_METHODS);
}

/**
 * @returns {ClubCommunicationAccessPolicy}
 */
export function createUnimplementedClubCommunicationAccessPolicy() {
  return {
    async evaluate() {
      throwPortUnimplemented("ClubCommunicationAccessPolicy", "evaluate");
    },
  };
}

/**
 * Default policy: deny ANNOUNCEMENT send / TEAM / MANAGEMENT / ADMIN / PIN
 * unless explicitly allowed by a richer adapter. GENERAL send/read passes
 * through domain membership rules without policy veto.
 * @returns {ClubCommunicationAccessPolicy}
 */
export function createDefaultClubCommunicationAccessPolicy() {
  return {
    async evaluate(input = {}) {
      const kind = input.channelKind;
      const action = input.action;
      if (
        kind === "ANNOUNCEMENT" &&
        action === "SEND"
      ) {
        return {
          decision: CLUB_COMMUNICATION_ACCESS_DECISION.DENY,
          reasonCode: "ANNOUNCEMENT_SEND_DENIED",
        };
      }
      if (kind === "TEAM") {
        return {
          decision: CLUB_COMMUNICATION_ACCESS_DECISION.DENY,
          reasonCode: "TEAM_POLICY_DENIED",
        };
      }
      if (kind === "MANAGEMENT") {
        return {
          decision: CLUB_COMMUNICATION_ACCESS_DECISION.DENY,
          reasonCode: "MANAGEMENT_POLICY_DENIED",
        };
      }
      if (action === "ADMIN" || action === "PIN") {
        return {
          decision: CLUB_COMMUNICATION_ACCESS_DECISION.DENY,
          reasonCode: "UNAUTHORIZED_ADMIN",
        };
      }
      return {
        decision: CLUB_COMMUNICATION_ACCESS_DECISION.ALLOW,
        reasonCode: null,
      };
    },
  };
}

/**
 * Test helper: allow everything (policy always ALLOW).
 * Channel-admin / announcement send still need domain rules satisfied.
 * @returns {ClubCommunicationAccessPolicy}
 */
export function createAllowAllClubCommunicationAccessPolicy() {
  return {
    async evaluate() {
      return {
        decision: CLUB_COMMUNICATION_ACCESS_DECISION.ALLOW,
        reasonCode: null,
      };
    },
  };
}

/**
 * @typedef {Object} TeamAccessPolicy
 * @property {(input: object) => Promise<{ allowed: boolean, reasonCode?: string|null }>|{ allowed: boolean, reasonCode?: string|null }} canAccessTeamChannel
 */

export const TEAM_ACCESS_POLICY_METHODS = Object.freeze([
  "canAccessTeamChannel",
]);

/**
 * @param {unknown} port
 * @returns {boolean}
 */
export function matchesTeamAccessPolicy(port) {
  return matchesPortMethods(port, TEAM_ACCESS_POLICY_METHODS);
}

/**
 * @returns {TeamAccessPolicy}
 */
export function createUnimplementedTeamAccessPolicy() {
  return {
    async canAccessTeamChannel() {
      throwPortUnimplemented("TeamAccessPolicy", "canAccessTeamChannel");
    },
  };
}

/**
 * Default team policy: deny (fail closed until Team adapter is wired).
 * @returns {TeamAccessPolicy}
 */
export function createDenyAllTeamAccessPolicy() {
  return {
    async canAccessTeamChannel() {
      return { allowed: false, reasonCode: "TEAM_POLICY_DENIED" };
    },
  };
}

/**
 * @returns {TeamAccessPolicy}
 */
export function createAllowAllTeamAccessPolicy() {
  return {
    async canAccessTeamChannel() {
      return { allowed: true, reasonCode: null };
    },
  };
}
