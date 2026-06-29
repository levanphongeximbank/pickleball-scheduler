function getQualifiedTeamsByGroup(groupStanding, qualifiersPerGroup = 2) {
  const standing = Array.isArray(groupStanding?.standing)
    ? groupStanding.standing
    : Array.isArray(groupStanding?.teams)
    ? groupStanding.teams
    : [];

  return standing.slice(0, qualifiersPerGroup);
}

function toSeed(groupLabel, rank) {
  return `${groupLabel}${rank}`;
}

function getRoundNameByTeamCount(teamCount) {
  if (teamCount === 32) return "Vong 1/16";
  if (teamCount === 16) return "Vong 1/8";
  if (teamCount === 8) return "Tu ket";
  if (teamCount === 4) return "Ban ket";
  if (teamCount === 2) return "Chung ket";
  return `Knockout ${teamCount}`;
}

function normalizeGroupLabel(group, index) {
  if (group?.group) {
    return String(group.group);
  }

  return String.fromCharCode(65 + index);
}

export function buildFirstKnockoutRound(groupStandings, options = {}) {
  const qualifiersPerGroup = Number(options.qualifiersPerGroup) || 2;

  const normalized = (groupStandings || []).map((group, index) => {
    const groupLabel = normalizeGroupLabel(group, index);
    const qualified = getQualifiedTeamsByGroup(group, qualifiersPerGroup);

    return {
      groupLabel,
      first: qualified[0] || null,
      second: qualified[1] || null,
    };
  });

  const matches = [];

  for (let i = 0; i < normalized.length; i += 2) {
    const left = normalized[i];
    const right = normalized[i + 1];

    if (!left || !right) {
      continue;
    }

    matches.push({
      id: `R1-M${matches.length + 1}`,
      home: left.first,
      away: right.second,
      homeSeed: toSeed(left.groupLabel, 1),
      awaySeed: toSeed(right.groupLabel, 2),
    });

    matches.push({
      id: `R1-M${matches.length + 1}`,
      home: left.second,
      away: right.first,
      homeSeed: toSeed(left.groupLabel, 2),
      awaySeed: toSeed(right.groupLabel, 1),
    });
  }

  return {
    name: getRoundNameByTeamCount(matches.length * 2),
    matches,
  };
}

export function buildKnockoutRounds(firstRound) {
  const rounds = [firstRound];
  let previous = firstRound;
  let roundIndex = 2;

  while ((previous?.matches || []).length > 1) {
    const nextMatches = [];
    const prevMatches = previous.matches || [];

    for (let i = 0; i < prevMatches.length; i += 2) {
      const left = prevMatches[i];
      const right = prevMatches[i + 1];

      if (!left || !right) {
        continue;
      }

      nextMatches.push({
        id: `R${roundIndex}-M${nextMatches.length + 1}`,
        home: null,
        away: null,
        homeSeed: `W(${left.id})`,
        awaySeed: `W(${right.id})`,
      });
    }

    const nextRound = {
      name: getRoundNameByTeamCount(nextMatches.length * 2),
      matches: nextMatches,
    };

    rounds.push(nextRound);
    previous = nextRound;
    roundIndex += 1;
  }

  return rounds;
}

export function buildTournamentBracket(groupStandings, options = {}) {
  const firstRound = buildFirstKnockoutRound(groupStandings, options);
  return buildKnockoutRounds(firstRound);
}

function parseWinnerSeed(seed) {
  const text = String(seed || "");
  const match = text.match(/^W\((.+)\)$/);
  return match?.[1] || null;
}

function getWinnerTeam(match, winnersByMatch = {}) {
  const winnerSide = winnersByMatch?.[match?.id];

  if (winnerSide === "home") {
    return match?.home || null;
  }

  if (winnerSide === "away") {
    return match?.away || null;
  }

  return null;
}

export function resolveKnockoutRounds(rounds = [], winnersByMatch = {}) {
  const resolvedRounds = (rounds || []).map((round) => ({
    ...round,
    matches: (round?.matches || []).map((match) => ({ ...match })),
  }));

  for (let roundIndex = 0; roundIndex < resolvedRounds.length - 1; roundIndex += 1) {
    const currentRound = resolvedRounds[roundIndex];
    const nextRound = resolvedRounds[roundIndex + 1];
    const winnerMap = new Map();

    (currentRound?.matches || []).forEach((match) => {
      winnerMap.set(match.id, getWinnerTeam(match, winnersByMatch));
    });

    nextRound.matches = (nextRound?.matches || []).map((match) => {
      const homeFromMatchId = parseWinnerSeed(match.homeSeed);
      const awayFromMatchId = parseWinnerSeed(match.awaySeed);

      return {
        ...match,
        home: homeFromMatchId ? winnerMap.get(homeFromMatchId) || null : match.home,
        away: awayFromMatchId ? winnerMap.get(awayFromMatchId) || null : match.away,
      };
    });
  }

  return resolvedRounds;
}

function resolveWinner(match, winnersByMatch = {}) {
  const winnerSide = winnersByMatch?.[match?.id];
  const canPickWinner = Boolean(match?.home && match?.away);

  if (!canPickWinner) {
    return {
      winnerSide: null,
      winner: null,
      canPickWinner,
      completed: false,
    };
  }

  if (winnerSide === "home") {
    return {
      winnerSide,
      winner: match.home,
      canPickWinner,
      completed: true,
    };
  }

  if (winnerSide === "away") {
    return {
      winnerSide,
      winner: match.away,
      canPickWinner,
      completed: true,
    };
  }

  return {
    winnerSide: null,
    winner: null,
    canPickWinner,
    completed: false,
  };
}

export function buildKnockoutProgress(rounds = [], winnersByMatch = {}) {
  const resolvedRounds = (rounds || []).map((round) => ({
    ...round,
    matches: (round?.matches || []).map((match) => ({ ...match })),
    completed: false,
  }));

  for (let roundIndex = 0; roundIndex < resolvedRounds.length - 1; roundIndex += 1) {
    const currentRound = resolvedRounds[roundIndex];
    const nextRound = resolvedRounds[roundIndex + 1];
    const winnerMap = new Map();

    currentRound.matches = (currentRound.matches || []).map((match) => {
      const winnerInfo = resolveWinner(match, winnersByMatch);
      winnerMap.set(match.id, winnerInfo.winner);

      return {
        ...match,
        winnerSide: winnerInfo.winnerSide,
        winner: winnerInfo.winner,
        canPickWinner: winnerInfo.canPickWinner,
        completed: winnerInfo.completed,
      };
    });

    currentRound.completed =
      currentRound.matches.length > 0 && currentRound.matches.every((match) => match.completed);

    nextRound.matches = (nextRound?.matches || []).map((match) => {
      const homeFromMatchId = parseWinnerSeed(match.homeSeed);
      const awayFromMatchId = parseWinnerSeed(match.awaySeed);

      return {
        ...match,
        home: homeFromMatchId ? winnerMap.get(homeFromMatchId) || null : match.home,
        away: awayFromMatchId ? winnerMap.get(awayFromMatchId) || null : match.away,
      };
    });
  }

  if (resolvedRounds.length > 0) {
    const lastRoundIndex = resolvedRounds.length - 1;
    const lastRound = resolvedRounds[lastRoundIndex];

    lastRound.matches = (lastRound.matches || []).map((match) => {
      const winnerInfo = resolveWinner(match, winnersByMatch);
      return {
        ...match,
        winnerSide: winnerInfo.winnerSide,
        winner: winnerInfo.winner,
        canPickWinner: winnerInfo.canPickWinner,
        completed: winnerInfo.completed,
      };
    });

    lastRound.completed =
      lastRound.matches.length > 0 && lastRound.matches.every((match) => match.completed);
  }

  const champion =
    resolvedRounds.length > 0
      ? resolvedRounds[resolvedRounds.length - 1]?.matches?.[0]?.winner || null
      : null;

  const completedRounds = resolvedRounds.filter((round) => round.completed).length;

  return {
    rounds: resolvedRounds,
    champion,
    completedRounds,
    totalRounds: resolvedRounds.length,
  };
}

export function sanitizeKnockoutWinners(rounds = [], winnersByMatch = {}) {
  const progress = buildKnockoutProgress(rounds, winnersByMatch);
  const sanitized = {};

  (progress.rounds || []).forEach((round) => {
    (round.matches || []).forEach((match) => {
      if (match.winnerSide === "home" || match.winnerSide === "away") {
        sanitized[match.id] = match.winnerSide;
      }
    });
  });

  return sanitized;
}

export function isKnockoutRoundLocked(round = {}, unlockedRounds = {}) {
  const roundKey = String(round?.name || "").trim();
  const isUnlocked = Boolean(roundKey && unlockedRounds?.[roundKey]);

  return Boolean(round?.completed) && !isUnlocked;
}
