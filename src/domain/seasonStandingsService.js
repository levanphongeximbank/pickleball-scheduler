import { loadClubData, saveClubData } from "./clubStorage.js";
import {
  applyMatchRecordToLeagueStandings,
  buildLeagueStandingsRows,
  createEmptyLeagueStandings,
} from "../tournament/engines/seasonStandingsEngine.js";

function normalizeLeagueStandingsMap(value) {
  if (!value || typeof value !== "object") {
    return {};
  }
  return value;
}

export function getLeagueStandings(clubId, leagueId) {
  const data = loadClubData(clubId);
  const map = normalizeLeagueStandingsMap(data.seasonStandings);
  return map[leagueId] || createEmptyLeagueStandings();
}

export function getLeagueStandingsBoard(clubId, leagueId) {
  const data = loadClubData(clubId);
  const standings = getLeagueStandings(clubId, leagueId);
  return buildLeagueStandingsRows(standings, data.players || []);
}

export function applySeasonPointsFromMatchRecord(clubId, leagueId, record) {
  if (!leagueId || !record?.id) {
    return { ok: true, skipped: true };
  }

  const data = loadClubData(clubId);
  const league = (data.leagues || []).find((item) => item.id === leagueId);
  if (!league) {
    return { ok: false, error: "Khong tim thay giai de cong diem mua." };
  }

  const map = normalizeLeagueStandingsMap(data.seasonStandings);
  const current = map[leagueId] || createEmptyLeagueStandings();
  map[leagueId] = applyMatchRecordToLeagueStandings(
    current,
    record,
    league.pointsSystem || {}
  );

  data.seasonStandings = map;
  data.updatedAt = new Date().toISOString();
  saveClubData(clubId, data);

  return { ok: true, standings: map[leagueId] };
}
