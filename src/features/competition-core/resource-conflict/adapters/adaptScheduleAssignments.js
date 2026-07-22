/**
 * CORE-14 Phase 1F — dormant schedule occupancy adapter (shape-only).
 * Produces PLAYER / TEAM / optional LOCATION|VENUE occupancies only.
 * Does not generate times, invent duration, or infer scope from first record.
 */

import { CORE14_ADAPTER_CONTRACT_V1 } from "../constants/versions.js";
import { RESOURCE_KIND } from "../enums/resourceKind.js";
import { OCCUPANCY_SOURCE } from "../enums/occupancySource.js";
import { EVALUATION_STATUS } from "../enums/evaluationStatus.js";
import { INPUT_DIAGNOSTIC_CODE } from "../enums/diagnosticCode.js";
import { createInputDiagnostic } from "../domain/InputDiagnostic.js";
import { createCanonicalResourceKey } from "../domain/CanonicalResourceKey.js";
import { createResourceOccupancy } from "../domain/ResourceOccupancy.js";
import { createAdapterResult, createRejectedAdapterResult } from "./adapterResult.js";
import { createAdapterOccupancyId } from "./occupancyIdentity.js";
import {
  optionalIdentity,
  requireSourceContractVersion,
  resolveInterval,
  resolveActivityIdentity,
  resolveLockPublished,
  resolveCapacityUnits,
} from "./shared.js";

/**
 * @param {unknown} identity
 * @param {string} expectedKind
 * @param {string} path
 */
function normalizeParticipantIdentity(identity, expectedKind, path) {
  if (identity == null || typeof identity !== "object" || Array.isArray(identity)) {
    return {
      ok: false,
      diagnostic: createInputDiagnostic({
        code: INPUT_DIAGNOSTIC_CODE.RESOURCE_ID_MISSING,
        message: `${expectedKind} identity must be an object`,
        path,
        details: { expectedKind },
      }),
    };
  }
  const raw = /** @type {Record<string, unknown>} */ (identity);
  const resourceId =
    optionalIdentity(raw.resourceId) ||
    optionalIdentity(raw.playerId) ||
    optionalIdentity(raw.teamId) ||
    optionalIdentity(raw.id);
  if (!resourceId) {
    return {
      ok: false,
      diagnostic: createInputDiagnostic({
        code: INPUT_DIAGNOSTIC_CODE.RESOURCE_ID_MISSING,
        message: `${expectedKind} resourceId is required`,
        path,
        details: { expectedKind },
      }),
    };
  }
  try {
    const key = createCanonicalResourceKey({
      resourceKind: expectedKind,
      resourceId,
      scopeType: raw.scopeType,
      scopeId: raw.scopeId === undefined ? null : raw.scopeId,
    });
    return { ok: true, value: key };
  } catch (err) {
    const code =
      err && typeof err === "object" && typeof err.code === "string"
        ? err.code
        : INPUT_DIAGNOSTIC_CODE.SCOPE_MISSING;
    return {
      ok: false,
      diagnostic: createInputDiagnostic({
        code: Object.values(INPUT_DIAGNOSTIC_CODE).includes(code)
          ? code
          : INPUT_DIAGNOSTIC_CODE.SCOPE_MISSING,
        message: err && typeof err.message === "string" ? err.message : "invalid participant scope",
        path,
        details: { expectedKind, reason: "PARTICIPANT_KEY_INVALID" },
      }),
    };
  }
}

/**
 * Optional LOCATION / VENUE context only when explicitly present and valid.
 * @param {Record<string, unknown>} record
 * @param {string} path
 */
function optionalLocationKey(record, path) {
  if (record.locationResourceKey == null && record.venueResourceKey == null) {
    return { ok: true, value: null };
  }
  const keyInput = record.locationResourceKey ?? record.venueResourceKey;
  try {
    const key = createCanonicalResourceKey(keyInput);
    if (key.resourceKind !== RESOURCE_KIND.LOCATION && key.resourceKind !== RESOURCE_KIND.VENUE) {
      return {
        ok: false,
        diagnostic: createInputDiagnostic({
          code: INPUT_DIAGNOSTIC_CODE.UNKNOWN_RESOURCE_TYPE,
          message: "optional location context must be LOCATION or VENUE",
          path,
          resourceKey: key,
          details: {
            actualKind: key.resourceKind,
            reason: "ADAPTER_RESOURCE_KIND_MISMATCH",
          },
        }),
      };
    }
    return { ok: true, value: key };
  } catch (err) {
    return {
      ok: false,
      diagnostic: createInputDiagnostic({
        code: INPUT_DIAGNOSTIC_CODE.RESOURCE_ID_MISSING,
        message: err && typeof err.message === "string" ? err.message : "invalid location key",
        path,
        details: { reason: "LOCATION_KEY_INVALID" },
      }),
    };
  }
}

/**
 * @param {unknown} input
 * @returns {object} AdapterResult
 */
export function adaptScheduleAssignmentsToResourceOccupancies(input) {
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

  const slotResolver =
    typeof raw.slotResolver === "function"
      ? /** @type {(r: Record<string, unknown>) => { startMs: number, endMs: number } | null} */ (
          raw.slotResolver
        )
      : null;

  /** @type {object[]} */
  const occupancies = [];
  /** @type {object[]} */
  const diagnostics = [];
  let rejectedRecordCount = 0;
  const sourceContractVersion = versionResult.value;

  for (let i = 0; i < records.length; i += 1) {
    const path = `records[${i}]`;
    const record = records[i];
    if (record == null || typeof record !== "object" || Array.isArray(record)) {
      rejectedRecordCount += 1;
      diagnostics.push(
        createInputDiagnostic({
          code: INPUT_DIAGNOSTIC_CODE.ADAPTER_RECORD_INVALID,
          message: "schedule record must be an object",
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

    const interval = resolveInterval(rec, slotResolver, path);
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

    const players = Array.isArray(rec.players)
      ? rec.players
      : Array.isArray(rec.playerIdentities)
        ? rec.playerIdentities
        : [];
    const teams = Array.isArray(rec.teams)
      ? rec.teams
      : Array.isArray(rec.teamIdentities)
        ? rec.teamIdentities
        : [];

    if (players.length === 0 && teams.length === 0 && rec.locationResourceKey == null && rec.venueResourceKey == null) {
      rejectedRecordCount += 1;
      diagnostics.push(
        createInputDiagnostic({
          code: INPUT_DIAGNOSTIC_CODE.RESOURCE_ID_MISSING,
          message: "schedule record requires at least one player, team, or explicit location key",
          path,
          assignmentId: activity.assignmentId,
          details: { reason: "NO_RESOURCES" },
        })
      );
      continue;
    }

    const sourceRecordIdentity =
      optionalIdentity(rec.assignmentId) ||
      optionalIdentity(rec.scheduleAssignmentId) ||
      optionalIdentity(rec.recordId) ||
      activity.activityIdentity;

    /** @type {object[]} */
    const built = [];
    let recordFailed = false;

    for (let p = 0; p < players.length; p += 1) {
      const playerPath = `${path}.players[${p}]`;
      const keyResult = normalizeParticipantIdentity(players[p], RESOURCE_KIND.PLAYER, playerPath);
      if (!keyResult.ok) {
        recordFailed = true;
        diagnostics.push(keyResult.diagnostic);
        break;
      }
      const occupancyId = createAdapterOccupancyId({
        adapterContractVersion: CORE14_ADAPTER_CONTRACT_V1,
        sourceContractVersion,
        resourceKey: keyResult.value,
        sourceRecordIdentity,
        activityIdentity: activity.activityIdentity,
        startMs: interval.startMs,
        endMs: interval.endMs,
        occupancyRole: RESOURCE_KIND.PLAYER,
      });
      built.push(
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
          source: OCCUPANCY_SOURCE.SCHEDULE,
          metadata: {
            adapter: "schedule",
            sourceRecordIdentity,
            viaSlot: interval.viaSlot,
          },
        })
      );
    }
    if (recordFailed) {
      rejectedRecordCount += 1;
      continue;
    }

    for (let t = 0; t < teams.length; t += 1) {
      const teamPath = `${path}.teams[${t}]`;
      const keyResult = normalizeParticipantIdentity(teams[t], RESOURCE_KIND.TEAM, teamPath);
      if (!keyResult.ok) {
        recordFailed = true;
        diagnostics.push(keyResult.diagnostic);
        break;
      }
      const occupancyId = createAdapterOccupancyId({
        adapterContractVersion: CORE14_ADAPTER_CONTRACT_V1,
        sourceContractVersion,
        resourceKey: keyResult.value,
        sourceRecordIdentity,
        activityIdentity: activity.activityIdentity,
        startMs: interval.startMs,
        endMs: interval.endMs,
        occupancyRole: RESOURCE_KIND.TEAM,
      });
      built.push(
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
          source: OCCUPANCY_SOURCE.SCHEDULE,
          metadata: {
            adapter: "schedule",
            sourceRecordIdentity,
            viaSlot: interval.viaSlot,
          },
        })
      );
    }
    if (recordFailed) {
      rejectedRecordCount += 1;
      continue;
    }

    const location = optionalLocationKey(rec, `${path}.locationResourceKey`);
    if (!location.ok) {
      rejectedRecordCount += 1;
      diagnostics.push(location.diagnostic);
      continue;
    }
    if (location.value) {
      const occupancyId = createAdapterOccupancyId({
        adapterContractVersion: CORE14_ADAPTER_CONTRACT_V1,
        sourceContractVersion,
        resourceKey: location.value,
        sourceRecordIdentity,
        activityIdentity: activity.activityIdentity,
        startMs: interval.startMs,
        endMs: interval.endMs,
        occupancyRole: location.value.resourceKind,
      });
      built.push(
        createResourceOccupancy({
          occupancyId,
          resourceKey: location.value,
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
          source: OCCUPANCY_SOURCE.SCHEDULE,
          metadata: {
            adapter: "schedule",
            sourceRecordIdentity,
            viaSlot: interval.viaSlot,
          },
        })
      );
    }

    if (built.length === 0) {
      rejectedRecordCount += 1;
      diagnostics.push(
        createInputDiagnostic({
          code: INPUT_DIAGNOSTIC_CODE.RESOURCE_ID_MISSING,
          message: "no occupancies produced for schedule record",
          path,
          details: { reason: "EMPTY_OUTPUT" },
        })
      );
      continue;
    }

    for (const occ of built) occupancies.push(occ);
  }

  const partialAdaptation = rejectedRecordCount > 0 && occupancies.length > 0;
  const evaluationStatus =
    records.length > 0 && occupancies.length === 0 && rejectedRecordCount > 0
      ? EVALUATION_STATUS.REJECTED_INVALID_INPUT
      : EVALUATION_STATUS.COMPLETED;

  return createAdapterResult({
    evaluationStatus,
    occupancies,
    diagnostics,
    inputRecordCount: records.length,
    outputRecordCount: occupancies.length,
    rejectedRecordCount,
    sourceContractVersion,
    metadata: {
      adapter: "adaptScheduleAssignmentsToResourceOccupancies",
      partialAdaptation,
      hasSlotResolver: slotResolver != null,
    },
  });
}
