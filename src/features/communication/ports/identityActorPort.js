/**
 * IdentityActorPort — resolve authenticated actor refs (COMMS-01).
 * Does not authenticate, restore sessions, or own Identity SoT.
 */

import { matchesPortMethods, throwPortUnimplemented } from "./portHelpers.js";

/**
 * @typedef {Object} IdentityActorPort
 * @property {(authUserId: string) => Promise<{ authUserId: string, accountStatus?: string }|null>} resolveActor
 * @property {(authUserId: string) => Promise<boolean>} isAccountActive
 */

export const IDENTITY_ACTOR_PORT_METHODS = Object.freeze([
  "resolveActor",
  "isAccountActive",
]);

/**
 * @param {unknown} port
 * @returns {boolean}
 */
export function matchesIdentityActorPort(port) {
  return matchesPortMethods(port, IDENTITY_ACTOR_PORT_METHODS);
}

/**
 * @returns {IdentityActorPort}
 */
export function createUnimplementedIdentityActorPort() {
  return {
    async resolveActor() {
      throwPortUnimplemented("IdentityActorPort", "resolveActor");
    },
    async isAccountActive() {
      throwPortUnimplemented("IdentityActorPort", "isAccountActive");
    },
  };
}
