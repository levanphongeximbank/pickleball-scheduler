import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

import { stripLegacyProfileClubFields } from "../src/features/club/services/clubActiveMembershipService.js";
import {
  buildCaptainDreambreakerSubmitCommand,
  sanitizeCaptainDreambreakerSubmitResponse,
  validateCaptainDreambreakerOrder,
} from "../src/features/team-tournament/engines/captainDreambreakerPortalContract.js";
import { submitDreambreakerOrder } from "../src/features/team-tournament/engines/dreambreakerEngine.js";
import { DREAMBREAKER_STATUS, FORMAT_PRESET } from "../src/features/team-tournament/constants.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

function readSrc(rel) {
  return readFileSync(join(root, rel), "utf8");
}

const MATCHUP_ID = "matchup-1o9rud3t";
const TOURNAMENT_ID = "team-tournament-ikae8fpk";
const TEAM_A = "team-m3528fhd";
const TEAM_B = "team-qifwxe4o";
const TEAM_C = "team-2qisypjc";
const ROSTER_A = ["a1", "a2", "a3", "a4"];
const ROSTER_B = ["b1", "b2", "b3", "b4"];

const TT412_CAPTAINS = [
  {
    label: "M04",
    email: "tt412.seed.m04@staging.local",
    profileId: "c412a001-7e57-4000-8000-000000000004",
    playerId: "c412a101-7e57-4000-8000-000000000004",
    teamId: "team-iywvmq1a",
    rosterIds: ["m04-1", "m04-2", "m04-3", "m04-4"],
    opponentTeamId: "team-other-m04",
  },
  {
    label: "M01",
    email: "tt412.seed.m01@staging.local",
    profileId: "c412a001-7e57-4000-8000-000000000001",
    playerId: "c412a101-7e57-4000-8000-000000000001",
    teamId: TEAM_B,
    rosterIds: ROSTER_B,
    opponentTeamId: TEAM_A,
  },
  {
    label: "M03",
    email: "tt412.seed.m03@staging.local",
    profileId: "c412a001-7e57-4000-8000-000000000003",
    playerId: "c412a101-7e57-4000-8000-000000000003",
    teamId: TEAM_C,
    rosterIds: ["m03-1", "m03-2", "m03-3", "m03-4"],
    opponentTeamId: "team-other-m03",
  },
  {
    label: "M02",
    email: "tt412.seed.m02@staging.local",
    profileId: "c412a001-7e57-4000-8000-000000000002",
    playerId: "c412a101-7e57-4000-8000-000000000002",
    teamId: TEAM_A,
    rosterIds: ROSTER_A,
    opponentTeamId: TEAM_B,
  },
];

function sessionUser(captain) {
  return stripLegacyProfileClubFields({
    id: captain.profileId,
    email: captain.email,
    role: "PLAYER",
    clubId: "club-ecebf64c78f948ccb2b59842441eb26c",
    club_id: "club-ecebf64c78f948ccb2b59842441eb26c",
    playerId: captain.playerId,
    player_id: captain.playerId,
  });
}

function matchupFor(captain, version = 1) {
  return {
    id: MATCHUP_ID,
    teamAId: captain.teamId,
    teamBId: captain.opponentTeamId,
    version: 44,
    dreambreaker: {
      required: true,
      status: DREAMBREAKER_STATUS.LINEUP_OPEN,
      version,
      canSubmitOwnOrder: true,
      ownOrder: [],
      opponentOrderSubmitted: false,
    },
  };
}

test("A: Valid captain with session.clubId=null can build own-order submit command", () => {
  const captain = TT412_CAPTAINS.find((item) => item.label === "M02");
  const user = sessionUser(captain);
  assert.equal(user.clubId, null);
  assert.equal(user.playerId, captain.playerId);

  const command = buildCaptainDreambreakerSubmitCommand({
    matchup: matchupFor(captain, 1),
    teamId: captain.teamId,
    viewerTeamId: captain.teamId,
    order: captain.rosterIds,
    rosterIds: captain.rosterIds,
  });
  assert.equal(command.ok, true);
  assert.equal(command.payload.expectedVersion, 1);
  assert.equal(command.payload.teamId, captain.teamId);
  assert.match(command.payload.idempotencyKey, /^db-order:/);

  const portal = readSrc("src/pages/tournament/TeamPortal.jsx");
  const submitFn = portal.slice(
    portal.indexOf("async function handleDreambreakerSubmit"),
    portal.indexOf("if (membershipPending || loading")
  );
  assert.doesNotMatch(submitFn, /CLUB_UNASSIGNED/);
  assert.doesNotMatch(submitFn, /guardClubAccess/);
  assert.doesNotMatch(submitFn, /guardCaptainLineupAction/);
  assert.doesNotMatch(submitFn, /captainSubmitDreambreakerOrder/);
  assert.match(submitFn, /submitDreambreakerOrder/);
});

test("B: All four QA captain identity shapes share the same client contract", () => {
  assert.equal(TT412_CAPTAINS.length, 4);
  for (const captain of TT412_CAPTAINS) {
    const user = sessionUser(captain);
    assert.equal(user.clubId, null, `${captain.label} session.clubId must be stripped`);
    assert.equal(user.playerId, captain.playerId);

    const command = buildCaptainDreambreakerSubmitCommand({
      matchup: matchupFor(captain, 1),
      teamId: captain.teamId,
      viewerTeamId: captain.teamId,
      order: captain.rosterIds,
      rosterIds: captain.rosterIds,
    });
    assert.equal(command.ok, true, `${captain.label} must submit own order`);
    assert.equal(command.payload.teamId, captain.teamId);
    assert.equal(command.payload.expectedVersion, 1);
  }
});

test("C: Non-captain / wrong viewer cannot submit", () => {
  const result = validateCaptainDreambreakerOrder({
    order: ROSTER_A,
    rosterIds: ROSTER_A,
    viewerTeamId: "",
    submitTeamId: TEAM_A,
    matchup: { teamAId: TEAM_A, teamBId: TEAM_B },
  });
  assert.equal(result.ok, false);
});

test("D: Captain cannot submit as opponent team", () => {
  const result = buildCaptainDreambreakerSubmitCommand({
    matchup: { id: MATCHUP_ID, teamAId: TEAM_A, teamBId: TEAM_B, dreambreaker: { version: 1 } },
    teamId: TEAM_B,
    viewerTeamId: TEAM_A,
    order: ROSTER_B,
    rosterIds: ROSTER_B,
  });
  assert.equal(result.ok, false);
});

test("E: Captain cannot submit a team not participating in matchup", () => {
  const result = buildCaptainDreambreakerSubmitCommand({
    matchup: { id: MATCHUP_ID, teamAId: TEAM_A, teamBId: TEAM_B, dreambreaker: { version: 1 } },
    teamId: TEAM_C,
    viewerTeamId: TEAM_C,
    order: ["c1", "c2", "c3", "c4"],
    rosterIds: ["c1", "c2", "c3", "c4"],
  });
  assert.equal(result.ok, false);
});

test("F: Wrong tournament/matchup rejected by missing matchup / empty matchupId", () => {
  const missing = buildCaptainDreambreakerSubmitCommand({
    matchup: null,
    teamId: TEAM_A,
    viewerTeamId: TEAM_A,
    order: ROSTER_A,
    rosterIds: ROSTER_A,
  });
  assert.equal(missing.ok, false);

  const noId = buildCaptainDreambreakerSubmitCommand({
    matchup: { teamAId: TEAM_A, teamBId: TEAM_B, dreambreaker: { version: 1 } },
    teamId: TEAM_A,
    viewerTeamId: TEAM_A,
    order: ROSTER_A,
    rosterIds: ROSTER_A,
  });
  assert.equal(noId.ok, false);
});

test("G: Own order must contain exactly four unique own-team athletes", () => {
  assert.equal(
    validateCaptainDreambreakerOrder({
      order: ["a1", "a2", "a3"],
      rosterIds: ROSTER_A,
      viewerTeamId: TEAM_A,
      submitTeamId: TEAM_A,
      matchup: { id: MATCHUP_ID, teamAId: TEAM_A, teamBId: TEAM_B },
    }).ok,
    false
  );
  assert.equal(
    validateCaptainDreambreakerOrder({
      order: ["a1", "a2", "a3", "a1"],
      rosterIds: ROSTER_A,
      viewerTeamId: TEAM_A,
      submitTeamId: TEAM_A,
      matchup: { id: MATCHUP_ID, teamAId: TEAM_A, teamBId: TEAM_B },
    }).ok,
    false
  );
  assert.equal(
    validateCaptainDreambreakerOrder({
      order: ["a1", "a2", "a3", "b1"],
      rosterIds: ROSTER_A,
      viewerTeamId: TEAM_A,
      submitTeamId: TEAM_A,
      matchup: { id: MATCHUP_ID, teamAId: TEAM_A, teamBId: TEAM_B },
    }).ok,
    false
  );
  assert.equal(
    validateCaptainDreambreakerOrder({
      order: ROSTER_A,
      rosterIds: ROSTER_A,
      viewerTeamId: TEAM_A,
      submitTeamId: TEAM_A,
      matchup: { id: MATCHUP_ID, teamAId: TEAM_A, teamBId: TEAM_B },
    }).ok,
    true
  );
});

test("H/I: Client CAS uses dreambreaker.version; engine ready after both orders", () => {
  const command = buildCaptainDreambreakerSubmitCommand({
    matchup: {
      id: MATCHUP_ID,
      teamAId: TEAM_A,
      teamBId: TEAM_B,
      version: 44,
      dreambreaker: { version: 7 },
    },
    teamId: TEAM_A,
    viewerTeamId: TEAM_A,
    order: ROSTER_A,
    rosterIds: ROSTER_A,
    tournamentVersion: 99,
    matchupVersion: 44,
  });
  assert.equal(command.payload.expectedVersion, 7);
  assert.notEqual(command.payload.expectedVersion, 99);
  assert.notEqual(command.payload.expectedVersion, 44);

  const teamData = {
    settings: { formatPreset: FORMAT_PRESET.MLP_4, dreambreakerEnabled: true },
    disciplines: [],
    teams: [
      { id: TEAM_A, name: "A", playerIds: ROSTER_A },
      { id: TEAM_B, name: "B", playerIds: ROSTER_B },
    ],
    matchups: [
      {
        id: MATCHUP_ID,
        teamAId: TEAM_A,
        teamBId: TEAM_B,
        dreambreaker: {
          status: DREAMBREAKER_STATUS.LINEUP_OPEN,
          version: 1,
          teamAOrder: [],
          teamBOrder: [],
        },
      },
    ],
  };
  const afterA = submitDreambreakerOrder(teamData, {
    matchupId: MATCHUP_ID,
    teamId: TEAM_A,
    order: ROSTER_A,
  });
  assert.equal(afterA.ok, true);
  const afterB = submitDreambreakerOrder(afterA.teamData, {
    matchupId: MATCHUP_ID,
    teamId: TEAM_B,
    order: ROSTER_B,
  });
  assert.equal(afterB.ok, true);
  assert.equal(afterB.dreambreaker.status, DREAMBREAKER_STATUS.READY);
});

test("J: Opponent order IDs absent from sanitized RPC response", () => {
  const leaked = sanitizeCaptainDreambreakerSubmitResponse({
    ok: true,
    status: "lineup_open",
    version: 2,
    teamAOrder: ROSTER_A,
    teamBOrder: ROSTER_B,
    ownOrder: ROSTER_A,
    opponentOrderSubmitted: false,
  });
  assert.equal(Object.hasOwn(leaked, "teamAOrder"), false);
  assert.equal(Object.hasOwn(leaked, "teamBOrder"), false);
  assert.deepEqual(leaked.ownOrder, ROSTER_A);
  assert.equal(leaked.opponentOrderSubmitted, false);
});

test("K: After one team submits, ownOrder visible and opponent IDs hidden", () => {
  const oneSide = sanitizeCaptainDreambreakerSubmitResponse({
    ok: true,
    status: "lineup_open",
    version: 2,
    canSubmitOwnOrder: false,
    ownOrder: ROSTER_A,
    opponentOrderSubmitted: false,
    teamAOrder: ROSTER_A,
    teamBOrder: ROSTER_B,
  });
  assert.deepEqual(oneSide.ownOrder, ROSTER_A);
  assert.equal(oneSide.opponentOrderSubmitted, false);
  assert.equal(oneSide.canSubmitOwnOrder, false);
  assert.equal(Object.hasOwn(oneSide, "teamAOrder"), false);
});

test("L: Both-team ready transition preserved in engine", () => {
  const teamData = {
    settings: { formatPreset: FORMAT_PRESET.MLP_4, dreambreakerEnabled: true },
    teams: [
      { id: TEAM_A, playerIds: ROSTER_A },
      { id: TEAM_B, playerIds: ROSTER_B },
    ],
    matchups: [
      {
        id: MATCHUP_ID,
        teamAId: TEAM_A,
        teamBId: TEAM_B,
        dreambreaker: { status: DREAMBREAKER_STATUS.LINEUP_OPEN, teamAOrder: [], teamBOrder: [] },
      },
    ],
  };
  const afterA = submitDreambreakerOrder(teamData, { matchupId: MATCHUP_ID, teamId: TEAM_A, order: ROSTER_A });
  const afterB = submitDreambreakerOrder(afterA.teamData, { matchupId: MATCHUP_ID, teamId: TEAM_B, order: ROSTER_B });
  assert.equal(afterB.dreambreaker.status, DREAMBREAKER_STATUS.READY);
});

test("M: Existing Captain lineup Save/Submit path unchanged", () => {
  const portal = readSrc("src/pages/tournament/TeamPortal.jsx");
  assert.match(portal, /method:\s*"saveDraftLineup"/);
  assert.match(portal, /method:\s*"submitLineup"/);
  assert.match(portal, /resolveLineupExpectedVersion/);
});

test("N: Identity V2 strip remains unchanged", () => {
  // Wave 2: strip lives in Club projection; Platform auth only invokes session projectors.
  const projection = readSrc("src/features/club/services/authSessionClubProjection.js");
  assert.match(projection, /stripLegacyProfileClubFields/);
  const authStorage = readSrc("src/auth/authStorage.js");
  assert.match(authStorage, /applyAuthSessionLoadProjectors/);
  assert.doesNotMatch(authStorage, /stripLegacyProfileClubFields|features\/club/);
  const stripSrc = readSrc("src/features/club/services/clubActiveMembershipService.js");
  assert.match(stripSrc, /clubId:\s*null/);
  const stripped = stripLegacyProfileClubFields({ clubId: "club-x", playerId: "p1" });
  assert.equal(stripped.clubId, null);
});

test("TeamPortal uses canonical runMutation submitDreambreakerOrder", () => {
  const portal = readSrc("src/pages/tournament/TeamPortal.jsx");
  assert.match(portal, /method:\s*"submitDreambreakerOrder"/);
  assert.match(portal, /buildCaptainDreambreakerSubmitCommand/);
  assert.match(portal, /expectedVersion:\s*command\.payload\.expectedVersion/);
  assert.match(portal, /idempotencyKey:\s*command\.payload\.idempotencyKey/);
  assert.doesNotMatch(portal, /guardClubAction/);
  assert.doesNotMatch(portal, /captainSubmitDreambreakerOrder\(/);

  const service = readSrc("src/features/team-tournament/services/teamTournamentService.js");
  const submitFn = service.slice(
    service.indexOf("export async function captainSubmitDreambreakerOrder"),
    service.indexOf("export async function refereeStartDreambreaker")
  );
  assert.doesNotMatch(submitFn, /guardCaptainLineupAction/);
  assert.doesNotMatch(submitFn, /guardClubAction/);
});

test("SQL package proves participant assertion and viewer-safe response", () => {
  const apply = readSrc(
    "docs/v5/migrations/team-tournament-dreambreaker-submit-auth-privacy-01/02_APPLY.sql"
  );
  assert.match(apply, /MATCHUP_PARTICIPANT_ASSERTION/);
  assert.match(apply, /DREAMBREAKER_CAS_BEFORE_WRITE/);
  assert.match(apply, /ownOrder/);
  assert.match(apply, /opponentOrderSubmitted/);
  assert.match(apply, /canSubmitOwnOrder/);
  assert.doesNotMatch(apply, /'teamAOrder'/);
  assert.doesNotMatch(apply, /'teamBOrder'/);
  assert.match(apply, /grant execute[^\n]+authenticated/i);
  assert.match(apply, /revoke all[^\n]+anon/i);

  const precheck = readSrc(
    "docs/v5/migrations/team-tournament-dreambreaker-submit-auth-privacy-01/01_PRECHECK.sql"
  );
  assert.match(precheck, /CURRENT_PARTICIPANT_TEAM_ASSERTION_MISSING/);
  assert.match(precheck, /CURRENT_RESPONSE_EXPOSES_BOTH_ORDERS/);
  assert.match(precheck, /No data mutation/);

  const verify = readSrc(
    "docs/v5/migrations/team-tournament-dreambreaker-submit-auth-privacy-01/03_VERIFY.sql"
  );
  assert.match(verify, /OPPONENT_ORDER_IDS_HIDDEN/);
  assert.match(verify, /STALE_VERSION_ZERO_WRITE/);
  assert.match(verify, /SUCCESS_VERSION_BUMP_ONCE/);
  assert.match(verify, /No Dreambreaker order mutation/);

  const rollback = readSrc(
    "docs/v5/migrations/team-tournament-dreambreaker-submit-auth-privacy-01/04_ROLLBACK.sql"
  );
  assert.match(rollback, /'teamAOrder'/);
  assert.doesNotMatch(rollback, /MATCHUP_PARTICIPANT_ASSERTION/);
});

test("RPC wrapper sanitizes submit response", () => {
  const rpc = readSrc("src/features/team-tournament/services/teamTournamentRpcService.js");
  assert.match(rpc, /sanitizeCaptainDreambreakerSubmitResponse/);
  assert.match(rpc, /rpcTeamTournamentSubmitDreambreakerOrder/);
  assert.match(rpc, /team_tournament_submit_dreambreaker_order/);
  assert.equal(TOURNAMENT_ID, "team-tournament-ikae8fpk");
});
