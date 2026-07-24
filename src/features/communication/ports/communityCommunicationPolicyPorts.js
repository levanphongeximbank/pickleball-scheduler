/**
 * Community access + moderation policy ports (COMMS-04).
 * Tenant / community governance roles arrive only through adapters.
 */

import { matchesPortMethods, throwPortUnimplemented } from "./portHelpers.js";
import { COMMUNITY_COMMUNICATION_ACCESS_DECISION } from "../constants/communityCommunicationAccess.js";

/**
 * @typedef {Object} CommunityAccessPolicy
 * @property {(input: object) => Promise<{ decision: string, reasonCode?: string|null }>|{ decision: string, reasonCode?: string|null }} evaluate
 */

export const COMMUNITY_ACCESS_POLICY_METHODS = Object.freeze(["evaluate"]);

/**
 * @param {unknown} port
 * @returns {boolean}
 */
export function matchesCommunityAccessPolicy(port) {
  return matchesPortMethods(port, COMMUNITY_ACCESS_POLICY_METHODS);
}

/**
 * @returns {CommunityAccessPolicy}
 */
export function createUnimplementedCommunityAccessPolicy() {
  return {
    async evaluate() {
      throwPortUnimplemented("CommunityAccessPolicy", "evaluate");
    },
  };
}

/**
 * Default: deny RESTRICTED / ADMIN / PIN / MODERATE unless adapter allows.
 * @returns {CommunityAccessPolicy}
 */
export function createDefaultCommunityAccessPolicy() {
  return {
    async evaluate(input = {}) {
      const visibility = input.visibility;
      const action = input.action;
      if (visibility === "RESTRICTED") {
        return {
          decision: COMMUNITY_COMMUNICATION_ACCESS_DECISION.DENY,
          reasonCode: "RESTRICTED_POLICY_DENIED",
        };
      }
      if (
        action === "ADMIN" ||
        action === "PIN" ||
        action === "MODERATE"
      ) {
        return {
          decision: COMMUNITY_COMMUNICATION_ACCESS_DECISION.DENY,
          reasonCode:
            action === "MODERATE"
              ? "UNAUTHORIZED_MODERATOR"
              : "UNAUTHORIZED_ADMIN",
        };
      }
      return {
        decision: COMMUNITY_COMMUNICATION_ACCESS_DECISION.ALLOW,
        reasonCode: null,
      };
    },
  };
}

/**
 * @returns {CommunityAccessPolicy}
 */
export function createAllowAllCommunityAccessPolicy() {
  return {
    async evaluate() {
      return {
        decision: COMMUNITY_COMMUNICATION_ACCESS_DECISION.ALLOW,
        reasonCode: null,
      };
    },
  };
}

/**
 * @typedef {Object} CommunityModerationPolicy
 * @property {(input: object) => Promise<{ allowed: boolean, reasonCode?: string|null, bypassSlowMode?: boolean }>|{ allowed: boolean, reasonCode?: string|null, bypassSlowMode?: boolean }} canModerate
 * @property {(input: object) => Promise<{ allowed: boolean, reasonCode?: string|null }>|{ allowed: boolean, reasonCode?: string|null }} [canBypassSlowMode]
 */

export const COMMUNITY_MODERATION_POLICY_METHODS = Object.freeze([
  "canModerate",
]);

/**
 * @param {unknown} port
 * @returns {boolean}
 */
export function matchesCommunityModerationPolicy(port) {
  return matchesPortMethods(port, COMMUNITY_MODERATION_POLICY_METHODS);
}

/**
 * @returns {CommunityModerationPolicy}
 */
export function createUnimplementedCommunityModerationPolicy() {
  return {
    async canModerate() {
      throwPortUnimplemented("CommunityModerationPolicy", "canModerate");
    },
  };
}

/**
 * Fail-closed moderation policy.
 * @returns {CommunityModerationPolicy}
 */
export function createDenyAllCommunityModerationPolicy() {
  return {
    async canModerate() {
      return { allowed: false, reasonCode: "UNAUTHORIZED_MODERATOR" };
    },
    async canBypassSlowMode() {
      return { allowed: false, reasonCode: "UNAUTHORIZED_MODERATOR" };
    },
  };
}

/**
 * @returns {CommunityModerationPolicy}
 */
export function createAllowAllCommunityModerationPolicy() {
  return {
    async canModerate() {
      return { allowed: true, reasonCode: null, bypassSlowMode: false };
    },
    async canBypassSlowMode() {
      return { allowed: false, reasonCode: null };
    },
  };
}

/**
 * Test helper: allow moderation and slow-mode bypass.
 * @returns {CommunityModerationPolicy}
 */
export function createBypassSlowModeCommunityModerationPolicy() {
  return {
    async canModerate() {
      return { allowed: true, reasonCode: null, bypassSlowMode: true };
    },
    async canBypassSlowMode() {
      return { allowed: true, reasonCode: null };
    },
  };
}
