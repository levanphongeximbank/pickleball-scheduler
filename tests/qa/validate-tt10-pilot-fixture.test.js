import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import {
  validateTt10PilotFixture,
  validateLineupTemplateRules,
} from "../../scripts/qa/validate-tt10-pilot-fixture.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURE_DIR = resolve(__dirname, "../../docs/v5/qa/team-tournament/fixtures");
const FALLBACK_DIR = resolve(__dirname, "../../docs/v5/qa/team-tournament/fallback");

function loadFixture(name) {
  return JSON.parse(readFileSync(resolve(FIXTURE_DIR, name), "utf8"));
}

function basePilotBundle() {
  return {
    tournament: loadFixture("tt10-pilot-tournament.json"),
    users: loadFixture("tt10-users.json"),
    scenarios: loadFixture("tt10-scenarios.json"),
  };
}

test("TT-10 validator — valid pilot fixture returns ok: true", () => {
  const { tournament, users, scenarios } = basePilotBundle();
  const result = validateTt10PilotFixture(tournament, users, scenarios, { fallbackDir: FALLBACK_DIR });
  assert.equal(result.ok, true, result.errors.map((error) => error.message).join("; "));
  assert.equal(result.summary.terminalMatchups, 6);
});

test("TT-10 validator — player not on team fails", () => {
  const { tournament, users, scenarios } = basePilotBundle();
  tournament.lineupTemplates["team-a"]["disc-md"] = ["p-b1", "p-a2"];
  const result = validateTt10PilotFixture(tournament, users, scenarios, { skipCsv: true });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.code === "LINEUP_PLAYER_TEAM"));
});

test("TT-10 validator — wrong gender for discipline fails", () => {
  const { tournament, users, scenarios } = basePilotBundle();
  tournament.lineupTemplates["team-a"]["disc-md"] = ["p-a3", "p-a4"];
  const result = validateTt10PilotFixture(tournament, users, scenarios, { skipCsv: true });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.code === "LINEUP_GENDER_MD"));
});

test("TT-10 validator — missing discipline fails", () => {
  const { tournament, users, scenarios } = basePilotBundle();
  delete tournament.lineupTemplates["team-b"]["disc-wd"];
  const result = validateTt10PilotFixture(tournament, users, scenarios, { skipCsv: true });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.code === "LINEUP_MISSING_DISCIPLINE"));
});

test("TT-10 validator — duplicate mixed player reuse fails", () => {
  const teamById = new Map([["team-a", { id: "team-a" }]]);
  const playerById = new Map([
    ["p-a1", { id: "p-a1", teamId: "team-a", gender: "male" }],
    ["p-a3", { id: "p-a3", teamId: "team-a", gender: "female" }],
  ]);
  const violations = validateLineupTemplateRules({
    templateKey: "team-a",
    lineup: {
      "disc-md": ["p-a1", "p-a1"],
      "disc-wd": ["p-a3", "p-a3"],
      "disc-mx1": ["p-a1", "p-a3"],
      "disc-mx2": ["p-a1", "p-a3"],
    },
    teamById,
    playerById,
    disciplineIds: ["disc-md", "disc-wd", "disc-mx1", "disc-mx2"],
    policy: {
      requiredDisciplineIds: ["disc-md", "disc-wd", "disc-mx1", "disc-mx2"],
      playersPerDiscipline: 2,
      disallowMixedDisciplinePlayerReuse: true,
    },
  });
  assert.ok(violations.some((violation) => violation.code === "LINEUP_MIXED_REUSE"));
});

test("TT-10 validator — scenario references unknown matchup", () => {
  const { tournament, users, scenarios } = basePilotBundle();
  scenarios.steps[7].matchupId = "m-zz";
  const result = validateTt10PilotFixture(tournament, users, scenarios, { skipCsv: true });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.code === "SCENARIO_MATCHUP"));
});

test("TT-10 validator — scenario actor does not exist", () => {
  const { tournament, users, scenarios } = basePilotBundle();
  scenarios.steps[1].actor = "captain-z";
  const result = validateTt10PilotFixture(tournament, users, scenarios, { skipCsv: true });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.code === "SCENARIO_ACTOR"));
});

test("TT-10 validator — duplicate scenario id fails", () => {
  const { tournament, users, scenarios } = basePilotBundle();
  scenarios.steps[1].id = "S01";
  const result = validateTt10PilotFixture(tournament, users, scenarios, { skipCsv: true });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.code === "SCENARIO_DUP" || error.code === "SCENARIO_MISSING"));
});

test("TT-10 validator — missing scenario id fails", () => {
  const { tournament, users, scenarios } = basePilotBundle();
  scenarios.steps = scenarios.steps.filter((step) => step.id !== "S15");
  const result = validateTt10PilotFixture(tournament, users, scenarios, { skipCsv: true });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.code === "SCENARIO_MISSING"));
});

test("TT-10 validator — CSV drift from JSON fails", () => {
  const { tournament, users, scenarios } = basePilotBundle();
  tournament.teams[0].code = "Z";
  const result = validateTt10PilotFixture(tournament, users, scenarios, { fallbackDir: FALLBACK_DIR });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.code === "CSV_TEAM_DRIFT"));
});

test("TT-10 validator — matchup without terminal scenario path fails", () => {
  const { tournament, users, scenarios } = basePilotBundle();
  const s12 = scenarios.steps.find((step) => step.id === "S12");
  s12.confirmsTerminalFor = s12.confirmsTerminalFor.filter((matchupId) => matchupId !== "m-ad");
  const result = validateTt10PilotFixture(tournament, users, scenarios, { skipCsv: true });
  assert.equal(result.ok, false);
  assert.ok(
    result.errors.some(
      (error) => error.code === "SCENARIO_TERMINAL_BEFORE_S14" || error.code === "RESULTS_CATALOG_PATH"
    )
  );
});

test("TT-10 validator — invalid lineup fixture that is actually valid fails", () => {
  const { tournament, users, scenarios } = basePilotBundle();
  tournament.lineupTemplates["team-d-invalid-first"] = {
    ...tournament.lineupTemplates["team-d-valid"],
    validationError: "Player reuse across mixed disciplines",
    expectedRejectionCode: "LINEUP_MIXED_REUSE",
  };
  const result = validateTt10PilotFixture(tournament, users, scenarios, { skipCsv: true });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.code === "INVALID_LINEUP_FALSE_NEGATIVE"));
});

test("TT-10 validator — full pilot has 6/6 terminal before S14", () => {
  const { tournament, users, scenarios } = basePilotBundle();
  const result = validateTt10PilotFixture(tournament, users, scenarios, { fallbackDir: FALLBACK_DIR });
  assert.equal(result.ok, true);
  const terminalSteps = scenarios.steps
    .filter((step) => Number(step.order) < 14)
    .flatMap((step) => step.confirmsTerminalFor || []);
  assert.deepEqual([...new Set(terminalSteps)].sort(), [
    "m-ab",
    "m-ac",
    "m-ad",
    "m-bc",
    "m-bd",
    "m-cd",
  ]);
});
