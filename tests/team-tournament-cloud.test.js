import test from "node:test";
import assert from "node:assert/strict";

import {
  __resetTeamTournamentStoreModeForTests,
  __setTeamTournamentStoreModeForTests,
  cloudCaptainSaveLineup,
  cloudCaptainSubmitLineup,
  cloudGetTeamTournamentSetup,
  cloudOrganizerPublishLineups,
  cloudRefereeConfirmSubMatch,
  cloudRefereeSaveSubMatchDraft,
  cloudSyncStandingsAfterMutation,
  tryCloudMutation,
} from "../src/features/team-tournament/services/teamTournamentCloudSync.js";
import { TEAM_TOURNAMENT_STORE_MODES } from "../src/features/team-tournament/repositories/teamTournamentRepository.js";
import {
  __resetTeamTournamentRpcClientForTests,
  __setTeamTournamentRpcClientForTests,
  isTeamTournamentRpcNotFoundError,
} from "../src/features/team-tournament/services/teamTournamentRpcService.js";
import { getVisibleLineup } from "../src/features/team-tournament/engines/lineupEngine.js";
import {
  initializeTeamTournamentData,
  addTeamToTournament,
  buildRoundRobinMatchups,
} from "../src/features/team-tournament/engines/teamTournamentEngine.js";
import { computeTeamStandings } from "../src/features/team-tournament/engines/teamStandingsEngine.js";
import { submitLineup, lockMatchupLineups, publishMatchupLineups } from "../src/features/team-tournament/engines/lineupEngine.js";
import { confirmSubMatchResult } from "../src/features/team-tournament/engines/teamRefereeEngine.js";
import { PERMISSIONS } from "../src/features/identity/constants/permissions.js";
import { assertTeamScope } from "../src/features/team-tournament/engines/teamPermissionEngine.js";
import { findTeam } from "../src/features/team-tournament/models/index.js";

const TOURNAMENT_ID = "tour-team-1";
const MATCHUP_ID = "matchup-1";

const players = [
  { id: "p1", name: "Nam A", gender: "Nam" },
  { id: "p2", name: "Nam B", gender: "Nam" },
  { id: "p3", name: "Nam C", gender: "Nam" },
  { id: "p4", name: "Nu A", gender: "Nữ" },
  { id: "p5", name: "Nu B", gender: "Nữ" },
  { id: "p6", name: "Nu C", gender: "Nữ" },
  { id: "p7", name: "Nam D", gender: "Nam" },
  { id: "p8", name: "Nu D", gender: "Nữ" },
  { id: "p9", name: "Nam E", gender: "Nam" },
  { id: "p10", name: "Nu E", gender: "Nữ" },
];

let rpcHandlers = {};

function createMockSupabase() {
  return {
    rpc: async (name, args) => {
      const handler = rpcHandlers[name];
      if (handler) {
        return handler(args);
      }
      return { data: null, error: { code: "PGRST202", message: "function not found" } };
    },
  };
}

test.beforeEach(() => {
  rpcHandlers = {};
  __setTeamTournamentStoreModeForTests(TEAM_TOURNAMENT_STORE_MODES.SUPABASE);
  __setTeamTournamentRpcClientForTests(createMockSupabase());
});

test.afterEach(() => {
  __resetTeamTournamentStoreModeForTests();
  __resetTeamTournamentRpcClientForTests();
});

function buildTeamData() {
  let teamData = initializeTeamTournamentData();
  teamData = addTeamToTournament(teamData, {
    id: "team-a",
    name: "Team A",
    playerIds: ["p1", "p2", "p4", "p5", "p7", "p8", "p9", "p10"],
    captainPlayerId: "p1",
  });
  teamData = addTeamToTournament(teamData, {
    id: "team-b",
    name: "Team B",
    playerIds: ["p3", "p6", "p2", "p4", "p7", "p8", "p9", "p10"],
    captainPlayerId: "p3",
  });
  teamData = buildRoundRobinMatchups(teamData, {
    lineupLockAt: "2099-01-01T08:30:00.000Z",
  });
  return teamData;
}

function lineupSelectionsForTeam(teamData, teamId) {
  const team = findTeam(teamData, teamId);
  const [menDouble, womenDouble, mixed1, mixed2] = teamData.disciplines;
  const males = team.playerIds.filter((id) => {
    const player = players.find((item) => item.id === id);
    return player && player.gender === "Nam";
  });
  const females = team.playerIds.filter((id) => {
    const player = players.find((item) => item.id === id);
    return player && player.gender === "Nữ";
  });

  return {
    [menDouble.id]: [males[0], males[1]],
    [womenDouble.id]: [females[0], females[1]],
    [mixed1.id]: [males[2], females[2]],
    [mixed2.id]: [males[3], females[3]],
  };
}

test("RPC not found — fallback an toàn về blob", async () => {
  const result = await tryCloudMutation(async () => ({
    ok: false,
    code: "RPC_NOT_DEPLOYED",
    error: "function not found",
  }));

  assert.equal(result.ok, true);
  assert.equal(result.usedCloud, false);
  assert.equal(result.fallback, "blob");
});

test("cross-tenant — RPC trả FORBIDDEN", async () => {
  rpcHandlers.team_tournament_save_lineup_draft = () => ({
    data: { ok: false, code: "FORBIDDEN", error: "access_denied: cross-tenant" },
    error: null,
  });

  const result = await cloudCaptainSaveLineup(TOURNAMENT_ID, {
    matchupId: MATCHUP_ID,
    teamId: "team-a",
    selections: {},
  });

  assert.equal(result.ok, false);
  assert.equal(result.code, "FORBIDDEN");
  assert.equal(result.usedCloud, true);
});

test("đội trưởng chỉ sửa đội mình — assertTeamScope chặn đội khác", () => {
  const teamData = buildTeamData();
  const captainPerms = [PERMISSIONS.TEAM_LINEUP_SUBMIT];

  const ownScope = assertTeamScope(teamData, "team-a", "p1", captainPerms);
  assert.equal(ownScope.ok, true);

  const otherScope = assertTeamScope(teamData, "team-b", "p1", captainPerms);
  assert.equal(otherScope.ok, false);
});

test("captain cloud submit lineup — RPC thành công", async () => {
  rpcHandlers.team_tournament_submit_lineup = (args) => {
    assert.equal(args.p_team_id, "team-a");
    return { data: { ok: true }, error: null };
  };

  const result = await cloudCaptainSubmitLineup(TOURNAMENT_ID, {
    matchupId: MATCHUP_ID,
    teamId: "team-a",
    selections: { disc1: ["p1"] },
  });

  assert.equal(result.ok, true);
  assert.equal(result.usedCloud, true);
});

test("không xem lineup đối thủ trước công bố — getVisibleLineup", () => {
  let teamData = buildTeamData();
  const matchup = teamData.matchups[0];

  const submitA = submitLineup(teamData, {
    matchupId: matchup.id,
    teamId: matchup.teamAId,
    selections: lineupSelectionsForTeam(teamData, matchup.teamAId),
    players,
  });
  assert.equal(submitA.ok, true, submitA.error);
  teamData = submitA.teamData;

  const submitB = submitLineup(teamData, {
    matchupId: matchup.id,
    teamId: matchup.teamBId,
    selections: lineupSelectionsForTeam(teamData, matchup.teamBId),
    players,
  });
  assert.equal(submitB.ok, true, submitB.error);
  teamData = submitB.teamData;

  const beforePublish = getVisibleLineup(teamData, {
    matchupId: matchup.id,
    viewerTeamId: matchup.teamAId,
    isOrganizer: false,
  });

  assert.ok(beforePublish.ownLineup);
  assert.equal(beforePublish.opponentLineup, null);

  const locked = lockMatchupLineups(teamData, { matchupId: matchup.id });
  const published = publishMatchupLineups(locked.teamData, { matchupId: matchup.id });

  const afterPublish = getVisibleLineup(published.teamData, {
    matchupId: matchup.id,
    viewerTeamId: matchup.teamAId,
    isOrganizer: false,
  });

  assert.ok(afterPublish.opponentLineup);
});

test("cloud get setup — ẩn lineup đối thủ khi RPC trả selections null", async () => {
  rpcHandlers.team_tournament_get_setup = () => ({
    data: {
      ok: true,
      tournament: {
        id: TOURNAMENT_ID,
        clubId: "club-1",
        tenantId: "venue-a",
        name: "Giải test",
        status: "active",
        settings: {},
        teamData: {
          disciplines: [],
          teams: [],
          matchups: [{ id: MATCHUP_ID, teamAId: "team-a", teamBId: "team-b", status: "locked" }],
          lineups: {
            [`${MATCHUP_ID}::team-a`]: {
              matchupId: MATCHUP_ID,
              teamId: "team-a",
              status: "submitted",
              selections: { disc1: ["p1"] },
            },
            [`${MATCHUP_ID}::team-b`]: {
              matchupId: MATCHUP_ID,
              teamId: "team-b",
              status: "submitted",
              selections: null,
            },
          },
          standings: [],
          settings: {},
        },
      },
    },
    error: null,
  });

  const result = await cloudGetTeamTournamentSetup(TOURNAMENT_ID, "team-a");
  assert.equal(result.ok, true);

  const opponentLineup = result.tournament.teamData.lineups[`${MATCHUP_ID}::team-b`];
  const hidden =
    opponentLineup.selections === null ||
    Object.keys(opponentLineup.selections || {}).length === 0;
  assert.equal(hidden, true);
});

test("trọng tài nhập KQ sau công bố — RPC publish required", async () => {
  rpcHandlers.team_tournament_save_sub_match_draft = () => ({
    data: { ok: false, code: "VALIDATION", error: "Matchup chưa công bố." },
    error: null,
  });

  const blocked = await cloudRefereeSaveSubMatchDraft(TOURNAMENT_ID, {
    matchupId: MATCHUP_ID,
    subMatchId: "sub-1",
    score: { teamA: 11, teamB: 5 },
  });
  assert.equal(blocked.ok, false);
  assert.equal(blocked.code, "VALIDATION");

  rpcHandlers.team_tournament_save_sub_match_draft = () => ({
    data: { ok: true },
    error: null,
  });

  const allowed = await cloudRefereeSaveSubMatchDraft(TOURNAMENT_ID, {
    matchupId: MATCHUP_ID,
    subMatchId: "sub-1",
    score: { teamA: 11, teamB: 5 },
  });
  assert.equal(allowed.ok, true);
  assert.equal(allowed.usedCloud, true);
});

test("BXH cập nhật sau confirm result — engine + cloud upsert", async () => {
  let teamData = buildTeamData();
  const matchup = teamData.matchups[0];

  let working = submitLineup(teamData, {
    matchupId: matchup.id,
    teamId: matchup.teamAId,
    selections: lineupSelectionsForTeam(teamData, matchup.teamAId),
    players,
  }).teamData;

  working = submitLineup(working, {
    matchupId: matchup.id,
    teamId: matchup.teamBId,
    selections: lineupSelectionsForTeam(working, matchup.teamBId),
    players,
  }).teamData;

  working = lockMatchupLineups(working, { matchupId: matchup.id }).teamData;
  working = publishMatchupLineups(working, { matchupId: matchup.id }).teamData;

  const publishedMatchup = working.matchups.find((item) => item.id === matchup.id);
  const subMatch = publishedMatchup.subMatches[0];

  const confirmed = confirmSubMatchResult(working, {
    matchupId: matchup.id,
    subMatchId: subMatch.id,
    score: { teamA: 11, teamB: 3 },
    permissions: [PERMISSIONS.TEAM_MATCH_RESULT_MANAGE],
  });

  assert.equal(confirmed.ok, true, confirmed.error || "confirm failed");

  const withStandings = computeTeamStandings(confirmed.teamData);
  const standings = withStandings.standings || [];
  assert.ok(standings.length >= 2);

  let upsertPayload = null;
  rpcHandlers.team_tournament_upsert_standings = (args) => {
    upsertPayload = args.p_standings;
    return { data: { ok: true }, error: null };
  };

  const sync = await cloudSyncStandingsAfterMutation({
    id: TOURNAMENT_ID,
    teamData: withStandings,
  });

  assert.equal(sync.ok, true);
  assert.ok(Array.isArray(upsertPayload));
  assert.ok(upsertPayload.length >= 2);
});

test("publish matchup cloud — thành công", async () => {
  rpcHandlers.team_tournament_publish_matchup = (args) => {
    assert.equal(args.p_matchup_id, MATCHUP_ID);
    return { data: { ok: true, publishedAt: "2026-07-05T10:00:00.000Z" }, error: null };
  };

  const result = await cloudOrganizerPublishLineups(TOURNAMENT_ID, {
    matchupId: MATCHUP_ID,
  });

  assert.equal(result.ok, true);
  assert.equal(result.usedCloud, true);
});

test("confirm sub-match cloud — thành công", async () => {
  rpcHandlers.team_tournament_confirm_sub_match = () => ({
    data: {
      ok: true,
      matchupResult: { teamAWins: 1, teamBWins: 0, winnerTeamId: "team-a" },
    },
    error: null,
  });

  const result = await cloudRefereeConfirmSubMatch(TOURNAMENT_ID, {
    matchupId: MATCHUP_ID,
    subMatchId: "sub-1",
    score: { teamA: 11, teamB: 7 },
    winnerTeamId: "team-a",
  });

  assert.equal(result.ok, true);
  assert.equal(result.usedCloud, true);
});

test("isTeamTournamentRpcNotFoundError nhận diện PGRST202", () => {
  assert.equal(isTeamTournamentRpcNotFoundError({ code: "PGRST202" }), true);
  assert.equal(
    isTeamTournamentRpcNotFoundError({ message: "function does not exist" }),
    true
  );
  assert.equal(isTeamTournamentRpcNotFoundError({ message: "access denied" }), false);
});
