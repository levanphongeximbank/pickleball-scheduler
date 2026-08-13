/**
 * Scenario B late-stage lifecycle (C1–C4).
 * STAGING_MUTATIONS=0 — SQL package local until Owner GO.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

import { LINEUP_STATUS, MATCHUP_STATUS } from "../src/features/team-tournament/constants.js";
import {
  buildCaptainDashboardTasks,
  buildRefereeDashboardAssignments,
} from "../src/features/team-tournament/dashboard/teamTournamentDashboardTasks.js";
import { buildTeamTournamentDashboardView } from "../src/features/team-tournament/dashboard/teamTournamentDashboardModel.js";
import { projectMyDashboardCard } from "../src/features/team-tournament/my-dashboards/myDashboardsModel.js";
import {
  advanceTeamKnockoutWinner,
  isUnresolvedBracketPlaceholder,
  resolveKnockoutNextSlot,
} from "../src/features/team-tournament/engines/teamKnockoutEngine.js";
import {
  applyRefereeAssignmentTransaction,
  planRefereeAssignment,
  REFEREE_ASSIGN_ACTION,
} from "../src/features/team-tournament/engines/teamRefereeAssignmentLifecycle.js";
import { isMatchupPublishedForReferee } from "../src/features/team-tournament/engines/teamRefereeEngine.js";
import { listMatchesWithoutReferee } from "../src/features/team-tournament/engines/refereeAssignEngine.js";
import {
  mapTeamTournamentDomainFailure,
} from "../src/features/team-tournament/engines/teamTournamentDomainErrors.js";
import { normalizeRepositoryResult } from "../src/features/team-tournament/repositories/teamTournamentRepositoryValidation.js";
import { lineupKey, normalizeMatchup } from "../src/features/team-tournament/models/index.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pkgDir = path.join(
  root,
  "docs/v5/migrations/team-tournament-scenario-b-final-progression-referee-01"
);

const PACKAGE_LF_SHA256 = Object.freeze({
  "01_PRECHECK.sql":
    "82e0f1c0b60ca51bced45024b49d4761884e85634cd6717ff2e8f0564dd68a35",
  "02_APPLY.sql":
    "ba3dc54ed467b30e09331e5e721b1c6c43fd9e7e45a15b722f73bafa90a8f251",
  "03_VERIFY.sql":
    "23bdffc79431cabebff07903008f8ede6fceeb1c311f5a5e75714b5706170079",
  "04_ROLLBACK.sql":
    "703bea0609dfc92b1cdf8936b54fb56e0908d667f27a2bef11d5ff52dc3a72ca",
});

function sha256Lf(name) {
  const raw = readFileSync(path.join(pkgDir, name));
  const lf = Buffer.from(
    raw.toString("utf8").replace(/\r\n/g, "\n").replace(/\r/g, "\n")
  );
  return createHash("sha256").update(lf).digest("hex");
}

function readPkg(name) {
  return readFileSync(path.join(pkgDir, name), "utf8");
}

function placeholderFinal(overrides = {}) {
  return {
    id: "ko-final",
    teamAId: "",
    teamBId: "",
    status: "lineup_open",
    stage: "knockout",
    competitionStage: "final",
    bracketRoundLabel: "Chung kết",
    ...overrides,
  };
}

function resolvedSemifinals() {
  return [
    {
      id: "ko-sf1",
      teamAId: "t1",
      teamBId: "t2",
      status: MATCHUP_STATUS.COMPLETED,
      stage: "knockout",
      competitionStage: "semifinal",
      matchNumberInRound: 1,
      nextMatchupId: "ko-final",
      result: { winnerTeamId: "t1", teamAWins: 3, teamBWins: 1 },
    },
    {
      id: "ko-sf2",
      teamAId: "t3",
      teamBId: "t4",
      status: MATCHUP_STATUS.COMPLETED,
      stage: "knockout",
      competitionStage: "semifinal",
      matchNumberInRound: 2,
      nextMatchupId: "ko-final",
      result: { winnerTeamId: "t4", teamAWins: 1, teamBWins: 3 },
    },
  ];
}

describe("team-tournament-scenario-b-late-stage-lifecycle-01", () => {
  it("locks LF SHA256 package hashes", () => {
    for (const [file, expected] of Object.entries(PACKAGE_LF_SHA256)) {
      assert.equal(sha256Lf(file), expected, file);
    }
  });

  it("SQL package is auto-progression + unique-preserving", () => {
    const apply = readPkg("02_APPLY.sql");
    assert.match(apply, /team_tournament_advance_knockout_winner/);
    assert.match(apply, /winnerTeamId/);
    assert.match(apply, /nextSlot/);
    assert.match(apply, /unique_violation/);
    assert.match(apply, /REFEREE_ASSIGNMENT_CONFLICT/);
    assert.match(apply, /MATCHUP_TEAMS_UNRESOLVED/);
    assert.doesNotMatch(apply, /drop constraint if exists referee_assignments_tenant_id/);
    assert.match(readPkg("01_PRECHECK.sql"), /do not drop it/i);
  });

  it("C1: unresolved Final persists structurally but creates no captain task", () => {
    const finalMu = placeholderFinal();
    assert.equal(isUnresolvedBracketPlaceholder(finalMu), true);
    const teamData = {
      teams: [
        { id: "t1", name: "A", captainPlayerId: "p1" },
        { id: "t2", name: "B" },
      ],
      matchups: [
        {
          id: "ko-sf1",
          teamAId: "t1",
          teamBId: "t2",
          status: "lineup_open",
          stage: "knockout",
        },
        finalMu,
      ],
    };
    const tasks = buildCaptainDashboardTasks({
      tournament: { id: "tour-1" },
      teamData,
      captainTeamId: "t1",
    });
    assert.equal(tasks.some((task) => task.matchupId === "ko-final"), false);
    assert.equal(tasks.some((task) => task.matchupId === "ko-sf1"), true);
  });

  it("C1: unresolved Final creates no referee task / assign row", () => {
    const finalMu = placeholderFinal({ status: MATCHUP_STATUS.PUBLISHED });
    assert.equal(isMatchupPublishedForReferee(finalMu), false);
    const without = listMatchesWithoutReferee({
      matchups: [finalMu],
      referees: [],
      refereeAssignments: {},
    });
    assert.equal(without.length, 0);
    const refTasks = buildRefereeDashboardAssignments({
      tournament: { id: "tour-1" },
      teamData: { teams: [], matchups: [finalMu] },
      assignments: [{ matchupId: "ko-final", matchId: "sm-1" }],
    });
    assert.equal(refTasks.length, 0);
  });

  it("C1: unresolved Final is not My Tournaments next match", () => {
    const card = projectMyDashboardCard({
      id: "tour-1",
      name: "B",
      nextMatchup: {
        id: "ko-final",
        status: "lineup_open",
        teamAId: "",
        teamBId: "",
      },
    });
    assert.equal(card.nextMatchup, null);
  });

  it("C1: dashboard upcoming excludes unresolved placeholder", () => {
    const view = buildTeamTournamentDashboardView({
      tournament: { id: "tour-1", status: "published", tenantId: "tn" },
      teamData: {
        teams: [{ id: "t1", name: "A", captainPlayerId: "p1" }],
        matchups: [placeholderFinal()],
      },
      playerId: "p1",
      userId: "u1",
      canOrganize: true,
      isAuthenticated: true,
      sameTenant: true,
      clubId: "c1",
    });
    assert.equal(view.ok, true);
    assert.equal((view.schedule?.upcoming || []).length, 0);
    assert.equal((view.schedule?.bracketPending || []).length, 1);
    assert.equal((view.captain?.tasks || []).length, 0);
  });

  it("C2: one SF complete → Final still unresolved", () => {
    const [sf1, sf2] = resolvedSemifinals();
    sf2.status = "lineup_open";
    sf2.result = null;
    const teamData = {
      teams: [
        { id: "t1", name: "A" },
        { id: "t2", name: "B" },
        { id: "t3", name: "C" },
        { id: "t4", name: "D" },
      ],
      matchups: [sf1, sf2, placeholderFinal()],
    };
    const advanced = advanceTeamKnockoutWinner(teamData, "ko-sf1");
    assert.equal(advanced.ok, true);
    const finalMu = advanced.teamData.matchups.find((row) => row.id === "ko-final");
    assert.equal(finalMu.teamAId, "t1");
    assert.equal(String(finalMu.teamBId || ""), "");
    assert.equal(isUnresolvedBracketPlaceholder(finalMu), true);
    const tasks = buildCaptainDashboardTasks({
      tournament: { id: "tour-1" },
      teamData: advanced.teamData,
      captainTeamId: "t1",
    });
    assert.equal(tasks.some((task) => task.matchupId === "ko-final"), false);
  });

  it("C2: both SFs complete → server-shaped advance fills both Final teams from persisted winners", () => {
    const [sf1, sf2] = resolvedSemifinals();
    assert.equal(resolveKnockoutNextSlot(sf1), "A");
    assert.equal(resolveKnockoutNextSlot(sf2), "B");
    let teamData = {
      teams: [
        { id: "t1", name: "A" },
        { id: "t2", name: "B" },
        { id: "t3", name: "C" },
        { id: "t4", name: "D" },
      ],
      matchups: [sf1, sf2, placeholderFinal()],
    };
    teamData = advanceTeamKnockoutWinner(teamData, "ko-sf1").teamData;
    teamData = advanceTeamKnockoutWinner(teamData, "ko-sf2").teamData;
    const finalMu = teamData.matchups.find((row) => row.id === "ko-final");
    assert.equal(finalMu.teamAId, "t1");
    assert.equal(finalMu.teamBId, "t4");
    assert.equal(isUnresolvedBracketPlaceholder(finalMu), false);
    assert.equal(sf1.result.winnerTeamId, "t1");
    assert.equal(sf2.result.winnerTeamId, "t4");
  });

  it("C2: Final creates fresh matchup-specific captain tasks; SF lineup does not satisfy Final", () => {
    const [sf1, sf2] = resolvedSemifinals();
    let teamData = {
      teams: [
        { id: "t1", name: "A" },
        { id: "t2", name: "B" },
        { id: "t3", name: "C" },
        { id: "t4", name: "D" },
      ],
      matchups: [sf1, sf2, placeholderFinal({ teamAId: "t1", teamBId: "t4" })],
      lineups: {
        [lineupKey("ko-sf1", "t1")]: {
          matchupId: "ko-sf1",
          teamId: "t1",
          status: LINEUP_STATUS.PUBLISHED,
        },
      },
    };
    const tasks = buildCaptainDashboardTasks({
      tournament: { id: "tour-1" },
      teamData,
      captainTeamId: "t1",
    });
    assert.equal(tasks.length, 1);
    assert.equal(tasks[0].matchupId, "ko-final");
  });

  it("C2: Final referee assignment only after teams resolved", () => {
    assert.equal(isMatchupPublishedForReferee(placeholderFinal({ status: MATCHUP_STATUS.PUBLISHED })), false);
    assert.equal(
      isMatchupPublishedForReferee({
        id: "ko-final",
        teamAId: "t1",
        teamBId: "t4",
        status: MATCHUP_STATUS.PUBLISHED,
      }),
      true
    );
  });

  it("C2: F5/readback preserves resolved Final via normalizeMatchup", () => {
    const persisted = {
      id: "ko-final",
      teamAId: "t1",
      teamBId: "t4",
      status: "lineup_open",
      stage: "knockout",
      scheduleMeta: { nextSlot: "A", nextMatchupId: "" },
    };
    const roundTrip = normalizeMatchup(JSON.parse(JSON.stringify(persisted)));
    assert.equal(roundTrip.teamAId, "t1");
    assert.equal(roundTrip.teamBId, "t4");
    assert.equal(isUnresolvedBracketPlaceholder(roundTrip), false);
  });

  it("C3: assigning same referee twice is idempotent", () => {
    const existing = [
      {
        tenantId: "tn",
        tournamentId: "tour",
        matchId: "sm-1",
        role: "REFEREE",
        refereeUserId: "ref-a",
        status: "active",
      },
    ];
    const plan = planRefereeAssignment({
      matchup: { teamAId: "t1", teamBId: "t2" },
      existingAssignments: existing,
      refereeUserId: "ref-a",
      tenantId: "tn",
      tournamentTenantId: "tn",
      matchId: "sm-1",
    });
    assert.equal(plan.action, REFEREE_ASSIGN_ACTION.IDEMPOTENT_NOOP);
    const applied = applyRefereeAssignmentTransaction(existing, {
      tenantId: "tn",
      tournamentId: "tour",
      matchId: "sm-1",
      refereeUserId: "ref-a",
      matchup: { teamAId: "t1", teamBId: "t2" },
    });
    assert.equal(applied.ok, true);
    assert.equal(applied.replayed, true);
    assert.equal(applied.liveCount, 1);
  });

  it("C3: changing referee is atomic and leaves exactly one live assignment", () => {
    const existing = [
      {
        tenantId: "tn",
        tournamentId: "tour",
        matchId: "sm-1",
        role: "REFEREE",
        refereeUserId: "ref-a",
        status: "active",
      },
    ];
    const applied = applyRefereeAssignmentTransaction(existing, {
      tenantId: "tn",
      tournamentId: "tour",
      matchId: "sm-1",
      refereeUserId: "ref-b",
      matchup: { teamAId: "t1", teamBId: "t2" },
    });
    assert.equal(applied.ok, true);
    assert.equal(applied.liveCount, 1);
    const live = applied.rows.filter((row) => row.status === "active");
    assert.equal(live.length, 1);
    assert.equal(live[0].refereeUserId, "ref-b");
  });

  it("C3: failed change does not create duplicates or zero live assignment", () => {
    const existing = [
      {
        tenantId: "tn",
        tournamentId: "tour",
        matchId: "sm-1",
        role: "REFEREE",
        refereeUserId: "ref-a",
        status: "active",
      },
    ];
    const applied = applyRefereeAssignmentTransaction(existing, {
      tenantId: "tn",
      tournamentId: "tour",
      matchId: "sm-1",
      refereeUserId: "ref-b",
      failBind: true,
      matchup: { teamAId: "t1", teamBId: "t2" },
    });
    assert.equal(applied.ok, false);
    assert.equal(applied.liveCount, 1);
    assert.equal(applied.rows[0].refereeUserId, "ref-a");
    assert.equal(applied.rows[0].status, "active");
  });

  it("C3: cross-tenant assignment denied", () => {
    const plan = planRefereeAssignment({
      matchup: { teamAId: "t1", teamBId: "t2" },
      refereeUserId: "ref-a",
      tenantId: "tn-a",
      tournamentTenantId: "tn-b",
      matchId: "sm-1",
    });
    assert.equal(plan.ok, false);
    assert.equal(plan.code, "CROSS_TENANT_DENIED");
  });

  it("C4: unique violation maps to domain code, not raw Postgres / generic repository text", () => {
    const mapped = mapTeamTournamentDomainFailure({
      code: "23505",
      error:
        'duplicate key value violates unique constraint "referee_assignments_tenant_id_tournament_id_match_id_role_r_key"',
    });
    assert.equal(mapped.code, "REFEREE_ASSIGNMENT_CONFLICT");
    assert.doesNotMatch(mapped.error, /duplicate key/i);
    assert.match(mapped.originalServerError, /duplicate key/);

    const repo = normalizeRepositoryResult({
      ok: false,
      code: "UNKNOWN_TEAM",
    });
    assert.equal(repo.ok, false);
    assert.notEqual(repo.error, "Repository operation failed.");
    assert.match(repo.error, /Đội/);
  });
});
