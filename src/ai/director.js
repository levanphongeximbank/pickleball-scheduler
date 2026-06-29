/*
==========================================================
Director Engine
==========================================================
*/

import { getActiveClubId, getScopedStorageKey } from "../data/club.js";
import { guardCourtLockAction } from "../auth/guardAction.js";

const STORAGE_KEY = "pickleball-director";

function loadDirector(clubId) {
  const scopedKey = getScopedStorageKey(STORAGE_KEY, clubId);
  const data =
    localStorage.getItem(scopedKey) || localStorage.getItem(STORAGE_KEY);

  return data
    ? JSON.parse(data)
    : {
        lockedCourts: [],
        lockedPlayers: [],
      };
}

function saveDirector(data, clubId) {
  const scopedKey = getScopedStorageKey(STORAGE_KEY, clubId);

  localStorage.setItem(scopedKey, JSON.stringify(data));
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
