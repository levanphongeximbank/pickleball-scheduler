import test from "node:test";
import assert from "node:assert/strict";

import {
  GENDER_REQUIREMENT,
  DISCIPLINE_CATEGORY,
} from "../src/features/team-tournament/constants.js";
import { createDisciplineRecord } from "../src/features/team-tournament/models/index.js";
import {
  validateDisciplineSelectionStructured,
  validateLineupSelectionsStructured,
} from "../src/features/team-tournament/engines/lineupValidationEngine.js";
import {
  LINEUP_VALIDATION_CODE,
  createLineupValidationResult,
  formatLineupValidationError,
  mapRpcLineupValidationPayload,
} from "../src/features/team-tournament/engines/lineupValidationContract.js";

const players = [
  { id: "p1", name: "Nam A", gender: "Nam" },
  { id: "p2", name: "Nam B", gender: "Nam" },
  { id: "p3", name: "Nu A", gender: "Nữ" },
  { id: "p4", name: "Nu B", gender: "Nữ" },
];

const team = {
  id: "team-a",
  playerIds: ["p1", "p2", "p3", "p4"],
  absentPlayerIds: [],
  lockedPlayerIds: [],
};

const menDiscipline = createDisciplineRecord({
  id: "disc-men",
  name: "Đôi nam",
  categoryType: DISCIPLINE_CATEGORY.DOUBLES,
  genderRequirement: GENDER_REQUIREMENT.MALE,
  playerCount: 2,
});

const mixedDiscipline = createDisciplineRecord({
  id: "disc-mixed",
  name: "Mixed",
  categoryType: DISCIPLINE_CATEGORY.MIXED,
  genderRequirement: GENDER_REQUIREMENT.MIXED_PAIR,
  playerCount: 2,
});

function buildTeamData() {
  return {
    teams: [team],
    disciplines: [menDiscipline, mixedDiscipline],
    settings: { allowPlayerReusePerMatchup: false },
  };
}

test("createLineupValidationResult preserves structured fields", () => {
  const result = createLineupValidationResult({
    ok: false,
    code: LINEUP_VALIDATION_CODE.INVALID_GENDER,
    message: "bad gender",
    fieldErrors: { "disc-men": ["wrong"] },
    invalidPlayerIds: ["p3"],
  });

  assert.equal(result.ok, false);
  assert.equal(result.code, "invalid_gender");
  assert.deepEqual(result.fieldErrors, { "disc-men": ["wrong"] });
  assert.deepEqual(result.invalidPlayerIds, ["p3"]);
});

test("mapRpcLineupValidationPayload normalizes server payload", () => {
  const mapped = mapRpcLineupValidationPayload({
    ok: false,
    code: "player_not_in_team",
    message: "VĐV ngoài đội",
    fieldErrors: {},
    invalidPlayerIds: ["x"],
    serverTime: "2026-07-12T00:00:00.000Z",
    lineupVersion: 3,
  });

  assert.equal(mapped.code, "player_not_in_team");
  assert.equal(mapped.lineupVersion, 3);
  assert.deepEqual(mapped.invalidPlayerIds, ["x"]);
});

test("formatLineupValidationError merges rule violations", () => {
  const message = formatLineupValidationError({
    ok: false,
    code: "invalid_gender",
    message: "Nội dung yêu cầu VĐV nam.",
    ruleViolations: [{ message: "extra detail" }],
  });

  assert.match(message, /Nội dung yêu cầu VĐV nam/);
  assert.match(message, /extra detail/);
});

test("validateDisciplineSelectionStructured rejects wrong gender", () => {
  const result = validateDisciplineSelectionStructured({
    team,
    discipline: menDiscipline,
    playerIds: ["p3", "p4"],
    players,
  });

  assert.equal(result.ok, false);
  assert.equal(result.code, LINEUP_VALIDATION_CODE.INVALID_GENDER);
});

test("validateLineupSelectionsStructured rejects cross-discipline reuse", () => {
  const result = validateLineupSelectionsStructured({
    teamData: buildTeamData(),
    teamId: "team-a",
    selections: {
      "disc-men": ["p1", "p2"],
      "disc-mixed": ["p1", "p3"],
    },
    players,
    partial: true,
  });

  assert.equal(result.ok, false);
  assert.equal(result.code, LINEUP_VALIDATION_CODE.DUPLICATE_PLAYER);
});

test("validateLineupSelectionsStructured accepts valid gender lineup without reuse", () => {
  const singleDisciplineData = {
    teams: [team],
    disciplines: [menDiscipline],
    settings: { allowPlayerReusePerMatchup: false },
  };
  const result = validateLineupSelectionsStructured({
    teamData: singleDisciplineData,
    teamId: "team-a",
    selections: {
      "disc-men": ["p1", "p2"],
    },
    players,
    partial: false,
  });

  assert.equal(result.ok, true);
});

test("partial draft allows incomplete discipline", () => {
  const result = validateLineupSelectionsStructured({
    teamData: buildTeamData(),
    teamId: "team-a",
    selections: {
      "disc-men": ["p1"],
    },
    players,
    partial: true,
  });

  assert.equal(result.ok, true);
});
