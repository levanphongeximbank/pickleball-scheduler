import test from "node:test";
import assert from "node:assert/strict";

import { runPlatformEngineWorkflow } from "./orchestrator.js";

test("platform workflow orchestrates tournament, court, and ranking stages", () => {
  const result = runPlatformEngineWorkflow({
    tournament: { id: "tour-1", name: "Spring Cup" },
    players: [{ id: "p1", name: "Ana" }, { id: "p2", name: "Ben" }],
    courts: [{ id: "court-1", name: "Sân 1" }],
    matches: [{ id: "m1" }],
  });

  assert.equal(result.ok, true);
  assert.equal(result.data.plan.name, "Spring Cup");
  assert.equal(result.data.schedule.summary.slotCount, 1);
  assert.equal(result.data.ranking.entries.length, 2);
  assert.equal(result.data.invoice.status, "draft");
  assert.equal(result.data.recommendation.reason.includes("Players"), true);
});
