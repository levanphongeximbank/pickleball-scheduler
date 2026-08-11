import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

import {
  DREAMBREAKER_STATUS,
  FORMAT_PRESET,
  SUB_MATCH_STATUS,
} from "../src/features/team-tournament/constants.js";
import {
  buildCaptainDreambreakerSubmitCommand,
  CAPTAIN_DREAMBREAKER_ORDER_SIZE,
  isPersistedCaptainDreambreakerActive,
  listExposedDreambreakerAthleteIds,
  projectCaptainPortalMatchupDreambreaker,
  resolveDreambreakerExpectedVersion,
  validateCaptainDreambreakerOrder,
} from "../src/features/team-tournament/engines/captainDreambreakerPortalContract.js";
import { listDreambreakerMatchups, submitDreambreakerOrder } from "../src/features/team-tournament/engines/dreambreakerEngine.js";
import { computeMatchupTieProgress } from "../src/features/team-tournament/engines/matchupTieEngine.js";
import { mapCaptainPortalResponse } from "../src/features/team-tournament/repositories/mapCaptainPortalResponse.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

function readSrc(rel) {
  return readFileSync(join(root, rel), "utf8");
}

const TEAM_A = "team-m3528fhd";
const TEAM_B = "team-qifwxe4o";
const MATCHUP_ID = "matchup-1o9rud3t";
const ROSTER_A = ["a1", "a2", "a3", "a4"];
const ROSTER_B = ["b1", "b2", "b3", "b4"];

function completedSubs(winsA = 2) {
  return [
    { id: "s1", disciplineId: "d1", status: SUB_MATCH_STATUS.COMPLETED, winnerTeamId: TEAM_A },
    { id: "s2", disciplineId: "d2", status: SUB_MATCH_STATUS.COMPLETED, winnerTeamId: TEAM_A },
    { id: "s3", disciplineId: "d3", status: SUB_MATCH_STATUS.COMPLETED, winnerTeamId: winsA === 3 ? TEAM_A : TEAM_B },
    { id: "s4", disciplineId: "d4", status: SUB_MATCH_STATUS.COMPLETED, winnerTeamId: TEAM_B },
  ];
}

function basePortalPayload({
  winsA = 2,
  dreambreaker = {
    required: true,
    status: DREAMBREAKER_STATUS.LINEUP_OPEN,
    version: 7,
    canSubmitOwnOrder: true,
    ownOrder: [],
    opponentOrderSubmitted: false,
  },
  includeActivationRule = false,
} = {}) {
  return {
    ok: true,
    schemaVersion: 7,
    viewerTeamId: TEAM_A,
    captainAccessEnabled: true,
    viewer: { viewerTeamId: TEAM_A, captain: true, deputy: false },
    tournament: {
      id: "team-tournament-ikae8fpk",
      clubId: "club-1",
      tenantId: "venue-staging-a",
      name: "Giải đồng đội",
      status: "in_progress",
      version: 99,
      settings: {
        captainAccessEnabled: true,
        formatPreset: FORMAT_PRESET.MLP_4,
        dreambreakerEnabled: true,
      },
      myTeam: {
        id: TEAM_A,
        name: "Đội 2",
        captainPlayerId: "cap-a",
        deputyPlayerIds: [],
        playerIds: ROSTER_A,
        rosterAthletes: ROSTER_A.map((id) => ({ athleteId: id, displayName: id, gender: "male" })),
      },
      opponentTeams: [{ id: TEAM_B, name: "Đội 4" }],
      teams: [{ id: TEAM_A, name: "Đội 2", playerIds: ROSTER_A }],
      disciplines: [
        { id: "d1", name: "doi nam", ...(includeActivationRule ? { activationRule: "always" } : {}) },
        { id: "d2", name: "doi nu", ...(includeActivationRule ? { activationRule: "always" } : {}) },
        { id: "d3", name: "doi nam nu", ...(includeActivationRule ? { activationRule: "always" } : {}) },
        { id: "d4", name: "doi nam nu", ...(includeActivationRule ? { activationRule: "always" } : {}) },
      ],
      matchups: [
        {
          id: MATCHUP_ID,
          teamAId: TEAM_A,
          teamBId: TEAM_B,
          status: "in_progress",
          version: 44,
          dreambreaker,
          subMatches: completedSubs(winsA),
        },
      ],
      lineups: {},
    },
  };
}

function mappedTeamData(payload = basePortalPayload()) {
  const mapped = mapCaptainPortalResponse(payload);
  assert.equal(mapped.ok, true);
  return mapped.tournament.teamData;
}

test("A: Non-2-2 matchup does not list captain Dreambreaker panel", () => {
  const teamData = mappedTeamData(
    basePortalPayload({
      winsA: 3,
      dreambreaker: {
        required: false,
        status: null,
        version: null,
        canSubmitOwnOrder: false,
        ownOrder: [],
        opponentOrderSubmitted: false,
      },
    })
  );
  assert.equal(listDreambreakerMatchups(teamData, { teamId: TEAM_A }).length, 0);
});

test("B: Persisted lineup_open Dreambreaker shows panel even without activationRule", () => {
  const teamData = mappedTeamData(basePortalPayload({ includeActivationRule: false }));
  const listed = listDreambreakerMatchups(teamData, { teamId: TEAM_A });
  assert.equal(listed.length, 1);
  assert.equal(listed[0].id, MATCHUP_ID);
  assert.equal(listed[0].dreambreaker.status, DREAMBREAKER_STATUS.LINEUP_OPEN);
  assert.equal(listed[0].dreambreaker.required, true);
  assert.equal(isPersistedCaptainDreambreakerActive(listed[0].dreambreaker), true);
});

test("C: Captain order selection is own roster only", () => {
  const teamData = mappedTeamData();
  const own = teamData.teams.find((team) => team.id === TEAM_A);
  const opponent = teamData.teams.find((team) => team.id === TEAM_B);
  assert.deepEqual(own.playerIds, ROSTER_A);
  assert.deepEqual(opponent.playerIds, []);
  const panelSrc = readSrc("src/components/tournament/team/DreambreakerPanel.jsx");
  assert.match(panelSrc, /team\.playerIds\.map/);
  assert.doesNotMatch(panelSrc, /opponent.*playerIds\.map/);
});

test("D: Exactly four unique athletes required", () => {
  const tooFew = validateCaptainDreambreakerOrder({
    order: ["a1", "a2", "a3"],
    rosterIds: ROSTER_A,
    viewerTeamId: TEAM_A,
    submitTeamId: TEAM_A,
  });
  assert.equal(tooFew.ok, false);
  assert.equal(CAPTAIN_DREAMBREAKER_ORDER_SIZE, 4);

  const ok = validateCaptainDreambreakerOrder({
    order: ROSTER_A,
    rosterIds: ROSTER_A,
    viewerTeamId: TEAM_A,
    submitTeamId: TEAM_A,
  });
  assert.equal(ok.ok, true);
});

test("E: Duplicate athlete rejected", () => {
  const result = validateCaptainDreambreakerOrder({
    order: ["a1", "a2", "a3", "a1"],
    rosterIds: ROSTER_A,
    viewerTeamId: TEAM_A,
    submitTeamId: TEAM_A,
  });
  assert.equal(result.ok, false);
});

test("F: Cross-team athlete rejected", () => {
  const result = validateCaptainDreambreakerOrder({
    order: ["a1", "a2", "a3", "b1"],
    rosterIds: ROSTER_A,
    viewerTeamId: TEAM_A,
    submitTeamId: TEAM_A,
  });
  assert.equal(result.ok, false);
});

test("G: Captain cannot submit opponent team order", () => {
  const result = buildCaptainDreambreakerSubmitCommand({
    matchup: { id: MATCHUP_ID, teamAId: TEAM_A, teamBId: TEAM_B, dreambreaker: { version: 1 } },
    teamId: TEAM_B,
    viewerTeamId: TEAM_A,
    order: ROSTER_B,
    rosterIds: ROSTER_B,
  });
  assert.equal(result.ok, false);

  const portalSrc = readSrc("src/pages/tournament/TeamPortal.jsx");
  assert.match(portalSrc, /buildCaptainDreambreakerSubmitCommand/);
  assert.match(portalSrc, /teamId:\s*access\.captainTeam\.id/);
});

test("H: ownOrder restores after reload mapping", () => {
  const teamData = mappedTeamData(
    basePortalPayload({
      dreambreaker: {
        required: true,
        status: DREAMBREAKER_STATUS.LINEUP_OPEN,
        version: 2,
        canSubmitOwnOrder: false,
        ownOrder: ROSTER_A,
        opponentOrderSubmitted: false,
      },
    })
  );
  const matchup = teamData.matchups[0];
  assert.deepEqual(matchup.dreambreaker.ownOrder, ROSTER_A);
  assert.deepEqual(matchup.dreambreaker.teamAOrder, ROSTER_A);
});

test("I: opponentOrderSubmitted boolean works", () => {
  const hidden = mappedTeamData(
    basePortalPayload({
      dreambreaker: {
        required: true,
        status: DREAMBREAKER_STATUS.LINEUP_OPEN,
        version: 2,
        canSubmitOwnOrder: true,
        ownOrder: [],
        opponentOrderSubmitted: true,
      },
    })
  );
  assert.equal(hidden.matchups[0].dreambreaker.opponentOrderSubmitted, true);

  const notYet = mappedTeamData();
  assert.equal(notYet.matchups[0].dreambreaker.opponentOrderSubmitted, false);
});

test("J: opponent athlete IDs hidden even if raw payload leaks both orders", () => {
  const leaked = projectCaptainPortalMatchupDreambreaker(
    {
      id: MATCHUP_ID,
      teamAId: TEAM_A,
      teamBId: TEAM_B,
      dreambreaker: {
        required: true,
        status: DREAMBREAKER_STATUS.LINEUP_OPEN,
        version: 1,
        ownOrder: ROSTER_A,
        teamAOrder: ROSTER_A,
        teamBOrder: ROSTER_B,
        opponentOrderSubmitted: true,
      },
    },
    TEAM_A
  );
  assert.deepEqual(leaked.dreambreaker.ownOrder, ROSTER_A);
  assert.deepEqual(leaked.dreambreaker.teamAOrder, ROSTER_A);
  assert.deepEqual(leaked.dreambreaker.teamBOrder, []);
  assert.deepEqual(listExposedDreambreakerAthleteIds(leaked.dreambreaker, TEAM_A, leaked), []);
});

test("K: expectedVersion uses dreambreaker.version", () => {
  const matchup = {
    id: MATCHUP_ID,
    teamAId: TEAM_A,
    teamBId: TEAM_B,
    version: 44,
    dreambreaker: { version: 7, status: DREAMBREAKER_STATUS.LINEUP_OPEN },
  };
  assert.equal(resolveDreambreakerExpectedVersion(matchup), 7);
  const command = buildCaptainDreambreakerSubmitCommand({
    matchup,
    teamId: TEAM_A,
    viewerTeamId: TEAM_A,
    order: ROSTER_A,
    rosterIds: ROSTER_A,
    tournamentVersion: 99,
    matchupVersion: 44,
  });
  assert.equal(command.ok, true);
  assert.equal(command.payload.expectedVersion, 7);
  assert.match(command.payload.idempotencyKey, /^db-order:/);
});

test("L: No tournament.version coupling", () => {
  const portalSrc = readSrc("src/pages/tournament/TeamPortal.jsx");
  assert.match(portalSrc, /buildCaptainDreambreakerSubmitCommand/);
  assert.doesNotMatch(portalSrc, /expectedVersion:\s*tournament\.version/);
  assert.doesNotMatch(portalSrc, /expectedVersion:\s*tournamentVersion/);

  const command = buildCaptainDreambreakerSubmitCommand({
    matchup: {
      id: MATCHUP_ID,
      teamAId: TEAM_A,
      teamBId: TEAM_B,
      dreambreaker: { version: 3 },
    },
    teamId: TEAM_A,
    viewerTeamId: TEAM_A,
    order: ROSTER_A,
    rosterIds: ROSTER_A,
    tournamentVersion: 99,
  });
  assert.equal(command.payload.expectedVersion, 3);
  assert.notEqual(command.payload.expectedVersion, 99);
});

test("M: No matchup.version coupling", () => {
  const command = buildCaptainDreambreakerSubmitCommand({
    matchup: {
      id: MATCHUP_ID,
      teamAId: TEAM_A,
      teamBId: TEAM_B,
      version: 44,
      dreambreaker: { version: 3 },
    },
    teamId: TEAM_A,
    viewerTeamId: TEAM_A,
    order: ROSTER_A,
    rosterIds: ROSTER_A,
    matchupVersion: 44,
  });
  assert.equal(command.payload.expectedVersion, 3);
  assert.notEqual(command.payload.expectedVersion, 44);
});

test("N: Both teams 4/4 become ready; referee path recognizes ready", () => {
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

  const refereeSrc = readSrc("src/components/tournament/team/DreambreakerPanel.jsx");
  assert.match(refereeSrc, /DREAMBREAKER_STATUS\.READY/);
  assert.match(refereeSrc, /Bắt đầu Dreambreaker/);
});

test("SQL package exists with viewer-safe contract and no apply", () => {
  const apply = readSrc(
    "docs/v5/migrations/team-tournament-captain-dreambreaker-reader-01/02_APPLY.sql"
  );
  assert.match(apply, /team_tournament_get_captain_portal/);
  assert.match(apply, /team_tournament_dreambreaker_states/);
  assert.match(apply, /ownOrder/);
  assert.match(apply, /opponentOrderSubmitted/);
  assert.match(apply, /canSubmitOwnOrder/);
  assert.match(apply, /dreambreakerEnabled/);
  assert.match(apply, /activationRule/);
  assert.doesNotMatch(apply, /'teamAOrder'/);
  assert.doesNotMatch(apply, /'teamBOrder'/);
  assert.match(apply, /security definer/i);
  assert.match(apply, /grant execute[^\n]+authenticated/i);

  const precheck = readSrc(
    "docs/v5/migrations/team-tournament-captain-dreambreaker-reader-01/01_PRECHECK.sql"
  );
  assert.match(precheck, /CURRENT_CAPTAIN_READER_RETURNS_DREAMBREAKER/);
  assert.match(precheck, /No data mutation/);

  const verify = readSrc(
    "docs/v5/migrations/team-tournament-captain-dreambreaker-reader-01/03_VERIFY.sql"
  );
  assert.match(verify, /OPPONENT_ORDER_IDS_HIDDEN/);
  assert.match(verify, /No Dreambreaker order mutation/);
});

test("mapCaptainPortalResponse maps matchup.dreambreaker and preserves subMatches", () => {
  const teamData = mappedTeamData();
  const matchup = teamData.matchups[0];
  assert.equal(matchup.dreambreaker.version, 7);
  assert.equal(matchup.dreambreaker.canSubmitOwnOrder, true);
  assert.equal(matchup.subMatches.length, 4);
  assert.equal(teamData.settings.dreambreakerEnabled, true);
  assert.equal(teamData.settings.formatPreset, FORMAT_PRESET.MLP_4);
});

test("missing activationRule does not suppress persisted active Dreambreaker", () => {
  const teamData = {
    settings: { formatPreset: FORMAT_PRESET.MLP_4 },
    disciplines: [{ id: "d1" }, { id: "d2" }, { id: "d3" }, { id: "d4" }],
    matchups: [
      {
        id: MATCHUP_ID,
        teamAId: TEAM_A,
        teamBId: TEAM_B,
        dreambreaker: {
          required: true,
          status: DREAMBREAKER_STATUS.LINEUP_OPEN,
          version: 1,
        },
        subMatches: completedSubs(2),
      },
    ],
  };
  assert.equal(listDreambreakerMatchups(teamData, { teamId: TEAM_A }).length, 1);
});

test("fallback B: missing activationRule still derives 2-2 needsDreambreaker", () => {
  const matchup = {
    id: MATCHUP_ID,
    teamAId: TEAM_A,
    teamBId: TEAM_B,
    subMatches: completedSubs(2),
  };
  const teamData = {
    settings: { formatPreset: FORMAT_PRESET.MLP_4, dreambreakerEnabled: true },
    disciplines: [{ id: "d1" }, { id: "d2" }, { id: "d3" }, { id: "d4" }],
    matchups: [matchup],
  };
  const progress = computeMatchupTieProgress(teamData, matchup);
  assert.equal(progress.needsDreambreaker, true);
  assert.equal(listDreambreakerMatchups(teamData, { teamId: TEAM_A }).length, 1);
});
