import { normalizeLeague } from "../models/league.js";
import { normalizeSeason } from "../models/season.js";
import { PERMISSIONS } from "../auth/permissions.js";
import { guardClubAction } from "../auth/guardAction.js";
import { guardSubscriptionForClub } from "../auth/subscriptionGuard.js";
import { buildSeasonExportPackage } from "../tournament/engines/seasonExportEngine.js";
import { getClubById } from "./clubService.js";
import { loadClubData, saveClubData } from "./clubStorage.js";

function filterBySeasonId(items = [], seasonId) {
  return items.filter((item) => String(item.seasonId || "") === String(seasonId));
}

export function buildSeasonExport(clubId, seasonId) {
  const check = guardClubAction(clubId, PERMISSIONS.STATISTICS_EXPORT);
  if (!check.ok) {
    return check;
  }

  const planCheck = guardSubscriptionForClub(clubId, "statistics");
  if (!planCheck.ok) {
    return planCheck;
  }

  const data = loadClubData(clubId);
  const season = data.seasons.find((item) => item.id === seasonId);

  if (!season) {
    return { ok: false, error: "Khong tim thay mua." };
  }

  const club = getClubById(clubId);
  const leagues = filterBySeasonId(data.leagues || [], seasonId);
  const rounds = filterBySeasonId(data.rounds || [], seasonId);
  const tournaments = filterBySeasonId(data.tournaments || [], seasonId);

  const packagePayload = buildSeasonExportPackage({
    clubId,
    clubName: club?.name || "",
    season,
    leagues,
    rounds,
    tournaments,
    seasonStandings: data.seasonStandings || {},
    players: data.players || [],
  });

  return { ok: true, package: packagePayload };
}

export function closeSeason(clubId, seasonId, options = {}) {
  const check = guardClubAction(clubId, PERMISSIONS.SEASON_UPDATE);
  if (!check.ok) {
    return check;
  }

  const data = loadClubData(clubId);
  const index = data.seasons.findIndex((item) => item.id === seasonId);

  if (index < 0) {
    return { ok: false, error: "Khong tim thay mua." };
  }

  const season = data.seasons[index];

  if (season.status === "completed") {
    return { ok: false, error: "Mua da duoc chot truoc do." };
  }

  if (season.status === "archived") {
    return { ok: false, error: "Mua da luu tru, khong the chot." };
  }

  if (data.active.seasonId === seasonId && !options.force) {
    return {
      ok: false,
      error: "Hay chuyen sang mua khac truoc khi chot mua dang active.",
    };
  }

  const today = new Date().toISOString().slice(0, 10);

  data.seasons[index] = normalizeSeason({
    ...season,
    status: "completed",
    endDate: season.endDate || today,
  });

  data.leagues = (data.leagues || []).map((league) => {
    if (league.seasonId !== seasonId) {
      return league;
    }

    if (league.status === "completed" || league.status === "archived") {
      return league;
    }

    return normalizeLeague({ ...league, status: "completed" });
  });

  data.rounds = (data.rounds || []).map((round) => {
    if (round.seasonId !== seasonId) {
      return round;
    }

    if (round.status === "completed") {
      return round;
    }

    return { ...round, status: "completed" };
  });

  data.updatedAt = new Date().toISOString();
  saveClubData(clubId, data);

  const exportResult = buildSeasonExport(clubId, seasonId);

  return {
    ok: true,
    season: data.seasons[index],
    export: exportResult.ok ? exportResult.package : null,
  };
}
