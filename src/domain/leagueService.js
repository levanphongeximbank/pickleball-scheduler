import { getActiveClubId } from "../data/club.js";
import { PERMISSIONS } from "../auth/permissions.js";
import { guardClubAction } from "../auth/guardAction.js";
import { createLeagueRecord, normalizeLeague } from "../models/league.js";
import { loadClubData, saveClubData } from "./clubStorage.js";

export function listLeagues(clubId = getActiveClubId(), seasonId = null) {
  const data = loadClubData(clubId);

  if (!seasonId) {
    return data.leagues;
  }

  return data.leagues.filter((league) => league.seasonId === seasonId);
}

export function getActiveLeague(clubId = getActiveClubId()) {
  const data = loadClubData(clubId);
  return (
    data.leagues.find((league) => league.id === data.active.leagueId) ||
    data.leagues.find(
      (league) =>
        league.seasonId === data.active.seasonId && league.status === "active"
    ) ||
    data.leagues[0] ||
    null
  );
}

export function createLeague(clubId, seasonId, name, options = {}) {
  const trimmed = String(name || "").trim();

  if (trimmed === "") {
    return { ok: false, error: "Ten giai khong duoc de trong." };
  }

  const check = guardClubAction(clubId, PERMISSIONS.LEAGUE_UPDATE);
  if (!check.ok) {
    return check;
  }

  const data = loadClubData(clubId);
  const season = data.seasons.find((item) => item.id === seasonId);

  if (!season) {
    return { ok: false, error: "Khong tim thay mua cho giai." };
  }

  const league = createLeagueRecord(clubId, seasonId, trimmed, options);
  data.leagues = [...data.leagues, league];

  if (options.makeActive) {
    data.active.leagueId = league.id;
  }

  saveClubData(clubId, data);
  return { ok: true, league };
}

export function updateLeague(clubId, leagueId, patch = {}) {
  const check = guardClubAction(clubId, PERMISSIONS.LEAGUE_UPDATE);
  if (!check.ok) {
    return check;
  }

  const data = loadClubData(clubId);
  const index = data.leagues.findIndex((league) => league.id === leagueId);

  if (index < 0) {
    return { ok: false, error: "Khong tim thay giai." };
  }

  data.leagues[index] = normalizeLeague({
    ...data.leagues[index],
    ...patch,
    id: leagueId,
    clubId,
    seasonId: data.leagues[index].seasonId,
  });

  saveClubData(clubId, data);
  return { ok: true, league: data.leagues[index] };
}

export function setActiveLeague(clubId, leagueId) {
  const data = loadClubData(clubId);
  const league = data.leagues.find((item) => item.id === leagueId);

  if (!league) {
    return { ok: false, error: "Khong tim thay giai." };
  }

  data.active.leagueId = leagueId;
  data.active.seasonId = league.seasonId;
  saveClubData(clubId, data);

  return { ok: true, league };
}

export function completeLeague(clubId, leagueId) {
  return updateLeague(clubId, leagueId, { status: "completed" });
}

export function deleteLeague(clubId, leagueId) {
  const check = guardClubAction(clubId, PERMISSIONS.LEAGUE_UPDATE);
  if (!check.ok) {
    return check;
  }

  const data = loadClubData(clubId);

  if (data.active.leagueId === leagueId) {
    return { ok: false, error: "Khong the xoa giai dang active." };
  }

  const hasSessions = data.sessions.some(
    (session) => session.meta?.leagueId === leagueId
  );

  if (hasSessions) {
    return completeLeague(clubId, leagueId);
  }

  data.leagues = data.leagues.filter((league) => league.id !== leagueId);
  saveClubData(clubId, data);

  return { ok: true };
}
