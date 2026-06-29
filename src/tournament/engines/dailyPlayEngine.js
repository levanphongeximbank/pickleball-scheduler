import { runAI } from "../../ai/engine.js";
import {
  getEligiblePlayersForCompetition,
  getGenderCounts,
} from "../../ai/competition.js";
import { getPlayerGenderKey } from "../../models/player.js";
import { MATCH_STATUS } from "../../models/tournament/constants.js";
import {
  assignMatchToCourt,
  buildCourtRuntimeStates,
  releaseCourt,
  setCourtLocked,
} from "./courtEngine.js";
import { startMatch, submitMatchScore } from "./matchEngine.js";

export const DAILY_MATCH_TYPE = {
  MEN_DOUBLE: "men_double",
  WOMEN_DOUBLE: "women_double",
  MIXED_DOUBLE: "mixed_double",
  AUTO: "auto",
};

export const DAILY_GENDER_FILTER = {
  ALL: "all",
  MALE: "male",
  FEMALE: "female",
};

const ACTIVE_MATCH_STATUSES = new Set([
  MATCH_STATUS.WAITING,
  MATCH_STATUS.ASSIGNED,
  MATCH_STATUS.PLAYING,
]);

const MATCH_TYPE_TO_COMPETITION = {
  [DAILY_MATCH_TYPE.MEN_DOUBLE]: "doubles_men",
  [DAILY_MATCH_TYPE.WOMEN_DOUBLE]: "doubles_women",
  [DAILY_MATCH_TYPE.MIXED_DOUBLE]: "doubles_mixed",
};

function playerRating(player) {
  return Number(player?.rating ?? player?.level ?? 3.5);
}

function buildTeamLabel(players = []) {
  return players
    .map((player) => String(player?.name || "").trim())
    .filter(Boolean)
    .join(" / ");
}

export function getDefaultDailyPlaySettings() {
  return {
    checkedInPlayerIds: [],
    matchType: DAILY_MATCH_TYPE.MIXED_DOUBLE,
    genderFilter: DAILY_GENDER_FILTER.ALL,
    enabledCourtIds: [],
    matches: [],
    skipScore: false,
  };
}

export function normalizeDailyPlaySettings(settings = {}) {
  const defaults = getDefaultDailyPlaySettings();
  return {
    ...defaults,
    ...settings,
    checkedInPlayerIds: Array.isArray(settings.checkedInPlayerIds)
      ? settings.checkedInPlayerIds.map((id) => String(id))
      : [],
    enabledCourtIds: Array.isArray(settings.enabledCourtIds)
      ? settings.enabledCourtIds.map((id) => String(id))
      : [],
    matches: Array.isArray(settings.matches) ? settings.matches : [],
  };
}

export function toggleDailyCheckIn(settings, playerId) {
  const normalized = normalizeDailyPlaySettings(settings);
  const key = String(playerId);
  const checked = new Set(normalized.checkedInPlayerIds);

  if (checked.has(key)) {
    checked.delete(key);
  } else {
    checked.add(key);
  }

  return {
    ...normalized,
    checkedInPlayerIds: Array.from(checked),
  };
}

export function getBusyPlayerIdsFromDailyMatches(matches = []) {
  const busy = new Set();

  matches.forEach((match) => {
    if (!ACTIVE_MATCH_STATUSES.has(match.status)) {
      return;
    }

    [...(match.teamAPlayerIds || []), ...(match.teamBPlayerIds || [])].forEach((id) => {
      if (id) {
        busy.add(String(id));
      }
    });
  });

  return busy;
}

export function filterPlayersByGender(players = [], genderFilter = DAILY_GENDER_FILTER.ALL) {
  if (genderFilter === DAILY_GENDER_FILTER.ALL) {
    return players;
  }

  return players.filter((player) => getPlayerGenderKey(player.gender) === genderFilter);
}

export function resolveDailyCompetitionType(matchType, players = []) {
  if (MATCH_TYPE_TO_COMPETITION[matchType]) {
    return MATCH_TYPE_TO_COMPETITION[matchType];
  }

  const counts = getGenderCounts(players);

  if (counts.male >= 4 && counts.female < 2) {
    return "doubles_men";
  }

  if (counts.female >= 4 && counts.male < 2) {
    return "doubles_women";
  }

  if (counts.male >= 2 && counts.female >= 2) {
    return "doubles_mixed";
  }

  if (counts.male >= 4) {
    return "doubles_men";
  }

  if (counts.female >= 4) {
    return "doubles_women";
  }

  return "doubles_mixed";
}

export function getEligibleDailyPlayers({
  players = [],
  settings = {},
} = {}) {
  const normalized = normalizeDailyPlaySettings(settings);
  const checkedIn = new Set(normalized.checkedInPlayerIds);
  const busy = getBusyPlayerIdsFromDailyMatches(normalized.matches);

  const checkedPlayers = players.filter((player) => checkedIn.has(String(player.id)));
  const filtered = filterPlayersByGender(checkedPlayers, normalized.genderFilter);
  const available = filtered.filter((player) => !busy.has(String(player.id)));

  const competitionType = resolveDailyCompetitionType(
    normalized.matchType,
    available
  );

  return getEligiblePlayersForCompetition(available, competitionType);
}

function pickPlayersForSingleMatch(available = [], competitionType) {
  if (competitionType === "doubles_mixed") {
    const males = available.filter(
      (player) => getPlayerGenderKey(player.gender) === "male"
    );
    const females = available.filter(
      (player) => getPlayerGenderKey(player.gender) === "female"
    );

    if (males.length < 2 || females.length < 2) {
      return [];
    }

    return [males[0], females[0], males[1], females[1]];
  }

  if (competitionType === "doubles_men") {
    const males = available.filter(
      (player) => getPlayerGenderKey(player.gender) === "male"
    );
    return males.slice(0, 4);
  }

  if (competitionType === "doubles_women") {
    const females = available.filter(
      (player) => getPlayerGenderKey(player.gender) === "female"
    );
    return females.slice(0, 4);
  }

  return available.slice(0, 4);
}

function courtResultToDailyMatch(courtResult, options = {}) {
  const teamA = courtResult.teamA || [];
  const teamB = courtResult.teamB || [];

  return {
    id: options.id || `daily-match-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    tournamentId: options.tournamentId || "",
    status: MATCH_STATUS.WAITING,
    courtId: null,
    teamAPlayerIds: teamA.map((player) => String(player.id)),
    teamBPlayerIds: teamB.map((player) => String(player.id)),
    teamALabel: buildTeamLabel(teamA),
    teamBLabel: buildTeamLabel(teamB),
    teamATotal: courtResult.teamATotal ?? teamA.reduce((sum, p) => sum + playerRating(p), 0),
    teamBTotal: courtResult.teamBTotal ?? teamB.reduce((sum, p) => sum + playerRating(p), 0),
    diff: courtResult.diff ?? 0,
    competitionType: options.competitionType || "doubles_mixed",
    scoreA: null,
    scoreB: null,
    skipScore: options.skipScore === true,
    createdAt: new Date().toISOString(),
  };
}

export function createFairDailyMatches({
  players = [],
  settings = {},
  tournamentId = "",
  matchCount = 1,
  skipScore = false,
} = {}) {
  const normalized = normalizeDailyPlaySettings(settings);
  const eligible = getEligibleDailyPlayers({ players, settings: normalized });
  const competitionType = resolveDailyCompetitionType(
    normalized.matchType,
    eligible
  );

  if (eligible.length < 4) {
    return {
      ok: false,
      error: "Khong du VDV check-in de tao tran.",
      competitionType,
    };
  }

  const playersPerCourt = 4;
  const maxMatches = Math.max(1, Number(matchCount) || 1);
  const createdMatches = [];
  let remaining = [...eligible];

  for (let index = 0; index < maxMatches; index += 1) {
    const selectedPlayers = pickPlayersForSingleMatch(remaining, competitionType);

    if (selectedPlayers.length < playersPerCourt) {
      break;
    }

    const virtualCourt = {
      id: `virtual-${index + 1}`,
      name: `Ao ${index + 1}`,
      active: true,
    };

    const aiResult = runAI(selectedPlayers, {
      enabledCourts: [virtualCourt],
      competitionType,
      persist: false,
      lockedCourts: [],
      lockedPlayers: [],
    });

    if (aiResult.errors?.length) {
      if (createdMatches.length === 0) {
        return {
          ok: false,
          errors: aiResult.errors,
          competitionType,
        };
      }
      break;
    }

    const court = (aiResult.courts || []).find(
      (item) => (item.teamA?.length || 0) >= 2 && (item.teamB?.length || 0) >= 2
    );

    if (!court) {
      break;
    }

    createdMatches.push(
      courtResultToDailyMatch(court, {
        tournamentId,
        competitionType,
        skipScore,
      })
    );

    const usedIds = new Set(
      [...(court.teamA || []), ...(court.teamB || [])].map((player) => String(player.id))
    );
    remaining = remaining.filter((player) => !usedIds.has(String(player.id)));
  }

  if (createdMatches.length === 0) {
    return {
      ok: false,
      error: "AI khong tao duoc tran hop le.",
      competitionType,
    };
  }

  return {
    ok: true,
    matches: createdMatches,
    competitionType,
    waitingPlayers: remaining,
    settings: {
      ...normalized,
      matches: [...normalized.matches, ...createdMatches],
      skipScore,
    },
  };
}

export function partitionDailyMatches(matches = []) {
  const waiting = [];
  const playing = [];
  const completed = [];

  matches.forEach((match) => {
    if (match.status === MATCH_STATUS.COMPLETED || match.status === MATCH_STATUS.FORFEIT) {
      completed.push(match);
      return;
    }

    if (
      match.status === MATCH_STATUS.PLAYING ||
      match.status === MATCH_STATUS.ASSIGNED
    ) {
      playing.push(match);
      return;
    }

    waiting.push(match);
  });

  return { waiting, playing, completed };
}

export function assignDailyMatchToCourt({
  settings = {},
  courts = [],
  matchId,
  lockedCourtIds = [],
} = {}) {
  const normalized = normalizeDailyPlaySettings(settings);
  const { waiting } = partitionDailyMatches(normalized.matches);
  const match = waiting.find((item) => item.id === matchId) || waiting[0];

  if (!match) {
    return { ok: false, error: "Khong co tran cho de xep san." };
  }

  const enabledCourts = normalized.enabledCourtIds.length
    ? courts.filter((court) =>
        normalized.enabledCourtIds.includes(String(court.id))
      )
    : courts.filter((court) => court.active !== false);

  const courtStates = buildCourtRuntimeStates(
    enabledCourts,
    normalized.matches,
    { lockedCourtIds }
  );
  const available = courtStates.filter(
    (court) => court.status === "available" && !court.locked
  );

  if (available.length === 0) {
    return { ok: false, error: "Khong con san trong." };
  }

  const targetCourt = available[0];
  const engineMatch = {
    id: match.id,
    entryAId: match.teamAPlayerIds?.join("|") || "A",
    entryBId: match.teamBPlayerIds?.join("|") || "B",
    status: MATCH_STATUS.WAITING,
  };

  const assigned = assignMatchToCourt(courtStates, engineMatch, targetCourt.id);
  if (!assigned.ok) {
    return assigned;
  }

  const nextMatches = normalized.matches.map((item) => {
    if (item.id !== match.id) {
      return item;
    }

    const started = startMatch({
      ...item,
      courtId: targetCourt.id,
      status: MATCH_STATUS.ASSIGNED,
    });

    return started.ok
      ? {
          ...item,
          ...started.match,
          courtId: targetCourt.id,
          status: MATCH_STATUS.PLAYING,
        }
      : item;
  });

  return {
    ok: true,
    settings: {
      ...normalized,
      matches: nextMatches,
    },
    courtId: targetCourt.id,
    matchId: match.id,
  };
}

export function submitDailyPlayMatchScore(settings, matchId, scores = {}, options = {}) {
  const normalized = normalizeDailyPlaySettings(settings);
  const index = normalized.matches.findIndex((item) => item.id === matchId);

  if (index < 0) {
    return { ok: false, error: "Khong tim thay tran." };
  }

  const current = normalized.matches[index];
  const scoreResult = submitMatchScore(
    {
      id: current.id,
      entryAId: current.teamAPlayerIds?.join("|") || "A",
      entryBId: current.teamBPlayerIds?.join("|") || "B",
      status: current.status,
      courtId: current.courtId,
    },
    scores,
    options
  );

  if (!scoreResult.ok) {
    return scoreResult;
  }

  const nextMatches = [...normalized.matches];
  nextMatches[index] = {
    ...current,
    scoreA: scoreResult.match.scoreA,
    scoreB: scoreResult.match.scoreB,
    status: MATCH_STATUS.COMPLETED,
    completedAt: scoreResult.match.completedAt,
    winnerSide:
      scoreResult.match.scoreA > scoreResult.match.scoreB
        ? "A"
        : scoreResult.match.scoreB > scoreResult.match.scoreA
        ? "B"
        : "draw",
  };

  return {
    ok: true,
    settings: {
      ...normalized,
      matches: nextMatches,
    },
    match: nextMatches[index],
    releasedCourtId: current.courtId,
  };
}

export function toggleDailyCourtLock(settings, courts, courtId, lockedCourtIds = [], lock = true) {
  const normalized = normalizeDailyPlaySettings(settings);
  const courtStates = buildCourtRuntimeStates(
    courts,
    normalized.matches,
    { lockedCourtIds }
  );
  const result = setCourtLocked(courtStates, courtId, lock);

  if (!result.ok) {
    return result;
  }

  return {
    ok: true,
    settings: normalized,
    courtStates: result.courtStates,
    lockedCourtIds: lock
      ? [...new Set([...lockedCourtIds.map(String), String(courtId)])]
      : lockedCourtIds.filter((id) => String(id) !== String(courtId)),
  };
}

export function releaseDailyCourt(settings, courtId) {
  const normalized = normalizeDailyPlaySettings(settings);
  const courtStates = buildCourtRuntimeStates([], normalized.matches);
  releaseCourt(courtStates, courtId);

  return {
    ok: true,
    settings: normalized,
  };
}

export function buildDailyPlayTournamentPatch(settings) {
  const normalized = normalizeDailyPlaySettings(settings);
  return {
    settings: {
      dailyPlay: normalized,
    },
  };
}
