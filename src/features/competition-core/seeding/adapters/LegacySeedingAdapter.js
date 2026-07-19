/**
 * Phase 3G — LegacySeedingAdapter (map-only).
 */

import { SEEDING_ADAPTER_ID } from "../contracts/adapterContract.js";
import { SEEDING_SOURCE_TYPE } from "../enums/seedingSourceTypes.js";
import { SEEDING_RUNTIME_ERROR_CODE } from "../errors/runtimeErrorCodes.js";
import { SeedingRuntimeError } from "../errors/SeedingRuntimeError.js";
import {
  isLegacySeedingSource,
  mapLegacySeedingToCandidates,
} from "../mappers/index.js";

/**
 * @returns {import('../contracts/adapterContract.js').SeedingAdapter}
 */
export function createLegacySeedingAdapter() {
  return {
    id: SEEDING_ADAPTER_ID.LEGACY,
    sourceType: SEEDING_SOURCE_TYPE.LEGACY,
    supports(source, context = {}) {
      return isLegacySeedingSource(source, context);
    },
    map(source, context = {}) {
      if (!isLegacySeedingSource(source, context)) {
        throw new SeedingRuntimeError(
          SEEDING_RUNTIME_ERROR_CODE.SEEDING_UNSUPPORTED_SOURCE,
          "LegacySeedingAdapter does not support this source",
          { adapterId: SEEDING_ADAPTER_ID.LEGACY }
        );
      }
      return mapLegacySeedingToCandidates(source, {
        ...context,
        sourceType: context.sourceType || SEEDING_SOURCE_TYPE.LEGACY,
      });
    },
  };
}

export const LegacySeedingAdapter = {
  create: createLegacySeedingAdapter,
  id: SEEDING_ADAPTER_ID.LEGACY,
};
