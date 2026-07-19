/**
 * Phase 3B — LegacyParticipantAdapter (map-only).
 * No Canonical adapter in this phase.
 */

import {
  PARTICIPANT_ADAPTER_ID,
} from "../contracts/participantAdapter.js";
import {
  LEGACY_PLAYER_SOURCE_TYPE,
  isLegacyPlayerSource,
  mapLegacyPlayerToCompetitionParticipant,
} from "../mappers/legacyPlayerMapper.js";
import { PARTICIPANT_RUNTIME_ERROR_CODE } from "../errors/runtimeErrorCodes.js";
import { ParticipantRuntimeError } from "../errors/ParticipantRuntimeError.js";

/**
 * @returns {import('../contracts/participantAdapter.js').ParticipantAdapter}
 */
export function createLegacyParticipantAdapter() {
  return {
    id: PARTICIPANT_ADAPTER_ID.LEGACY,
    sourceType: LEGACY_PLAYER_SOURCE_TYPE,
    supports(source) {
      return isLegacyPlayerSource(source);
    },
    map(source, context = {}) {
      if (!isLegacyPlayerSource(source)) {
        throw new ParticipantRuntimeError(
          PARTICIPANT_RUNTIME_ERROR_CODE.UNSUPPORTED_SOURCE,
          "LegacyParticipantAdapter does not support this source",
          { adapterId: PARTICIPANT_ADAPTER_ID.LEGACY }
        );
      }
      return mapLegacyPlayerToCompetitionParticipant(source, context);
    },
  };
}

/** Singleton factory convenience — each call returns a fresh adapter instance. */
export const LegacyParticipantAdapter = {
  create: createLegacyParticipantAdapter,
  id: PARTICIPANT_ADAPTER_ID.LEGACY,
  sourceType: LEGACY_PLAYER_SOURCE_TYPE,
};
