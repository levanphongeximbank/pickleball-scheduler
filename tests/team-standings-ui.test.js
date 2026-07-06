import test from "node:test";
import assert from "node:assert/strict";

import {
  buildTiebreakLegend,
  countMatchupsWithSubResults,
  formatFormatPresetLabel,
  formatSubMatchDiff,
  getStandingsRowClassName,
  getSubMatchDiffClassName,
} from "../src/components/tournament/team/teamStandingsLabels.js";
import { FORMAT_PRESET } from "../src/features/team-tournament/constants.js";

test("formatFormatPresetLabel maps MLP preset", () => {
  assert.equal(formatFormatPresetLabel(FORMAT_PRESET.MLP_4), "MLP 4 người");
  assert.equal(formatFormatPresetLabel(FORMAT_PRESET.CUSTOM), "Tùy chỉnh");
});

test("buildTiebreakLegend joins configured order", () => {
  const legend = buildTiebreakLegend(["wins", "subMatchDiff", "headToHead"]);
  assert.equal(legend, "Tie-break: Thắng → HS trận con");
});

test("countMatchupsWithSubResults counts ties with sub-match wins", () => {
  const matchups = [
    { result: { teamAWins: 2, teamBWins: 1 } },
    { result: { teamAWins: 0, teamBWins: 0 } },
    { result: null },
  ];
  assert.equal(countMatchupsWithSubResults(matchups), 1);
});

test("formatSubMatchDiff and diff class names", () => {
  assert.equal(formatSubMatchDiff(8), "+8");
  assert.equal(formatSubMatchDiff(-2), "-2");
  assert.equal(getSubMatchDiffClassName(3), "team-standings__diff--pos");
  assert.equal(getSubMatchDiffClassName(-1), "team-standings__diff--neg");
  assert.equal(getSubMatchDiffClassName(0), "");
});

test("getStandingsRowClassName highlights top three", () => {
  assert.equal(getStandingsRowClassName(1), "team-standings__row--first");
  assert.equal(getStandingsRowClassName(2), "team-standings__row--second");
  assert.equal(getStandingsRowClassName(3), "team-standings__row--third");
  assert.equal(getStandingsRowClassName(4), "");
});
