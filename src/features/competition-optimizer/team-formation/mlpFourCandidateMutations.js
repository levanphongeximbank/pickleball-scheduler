import {
  cloneTeams,
  genderOf,
  playerRating,
} from "./mlpFourConstraints.js";

function teamMembers(team, playersById) {
  if (Array.isArray(team.members) && team.members.length) {
    return team.members;
  }
  return (team.playerIds || [])
    .map((id) => playersById[String(id)])
    .filter(Boolean);
}

function rebuildTeam(team, members) {
  const avg =
    members.length === 0
      ? 0
      : Math.round(
          (members.reduce((s, p) => s + playerRating(p), 0) / members.length) *
            100
        ) / 100;
  return {
    ...team,
    playerIds: members.map((p) => String(p.id)),
    members: [...members],
    avgLevel: avg,
  };
}

function pickIndex(rng, count) {
  if (count <= 0) return 0;
  return Math.floor(rng() * count) % count;
}

function swapPlayers(teams, teamA, teamB, playerA, playerB) {
  const next = cloneTeams(teams);
  const membersA = [...(teams[teamA].members || teamMembers(teams[teamA], {}))];
  const membersB = [...(teams[teamB].members || teamMembers(teams[teamB], {}))];
  const idxA = membersA.findIndex((p) => String(p.id) === String(playerA.id));
  const idxB = membersB.findIndex((p) => String(p.id) === String(playerB.id));
  if (idxA < 0 || idxB < 0) return null;
  membersA[idxA] = playerB;
  membersB[idxB] = playerA;
  next[teamA] = rebuildTeam(next[teamA], membersA);
  next[teamB] = rebuildTeam(next[teamB], membersB);
  return next;
}

function gendered(members, gender) {
  return members.filter((p) => genderOf(p) === gender);
}

function meanRating(members = []) {
  if (!members.length) return 0;
  return members.reduce((s, p) => s + playerRating(p), 0) / members.length;
}

/**
 * Seeded mutation preserving 2M+2F.
 * @returns {{ strategy: string, teams: object[] }|null}
 */
export function mutateMlpFourCandidate(candidate, playersById, rng) {
  const teams = (candidate?.teams || []).map((team) => ({
    ...team,
    members: teamMembers(team, playersById),
    playerIds: [...(team.playerIds || [])].map(String),
  }));
  if (teams.length < 2) return null;

  const roll = rng();
  let i = pickIndex(rng, teams.length);
  let j = pickIndex(rng, teams.length);
  if (i === j) j = (j + 1) % teams.length;

  const malesI = gendered(teams[i].members, "male");
  const malesJ = gendered(teams[j].members, "male");
  const femalesI = gendered(teams[i].members, "female");
  const femalesJ = gendered(teams[j].members, "female");

  if (roll < 0.18 && malesI.length && malesJ.length) {
    const next = swapPlayers(
      teams,
      i,
      j,
      malesI[pickIndex(rng, malesI.length)],
      malesJ[pickIndex(rng, malesJ.length)]
    );
    return next ? { strategy: "swap_one_male", teams: next } : null;
  }

  if (roll < 0.36 && femalesI.length && femalesJ.length) {
    const next = swapPlayers(
      teams,
      i,
      j,
      femalesI[pickIndex(rng, femalesI.length)],
      femalesJ[pickIndex(rng, femalesJ.length)]
    );
    return next ? { strategy: "swap_one_female", teams: next } : null;
  }

  if (roll < 0.5 && malesI.length === 2 && malesJ.length === 2) {
    let next = swapPlayers(teams, i, j, malesI[0], malesJ[0]);
    if (!next) return null;
    const mI = gendered(next[i].members, "male");
    const mJ = gendered(next[j].members, "male");
    next = swapPlayers(next, i, j, mI[1] || mI[0], mJ[1] || mJ[0]);
    return next ? { strategy: "swap_male_pair", teams: next } : null;
  }

  if (roll < 0.64 && femalesI.length === 2 && femalesJ.length === 2) {
    let next = swapPlayers(teams, i, j, femalesI[0], femalesJ[0]);
    if (!next) return null;
    const fI = gendered(next[i].members, "female");
    const fJ = gendered(next[j].members, "female");
    next = swapPlayers(next, i, j, fI[1] || fI[0], fJ[1] || fJ[0]);
    return next ? { strategy: "swap_female_pair", teams: next } : null;
  }

  if (
    roll < 0.78 &&
    malesI.length &&
    malesJ.length &&
    femalesI.length &&
    femalesJ.length
  ) {
    let next = swapPlayers(
      teams,
      i,
      j,
      malesI[pickIndex(rng, malesI.length)],
      malesJ[pickIndex(rng, malesJ.length)]
    );
    if (!next) return null;
    const fI = gendered(next[i].members, "female");
    const fJ = gendered(next[j].members, "female");
    next = swapPlayers(
      next,
      i,
      j,
      fI[pickIndex(rng, fI.length)],
      fJ[pickIndex(rng, fJ.length)]
    );
    return next ? { strategy: "swap_male_and_female", teams: next } : null;
  }

  const ranked = [...teams]
    .map((team, index) => ({
      index,
      avg: Number(team.avgLevel) || meanRating(team.members),
    }))
    .sort((a, b) => b.avg - a.avg);
  const strongIdx = ranked[0]?.index;
  const weakIdx = ranked[ranked.length - 1]?.index;
  if (strongIdx != null && weakIdx != null && strongIdx !== weakIdx && roll < 0.9) {
    const sM = gendered(teams[strongIdx].members, "male");
    const wM = gendered(teams[weakIdx].members, "male");
    const sF = gendered(teams[strongIdx].members, "female");
    const wF = gendered(teams[weakIdx].members, "female");
    if (sM.length && wM.length && sF.length && wF.length) {
      let next = swapPlayers(teams, strongIdx, weakIdx, sM[0], wM[wM.length - 1]);
      if (!next) return null;
      const fS = gendered(next[strongIdx].members, "female");
      const fW = gendered(next[weakIdx].members, "female");
      next = swapPlayers(next, strongIdx, weakIdx, fS[0], fW[fW.length - 1]);
      return next ? { strategy: "swap_strong_weak", teams: next } : null;
    }
  }

  if (malesI.length && malesJ.length) {
    const next = swapPlayers(teams, i, j, malesI[0], malesJ[malesJ.length - 1]);
    return next ? { strategy: "swap_high_penalty_proxy", teams: next } : null;
  }

  return null;
}
