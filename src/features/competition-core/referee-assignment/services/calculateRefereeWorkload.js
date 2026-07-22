/**
 * calculateRefereeWorkload — deterministic workload from assignments + schedule.
 *
 * fairnessDelta =
 *   abs(activeAssignmentCount * refereePopulationSize - totalActiveAssignmentCount)
 * fairnessScale = refereePopulationSize
 *
 * Symmetric around the exact population mean without floating-point mean.
 */

import { REFEREE_ASSIGNMENT_STATUS } from "../enums/assignmentStatus.js";
import { createRefereeWorkload } from "../contracts/refereeWorkload.js";
import { ownedFreeze } from "../contracts/shared.js";
import { compareStableString } from "../deterministic/compare.js";
import { durationMinutes, tryHalfOpenWindow } from "./timeModel.js";
import { isActiveAssignmentStatus } from "./conflictPolicyNormalize.js";

/**
 * @param {object} input
 */
export function calculateRefereeWorkload(input = {}) {
  const assignments = Array.isArray(input.assignments) ? input.assignments : [];
  const scheduleRows = Array.isArray(input.scheduleRows)
    ? input.scheduleRows
    : [];
  const scheduleById = new Map();
  for (const row of scheduleRows) {
    if (row?.matchId) scheduleById.set(String(row.matchId), row);
  }

  const consecutiveGapMinutes =
    typeof input.consecutiveGapMinutesThreshold === "number" &&
    Number.isInteger(input.consecutiveGapMinutesThreshold) &&
    input.consecutiveGapMinutesThreshold >= 0
      ? input.consecutiveGapMinutesThreshold
      : 30;

  const historyByReferee = new Map();
  if (Array.isArray(input.historyWorkloads)) {
    for (const h of input.historyWorkloads) {
      if (!h?.refereeId) continue;
      const id = String(h.refereeId);
      const count =
        typeof h.historicalAssignmentCount === "number"
          ? h.historicalAssignmentCount
          : typeof h.assignmentCount === "number"
            ? h.assignmentCount
            : 0;
      historyByReferee.set(id, count);
    }
  }

  /** @type {Map<string, object[]>} */
  const byReferee = new Map();
  for (const asg of assignments) {
    if (!asg?.refereeId) continue;
    const id = String(asg.refereeId);
    if (!byReferee.has(id)) byReferee.set(id, []);
    byReferee.get(id).push(asg);
  }

  // Population may include zero-assignment referees
  if (Array.isArray(input.populationRefereeIds)) {
    for (const id of input.populationRefereeIds) {
      const rid = String(id || "").trim();
      if (rid && !byReferee.has(rid)) byReferee.set(rid, []);
    }
  }

  const populationIds = [...byReferee.keys()].sort(compareStableString);
  const fairnessScale = populationIds.length;

  /** @type {Map<string, number>} */
  const activeCounts = new Map();
  let totalActiveAssignmentCount = 0;
  for (const refereeId of populationIds) {
    const list = byReferee.get(refereeId) || [];
    const active = list.filter((a) =>
      isActiveAssignmentStatus(a.status || REFEREE_ASSIGNMENT_STATUS.PLANNED)
    );
    activeCounts.set(refereeId, active.length);
    totalActiveAssignmentCount += active.length;
  }

  // Output filter (fairness still uses full population)
  let outputIds = populationIds;
  if (input.refereeId) {
    const only = String(input.refereeId);
    if (!byReferee.has(only)) byReferee.set(only, []);
    outputIds = [only];
    if (!activeCounts.has(only)) {
      activeCounts.set(only, 0);
    }
  }

  const workloads = outputIds.map((refereeId) => {
    const list = byReferee.get(refereeId) || [];
    const planned = list.filter(
      (a) => a.status === REFEREE_ASSIGNMENT_STATUS.PLANNED
    );
    const confirmed = list.filter(
      (a) => a.status === REFEREE_ASSIGNMENT_STATUS.CONFIRMED
    );
    const active = list.filter((a) =>
      isActiveAssignmentStatus(a.status || REFEREE_ASSIGNMENT_STATUS.PLANNED)
    );

    /** @type {Record<string, number>} */
    const roleCounts = {};
    for (const a of active) {
      const role = String(a.roleCode || "UNKNOWN");
      roleCounts[role] = (roleCounts[role] || 0) + 1;
    }
    const sortedRoleCounts = {};
    for (const key of Object.keys(roleCounts).sort(compareStableString)) {
      sortedRoleCounts[key] = roleCounts[key];
    }

    const timed = [];
    for (const a of active) {
      const row = scheduleById.get(String(a.matchId)) || a;
      const window = tryHalfOpenWindow(row.startAt, row.endAt, "workload");
      if (!window) continue;
      timed.push({
        matchId: String(a.matchId),
        startMs: window.startMs,
        endMs: window.endMs,
        courtId:
          row.courtId == null || row.courtId === ""
            ? null
            : String(row.courtId),
      });
    }
    timed.sort((a, b) => {
      const c = a.startMs - b.startMs;
      if (c !== 0) return c;
      return compareStableString(a.matchId, b.matchId);
    });

    let minutesAssigned = 0;
    for (const t of timed) {
      minutesAssigned += durationMinutes(t.startMs, t.endMs);
    }

    let consecutiveMatchCount = 0;
    let courtTransitionCount = 0;
    for (let i = 1; i < timed.length; i += 1) {
      const prev = timed[i - 1];
      const cur = timed[i];
      const gapMinutes = Math.floor((cur.startMs - prev.endMs) / 60000);
      if (gapMinutes >= 0 && gapMinutes <= consecutiveGapMinutes) {
        consecutiveMatchCount += 1;
      }
      if (
        prev.courtId != null &&
        cur.courtId != null &&
        prev.courtId !== cur.courtId &&
        gapMinutes >= 0 &&
        gapMinutes <= consecutiveGapMinutes
      ) {
        courtTransitionCount += 1;
      }
    }

    const assignmentCount = activeCounts.get(refereeId) ?? active.length;
    const fairnessDelta =
      fairnessScale === 0
        ? 0
        : Math.abs(
            assignmentCount * fairnessScale - totalActiveAssignmentCount
          );
    const historicalAssignmentCount = historyByReferee.has(refereeId)
      ? historyByReferee.get(refereeId)
      : null;

    return createRefereeWorkload({
      refereeId,
      assignmentCount,
      plannedAssignmentCount: planned.length,
      confirmedAssignmentCount: confirmed.length,
      minutesAssigned,
      consecutiveMatchCount,
      courtTransitionCount,
      fairnessDelta,
      fairnessScale,
      roleCounts: sortedRoleCounts,
      historicalAssignmentCount,
    });
  });

  return ownedFreeze({
    workloads: Object.freeze(workloads),
    fairnessScale,
    workloadCohortSize: fairnessScale,
    totalActiveAssignmentCount,
    consecutiveGapMinutesThreshold: consecutiveGapMinutes,
  });
}
