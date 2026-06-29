import { MATCH_STATUS } from "../../models/tournament/constants.js";

function toScore(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
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

function createStandingRow(entry) {
  return {
    id: entry.id,
    name: entry.name,
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

function isFinishedMatch(match) {
  return (
    match?.status === MATCH_STATUS.COMPLETED || match?.status === MATCH_STATUS.FORFEIT
  );
}

export function buildGroupStandingFromMatches({
  group,
  entries = [],
  matches = [],
  pointsConfig = {},
} = {}) {
  const winPts = Number(pointsConfig.win ?? 2);
  const lossPts = Number(pointsConfig.loss ?? 1);
  const forfeitPts = Number(pointsConfig.forfeit ?? 0);

  const entryMap = new Map(entries.map((entry) => [String(entry.id), entry]));
  const entryIds = new Set(
    (group.entryIds || []).map((id) => String(id)).filter(Boolean)
  );

  const rows = new Map();
  entryIds.forEach((entryId) => {
    const entry = entryMap.get(entryId);
    if (entry) {
      rows.set(entryId, createStandingRow(entry));
    }
  });

  const groupMatches = (matches || []).filter(
    (match) => String(match.groupId) === String(group.id) && isFinishedMatch(match)
  );

  groupMatches.forEach((match) => {
    const rowA = rows.get(String(match.entryAId));
    const rowB = rows.get(String(match.entryBId));
    if (!rowA || !rowB) {
      return;
    }

    rowA.played += 1;
    rowB.played += 1;

    if (match.status === MATCH_STATUS.FORFEIT) {
      if (String(match.winnerId) === String(match.entryAId)) {
        rowA.won += 1;
        rowB.lost += 1;
        rowA.matchPoints += winPts;
        rowB.matchPoints += forfeitPts;
      } else if (String(match.winnerId) === String(match.entryBId)) {
        rowB.won += 1;
        rowA.lost += 1;
        rowB.matchPoints += winPts;
        rowA.matchPoints += forfeitPts;
      }
      return;
    }

    const scoreA = toScore(match.scoreA);
    const scoreB = toScore(match.scoreB);
    rowA.pointsFor += scoreA;
    rowA.pointsAgainst += scoreB;
    rowB.pointsFor += scoreB;
    rowB.pointsAgainst += scoreA;

    if (scoreA > scoreB) {
      rowA.won += 1;
      rowB.lost += 1;
      rowA.matchPoints += winPts;
      rowB.matchPoints += lossPts;
    } else if (scoreB > scoreA) {
      rowB.won += 1;
      rowA.lost += 1;
      rowB.matchPoints += winPts;
      rowA.matchPoints += lossPts;
    } else {
      rowA.draw += 1;
      rowB.draw += 1;
      rowA.matchPoints += lossPts;
      rowB.matchPoints += lossPts;
    }
  });

  const standing = Array.from(rows.values())
    .map((row) => ({
      ...row,
      scoreDiff: row.pointsFor - row.pointsAgainst,
    }))
    .sort(compareStanding);

  return {
    groupId: group.id,
    group: String(group.label || group.name || "A"),
    matchCount: groupMatches.length,
    standing,
  };
}

export function buildAllGroupStandings(event, options = {}) {
  const qualifiersPerGroup = Number(options.qualifiersPerGroup) || 2;
  const entries = event?.entries || [];
  const matches = event?.matches || [];

  return (event?.groups || [])
    .map((group) =>
      buildGroupStandingFromMatches({
        group,
        entries,
        matches,
        pointsConfig: group.pointsConfig,
      })
    )
    .filter((groupStanding) => groupStanding.standing.length > 0)
    .sort((a, b) => a.group.localeCompare(b.group, "vi", { numeric: true }))
    .map((groupStanding) => ({
      ...groupStanding,
      qualified: groupStanding.standing.slice(0, qualifiersPerGroup),
    }));
}
