/*
==========================================================
Pairing Engine
Version 2.0
History + Balance Score
==========================================================
*/

import { loadHistory } from "./history";

function pairKey(id1, id2) {
  return [id1, id2].sort().join("-");
}

function getHistoryPenalty(history, teamA, teamB) {
  let penalty = 0;

  // Đồng đội
  penalty +=
    (history.teammates[pairKey(teamA[0].id, teamA[1].id)] || 0) * 30;

  penalty +=
    (history.teammates[pairKey(teamB[0].id, teamB[1].id)] || 0) * 30;

  // Đối thủ
  teamA.forEach((a) => {
    teamB.forEach((b) => {
      penalty +=
        (history.opponents[pairKey(a.id, b.id)] || 0) * 10;
    });
  });

  return penalty;
}

function total(team) {
  return team.reduce((sum, p) => sum + p.level, 0);
}

function evaluate(teamA, teamB, history) {
  const totalA = total(teamA);
  const totalB = total(teamB);

  const diff = Math.abs(totalA - totalB);

  const historyPenalty = getHistoryPenalty(
    history,
    teamA,
    teamB
  );

  const score =
    100 -
    diff * 20 -
    historyPenalty;

  return {
    score,
    diff,
    totalA,
    totalB,
  };
}

export function pairingCourt(court) {

  const history = loadHistory();

  const p = court.players;

  const options = [

    {
      teamA: [p[0], p[1]],
      teamB: [p[2], p[3]],
    },

    {
      teamA: [p[0], p[2]],
      teamB: [p[1], p[3]],
    },

    {
      teamA: [p[0], p[3]],
      teamB: [p[1], p[2]],
    },

  ];

  let best = null;

  options.forEach((option) => {

    const result = evaluate(
      option.teamA,
      option.teamB,
      history
    );

    if (
      !best ||
      result.score > best.score
    ) {

      best = {

        ...option,

        ...result,

      };

    }

  });

  return {

    court: court.court,

    teamA: best.teamA,

    teamB: best.teamB,

    teamATotal: best.totalA,

    teamBTotal: best.totalB,

    diff: best.diff,

    score: best.score,

  };

}