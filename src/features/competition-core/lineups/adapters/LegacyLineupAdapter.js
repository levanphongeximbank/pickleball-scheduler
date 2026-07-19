/**
 * Phase 3E — LegacyLineupAdapter (map-only).
 */

import { LINEUP_ADAPTER_ID } from "../contracts/adapterContract.js";
import { LINEUP_SOURCE_TYPE } from "../enums/lineupSourceTypes.js";
import { LINEUP_RUNTIME_ERROR_CODE } from "../errors/runtimeErrorCodes.js";
import { LineupRuntimeError } from "../errors/LineupRuntimeError.js";
import {
  isLegacyLineupSource,
  mapLegacyLineupToCompetitionLineup,
} from "../mappers/index.js";

/**
 * @returns {import('../contracts/adapterContract.js').LineupAdapter}
 */
export function createLegacyLineupAdapter() {
  return {
    id: LINEUP_ADAPTER_ID.LEGACY,
    sourceType: LINEUP_SOURCE_TYPE.LEGACY_LINEUP,
    supports(source, context = {}) {
      return isLegacyLineupSource(source, context);
    },
    map(source, context = {}) {
      if (!isLegacyLineupSource(source, context)) {
        throw new LineupRuntimeError(
          LINEUP_RUNTIME_ERROR_CODE.UNSUPPORTED_LINEUP_SOURCE,
          "LegacyLineupAdapter does not support this source",
          { adapterId: LINEUP_ADAPTER_ID.LEGACY }
        );
      }
      return mapLegacyLineupToCompetitionLineup(source, {
        ...context,
        sourceType: LINEUP_SOURCE_TYPE.LEGACY_LINEUP,
      });
    },
  };
}

export const LegacyLineupAdapter = {
  create: createLegacyLineupAdapter,
  id: LINEUP_ADAPTER_ID.LEGACY,
};
