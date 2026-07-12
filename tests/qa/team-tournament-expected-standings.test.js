import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import {
  calculateExpectedStandings,
  calculateTiebreakProfiles,
  loadFixture,
} from "../../scripts/qa/calculate-expected-team-standings.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES = resolve(__dirname, "../../docs/v5/qa/team-tournament/fixtures");
const EXPECTED = resolve(__dirname, "../../docs/v5/qa/team-tournament/expected");

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function rankOrder(standings) {
  return standings.standings.map((row) => row.teamId);
}

test("TT-7 oracle — four-team default standings match frozen expected file", () => {
  const fixture = loadFixture(resolve(FIXTURES, "tt7-four-teams.json"));
  const expected = readJson(resolve(EXPECTED, "tt7-four-teams-expected.json"));
  const actual = calculateExpectedStandings(fixture);

  assert.deepEqual(rankOrder(actual), rankOrder(expected.default));
  assert.equal(actual.standings[0].teamId, "team-b");
  assert.equal(actual.standings[1].teamId, "team-c");
});

test("TT-7 oracle — four-team headToHead profile ranks B above C", () => {
  const fixture = loadFixture(resolve(FIXTURES, "tt7-four-teams.json"));
  const profiles = calculateTiebreakProfiles(fixture, fixture.expectedProfiles);
  const h2h = profiles.headToHeadPriority;

  const b = h2h.standings.find((row) => row.teamId === "team-b");
  const c = h2h.standings.find((row) => row.teamId === "team-c");
  assert.equal(b.wins, 2);
  assert.equal(c.wins, 2);
  assert.equal(b.subMatchDiff, c.subMatchDiff);
  assert.ok(b.rank < c.rank);
});

test("TT-7 oracle — four-team one-win tie uses pointsScored between A and D", () => {
  const fixture = loadFixture(resolve(FIXTURES, "tt7-four-teams.json"));
  const result = calculateExpectedStandings(fixture);
  const a = result.standings.find((row) => row.teamId === "team-a");
  const d = result.standings.find((row) => row.teamId === "team-d");

  assert.equal(a.wins, 1);
  assert.equal(d.wins, 1);
  assert.equal(a.subMatchDiff, d.subMatchDiff);
  assert.ok(d.pointsScored > a.pointsScored);
});

test("TT-7 oracle — six-team forfeit and incomplete match handling", () => {
  const fixture = loadFixture(resolve(FIXTURES, "tt7-six-teams.json"));
  const result = calculateExpectedStandings(fixture);

  const e = result.standings.find((row) => row.teamId === "team-e");
  const d = result.standings.find((row) => row.teamId === "team-d");
  assert.equal(e.forfeitLosses, 1);
  assert.equal(e.losses, 1);
  assert.equal(d.wins, 2);
  assert.ok(d.rank < e.rank);
});

test("TT-7 oracle — six-team three-way tie in group 1 resolved by pointsScored", () => {
  const fixture = loadFixture(resolve(FIXTURES, "tt7-six-teams.json"));
  const group1Ids = new Set(["team-a", "team-b", "team-c"]);
  const result = calculateExpectedStandings(fixture);
  const group1 = result.standings
    .filter((row) => group1Ids.has(row.teamId))
    .sort((a, b) => b.pointsScored - a.pointsScored);

  group1.forEach((row) => {
    assert.equal(row.wins, 1);
    assert.equal(row.losses, 1);
    assert.equal(row.subMatchDiff, 0);
  });

  assert.equal(group1[0].teamId, "team-a");
  assert.equal(group1[1].teamId, "team-b");
  assert.equal(group1[2].teamId, "team-c");
});

test("TT-7 oracle — six-team exclude withdrawn team F from ranking profile", () => {
  const fixture = loadFixture(resolve(FIXTURES, "tt7-six-teams.json"));
  const profiles = calculateTiebreakProfiles(fixture, {
    group2_exclude_withdrawn: {
      tiebreakOrder: ["wins", "subMatchDiff", "pointsScored", "manual"],
      excludeWithdrawnFromRanking: true,
    },
  });

  const rankedIds = profiles.group2_exclude_withdrawn.standings.map((row) => row.teamId);
  assert.ok(!rankedIds.includes("team-f"));
  assert.equal(rankedIds.length, 5);
});

test("TT-7 oracle — frozen expected files are internally consistent", () => {
  const fourFixture = loadFixture(resolve(FIXTURES, "tt7-four-teams.json"));
  const fourExpected = readJson(resolve(EXPECTED, "tt7-four-teams-expected.json"));
  const fourActual = calculateExpectedStandings(fourFixture);
  assert.deepEqual(rankOrder(fourActual), rankOrder(fourExpected.default));

  const sixFixture = loadFixture(resolve(FIXTURES, "tt7-six-teams.json"));
  const sixExpected = readJson(resolve(EXPECTED, "tt7-six-teams-expected.json"));
  const sixActual = calculateExpectedStandings(sixFixture);
  assert.deepEqual(rankOrder(sixActual), rankOrder(sixExpected.default));
});
