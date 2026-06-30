import { listTournaments, createTournament } from "./tournamentService.js";
import {
  TOURNAMENT_MODE,
  TOURNAMENT_STATUS,
} from "../models/tournament/index.js";

const OPEN_DAILY_STATUSES = new Set([
  TOURNAMENT_STATUS.DRAFT,
  TOURNAMENT_STATUS.REGISTRATION,
  TOURNAMENT_STATUS.READY,
  TOURNAMENT_STATUS.ACTIVE,
]);

function buildDailyPlayName() {
  const date = new Date().toLocaleDateString("vi-VN");
  return `Chơi vui ${date}`;
}

function sortByRecent(tournaments = []) {
  return [...tournaments].sort((left, right) => {
    const leftTime = Date.parse(left.updatedAt || left.createdAt || 0);
    const rightTime = Date.parse(right.updatedAt || right.createdAt || 0);
    return rightTime - leftTime;
  });
}

export function findOpenDailyPlayTournament(clubId, { seasonId, leagueId } = {}) {
  const filters = { mode: TOURNAMENT_MODE.DAILY_PLAY };
  if (seasonId) {
    filters.seasonId = seasonId;
  }
  if (leagueId) {
    filters.leagueId = leagueId;
  }

  const openTournaments = listTournaments(clubId, filters).filter((tournament) =>
    OPEN_DAILY_STATUSES.has(tournament.status)
  );

  return sortByRecent(openTournaments)[0] || null;
}

export function startQuickDailyPlay(clubId, { seasonId, leagueId } = {}) {
  return createTournament(clubId, {
    name: buildDailyPlayName(),
    mode: TOURNAMENT_MODE.DAILY_PLAY,
    seasonId,
    leagueId,
  });
}

export function resolveDailyPlayEntry(
  clubId,
  { seasonId, leagueId, allowCreate = true } = {}
) {
  const existing = findOpenDailyPlayTournament(clubId, { seasonId, leagueId });

  if (existing) {
    return { ok: true, tournament: existing, created: false };
  }

  if (!allowCreate) {
    return { ok: false, error: "Chưa có buổi chơi vui đang mở." };
  }

  const created = startQuickDailyPlay(clubId, { seasonId, leagueId });
  if (!created.ok) {
    return created;
  }

  return { ok: true, tournament: created.tournament, created: true };
}