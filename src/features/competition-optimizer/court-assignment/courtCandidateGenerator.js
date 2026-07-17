import { createSeededRng, seededShuffle } from "../core/seededRandom.js";
import { cloneCourtAssignments, validateCourtStructure } from "./courtConstraints.js";

function assignCourtForSlot(slotKey, slotUsage, activeCourts) {
  const index = slotUsage.get(slotKey) || 0;
  slotUsage.set(slotKey, index + 1);
  return activeCourts[index % Math.max(1, activeCourts.length)];
}

function slotKeyForRow(row) {
  if (row.slotIndex != null) return `slot:${row.slotIndex}`;
  if (row.scheduledAt) return `at:${row.scheduledAt}`;
  return `round:${row.roundNumber || 0}`;
}

function scheduleRowsToCourtAssignments(rows = [], courts = []) {
  const activeCourts = (courts || []).filter((court) => court.active !== false);
  const slotUsage = new Map();
  return (rows || []).map((row, index) => {
    const key = slotKeyForRow(row);
    const court =
      assignCourtForSlot(key, slotUsage, activeCourts) ||
      activeCourts[index % Math.max(1, activeCourts.length)];
    return {
      id: String(row.id),
      teamAId: String(row.teamAId || ""),
      teamBId: String(row.teamBId || ""),
      slotIndex: row.slotIndex != null ? Number(row.slotIndex) : null,
      scheduledAt: row.scheduledAt || null,
      roundNumber: row.roundNumber,
      courtId: String(court?.id || `court-${(index % Math.max(1, activeCourts.length)) + 1}`),
      courtLabel: court?.label || row.courtLabel || "",
      locked: row.locked === true,
      status: row.status || "",
      requiredCourtId: row.requiredCourtId || "",
    };
  });
}

function firstFit(assignments, courts) {
  const activeCourts = (courts || []).filter((court) => court.active !== false);
  const slotUsage = new Map();
  const next = cloneCourtAssignments(assignments);

  for (const row of next) {
    if (row.locked) continue;
    const key = slotKeyForRow(row);
    const court = assignCourtForSlot(key, slotUsage, activeCourts);
    if (court) {
      row.courtId = String(court.id);
      row.courtLabel = court.label || row.courtLabel;
    }
  }
  return next;
}

function capacityFirst(assignments, courts) {
  const activeCourts = [...(courts || [])]
    .filter((court) => court.active !== false)
    .sort(
      (a, b) =>
        (Number(b.capacity) || 0) - (Number(a.capacity) || 0) ||
        String(a.id).localeCompare(String(b.id))
    );
  return scheduleRowsToCourtAssignments(assignments, activeCourts);
}

/**
 * Generate initial court assignment candidates.
 */
export function generateCourtInitialCandidates(input = {}) {
  const {
    assignments: currentAssignments = [],
    matchups = [],
    scheduleAssignments = [],
    courts = [],
    randomSeed = 1,
    maxCandidates = 150,
  } = input;

  const rng = createSeededRng(randomSeed);
  const sourceRows =
    currentAssignments.length > 0
      ? currentAssignments
      : scheduleAssignments.length > 0
        ? scheduleAssignments
        : matchups;

  const base = scheduleRowsToCourtAssignments(sourceRows, courts);
  const results = [];
  const push = (candidate) => {
    if (!candidate || results.length >= maxCandidates) return;
    const structural = validateCourtStructure({
      assignments: candidate.assignments,
      courts,
      baselineAssignments: base,
    });
    if (structural.ok) results.push(candidate);
  };

  push({ strategy: "current", assignments: base });
  push({ strategy: "first_fit", assignments: firstFit(base, courts) });
  push({ strategy: "capacity_first", assignments: capacityFirst(sourceRows, courts) });

  const mutable = base.filter((row) => !row.locked);
  const activeCourts = (courts || []).filter((court) => court.active !== false);

  for (let i = 0; i < Math.min(50, maxCandidates); i += 1) {
    const shuffledCourts = seededShuffle(activeCourts, rng);
    const next = cloneCourtAssignments(base);
    mutable.forEach((row, index) => {
      const target = next.find((r) => r.id === row.id);
      const court = shuffledCourts[index % Math.max(1, shuffledCourts.length)];
      if (target && court) {
        target.courtId = String(court.id);
        target.courtLabel = court.label || target.courtLabel;
      }
    });
    push({ strategy: `seeded_${i}`, assignments: next });
  }

  return results.slice(0, maxCandidates);
}

export { scheduleRowsToCourtAssignments };
