/*
==========================================================
AI Engine — ARCHIVED v1.2
Moved to src/legacy/engine-v1/ in v3.5.1.
Production scheduling uses src/ai/ (AI Core V2).
==========================================================
*/

import { balanceCourts } from "../scheduler-v1/balance.js";
import { pairingCourt } from "../scheduler-v1/pairing.js";
import { loadHistory, saveHistory, addMatchHistory } from "../scheduler-v1/history.js";
import { getPlayerGenderKey } from "../../models/player.js";

export function runMensAI(players) {
  const history = loadHistory();

  const malePlayers = players.filter(
    (player) => getPlayerGenderKey(player.gender) === "male"
  );

  const balanceResult = balanceCourts(malePlayers);

  const courts = balanceResult.courts.map((court) => {
    const result = pairingCourt(court);
    addMatchHistory(history, result);
    return result;
  });

  saveHistory(history);

  return {
    courts,
    waiting: balanceResult.waitingPlayers,
  };
}
