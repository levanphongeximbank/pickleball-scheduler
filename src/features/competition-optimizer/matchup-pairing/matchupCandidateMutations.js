import { cloneMatchups } from "./matchupConstraints.js";

function pickIndex(rng, count) {
  return count ? Math.floor(rng() * count) % count : 0;
}

function pairKey(teamAId, teamBId) {
  return [String(teamAId), String(teamBId)].sort().join("-");
}

/**
 * @param {{ matchups: Array }} candidate
 * @param {() => number} rng
 * @param {object} context
 */
export function mutateMatchupCandidate(candidate, rng, context = {}) {
  const matchups = cloneMatchups(candidate?.matchups || []);
  if (matchups.length < 1) return null;

  const locked = new Set((context.lockedMatchupIds || []).map(String));
  const mutable = matchups.filter((m) => !locked.has(String(m.id)));
  if (!mutable.length) return null;

  const roll = rng();

  if (roll < 0.28 && mutable.length >= 2) {
    const a = mutable[pickIndex(rng, mutable.length)];
    let b = mutable[pickIndex(rng, mutable.length - 1)];
    if (b === a) {
      b = mutable[(mutable.indexOf(a) + 1) % mutable.length];
    }
    if (a.roundNumber === b.roundNumber) {
      const next = cloneMatchups(matchups);
      const ai = next.findIndex((m) => m.id === a.id);
      const bi = next.findIndex((m) => m.id === b.id);
      const tempA = next[ai].teamBId;
      const tempB = next[bi].teamBId;
      next[ai].teamBId = tempB;
      next[bi].teamBId = tempA;
      return { strategy: "swap_opponents", matchups: next };
    }
  }

  if (roll < 0.5) {
    const target = mutable[pickIndex(rng, mutable.length)];
    const next = cloneMatchups(matchups);
    const index = next.findIndex((m) => m.id === target.id);
    next[index] = {
      ...next[index],
      teamAId: next[index].teamBId,
      teamBId: next[index].teamAId,
    };
    return { strategy: "swap_one_side", matchups: next };
  }

  if (roll < 0.72 && mutable.length >= 3) {
    const slice = mutable.slice(0, 3);
    const next = cloneMatchups(matchups);
    const teamAIds = slice.map((m) => {
      const row = next.find((r) => r.id === m.id);
      return row.teamAId;
    });
    slice.forEach((m, i) => {
      const row = next.find((r) => r.id === m.id);
      row.teamAId = teamAIds[(i + 1) % 3];
    });
    return { strategy: "rotate_three_teams", matchups: next };
  }

  // Rebuild high-rematch subset by flipping sides on duplicate pairs
  const counts = new Map();
  matchups.forEach((m) => {
    const key = pairKey(m.teamAId, m.teamBId);
    counts.set(key, (counts.get(key) || 0) + 1);
  });
  const rematchRows = mutable.filter((m) => counts.get(pairKey(m.teamAId, m.teamBId)) > 1);
  if (rematchRows.length) {
    const target = rematchRows[pickIndex(rng, rematchRows.length)];
    const next = cloneMatchups(matchups);
    const row = next.find((m) => m.id === target.id);
    if (row) {
      row.teamAId = target.teamBId;
      row.teamBId = target.teamAId;
    }
    return { strategy: "rebuild_high_rematch", matchups: next };
  }

  const target = mutable[pickIndex(rng, mutable.length)];
  const next = cloneMatchups(matchups);
  const row = next.find((m) => m.id === target.id);
  if (row) {
    row.teamAId = target.teamBId;
    row.teamBId = target.teamAId;
  }
  return { strategy: "fallback_flip", matchups: next };
}
