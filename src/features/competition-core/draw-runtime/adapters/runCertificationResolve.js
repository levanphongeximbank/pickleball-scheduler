/**
 * CORE-08 Phase 1B — shared resolve helper (delegation only).
 */

import { createDrawResolver } from "../DrawResolver.js";
import {
  DRAW_CERTIFICATION_ERROR_CODE,
  createDrawCertificationError,
  createDrawCertificationOk,
} from "./certificationErrors.js";
import { mapCertificationInputToDrawResolveRequest } from "./mapCertificationInput.js";
import { mapCanonicalResultToLegacyGroups } from "./mapCertificationOutput.js";

/**
 * @param {object} input certification fixture
 * @param {{
 *   target: string,
 *   parity: string,
 *   acceptedDifferences?: string[],
 *   unsupportedBehavior?: string[],
 *   resolverOptions?: object,
 *   namePrefix?: string,
 *   entriesById?: Map<string, unknown>|Record<string, unknown>,
 * }} meta
 */
export async function runCertificationResolve(input, meta) {
  const mapped = mapCertificationInputToDrawResolveRequest({
    ...input,
    certificationTarget: meta.target,
  });
  if (mapped.ok === false) {
    return mapped;
  }

  const resolver = createDrawResolver(meta.resolverOptions || {});
  const canonical = await resolver.resolve(mapped.request);
  if (!canonical.ok) {
    return createDrawCertificationError(
      DRAW_CERTIFICATION_ERROR_CODE.ADAPTER_RESOLVE_FAILED,
      canonical.error?.message || "Phase 3H resolve failed",
      {
        drawError: canonical.error,
        diagnostics: canonical.diagnostics,
      }
    );
  }

  const legacy = mapCanonicalResultToLegacyGroups(canonical, {
    entriesById: meta.entriesById,
    namePrefix: meta.namePrefix,
  });

  return createDrawCertificationOk({
    target: meta.target,
    parity: meta.parity,
    legacyMode: mapped.modeMapping.legacyMode,
    phase3hMode: mapped.modeMapping.phase3hMode,
    mappingStatus: mapped.modeMapping.status,
    request: mapped.request,
    canonical,
    legacy,
    acceptedDifferences: meta.acceptedDifferences || [],
    unsupportedBehavior: meta.unsupportedBehavior || [],
    diagnostics: {
      calledPhase3h: true,
      candidateCount: mapped.candidateCount,
      placementCount: canonical.placements?.length ?? 0,
      groupCount: canonical.groups?.length ?? 0,
      byeCount: canonical.byes?.length ?? 0,
      unresolvedCount: canonical.unresolvedCandidates?.length ?? 0,
      excludedCount: canonical.excludedCandidates?.length ?? 0,
      modeConditions: mapped.modeMapping.conditions,
    },
  });
}
