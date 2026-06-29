/*
==========================================================
Balance Engine
Version 2.0
Greedy Balance Algorithm
==========================================================
*/

export function balanceCourts(players) {

  // Sắp xếp Level giảm dần
  const sortedPlayers = [...players].sort(
    (a, b) => b.level - a.level
  );

  // Tính số sân
  const courtCount = Math.floor(
    sortedPlayers.length / 4
  );

  // Người chờ
  const waitingPlayers = sortedPlayers.slice(
    courtCount * 4
  );

  // Người được xếp sân
  const playingPlayers = sortedPlayers.slice(
    0,
    courtCount * 4
  );

  // Khởi tạo sân
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

  Luôn đưa người tiếp theo
  vào sân có tổng Level thấp nhất
  ===================================================
  */

  playingPlayers.forEach((player) => {

    // Tìm sân yếu nhất
    let targetCourt = courts[0];

    courts.forEach((court) => {

      // Chỉ chọn sân chưa đủ 4 người
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

  // Sắp xếp lại theo số sân
  courts.sort((a, b) => a.court - b.court);

  return {

    courts,

    waitingPlayers,

  };

}