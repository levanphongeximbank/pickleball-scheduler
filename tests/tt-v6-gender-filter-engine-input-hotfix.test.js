import test from "node:test";
import assert from "node:assert/strict";

import {
  athleteGenderDisplayLabel,
  normalizeAthleteGender,
} from "../src/models/player.js";
import { filterPlayers } from "../src/utils/playerHelpers.js";
import { filterTournamentPickerPlayers } from "../src/utils/tournamentPlayerPicker.js";
import {
  buildShowcaseAthleteCounters,
  clearFilteredShowcaseAthleteSelection,
  filterShowcaseAthletesForDisplay,
  selectEligibleShowcaseAthletesInFilter,
} from "../src/features/team-tournament/showcase/showcaseSetupModel.js";
import { reconcileSelectedAthletesForEngineInput } from "../src/features/team-tournament/showcase/reconcileSelectedAthletesForEngineInput.js";
import { generateShowcaseTeamDraw } from "../src/features/team-tournament/showcase/showcaseDrawSession.js";

const mixedPool = [
  { id: "m1", name: "A", gender: "male", ratingValue: 4 },
  { id: "m2", name: "B", gender: "M", ratingValue: 4 },
  { id: "m3", name: "C", gender: "Nam", ratingValue: 4 },
  { id: "m4", name: "D", gender: "nam", ratingValue: 4 },
  { id: "f1", name: "Chị Tuyết", gender: "female", ratingValue: 4 },
  { id: "f2", name: "Hiền", gender: "F", ratingValue: 4 },
  { id: "f3", name: "E", gender: "Nữ", ratingValue: 4 },
  { id: "f4", name: "F", gender: "nữ", ratingValue: 4 },
];

test("normalizeAthleteGender maps female variants to female", () => {
  for (const value of ["female", "F", "f", "Nữ", "nữ", "nu", "NU"]) {
    assert.equal(normalizeAthleteGender(value), "female", value);
  }
  assert.equal(normalizeAthleteGender({ gender: "Nữ" }), "female");
  assert.equal(athleteGenderDisplayLabel("F"), "Nữ");
});

test("normalizeAthleteGender maps male variants to male", () => {
  for (const value of ["male", "M", "m", "Nam", "nam"]) {
    assert.equal(normalizeAthleteGender(value), "male", value);
  }
  assert.equal(athleteGenderDisplayLabel("Nam"), "Nam");
});

test("normalizeAthleteGender maps null/other to unknown", () => {
  assert.equal(normalizeAthleteGender(null), "unknown");
  assert.equal(normalizeAthleteGender(""), "unknown");
  assert.equal(normalizeAthleteGender("other"), "unknown");
  assert.equal(normalizeAthleteGender("khác"), "unknown");
});

test("female filter returns all visibly female athletes across raw encodings", () => {
  const filtered = filterPlayers(mixedPool, { genderFilter: "Nữ" });
  assert.equal(filtered.length, 4);
  assert.deepEqual(
    filtered.map((row) => row.id).sort(),
    ["f1", "f2", "f3", "f4"]
  );
  const maleFilter = filterTournamentPickerPlayers(mixedPool, { genderFilter: "male" });
  assert.equal(maleFilter.length, 4);
});

test("switching filters preserves full selection and separate counters", () => {
  const selected = mixedPool.map((row) => row.id);
  const allDisplay = filterShowcaseAthletesForDisplay(mixedPool, {
    genderFilter: "all",
    selectedAthleteIds: selected,
  });
  const maleDisplay = filterShowcaseAthletesForDisplay(mixedPool, {
    genderFilter: "male",
    selectedAthleteIds: selected,
  });
  const femaleDisplay = filterShowcaseAthletesForDisplay(mixedPool, {
    genderFilter: "female",
    selectedAthleteIds: selected,
  });
  assert.equal(selected.length, 8);
  assert.equal(allDisplay.length, 8);
  // selected remain visible even when gender differs
  assert.equal(maleDisplay.length, 8);
  assert.equal(femaleDisplay.length, 8);

  const countersAll = buildShowcaseAthleteCounters(mixedPool, selected, {
    displayedCount: allDisplay.length,
  });
  const countersMale = buildShowcaseAthleteCounters(mixedPool, selected, {
    displayedCount: filterTournamentPickerPlayers(mixedPool, { genderFilter: "male" }).length,
  });
  assert.equal(countersAll.selectedCount, 8);
  assert.equal(countersMale.selectedCount, 8);
  assert.equal(countersAll.totalAvailable, 8);
  assert.equal(countersMale.displayedCount, 4);
  assert.notEqual(`${countersMale.selectedCount}/${countersMale.displayedCount}`, "ambiguous");
});

test("select current filter preserves other-gender selections; clear filtered does not wipe hidden", () => {
  let selected = ["m1", "m2"];
  selected = selectEligibleShowcaseAthletesInFilter(mixedPool, selected, {
    genderFilter: "female",
  });
  assert.ok(selected.includes("m1"));
  assert.ok(selected.includes("f1"));
  assert.equal(selected.length, 6);

  selected = clearFilteredShowcaseAthleteSelection(mixedPool, selected, {
    genderFilter: "female",
  });
  assert.deepEqual(selected.sort(), ["m1", "m2"]);
});

test("32 selected with 4 unknown gender cannot silently become 28", () => {
  const athletes = [];
  for (let i = 0; i < 16; i += 1) {
    athletes.push({ id: `m${i}`, name: `Nam ${i}`, gender: "male", ratingValue: 4 });
  }
  for (let i = 0; i < 12; i += 1) {
    athletes.push({ id: `f${i}`, name: `Nu ${i}`, gender: "female", ratingValue: 4 });
  }
  for (let i = 0; i < 4; i += 1) {
    athletes.push({ id: `u${i}`, name: `Unknown ${i}`, gender: null, ratingValue: 4 });
  }
  const selected = athletes.map((row) => row.id);
  const reconciled = reconcileSelectedAthletesForEngineInput({
    athletes,
    selectedAthleteIds: selected,
    requestedTeamCount: 8,
    athletesPerTeam: 4,
    requireMlpBalance: true,
  });
  assert.equal(reconciled.selectedCount, 32);
  assert.equal(reconciled.finalEngineInputCount, 28);
  assert.equal(reconciled.ok, false);
  assert.match(reconciled.message, /chọn 32 VĐV nhưng hệ thống chỉ xác nhận 28/);
  assert.equal(reconciled.removals.length, 4);
  for (const removal of reconciled.removals) {
    assert.equal(removal.removalReason, "UNKNOWN_GENDER");
    assert.ok(removal.athleteId);
    assert.ok(removal.athleteName);
  }
});

test("MLP 32 athletes produces 8 teams and ceremony total 32/32", () => {
  const athletes = [];
  for (let i = 0; i < 16; i += 1) {
    athletes.push({ id: `m${i}`, name: `Nam ${i}`, gender: i % 2 ? "Nam" : "male", ratingValue: 4 + (i % 3) * 0.1 });
  }
  for (let i = 0; i < 16; i += 1) {
    athletes.push({ id: `f${i}`, name: `Nu ${i}`, gender: i % 2 ? "Nữ" : "female", ratingValue: 4 + (i % 3) * 0.1 });
  }
  const reconciled = reconcileSelectedAthletesForEngineInput({
    athletes,
    selectedAthleteIds: athletes.map((row) => row.id),
    requestedTeamCount: 8,
  });
  assert.equal(reconciled.ok, true);
  assert.equal(reconciled.finalEngineInputCount, 32);

  const generated = generateShowcaseTeamDraw({
    players: reconciled.finalAthletes,
    selectedPlayerIds: reconciled.finalAthletes.map((row) => row.id),
    teamCount: 8,
    randomFn: () => 0.42,
  });
  assert.equal(generated.ok, true);
  const teams = generated.session.teamData.teams;
  assert.equal(teams.length, 8);
  const used = teams.flatMap((team) => team.playerIds || []);
  assert.equal(used.length, 32);
  assert.equal(new Set(used).size, 32);
  assert.equal(generated.session.waitingPlayerIds.length, 0);
});

test("identical normalized gender values across AI picker and Showcase filter", () => {
  const showcaseFemale = filterShowcaseAthletesForDisplay(mixedPool, {
    genderFilter: "female",
    selectedAthleteIds: [],
  });
  const aiFemale = filterTournamentPickerPlayers(mixedPool, { genderFilter: "Nữ" });
  assert.deepEqual(
    showcaseFemale.map((row) => row.id).sort(),
    aiFemale.map((row) => row.id).sort()
  );
});
