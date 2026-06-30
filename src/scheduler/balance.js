/*
==========================================================
Balance Engine
Version 2.0
Greedy Balance Algorithm
==========================================================
*/

export function balanceCourts(players) {

  // Sß║»p xß║┐p Level giß║úm dß║ºn
  const sortedPlayers = [...players].sort(
    (a, b) => b.level - a.level
  );

  // T├¡nh sß╗æ s├ón
  const courtCount = Math.floor(
    sortedPlayers.length / 4
  );

  // Ng╞░ß╗¥i chß╗¥
  const waitingPlayers = sortedPlayers.slice(
    courtCount * 4
  );

  // Ng╞░ß╗¥i ─æ╞░ß╗úc xß║┐p s├ón
  const playingPlayers = sortedPlayers.slice(
    0,
    courtCount * 4
  );

  // Khß╗ƒi tß║ío s├ón
  const courts = [];

  for (let i = 0; i < courtCount; i++) {

    courts.push({

      court: i + 1,

      players: [],

      totalLevel: 0,

    });

  }

  /*
  ===================================================
  Greedy Balance

  Lu├┤n ─æ╞░a ng╞░ß╗¥i tiß║┐p theo
  v├áo s├ón c├│ tß╗òng Level thß║Ñp nhß║Ñt
  ===================================================
  */

  playingPlayers.forEach((player) => {

    // T├¼m s├ón yß║┐u nhß║Ñt
    let targetCourt = courts[0];

    courts.forEach((court) => {

      // Chß╗ë chß╗ìn s├ón ch╞░a ─æß╗º 4 ng╞░ß╗¥i
      if (
        court.players.length < 4 &&
        court.totalLevel < targetCourt.totalLevel
      ) {

        targetCourt = court;

      }

    });

    targetCourt.players.push(player);

    targetCourt.totalLevel += player.level;

  });

  // Sß║»p xß║┐p lß║íi theo sß╗æ s├ón
  courts.sort((a, b) => a.court - b.court);

  return {

    courts,

    waitingPlayers,

  };

}
