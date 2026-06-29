import { getActiveClubId, getScopedStorageKey } from "../data/club.js";
import { DEFAULT_COMPETITION_TYPE } from "../ai/competition.js";
import { DEFAULT_SKILL_LEVEL_RULES } from "../ai/config.js";
import { createLeagueRecord } from "../models/league.js";
import { createSeasonRecord } from "../models/season.js";
import { normalizeCourts } from "../models/court.js";
import { normalizePlayers } from "../models/player.js";
import { normalizeBookings } from "../models/booking.js";
import { normalizeCustomers } from "../models/customer.js";
import { normalizeTournaments } from "../models/tournament/index.js";
import { migrateV2ToV3 } from "./migrateV2ToV3.js";
import { normalizeCourtManagementSettings } from "./courtManagementSettings.js";

export const CLUB_DATA_KEY = "pickleball-club-data-v3";
export const CLUB_SCHEMA_VERSION = 3.5;

export const SCOPED_LEGACY_KEYS = [
  "players",
  "courts",
  "pickleball-ai",
  "pickleball-director",
  "pickleball_ai_waiting",
  "pickleball-tournament-rounds",
  "pickleball-active-slot",
  "pickleball-tournament-bracket-winners",
];

const BACKUP_SNAPSHOTS_BASE_KEY = "pickleball-ai-backup-snapshots";

export function getClubDataKey(clubId) {
  return `${CLUB_DATA_KEY}::${clubId}`;
}

export function getScopedSnapshotsKey(clubId = getActiveClubId()) {
  return getScopedStorageKey(BACKUP_SNAPSHOTS_BASE_KEY, clubId);
}

function getDefaultAiSection() {
  return {
    history: {},
    waiting: {},
    policies: [],
    rules: [],
    tournament: {
      bracketWinners: {},
      bracketUnlockedRounds: {},
      seedPreview: [],
      updatedAt: null,
    },
  };
}

export function getDefaultClubData(clubId) {
  return {
    schemaVersion: CLUB_SCHEMA_VERSION,
    clubId,
    players: [],
    courts: [],
    bookings: [],
    customers: [],
    recurringSeries: [],
    courtManagement: {
      openHour: 0,
      closeHour: 24,
      slotMinutes: 60,
      peakHourRules: {
        enabled: false,
        startHour: 17,
        endHour: 22,
        weekdays: [0, 1, 2, 3, 4, 5, 6],
      },
      notificationSettings: {
        enabled: false,
        minutesBefore: 30,
        browserNotify: true,
        inAppNotify: true,
      },
      automationSettings: {
        autoCompleteOnOpen: false,
        autoStartPlaying: false,
      },
    },
    seasons: [],
    leagues: [],
    rounds: [],
    sessions: [],
    tournaments: [],
    seasonStandings: {},
    skillLevel: { ...DEFAULT_SKILL_LEVEL_RULES },
    skillLevelProposals: [],
    ai: getDefaultAiSection(),
    active: {
      seasonId: null,
      leagueId: null,
      roundSlot: null,
    },
    updatedAt: new Date().toISOString(),
  };
}

function safeParse(raw, fallback = null) {
  if (!raw) {
    return fallback;
  }

  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function ensureDefaultSeasonAndLeague(data) {
  const next = { ...data };

  if (!Array.isArray(next.seasons)) {
    next.seasons = [];
  }

  if (!Array.isArray(next.leagues)) {
    next.leagues = [];
  }

  if (!next.active || typeof next.active !== "object") {
    next.active = { seasonId: null, leagueId: null, roundSlot: null };
  }

  if (next.seasons.length === 0) {
    const season = createSeasonRecord(next.clubId, "Mua hien tai", {
      status: "active",
    });
    next.seasons.push(season);
    next.active.seasonId = season.id;
  }

  if (!next.active.seasonId) {
    const activeSeason =
      next.seasons.find((item) => item.status === "active") || next.seasons[0];
    next.active.seasonId = activeSeason?.id || null;
  }

  if (next.leagues.length === 0 && next.active.seasonId) {
    const league = createLeagueRecord(
      next.clubId,
      next.active.seasonId,
      "Giao luu",
      {
        format: "social",
        competitionType: DEFAULT_COMPETITION_TYPE,
        status: "active",
      }
    );
    next.leagues.push(league);
    next.active.leagueId = league.id;
  }

  if (!next.active.leagueId) {
    const activeLeague =
      next.leagues.find(
        (item) =>
          item.status === "active" && item.seasonId === next.active.seasonId
      ) || next.leagues.find((item) => item.seasonId === next.active.seasonId);
    next.active.leagueId = activeLeague?.id || null;
  }

  return next;
}

function upgradeClubSchema(data, clubId) {
  const base = getDefaultClubData(clubId);

  return {
    ...base,
    ...data,
    schemaVersion: CLUB_SCHEMA_VERSION,
    tournaments: Array.isArray(data?.tournaments) ? data.tournaments : [],
  };
}

function normalizeClubData(data, clubId) {
  const upgraded = upgradeClubSchema(data, clubId);

  return ensureDefaultSeasonAndLeague({
    ...upgraded,
    clubId,
    players: normalizePlayers(upgraded.players || []),
    courts: normalizeCourts(upgraded.courts || []),
    bookings: normalizeBookings(upgraded.bookings || []),
    customers: normalizeCustomers(upgraded.customers || []),
    recurringSeries: Array.isArray(upgraded.recurringSeries) ? upgraded.recurringSeries : [],
    courtManagement: normalizeCourtManagementSettings(upgraded.courtManagement || {}),
    seasons: Array.isArray(upgraded.seasons) ? upgraded.seasons : [],
    leagues: Array.isArray(upgraded.leagues) ? upgraded.leagues : [],
    rounds: Array.isArray(upgraded.rounds) ? upgraded.rounds : [],
    sessions: Array.isArray(upgraded.sessions) ? upgraded.sessions : [],
    tournaments: normalizeTournaments(upgraded.tournaments || []),
    seasonStandings:
      upgraded.seasonStandings && typeof upgraded.seasonStandings === "object"
        ? upgraded.seasonStandings
        : {},
    skillLevel: {
      ...DEFAULT_SKILL_LEVEL_RULES,
      ...(upgraded.skillLevel && typeof upgraded.skillLevel === "object"
        ? upgraded.skillLevel
        : {}),
    },
    skillLevelProposals: Array.isArray(upgraded.skillLevelProposals)
      ? upgraded.skillLevelProposals
      : [],
    ai: {
      ...getDefaultAiSection(),
      ...(upgraded.ai || {}),
      tournament: {
        ...getDefaultAiSection().tournament,
        ...(upgraded.ai?.tournament || {}),
      },
    },
    active: {
      ...getDefaultClubData(clubId).active,
      ...(upgraded.active || {}),
    },
    updatedAt: upgraded.updatedAt || new Date().toISOString(),
  });
}

export function loadClubData(clubId = getActiveClubId()) {
  const key = getClubDataKey(clubId);
  const raw = localStorage.getItem(key);

  if (raw) {
    const parsed = safeParse(raw, null);
    if (parsed) {
      return normalizeClubData(parsed, clubId);
    }
  }

  const migrated = migrateV2ToV3(clubId);
  return saveClubData(clubId, migrated);
}

export function saveClubData(clubId, data) {
  const normalized = normalizeClubData(
    {
      ...data,
      updatedAt: new Date().toISOString(),
    },
    clubId
  );

  localStorage.setItem(getClubDataKey(clubId), JSON.stringify(normalized));
  return normalized;
}

export function purgeClubData(clubId) {
  SCOPED_LEGACY_KEYS.forEach((baseKey) => {
    localStorage.removeItem(getScopedStorageKey(baseKey, clubId));
  });

  localStorage.removeItem(getClubDataKey(clubId));
  localStorage.removeItem(getScopedSnapshotsKey(clubId));
}

export function loadPlayersForClub(clubId = getActiveClubId()) {
  return loadClubData(clubId).players;
}

export function savePlayersForClub(players, clubId = getActiveClubId()) {
  const data = loadClubData(clubId);
  data.players = normalizePlayers(players);
  return saveClubData(clubId, data);
}

export function loadCourtsForClub(clubId = getActiveClubId()) {
  return loadClubData(clubId).courts;
}

export function saveCourtsForClub(courts, clubId = getActiveClubId()) {
  const data = loadClubData(clubId);
  data.courts = normalizeCourts(courts);
  return saveClubData(clubId, data);
}

export function loadBookingsForClub(clubId = getActiveClubId()) {
  return loadClubData(clubId).bookings;
}

export function saveBookingsForClub(bookings, clubId = getActiveClubId()) {
  const data = loadClubData(clubId);
  data.bookings = normalizeBookings(bookings);
  return saveClubData(clubId, data);
}

export function loadCustomersForClub(clubId = getActiveClubId()) {
  return loadClubData(clubId).customers;
}

export function saveCustomersForClub(customers, clubId = getActiveClubId()) {
  const data = loadClubData(clubId);
  data.customers = normalizeCustomers(customers);
  return saveClubData(clubId, data);
}

export function loadRecurringSeriesForClub(clubId = getActiveClubId()) {
  return loadClubData(clubId).recurringSeries || [];
}

export function saveRecurringSeriesForClub(series, clubId = getActiveClubId()) {
  const data = loadClubData(clubId);
  data.recurringSeries = Array.isArray(series) ? series : [];
  return saveClubData(clubId, data);
}

export function loadRoundsForClub(clubId = getActiveClubId()) {
  return loadClubData(clubId).rounds;
}

export function saveRoundsForClub(rounds, clubId = getActiveClubId()) {
  const data = loadClubData(clubId);
  data.rounds = Array.isArray(rounds) ? rounds : [];
  return saveClubData(clubId, data);
}

export function loadSessionsForClub(clubId = getActiveClubId()) {
  return loadClubData(clubId).sessions;
}

export function saveSessionsForClub(sessions, clubId = getActiveClubId()) {
  const data = loadClubData(clubId);
  data.sessions = Array.isArray(sessions) ? sessions : [];
  return saveClubData(clubId, data);
}

export function loadTournamentsForClub(clubId = getActiveClubId()) {
  return loadClubData(clubId).tournaments;
}

export function saveTournamentsForClub(tournaments, clubId = getActiveClubId()) {
  const data = loadClubData(clubId);
  data.tournaments = normalizeTournaments(tournaments);
  return saveClubData(clubId, data);
}

export function getActivePointers(clubId = getActiveClubId()) {
  return loadClubData(clubId).active;
}

export function setActivePointers(pointers, clubId = getActiveClubId()) {
  const data = loadClubData(clubId);
  data.active = {
    ...data.active,
    ...pointers,
  };
  return saveClubData(clubId, data);
}

export function buildFullClubExport(clubId = getActiveClubId()) {
  const data = loadClubData(clubId);
  return {
    schemaVersion: CLUB_SCHEMA_VERSION,
    type: "club-full",
    exportedAt: new Date().toISOString(),
    clubId,
    data,
  };
}

export function validateClubPayloadForSync(rawData, clubId) {
  const warnings = [];

  if (!rawData || typeof rawData !== "object") {
    return {
      ok: false,
      message: "Dữ liệu cloud không hợp lệ.",
      data: getDefaultClubData(clubId),
      warnings,
    };
  }

  if (rawData.bookings != null && !Array.isArray(rawData.bookings)) {
    warnings.push("bookings đã được chuẩn hóa từ dữ liệu cloud.");
  }

  if (rawData.customers != null && !Array.isArray(rawData.customers)) {
    warnings.push("customers đã được chuẩn hóa từ dữ liệu cloud.");
  }

  if (rawData.courtManagement != null && typeof rawData.courtManagement !== "object") {
    warnings.push("courtManagement đã được chuẩn hóa từ dữ liệu cloud.");
  }

  const data = normalizeClubData(rawData, clubId);

  return {
    ok: true,
    data,
    warnings,
  };
}
