/**
 * Phase 3D — LegacyTeamAdapter (map-only).
 */

import { TEAM_ADAPTER_ID } from "../contracts/adapterContract.js";
import { TEAM_SOURCE_TYPE } from "../enums/teamSourceTypes.js";
import { TEAM_RUNTIME_ERROR_CODE } from "../errors/runtimeErrorCodes.js";
import { TeamRuntimeError } from "../errors/TeamRuntimeError.js";
import {
  isLegacyTeamSource,
  mapLegacyTeamToCompetitionTeam,
} from "../mappers/index.js";

/**
 * @returns {import('../contracts/adapterContract.js').TeamAdapter}
 */
export function createLegacyTeamAdapter() {
  return {
    id: TEAM_ADAPTER_ID.LEGACY,
    sourceType: TEAM_SOURCE_TYPE.LEGACY_TEAM,
    supports(source, context = {}) {
      return isLegacyTeamSource(source, context);
    },
    map(source, context = {}) {
      if (!isLegacyTeamSource(source, context)) {
        throw new TeamRuntimeError(
          TEAM_RUNTIME_ERROR_CODE.UNSUPPORTED_TEAM_SOURCE,
          "LegacyTeamAdapter does not support this source",
          { adapterId: TEAM_ADAPTER_ID.LEGACY }
        );
      }
      return mapLegacyTeamToCompetitionTeam(source, {
        ...context,
        sourceType: TEAM_SOURCE_TYPE.LEGACY_TEAM,
      });
    },
  };
}

export const LegacyTeamAdapter = {
  create: createLegacyTeamAdapter,
  id: TEAM_ADAPTER_ID.LEGACY,
};
