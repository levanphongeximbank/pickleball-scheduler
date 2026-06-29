/*
==========================================================
AI Waiting Engine V2
Version 2.0
==========================================================
*/

import { getScopedStorageKey } from "../data/club.js";

const STORAGE_KEY = "pickleball_ai_waiting";

function loadWaitingData() {
  const data = localStorage.getItem(getScopedStorageKey(STORAGE_KEY));

  return data ? JSON.parse(data) : {};
}

function saveWaitingData(data) {
  localStorage.setItem(
    getScopedStorageKey(STORAGE_KEY),
    JSON.stringify(data)
  );
}

function initPlayer(waitingData, player) {
  if (!waitingData[player.id]) {
    waitingData[player.id] = {
      waitCount: 0,
      playCount: 0,
      lastWaitRound: 0,
      lastPlayRound: 0,
    };
  }
}

function cloneWaitingSnapshot(waitingData, players = []) {
  const snapshot = {};

  players.forEach((player) => {
    initPlayer(waitingData, player);
    snapshot[player.id] = { ...waitingData[player.id] };
  });

  return snapshot;
}

export function commitWaitingFromResult(result = {}) {
  const waitingData = loadWaitingData();
  const playingIds = new Set();

  (result.courts || []).forEach((court) => {
    [...(court.teamA || []), ...(court.teamB || [])].forEach((player) => {
      if (!player?.id) {
        return;
      }

      playingIds.add(player.id);
      initPlayer(waitingData, player);
      waitingData[player.id].playCount += 1;
    });
  });

  (result.waiting || []).forEach((player) => {
    if (!player?.id || playingIds.has(player.id)) {
      return;
    }

    initPlayer(waitingData, player);
    waitingData[player.id].waitCount += 1;
  });

  saveWaitingData(waitingData);
}

export function runWaitingEngine(players, options = {}) {
  const waitingData = loadWaitingData();
  const dryRun = options.dryRun === true;

  players.forEach((player) => {
    initPlayer(waitingData, player);
  });

  const waitingSnapshot = cloneWaitingSnapshot(waitingData, players);

  const sortedPlayers = [...players].sort((a, b) => {
    const A = waitingSnapshot[a.id];
    const B = waitingSnapshot[b.id];

    if (A.waitCount !== B.waitCount) {
      return B.waitCount - A.waitCount;
    }

    return A.playCount - B.playCount;
  });

  const courtCount = options.courtCount || 4;
  const playersPerCourt = Number(options.playersPerCourt) || 4;

  const playingCount = courtCount * playersPerCourt;
  const safePlayingCount = Math.floor(
    Math.min(sortedPlayers.length, playingCount) / playersPerCourt
  ) * playersPerCourt;

  const playingPlayers = sortedPlayers.slice(0, safePlayingCount);
  const waitingPlayers = sortedPlayers.slice(safePlayingCount);

  if (!dryRun) {
    playingPlayers.forEach((player) => {
      waitingData[player.id].playCount += 1;
    });

    waitingPlayers.forEach((player) => {
      waitingData[player.id].waitCount += 1;
    });

    saveWaitingData(waitingData);
  }

  return {
    playingPlayers,
    waitingPlayers,
    waitingData,
    waitingSnapshot,
  };
}
