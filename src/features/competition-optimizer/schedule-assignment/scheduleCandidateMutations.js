import { cloneScheduleAssignments } from "./scheduleConstraints.js";

function pickIndex(rng, count) {
  return count ? Math.floor(rng() * count) % count : 0;
}

/**
 * @param {{ assignments: Array }} candidate
 * @param {() => number} rng
 * @param {object} context
 */
export function mutateScheduleCandidate(candidate, rng, context = {}) {
  const assignments = cloneScheduleAssignments(candidate?.assignments || []);
  const slotCount = Math.max(1, Number(context.slotCount) || 1);
  const mutable = assignments.filter((row) => !row.locked);
  if (mutable.length < 1) return null;

  const roll = rng();

  if (roll < 0.35 && mutable.length >= 2) {
    const a = mutable[pickIndex(rng, mutable.length)];
    let b = mutable[pickIndex(rng, mutable.length - 1)];
    if (b === a) {
      b = mutable[(mutable.indexOf(a) + 1) % mutable.length];
    }
    const next = cloneScheduleAssignments(assignments);
    const ai = next.findIndex((r) => r.id === a.id);
    const bi = next.findIndex((r) => r.id === b.id);
    const temp = next[ai].slotIndex;
    next[ai].slotIndex = next[bi].slotIndex;
    next[bi].slotIndex = temp;
    return { strategy: "swap_two_slots", assignments: next };
  }

  if (roll < 0.65) {
    const target = mutable[pickIndex(rng, mutable.length)];
    const next = cloneScheduleAssignments(assignments);
    const row = next.find((r) => r.id === target.id);
    if (row) {
      row.slotIndex = pickIndex(rng, slotCount);
    }
    return { strategy: "move_one_match", assignments: next };
  }

  if (mutable.length >= 3) {
    const slice = mutable.slice(0, 3);
    const next = cloneScheduleAssignments(assignments);
    const slots = slice.map((m) => next.find((r) => r.id === m.id).slotIndex);
    slice.forEach((m, i) => {
      const row = next.find((r) => r.id === m.id);
      row.slotIndex = slots[(i + 1) % 3];
    });
    return { strategy: "rotate_three", assignments: next };
  }

  const target = mutable[pickIndex(rng, mutable.length)];
  const next = cloneScheduleAssignments(assignments);
  const row = next.find((r) => r.id === target.id);
  if (row) {
    row.slotIndex = (row.slotIndex + 1) % slotCount;
  }
  return { strategy: "fallback_move", assignments: next };
}
