/**
 * CORE-14 Phase 1F — dormant court assignment adapter (shape-only).
 * Produces COURT occupancies only. No inventory search or court selection.
 */

import { CORE14_ADAPTER_CONTRACT_V1 } from "../constants/versions.js";
import { RESOURCE_KIND } from "../enums/resourceKind.js";
import { OCCUPANCY_SOURCE } from "../enums/occupancySource.js";
import { EVALUATION_STATUS } from "../enums/evaluationStatus.js";
import { INPUT_DIAGNOSTIC_CODE } from "../enums/diagnosticCode.js";
import { createInputDiagnostic } from "../domain/InputDiagnostic.js";
import { createResourceOccupancy } from "../domain/ResourceOccupancy.js";
import { evaluateDuplicateIntegrity } from "../domain/duplicateIntegrity.js";
import { createAdapterResult, createRejectedAdapterResult } from "./adapterResult.js";
import { createAdapterOccupancyId } from "./occupancyIdentity.js";
import {
  optionalIdentity,
  requireSourceContractVersion,
  requireResourceKeyOfKind,
  resolveInterval,
  resolveActivityIdentity,
  resolveLockPublished,
  resolveCapacityUnits,
} from "./shared.js";

/**
 * @param {unknown} input
 * @returns {object} AdapterResult
 */
export function adaptCourtAssignmentsToResourceOccupancies(input) {
  const versionResult = requireSourceContractVersion(input);
  if (!versionResult.ok) {
    return createRejectedAdapterResult([versionResult.diagnostic], null);
  }
  const raw = /** @type {Record<string, unknown>} */ (input);
  const records = raw.records;
  if (!Array.isArray(records)) {
    return createRejectedAdapterResult(
      [
        createInputDiagnostic({
          code: INPUT_DIAGNOSTIC_CODE.ADAPTER_RECORD_INVALID,
          message: "records must be an array",
          details: { fieldName: "records" },
        }),
      ],
      versionResult.value
    );
  }

  const sourceContractVersion = versionResult.value;
  /** @type {object[]} */
  const occupancies = [];
  /** @type {object[]} */
  const diagnostics = [];
  let rejectedRecordCount = 0;

  for (let i = 0; i < records.length; i += 1) {
    const path = `records[${i}]`;
    const record = records[i];
    if (record == null || typeof record !== "object" || Array.isArray(record)) {
      rejectedRecordCount += 1;
      diagnostics.push(
        createInputDiagnostic({
          code: INPUT_DIAGNOSTIC_CODE.ADAPTER_RECORD_INVALID,
          message: "court assignment record must be an object",
          path,
          details: { recordIndex: i },
        })
      );
      continue;
    }
    const rec = /** @type {Record<string, unknown>} */ (record);

    const activity = resolveActivityIdentity(rec, path);
    if (!activity.ok) {
      rejectedRecordCount += 1;
      diagnostics.push(activity.diagnostic);
      continue;
    }

    const keyInput = rec.resourceKey ?? {
      resourceKind: RESOURCE_KIND.COURT,
      resourceId: rec.courtId ?? rec.resourceId,
      scopeType: rec.scopeType,
      scopeId: rec.scopeId,
    };
    const keyResult = requireResourceKeyOfKind(keyInput, RESOURCE_KIND.COURT, path);
    if (!keyResult.ok) {
      rejectedRecordCount += 1;
      diagnostics.push(keyResult.diagnostic);
      continue;
    }

    const interval = resolveInterval(rec, null, path);
    if (!interval.ok) {
      rejectedRecordCount += 1;
      diagnostics.push(interval.diagnostic);
      continue;
    }

    const flags = resolveLockPublished(rec.locked, rec.published, path);
    if (!flags.ok) {
      rejectedRecordCount += 1;
      diagnostics.push(flags.diagnostic);
      continue;
    }

    const capacity = resolveCapacityUnits(rec.capacityUnits, 1, path);
    if (!capacity.ok) {
      rejectedRecordCount += 1;
      diagnostics.push(capacity.diagnostic);
      continue;
    }

    const sourceRecordIdentity =
      optionalIdentity(rec.assignmentId) ||
      optionalIdentity(rec.courtAssignmentId) ||
      optionalIdentity(rec.recordId) ||
      activity.activityIdentity;

    const occupancyId = createAdapterOccupancyId({
      adapterContractVersion: CORE14_ADAPTER_CONTRACT_V1,
      sourceContractVersion,
      resourceKey: keyResult.value,
      sourceRecordIdentity,
      activityIdentity: activity.activityIdentity,
      startMs: interval.startMs,
      endMs: interval.endMs,
      occupancyRole: RESOURCE_KIND.COURT,
    });

    occupancies.push(
      createResourceOccupancy({
        occupancyId,
        resourceKey: keyResult.value,
        assignmentId: activity.assignmentId,
        activityId: activity.activityId,
        matchId: activity.matchId,
        competitionId: optionalIdentity(rec.competitionId),
        venueId: optionalIdentity(rec.venueId),
        startMs: interval.startMs,
        endMs: interval.endMs,
        capacityUnits: capacity.value,
        locked: flags.locked,
        published: flags.published,
        source: OCCUPANCY_SOURCE.COURT_ASSIGNMENT,
        metadata: {
          adapter: "court",
          sourceRecordIdentity,
        },
      })
    );
  }

  const dup = evaluateDuplicateIntegrity(occupancies);
  if (!dup.ok) {
    diagnostics.push(...dup.diagnostics);
  }

  const partialAdaptation = rejectedRecordCount > 0 && occupancies.length > 0;
  const evaluationStatus =
    records.length > 0 && occupancies.length === 0 && rejectedRecordCount > 0
      ? EVALUATION_STATUS.REJECTED_INVALID_INPUT
      : !dup.ok
        ? EVALUATION_STATUS.REJECTED_INVALID_INPUT
        : EVALUATION_STATUS.COMPLETED;

  return createAdapterResult({
    evaluationStatus,
    occupancies: dup.ok ? occupancies : [],
    diagnostics,
    inputRecordCount: records.length,
    outputRecordCount: dup.ok ? occupancies.length : 0,
    rejectedRecordCount: dup.ok ? rejectedRecordCount : rejectedRecordCount + occupancies.length,
    sourceContractVersion,
    metadata: {
      adapter: "adaptCourtAssignmentsToResourceOccupancies",
      partialAdaptation,
      inventoryLookupPerformed: false,
    },
  });
}
