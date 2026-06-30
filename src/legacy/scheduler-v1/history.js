/*
==========================================================
History Engine
Version 1.0
Lưu và đọc lịch sử xếp sân
==========================================================
*/

const STORAGE_KEY = "pickleball_history";

export function loadHistory() {
  const data = localStorage.getItem(STORAGE_KEY);

  if (!data) {
    return {
      teammates: {},
      opponents: {},
    };
  }

  return JSON.parse(data);
}

export function saveHistory(history) {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(history)
  );
}

export function clearHistory() {
  localStorage.removeItem(STORAGE_KEY);
}

function createKey(id1, id2) {
  return [id1, id2].sort().join("-");
}

function increaseCounter(object, key) {
  if (!object[key]) {
    object[key] = 0;
  }

  object[key]++;
}

export function addMatchHistory(history, court) {

  const A = court.teamA;
  const B = court.teamB;

  increaseCounter(
    history.teammates,
    createKey(A[0].id, A[1].id)
  );

  increaseCounter(
    history.teammates,
    createKey(B[0].id, B[1].id)
  );

  A.forEach(playerA => {
    B.forEach(playerB => {
      increaseCounter(
        history.opponents,
        createKey(playerA.id, playerB.id)
      );
    });
  });

  return history;
}
