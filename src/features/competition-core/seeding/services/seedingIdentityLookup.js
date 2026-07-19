/**
 * Phase 3G — seeding identity index for collision detection.
 */

import {
  createSeedingIdentity,
  buildSeedingIdentityKey,
} from "../contracts/seedingIdentity.js";
import { SEEDING_RUNTIME_ERROR_CODE } from "../errors/runtimeErrorCodes.js";
import { SeedingRuntimeError } from "../errors/SeedingRuntimeError.js";

/**
 * @returns {{
 *   get: (key: string) => { identityKey: string, assignmentCount: number }|null,
 *   register: (payload: {
 *     competitionId: string,
 *     contextId: string,
 *     identityKey?: string,
 *     assignmentCount?: number,
 *   }) => import('../contracts/seedingIdentity.js').SeedingIdentity,
 *   has: (key: string) => boolean,
 *   size: () => number,
 *   clear: () => void,
 * }}
 */
export function createSeedingIdentityLookup() {
  /** @type {Map<string, { identityKey: string, assignmentCount: number, competitionId: string, contextId: string }>} */
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
      const identity = createSeedingIdentity({
        competitionId: payload.competitionId,
        contextId: payload.contextId,
        key: payload.identityKey,
      });
      const existing = byKey.get(identity.key);
      const assignmentCount = Number(payload.assignmentCount || 0);
      if (existing) {
        if (
          existing.competitionId === identity.competitionId &&
          existing.contextId === identity.contextId &&
          existing.assignmentCount === assignmentCount
        ) {
          return identity;
        }
        throw new SeedingRuntimeError(
          SEEDING_RUNTIME_ERROR_CODE.SEEDING_IDENTITY_COLLISION,
          "Seeding identity collision — refuse to overwrite",
          {
            identityKey: identity.key,
            existingCount: existing.assignmentCount,
            incomingCount: assignmentCount,
          }
        );
      }
      byKey.set(identity.key, {
        identityKey: identity.key,
        assignmentCount,
        competitionId: identity.competitionId,
        contextId: identity.contextId,
      });
      return identity;
    },
  };
}

/**
 * @param {{ competitionId?: string, contextId?: string, identityKey?: string }} payload
 * @returns {import('../contracts/seedingIdentity.js').SeedingIdentity}
 */
export function requireSeedingIdentity(payload = {}) {
  return createSeedingIdentity({
    competitionId: payload.competitionId,
    contextId: payload.contextId,
    key:
      payload.identityKey ||
      buildSeedingIdentityKey({
        competitionId: payload.competitionId,
        contextId: payload.contextId,
      }),
  });
}
