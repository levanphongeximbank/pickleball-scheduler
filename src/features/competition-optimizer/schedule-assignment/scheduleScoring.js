/**
 * Default soft scoring for schedule assignment (lower is better).
 */

function teamSlots(assignments = []) {
  const map = new Map();
  for (const row of assignments) {
    for (const teamId of [row.teamAId, row.teamBId]) {
      if (!teamId) continue;
      const key = String(teamId);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(Number(row.slotIndex) || 0);
    }
  }
  return map;
}

/**
 * @param {Array} assignments
 * @param {object} [options]
 */
export function computeScheduleDefaultPenalty(assignments = [], options = {}) {
  const rows = assignments || [];
  const slotsByTeam = teamSlots(rows);
  const slotCounts = rows.map((row) => Number(row.slotIndex) || 0);
  const minSlot = slotCounts.length ? Math.min(...slotCounts) : 0;
  const maxSlot = slotCounts.length ? Math.max(...slotCounts) : 0;
  const earlyLateImbalance = (maxSlot - minSlot) * 8;

  let waitVariancePenalty = 0;
  for (const slots of slotsByTeam.values()) {
    if (slots.length < 2) continue;
    const sorted = [...slots].sort((a, b) => a - b);
    const gaps = [];
    for (let i = 1; i < sorted.length; i += 1) {
      gaps.push(sorted[i] - sorted[i - 1]);
    }
    if (gaps.length) {
      const avg = gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length;
      const variance = gaps.reduce((sum, gap) => sum + (gap - avg) ** 2, 0) / gaps.length;
      waitVariancePenalty += variance * 12;
    }
  }

  const roundSpreadPenalty = rows.reduce((sum, row) => {
    const round = Number(row.roundNumber) || 0;
    const slot = Number(row.slotIndex) || 0;
    return sum + Math.abs(round - 1 - slot) * 3;
  }, 0);

  const preferredSlot = Number(options.preferredFirstSlot) || 0;
  const frontLoadPenalty = rows.reduce(
    (sum, row) => sum + Math.abs((Number(row.slotIndex) || 0) - preferredSlot) * 2,
    0
  );

  return waitVariancePenalty + earlyLateImbalance + roundSpreadPenalty + frontLoadPenalty;
}

export function computeScheduleFairnessMetrics(assignments = []) {
  const slotsByTeam = teamSlots(assignments);
  const gaps = [];
  for (const slots of slotsByTeam.values()) {
    const sorted = [...slots].sort((a, b) => a - b);
    for (let i = 1; i < sorted.length; i += 1) {
      gaps.push(sorted[i] - sorted[i - 1]);
    }
  }
  return {
    teamCount: slotsByTeam.size,
    avgRestGap:
      gaps.length > 0 ? gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length : 0,
    assignmentCount: (assignments || []).length,
  };
}
