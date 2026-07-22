/**
 * CORE-14 Phase 1F — composite occupancy request adapter.
 * Combines independently supplied occupancy sets on copies.
 * Does not run detectors or production wiring.
 */

import { EVALUATION_STATUS } from "../enums/evaluationStatus.js";
import { INPUT_DIAGNOSTIC_CODE } from "../enums/diagnosticCode.js";
import { createInputDiagnostic } from "../domain/InputDiagnostic.js";
import { validateResourceOccupancy } from "../domain/ResourceOccupancy.js";
import { evaluateDuplicateIntegrity } from "../domain/duplicateIntegrity.js";
import { compareOccupancyIds } from "../domain/OccupancyIndexKey.js";
import { deepFreezeClone, isPlainObject } from "../deterministic/serialize.js";
import { createAdapterResult, createRejectedAdapterResult } from "./adapterResult.js";
import { requireSourceContractVersion } from "./shared.js";

/**
 * @param {unknown} list
 * @param {string} fieldName
 * @returns {{ ok: true, value: object[] } | { ok: false, diagnostics: object[] }}
 */
function copyOccupancyList(list, fieldName) {
  if (list == null) return { ok: true, value: [] };
  if (!Array.isArray(list)) {
    return {
      ok: false,
      diagnostics: [
        createInputDiagnostic({
          code: INPUT_DIAGNOSTIC_CODE.ADAPTER_RECORD_INVALID,
          message: `${fieldName} must be an array when supplied`,
          details: { fieldName },
        }),
      ],
    };
  }
  /** @type {object[]} */
  const out = [];
  /** @type {object[]} */
  const diagnostics = [];
  for (let i = 0; i < list.length; i += 1) {
    const path = `${fieldName}[${i}]`;
    const validated = validateResourceOccupancy(list[i]);
    if (!validated.ok) {
      for (const d of validated.diagnostics) {
        diagnostics.push(
          createInputDiagnostic({
            code: d.code,
            message: d.message,
            path,
            occupancyId: d.occupancyId,
            assignmentId: d.assignmentId,
            details: { ...(d.details || {}), fieldName, index: i },
          })
        );
      }
      continue;
    }
    out.push(deepFreezeClone(validated.value));
  }
  if (diagnostics.length > 0) {
    return { ok: false, diagnostics, value: out };
  }
  return { ok: true, value: out };
}

/**
 * @param {unknown} input
 * @returns {object} AdapterResult
 */
export function combineResourceOccupancies(input) {
  const versionResult = requireSourceContractVersion(input);
  if (!versionResult.ok) {
    return createRejectedAdapterResult([versionResult.diagnostic], null);
  }
  if (!isPlainObject(input)) {
    return createRejectedAdapterResult(
      [
        createInputDiagnostic({
          code: INPUT_DIAGNOSTIC_CODE.ADAPTER_RECORD_INVALID,
          message: "composite adapter input must be a plain object",
        }),
      ],
      null
    );
  }
  const raw = /** @type {Record<string, unknown>} */ (input);

  const schedule = copyOccupancyList(raw.scheduleOccupancies, "scheduleOccupancies");
  const court = copyOccupancyList(raw.courtOccupancies, "courtOccupancies");
  const referee = copyOccupancyList(raw.refereeOccupancies, "refereeOccupancies");
  const extra = copyOccupancyList(raw.additionalOccupancies, "additionalOccupancies");

  /** @type {object[]} */
  const diagnostics = [];
  let rejected = 0;
  for (const part of [schedule, court, referee, extra]) {
    if (!part.ok) {
      diagnostics.push(...part.diagnostics);
      rejected += part.diagnostics.length;
    }
  }

  const combined = [
    ...(schedule.value || []),
    ...(court.value || []),
    ...(referee.value || []),
    ...(extra.value || []),
  ].sort((a, b) => compareOccupancyIds(a.occupancyId, b.occupancyId));

  const inputRecordCount =
    (Array.isArray(raw.scheduleOccupancies) ? raw.scheduleOccupancies.length : 0) +
    (Array.isArray(raw.courtOccupancies) ? raw.courtOccupancies.length : 0) +
    (Array.isArray(raw.refereeOccupancies) ? raw.refereeOccupancies.length : 0) +
    (Array.isArray(raw.additionalOccupancies) ? raw.additionalOccupancies.length : 0);

  if (diagnostics.length > 0 && combined.length === 0) {
    return createAdapterResult({
      evaluationStatus: EVALUATION_STATUS.REJECTED_INVALID_INPUT,
      occupancies: [],
      diagnostics,
      inputRecordCount,
      outputRecordCount: 0,
      rejectedRecordCount: rejected,
      sourceContractVersion: versionResult.value,
      metadata: {
        adapter: "combineResourceOccupancies",
        detectorsExecuted: false,
        partialAdaptation: false,
      },
    });
  }

  const dup = evaluateDuplicateIntegrity(combined);
  if (!dup.ok) {
    diagnostics.push(...dup.diagnostics);
    return createAdapterResult({
      evaluationStatus: EVALUATION_STATUS.REJECTED_INVALID_INPUT,
      occupancies: [],
      diagnostics,
      inputRecordCount,
      outputRecordCount: 0,
      rejectedRecordCount: rejected + combined.length,
      sourceContractVersion: versionResult.value,
      metadata: {
        adapter: "combineResourceOccupancies",
        detectorsExecuted: false,
        duplicateIntegrityFailed: true,
        partialAdaptation: false,
      },
    });
  }

  const partialAdaptation = diagnostics.length > 0 && combined.length > 0;
  return createAdapterResult({
    evaluationStatus: EVALUATION_STATUS.COMPLETED,
    occupancies: combined,
    diagnostics,
    inputRecordCount,
    outputRecordCount: combined.length,
    rejectedRecordCount: rejected,
    sourceContractVersion: versionResult.value,
    metadata: {
      adapter: "combineResourceOccupancies",
      detectorsExecuted: false,
      partialAdaptation,
    },
  });
}
