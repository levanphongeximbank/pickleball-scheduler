import { VPR_PLACEMENT_RANK } from "../constants/vprPlacements.js";
import {
  listLeaderboardRows,
  listLedgerEntries,
  saveLeaderboardRows,
} from "../storage/vprLocalStore.js";

function betterPlacement(current, candidate) {
  if (!current) {
    return candidate;
  }
  const currentRank = VPR_PLACEMENT_RANK[current] || 99;
  const candidateRank = VPR_PLACEMENT_RANK[candidate] || 99;
  return candidateRank < currentRank ? candidate : current;
}

export function rebuildLeaderboardFromLedger(ledger = listLedgerEntries()) {
  const map = new Map();

  ledger.forEach((entry) => {
    const key = `${entry.category}::${entry.vprAthleteId}`;
    const current = map.get(key) || {
      category: entry.category,
      vprAthleteId: entry.vprAthleteId,
      displayName: entry.displayName || "",
      clubName: entry.clubName || "",
      region: entry.region || "",
      gender: entry.gender || "unknown",
      totalPoints: 0,
      tournamentsCount: 0,
      bestPlacement: null,
      tournamentIds: new Set(),
    };

    current.totalPoints += Number(entry.points) || 0;
    current.tournamentIds.add(`${entry.clubId}::${entry.tournamentId}`);
    current.tournamentsCount = current.tournamentIds.size;
    current.bestPlacement = betterPlacement(current.bestPlacement, entry.placement);
    current.displayName = entry.displayName || current.displayName;
    current.clubName = entry.clubName || current.clubName;
    current.region = entry.region || current.region;
    map.set(key, current);
  });

  const byCategory = new Map();
  for (const row of map.values()) {
    const { tournamentIds, ...rest } = row;
    const list = byCategory.get(rest.category) || [];
    list.push(rest);
    byCategory.set(rest.category, list);
  }

  const leaderboard = [];
  for (const [category, rows] of byCategory.entries()) {
    const sorted = rows.sort((a, b) => b.totalPoints - a.totalPoints);
    sorted.forEach((row, index) => {
      leaderboard.push({ ...row, category, rank: index + 1 });
    });
  }

  saveLeaderboardRows(leaderboard);
  return leaderboard;
}

export function queryPublicLeaderboard({
  category = null,
  region = null,
  gender = null,
  year = null,
  search = "",
} = {}) {
  let rows = listLeaderboardRows();
  if (!rows.length) {
    rows = rebuildLeaderboardFromLedger();
  }

  if (category) {
    rows = rows.filter((row) => row.category === category);
  }
  if (region && region !== "Tất cả") {
    rows = rows.filter((row) => row.region === region);
  }
  if (gender) {
    rows = rows.filter((row) => row.gender === gender);
  }
  if (year) {
    const ledger = listLedgerEntries().filter((entry) => {
      const awardedYear = entry.awardedAt ? new Date(entry.awardedAt).getFullYear() : null;
      return awardedYear === Number(year);
    });
    const athletePoints = new Map();
    ledger.forEach((entry) => {
      const key = `${entry.category}::${entry.vprAthleteId}`;
      athletePoints.set(key, (athletePoints.get(key) || 0) + (entry.points || 0));
    });
    rows = rows
      .map((row) => ({
        ...row,
        totalPoints: athletePoints.get(`${row.category}::${row.vprAthleteId}`) ?? 0,
      }))
      .filter((row) => row.totalPoints > 0)
      .sort((a, b) => b.totalPoints - a.totalPoints)
      .map((row, index) => ({ ...row, rank: index + 1 }));
  }
  if (search) {
    const q = search.trim().toLowerCase();
    rows = rows.filter((row) => row.displayName?.toLowerCase().includes(q));
  }

  return rows;
}

export function getAthleteLedgerHistory(vprAthleteId, category = null) {
  let rows = listLedgerEntries().filter((entry) => entry.vprAthleteId === vprAthleteId);
  if (category) {
    rows = rows.filter((entry) => entry.category === category);
  }
  return rows.sort((a, b) => String(b.awardedAt).localeCompare(String(a.awardedAt)));
}

export function getAthleteProfileSummary(vprAthleteId, category) {
  const history = getAthleteLedgerHistory(vprAthleteId, category);
  const leaderboard = listLeaderboardRows().find(
    (row) => row.vprAthleteId === vprAthleteId && row.category === category
  );
  const cumulative = [];
  let running = 0;
  [...history].reverse().forEach((entry) => {
    running += entry.points || 0;
    cumulative.push({ at: entry.awardedAt, points: running, tournamentName: entry.tournamentName });
  });

  return {
    totalPoints: history.reduce((sum, entry) => sum + (entry.points || 0), 0),
    rank: leaderboard?.rank || null,
    tournamentsCount: new Set(history.map((entry) => `${entry.clubId}::${entry.tournamentId}`)).size,
    bestPlacement: leaderboard?.bestPlacement || null,
    history,
    cumulativeChart: cumulative,
    displayName: leaderboard?.displayName || history[0]?.displayName || "",
    clubName: leaderboard?.clubName || history[0]?.clubName || "",
    region: leaderboard?.region || history[0]?.region || "",
  };
}
