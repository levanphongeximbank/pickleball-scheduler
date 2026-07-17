import { cloneCourtAssignments } from "./courtConstraints.js";

function pickIndex(rng, count) {
  return count ? Math.floor(rng() * count) % count : 0;
}

/**
 * @param {{ assignments: Array }} candidate
 * @param {() => number} rng
 * @param {object} context
 */
export function mutateCourtCandidate(candidate, rng, context = {}) {
  const assignments = cloneCourtAssignments(candidate?.assignments || []);
  const courts = (context.courts || []).filter((court) => court.active !== false);
  if (!courts.length) return null;

  const mutable = assignments.filter((row) => !row.locked);
  if (!mutable.length) return null;

  const roll = rng();

  if (roll < 0.35 && mutable.length >= 2) {
    const slotGroups = new Map();
    for (const row of mutable) {
      const key = row.slotIndex != null ? `s:${row.slotIndex}` : `t:${row.scheduledAt}`;
      if (!slotGroups.has(key)) slotGroups.set(key, []);
      slotGroups.get(key).push(row);
    }
    const sameSlot = [...slotGroups.values()].find((group) => group.length >= 2);
    if (sameSlot) {
      const a = sameSlot[pickIndex(rng, sameSlot.length)];
      let b = sameSlot[pickIndex(rng, sameSlot.length - 1)];
      if (b === a) {
        b = sameSlot[(sameSlot.indexOf(a) + 1) % sameSlot.length];
      }
      const next = cloneCourtAssignments(assignments);
      const ai = next.findIndex((r) => r.id === a.id);
      const bi = next.findIndex((r) => r.id === b.id);
      const tempCourt = next[ai].courtId;
      const tempLabel = next[ai].courtLabel;
      next[ai].courtId = next[bi].courtId;
      next[ai].courtLabel = next[bi].courtLabel;
      next[bi].courtId = tempCourt;
      next[bi].courtLabel = tempLabel;
      return { strategy: "swap_courts_same_slot", assignments: next };
    }
  }

  if (roll < 0.65) {
    const target = mutable[pickIndex(rng, mutable.length)];
    const court = courts[pickIndex(rng, courts.length)];
    const next = cloneCourtAssignments(assignments);
    const row = next.find((r) => r.id === target.id);
    if (row && court) {
      row.courtId = String(court.id);
      row.courtLabel = court.label || row.courtLabel;
    }
    return { strategy: "move_match", assignments: next };
  }

  if (mutable.length >= 3) {
    const slice = mutable.slice(0, 3);
    const next = cloneCourtAssignments(assignments);
    const courtIds = slice.map((m) => next.find((r) => r.id === m.id).courtId);
    const labels = slice.map((m) => next.find((r) => r.id === m.id).courtLabel);
    slice.forEach((m, i) => {
      const row = next.find((r) => r.id === m.id);
      row.courtId = courtIds[(i + 1) % 3];
      row.courtLabel = labels[(i + 1) % 3];
    });
    return { strategy: "rotate_three", assignments: next };
  }

  const target = mutable[pickIndex(rng, mutable.length)];
  const court = courts[pickIndex(rng, courts.length)];
  const next = cloneCourtAssignments(assignments);
  const row = next.find((r) => r.id === target.id);
  if (row && court) {
    row.courtId = String(court.id);
    row.courtLabel = court.label || row.courtLabel;
  }
  return { strategy: "fallback_move", assignments: next };
}
