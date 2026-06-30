/*
==========================================================
Waiting Engine
Version 1.0
Lu├ón phi├¬n ng╞░ß╗¥i chß╗¥
==========================================================
*/

const STORAGE_KEY = "pickleball_waiting";

/*
----------------------------------------
─Éß╗ìc dß╗» liß╗çu
----------------------------------------
*/
export function loadWaiting() {
  const data = localStorage.getItem(STORAGE_KEY);

  return data ? JSON.parse(data) : {};
}

/*
----------------------------------------
L╞░u dß╗» liß╗çu
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
Khß╗ƒi tß║ío ng╞░ß╗¥i mß╗¢i
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
Chß╗ìn ng╞░ß╗¥i ─æ╞░ß╗úc ch╞íi
----------------------------------------
*/
export function selectPlayers(players) {

  const waitingData = loadWaiting();

  players.forEach((player) => {
    initPlayer(waitingData, player.id);
  });

  // Ng╞░ß╗¥i chß╗¥ nhiß╗üu sß║╜ ─æ╞░ß╗úc ╞░u ti├¬n ch╞íi
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
Cß║¡p nhß║¡t sau khi xß║┐p s├ón
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
