import { MATCHUP_STATUS } from "../../team-tournament/constants.js";

const LOCKED_STATUSES = new Set([
  MATCHUP_STATUS.LINEUP_LOCKED,
  MATCHUP_STATUS.IN_PROGRESS,
  MATCHUP_STATUS.COMPLETED,
  "LINEUP_LOCKED",
  "IN_PROGRESS",
  "COMPLETED",
  "STARTED",
]);

export function isLockedAssignment(row = {}, lockedStatuses = LOCKED_STATUSES) {
  if (row.locked === true) return true;
  const status = String(row.status || "");
  return lockedStatuses.has(status) || [...lockedStatuses].some((s) => status.includes(s));
}

/**
 * @param {Array} assignments
 */
export function cloneScheduleAssignments(assignments = []) {
  return (assignments || []).map((row) => ({
    ...row,
    id: String(row.id || ""),
    teamAId: String(row.teamAId || ""),
    teamBId: String(row.teamBId || ""),
    slotIndex: Number(row.slotIndex) >= 0 ? Number(row.slotIndex) : 0,
    roundNumber: Number(row.roundNumber) > 0 ? Number(row.roundNumber) : 0,
    scheduledAt: row.scheduledAt || null,
    locked: row.locked === true,
    status: row.status || "",
  }));
}

function addMinutes(isoString, minutes) {
  if (!isoString) return null;
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return null;
  return new Date(date.getTime() + minutes * 60 * 1000).toISOString();
}

export function slotToScheduledAt(slotIndex, baseScheduledAt, roundIntervalMinutes) {
  const minutes = Number(slotIndex) * (Number(roundIntervalMinutes) || 90);
  return addMinutes(baseScheduledAt, minutes);
}

/**
 * @param {object} input
 */
export function validateScheduleStructure(input = {}) {
  const assignments = cloneScheduleAssignments(input.assignments || []);
  const slotCount = Math.max(1, Number(input.slotCount) || 1);
  const lockedStatuses = input.lockedStatuses || LOCKED_STATUSES;
  const baseline = cloneScheduleAssignments(input.baselineAssignments || []);
  const baselineById = new Map(baseline.map((row) => [row.id, row]));
  const rejectionCodes = [];
  const errors = [];
  const teamSlot = new Map();

  for (const row of assignments) {
    if (row.slotIndex < 0 || row.slotIndex >= slotCount) {
      rejectionCodes.push("SLOT_OUT_OF_BOUNDS");
      errors.push(`Slot ${row.slotIndex} ngoài phạm vi.`);
    }

    const teams = [row.teamAId, row.teamBId].filter(Boolean);
    for (const teamId of teams) {
      const key = `${row.slotIndex}:${teamId}`;
      if (teamSlot.has(key)) {
        rejectionCodes.push("TEAM_DOUBLE_BOOKED_SLOT");
        errors.push(`Đội ${teamId} trùng slot ${row.slotIndex}.`);
      }
      teamSlot.set(key, row.id);
    }

    if (isLockedAssignment(row, lockedStatuses)) {
      const base = baselineById.get(row.id);
      if (base && base.slotIndex !== row.slotIndex) {
        rejectionCodes.push("LOCKED_SLOT_CHANGED");
        errors.push(`Trận khóa ${row.id} đổi slot.`);
      }
    }
  }

  return {
    ok: rejectionCodes.length === 0,
    rejectionCodes: [...new Set(rejectionCodes)],
    errors,
  };
}
