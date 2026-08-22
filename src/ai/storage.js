/*
==================================================
AI Storage — delegates to unified club blob v3
==================================================
*/

import { PERMISSIONS } from "../auth/permissions.js";
import { guardClubAction } from "../auth/guardAction.js";
import { DEFAULT_COMPETITION_TYPE } from "./competition.js";
import { SESSION_CAP } from "./config.js";
import {
  loadClubData,
  purgeLegacyAiScopedKeys,
  saveClubData,
} from "../domain/clubStorage.js";
import { assertExplicitClubId } from "../features/club/context/requireExplicitClubId.js";

const KEY = "pickleball-ai";
export const AI_SCHEMA_VERSION = 3;

function getDefaultAIData() {
  return {
    schemaVersion: AI_SCHEMA_VERSION,
    history: {},
    waiting: {},
    sessions: [],
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

function normalizeAIData(data) {
  const sessions = Array.isArray(data?.sessions)
    ? data.sessions.map((session) => ({
        ...session,
        meta: {
          ...(session?.meta || {}),
          competitionType:
            session?.meta?.competitionType || DEFAULT_COMPETITION_TYPE,
        },
      }))
    : [];

  return {
    ...getDefaultAIData(),
    ...data,
    schemaVersion: AI_SCHEMA_VERSION,
    history: data?.history || {},
    waiting: data?.waiting || {},
    sessions,
    policies: Array.isArray(data?.policies) ? data.policies : [],
    rules: Array.isArray(data?.rules) ? data.rules : [],
    tournament: {
      bracketWinners:
        data?.tournament?.bracketWinners && typeof data.tournament.bracketWinners === "object"
          ? data.tournament.bracketWinners
          : {},
      bracketUnlockedRounds:
        data?.tournament?.bracketUnlockedRounds &&
        typeof data.tournament.bracketUnlockedRounds === "object"
          ? data.tournament.bracketUnlockedRounds
          : {},
      seedPreview: Array.isArray(data?.tournament?.seedPreview)
        ? data.tournament.seedPreview
        : [],
      updatedAt: data?.tournament?.updatedAt || null,
    },
  };
}

function clubDataToAiView(clubData) {
  return normalizeAIData({
    schemaVersion: AI_SCHEMA_VERSION,
    history: clubData.ai.history,
    waiting: clubData.ai.waiting,
    sessions: clubData.sessions,
    policies: clubData.ai.policies,
    rules: clubData.ai.rules,
    tournament: clubData.ai.tournament,
  });
}

function applyAiViewToClubData(clubData, aiView) {
  const normalized = normalizeAIData(aiView);

  return {
    ...clubData,
    sessions: normalized.sessions.slice(-SESSION_CAP),
    ai: {
      history: normalized.history,
      waiting: normalized.waiting,
      policies: normalized.policies,
      rules: normalized.rules,
      tournament: normalized.tournament,
    },
  };
}

export function loadAIData(clubId) {
  const resolvedClubId = assertExplicitClubId(clubId);
  const clubData = loadClubData(resolvedClubId);
  return clubDataToAiView(clubData);
}

export function saveAIData(data, clubId, options = {}) {
  const resolvedClubId = assertExplicitClubId(clubId);
  const clubData = loadClubData(resolvedClubId);
  const next = applyAiViewToClubData(clubData, data);
  saveClubData(resolvedClubId, next, options);
  purgeLegacyAiScopedKeys(resolvedClubId);
}

export function resetAIData(clubId) {
  const resolvedClubId = assertExplicitClubId(clubId);
  const check = guardClubAction(resolvedClubId, PERMISSIONS.SYSTEM_SETTING);
  if (!check.ok) {
    return check;
  }

  const clubData = loadClubData(resolvedClubId);
  const next = applyAiViewToClubData(clubData, getDefaultAIData());
  saveClubData(resolvedClubId, next);
  purgeLegacyAiScopedKeys(resolvedClubId);
  localStorage.removeItem(`${KEY}::${resolvedClubId}`);
  return { ok: true };
}
