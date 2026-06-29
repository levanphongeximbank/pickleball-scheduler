/*
==========================================================
AI Balance Engine V2
Enabled Courts
==========================================================
*/

import { getCourtDisplayName } from "../models/court.js";

function compareByWaitingThenLevel(a, b, waitingSnapshot = {}) {
  const statsA = waitingSnapshot[a.id] || { waitCount: 0, playCount: 0 };
  const statsB = waitingSnapshot[b.id] || { waitCount: 0, playCount: 0 };

  if (statsA.waitCount !== statsB.waitCount) {
    return statsB.waitCount - statsA.waitCount;
  }

  if (statsA.playCount !== statsB.playCount) {
    return statsA.playCount - statsB.playCount;
  }

  return b.level - a.level;
}

export function runBalanceEngine(players, options = {}) {
  const enabledCourts =
    options.enabledCourts && options.enabledCourts.length > 0
      ? options.enabledCourts
      : [1, 2, 3, 4];

  const waitingSnapshot = options.waitingSnapshot || {};

  const normalizedCourts = enabledCourts.map((court, index) => {
    if (typeof court === "object" && court !== null) {
      return {
        id: court.id,
        name: getCourtDisplayName(court, index),
      };
    }

    return {
      id: court,
      name: `Sân ${index + 1}`,
    };
  });

  const courtCount = normalizedCourts.length;
  const playersPerCourt = Number(options.playersPerCourt) || 4;
  const maxPlayers = courtCount * playersPerCourt;

  const sortedPlayers = [...players].sort((a, b) =>
    compareByWaitingThenLevel(a, b, waitingSnapshot)
  );

  const playingPlayers = sortedPlayers.slice(0, maxPlayers);
  const waitingPlayers = sortedPlayers.slice(maxPlayers);

  const courts = normalizedCourts.map((court) => ({
    id: court.id,
    name: court.name,
    players: [],
    totalLevel: 0,
  }));

  playingPlayers.forEach((player) => {
    let targetCourt = null;

    courts.forEach((court) => {
      if (court.players.length >= playersPerCourt) {
        return;
      }

      if (
        !targetCourt ||
        court.totalLevel < targetCourt.totalLevel
      ) {
        targetCourt = court;
      }
    });

    if (targetCourt) {
      targetCourt.players.push(player);
      targetCourt.totalLevel += player.level;
    }
  });

  return {
    courts,
    waitingPlayers,
  };
}
