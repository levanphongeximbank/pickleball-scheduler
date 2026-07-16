import test from "node:test";
import assert from "node:assert/strict";

import {
  SHOWCASE_STAGE,
  buildShowcasePreflight,
  createInitialShowcaseState,
  reduceShowcaseState,
} from "../src/features/team-tournament/showcase/index.js";
import {
  TT_V6_TT32_ATHLETES,
  TT_V6_TT32_FIXTURE,
} from "../src/features/team-tournament/fixtures/ttV6Tt32StagingFixture.js";

function toPlayers(rows = TT_V6_TT32_ATHLETES) {
  return rows.map((row) => ({
    id: row.playerId,
    name: row.displayName,
    gender: row.gender,
    ratingValue: row.rating,
    ratingSource: "pick_vn_current",
  }));
}

function preflight(players, options = {}) {
  return buildShowcasePreflight({
    athletes: players,
    tournamentName: "TT32 Showcase",
    clubName: TT_V6_TT32_FIXTURE.clubName,
    requestedTeamCount: 8,
    rulesVersion: "rules-tt32-v1",
    setupMutationGate: true,
    canManage: true,
    ...options,
  });
}

test("setup: TT32 valid state is 32/16/16, 8 teams, 0 waiting", () => {
  const result = preflight(toPlayers());

  assert.equal(result.ok, true);
  assert.equal(result.summary.clubName, "CLB TEST TT32");
  assert.equal(result.summary.athleteCount, 32);
  assert.equal(result.summary.maleCount, 16);
  assert.equal(result.summary.femaleCount, 16);
  assert.equal(result.summary.requestedTeamCount, 8);
  assert.equal(result.summary.expectedTeamCount, 8);
  assert.equal(result.summary.expectedWaitingListCount, 0);
  assert.deepEqual(
    result.summary.groupOptions.map((option) => option.label),
    ["2 bảng × 4 đội", "4 bảng × 2 đội"]
  );
});

test("setup: no selected athletes blocks countdown with Vietnamese message", () => {
  const result = preflight([]);

  assert.equal(result.ok, false);
  assert.ok(result.blockers.includes("Chưa chọn vận động viên cho lễ bốc thăm."));
  assert.equal(result.summary.athleteCount, 0);
  assert.equal(result.summary.expectedTeamCount, 0);
});

test("setup: insufficient gender and expected team shortfall are visible", () => {
  const players = toPlayers();
  const selected = [
    ...players.filter((player) => player.gender === "male"),
    ...players.filter((player) => player.gender === "female").slice(0, 8),
  ];
  const result = preflight(selected);

  assert.equal(result.ok, false);
  assert.equal(result.summary.maleCount, 16);
  assert.equal(result.summary.femaleCount, 8);
  assert.equal(result.summary.expectedTeamCount, 4);
  assert.equal(result.summary.expectedWaitingListCount, 8);
  assert.ok(result.blockers.some((message) => message.includes("dự kiến chỉ 4")));
  assert.ok(result.blockers.some((message) => message.includes("Thiếu số lượng nam/nữ")));
});

test("setup: invalid requested team count is blocked", () => {
  const result = preflight(toPlayers(), { requestedTeamCount: 0 });

  assert.equal(result.ok, false);
  assert.ok(result.blockers.some((message) => message.includes("không hợp lệ")));
});

test("setup: missing identity, rating, rulesVersion, and fatal rules are visible", () => {
  const players = toPlayers();
  players[0] = { ...players[0], id: "" };
  players[1] = { ...players[1], ratingValue: null };
  const result = preflight(players, {
    rulesVersion: "",
    fatalConflicts: true,
  });

  assert.equal(result.ok, false);
  assert.ok(result.blockers.some((message) => message.includes("athletes.id")));
  assert.ok(result.blockers.some((message) => message.includes("rulesVersion")));
  assert.ok(result.blockers.some((message) => message.includes("fatalConflicts")));
  assert.ok(result.warnings.some((message) => message.includes("trình độ canonical")));
  assert.ok(result.summary.ratingCoverage < 100);
});

test("setup: selected group format remains fixed through presentation stages", () => {
  const selectedAthleteIds = toPlayers().map((player) => player.id);
  let state = reduceShowcaseState(createInitialShowcaseState(), {
    type: "OPEN_LIVE",
    payload: {
      preflight: { ok: true },
      setupConfig: {
        teamCount: 8,
        groupCount: 4,
        selectedAthleteIds,
      },
    },
  });

  for (const stage of [
    SHOWCASE_STAGE.COUNTDOWN,
    SHOWCASE_STAGE.PROCESSING,
    SHOWCASE_STAGE.TEAM_REVEAL,
    SHOWCASE_STAGE.CAPTAIN_REVEAL,
    SHOWCASE_STAGE.GROUP_REVEAL,
  ]) {
    state = reduceShowcaseState(state, {
      type: "GO_STAGE",
      payload: { stage },
    });
    assert.equal(state.setupConfig.groupCount, 4);
    assert.deepEqual(state.setupConfig.selectedAthleteIds, selectedAthleteIds);
  }
});
