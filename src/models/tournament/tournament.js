import {
  OFFICIAL_MODE,
  TOURNAMENT_MODE,
  TOURNAMENT_STATUS,
} from "./constants.js";
import { normalizeEvents } from "./event.js";
import { normalizeCourtSchedule } from "./courtSchedule.js";

const VALID_MODES = new Set(Object.values(TOURNAMENT_MODE));
const VALID_OFFICIAL_MODES = new Set(Object.values(OFFICIAL_MODE));
const VALID_STATUSES = new Set(Object.values(TOURNAMENT_STATUS));

function normalizeMode(value) {
  const raw = String(value || "").trim().toLowerCase();
  return VALID_MODES.has(raw) ? raw : TOURNAMENT_MODE.DAILY_PLAY;
}

function normalizeOfficialMode(value) {
  if (!value) {
    return null;
  }
  const raw = String(value).trim().toLowerCase();
  return VALID_OFFICIAL_MODES.has(raw) ? raw : null;
}

function normalizeStatus(value) {
  const raw = String(value || "").trim().toLowerCase();
  return VALID_STATUSES.has(raw) ? raw : TOURNAMENT_STATUS.DRAFT;
}

export function normalizeTournament(tournament, index = 0) {
  if (!tournament || tournament.id === undefined || tournament.id === null) {
    return null;
  }

  const mode = normalizeMode(tournament.mode);

  return {
    ...tournament,
    id: String(tournament.id).trim(),
    clubId: tournament.clubId ? String(tournament.clubId).trim() : "",
    seasonId: tournament.seasonId ? String(tournament.seasonId).trim() : "",
    leagueId: tournament.leagueId ? String(tournament.leagueId).trim() : "",
    roundId: tournament.roundId ? String(tournament.roundId).trim() : "",
    name: String(tournament.name || `Giải ${index + 1}`).trim(),
    mode,
    officialMode:
      mode === TOURNAMENT_MODE.OFFICIAL_TOURNAMENT
        ? normalizeOfficialMode(tournament.officialMode) || OFFICIAL_MODE.OPEN
        : normalizeOfficialMode(tournament.officialMode),
    hostClubName: tournament.hostClubName
      ? String(tournament.hostClubName).trim()
      : "",
    events: normalizeEvents(tournament.events || []),
    status: normalizeStatus(tournament.status),
    settings:
      tournament.settings && typeof tournament.settings === "object"
        ? tournament.settings
        : {},
    courtSchedule: normalizeCourtSchedule(tournament.courtSchedule),
    createdAt: tournament.createdAt || new Date().toISOString(),
    updatedAt: tournament.updatedAt || new Date().toISOString(),
  };
}

export function normalizeTournaments(tournaments = []) {
  if (!Array.isArray(tournaments)) {
    return [];
  }

  return tournaments
    .map((tournament, index) => normalizeTournament(tournament, index))
    .filter(Boolean);
}

export function createTournamentRecord(clubId, options = {}) {
  const mode = normalizeMode(options.mode);

  return normalizeTournament({
    id: options.id || `tournament-${Date.now()}`,
    clubId,
    seasonId: options.seasonId || "",
    leagueId: options.leagueId || "",
    roundId: options.roundId || "",
    name: options.name || "Giải mới",
    mode,
    officialMode:
      mode === TOURNAMENT_MODE.OFFICIAL_TOURNAMENT
        ? options.officialMode || OFFICIAL_MODE.OPEN
        : options.officialMode || null,
    hostClubName: options.hostClubName || "",
    events: options.events || [],
    status: options.status || TOURNAMENT_STATUS.DRAFT,
    settings: options.settings || {},
    courtSchedule: options.courtSchedule || null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
}
