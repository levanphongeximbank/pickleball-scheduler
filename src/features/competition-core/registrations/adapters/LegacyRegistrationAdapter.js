/**
 * Phase 3C — LegacyRegistrationAdapter (map-only).
 * Supports individual entry, Official BTC source type, and team registration.
 */

import { REGISTRATION_ADAPTER_ID } from "../contracts/registrationAdapter.js";
import { REGISTRATION_SOURCE_TYPE } from "../enums/registrationSourceTypes.js";
import { REGISTRATION_RUNTIME_ERROR_CODE } from "../errors/runtimeErrorCodes.js";
import { RegistrationRuntimeError } from "../errors/RegistrationRuntimeError.js";
import {
  isLegacyIndividualEntrySource,
  mapLegacyIndividualEntryToRegistration,
  isLegacyTeamRegistrationSource,
  mapLegacyTeamRegistrationToRegistration,
} from "../mappers/index.js";

/**
 * @returns {import('../contracts/registrationAdapter.js').RegistrationAdapter}
 */
export function createLegacyRegistrationAdapter() {
  return {
    id: REGISTRATION_ADAPTER_ID.LEGACY,
    sourceType: "LEGACY",
    supports(source, context = {}) {
      return (
        isLegacyTeamRegistrationSource(source, context) ||
        isLegacyIndividualEntrySource(source, context)
      );
    },
    map(source, context = {}) {
      if (isLegacyTeamRegistrationSource(source, context)) {
        return mapLegacyTeamRegistrationToRegistration(source, {
          ...context,
          sourceType: REGISTRATION_SOURCE_TYPE.LEGACY_TEAM_REGISTRATION,
        });
      }
      if (isLegacyIndividualEntrySource(source, context)) {
        return mapLegacyIndividualEntryToRegistration(source, context);
      }
      throw new RegistrationRuntimeError(
        REGISTRATION_RUNTIME_ERROR_CODE.UNSUPPORTED_REGISTRATION_SOURCE,
        "LegacyRegistrationAdapter does not support this source",
        { adapterId: REGISTRATION_ADAPTER_ID.LEGACY }
      );
    },
  };
}

export const LegacyRegistrationAdapter = {
  create: createLegacyRegistrationAdapter,
  id: REGISTRATION_ADAPTER_ID.LEGACY,
};
