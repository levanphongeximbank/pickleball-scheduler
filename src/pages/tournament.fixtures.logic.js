function normalizeFixtureCourts(courts = []) {
  if (!Array.isArray(courts) || courts.length === 0) {
    return [];
  }

  return courts
    .filter((court) => court && court.active !== false && court.id !== undefined && court.id !== null)
    .map((court, index) => ({
      id: court.id,
      name:
        court.name && String(court.name).trim() !== ""
          ? String(court.name).trim()
          : court.number !== undefined && court.number !== null && court.number !== ""
            ? `Sân ${court.number}`
            : `Sân ${index + 1}`,
    }));
}

function chunkItems(items, chunkSize) {
  if (!Number.isFinite(chunkSize) || chunkSize <= 0) {
    return [items];
  }

  const chunks = [];
  for (let index = 0; index < items.length; index += chunkSize) {
    chunks.push(items.slice(index, index + chunkSize));
  }

  return chunks;
}

function buildFixtureCourt(match, court) {
  return {
    court: court.id,
    courtName: court.name,
    matchId: match.matchId,
    teamA: Array.isArray(match?.home?.members) ? match.home.members : [],
    teamB: Array.isArray(match?.away?.members) ? match.away.members : [],
    teamATotal: 0,
    teamBTotal: 0,
    diff: 0,
    score: 0,
  };
}

function resolveFallbackCourt(round, roundRobin, matchIndex) {
  return {
    id: `${round.groupLabel || "G"}${roundRobin.roundNumber}-${matchIndex + 1}`,
    name: `Sân ${matchIndex + 1}`,
  };
}

function roundRobinRotate(list = []) {
  if (list.length <= 2) {
    return list;
  }

  const fixed = list[0];
  const tail = list.slice(1);
  const last = tail.pop();

  return [fixed, last, ...tail];
}

export function buildRoundRobinRounds(teams = []) {
  const normalizedTeams = Array.isArray(teams) ? [...teams] : [];
  if (normalizedTeams.length < 2) {
    return [];
  }

  const hasBye = normalizedTeams.length % 2 !== 0;
  const participants = hasBye
    ? [...normalizedTeams, { id: "__BYE__", name: "BYE", members: [] }]
    : [...normalizedTeams];

  const rounds = [];
  let current = participants;
  const roundCount = participants.length - 1;
  const pairCount = participants.length / 2;

  for (let roundIndex = 0; roundIndex < roundCount; roundIndex += 1) {
    const matches = [];

    for (let i = 0; i < pairCount; i += 1) {
      const home = current[i];
      const away = current[current.length - 1 - i];

      if (home?.id === "__BYE__" || away?.id === "__BYE__") {
        continue;
      }

      matches.push({
        matchId: `G-R${roundIndex + 1}-M${matches.length + 1}`,
        home,
        away,
      });
    }

    rounds.push({
      roundNumber: roundIndex + 1,
      matches,
    });

    current = roundRobinRotate(current);
  }

  return rounds;
}

export function buildSeededGroupSessions(rounds = [], options = {}) {
  const startAt = Number(options.startAt) || Date.now();
  const baseDate = Number(options.baseDate) || Date.now();
  const availableCourts = normalizeFixtureCourts(options.courts || []);
  const courtCapacity = availableCourts.length > 0 ? availableCourts.length : Infinity;

  const sessions = [];

  rounds.forEach((round, roundIndex) => {
    const seededTeams = Array.isArray(round?.seededTeams) ? round.seededTeams : [];
    if (seededTeams.length < 2) {
      return;
    }

    const roundRobinRounds = buildRoundRobinRounds(seededTeams);

    roundRobinRounds.forEach((roundRobin, shiftIndex) => {
      const matchChunks = chunkItems(roundRobin.matches, courtCapacity);

      matchChunks.forEach((matchChunk, chunkIndex) => {
        const courts = matchChunk.map((match, matchIndex) => {
          const court =
            availableCourts.length > 0
              ? availableCourts[matchIndex]
              : resolveFallbackCourt(round, roundRobin, matchIndex);

          return buildFixtureCourt(match, court);
        });

        const shiftSuffix = matchChunks.length > 1 ? ` - Phiên ${chunkIndex + 1}` : "";

        sessions.push({
          id: startAt + sessions.length,
          date: new Date(baseDate + (roundIndex * 100 + shiftIndex + chunkIndex) * 60000).toISOString(),
          courts,
          waiting: [],
          aiScore: null,
          meta: {
            roundId: round.id,
            roundName: round.name,
            groupLabel: round.groupLabel || null,
            shiftLabel: `Lượt ${roundRobin.roundNumber}${shiftSuffix}`,
            generatedFromSeed: true,
            courtIds: courts.map((court) => court.court),
          },
        });
      });
    });
  });

  return sessions;
}
