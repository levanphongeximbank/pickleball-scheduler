/*
==========================================================
AI Engine
Version 1.2
----------------------------------------------------------
─Éiß╗üu phß╗æi to├án bß╗Ö AI

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

  // Chß╗ë lß║Ñy ng╞░ß╗¥i ch╞íi Nam
  const malePlayers = players.filter(
    (player) => player.gender === "Nam"
  );

  // B╞░ß╗¢c 1
  const balanceResult = balanceCourts(malePlayers);

  // B╞░ß╗¢c 2
  const courts = balanceResult.courts.map((court) => {
  const result = pairingCourt(court);

  addMatchHistory(history, result);

  return result;
});

  // B╞░ß╗¢c 3

  saveHistory(history);

  return {

    courts,

    waiting: balanceResult.waitingPlayers,

  };

}
