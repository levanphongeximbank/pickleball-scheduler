function pick(rng, count) {
  return count ? Math.floor(rng() * count) % count : 0;
}

function rebuild(members, template = {}) {
  const playerIds = members.map((player) => String(player.id));
  const avgLevel = members.length
    ? members.reduce((sum, player) => sum + Number(player.rating ?? player.level ?? 3.5), 0) / members.length
    : 0;
  return { ...template, playerIds, members: [...members], avgLevel };
}

function cloneTeams(teams = []) {
  return teams.map((team) => rebuild(team.members || [], team));
}

function swapOne(teams, a, b, ai, bi) {
  const next = cloneTeams(teams);
  const left = [...next[a].members];
  const right = [...next[b].members];
  [left[ai], right[bi]] = [right[bi], left[ai]];
  next[a] = rebuild(left, next[a]);
  next[b] = rebuild(right, next[b]);
  return next;
}

/** Seeded doubles-preserving partner mutations. */
export function mutatePartnerPairingCandidate(candidate, rng) {
  const teams = candidate?.teams || [];
  if (teams.length < 2 || teams.some((team) => (team.members || []).length !== 2)) return null;
  const a = pick(rng, teams.length);
  let b = pick(rng, teams.length - 1);
  if (b >= a) b += 1;
  const roll = rng();

  if (roll < 0.3) {
    return { strategy: "swap_partners", teams: swapOne(teams, a, b, 0, 0) };
  }
  if (roll < 0.6) {
    return { strategy: "swap_one_person", teams: swapOne(teams, a, b, pick(rng, 2), pick(rng, 2)) };
  }
  if (roll < 0.82) {
    const next = cloneTeams(teams);
    const people = [...next[a].members, ...next[b].members];
    const rotated = [people[1], people[2], people[3], people[0]];
    next[a] = rebuild(rotated.slice(0, 2), next[a]);
    next[b] = rebuild(rotated.slice(2), next[b]);
    return { strategy: "rotate_four_people", teams: next };
  }

  const ordered = teams
    .map((team, index) => ({ index, avg: Number(team.avgLevel) || 0 }))
    .sort((left, right) => right.avg - left.avg);
  const high = ordered[0]?.index ?? a;
  const low = ordered[ordered.length - 1]?.index ?? b;
  return high === low ? null : {
    strategy: "rebuild_high_penalty_subset",
    teams: swapOne(teams, high, low, 1, 0),
  };
}
