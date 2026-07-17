import { getPlayerGenderKey, getPlayerRatingInternal } from "../../../models/player.js";

export const MLP4_MEMBERS = 4;
export const MLP4_MALES = 2;
export const MLP4_FEMALES = 2;

export function playerRating(player) {
  return Number(getPlayerRatingInternal(player)) || 0;
}

export function genderOf(player) {
  return getPlayerGenderKey(player?.gender ?? player);
}

/**
 * Structural MLP 4 validation (before private-pairing hard rules).
 * @returns {{ ok: boolean, codes: string[], hardViolationCount: number }}
 */
export function validateMlpFourStructure(teams = [], {
  expectedTeamCount = null,
  playersById = {},
} = {}) {
  const codes = [];
  const seen = new Set();

  if (
    expectedTeamCount != null &&
    Number(expectedTeamCount) > 0 &&
    teams.length !== Number(expectedTeamCount)
  ) {
    codes.push("TEAM_COUNT_MISMATCH");
  }

  for (const team of teams) {
    const ids = (team.playerIds || []).map(String);
    if (ids.length !== MLP4_MEMBERS) {
      codes.push("TEAM_SIZE_INVALID");
    }
    let males = 0;
    let females = 0;
    for (const id of ids) {
      if (seen.has(id)) codes.push("DUPLICATE_PLAYER");
      seen.add(id);
      const player = playersById[id] || playersById[String(id)];
      const g = genderOf(player);
      if (g === "male") males += 1;
      else if (g === "female") females += 1;
      else codes.push("UNKNOWN_GENDER");
    }
    if (males !== MLP4_MALES || females !== MLP4_FEMALES) {
      codes.push("GENDER_COMPOSITION_INVALID");
    }
  }

  const uniqueCodes = [...new Set(codes)];
  return {
    ok: uniqueCodes.length === 0,
    codes: uniqueCodes,
    hardViolationCount: uniqueCodes.length,
  };
}

/**
 * Block pool-level formation requests that cannot fill exact team count.
 */
export function assertMlpFourPoolCapacity({
  males = [],
  females = [],
  unknown = [],
  teamCount,
}) {
  const codes = [];
  if ((unknown || []).length > 0) codes.push("UNKNOWN_GENDER_IN_POOL");
  const needM = Number(teamCount) * MLP4_MALES;
  const needF = Number(teamCount) * MLP4_FEMALES;
  if (males.length < needM) codes.push("INSUFFICIENT_MALES");
  if (females.length < needF) codes.push("INSUFFICIENT_FEMALES");
  return {
    ok: codes.length === 0,
    codes,
    requiredMales: needM,
    requiredFemales: needF,
  };
}

/**
 * Convert buckets (arrays of player objects) → team payload with playerIds.
 */
export function bucketsToTeamPayload(buckets = [], teamNames = []) {
  return buckets.map((roster, index) => {
    const ids = (roster || []).map((p) => String(p.id));
    const avg =
      roster.length === 0
        ? 0
        : Math.round(
            (roster.reduce((s, p) => s + playerRating(p), 0) / roster.length) *
              100
          ) / 100;
    return {
      name: teamNames[index] || `Đội ${index + 1}`,
      playerIds: ids,
      avgLevel: avg,
      members: [...roster],
    };
  });
}

export function cloneTeams(teams = []) {
  return (teams || []).map((team) => ({
    ...team,
    playerIds: [...(team.playerIds || [])].map(String),
    members: team.members ? [...team.members] : undefined,
  }));
}
