/**
 * Phase 3H — draw identity index for collision detection.
 */

import {
  createDrawIdentity,
  buildDrawIdentityKey,
} from "../contracts/drawIdentity.js";
import { DRAW_RUNTIME_ERROR_CODE } from "../errors/runtimeErrorCodes.js";
import { DrawRuntimeError } from "../errors/DrawRuntimeError.js";

/**
 * @returns {{
 *   get: (key: string) => { identityKey: string, placementCount: number }|null,
 *   register: (payload: {
 *     competitionId: string,
 *     contextId: string,
 *     identityKey?: string,
 *     placementCount?: number,
 *   }) => import('../contracts/drawIdentity.js').DrawIdentity,
 *   has: (key: string) => boolean,
 *   size: () => number,
 *   clear: () => void,
 * }}
 */
export function createDrawIdentityLookup() {
  /** @type {Map<string, { identityKey: string, placementCount: number, competitionId: string, contextId: string }>} */
  const byKey = new Map();

  return {
    get(key) {
      return byKey.get(String(key)) ?? null;
    },
    has(key) {
      return byKey.has(String(key));
    },
    size() {
      return byKey.size;
    },
    clear() {
      byKey.clear();
    },
    register(payload) {
      const identity = createDrawIdentity({
        competitionId: payload.competitionId,
        contextId: payload.contextId,
        key: payload.identityKey,
      });
      const existing = byKey.get(identity.key);
      const placementCount = Number(payload.placementCount || 0);
      if (existing) {
        if (
          existing.competitionId === identity.competitionId &&
          existing.contextId === identity.contextId &&
          existing.placementCount === placementCount
        ) {
          return identity;
        }
        throw new DrawRuntimeError(
          DRAW_RUNTIME_ERROR_CODE.DRAW_IDENTITY_COLLISION,
          "Draw identity collision — refuse to overwrite",
          {
            identityKey: identity.key,
            existingCount: existing.placementCount,
            incomingCount: placementCount,
          }
        );
      }
      byKey.set(identity.key, {
        identityKey: identity.key,
        placementCount,
        competitionId: identity.competitionId,
        contextId: identity.contextId,
      });
      return identity;
    },
  };
}

/**
 * @param {{ competitionId?: string, contextId?: string, identityKey?: string }} payload
 * @returns {import('../contracts/drawIdentity.js').DrawIdentity}
 */
export function requireDrawIdentity(payload = {}) {
  return createDrawIdentity({
    competitionId: payload.competitionId,
    contextId: payload.contextId,
    key:
      payload.identityKey ||
      buildDrawIdentityKey({
        competitionId: payload.competitionId,
        contextId: payload.contextId,
      }),
  });
}
