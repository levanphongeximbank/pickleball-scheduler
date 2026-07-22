/**
 * CORE-14 Phase 1F — AdapterResult V1.
 * Does not mutate caller input. Fingerprint excludes metadata unless selected.
 */

import {
  CORE14_ADAPTER_CONTRACT_V1,
  CORE14_ADAPTER_RESULT_V1,
} from "../constants/versions.js";
import { EVALUATION_STATUS } from "../enums/evaluationStatus.js";
import { compareDiagnostics } from "../catalogs/severityPolicy.js";
import { compareOccupancyIds } from "../domain/OccupancyIndexKey.js";
import { fingerprintCore14Material } from "../deterministic/fingerprint.js";
import { deepFreezeClone, isPlainObject } from "../deterministic/serialize.js";

/**
 * @param {{
 *   evaluationStatus: string,
 *   occupancies?: readonly object[],
 *   normalizedAvailabilityFacts?: readonly object[],
 *   projectedReport?: object | null,
 *   diagnostics?: readonly object[],
 *   inputRecordCount: number,
 *   outputRecordCount: number,
 *   rejectedRecordCount: number,
 *   sourceContractVersion: string | null,
 *   adapterContractVersion?: string,
 *   metadata?: Record<string, unknown> | null,
 * }} input
 */
export function createAdapterResult(input) {
  const occupancies = Array.isArray(input.occupancies)
    ? [...input.occupancies].sort((a, b) => compareOccupancyIds(a?.occupancyId, b?.occupancyId))
    : [];
  const normalizedAvailabilityFacts = Array.isArray(input.normalizedAvailabilityFacts)
    ? [...input.normalizedAvailabilityFacts]
    : [];
  const diagnostics = Array.isArray(input.diagnostics)
    ? [...input.diagnostics].sort(compareDiagnostics)
    : [];
  const adapterContractVersion = input.adapterContractVersion || CORE14_ADAPTER_CONTRACT_V1;
  const metadata =
    input.metadata == null
      ? null
      : isPlainObject(input.metadata)
        ? /** @type {Record<string, unknown>} */ (deepFreezeClone({ ...input.metadata }))
        : null;

  const fingerprintMaterial = {
    resultVersion: CORE14_ADAPTER_RESULT_V1,
    adapterContractVersion,
    sourceContractVersion: input.sourceContractVersion,
    evaluationStatus: input.evaluationStatus,
    inputRecordCount: input.inputRecordCount,
    outputRecordCount: input.outputRecordCount,
    rejectedRecordCount: input.rejectedRecordCount,
    occupancyIds: occupancies.map((o) => o.occupancyId),
    availabilityFactKeys: normalizedAvailabilityFacts.map((f) => ({
      resourceKeyCanonical: f.resourceKeyCanonical ?? null,
      startMs: f.startMs ?? null,
      endMs: f.endMs ?? null,
      status: f.status ?? null,
    })),
    diagnosticCodes: diagnostics.map((d) => d.code),
    projectedReportFingerprint:
      input.projectedReport && typeof input.projectedReport.deterministicFingerprint === "string"
        ? input.projectedReport.deterministicFingerprint
        : null,
  };

  return Object.freeze({
    resultVersion: CORE14_ADAPTER_RESULT_V1,
    evaluationStatus: input.evaluationStatus,
    occupancies: Object.freeze(occupancies),
    normalizedAvailabilityFacts: Object.freeze(normalizedAvailabilityFacts),
    projectedReport: input.projectedReport == null ? null : Object.freeze(input.projectedReport),
    diagnostics: Object.freeze(diagnostics),
    inputRecordCount: input.inputRecordCount,
    outputRecordCount: input.outputRecordCount,
    rejectedRecordCount: input.rejectedRecordCount,
    sourceContractVersion: input.sourceContractVersion,
    adapterContractVersion,
    deterministicFingerprint: fingerprintCore14Material(fingerprintMaterial),
    metadata,
  });
}

/**
 * @param {object[]} diagnostics
 * @param {string|null} sourceContractVersion
 * @param {Record<string, unknown>|null} [metadata]
 */
export function createRejectedAdapterResult(diagnostics, sourceContractVersion, metadata = null) {
  return createAdapterResult({
    evaluationStatus: EVALUATION_STATUS.REJECTED_INVALID_INPUT,
    occupancies: [],
    normalizedAvailabilityFacts: [],
    projectedReport: null,
    diagnostics,
    inputRecordCount: 0,
    outputRecordCount: 0,
    rejectedRecordCount: 0,
    sourceContractVersion,
    metadata,
  });
}
