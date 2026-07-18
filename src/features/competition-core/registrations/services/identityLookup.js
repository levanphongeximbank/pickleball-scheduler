/**
 * Phase 3C — registration identity index for collision detection.
 * No silent overwrite on collision.
 */

import {
  createRegistrationIdentity,
  identityFromCompetitionRegistration,
} from "../contracts/registrationIdentity.js";
import { REGISTRATION_RUNTIME_ERROR_CODE } from "../errors/runtimeErrorCodes.js";
import { RegistrationRuntimeError } from "../errors/RegistrationRuntimeError.js";

/**
 * @param {import('../../participants/contracts/entryRegistration.js').CompetitionRegistration} a
 * @param {import('../../participants/contracts/entryRegistration.js').CompetitionRegistration} b
 * @returns {boolean}
 */
function sameIdentityPayload(a, b) {
  return (
    a.id === b.id &&
    a.competitionId === b.competitionId &&
    a.registrationKind === b.registrationKind &&
    a.sourceId === b.sourceId &&
    a.status === b.status
  );
}

/**
 * @returns {{
 *   get: (key: string) => import('../../participants/contracts/entryRegistration.js').CompetitionRegistration|null,
 *   register: (registration: import('../../participants/contracts/entryRegistration.js').CompetitionRegistration) => import('../contracts/registrationIdentity.js').RegistrationIdentity,
 *   has: (key: string) => boolean,
 *   size: () => number,
 *   clear: () => void,
 * }}
 */
export function createRegistrationIdentityLookup() {
  /** @type {Map<string, import('../../participants/contracts/entryRegistration.js').CompetitionRegistration>} */
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
    register(registration) {
      const identity = identityFromCompetitionRegistration(registration);
      if (!identity) {
        throw new RegistrationRuntimeError(
          REGISTRATION_RUNTIME_ERROR_CODE.INVALID_REGISTRATION,
          "Cannot derive identity from registration",
          { registrationId: registration?.id }
        );
      }
      const existing = byKey.get(identity.key);
      if (existing) {
        if (sameIdentityPayload(existing, registration)) {
          return identity;
        }
        throw new RegistrationRuntimeError(
          REGISTRATION_RUNTIME_ERROR_CODE.REGISTRATION_IDENTITY_COLLISION,
          "Registration identity collision — refuse to overwrite",
          {
            identityKey: identity.key,
            existingId: existing.id,
            incomingId: registration.id,
            existingSourceId: existing.sourceId,
            incomingSourceId: registration.sourceId,
          }
        );
      }
      byKey.set(identity.key, registration);
      return createRegistrationIdentity(identity);
    },
  };
}

/**
 * @param {import('../../participants/contracts/entryRegistration.js').CompetitionRegistration} registration
 * @returns {import('../contracts/registrationIdentity.js').RegistrationIdentity}
 */
export function requireRegistrationIdentity(registration) {
  const identity = identityFromCompetitionRegistration(registration);
  if (!identity) {
    throw new RegistrationRuntimeError(
      REGISTRATION_RUNTIME_ERROR_CODE.INVALID_REGISTRATION,
      "Registration missing competition-scoped identity",
      { registrationId: registration?.id }
    );
  }
  return createRegistrationIdentity(identity);
}
