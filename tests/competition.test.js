import test from "node:test";
import assert from "node:assert/strict";

import {
  DEFAULT_COMPETITION_TYPE,
  getCompetitionTypeConfig,
  getCompetitionTypeOptions,
  getEligiblePlayersForCompetition,
  validateCompetitionSelection,
} from "../src/ai/competition.js";

const samplePlayers = [
  { id: 1, name: "An", gender: "Nam" },
  { id: 2, name: "Binh", gender: "Nam" },
  { id: 3, name: "Ha", gender: "Nữ" },
  { id: 4, name: "Linh", gender: "Nữ" },
  { id: 5, name: "Unknown", gender: "" },
];

test("getCompetitionTypeOptions contains all required tournament formats", () => {
  const ids = getCompetitionTypeOptions().map((item) => item.id).sort();

  assert.deepEqual(ids, [
    "doubles_men",
    "doubles_mixed",
    "doubles_women",
    "open",
    "singles_men",
    "singles_women",
  ]);
});

test("getCompetitionTypeConfig falls back to default type", () => {
  assert.equal(getCompetitionTypeConfig("unknown").id, DEFAULT_COMPETITION_TYPE);
});

test("eligible players are filtered by competition gender mode", () => {
  assert.equal(getEligiblePlayersForCompetition(samplePlayers, "singles_men").length, 2);
  assert.equal(getEligiblePlayersForCompetition(samplePlayers, "singles_women").length, 2);
  assert.equal(getEligiblePlayersForCompetition(samplePlayers, "open").length, 5);
});

test("validateCompetitionSelection enforces mixed doubles constraints", () => {
  const invalid = validateCompetitionSelection(samplePlayers.slice(0, 3), "doubles_mixed", {
    selectedCourtCount: 1,
  });

  assert.equal(invalid.isValid, false);
  assert.ok(invalid.errors.some((item) => item.includes("2 nam và 2 nữ")));

  const valid = validateCompetitionSelection(samplePlayers.slice(0, 4), "doubles_mixed", {
    selectedCourtCount: 1,
  });

  assert.equal(valid.isValid, true);
});
