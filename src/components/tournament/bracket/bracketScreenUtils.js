import { MATCH_STAGE, MATCH_STATUS } from "../../../models/tournament/constants.js";

const ROUND_LABELS = {
  "Vong 1/16": { display: "Vòng 1/16", short: "1/16", code: "R16" },
  "Vong 1/8": { display: "Vòng 1/8", short: "1/8", code: "R8" },
  "Tu ket": { display: "Tứ kết", short: "TK", code: "TK" },
  "Ban ket": { display: "Bán kết", short: "BK", code: "SF" },
  "Chung ket": { display: "Chung kết", short: "CK", code: "F" },
};

export function getRoundDisplayName(roundName = "") {
  return ROUND_LABELS[String(roundName).trim()]?.display || String(roundName || "Vòng đấu");
}

export function getRoundShortLabel(roundName = "") {
  return ROUND_LABELS[String(roundName).trim()]?.short || String(roundName || "");
}

export function getMatchDisplayCode(roundName = "", matchIndex = 0) {
  const code = ROUND_LABELS[String(roundName).trim()]?.code || "M";
  return `${code}-${String(matchIndex + 1).padStart(2, "0")}`;
}

function formatTeamName(team, seed) {
  if (team?.name) {
    return team.name;
  }

  if (!team) {
    return "Chờ đội thắng";
  }

  if (seed) {
    return seed;
  }

  return "Chờ đội thắng";
}

function resolveCourtLabel(linkedMatch, courts = []) {
  if (!linkedMatch?.courtId) {
    return "";
  }

  const court = courts.find((item) => String(item.id) === String(linkedMatch.courtId));
  return court?.name || `Sân ${linkedMatch.courtId}`;
}

function resolveMatchSchedule(linkedMatch) {
  if (!linkedMatch) {
    return "";
  }

  const parts = [];
  if (linkedMatch.scheduledAt) {
    parts.push(new Date(linkedMatch.scheduledAt).toLocaleString("vi-VN"));
  } else if (linkedMatch.date) {
    parts.push(linkedMatch.date);
  }

  return parts.join(" • ");
}

export function resolveBracketMatchStatus(bracketMatch, linkedMatch) {
  if (bracketMatch?.completed) {
    return "done";
  }

  if (
    linkedMatch?.status === MATCH_STATUS.PLAYING ||
    linkedMatch?.status === MATCH_STATUS.ASSIGNED
  ) {
    return "live";
  }

  if (bracketMatch?.home && bracketMatch?.away) {
    return "ready";
  }

  return "waiting";
}

export function resolveBracketMatchStatusLabel(status) {
  if (status === "done") {
    return "Đã xong";
  }

  if (status === "live") {
    return "Đang đấu";
  }

  if (status === "ready") {
    return "Chưa đấu";
  }

  return "Chờ đội thắng";
}

function mapMatchCard(bracketMatch, linkedMatch, roundName, matchIndex, courts) {
  const status = resolveBracketMatchStatus(bracketMatch, linkedMatch);
  const scoreA = linkedMatch?.scoreA ?? "";
  const scoreB = linkedMatch?.scoreB ?? "";

  return {
    id: bracketMatch.id,
    code: getMatchDisplayCode(roundName, matchIndex),
    roundName,
    roundDisplay: getRoundDisplayName(roundName),
    home: {
      id: bracketMatch.home?.id,
      name: formatTeamName(bracketMatch.home, bracketMatch.homeSeed),
      seed: bracketMatch.homeSeed,
      isWinner: bracketMatch.winnerSide === "home",
      isLoser: bracketMatch.completed && bracketMatch.winnerSide === "away",
      score: scoreA,
      isPlaceholder: !bracketMatch.home,
    },
    away: {
      id: bracketMatch.away?.id,
      name: formatTeamName(bracketMatch.away, bracketMatch.awaySeed),
      seed: bracketMatch.awaySeed,
      isWinner: bracketMatch.winnerSide === "away",
      isLoser: bracketMatch.completed && bracketMatch.winnerSide === "home",
      score: scoreB,
      isPlaceholder: !bracketMatch.away,
    },
    status,
    statusLabel: resolveBracketMatchStatusLabel(status),
    completed: Boolean(bracketMatch.completed),
    scheduleText: resolveMatchSchedule(linkedMatch),
    courtLabel: formatCourtLabel(linkedMatch, courts),
    linkedMatchId: linkedMatch?.id || null,
    winner: bracketMatch.winner || null,
    winnerSide: bracketMatch.winnerSide || null,
    homeSeed: bracketMatch.homeSeed || null,
    awaySeed: bracketMatch.awaySeed || null,
    isThirdPlace: linkedMatch?.stage === MATCH_STAGE.THIRD_PLACE,
  };
}

function formatCourtLabel(linkedMatch, courts) {
  const label = resolveCourtLabel(linkedMatch, courts);
  return label || "Chưa xếp sân";
}

export function findThirdPlaceMatch(matches = []) {
  return (matches || []).find((match) => match.stage === MATCH_STAGE.THIRD_PLACE) || null;
}

export function findThirdPlaceBracketMatch(progress, knockoutMatchesByBracketId, courts = []) {
  const thirdLinked = Object.values(knockoutMatchesByBracketId || {}).find(
    (match) => match.stage === MATCH_STAGE.THIRD_PLACE
  );

  if (!thirdLinked?.bracketMatchId) {
    return null;
  }

  for (const round of progress?.rounds || []) {
    const matchIndex = (round.matches || []).findIndex(
      (match) => match.id === thirdLinked.bracketMatchId
    );
    const found = matchIndex >= 0 ? round.matches[matchIndex] : null;

    if (found) {
      return mapMatchCard(found, thirdLinked, round.name, matchIndex, courts);
    }
  }

  return null;
}

export function buildBracketViewModel({
  progress,
  knockoutMatchesByBracketId = {},
  courts = [],
  event = null,
}) {
  if (!progress?.rounds?.length) {
    return {
      rounds: [],
      champion: null,
      thirdPlace: null,
      thirdPlaceTeam: null,
      pendingMatches: [],
      advancingTeams: [],
      teamCount: 0,
      formatLabel: "Loại trực tiếp",
    };
  }

  const rounds = progress.rounds.map((round) => ({
    key: round.name,
    engineName: round.name,
    displayName: getRoundDisplayName(round.name),
    shortLabel: getRoundShortLabel(round.name),
    completed: Boolean(round.completed),
    matches: (round.matches || []).map((match, matchIndex) =>
      mapMatchCard(
        match,
        knockoutMatchesByBracketId[match.id],
        round.name,
        matchIndex,
        courts
      )
    ),
  }));

  const firstRoundCount = rounds[0]?.matches?.length ? rounds[0].matches.length * 2 : 0;
  const pendingMatches = rounds
    .flatMap((round) => round.matches)
    .filter(
      (match) =>
        !match.completed &&
        !match.home.isPlaceholder &&
        !match.away.isPlaceholder
    );

  const advancingTeams = buildAdvancingTeams(progress);

  const thirdPlaceLinked = findThirdPlaceMatch(event?.matches);
  let thirdPlaceTeam = null;

  if (thirdPlaceLinked?.winnerId) {
    const winnerEntry = (event?.entries || []).find(
      (entry) => String(entry.id) === String(thirdPlaceLinked.winnerId)
    );
    thirdPlaceTeam = winnerEntry ? { id: winnerEntry.id, name: winnerEntry.name } : null;
  }

  return {
    rounds,
    champion: progress.champion,
    thirdPlace: findThirdPlaceBracketMatch(progress, knockoutMatchesByBracketId, courts),
    thirdPlaceTeam,
    pendingMatches,
    advancingTeams,
    teamCount: firstRoundCount,
    formatLabel: "Loại trực tiếp",
  };
}

export function buildAdvancingTeams(progress) {
  const items = [];

  (progress?.rounds || []).forEach((round, roundIndex) => {
    const nextRound = progress.rounds[roundIndex + 1];
    if (!nextRound) {
      return;
    }

    (round.matches || []).forEach((match) => {
      if (!match.winner) {
        return;
      }

      items.push({
        id: `${match.id}-${match.winner.id}`,
        teamName: match.winner.name,
        fromMatchId: match.id,
        toRoundName: nextRound.name,
        toRoundDisplay: getRoundDisplayName(nextRound.name),
      });
    });
  });

  return items;
}

export function buildBracketRevealPlan(viewModel) {
  return (viewModel.rounds || []).map((round, roundIndex) => ({
    roundIndex,
    roundName: round.displayName,
    engineName: round.engineName,
    matches: round.matches,
  }));
}

export function getBracketAnimationTiming(speed = "normal") {
  const presets = {
    fast: { roundMs: 500, matchMs: 320, advanceMs: 700, gapMs: 180 },
    normal: { roundMs: 900, matchMs: 550, advanceMs: 1000, gapMs: 280 },
    slow: { roundMs: 1400, matchMs: 850, advanceMs: 1500, gapMs: 420 },
  };

  return presets[speed] || presets.normal;
}

export function countBracketTeams(rounds = []) {
  if (!rounds.length) {
    return 0;
  }

  return (rounds[0]?.matches || []).length * 2;
}
