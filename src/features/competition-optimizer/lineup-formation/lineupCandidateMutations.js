import { cloneLineupSelections } from "./lineupConstraints.js";

function pickIndex(rng, count) {
  return count ? Math.floor(rng() * count) % count : 0;
}

/**
 * Seeded mutations preserving discipline slots.
 * @param {{ selections: Record<string, string[]>, allowReuse?: boolean }} candidate
 * @param {() => number} rng
 * @param {object} context
 */
export function mutateLineupCandidate(candidate, rng, context = {}) {
  const selections = cloneLineupSelections(candidate?.selections || {});
  const disciplineIds = Object.keys(selections);
  if (disciplineIds.length === 0) return null;

  const teamIds = (context.team?.playerIds || []).map(String);
  if (teamIds.length < 2) return null;

  const allowReuse = candidate.allowReuse === true || context.allowReuse === true;
  const roll = rng();

  if (roll < 0.28 && disciplineIds.length >= 2) {
    const a = disciplineIds[pickIndex(rng, disciplineIds.length)];
    let b = disciplineIds[pickIndex(rng, disciplineIds.length - 1)];
    if (b === a) {
      b = disciplineIds[(disciplineIds.indexOf(a) + 1) % disciplineIds.length];
    }
    const ai = pickIndex(rng, selections[a].length);
    const bi = pickIndex(rng, selections[b].length);
    const next = cloneLineupSelections(selections);
    [next[a][ai], next[b][bi]] = [next[b][bi], next[a][ai]];
    return { strategy: "swap_across_disciplines", selections: next, allowReuse };
  }

  if (roll < 0.5) {
    const d = disciplineIds[pickIndex(rng, disciplineIds.length)];
    if (selections[d].length >= 2) {
      const next = cloneLineupSelections(selections);
      const i = pickIndex(rng, next[d].length);
      let j = pickIndex(rng, next[d].length - 1);
      if (j >= i) j += 1;
      [next[d][i], next[d][j]] = [next[d][j], next[d][i]];
      return { strategy: "swap_partner", selections: next, allowReuse };
    }
  }

  if (roll < 0.72) {
    const d = disciplineIds[pickIndex(rng, disciplineIds.length)];
    const used = new Set(
      Object.entries(selections)
        .filter(([id]) => id !== d || allowReuse)
        .flatMap(([, ids]) => ids)
    );
    const bench = teamIds.filter((id) => allowReuse || !used.has(id));
    if (!bench.length || !selections[d].length) return null;
    const next = cloneLineupSelections(selections);
    const slot = pickIndex(rng, next[d].length);
    next[d][slot] = bench[pickIndex(rng, bench.length)];
    return { strategy: "replace_with_bench", selections: next, allowReuse };
  }

  if (roll < 0.88 && disciplineIds.length >= 2) {
    const a = disciplineIds[pickIndex(rng, disciplineIds.length)];
    let b = disciplineIds[pickIndex(rng, disciplineIds.length - 1)];
    if (b === a) {
      b = disciplineIds[(disciplineIds.indexOf(a) + 1) % disciplineIds.length];
    }
    const next = cloneLineupSelections(selections);
    [next[a], next[b]] = [next[b], next[a]];
    return { strategy: "swap_two_slots", selections: next, allowReuse };
  }

  // Rotate three players across first three disciplines when available
  if (disciplineIds.length >= 3) {
    const ids = disciplineIds.slice(0, 3);
    const next = cloneLineupSelections(selections);
    const heads = ids.map((id) => next[id][0]);
    next[ids[0]][0] = heads[1];
    next[ids[1]][0] = heads[2];
    next[ids[2]][0] = heads[0];
    return { strategy: "rotate_three", selections: next, allowReuse };
  }

  return null;
}
