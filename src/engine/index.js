/*
==========================================================
AI Engine
Version 1.2
----------------------------------------------------------
Điều phối toàn bộ AI

1. Balance Engine
2. Pairing Engine
3. Waiting Players
==========================================================
*/

import { balanceCourts } from "../scheduler/balance";
import { pairingCourt } from "../scheduler/pairing";

import {
  loadHistory,
  saveHistory,
  addMatchHistory,
} from "../scheduler/history";

export function runMensAI(players) {const history = loadHistory();

  // Chỉ lấy người chơi Nam
  const malePlayers = players.filter(
    (player) => player.gender === "Nam"
  );

  // Bước 1
  const balanceResult = balanceCourts(malePlayers);

  // Bước 2
  const courts = balanceResult.courts.map((court) => {
  const result = pairingCourt(court);

  addMatchHistory(history, result);

  return result;
});

  // Bước 3

  saveHistory(history);

  return {

    courts,

    waiting: balanceResult.waitingPlayers,

  };

}