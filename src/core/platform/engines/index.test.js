import test from "node:test";
import assert from "node:assert/strict";

import {
  buildPlatformEngineSummary,
  createTournamentEngine,
  createCourtEngine,
  createLeagueEngine,
  createRankingEngine,
  createBillingEngine,
  createAiEngine,
} from "./index.js";

test("phase 5 engines expose canonical service contracts", () => {
  const tournamentEngine = createTournamentEngine();
  const courtEngine = createCourtEngine();
  const leagueEngine = createLeagueEngine();
  const rankingEngine = createRankingEngine();
  const billingEngine = createBillingEngine();
  const aiEngine = createAiEngine();

  assert.equal(tournamentEngine.name, "tournament");
  assert.equal(courtEngine.name, "court");
  assert.equal(leagueEngine.name, "league");
  assert.equal(rankingEngine.name, "ranking");
  assert.equal(billingEngine.name, "billing");
  assert.equal(aiEngine.name, "ai");

  const plan = tournamentEngine.createPlan({ name: "Spring Cup", tournament: { id: "tour-1" }, players: [{ id: "p1", name: "Ana" }] });
  assert.ok(plan.name.includes("Spring Cup"));
  assert.equal(plan.summary?.participantCount, 1);
  assert.ok(courtEngine.createSchedule({ courtId: "court-2" }).courtId === "court-2");

  const summary = buildPlatformEngineSummary({
    tournament: { id: "tour-1", name: "Spring Cup" },
    players: [{ id: "p1", name: "Ana" }],
  });

  assert.equal(summary.tournament.plan.name, "Spring Cup");
  assert.equal(summary.billing.invoice.tenantId, "tenant-1");
  assert.equal(summary.ai.recommendation.recommendation.includes("Ana"), true);
});
