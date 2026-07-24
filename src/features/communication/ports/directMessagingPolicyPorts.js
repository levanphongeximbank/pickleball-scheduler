/**
 * BlockStateReader + DirectMessagingAccessPolicy ports (COMMS-02).
 * Block and policy are Communication-owned abstractions; Club/CRM/social
 * rules arrive only through adapters — never hard-coded here.
 */

import { matchesPortMethods, throwPortUnimplemented } from "./portHelpers.js";

/**
 * @typedef {Object} BlockStateReader
 * @property {(participantIdA: string, participantIdB: string) => Promise<boolean>|boolean} isBlockedEitherWay
 */

export const BLOCK_STATE_READER_METHODS = Object.freeze([
  "isBlockedEitherWay",
]);

/**
 * @param {unknown} port
 * @returns {boolean}
 */
export function matchesBlockStateReader(port) {
  return matchesPortMethods(port, BLOCK_STATE_READER_METHODS);
}

/**
 * @returns {BlockStateReader}
 */
export function createUnimplementedBlockStateReader() {
  return {
    async isBlockedEitherWay() {
      throwPortUnimplemented("BlockStateReader", "isBlockedEitherWay");
    },
  };
}

/**
 * @typedef {Object} DirectMessagingAccessPolicy
 * @property {(input: {
 *   actorParticipantId: string,
 *   counterpartParticipantId: string,
 *   pairKey: string
 * }) => Promise<{ decision: string, reasonCode?: string|null }>|{ decision: string, reasonCode?: string|null }} evaluate
 */

export const DIRECT_MESSAGING_ACCESS_POLICY_METHODS = Object.freeze([
  "evaluate",
]);

/**
 * @param {unknown} port
 * @returns {boolean}
 */
export function matchesDirectMessagingAccessPolicy(port) {
  return matchesPortMethods(port, DIRECT_MESSAGING_ACCESS_POLICY_METHODS);
}

/**
 * @returns {DirectMessagingAccessPolicy}
 */
export function createUnimplementedDirectMessagingAccessPolicy() {
  return {
    async evaluate() {
      throwPortUnimplemented("DirectMessagingAccessPolicy", "evaluate");
    },
  };
}

/**
 * Default policy that always ALLOWs (no external relationship gate).
 * Useful for unit tests and early COMMS-02 composition.
 * @returns {DirectMessagingAccessPolicy}
 */
export function createAllowAllDirectMessagingAccessPolicy() {
  return {
    async evaluate() {
      return { decision: "ALLOW", reasonCode: null };
    },
  };
}
