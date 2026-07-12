import { test } from "node:test";
import assert from "node:assert/strict";

import {
  LINEUP_SOURCE,
  LINEUP_STATUS,
  MATCHUP_STATUS,
} from "../src/features/team-tournament/constants.js";
import {
  PUBLISH_BLOCK_CODES,
  resolveCanPublishLocal,
  resolveLineupVersions,
  resolvePublishReadiness,
  isOpponentLineupVisible,
} from "../src/features/team-tournament/engines/atomicPublishWorkflowEngine.js";
import { getVisibleLineup } from "../src/features/team-tournament/engines/lineupEngine.js";
import {
  buildPublishRpcArgs,
  preparePublishRpcCall,
} from "../src/features/team-tournament/services/teamTournamentRpcService.js";
import { createEmptyTeamData, lineupKey } from "../src/features/team-tournament/models/index.js";

function buildLockedFixture() {
  const teamData = createEmptyTeamData({
    teams: [
      { id: "team-a", name: "A", playerIds: ["p1", "p2"] },
      { id: "team-b", name: "B", playerIds: ["p3", "p4"] },
    ],
    matchups: [
      {
        id: "m1",
        teamAId: "team-a",
        teamBId: "team-b",
        status: MATCHUP_STATUS.LOCKED,
        version: 3,
      },
    ],
  });

  for (const teamId of ["team-a", "team-b"]) {
    teamData.lineups[lineupKey("m1", teamId)] = {
      matchupId: "m1",
      teamId,
      status: LINEUP_STATUS.LOCKED,
      selections: { d1: ["p1", "p2"] },
      source: LINEUP_SOURCE.CAPTAIN,
      version: teamId === "team-a" ? 2 : 4,
    };
  }

  return teamData;
}

test("resolveCanPublishLocal true when locked", () => {
  const state = resolveCanPublishLocal({ status: MATCHUP_STATUS.LOCKED });
  assert.equal(state.canPublish, true);
});

test("resolveCanPublishLocal false when not locked", () => {
  const state = resolveCanPublishLocal({ status: MATCHUP_STATUS.LINEUP_OPEN });
  assert.equal(state.canPublish, false);
  assert.equal(state.blockCode, PUBLISH_BLOCK_CODES.MATCHUP_NOT_LOCKED);
});

test("resolveCanPublishLocal false when already published", () => {
  const state = resolveCanPublishLocal({ status: MATCHUP_STATUS.PUBLISHED });
  assert.equal(state.canPublish, false);
  assert.equal(state.blockCode, PUBLISH_BLOCK_CODES.ALREADY_PUBLISHED);
});

test("resolvePublishReadiness uses server canPublish when provided", () => {
  const teamData = buildLockedFixture();
  const matchup = {
    ...teamData.matchups[0],
    canPublish: false,
    publishBlockCode: "manual_pending",
    publishBlockMessage: "Chờ xử lý thủ công",
  };
  const readiness = resolvePublishReadiness({ teamData, matchup, policy: "random" });
  assert.equal(readiness.canPublish, false);
  assert.equal(readiness.blockCode, "manual_pending");
});

test("resolvePublishReadiness detects missing lineup", () => {
  const teamData = buildLockedFixture();
  delete teamData.lineups[lineupKey("m1", "team-b")];
  const readiness = resolvePublishReadiness({
    teamData,
    matchup: teamData.matchups[0],
    policy: "random",
  });
  assert.equal(readiness.canPublish, false);
  assert.equal(readiness.blockCode, PUBLISH_BLOCK_CODES.LINEUP_MISSING);
});

test("resolveLineupVersions reads lineup versions", () => {
  const teamData = buildLockedFixture();
  const versions = resolveLineupVersions(teamData, teamData.matchups[0]);
  assert.equal(versions.lineupAVersion, 2);
  assert.equal(versions.lineupBVersion, 4);
});

test("preparePublishRpcCall rejects missing lineup versions", () => {
  const result = preparePublishRpcCall(
    { p_tournament_id: "t1", p_matchup_id: "m1" },
    { expectedVersion: 1, expectedLineupAVersion: 2, idempotencyKey: "k1" }
  );
  assert.equal(result.ok, false);
  assert.equal(result.code, "MISSING_EXPECTED_LINEUP_VERSION");
});

test("buildPublishRpcArgs emits TT-2E contract", () => {
  const args = buildPublishRpcArgs(
    { p_tournament_id: "t1", p_matchup_id: "m1" },
    {
      expectedVersion: 3,
      expectedLineupAVersion: 2,
      expectedLineupBVersion: 4,
      idempotencyKey: "pub-1",
    }
  );
  assert.equal(args.p_expected_matchup_version, 3);
  assert.equal(args.p_expected_lineup_a_version, 2);
  assert.equal(args.p_expected_lineup_b_version, 4);
  assert.equal(args.p_idempotency_key, "pub-1");
});

test("visibility hides opponent before publish", () => {
  const teamData = buildLockedFixture();
  const visible = getVisibleLineup(teamData, {
    matchupId: "m1",
    viewerTeamId: "team-a",
    isOrganizer: false,
  });
  assert.ok(visible.ownLineup);
  assert.equal(visible.opponentLineup, null);
});

test("visibility shows opponent after publish", () => {
  const teamData = buildLockedFixture();
  teamData.matchups[0].status = MATCHUP_STATUS.PUBLISHED;
  const visible = getVisibleLineup(teamData, {
    matchupId: "m1",
    viewerTeamId: "team-a",
    isOrganizer: false,
  });
  assert.ok(visible.opponentLineup);
});

test("isOpponentLineupVisible requires published matchup for captain", () => {
  assert.equal(
    isOpponentLineupVisible({
      matchup: { status: MATCHUP_STATUS.LOCKED },
      viewerTeamId: "team-a",
    }),
    false
  );
  assert.equal(
    isOpponentLineupVisible({
      matchup: { status: MATCHUP_STATUS.PUBLISHED },
      viewerTeamId: "team-a",
    }),
    true
  );
});
