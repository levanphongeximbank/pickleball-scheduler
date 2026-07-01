import { getActiveClubId } from "../data/club.js";
import { PERMISSIONS } from "../auth/permissions.js";
import { guardClubAction } from "../auth/guardAction.js";
import { createSeasonRecord, normalizeSeason } from "../models/season.js";
import { loadClubData, saveClubData } from "./clubStorage.js";

export function listSeasons(clubId = getActiveClubId()) {
  return loadClubData(clubId).seasons;
}

export function getActiveSeason(clubId = getActiveClubId()) {
  const data = loadClubData(clubId);
  return (
    data.seasons.find((season) => season.id === data.active.seasonId) ||
    data.seasons.find((season) => season.status === "active") ||
    data.seasons[0] ||
    null
  );
}

export function createSeason(clubId, name, options = {}) {
  const trimmed = String(name || "").trim();

  if (trimmed === "") {
    return { ok: false, error: "Ten mua khong duoc de trong." };
  }

  const check = guardClubAction(clubId, PERMISSIONS.SEASON_UPDATE);
  if (!check.ok) {
    return check;
  }

  const data = loadClubData(clubId);
  const season = createSeasonRecord(clubId, trimmed, options);
  data.seasons = [...data.seasons, season];

  if (options.makeActive || data.seasons.length === 1) {
    data.active.seasonId = season.id;
  }

  saveClubData(clubId, data);
  return { ok: true, season };
}

export function updateSeason(clubId, seasonId, patch = {}) {
  const check = guardClubAction(clubId, PERMISSIONS.SEASON_UPDATE);
  if (!check.ok) {
    return check;
  }

  const data = loadClubData(clubId);
  const index = data.seasons.findIndex((season) => season.id === seasonId);

  if (index < 0) {
    return { ok: false, error: "Khong tim thay mua." };
  }

  data.seasons[index] = normalizeSeason({
    ...data.seasons[index],
    ...patch,
    id: seasonId,
    clubId,
  });

  saveClubData(clubId, data);
  return { ok: true, season: data.seasons[index] };
}

export function setActiveSeason(clubId, seasonId) {
  const data = loadClubData(clubId);
  const season = data.seasons.find((item) => item.id === seasonId);

  if (!season) {
    return { ok: false, error: "Khong tim thay mua." };
  }

  data.active.seasonId = seasonId;

  const leagueForSeason = data.leagues.find(
    (league) => league.seasonId === seasonId && league.status === "active"
  );

  if (leagueForSeason) {
    data.active.leagueId = leagueForSeason.id;
  }

  saveClubData(clubId, data);
  return { ok: true, season };
}

export function archiveSeason(clubId, seasonId) {
  const data = loadClubData(clubId);

  if (data.active.seasonId === seasonId) {
    return { ok: false, error: "Khong the luu tru mua dang active." };
  }

  return updateSeason(clubId, seasonId, { status: "archived" });
}

export function deleteSeason(clubId, seasonId) {
  const check = guardClubAction(clubId, PERMISSIONS.SEASON_UPDATE);
  if (!check.ok) {
    return check;
  }

  const data = loadClubData(clubId);

  if (data.active.seasonId === seasonId) {
    return { ok: false, error: "Khong the xoa mua dang active." };
  }

  const hasSessions = data.sessions.some(
    (session) => session.meta?.seasonId === seasonId
  );

  if (hasSessions) {
    return archiveSeason(clubId, seasonId);
  }

  data.seasons = data.seasons.filter((season) => season.id !== seasonId);
  data.leagues = data.leagues.filter((league) => league.seasonId !== seasonId);
  saveClubData(clubId, data);

  return { ok: true, archived: false };
}
