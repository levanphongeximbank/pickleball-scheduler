import { DEFAULT_COMPETITION_TYPE } from "../ai/competition.js";
import { DEFAULT_POINTS_SYSTEM } from "../ai/config.js";

function createLeagueId() {
  return `league-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function normalizeLeague(league) {
  return {
    id: String(league?.id || "").trim(),
    clubId: String(league?.clubId || "").trim(),
    seasonId: String(league?.seasonId || "").trim(),
    name: String(league?.name || "").trim(),
    format: league?.format || "social",
    competitionType: league?.competitionType || DEFAULT_COMPETITION_TYPE,
    pointsSystem: {
      win: Number(league?.pointsSystem?.win ?? DEFAULT_POINTS_SYSTEM.win),
      draw: Number(league?.pointsSystem?.draw ?? DEFAULT_POINTS_SYSTEM.draw),
      loss: Number(league?.pointsSystem?.loss ?? DEFAULT_POINTS_SYSTEM.loss),
    },
    status: league?.status || "draft",
    createdAt: league?.createdAt || new Date().toISOString(),
  };
}

export function createLeagueRecord(clubId, seasonId, name, options = {}) {
  return normalizeLeague({
    id: options.id || createLeagueId(),
    clubId,
    seasonId,
    name: String(name || "").trim(),
    format: options.format || "social",
    competitionType: options.competitionType || DEFAULT_COMPETITION_TYPE,
    pointsSystem: options.pointsSystem || DEFAULT_POINTS_SYSTEM,
    status: options.status || "active",
    createdAt: new Date().toISOString(),
  });
}
