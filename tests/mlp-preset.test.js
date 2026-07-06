import test from "node:test";
import assert from "node:assert/strict";

import { FORMAT_PRESET, ACTIVATION_RULE } from "../src/features/team-tournament/constants.js";
import {
  createMlpPreset,
  createMlpDisciplines,
  isMlpFormat,
  computeLineupLockAt,
} from "../src/features/team-tournament/engines/mlpPresetEngine.js";
import { initializeTeamTournamentData } from "../src/features/team-tournament/engines/teamTournamentEngine.js";

test("MLP preset has WD before MD and dreambreaker discipline", () => {
  const preset = createMlpPreset();
  const doubles = preset.disciplines.filter(
    (discipline) => discipline.activationRule === ACTIVATION_RULE.ALWAYS
  );

  assert.equal(doubles[0].name, "Đôi nữ");
  assert.equal(doubles[1].name, "Đôi nam");
  assert.equal(preset.settings.formatPreset, FORMAT_PRESET.MLP_4);
  assert.equal(preset.settings.allowPlayerReusePerMatchup, true);
  assert.equal(preset.settings.rosterRules.maxPlayers, 4);

  const dreambreaker = createMlpDisciplines().find(
    (discipline) => discipline.activationRule === ACTIVATION_RULE.TIE_AT_2_2
  );
  assert.ok(dreambreaker);
  assert.equal(dreambreaker.name, "Dreambreaker");
});

test("initializeTeamTournamentData defaults to MLP preset", () => {
  const teamData = initializeTeamTournamentData({ formatPreset: FORMAT_PRESET.MLP_4 });
  assert.equal(isMlpFormat(teamData), true);
  assert.equal(teamData.disciplines.length, 5);
});

test("initializeTeamTournamentData custom keeps legacy disciplines", () => {
  const teamData = initializeTeamTournamentData();
  assert.equal(isMlpFormat(teamData), false);
  assert.equal(teamData.disciplines.length, 4);
  assert.equal(teamData.disciplines[0].name, "Đôi nam");
});

test("computeLineupLockAt subtracts lead minutes", () => {
  const scheduledAt = "2026-07-06T10:00:00.000Z";
  const lockAt = computeLineupLockAt(scheduledAt, 15);
  assert.equal(lockAt, "2026-07-06T09:45:00.000Z");
});
