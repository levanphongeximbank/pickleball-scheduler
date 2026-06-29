import test from "node:test";
import assert from "node:assert/strict";

import {
  BRACKET_ROUND_MIN_WIDTH,
  TOUCH_TARGET_MIN_HEIGHT,
  getBracketLanesMinWidth,
} from "../src/components/tournament/mobileUi.js";
import {
  buildDailyMatchCardProps,
  buildDirectorMatchCardProps,
} from "../src/components/tournament/matchCardProps.js";

test("mobileUi touch target is at least 48px", () => {
  assert.equal(TOUCH_TARGET_MIN_HEIGHT, 48);
});

test("getBracketLanesMinWidth scales with round count", () => {
  assert.equal(getBracketLanesMinWidth(1), BRACKET_ROUND_MIN_WIDTH);
  assert.equal(getBracketLanesMinWidth(3), 3 * BRACKET_ROUND_MIN_WIDTH + 2 * 16);
  assert.equal(getBracketLanesMinWidth(0), BRACKET_ROUND_MIN_WIDTH);
});

test("buildDailyMatchCardProps formats title, subtitle, and action", () => {
  const match = {
    id: "m1",
    teamALabel: "A1/A2",
    teamBLabel: "B1/B2",
    courtId: "c1",
    scoreA: 11,
    scoreB: 7,
  };

  let clicked = null;
  const props = buildDailyMatchCardProps(match, {
    actionLabel: "Nhap diem",
    onAction: (item) => {
      clicked = item.id;
    },
  });

  assert.equal(props.title, "A1/A2 vs B1/B2");
  assert.match(props.subtitle, /Sân c1/);
  assert.match(props.subtitle, /11-7/);
  assert.equal(props.actionLabel, "Nhap diem");

  props.onAction();
  assert.equal(clicked, "m1");
});

test("buildDirectorMatchCardProps prefers entry labels and badge", () => {
  const match = {
    id: "m2",
    entryALabel: "Team A",
    entryBLabel: "Team B",
    stageLabel: "Ban ket",
    courtId: null,
  };

  const props = buildDirectorMatchCardProps(match);
  assert.equal(props.title, "Team A vs Team B");
  assert.equal(props.badge, "Ban ket");
  assert.match(props.subtitle, /Chưa gán sân/);
});
