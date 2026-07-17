function pick(rng, count) {
  return count ? Math.floor(rng() * count) % count : 0;
}

function cloneGroups(groups = []) {
  return groups.map((group) => ({ ...group, teamIds: [...(group.teamIds || [])] }));
}

function swap(next, a, ai, b, bi) {
  [next[a].teamIds[ai], next[b].teamIds[bi]] = [next[b].teamIds[bi], next[a].teamIds[ai]];
  return next;
}

export function mutateGroupDrawCandidate(candidate, rng) {
  const groups = candidate?.groups || [];
  const eligible = groups.map((group, index) => ({ group, index })).filter(({ group }) => group.teamIds?.length);
  if (eligible.length < 2) return null;
  const a = eligible[pick(rng, eligible.length)].index;
  const alternatives = eligible.filter(({ index }) => index !== a);
  const b = alternatives[pick(rng, alternatives.length)]?.index;
  if (b == null) return null;
  const roll = rng();
  const next = cloneGroups(groups);
  if (roll < 0.45) {
    return { strategy: "swap_teams", groups: swap(next, a, pick(rng, next[a].teamIds.length), b, pick(rng, next[b].teamIds.length)) };
  }
  if (roll < 0.7 && eligible.length >= 3) {
    const c = eligible.find(({ index }) => index !== a && index !== b)?.index;
    if (c != null) {
      const ai = pick(rng, next[a].teamIds.length);
      const bi = pick(rng, next[b].teamIds.length);
      const ci = pick(rng, next[c].teamIds.length);
      const held = next[a].teamIds[ai];
      next[a].teamIds[ai] = next[b].teamIds[bi];
      next[b].teamIds[bi] = next[c].teamIds[ci];
      next[c].teamIds[ci] = held;
      return { strategy: "rotate_three_teams", groups: next };
    }
  }
  return {
    strategy: roll < 0.85 ? "swap_within_seed_pot" : "redistribute_high_penalty_groups",
    groups: swap(next, a, 0, b, next[b].teamIds.length - 1),
  };
}
