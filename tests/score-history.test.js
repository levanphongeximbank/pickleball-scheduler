import test from "node:test";
import assert from "node:assert/strict";

import { createMatchRecord } from "../src/models/tournament/index.js";
import {
  appendScoreLogToMatch,
  createScoreLogEntry,
  formatScoreLogEntry,
  normalizeScoreLog,
  resolveDirectorScoreLogSource,
  SCORE_LOG_SOURCE,
} from "../src/models/tournament/scoreLog.js";
import {
  appendScoreLogAfterEventSubmit,
  buildRefereeFinalizeLogEntry,
  patchScoreLogInTournament,
  summarizeScoreLog,
} from "../src/tournament/engines/scoreHistoryEngine.js";

test("appendScoreLogToMatch keeps chronological log", () => {
  const match = createMatchRecord({ id: "m1" });
  const first = createScoreLogEntry({
    source: SCORE_LOG_SOURCE.REFEREE,
    actorName: "Lan",
    scoreA: 11,
    scoreB: 8,
  });
  const second = createScoreLogEntry({
    source: SCORE_LOG_SOURCE.DIRECTOR_OVERRIDE,
    actorName: "BTC",
    scoreA: 11,
    scoreB: 9,
    note: "Xác nhận lại",
  });

  const next = appendScoreLogToMatch(appendScoreLogToMatch(match, first), second);
  assert.equal(next.scoreLog.length, 2);
  assert.equal(next.scoreLog[1].source, SCORE_LOG_SOURCE.DIRECTOR_OVERRIDE);
});

test("resolveDirectorScoreLogSource detects override when live exists", () => {
  const match = createMatchRecord({
    id: "m1",
    referee: { name: "Lan", token: "abc" },
  });

  assert.equal(
    resolveDirectorScoreLogSource(match, { scoreA: 5, scoreB: 3, status: "playing" }),
    SCORE_LOG_SOURCE.DIRECTOR_OVERRIDE
  );
  assert.equal(resolveDirectorScoreLogSource(match, null), SCORE_LOG_SOURCE.DIRECTOR);
});

test("appendScoreLogAfterEventSubmit updates only target match", () => {
  const event = {
    id: "e1",
    matches: [
      createMatchRecord({ id: "m1" }),
      createMatchRecord({ id: "m2" }),
    ],
  };

  const entry = buildRefereeFinalizeLogEntry({
    refereeName: "Tuấn",
    scoreA: 11,
    scoreB: 6,
  });
  const next = appendScoreLogAfterEventSubmit(event, "m1", entry);

  assert.equal(next.matches[0].scoreLog.length, 1);
  assert.equal(next.matches[1].scoreLog?.length || 0, 0);
});

test("patchScoreLogInTournament patches daily match log", () => {
  const tournament = {
    settings: {
      dailyPlay: {
        matches: [{ id: "d1", teamAPlayerIds: ["p1"], teamBPlayerIds: ["p2"] }],
      },
    },
  };

  const entry = createScoreLogEntry({
    source: SCORE_LOG_SOURCE.DIRECTOR,
    actorName: "BTC",
    scoreA: 11,
    scoreB: 4,
  });
  const patch = patchScoreLogInTournament(tournament, {
    matchId: "d1",
    entry,
    isDaily: true,
  });

  assert.equal(patch.settings.dailyPlay.matches[0].scoreLog.length, 1);
});

test("formatScoreLogEntry renders readable line", () => {
  const line = formatScoreLogEntry(
    createScoreLogEntry({
      source: SCORE_LOG_SOURCE.REFEREE,
      actorName: "Lan",
      scoreA: 11,
      scoreB: 7,
    })
  );

  assert.match(line, /Trọng tài Lan: 11-7/);
});

test("summarizeScoreLog returns latest formatted entries", () => {
  const match = appendScoreLogToMatch(createMatchRecord({ id: "m1" }), createScoreLogEntry({
    source: SCORE_LOG_SOURCE.DIRECTOR,
    actorName: "BTC",
    scoreA: 11,
    scoreB: 5,
  }));

  const lines = summarizeScoreLog(match, 3);
  assert.equal(lines.length, 1);
  assert.match(lines[0], /BTC: 11-5/);
});

test("normalizeScoreLog drops invalid entries", () => {
  const log = normalizeScoreLog([
    { source: "referee", actorName: "A", scoreA: 1, scoreB: 0 },
    { source: "invalid", actorName: "B", scoreA: 2, scoreB: 1 },
  ]);

  assert.equal(log.length, 1);
});
