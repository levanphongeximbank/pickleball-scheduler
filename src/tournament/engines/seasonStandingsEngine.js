function buildOutcome(playerId, teamAPlayerIds, teamBPlayerIds, scoreA, scoreB) {
  const key = String(playerId);
  const inA = teamAPlayerIds.map(String).includes(key);
  const inB = teamBPlayerIds.map(String).includes(key);

  if (!inA && !inB) {
    return null;
  }

  const myScore = inA ? Number(scoreA) : Number(scoreB);
  const oppScore = inA ? Number(scoreB) : Number(scoreA);

  return {
    won: myScore > oppScore,
    lost: myScore < oppScore,
    draw: myScore === oppScore,
  };
}

export function createEmptyPlayerSeasonStanding() {
  return {
    points: 0,
    matches: 0,
    wins: 0,
    losses: 0,
    draws: 0,
  };
}

export function createEmptyLeagueStandings() {
  return {
    players: {},
    matchContributions: {},
  };
}

function ensurePlayerStanding(players, playerId) {
  const key = String(playerId);
  if (!players[key]) {
    players[key] = createEmptyPlayerSeasonStanding();
  }
  return players[key];
}

function subtractContribution(players, contribution = {}) {
  Object.entries(contribution).forEach(([playerId, stats]) => {
    const row = ensurePlayerStanding(players, playerId);
    row.points -= stats.points || 0;
    row.matches -= stats.matches || 0;
    row.wins -= stats.wins || 0;
    row.losses -= stats.losses || 0;
    row.draws -= stats.draws || 0;
  });
}

function addContribution(players, contribution = {}) {
  Object.entries(contribution).forEach(([playerId, stats]) => {
    const row = ensurePlayerStanding(players, playerId);
    row.points += stats.points || 0;
    row.matches += stats.matches || 0;
    row.wins += stats.wins || 0;
    row.losses += stats.losses || 0;
    row.draws += stats.draws || 0;
  });
}

function buildMatchContribution(record, pointsSystem = {}) {
  const winPts = Number(pointsSystem.win ?? 3);
  const drawPts = Number(pointsSystem.draw ?? 0);
  const lossPts = Number(pointsSystem.loss ?? 0);
  const contribution = {};

  (record.playerIds || []).forEach((playerId) => {
    const outcome = buildOutcome(
      playerId,
      record.teamAPlayerIds || [],
      record.teamBPlayerIds || [],
      record.scoreA,
      record.scoreB
    );

    if (!outcome) {
      return;
    }

    const points = outcome.won ? winPts : outcome.draw ? drawPts : lossPts;
    contribution[String(playerId)] = {
      points,
      matches: 1,
      wins: outcome.won ? 1 : 0,
      losses: outcome.lost ? 1 : 0,
      draws: outcome.draw ? 1 : 0,
    };
  });

  return contribution;
}

export function applyMatchRecordToLeagueStandings(
  standings,
  record,
  pointsSystem = {}
) {
  const next = {
    players: { ...(standings?.players || {}) },
    matchContributions: { ...(standings?.matchContributions || {}) },
  };

  const matchId = String(record?.id || "").trim();
  if (!matchId) {
    return next;
  }

  const previous = next.matchContributions[matchId];
  if (previous) {
    subtractContribution(next.players, previous);
    delete next.matchContributions[matchId];
  }

  const contribution = buildMatchContribution(record, pointsSystem);
  if (!Object.keys(contribution).length) {
    return next;
  }

  addContribution(next.players, contribution);
  next.matchContributions[matchId] = contribution;

  return next;
}

export function buildLeagueStandingsRows(standings, players = []) {
  const playersById = new Map(
    (players || []).map((player) => [String(player.id), player])
  );

  return Object.entries(standings?.players || {})
    .map(([playerId, stats]) => {
      const player = playersById.get(String(playerId));
      return {
        playerId,
        name: player?.name || `VDV ${playerId}`,
        rating: player?.rating ?? player?.level ?? null,
        ...stats,
      };
    })
    .sort((left, right) => {
      return (
        right.points - left.points ||
        right.wins - left.wins ||
        left.losses - right.losses ||
        String(left.name).localeCompare(String(right.name), "vi")
      );
    });
}
