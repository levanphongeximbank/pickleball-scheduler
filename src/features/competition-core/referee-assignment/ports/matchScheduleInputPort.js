import {
  createEmptySnapshotResult,
  createInvalidSnapshotResult,
  createMissingSnapshotResult,
  createPopulatedSnapshotResult,
} from "./portResult.js";
import { ownedFreeze } from "../contracts/shared.js";
import { isPlainObject } from "../deterministic/canonicalize.js";
import { REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE } from "../errors/diagnosticCodes.js";
import { RefereeAssignmentContractError } from "../errors/RefereeAssignmentContractError.js";
import { normalizeOptionalInstant } from "../contracts/shared.js";
import { normalizeStableId } from "../deterministic/normalize.js";

export const MATCH_SCHEDULE_INPUT_PORT_METHODS = Object.freeze([
  "resolveMatchSchedule",
]);

export function matchesMatchScheduleInputPort(port) {
  return Boolean(
    port &&
      typeof port === "object" &&
      typeof /** @type {{ resolveMatchSchedule?: unknown }} */ (port)
        .resolveMatchSchedule === "function"
  );
}

/**
 * Normalize a schedule match row (opaque schedule input for CORE-13).
 * @param {object} partial
 */
export function createMatchScheduleRow(partial = {}) {
  if (!isPlainObject(partial)) {
    throw new RefereeAssignmentContractError(
      REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.NON_DETERMINISTIC_INPUT,
      "Match schedule row must be a plain object",
      {}
    );
  }
  return ownedFreeze({
    matchId: normalizeStableId(partial.matchId, "matchId"),
    startAt: normalizeOptionalInstant(partial.startAt, "startAt"),
    endAt: normalizeOptionalInstant(partial.endAt, "endAt"),
    courtId:
      partial.courtId == null || partial.courtId === ""
        ? null
        : normalizeStableId(partial.courtId, "courtId"),
    divisionId:
      partial.divisionId == null || partial.divisionId === ""
        ? null
        : normalizeStableId(partial.divisionId, "divisionId"),
    participantRefs: Object.freeze(
      Array.isArray(partial.participantRefs)
        ? partial.participantRefs.map((id) => String(id).trim()).filter(Boolean)
        : []
    ),
    teamRefs: Object.freeze(
      Array.isArray(partial.teamRefs)
        ? partial.teamRefs.map((id) => String(id).trim()).filter(Boolean)
        : []
    ),
    clubIds: Object.freeze(
      Array.isArray(partial.clubIds)
        ? partial.clubIds.map((id) => String(id).trim()).filter(Boolean)
        : []
    ),
  });
}

export function createFailClosedMatchScheduleInputPort() {
  return Object.freeze({
    async resolveMatchSchedule(request) {
      return createMissingSnapshotResult(
        "MatchScheduleInputPort denied: entire schedule snapshot missing",
        {
          tenantId: request?.tenantId ?? null,
          tournamentId: request?.tournamentId ?? null,
        }
      );
    },
  });
}

/**
 * @param {'missing'|'invalid'|'empty'|object[]} modeOrItems
 */
export function createFixedMatchScheduleInputPort(modeOrItems) {
  if (modeOrItems === "missing") {
    return createFailClosedMatchScheduleInputPort();
  }
  if (modeOrItems === "invalid") {
    return Object.freeze({
      async resolveMatchSchedule() {
        return createInvalidSnapshotResult(
          "MatchScheduleInputPort: invalid snapshot double"
        );
      },
    });
  }
  if (modeOrItems === "empty") {
    return Object.freeze({
      async resolveMatchSchedule() {
        return createEmptySnapshotResult("Valid empty match schedule");
      },
    });
  }
  const frozen = Object.freeze(
    (Array.isArray(modeOrItems) ? modeOrItems : []).map((row) =>
      createMatchScheduleRow(row)
    )
  );
  return Object.freeze({
    async resolveMatchSchedule() {
      return createPopulatedSnapshotResult(frozen);
    },
  });
}
