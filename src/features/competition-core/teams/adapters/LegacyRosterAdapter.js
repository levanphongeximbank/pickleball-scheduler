/**
 * Phase 3D — LegacyRosterAdapter (map-only).
 */

import { ROSTER_ADAPTER_ID } from "../contracts/adapterContract.js";
import { TEAM_SOURCE_TYPE } from "../enums/teamSourceTypes.js";
import { TEAM_RUNTIME_ERROR_CODE } from "../errors/runtimeErrorCodes.js";
import { TeamRuntimeError } from "../errors/TeamRuntimeError.js";
import {
  isLegacyRosterSource,
  isLegacyTeamSource,
  mapLegacyRosterToCompetitionRoster,
} from "../mappers/index.js";

/**
 * @returns {import('../contracts/adapterContract.js').RosterAdapter}
 */
export function createLegacyRosterAdapter() {
  return {
    id: ROSTER_ADAPTER_ID.LEGACY,
    sourceType: TEAM_SOURCE_TYPE.LEGACY_ROSTER,
    supports(source, context = {}) {
      return (
        isLegacyRosterSource(source, { ...context, preferRoster: true }) ||
        isLegacyTeamSource(source, context)
      );
    },
    map(source, context = {}) {
      const ctx = { ...context, preferRoster: true };
      if (
        !isLegacyRosterSource(source, ctx) &&
        !isLegacyTeamSource(source, context)
      ) {
        throw new TeamRuntimeError(
          TEAM_RUNTIME_ERROR_CODE.UNSUPPORTED_ROSTER_SOURCE,
          "LegacyRosterAdapter does not support this source",
          { adapterId: ROSTER_ADAPTER_ID.LEGACY }
        );
      }
      return mapLegacyRosterToCompetitionRoster(source, {
        ...ctx,
        sourceType: TEAM_SOURCE_TYPE.LEGACY_ROSTER,
      });
    },
  };
}

export const LegacyRosterAdapter = {
  create: createLegacyRosterAdapter,
  id: ROSTER_ADAPTER_ID.LEGACY,
};
