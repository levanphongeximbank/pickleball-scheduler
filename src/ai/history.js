/*
==================================================
AI History Engine
==================================================
*/

import { loadAIData, saveAIData } from "./storage.js";

function getPairs(team = []) {
  const pairs = [];

  for (let i = 0; i < team.length; i++) {
    for (let j = i + 1; j < team.length; j++) {
      pairs.push([team[i], team[j]]);
    }
  }

  return pairs;
}

function ensurePlayerHistory(history, playerId) {
  if (!history[playerId]) {
    history[playerId] = {
      games: 0,
      partners: {},
      opponents: {},
    };
  }

  return history[playerId];
}

function updatePartner(history, p1, p2) {
  if (!p1 || !p2) {
    return;
  }

  const h1 = ensurePlayerHistory(history, p1.id);
  const h2 = ensurePlayerHistory(history, p2.id);

  h1.partners[p2.id] = (h1.partners[p2.id] || 0) + 1;
  h2.partners[p1.id] = (h2.partners[p1.id] || 0) + 1;
}

function updateOpponent(history, p1, p2) {
  if (!p1 || !p2) {
    return;
  }

  const h1 = ensurePlayerHistory(history, p1.id);
  const h2 = ensurePlayerHistory(history, p2.id);

  h1.opponents[p2.id] = (h1.opponents[p2.id] || 0) + 1;
  h2.opponents[p1.id] = (h2.opponents[p1.id] || 0) + 1;
}

export function applyHistoryFromCourts(courts = [], history = {}) {
  courts.forEach((court) => {
    const players = [...(court.teamA || []), ...(court.teamB || [])];

    players.forEach((player) => {
      ensurePlayerHistory(history, player.id).games += 1;
    });

    getPairs(court.teamA || []).forEach(([p1, p2]) => {
      updatePartner(history, p1, p2);
    });

    getPairs(court.teamB || []).forEach(([p1, p2]) => {
      updatePartner(history, p1, p2);
    });

    (court.teamA || []).forEach((playerA) => {
      (court.teamB || []).forEach((playerB) => {
        updateOpponent(history, playerA, playerB);
      });
    });
  });

  return history;
}

export function commitHistoryFromCourts(courts = []) {
  const data = loadAIData();
  data.history = applyHistoryFromCourts(courts, data.history || {});
  saveAIData(data);
}

export function runHistoryEngine(courts, options = {}) {
  if (options.dryRun) {
    return courts;
  }

  commitHistoryFromCourts(courts);
  return courts;
}
