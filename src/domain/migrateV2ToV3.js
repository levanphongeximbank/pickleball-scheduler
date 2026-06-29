import { getScopedStorageKey } from "../data/club.js";
import { DEFAULT_COMPETITION_TYPE } from "../ai/competition.js";
import { getDefaultClubData } from "./clubStorage.js";
import { normalizeCourts } from "../models/court.js";
import { normalizePlayers } from "../models/player.js";

function safeParseArray(raw) {
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function safeParseObject(raw) {
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function readLegacyAi(clubId) {
  const scopedKey = getScopedStorageKey("pickleball-ai", clubId);
  const raw =
    localStorage.getItem(scopedKey) ||
    localStorage.getItem("pickleball-ai");

  const parsed = safeParseObject(raw);
  if (!parsed) {
    return null;
  }

  return {
    history: parsed.history || {},
    waiting: parsed.waiting || {},
    sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
    policies: Array.isArray(parsed.policies) ? parsed.policies : [],
    rules: Array.isArray(parsed.rules) ? parsed.rules : [],
    tournament: parsed.tournament || {
      bracketWinners: {},
      bracketUnlockedRounds: {},
      seedPreview: [],
      updatedAt: null,
    },
  };
}

function readActiveSlot(clubId) {
  const scopedKey = getScopedStorageKey("pickleball-active-slot", clubId);
  const raw =
    localStorage.getItem(scopedKey) ||
    localStorage.getItem("pickleball-active-slot");

  return safeParseObject(raw);
}

export function migrateV2ToV3(clubId) {
  const base = getDefaultClubData(clubId);

  const playersRaw =
    localStorage.getItem(getScopedStorageKey("players", clubId)) ||
    localStorage.getItem("players");
  const courtsRaw =
    localStorage.getItem(getScopedStorageKey("courts", clubId)) ||
    localStorage.getItem("courts");
  const roundsRaw =
    localStorage.getItem(
      getScopedStorageKey("pickleball-tournament-rounds", clubId)
    ) || localStorage.getItem("pickleball-tournament-rounds");

  const legacyAi = readLegacyAi(clubId);
  const activeSlot = readActiveSlot(clubId);

  const sessions = (legacyAi?.sessions || []).map((session) => ({
    ...session,
    meta: {
      ...(session?.meta || {}),
      clubId: session?.meta?.clubId || clubId,
      competitionType:
        session?.meta?.competitionType || DEFAULT_COMPETITION_TYPE,
    },
  }));

  return {
    ...base,
    players: normalizePlayers(safeParseArray(playersRaw)),
    courts: normalizeCourts(safeParseArray(courtsRaw)),
    rounds: safeParseArray(roundsRaw),
    sessions,
    ai: {
      history: legacyAi?.history || {},
      waiting: legacyAi?.waiting || {},
      policies: legacyAi?.policies || [],
      rules: legacyAi?.rules || [],
      tournament: legacyAi?.tournament || base.ai.tournament,
    },
    active: {
      seasonId: null,
      leagueId: null,
      roundSlot: activeSlot,
    },
    updatedAt: new Date().toISOString(),
  };
}
