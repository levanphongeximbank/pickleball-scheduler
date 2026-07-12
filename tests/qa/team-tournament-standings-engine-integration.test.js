import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { computeTeamStandings } from "../../src/features/team-tournament/engines/teamStandingsEngine.js";
import { loadFixture } from "../../scripts/qa/calculate-expected-team-standings.mjs";
import {
  normalizeStandingsBlock,
  normalizeStandingRow,
  STANDING_COMPARE_FIELDS,
} from "../../scripts/qa/standings-compare-helpers.mjs";
import {
  fixtureToTeamData,
  productionResultToStandingsBlock,
} from "./tt7-standings-integration-helpers.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES = resolve(__dirname, "../../docs/v5/qa/team-tournament/fixtures");
const EXPECTED = resolve(__dirname, "../../docs/v5/qa/team-tournament/expected");
const REPORT_PATH = resolve(__dirname, "../../docs/v5/qa/team-tournament/TT7_EXECUTION_REPORT.json");

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function classifyDiff(field) {
  if (field === "rank") return "P0";
  if (
    [
      "wins",
      "losses",
      "rankingPoints",
      "forfeitWins",
      "forfeitLosses",
      "withdrawn",
      "subMatchDiff",
    ].includes(field)
  ) {
    return "P1";
  }
  return "P2";
}

function buildMetricDiffs(actualBlock, expectedBlock) {
  const diffs = [];
  const actualByTeam = new Map(actualBlock.standings.map((row) => [row.teamId, row]));

  for (const expectedRow of expectedBlock.standings) {
    const actualRow = actualByTeam.get(expectedRow.teamId);
    if (!actualRow) {
      diffs.push({
        teamId: expectedRow.teamId,
        field: "teamId",
        expected: expectedRow.teamId,
        actual: null,
        severity: "P0",
      });
      continue;
    }

    for (const field of STANDING_COMPARE_FIELDS) {
      if (actualRow[field] !== expectedRow[field]) {
        diffs.push({
          teamId: expectedRow.teamId,
          field,
          expected: expectedRow[field],
          actual: actualRow[field],
          severity: classifyDiff(field),
        });
      }
    }
  }

  return diffs;
}

function runProductionComparison(fixturePath, expectedBlock, label, options = {}) {
  const fixture = loadFixture(fixturePath);
  const teamData = fixtureToTeamData(fixture, options);
  const engineResult = computeTeamStandings(teamData);
  const actualBlock = normalizeStandingsBlock(
    productionResultToStandingsBlock(engineResult, fixture, options.tiebreakOrder)
  );
  const expectedNormalized = normalizeStandingsBlock(expectedBlock);
  const diffs = buildMetricDiffs(actualBlock, expectedNormalized);

  return {
    label,
    fixtureId: fixture.meta?.fixtureId,
    actualBlock,
    expectedBlock: expectedNormalized,
    diffs,
    pass: diffs.length === 0,
  };
}

const executionResults = [];

function recordComparison(result) {
  executionResults.push({
    label: result.label,
    fixtureId: result.fixtureId,
    pass: result.pass,
    diffCount: result.diffs.length,
    diffs: result.diffs,
    highestSeverity: result.diffs.reduce(
      (max, diff) =>
        diff.severity === "P0"
          ? "P0"
          : max === "P0"
            ? "P0"
            : diff.severity === "P1"
              ? "P1"
              : max,
      null
    ),
  });
}

test("TT-7 execution — four-team production engine matches frozen expected", () => {
  const expected = readJson(resolve(EXPECTED, "tt7-four-teams-expected.json"));
  const result = runProductionComparison(
    resolve(FIXTURES, "tt7-four-teams.json"),
    expected.default,
    "four-team-default"
  );
  recordComparison(result);
  if (!result.pass) {
    assert.fail(
      `four-team mismatch (${result.diffs.length} diffs): ${JSON.stringify(result.diffs.slice(0, 5), null, 2)}`
    );
  }
});

test("TT-7 execution — six-team production engine matches frozen expected", () => {
  const expected = readJson(resolve(EXPECTED, "tt7-six-teams-expected.json"));
  const result = runProductionComparison(
    resolve(FIXTURES, "tt7-six-teams.json"),
    expected.default,
    "six-team-default"
  );
  recordComparison(result);
  if (!result.pass) {
    assert.fail(
      `six-team mismatch (${result.diffs.length} diffs): ${JSON.stringify(result.diffs.slice(0, 8), null, 2)}`
    );
  }
});

test("TT-7 execution — normal win/loss metrics (four-team team-b)", () => {
  const fixture = loadFixture(resolve(FIXTURES, "tt7-four-teams.json"));
  const teamData = fixtureToTeamData(fixture);
  const row = normalizeStandingRow(
    productionResultToStandingsBlock(computeTeamStandings(teamData), fixture).standings.find(
      (entry) => entry.teamId === "team-b"
    )
  );
  assert.equal(row.wins, 2);
  assert.equal(row.losses, 1);
  assert.equal(row.rankingPoints, 5);
  assert.equal(row.subMatchDiff, 2);
});

test("TT-7 execution — forfeit metrics (six-team team-d vs team-e)", () => {
  const fixture = loadFixture(resolve(FIXTURES, "tt7-six-teams.json"));
  const expected = readJson(resolve(EXPECTED, "tt7-six-teams-expected.json"));
  const teamData = fixtureToTeamData(fixture);
  const actual = normalizeStandingsBlock(
    productionResultToStandingsBlock(computeTeamStandings(teamData), fixture)
  );
  const expectedRow = expected.default.standings.find((row) => row.teamId === "team-d");
  const actualRow = actual.standings.find((row) => row.teamId === "team-d");
  const diffs = buildMetricDiffs(actual, normalizeStandingsBlock(expected.default)).filter(
    (diff) => diff.teamId === "team-d" || diff.teamId === "team-e"
  );
  recordComparison({
    label: "six-team-forfeit",
    fixtureId: fixture.meta.fixtureId,
    pass: diffs.length === 0,
    diffs,
  });
  if (diffs.length > 0) {
    assert.fail(`forfeit mismatch: ${JSON.stringify(diffs, null, 2)}`);
  }
  assert.equal(actualRow.wins, expectedRow.wins);
  assert.equal(actualRow.losses, expectedRow.losses);
});

test("TT-7 execution — withdrawn team flag (six-team team-f)", () => {
  const fixture = loadFixture(resolve(FIXTURES, "tt7-six-teams.json"));
  const expected = readJson(resolve(EXPECTED, "tt7-six-teams-expected.json"));
  const teamData = fixtureToTeamData(fixture);
  const actual = normalizeStandingsBlock(
    productionResultToStandingsBlock(computeTeamStandings(teamData), fixture)
  );
  const expectedRow = normalizeStandingRow(
    expected.default.standings.find((row) => row.teamId === "team-f")
  );
  const actualRow = actual.standings.find((row) => row.teamId === "team-f");
  const diffs = buildMetricDiffs(actual, normalizeStandingsBlock(expected.default)).filter(
    (diff) => diff.teamId === "team-f"
  );
  recordComparison({
    label: "six-team-withdrawn",
    fixtureId: fixture.meta.fixtureId,
    pass: diffs.length === 0,
    diffs,
  });
  if (diffs.length > 0) {
    assert.fail(`withdrawn mismatch: ${JSON.stringify(diffs, null, 2)}`);
  }
  assert.deepEqual(actualRow, expectedRow);
});

test("TT-7 execution — head-to-head tie-break profile (four-team)", () => {
  const expected = readJson(resolve(EXPECTED, "tt7-four-teams-expected.json"));
  const result = runProductionComparison(
    resolve(FIXTURES, "tt7-four-teams.json"),
    expected.profiles.headToHeadPriority,
    "four-team-headToHead",
    { tiebreakOrder: expected.profiles.headToHeadPriority.tiebreakOrder }
  );
  recordComparison(result);
  if (!result.pass) {
    assert.fail(`headToHead mismatch: ${JSON.stringify(result.diffs, null, 2)}`);
  }
});

test("TT-7 execution — sub-match diff tie-break ordering (four-team B vs C)", () => {
  const expected = readJson(resolve(EXPECTED, "tt7-four-teams-expected.json"));
  const result = runProductionComparison(
    resolve(FIXTURES, "tt7-four-teams.json"),
    expected.default,
    "four-team-subMatchDiff"
  );
  const b = result.actualBlock.standings.find((row) => row.teamId === "team-b");
  const c = result.actualBlock.standings.find((row) => row.teamId === "team-c");
  assert.ok(b.rank < c.rank);
  assert.equal(b.subMatchDiff, c.subMatchDiff);
  recordComparison(result);
});

test("TT-7 execution — points-scored tie-break (four-team A vs D)", () => {
  const fixture = loadFixture(resolve(FIXTURES, "tt7-four-teams.json"));
  const teamData = fixtureToTeamData(fixture);
  const actual = normalizeStandingsBlock(
    productionResultToStandingsBlock(computeTeamStandings(teamData), fixture)
  );
  const a = actual.standings.find((row) => row.teamId === "team-a");
  const d = actual.standings.find((row) => row.teamId === "team-d");
  assert.equal(a.wins, d.wins);
  assert.equal(a.subMatchDiff, d.subMatchDiff);
  assert.ok(d.pointDifference > a.pointDifference);
  assert.ok(d.rank < a.rank);
});

test("TT-7 execution — stable manual ordering when prior metrics tie", () => {
  const fixture = loadFixture(resolve(FIXTURES, "tt7-four-teams.json"));
  const teamData = fixtureToTeamData(fixture);
  const actual = normalizeStandingsBlock(
    productionResultToStandingsBlock(computeTeamStandings(teamData), fixture)
  );
  const b = actual.standings.find((row) => row.teamId === "team-b");
  const c = actual.standings.find((row) => row.teamId === "team-c");
  assert.equal(b.wins, c.wins);
  assert.equal(b.subMatchDiff, c.subMatchDiff);
  assert.ok(b.rank < c.rank);
});

test("TT-7 execution — metric tamper detection fails comparison", () => {
  const expected = readJson(resolve(EXPECTED, "tt7-four-teams-expected.json"));
  const tampered = structuredClone(expected.default);
  tampered.standings[0].pointsScored += 1;
  const result = runProductionComparison(
    resolve(FIXTURES, "tt7-four-teams.json"),
    tampered,
    "tamper-detection"
  );
  assert.equal(result.pass, false);
  assert.ok(result.diffs.some((diff) => diff.field === "pointsScored"));
});

test.after(() => {
  const p0 = executionResults.flatMap((entry) => entry.diffs || []).filter((diff) => diff.severity === "P0");
  const p1 = executionResults.flatMap((entry) => entry.diffs || []).filter((diff) => diff.severity === "P1");
  const p2 = executionResults.flatMap((entry) => entry.diffs || []).filter((diff) => diff.severity === "P2");
  const report = {
    reportType: "TT7_EXECUTION_REPORT",
    generatedAt: new Date().toISOString(),
    productionImpact: "NONE",
    verdict:
      executionResults.length > 0 && executionResults.every((entry) => entry.pass)
        ? "TT-7 EXECUTION PASS"
        : "TT-7 EXECUTION FAIL",
    comparisons: executionResults,
    findings: { P0: p0, P1: p1, P2: p2 },
  };
  writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`, "utf8");
});
