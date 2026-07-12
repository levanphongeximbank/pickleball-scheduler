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
import {
  normalizeStandingsBlock,
  normalizeExpectedFile,
  normalizeStandingRow,
  STANDING_COMPARE_FIELDS,
} from "../../scripts/qa/standings-compare-helpers.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES = resolve(__dirname, "../../docs/v5/qa/team-tournament/fixtures");
const EXPECTED = resolve(__dirname, "../../docs/v5/qa/team-tournament/expected");

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function assertDeepStandings(actualBlock, expectedBlock, label = "") {
  const a = normalizeStandingsBlock(actualBlock);
  const e = normalizeStandingsBlock(expectedBlock);
  assert.deepEqual(a.tiebreakOrder, e.tiebreakOrder, `${label} tiebreakOrder`);
  assert.equal(a.standings.length, e.standings.length, `${label} standings length`);
  for (let i = 0; i < e.standings.length; i += 1) {
    assert.deepEqual(a.standings[i], e.standings[i], `${label} row ${e.standings[i].teamId}`);
  }
}

test("TT-7 oracle — metric field contract is stable", () => {
  const fixture = loadFixture(resolve(FIXTURES, "tt7-four-teams.json"));
  const row = normalizeStandingRow(calculateExpectedStandings(fixture).standings[0]);
  assert.deepEqual(Object.keys(row).sort(), [...STANDING_COMPARE_FIELDS].sort());
});

test("TT-7 oracle — four-team full normalized standings match frozen expected", () => {
  const fixture = loadFixture(resolve(FIXTURES, "tt7-four-teams.json"));
  const expected = readJson(resolve(EXPECTED, "tt7-four-teams-expected.json"));
  const actual = calculateExpectedStandings(fixture);
  assertDeepStandings(actual, expected.default, "four-team default");
});

test("TT-7 oracle — six-team full normalized standings match frozen expected", () => {
  const fixture = loadFixture(resolve(FIXTURES, "tt7-six-teams.json"));
  const expected = readJson(resolve(EXPECTED, "tt7-six-teams-expected.json"));
  const actual = calculateExpectedStandings(fixture);
  assertDeepStandings(actual, expected.default, "six-team default");
});

test("TT-7 oracle — normal win metrics (four-team team-b)", () => {
  const fixture = loadFixture(resolve(FIXTURES, "tt7-four-teams.json"));
  const b = normalizeStandingRow(
    calculateExpectedStandings(fixture).standings.find((r) => r.teamId === "team-b")
  );
  assert.equal(b.wins, 2);
  assert.equal(b.losses, 1);
  assert.equal(b.played, 3);
  assert.equal(b.rankingPoints, 5);
  assert.equal(b.subMatchDiff, 2);
  assert.equal(b.pointDifference, 10);
  assert.equal(b.forfeitWins, 0);
  assert.equal(b.forfeitLosses, 0);
  assert.equal(b.withdrawn, false);
});

test("TT-7 oracle — forfeit win/loss metrics (six-team)", () => {
  const fixture = loadFixture(resolve(FIXTURES, "tt7-six-teams.json"));
  const result = calculateExpectedStandings(fixture);
  const e = normalizeStandingRow(result.standings.find((r) => r.teamId === "team-e"));
  const d = normalizeStandingRow(result.standings.find((r) => r.teamId === "team-d"));
  assert.equal(e.forfeitLosses, 1);
  assert.equal(e.losses, 1);
  assert.equal(d.forfeitWins, 1);
  assert.equal(d.wins, 2);
  assert.ok(d.pointsScored >= e.pointsScored);
});

test("TT-7 oracle — ranking points allocation", () => {
  const fixture = loadFixture(resolve(FIXTURES, "tt7-four-teams.json"));
  const rows = calculateExpectedStandings(fixture).standings.map(normalizeStandingRow);
  const totalRankingPoints = rows.reduce((sum, row) => sum + row.rankingPoints, 0);
  assert.equal(totalRankingPoints, 18);
  rows.forEach((row) => {
    assert.ok(row.rankingPoints === 4 || row.rankingPoints === 5);
  });
});

test("TT-7 oracle — points scored/conceded and point difference", () => {
  const fixture = loadFixture(resolve(FIXTURES, "tt7-four-teams.json"));
  const a = normalizeStandingRow(
    calculateExpectedStandings(fixture).standings.find((r) => r.teamId === "team-a")
  );
  const d = normalizeStandingRow(
    calculateExpectedStandings(fixture).standings.find((r) => r.teamId === "team-d")
  );
  assert.equal(a.pointsScored, 82);
  assert.equal(a.pointsConceded, 92);
  assert.equal(a.pointDifference, -10);
  assert.equal(d.pointsScored, 88);
  assert.equal(d.pointsConceded, 95);
  assert.equal(d.pointDifference, -7);
});

test("TT-7 oracle — withdrawn team retains flag in standings row", () => {
  const fixture = loadFixture(resolve(FIXTURES, "tt7-six-teams.json"));
  const f = normalizeStandingRow(
    calculateExpectedStandings(fixture).standings.find((r) => r.teamId === "team-f")
  );
  assert.equal(f.withdrawn, true);
});

test("TT-7 oracle — tie-break ordering headToHead profile full compare", () => {
  const fixture = loadFixture(resolve(FIXTURES, "tt7-four-teams.json"));
  const expected = readJson(resolve(EXPECTED, "tt7-four-teams-expected.json"));
  const profiles = calculateTiebreakProfiles(fixture, fixture.expectedProfiles);
  assertDeepStandings(profiles.headToHeadPriority, expected.profiles.headToHeadPriority, "h2h profile");
});

test("TT-7 oracle — tie-break ordering default rank differs from headToHead at B/C", () => {
  const fixture = loadFixture(resolve(FIXTURES, "tt7-four-teams.json"));
  const defaultResult = calculateExpectedStandings(fixture);
  const h2h = calculateTiebreakProfiles(fixture, fixture.expectedProfiles).headToHeadPriority;
  const bDefault = defaultResult.standings.find((r) => r.teamId === "team-b").rank;
  const cDefault = defaultResult.standings.find((r) => r.teamId === "team-c").rank;
  const bH2h = h2h.standings.find((r) => r.teamId === "team-b").rank;
  const cH2h = h2h.standings.find((r) => r.teamId === "team-c").rank;
  assert.ok(bDefault < cDefault);
  assert.ok(bH2h < cH2h);
  assert.equal(normalizeStandingRow(defaultResult.standings.find((r) => r.teamId === "team-b")).wins, 2);
  assert.equal(normalizeStandingRow(defaultResult.standings.find((r) => r.teamId === "team-c")).wins, 2);
});

test("TT-7 oracle — exclude withdrawn profile full normalized compare", () => {
  const fixture = loadFixture(resolve(FIXTURES, "tt7-six-teams.json"));
  const expected = readJson(resolve(EXPECTED, "tt7-six-teams-expected.json"));
  const profiles = calculateTiebreakProfiles(fixture, {
    group2_exclude_withdrawn: {
      tiebreakOrder: ["wins", "subMatchDiff", "pointsScored", "manual"],
      excludeWithdrawnFromRanking: true,
    },
  });
  assertDeepStandings(
    profiles.group2_exclude_withdrawn,
    expected.profiles.group2_exclude_withdrawn,
    "exclude withdrawn"
  );
});

test("TT-7 oracle — frozen expected files fully normalized consistent", () => {
  const fourFixture = loadFixture(resolve(FIXTURES, "tt7-four-teams.json"));
  const fourExpected = normalizeExpectedFile(readJson(resolve(EXPECTED, "tt7-four-teams-expected.json")));
  const fourActual = normalizeStandingsBlock(calculateExpectedStandings(fourFixture));
  assert.deepEqual(fourActual, fourExpected.default);

  const sixFixture = loadFixture(resolve(FIXTURES, "tt7-six-teams.json"));
  const sixExpected = normalizeExpectedFile(readJson(resolve(EXPECTED, "tt7-six-teams-expected.json")));
  const sixActual = normalizeStandingsBlock(calculateExpectedStandings(sixFixture));
  assert.deepEqual(sixActual, sixExpected.default);
});

test("TT-7 oracle — deep compare fails if expected metric changes but rank unchanged", () => {
  const fixture = loadFixture(resolve(FIXTURES, "tt7-four-teams.json"));
  const expected = readJson(resolve(EXPECTED, "tt7-four-teams-expected.json"));
  const tampered = structuredClone(expected.default);
  tampered.standings[0].pointsScored += 1;
  assert.throws(() => {
    assertDeepStandings(calculateExpectedStandings(fixture), tampered, "tampered");
  }, /pointsScored|deepEqual/);
});
