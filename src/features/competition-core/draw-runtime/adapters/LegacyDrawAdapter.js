/**
 * Phase 3H — LegacyDrawAdapter (map-only).
 * Must not import or execute Production draw engines.
 */

import { DRAW_ADAPTER_ID } from "../contracts/adapterContract.js";
import { DRAW_RUNTIME_ERROR_CODE } from "../errors/runtimeErrorCodes.js";
import { DrawRuntimeError } from "../errors/DrawRuntimeError.js";
import {
  isLegacyDrawSource,
  mapLegacyDrawToCandidates,
} from "../mappers/index.js";

/**
 * @returns {import('../contracts/adapterContract.js').DrawAdapter}
 */
export function createLegacyDrawAdapter() {
  return {
    id: DRAW_ADAPTER_ID.LEGACY,
    sourceType: "LEGACY_DRAW",
    supports(source, context = {}) {
      return isLegacyDrawSource(source, context);
    },
    map(source, context = {}) {
      if (!isLegacyDrawSource(source, context)) {
        throw new DrawRuntimeError(
          DRAW_RUNTIME_ERROR_CODE.DRAW_UNSUPPORTED_SOURCE,
          "LegacyDrawAdapter does not support this source",
          { adapterId: DRAW_ADAPTER_ID.LEGACY }
        );
      }
      return mapLegacyDrawToCandidates(source, {
        ...context,
        sourceType: context.sourceType || "LEGACY_DRAW",
      });
    },
  };
}

export const LegacyDrawAdapter = {
  create: createLegacyDrawAdapter,
  id: DRAW_ADAPTER_ID.LEGACY,
};
