/**
 * Phase 3F — LegacyMatchAdapter (map-only).
 */

import { MATCH_ADAPTER_ID } from "../contracts/adapterContract.js";
import { MATCH_SOURCE_TYPE } from "../enums/matchSourceTypes.js";
import { MATCH_RUNTIME_ERROR_CODE } from "../errors/runtimeErrorCodes.js";
import { MatchRuntimeError } from "../errors/MatchRuntimeError.js";
import {
  isLegacyMatchSource,
  mapLegacyMatchToCompetitionMatch,
} from "../mappers/index.js";

/**
 * @returns {import('../contracts/adapterContract.js').MatchAdapter}
 */
export function createLegacyMatchAdapter() {
  return {
    id: MATCH_ADAPTER_ID.LEGACY,
    sourceType: MATCH_SOURCE_TYPE.LEGACY_MATCH,
    supports(source, context = {}) {
      return isLegacyMatchSource(source, context);
    },
    map(source, context = {}) {
      if (!isLegacyMatchSource(source, context)) {
        throw new MatchRuntimeError(
          MATCH_RUNTIME_ERROR_CODE.MATCH_UNSUPPORTED_SOURCE,
          "LegacyMatchAdapter does not support this source",
          { adapterId: MATCH_ADAPTER_ID.LEGACY }
        );
      }
      return mapLegacyMatchToCompetitionMatch(source, {
        ...context,
        sourceType:
          context.sourceType ||
          (source &&
          typeof source === "object" &&
          /** @type {Record<string, unknown>} */ (source).disciplineId != null
            ? MATCH_SOURCE_TYPE.LEGACY_SUB_MATCH
            : MATCH_SOURCE_TYPE.LEGACY_MATCH),
      });
    },
  };
}

export const LegacyMatchAdapter = {
  create: createLegacyMatchAdapter,
  id: MATCH_ADAPTER_ID.LEGACY,
};
