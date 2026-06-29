import test from "node:test";
import assert from "node:assert/strict";

import { buildDashboardSummary } from "../src/pages/dashboard.logic.js";
import {
  buildCourtsExportPayload,
  buildPlayersExportPayload,
  importClubData,
  mergeImportedPlayers,
  parseClubDataImport,
} from "../src/pages/clubData.logic.js";

test("buildDashboardSummary aggregates club overview metrics", () => {
  const summary = buildDashboardSummary({
    players: [
      { id: 1, name: "An", level: 3.5 },
      { id: 2, name: "Binh", level: 4 },
    ],
    courts: [
      { id: 1, name: "San 1", active: true },
      { id: 2, name: "San 2", active: false },
    ],
    rounds: [{ id: 10, name: "Vong 1" }],
    sessions: [
      {
        id: 100,
        date: "2026-06-28T10:00:00.000Z",
        courts: [
          {
            court: 1,
            teamA: [{ id: 1, name: "An" }],
            teamB: [{ id: 2, name: "Binh" }],
          },
        ],
        waiting: [],
        aiScore: { total: 80 },
        result: { status: "completed" },
        meta: { roundName: "Ca 1", shiftLabel: "Ca sang" },
      },
    ],
  });

  assert.equal(summary.totals.players, 2);
  assert.equal(summary.totals.activeCourts, 1);
  assert.equal(summary.totals.sessions, 1);
  assert.equal(summary.totals.rounds, 1);
  assert.equal(summary.totals.avgAiScore, 80);
  assert.equal(summary.totals.completedResults, 1);
  assert.equal(summary.recentSessions.length, 1);
  assert.equal(summary.topPlayers[0].id, 1);
  assert.equal(summary.topPlayers[0].games, 1);
});

test("buildPlayersExportPayload normalizes export package", () => {
  const payload = buildPlayersExportPayload(
    [{ id: 1, name: "An", level: "3.5" }],
    "club-a"
  );

  assert.equal(payload.type, "players");
  assert.equal(payload.clubId, "club-a");
  assert.equal(payload.items[0].name, "An");
  assert.equal(payload.items[0].level, 3.5);
});

test("importClubData merges players by id", () => {
  const raw = buildPlayersExportPayload([
    { id: 1, name: "An updated", level: 4 },
    { id: 2, name: "Moi", level: 3 },
  ]);

  const result = importClubData(JSON.stringify(raw), {
    expectedType: "players",
    existingPlayers: [{ id: 1, name: "An", level: 3, phone: "090" }],
    mode: "merge",
  });

  assert.equal(result.ok, true);
  assert.equal(result.items.length, 2);
  assert.equal(result.items.find((player) => player.id === 1).level, 4);
  assert.equal(result.items.find((player) => player.id === 1).phone, "090");
});

test("parseClubDataImport rejects wrong type", () => {
  const parsed = parseClubDataImport(
    JSON.stringify(buildCourtsExportPayload([{ id: 1, name: "San 1", active: true }]))
  );

  assert.equal(parsed.ok, true);
  assert.equal(parsed.type, "courts");

  const wrongType = importClubData(JSON.stringify(buildCourtsExportPayload([])), {
    expectedType: "players",
    existingPlayers: [],
  });

  assert.equal(wrongType.ok, false);
});

test("mergeImportedPlayers replace mode replaces all players", () => {
  const merged = mergeImportedPlayers(
    [{ id: 1, name: "Cu", level: 2 }],
    [{ id: 9, name: "Moi", level: 4 }],
    { mode: "replace" }
  );

  assert.equal(merged.length, 1);
  assert.equal(merged[0].id, 9);
});
