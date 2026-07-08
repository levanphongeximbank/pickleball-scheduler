import { loadClubData } from "../../domain/clubStorage.js";
import { MATCH_STATUS, TOURNAMENT_MODE } from "../../models/tournament/constants.js";

const FINISHED_MATCH_STATUSES = new Set([
  MATCH_STATUS.COMPLETED,
  MATCH_STATUS.FORFEIT,
]);

export function createEmptyPlayerHistoryStats() {
  return {
    matchesPlayed: 0,
    wins: 0,
    losses: 0,
    draws: 0,
    pointsFor: 0,
    pointsAgainst: 0,
    partners: {},
    opponents: {},
  };
}

function incrementMap(map, key, amount = 1) {
  const normalized = String(key || "").trim();
  if (!normalized) {
    return;
  }

  map[normalized] = (map[normalized] || 0) + amount;
}

function toScore(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

function buildOutcomeForPlayer(playerId, teamAIds = [], teamBIds = [], scoreA, scoreB) {
  const key = String(playerId);
  const teamA = teamAIds.map(String);
  const teamB = teamBIds.map(String);
  const inA = teamA.includes(key);
  const inB = teamB.includes(key);

  if (!inA && !inB) {
    return null;
  }

  const myScore = inA ? toScore(scoreA) : toScore(scoreB);
  const oppScore = inA ? toScore(scoreB) : toScore(scoreA);

  return {
    won: myScore > oppScore,
    lost: myScore < oppScore,
    draw: myScore === oppScore,
    pointsFor: myScore,
    pointsAgainst: oppScore,
  };
}

function updateRelationshipMaps(stats, playerId, teamAIds = [], teamBIds = []) {
  const key = String(playerId);
  const teamA = teamAIds.map(String);
  const teamB = teamBIds.map(String);
  const myTeam = teamA.includes(key) ? teamA : teamB.includes(key) ? teamB : [];
  const oppTeam = teamA.includes(key) ? teamB : teamB.includes(key) ? teamA : [];

  myTeam.filter((id) => id !== key).forEach((partnerId) => {
    incrementMap(stats.partners, partnerId);
  });

  oppTeam.forEach((opponentId) => {
    incrementMap(stats.opponents, opponentId);
  });
}

export function applyMatchRecordToStats(stats, record, playerId) {
  const outcome = buildOutcomeForPlayer(
    playerId,
    record.teamAPlayerIds,
    record.teamBPlayerIds,
    record.scoreA,
    record.scoreB
  );

  if (!outcome) {
    return stats;
  }

  const next = {
    ...stats,
    partners: { ...stats.partners },
    opponents: { ...stats.opponents },
  };

  next.matchesPlayed += 1;
  if (outcome.won) {
    next.wins += 1;
  } else if (outcome.lost) {
    next.losses += 1;
  } else if (outcome.draw) {
    next.draws += 1;
  }

  next.pointsFor += outcome.pointsFor;
  next.pointsAgainst += outcome.pointsAgainst;
  updateRelationshipMaps(next, playerId, record.teamAPlayerIds, record.teamBPlayerIds);

  return next;
}

export function dailyMatchToRecord(match, tournament) {
  if (!FINISHED_MATCH_STATUSES.has(match?.status)) {
    return null;
  }

  const teamAPlayerIds = (match.teamAPlayerIds || []).map(String);
  const teamBPlayerIds = (match.teamBPlayerIds || []).map(String);

  if (teamAPlayerIds.length === 0 && teamBPlayerIds.length === 0) {
    return null;
  }

  return {
    id: String(match.id),
    source: "daily_play",
    tournamentId: tournament?.id || "",
    tournamentName: tournament?.name || "Daily Play",
    eventName: match.competitionType || "Daily",
    date: match.completedAt || match.createdAt || null,
    playerIds: [...teamAPlayerIds, ...teamBPlayerIds],
    teamAPlayerIds,
    teamBPlayerIds,
    scoreA: toScore(match.scoreA),
    scoreB: toScore(match.scoreB),
    stageLabel: "Daily Play",
  };
}

export function eventMatchToRecord(match, tournament, event) {
  if (!FINISHED_MATCH_STATUSES.has(match?.status)) {
    return null;
  }

  const entryMap = new Map(
    (event?.entries || []).map((entry) => [String(entry.id), entry])
  );
  const entryA = entryMap.get(String(match.entryAId));
  const entryB = entryMap.get(String(match.entryBId));
  const teamAPlayerIds = (entryA?.playerIds || []).map(String);
  const teamBPlayerIds = (entryB?.playerIds || []).map(String);

  if (teamAPlayerIds.length === 0 && teamBPlayerIds.length === 0) {
    return null;
  }

  return {
    id: String(match.id),
    source: "tournament",
    tournamentId: tournament?.id || "",
    tournamentName: tournament?.name || "Giai",
    eventName: event?.name || event?.eventType || "Noi dung",
    date: match.completedAt || null,
    playerIds: [...teamAPlayerIds, ...teamBPlayerIds],
    teamAPlayerIds,
    teamBPlayerIds,
    scoreA: toScore(match.scoreA),
    scoreB: toScore(match.scoreB),
    stageLabel: match.bracketMatchId ? "Knock-out" : "Vong bang",
  };
}

export function collectMatchRecordsFromTournaments(tournaments = []) {
  const records = [];

  (tournaments || []).forEach((tournament) => {
    if (tournament?.mode === TOURNAMENT_MODE.DAILY_PLAY) {
      (tournament.settings?.dailyPlay?.matches || []).forEach((match) => {
        const record = dailyMatchToRecord(match, tournament);
        if (record) {
          records.push(record);
        }
      });
      return;
    }

    (tournament.events || []).forEach((event) => {
      (event.matches || []).forEach((match) => {
        const record = eventMatchToRecord(match, tournament, event);
        if (record) {
          records.push(record);
        }
      });
    });
  });

  return records.sort((a, b) => {
    const aTime = Date.parse(a.date || "") || 0;
    const bTime = Date.parse(b.date || "") || 0;
    return bTime - aTime;
  });
}

export function mergeLegacyAiHistory(stats, playerId, aiHistoryEntry) {
  if (!aiHistoryEntry) {
    return stats;
  }

  const next = {
    ...stats,
    partners: { ...stats.partners },
    opponents: { ...stats.opponents },
  };

  Object.entries(aiHistoryEntry.partners || {}).forEach(([id, count]) => {
    incrementMap(next.partners, id, count);
  });

  Object.entries(aiHistoryEntry.opponents || {}).forEach(([id, count]) => {
    incrementMap(next.opponents, id, count);
  });

  if (next.matchesPlayed === 0 && Number(aiHistoryEntry.games) > 0) {
    next.matchesPlayed = Number(aiHistoryEntry.games);
  }

  return next;
}

function topRelationships(map = {}, playersById = new Map(), limit = 5) {
  return Object.entries(map)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([id, count]) => ({
      playerId: id,
      name: playersById.get(String(id)) || `VDV ${id}`,
      count,
    }));
}

export function summarizePlayerHistoryStats(stats) {
  const decided = stats.wins + stats.losses;
  return {
    ...stats,
    winRate: decided > 0 ? Math.round((stats.wins / decided) * 1000) / 10 : 0,
    pointDiff: stats.pointsFor - stats.pointsAgainst,
  };
}

export function buildPlayerHistoryProfile(
  playerId,
  { players = [], tournaments = [], aiHistory = {}, recentLimit = 10 } = {}
) {
  const player = (players || []).find((item) => String(item.id) === String(playerId));
  if (!player) {
    return { ok: false, error: "Khong tim thay VDV." };
  }

  let stats = createEmptyPlayerHistoryStats();
  const records = collectMatchRecordsFromTournaments(tournaments);
  const playerRecords = records.filter((record) =>
    record.playerIds.map(String).includes(String(playerId))
  );

  playerRecords.forEach((record) => {
    stats = applyMatchRecordToStats(stats, record, playerId);
  });

  stats = mergeLegacyAiHistory(stats, playerId, aiHistory[String(playerId)]);

  const playersById = new Map(
    (players || []).map((item) => [String(item.id), item.name || `VDV ${item.id}`])
  );

  const summary = summarizePlayerHistoryStats(stats);

  return {
    ok: true,
    player,
    stats: summary,
    recentMatches: playerRecords.slice(0, recentLimit).map((record) => {
      const outcome = buildOutcomeForPlayer(
        playerId,
        record.teamAPlayerIds,
        record.teamBPlayerIds,
        record.scoreA,
        record.scoreB
      );

      return {
        ...record,
        outcome,
        resultLabel: outcome?.won ? "Thang" : outcome?.lost ? "Thua" : "Hoa",
      };
    }),
    topPartners: topRelationships(summary.partners, playersById),
    topOpponents: topRelationships(summary.opponents, playersById),
  };
}

export function loadPlayerHistoryProfileForClub(clubId, playerId, options = {}) {
  const data = loadClubData(clubId);
  return buildPlayerHistoryProfile(playerId, {
    players: data.players || [],
    tournaments: data.tournaments || [],
    aiHistory: data.ai?.history || {},
    recentLimit: options.recentLimit,
  });
}

function findPlayerInClubData(clubId, { playerId, authUserId } = {}) {
  if (!clubId) {
    return null;
  }

  const players = loadClubData(clubId).players || [];

  if (playerId) {
    const byId = players.find((item) => String(item.id) === String(playerId));
    if (byId) {
      return byId;
    }
  }

  if (authUserId) {
    return (
      players.find((item) => String(item.authUserId || "") === String(authUserId)) || null
    );
  }

  return null;
}

/**
 * Tìm VĐV theo club ưu tiên (profile CLB gán) rồi fallback activeClubId / authUserId.
 */
export function loadPlayerHistoryProfileResolved(
  { primaryClubId, secondaryClubId, playerId, authUserId } = {},
  options = {}
) {
  const clubIds = [...new Set([primaryClubId, secondaryClubId].filter(Boolean))];

  for (const clubId of clubIds) {
    const player = findPlayerInClubData(clubId, { playerId, authUserId });
    if (!player) {
      continue;
    }

    const profile = loadPlayerHistoryProfileForClub(clubId, player.id, options);
    if (profile.ok) {
      return {
        ...profile,
        clubId,
        resolvedPlayerId: player.id,
      };
    }
  }

  return { ok: false, error: "Khong tim thay VDV." };
}
