/*
==========================================================
Director Engine
==========================================================
*/

import { getActiveClubId, getScopedStorageKey } from "../data/club.js";
import { guardCourtLockAction } from "../auth/guardAction.js";
import { loadClubData, saveClubData } from "../domain/clubStorage.js";

const STORAGE_KEY = "pickleball-director";

function getDefaultDirectorState() {
  return {
    lockedCourts: [],
    lockedPlayers: [],
  };
}

function migrateLegacyDirector(clubId) {
  if (typeof localStorage === "undefined") {
    return null;
  }

  const scopedKey = getScopedStorageKey(STORAGE_KEY, clubId);
  const raw = localStorage.getItem(scopedKey) || localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw);
    localStorage.removeItem(scopedKey);
    if (scopedKey !== STORAGE_KEY) {
      localStorage.removeItem(STORAGE_KEY);
    }
    return {
      lockedCourts: Array.isArray(parsed?.lockedCourts) ? parsed.lockedCourts : [],
      lockedPlayers: Array.isArray(parsed?.lockedPlayers) ? parsed.lockedPlayers : [],
    };
  } catch {
    return null;
  }
}

function loadDirector(clubId) {
  const data = loadClubData(clubId);
  if (data.director && typeof data.director === "object") {
    return {
      lockedCourts: Array.isArray(data.director.lockedCourts) ? data.director.lockedCourts : [],
      lockedPlayers: Array.isArray(data.director.lockedPlayers) ? data.director.lockedPlayers : [],
    };
  }

  const migrated = migrateLegacyDirector(clubId);
  if (migrated) {
    saveDirector(migrated, clubId);
    return migrated;
  }

  return getDefaultDirectorState();
}

function saveDirector(data, clubId) {
  const clubData = loadClubData(clubId);
  clubData.director = {
    lockedCourts: Array.isArray(data?.lockedCourts) ? data.lockedCourts : [],
    lockedPlayers: Array.isArray(data?.lockedPlayers) ? data.lockedPlayers : [],
  };
  saveClubData(clubId, clubData);
}

export function getDirectorState(clubId = getActiveClubId()) {
  return loadDirector(clubId);
}

export function lockCourt(courtId, clubId = getActiveClubId()) {
  const check = guardCourtLockAction(clubId);
  if (!check.ok) {
    return check;
  }

  const data = loadDirector(clubId);

  if (!data.lockedCourts.includes(courtId)) {
    data.lockedCourts.push(courtId);
  }

  saveDirector(data, clubId);
  return { ok: true };
}

export function unlockCourt(courtId, clubId = getActiveClubId()) {
  const check = guardCourtLockAction(clubId);
  if (!check.ok) {
    return check;
  }

  const data = loadDirector(clubId);

  data.lockedCourts = data.lockedCourts.filter((id) => id !== courtId);

  saveDirector(data, clubId);
  return { ok: true };
}

export function lockPlayer(playerId, clubId = getActiveClubId()) {
  const check = guardCourtLockAction(clubId);
  if (!check.ok) {
    return check;
  }

  const data = loadDirector(clubId);

  if (!data.lockedPlayers.includes(playerId)) {
    data.lockedPlayers.push(playerId);
  }

  saveDirector(data, clubId);
  return { ok: true };
}

export function unlockPlayer(playerId, clubId = getActiveClubId()) {
  const check = guardCourtLockAction(clubId);
  if (!check.ok) {
    return check;
  }

  const data = loadDirector(clubId);

  data.lockedPlayers = data.lockedPlayers.filter((id) => id !== playerId);

  saveDirector(data, clubId);
  return { ok: true };
}
