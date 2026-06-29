function toFiniteNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function resolveGroupLabel(round, index) {
  const explicit = String(round?.groupLabel || "").trim();
  if (explicit) {
    return explicit.toUpperCase();
  }

  const roundName = String(round?.name || "").trim();
  const fromName = roundName.match(/(?:bang|group)\s*([a-z0-9]+)/i);
  if (fromName?.[1]) {
    return fromName[1].toUpperCase();
  }

  if (Number.isInteger(index) && index >= 0 && index < 26) {
    return String.fromCharCode(65 + index);
  }

  return roundName || `GROUP-${index + 1}`;
}

function buildTeamKey(players = []) {
  const ids = players
    .map((player) => String(player?.id || "").trim())
    .filter(Boolean)
    .sort();

  if (ids.length > 0) {
    return ids.join("|");
  }

  const names = players
    .map((player) => String(player?.name || "").trim())
    .filter(Boolean)
    .sort();

  return names.join("|");
}

function buildTeamName(players = []) {
  const names = players
    .map((player) => String(player?.name || "").trim())
    .filter(Boolean);

  if (names.length > 0) {
    return names.join(" / ");
  }

  return "Đội chưa đặt tên";
}

function createTeamRow(key, players) {
  return {
    id: key,
    name: buildTeamName(players),
    players,
    played: 0,
    won: 0,
    draw: 0,
    lost: 0,
    pointsFor: 0,
    pointsAgainst: 0,
    scoreDiff: 0,
    matchPoints: 0,
  };
}

function getOrCreateTeamRow(teamMap, players) {
  const key = buildTeamKey(players);
  if (!key) {
    return null;
  }

  if (!teamMap.has(key)) {
    teamMap.set(key, createTeamRow(key, players));
  }

  return teamMap.get(key);
}

function compareStanding(a, b) {
  return (
    b.matchPoints - a.matchPoints ||
    b.scoreDiff - a.scoreDiff ||
    b.pointsFor - a.pointsFor ||
    b.won - a.won ||
    a.name.localeCompare(b.name, "vi")
  );
}

export function buildGroupStandingFromSessions(sessions = [], round = {}, options = {}) {
  const roundId = round?.id;
  const groupLabel = resolveGroupLabel(round, options.groupIndex || 0);
  const teamMap = new Map();
  let matchCount = 0;

  const relatedSessions = (sessions || []).filter((session) =>
    String(session?.meta?.roundId || "") === String(roundId || "")
  );

  relatedSessions.forEach((session) => {
    if (session?.result?.status !== "completed") {
      return;
    }

    const resultCourts = Array.isArray(session?.result?.courts) ? session.result.courts : [];
    const sourceCourts = Array.isArray(session?.courts) ? session.courts : [];

    resultCourts.forEach((courtResult) => {
      const sourceCourt = sourceCourts.find(
        (court) => String(court?.court) === String(courtResult?.courtId)
      );

      if (!sourceCourt) {
        return;
      }

      const teamAPlayers = Array.isArray(sourceCourt.teamA) ? sourceCourt.teamA : [];
      const teamBPlayers = Array.isArray(sourceCourt.teamB) ? sourceCourt.teamB : [];
      const rowA = getOrCreateTeamRow(teamMap, teamAPlayers);
      const rowB = getOrCreateTeamRow(teamMap, teamBPlayers);

      if (!rowA || !rowB) {
        return;
      }

      const teamAScore = Math.max(0, toFiniteNumber(courtResult?.teamAScore, 0));
      const teamBScore = Math.max(0, toFiniteNumber(courtResult?.teamBScore, 0));

      rowA.played += 1;
      rowB.played += 1;
      rowA.pointsFor += teamAScore;
      rowA.pointsAgainst += teamBScore;
      rowB.pointsFor += teamBScore;
      rowB.pointsAgainst += teamAScore;

      if (teamAScore > teamBScore) {
        rowA.won += 1;
        rowB.lost += 1;
        rowA.matchPoints += 3;
      } else if (teamBScore > teamAScore) {
        rowB.won += 1;
        rowA.lost += 1;
        rowB.matchPoints += 3;
      } else {
        rowA.draw += 1;
        rowB.draw += 1;
        rowA.matchPoints += 1;
        rowB.matchPoints += 1;
      }

      matchCount += 1;
    });
  });

  const standing = Array.from(teamMap.values())
    .map((row) => ({
      ...row,
      scoreDiff: row.pointsFor - row.pointsAgainst,
    }))
    .sort(compareStanding);

  return {
    roundId,
    roundName: round?.name || null,
    group: groupLabel,
    matchCount,
    standing,
  };
}

export function buildGroupStandingsForRounds(sessions = [], rounds = [], options = {}) {
  const qualifiersPerGroup = Number(options.qualifiersPerGroup) || 2;

  return (rounds || [])
    .map((round, index) => buildGroupStandingFromSessions(sessions, round, { groupIndex: index }))
    .filter((groupStanding) => groupStanding.matchCount > 0 && groupStanding.standing.length > 0)
    .sort((a, b) => a.group.localeCompare(b.group, "vi", { numeric: true }))
    .map((groupStanding) => ({
      ...groupStanding,
      qualified: groupStanding.standing.slice(0, qualifiersPerGroup),
    }));
}
