import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { TOURNAMENT_MODE, TOURNAMENT_STATUS } from "../src/models/tournament/constants.js";
import {
  STAGE_TIE_BREAK_POLICY,
  DREAMBREAKER_STATUS,
  LINEUP_STATUS,
} from "../src/features/team-tournament/constants.js";
import {
  classifyTeamTournamentStorageAuthority,
  persistCanonicalTeamTournamentCreate,
  ensureCanonicalTeamTournamentListing,
} from "../src/features/team-tournament/lifecycle/ensureCanonicalTeamTournament.js";
import {
  canViewTournamentDashboard as canViewDashboard,
  isAthleteVisibleStatus as isVisibleStatus,
  isDraftTournament as isDraft,
  isRegistrationFoundationReady as isRegReady,
  resolveOrganizerPrimaryAction as organizerAction,
  ATHLETE_VISIBLE_STATUSES as VISIBLE,
} from "../src/features/team-tournament/lifecycle/teamTournamentLifecycle.js";
import { buildTeamTournamentDashboardView } from "../src/features/team-tournament/dashboard/teamTournamentDashboardModel.js";
import { loadTeamTournamentDashboardSource } from "../src/features/team-tournament/dashboard/loadTeamTournamentDashboard.js";
import { buildCaptainDashboardTasks } from "../src/features/team-tournament/dashboard/teamTournamentDashboardTasks.js";
import { assertNoPrivateCaptainLeak } from "../src/features/team-tournament/dashboard/teamTournamentDashboardPrivacy.js";
import {
  teamTournamentDashboardPath,
  resolveTeamTournamentOpenPath,
} from "../src/config/tournamentRoutes.js";
import { tournamentMatchesMine } from "../src/features/tournament/mappers/canonicalTournamentMapper.js";
import { TOTAL_POINTS_SECONDARY_TIE_CONTRACT } from "../src/features/team-tournament/engines/teamStageTieBreakPolicy.js";
import { createTeamTournamentShell } from "../src/features/team-tournament/engines/teamTournamentEngine.js";

const here = dirname(fileURLToPath(import.meta.url));
const pkg = join(
  here,
  "../docs/v5/migrations/team-tournament-canonical-dashboard-lifecycle-01"
);

function readSql(name) {
  return readFileSync(join(pkg, name), "utf8");
}

function sampleTournament(overrides = {}) {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    clubId: "club-a",
    tenantId: "venue-a",
    name: "Giải nháp",
    mode: TOURNAMENT_MODE.TEAM_TOURNAMENT,
    status: TOURNAMENT_STATUS.DRAFT,
    createdBy: "player-org",
    settings: {
      stageTieBreakPolicy: {
        group: STAGE_TIE_BREAK_POLICY.TOTAL_SUBMATCH_POINTS,
        round_of_16: STAGE_TIE_BREAK_POLICY.DREAMBREAKER,
        quarterfinal: STAGE_TIE_BREAK_POLICY.TOTAL_SUBMATCH_POINTS,
        semifinal: STAGE_TIE_BREAK_POLICY.DREAMBREAKER,
        final: STAGE_TIE_BREAK_POLICY.DREAMBREAKER,
      },
    },
    ...overrides,
  };
}

function sampleTeamData(overrides = {}) {
  return {
    settings: sampleTournament().settings,
    teams: [
      {
        id: "team-a",
        name: "Alpha",
        captainPlayerId: "player-cap",
        deputyPlayerIds: [],
        members: [
          { playerId: "player-cap", name: "Cap" },
          { playerId: "player-p1", name: "P1" },
        ],
      },
      {
        id: "team-b",
        name: "Beta",
        captainPlayerId: "player-cap-b",
        members: [{ playerId: "player-p2", name: "P2" }],
      },
    ],
    standings: [
      { teamId: "team-a", rank: 1, wins: 1, losses: 0, played: 1 },
      { teamId: "team-b", rank: 2, wins: 0, losses: 1, played: 1 },
    ],
    matchups: [
      {
        id: "mu-nontied",
        teamAId: "team-a",
        teamBId: "team-b",
        status: "completed",
        stage: "group",
        result: {
          teamAWins: 3,
          teamBWins: 1,
          teamAPoints: 38,
          teamBPoints: 26,
          winnerTeamId: "team-a",
          needsDreambreaker: false,
        },
      },
      {
        id: "mu-unequal",
        teamAId: "team-a",
        teamBId: "team-b",
        status: "completed",
        stage: "group",
        result: {
          teamAWins: 2,
          teamBWins: 2,
          teamAPoints: 36,
          teamBPoints: 33,
          winnerTeamId: "team-a",
          tieBreakPolicy: STAGE_TIE_BREAK_POLICY.TOTAL_SUBMATCH_POINTS,
          tieBreakStatus: "points",
          needsDreambreaker: false,
        },
      },
      {
        id: "mu-equal",
        teamAId: "team-a",
        teamBId: "team-b",
        status: "in_progress",
        stage: "group",
        lineups: { "team-a": { status: LINEUP_STATUS.DRAFT } },
        result: {
          teamAWins: 2,
          teamBWins: 2,
          teamAPoints: 36,
          teamBPoints: 36,
          needsDreambreaker: true,
          tieBreakStatus: "dreambreaker_fallback",
        },
        dreambreaker: { status: DREAMBREAKER_STATUS.LINEUP_OPEN },
      },
    ],
    ...overrides,
  };
}

test("lifecycle: draft is saved status and not athlete-visible", () => {
  assert.equal(isDraft({ status: "draft" }), true);
  assert.equal(isVisibleStatus("draft"), false);
  assert.deepEqual(VISIBLE, [
    TOURNAMENT_STATUS.REGISTRATION,
    TOURNAMENT_STATUS.READY,
    TOURNAMENT_STATUS.ACTIVE,
    TOURNAMENT_STATUS.COMPLETED,
  ]);
  assert.equal(isRegReady({ status: "draft" }), true);
  assert.equal(isRegReady({ status: "ready" }), false);
});

test("visibility: organizer sees draft; ordinary athlete does not", () => {
  const tournament = sampleTournament();
  assert.equal(
    canViewDashboard({
      tournament,
      isAuthenticated: true,
      canOrganize: true,
      sameTenant: true,
    }).ok,
    true
  );
  assert.equal(
    canViewDashboard({
      tournament,
      isAuthenticated: true,
      canOrganize: false,
      sameTenant: true,
    }).code,
    "DRAFT_NOT_VISIBLE"
  );
});

test("visibility: draft captain/deputy/referee operational role may view", () => {
  const tournament = sampleTournament({ status: TOURNAMENT_STATUS.DRAFT });
  assert.equal(
    canViewDashboard({
      tournament,
      isAuthenticated: true,
      canOrganize: false,
      sameTenant: true,
      hasDraftOperationalRole: true,
    }).reason,
    "draft_operational_role"
  );
  assert.equal(
    canViewDashboard({
      tournament,
      isAuthenticated: true,
      canOrganize: false,
      sameTenant: true,
      hasDraftOperationalRole: false,
    }).code,
    "DRAFT_NOT_VISIBLE"
  );
});

test("visibility: authenticated non-participant can view visible tournament", () => {
  const tournament = sampleTournament({ status: TOURNAMENT_STATUS.ACTIVE });
  const result = canViewDashboard({
    tournament,
    isAuthenticated: true,
    canOrganize: false,
    sameTenant: true,
  });
  assert.equal(result.ok, true);
  assert.equal(result.reason, "athlete_visible");
});

test("visibility: cross-tenant denied", () => {
  const result = canViewDashboard({
    tournament: sampleTournament({ status: TOURNAMENT_STATUS.ACTIVE }),
    isAuthenticated: true,
    canOrganize: false,
    sameTenant: false,
  });
  assert.equal(result.code, "CROSS_TENANT_DENIED");
});

test("visibility: unauthenticated denied", () => {
  const result = canViewDashboard({
    tournament: sampleTournament({ status: TOURNAMENT_STATUS.ACTIVE }),
    isAuthenticated: false,
    sameTenant: true,
  });
  assert.equal(result.code, "NOT_AUTHENTICATED");
});

test("create: first persist returns stable canonical tournamentId", async () => {
  const created = await persistCanonicalTeamTournamentCreate(
    {
      clubId: "club-a",
      tenantId: "venue-a",
      name: "Giải canonical",
      createdBy: "player-org",
    },
    {
      createViaRpc: async () => ({
        ok: true,
        tournament: {
          id: "22222222-2222-4222-8222-222222222222",
          mode: TOURNAMENT_MODE.TEAM_TOURNAMENT,
          status: "draft",
        },
      }),
    }
  );
  assert.equal(created.ok, true);
  assert.equal(created.tournamentId, "22222222-2222-4222-8222-222222222222");
  assert.equal(created.tournament.id, created.tournamentId);
  assert.equal(created.canonical, true);
  assert.equal(created.tournament.status, "draft");
});

test("create: missing team_tournament_create RPC fails closed with no fallback writer", async () => {
  let createCanonicalCalls = 0;
  let ensureHeaderCalls = 0;
  const created = await persistCanonicalTeamTournamentCreate(
    {
      clubId: "club-a",
      tenantId: "venue-a",
      name: "Giải dual",
      createdBy: "player-org",
    },
    {
      createViaRpc: async () => ({ ok: false, code: "RPC_MISSING" }),
      createCanonical: async () => {
        createCanonicalCalls += 1;
        return { ok: true, tournament: { id: "should-not-run" } };
      },
      ensureHeader: async () => {
        ensureHeaderCalls += 1;
        return { ok: true };
      },
    }
  );
  assert.equal(created.ok, false);
  assert.equal(created.code, "RPC_MISSING");
  assert.equal(createCanonicalCalls, 0);
  assert.equal(ensureHeaderCalls, 0);
});

test("create: server failure does not start a client repair sequence", async () => {
  let ensureHeaderCalls = 0;
  const created = await persistCanonicalTeamTournamentCreate(
    {
      clubId: "club-a",
      tenantId: "venue-a",
      name: "Giải fail",
    },
    {
      createViaRpc: async () => ({ ok: false, code: "FORBIDDEN" }),
      ensureHeader: async () => {
        ensureHeaderCalls += 1;
        return { ok: true };
      },
    }
  );
  assert.equal(created.ok, false);
  assert.equal(created.code, "FORBIDDEN");
  assert.equal(ensureHeaderCalls, 0);
});

test("create: missing createViaRpc fails closed", async () => {
  const created = await persistCanonicalTeamTournamentCreate({
    clubId: "club-a",
    tenantId: "venue-a",
    name: "X",
  });
  assert.equal(created.ok, false);
  assert.equal(created.code, "RPC_MISSING");
});

test("create: missing tenant fails closed", async () => {
  const created = await persistCanonicalTeamTournamentCreate({
    clubId: "club-a",
    name: "X",
  });
  assert.equal(created.ok, false);
  assert.equal(created.code, "TENANT_MISSING");
});

test("ensure: missing RPC fails closed and does not call alternate writers", async () => {
  let createCalls = 0;
  const result = await ensureCanonicalTeamTournamentListing(
    { clubId: "club-a", tenantId: "venue-a", tournamentId: "tid-1" },
    {
      createCanonical: async () => {
        createCalls += 1;
        return { ok: true, tournament: { id: "new" } };
      },
    }
  );
  assert.equal(result.ok, false);
  assert.equal(result.code, "RPC_MISSING");
  assert.equal(createCalls, 0);
});

test("ensure: RPC already=true does not create a second row", async () => {
  let createCalls = 0;
  const result = await ensureCanonicalTeamTournamentListing(
    { clubId: "club-a", tenantId: "venue-a", tournamentId: "tid-1" },
    {
      ensureViaRpc: async () => ({
        ok: true,
        already: true,
        tournament: { id: "tid-1", status: "draft" },
      }),
      createCanonical: async () => {
        createCalls += 1;
        return { ok: true, tournament: { id: "new" } };
      },
    }
  );
  assert.equal(result.already, true);
  assert.equal(createCalls, 0);
});

test("dashboard: missing get_dashboard RPC fails closed with no get_setup compose", async () => {
  const loaded = await loadTeamTournamentDashboardSource({
    tournamentId: "tid-1",
    getDashboard: async () => ({ ok: false, code: "RPC_MISSING" }),
  });
  assert.equal(loaded.ok, false);
  assert.equal(loaded.code, "RPC_MISSING");
  assert.equal(loaded.view, undefined);
});

test("organizer actions follow lifecycle", () => {
  assert.equal(organizerAction({ status: "draft" }).id, "continue_setup");
  assert.equal(organizerAction({ status: "registration" }).id, "manage_registration");
  assert.equal(organizerAction({ status: "ready" }).id, "operate");
  assert.equal(organizerAction({ status: "active" }).id, "enter");
  assert.equal(organizerAction({ status: "completed" }).id, "view_results");
});

test("routes: draft opens setup; visible opens dashboard", () => {
  assert.equal(
    resolveTeamTournamentOpenPath({ id: "abc", status: "draft" }),
    "/tournament/team/abc?tab=teams"
  );
  assert.equal(
    resolveTeamTournamentOpenPath({ id: "abc", status: "active" }),
    "/tournaments/abc"
  );
  assert.equal(teamTournamentDashboardPath("abc"), "/tournaments/abc");
});

test("dashboard: draft captain sees myTeam + captain; ordinary draft member denied", () => {
  const captainView = buildTeamTournamentDashboardView({
    tournament: sampleTournament({ status: TOURNAMENT_STATUS.DRAFT }),
    teamData: sampleTeamData(),
    playerId: "player-cap",
    canOrganize: false,
    sameTenant: true,
    isAuthenticated: true,
  });
  assert.equal(captainView.ok, true);
  assert.equal(captainView.sections.viewer, true);
  assert.equal(captainView.sections.myTeam, true);
  assert.equal(captainView.sections.captain, true);
  assert.equal(captainView.sections.organizer, false);
  assert.ok(captainView.captain.href.includes("/team-portal/"));

  const ordinary = buildTeamTournamentDashboardView({
    tournament: sampleTournament({ status: TOURNAMENT_STATUS.DRAFT }),
    teamData: sampleTeamData(),
    playerId: "player-p1",
    canOrganize: false,
    sameTenant: true,
    isAuthenticated: true,
  });
  assert.equal(ordinary.ok, false);
  assert.equal(ordinary.code, "DRAFT_NOT_VISIBLE");
});

test("dashboard: draft referee assignment opens referee section without organizer", () => {
  const view = buildTeamTournamentDashboardView({
    tournament: sampleTournament({ status: TOURNAMENT_STATUS.DRAFT }),
    teamData: sampleTeamData(),
    playerId: "player-other",
    userId: "user-ref",
    canOrganize: false,
    sameTenant: true,
    isAuthenticated: true,
    refereeAssignments: [{ refereeUserId: "user-ref", matchupId: "mu-equal", matchId: "m-1" }],
  });
  assert.equal(view.ok, true);
  assert.equal(view.sections.viewer, true);
  assert.equal(view.sections.referee, true);
  assert.equal(view.sections.captain, false);
  assert.equal(view.sections.organizer, false);
});

test("dashboard load: visibility codes map to not-visible message (not generic load failure)", async () => {
  const draft = await loadTeamTournamentDashboardSource({
    tournamentId: "tid-1",
    getDashboard: async () => ({ ok: false, code: "DRAFT_NOT_VISIBLE" }),
  });
  assert.equal(draft.code, "DRAFT_NOT_VISIBLE");
  assert.match(draft.error, /không có quyền xem/i);
  assert.doesNotMatch(draft.error, /Không tải được/);

  const unavailable = await loadTeamTournamentDashboardSource({
    tournamentId: "tid-1",
    getDashboard: async () => ({ ok: false, code: "DASHBOARD_UNAVAILABLE" }),
  });
  assert.match(unavailable.error, /Không tải được/);
});

test("captain tasks: submitted lineup is not an open lineup task", () => {
  const teamData = sampleTeamData();
  teamData.matchups = [
    {
      id: "mu-submitted",
      teamAId: "team-a",
      teamBId: "team-b",
      status: "lineup_open",
      lineups: {
        "team-a": { status: LINEUP_STATUS.SUBMITTED },
      },
    },
    {
      id: "mu-pending",
      teamAId: "team-a",
      teamBId: "team-b",
      status: "lineup_open",
      lineups: {
        "team-a": { status: LINEUP_STATUS.DRAFT },
      },
    },
  ];
  const tasks = buildCaptainDashboardTasks({
    tournament: sampleTournament({ status: TOURNAMENT_STATUS.DRAFT }),
    teamData,
    captainTeamId: "team-a",
    clubId: "club-a",
  });
  assert.equal(tasks.some((task) => task.matchupId === "mu-submitted"), false);
  assert.equal(tasks.some((task) => task.matchupId === "mu-pending"), true);
  assert.ok(tasks[0].href.includes("/team-portal/"));
  assert.ok(tasks[0].href.includes("club=club-a"));
});

test("dashboard: non-participant sees viewer sections only", () => {
  const view = buildTeamTournamentDashboardView({
    tournament: sampleTournament({ status: TOURNAMENT_STATUS.ACTIVE }),
    teamData: sampleTeamData(),
    playerId: "player-other",
    userId: "user-other",
    canOrganize: false,
    sameTenant: true,
    isAuthenticated: true,
  });
  assert.equal(view.ok, true);
  assert.equal(view.sections.viewer, true);
  assert.equal(view.sections.myTeam, false);
  assert.equal(view.sections.captain, false);
  assert.equal(view.sections.referee, false);
  assert.equal(view.myTeam, null);
});

test("dashboard: participating player is read-only my-team", () => {
  const view = buildTeamTournamentDashboardView({
    tournament: sampleTournament({ status: TOURNAMENT_STATUS.ACTIVE }),
    teamData: sampleTeamData(),
    playerId: "player-p1",
    canOrganize: false,
    sameTenant: true,
    isAuthenticated: true,
  });
  assert.equal(view.sections.myTeam, true);
  assert.equal(view.sections.captain, false);
  assert.equal(view.myTeam.id, "team-a");
  assert.equal(view.capabilities.isParticipant, true);
});

test("dashboard: multi-role sections coexist", () => {
  const view = buildTeamTournamentDashboardView({
    tournament: sampleTournament({ status: TOURNAMENT_STATUS.ACTIVE }),
    teamData: sampleTeamData(),
    playerId: "player-cap",
    userId: "user-ref",
    canOrganize: true,
    sameTenant: true,
    isAuthenticated: true,
    refereeAssignments: [{ refereeUserId: "user-ref", matchupId: "mu-equal", matchId: "m-1" }],
  });
  assert.equal(view.sections.viewer, true);
  assert.equal(view.sections.myTeam, true);
  assert.equal(view.sections.captain, true);
  assert.equal(view.sections.referee, true);
  assert.equal(view.sections.organizer, true);
  assert.ok(view.referee.assignments[0].href.includes("/referee/match/m-1"));
  assert.ok(view.captain.href.includes("/team-portal/"));
});

test("captain tasks: lineup + dreambreaker fallback; no task on unequal totals", () => {
  const tasks = buildCaptainDashboardTasks({
    tournament: sampleTournament({ status: TOURNAMENT_STATUS.ACTIVE }),
    teamData: sampleTeamData(),
    captainTeamId: "team-a",
    clubId: "club-a",
  });
  assert.ok(tasks.some((task) => task.type === "captain_lineup"));
  assert.ok(tasks.some((task) => task.type === "captain_dreambreaker"));
  assert.equal(
    tasks.some((task) => task.matchupId === "mu-unequal"),
    false
  );
});

test("dashboard does not leak opponent captain orders", () => {
  const view = buildTeamTournamentDashboardView({
    tournament: sampleTournament({ status: TOURNAMENT_STATUS.ACTIVE }),
    teamData: sampleTeamData(),
    playerId: "player-cap",
    canOrganize: false,
    sameTenant: true,
    isAuthenticated: true,
  });
  assert.equal(assertNoPrivateCaptainLeak(view), true);
});

test("stage policy display is not winner authority", () => {
  const view = buildTeamTournamentDashboardView({
    tournament: sampleTournament({ status: TOURNAMENT_STATUS.ACTIVE }),
    teamData: sampleTeamData(),
    playerId: "player-other",
    canOrganize: false,
    sameTenant: true,
    isAuthenticated: true,
  });
  assert.equal(view.stageTieBreakPolicy.group, STAGE_TIE_BREAK_POLICY.TOTAL_SUBMATCH_POINTS);
  assert.equal(view.stageTieBreakPolicy.semifinal, STAGE_TIE_BREAK_POLICY.DREAMBREAKER);
  assert.equal(TOTAL_POINTS_SECONDARY_TIE_CONTRACT, "DREAMBREAKER_FALLBACK");
  assert.equal(view.results[0].result.teamAWins, 3);
  assert.equal(view.results.find((item) => item.id === "mu-unequal").result.teamAWins, 2);
});

test("normal player does not gain captain or referee by viewing", () => {
  const view = buildTeamTournamentDashboardView({
    tournament: sampleTournament({ status: TOURNAMENT_STATUS.ACTIVE }),
    teamData: sampleTeamData(),
    playerId: "player-p1",
    userId: "user-p1",
    canOrganize: false,
    sameTenant: true,
    isAuthenticated: true,
    refereeAssignments: [{ refereeUserId: "someone-else", matchupId: "mu-equal" }],
  });
  assert.equal(view.capabilities.isCaptain, false);
  assert.equal(view.capabilities.isReferee, false);
  assert.equal(view.captain, null);
  assert.equal(view.referee, null);
});

test("mine matcher includes createdBy, roster, and captain", () => {
  const tournament = {
    createdBy: "org",
    teamData: sampleTeamData(),
  };
  assert.equal(tournamentMatchesMine(tournament, "org"), true);
  assert.equal(tournamentMatchesMine(tournament, "player-p1"), true);
  assert.equal(tournamentMatchesMine(tournament, "player-cap"), true);
  assert.equal(tournamentMatchesMine(tournament, "stranger"), false);
});

test("shell can accept stable id from canonical create", () => {
  const shell = createTeamTournamentShell("club-a", {
    id: "stable-id",
    createdBy: "org",
    canonicalId: "stable-id",
  });
  assert.equal(shell.id, "stable-id");
  assert.equal(shell.createdBy, "org");
  assert.equal(shell.status, "draft");
});

test("localStorage blob is not canonical authority", () => {
  assert.equal(classifyTeamTournamentStorageAuthority("canonical"), "CANONICAL_AUTHORITY");
  assert.equal(classifyTeamTournamentStorageAuthority("legacy"), "LEGACY_AUTHORITY");
  assert.equal(classifyTeamTournamentStorageAuthority("cache"), "CACHE_ONLY");
});

test("SQL package encodes create, visibility, and privacy contracts", () => {
  const apply = readSql("02_APPLY.sql");
  const verify = readSql("03_VERIFY.sql");
  const precheck = readSql("01_PRECHECK.sql");
  const rollback = readSql("04_ROLLBACK.sql");
  assert.match(precheck, /canonical_tournaments/);
  assert.match(precheck, /team_tournament_resolve_stage_tiebreak_policy/);
  assert.match(apply, /team_tournament_create/);
  assert.match(apply, /insert into public.canonical_tournaments/);
  assert.match(apply, /insert into public.team_tournaments/);
  assert.doesNotMatch(apply, /on conflict \(tenant_id, club_id, tournament_id\) do update/i);
  assert.match(apply, /idempotencyKey/);
  assert.match(apply, /myTeamId/);
  assert.match(apply, /DRAFT_NOT_VISIBLE/);
  assert.match(apply, /team_tournament_get_dashboard/);
  assert.match(apply, /team_tournament_list_my_referee_assignments/);
  assert.doesNotMatch(apply, /opponentOrder/);
  assert.match(apply, /canonical_tournament_list_mine/);
  assert.match(apply, /canonical_tournament_list\(/);
  assert.match(apply, /team_tournament_team_members/);
  assert.doesNotMatch(apply, /t\.player_ids/);
  assert.match(apply, /or lower\(coalesce\(t\.status, 'draft'\)\) <> 'draft'/);
  assert.match(verify, /t\.player_ids/);
  assert.match(verify, /hide draft from non-managers/);
  assert.match(verify, /DRAFT_NOT_VISIBLE/);
  assert.match(verify, /anon must not execute/);
  assert.match(rollback, /drop function if exists public.team_tournament_create/);
});

test("registration foundation is ready; full UI stays future", () => {
  const view = buildTeamTournamentDashboardView({
    tournament: sampleTournament({ status: TOURNAMENT_STATUS.DRAFT }),
    teamData: sampleTeamData(),
    canOrganize: true,
    sameTenant: true,
    isAuthenticated: true,
  });
  assert.equal(view.overview.registrationFoundationReady, true);
  assert.equal(view.overview.registrationFullUiImplemented, false);
});
