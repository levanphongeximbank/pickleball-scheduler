/*
==========================================================
History Engine
Version 1.0
L╞░u v├á ─æß╗ìc lß╗ïch sß╗¡ xß║┐p s├ón
==========================================================
*/

const STORAGE_KEY = "pickleball_history";

/*
----------------------------------------------------------
─Éß╗ìc lß╗ïch sß╗¡
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
L╞░u lß╗ïch sß╗¡
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
X├│a to├án bß╗Ö lß╗ïch sß╗¡
----------------------------------------------------------
*/
export function clearHistory() {
  localStorage.removeItem(STORAGE_KEY);
}

/*
----------------------------------------------------------
Tß║ío kh├│a cho 2 ng╞░ß╗¥i ch╞íi
A-B v├á B-A sß║╜ giß╗æng nhau
----------------------------------------------------------
*/
function createKey(id1, id2) {
  return [id1, id2].sort().join("-");
}

/*
----------------------------------------------------------
T─âng sß╗æ lß║ºn gh├⌐p
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
L╞░u lß╗ïch sß╗¡ cß╗ºa 1 trß║¡n
----------------------------------------------------------
*/
export function addMatchHistory(history, court) {

  const A = court.teamA;
  const B = court.teamB;

  // ─Éß╗ông ─æß╗Öi ─æß╗Öi A
  increaseCounter(
    history.teammates,
    createKey(A[0].id, A[1].id)
  );

  // ─Éß╗ông ─æß╗Öi ─æß╗Öi B
  increaseCounter(
    history.teammates,
    createKey(B[0].id, B[1].id)
  );

  // ─Éß╗æi thß╗º
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
