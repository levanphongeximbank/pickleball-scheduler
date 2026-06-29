import test from "node:test";
import assert from "node:assert/strict";

import { buildDebugSummary, formatDebugTrace } from "../src/ai/debugPanel.js";

test("formatDebugTrace renders step details", () => {
  const lines = formatDebugTrace([
    { step: "run.start", details: { playerCount: 8, persist: false } },
    { step: "result.finalize", details: {} },
  ]);

  assert.equal(lines[0], "run.start (playerCount=8, persist=false)");
  assert.equal(lines[1], "result.finalize");
});

test("buildDebugSummary exposes trace steps and persisted flag", () => {
  const summary = buildDebugSummary({
    courts: [{ court: 1 }],
    waiting: [{ id: 1 }],
    aiScore: { total: 88 },
    candidates: [{}, {}],
    persisted: false,
    debugTrace: [
      { step: "run.start", details: { playerCount: 8 } },
      { step: "pairing.score", details: { candidateCount: 3 } },
    ],
  });

  assert.equal(summary.totalCourts, 1);
  assert.equal(summary.waitingCount, 1);
  assert.equal(summary.aiScore, 88);
  assert.equal(summary.candidateCount, 2);
  assert.equal(summary.persisted, false);
  assert.deepEqual(summary.traceSteps, ["run.start", "pairing.score"]);
  assert.equal(summary.traceLines.length, 2);
});
