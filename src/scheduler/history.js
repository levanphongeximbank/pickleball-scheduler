/*
==========================================================
History Engine
Version 1.0
Lưu và đọc lịch sử xếp sân
==========================================================
*/

const STORAGE_KEY = "pickleball_history";

/*
----------------------------------------------------------
Đọc lịch sử
----------------------------------------------------------
*/
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

/*
----------------------------------------------------------
Lưu lịch sử
----------------------------------------------------------
*/
export function saveHistory(history) {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(history)
  );
}

/*
----------------------------------------------------------
Xóa toàn bộ lịch sử
----------------------------------------------------------
*/
export function clearHistory() {
  localStorage.removeItem(STORAGE_KEY);
}

/*
----------------------------------------------------------
Tạo khóa cho 2 người chơi
A-B và B-A sẽ giống nhau
----------------------------------------------------------
*/
function createKey(id1, id2) {
  return [id1, id2].sort().join("-");
}

/*
----------------------------------------------------------
Tăng số lần ghép
----------------------------------------------------------
*/
function increaseCounter(object, key) {
  if (!object[key]) {
    object[key] = 0;
  }

  object[key]++;
}

/*
----------------------------------------------------------
Lưu lịch sử của 1 trận
----------------------------------------------------------
*/
export function addMatchHistory(history, court) {

  const A = court.teamA;
  const B = court.teamB;

  // Đồng đội đội A
  increaseCounter(
    history.teammates,
    createKey(A[0].id, A[1].id)
  );

  // Đồng đội đội B
  increaseCounter(
    history.teammates,
    createKey(B[0].id, B[1].id)
  );

  // Đối thủ
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