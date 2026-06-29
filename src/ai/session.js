/*
==================================================
AI Session Engine
==================================================
*/

import { getActiveClubId, getScopedStorageKey } from "../data/club.js";
import { SESSION_CAP } from "./config.js";
import { loadAIData, saveAIData } from "./storage.js";
import { createDebugTrace, appendDebugTrace } from "./debug.js";
import { loadClubData } from "../domain/clubStorage.js";

const ACTIVE_SLOT_KEY = "pickleball-active-slot";

function getActiveSlotMeta(clubId = getActiveClubId()) {
  if (typeof localStorage === "undefined") {
    return null;
  }

  const clubData = loadClubData(clubId);

  if (clubData.active?.roundSlot) {
    return clubData.active.roundSlot;
  }

  try {
    const raw =
      localStorage.getItem(getScopedStorageKey(ACTIVE_SLOT_KEY, clubId)) ||
      localStorage.getItem(ACTIVE_SLOT_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      return null;
    }

    return {
      roundId: parsed.roundId || null,
      roundName: parsed.roundName || null,
      shiftLabel: parsed.shiftLabel || null,
    };
  } catch {
    return null;
  }
}

function buildSessionMeta(resultMeta = {}, clubId = getActiveClubId()) {
  const clubData = loadClubData(clubId);
  const activeMeta = getActiveSlotMeta(clubId);

  return {
    ...(activeMeta || {}),
    ...(resultMeta || {}),
    clubId: resultMeta?.clubId || clubId,
    seasonId: resultMeta?.seasonId || clubData.active?.seasonId || null,
    leagueId: resultMeta?.leagueId || clubData.active?.leagueId || null,
  };
}

export function saveSession(result, clubId = getActiveClubId()) {
  const data = loadAIData(clubId);
  const trace = [createDebugTrace("session.save", { courtCount: result?.courts?.length || 0 })];
  const sessionMeta = buildSessionMeta(result?.meta, clubId);

  data.sessions.push({
    id: Date.now(),
    date: new Date().toISOString(),
    courts: result.courts,
    waiting: result.waiting,
    aiScore: result.aiScore || null,
    meta: sessionMeta,
  });

  if (data.sessions.length > SESSION_CAP) {
    data.sessions.shift();
  }

  saveAIData(data, clubId);

  return appendDebugTrace(trace, createDebugTrace("session.saved", { sessionCount: data.sessions.length }));
}

export function getSessions(clubId = getActiveClubId()) {
  return loadAIData(clubId).sessions;
}

export function clearSessions(clubId = getActiveClubId()) {
  const data = loadAIData(clubId);
  data.sessions = [];
  saveAIData(data, clubId);
}

export { buildSessionMeta };
