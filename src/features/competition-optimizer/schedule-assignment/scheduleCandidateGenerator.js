import { createSeededRng, seededShuffle } from "../core/seededRandom.js";
import {
  cloneScheduleAssignments,
  slotToScheduledAt,
  validateScheduleStructure,
} from "./scheduleConstraints.js";

function matchupsToAssignments(matchups = [], options = {}) {
  const slotByRound = new Map();
  let slotCursor = 0;
  const sorted = [...matchups].sort((a, b) => {
    const roundDiff = (Number(a.roundNumber) || 0) - (Number(b.roundNumber) || 0);
    if (roundDiff !== 0) return roundDiff;
    return (Number(a.matchNumberInRound) || 0) - (Number(b.matchNumberInRound) || 0);
  });

  return sorted.map((matchup) => {
    const round = Number(matchup.roundNumber) || 1;
    if (!slotByRound.has(round)) {
      slotByRound.set(round, slotCursor);
      slotCursor += 1;
    }
    const slotIndex = slotByRound.get(round);
    return {
      id: String(matchup.id),
      teamAId: String(matchup.teamAId),
      teamBId: String(matchup.teamBId),
      roundNumber: round,
      slotIndex,
      scheduledAt:
        matchup.scheduledAt ||
        slotToScheduledAt(
          slotIndex,
          options.baseScheduledAt,
          options.roundIntervalMinutes
        ),
      locked: matchup.locked === true,
      status: matchup.status || "",
    };
  });
}

function earliestAvailable(assignments, slotCount) {
  const teamLastSlot = new Map();
  const next = cloneScheduleAssignments(assignments);
  const sorted = [...next].sort((a, b) => String(a.id).localeCompare(String(b.id)));

  for (const row of sorted) {
    if (row.locked) continue;
    let slot = 0;
    const teams = [row.teamAId, row.teamBId];
    while (slot < slotCount) {
      const busy = teams.some((teamId) => teamLastSlot.get(`${teamId}:${slot}`));
      if (!busy) break;
      slot += 1;
    }
    row.slotIndex = Math.min(slot, slotCount - 1);
    teams.forEach((teamId) => teamLastSlot.set(`${teamId}:${row.slotIndex}`, true));
  }
  return sorted;
}

function roundFirst(assignments) {
  return cloneScheduleAssignments(assignments).map((row) => ({
    ...row,
    slotIndex: Math.max(0, (Number(row.roundNumber) || 1) - 1),
  }));
}

/**
 * Generate initial schedule assignment candidates.
 */
export function generateScheduleInitialCandidates(input = {}) {
  const {
    matchups = [],
    assignments: currentAssignments = [],
    slotCount = 1,
    baseScheduledAt = null,
    roundIntervalMinutes = 90,
    lockedStatuses,
    randomSeed = 1,
    maxCandidates = 250,
  } = input;

  const rng = createSeededRng(randomSeed);
  const base =
    currentAssignments.length > 0
      ? cloneScheduleAssignments(currentAssignments)
      : matchupsToAssignments(matchups, { baseScheduledAt, roundIntervalMinutes });

  const results = [];
  const push = (candidate) => {
    if (!candidate || results.length >= maxCandidates) return;
    const structural = validateScheduleStructure({
      assignments: candidate.assignments,
      slotCount,
      lockedStatuses,
      baselineAssignments: base,
    });
    if (structural.ok) results.push(candidate);
  };

  push({ strategy: "current", assignments: base });
  push({ strategy: "earliest_available", assignments: earliestAvailable(base, slotCount) });
  push({ strategy: "round_first", assignments: roundFirst(base) });

  const mutable = base.filter((row) => !row.locked);
  for (let i = 0; i < Math.min(60, maxCandidates); i += 1) {
    const shuffled = seededShuffle(mutable, rng);
    const slotMap = new Map();
    let cursor = 0;
    const next = cloneScheduleAssignments(base);
    for (const row of shuffled) {
      if (row.locked) continue;
      while (cursor < slotCount && [...slotMap.values()].includes(cursor)) {
        cursor += 1;
      }
      const target = next.find((r) => r.id === row.id);
      if (target) {
        target.slotIndex = Math.min(cursor, slotCount - 1);
        slotMap.set(row.id, target.slotIndex);
      }
      cursor += 1;
    }
    push({ strategy: `seeded_shuffle_${i}`, assignments: next });
  }

  return results.slice(0, maxCandidates);
}

export { matchupsToAssignments };
