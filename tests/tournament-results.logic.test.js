import test from "node:test";
import assert from "node:assert/strict";

import {
  buildSessionResultDraft,
  buildSessionResultPayload,
  summarizeSessionResult,
  updateCourtScore,
} from "../src/pages/tournament.results.logic.js";

test("buildSessionResultDraft creates default result rows from session courts", () => {
  const draft = buildSessionResultDraft({
    courts: [
      { court: 1, courtName: "Sân 1" },
      { court: 2, courtName: "Sân 2" },
    ],
  });

  assert.equal(draft.status, "pending");
  assert.equal(draft.locked, false);
  assert.equal(draft.courts.length, 2);
  assert.equal(draft.courts[0].teamAScore, 0);
  assert.equal(draft.courts[0].winner, "draw");
});

test("updateCourtScore updates score and winner for selected court", () => {
  const initial = buildSessionResultDraft({ courts: [{ court: 1, courtName: "Sân 1" }] });
  const withA = updateCourtScore(initial, 1, "A", 11);
  const withB = updateCourtScore(withA, 1, "B", 9);

  assert.equal(withB.courts[0].teamAScore, 11);
  assert.equal(withB.courts[0].teamBScore, 9);
  assert.equal(withB.courts[0].winner, "A");
});

test("summarizeSessionResult computes total score and winner", () => {
  const summary = summarizeSessionResult({
    courts: [
      { teamAScore: 11, teamBScore: 7 },
      { teamAScore: 8, teamBScore: 11 },
    ],
  });

  assert.equal(summary.teamATotal, 19);
  assert.equal(summary.teamBTotal, 18);
  assert.equal(summary.winner, "A");
});

test("buildSessionResultPayload normalizes scores and sets summary", () => {
  const payload = buildSessionResultPayload({
    status: "completed",
    note: "Vòng mở màn",
    locked: true,
    courts: [
      { courtId: 1, courtName: "Sân 1", teamAScore: "11", teamBScore: 9 },
      { courtId: 2, courtName: "Sân 2", teamAScore: -4, teamBScore: "8" },
    ],
  });

  assert.equal(payload.status, "completed");
  assert.equal(payload.locked, true);
  assert.equal(payload.courts[1].teamAScore, 0);
  assert.equal(payload.summary.teamATotal, 11);
  assert.equal(payload.summary.teamBTotal, 17);
  assert.equal(payload.summary.winner, "B");
});
