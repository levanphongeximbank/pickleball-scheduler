/*
==========================================================
Waiting Engine
Version 1.0
Luân phiên người chờ
==========================================================
*/

const STORAGE_KEY = "pickleball_waiting";

/*
----------------------------------------
Đọc dữ liệu
----------------------------------------
*/
export function loadWaiting() {
  const data = localStorage.getItem(STORAGE_KEY);

  return data ? JSON.parse(data) : {};
}

/*
----------------------------------------
Lưu dữ liệu
----------------------------------------
*/
export function saveWaiting(waitingData) {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(waitingData)
  );
}

/*
----------------------------------------
Khởi tạo người mới
----------------------------------------
*/
function initPlayer(waitingData, playerId) {

  if (!waitingData[playerId]) {

    waitingData[playerId] = {

      waitCount: 0,

      playCount: 0,

    };

  }

}

/*
----------------------------------------
Chọn người được chơi
----------------------------------------
*/
export function selectPlayers(players) {

  const waitingData = loadWaiting();

  players.forEach((player) => {
    initPlayer(waitingData, player.id);
  });

  // Người chờ nhiều sẽ được ưu tiên chơi
  const sorted = [...players].sort((a, b) => {

    const A = waitingData[a.id];

    const B = waitingData[b.id];

    if (A.waitCount !== B.waitCount) {
      return B.waitCount - A.waitCount;
    }

    return A.playCount - B.playCount;

  });

  return {

    selected: sorted,

    waitingData,

  };

}

/*
----------------------------------------
Cập nhật sau khi xếp sân
----------------------------------------
*/
export function updateWaiting(
  selectedPlayers,
  waitingPlayers,
  waitingData
) {

  selectedPlayers.forEach((player) => {

    initPlayer(waitingData, player.id);

    waitingData[player.id].playCount++;

    waitingData[player.id].waitCount = 0;

  });

  waitingPlayers.forEach((player) => {

    initPlayer(waitingData, player.id);

    waitingData[player.id].waitCount++;

  });

  saveWaiting(waitingData);

}