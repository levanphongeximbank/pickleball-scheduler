/**
 * NULL nextSlot fallback remediation (Owner B Final follow-up).
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
import {
  advanceTeamKnockoutWinner,
  generateTeamKnockoutMatchups,
  isUnresolvedBracketPlaceholder,
  listKnockoutMatchups,
  maybeAdvanceKnockoutAfterResult,
  normalizeKnockoutNextSlot,
  reconcileKnockoutProgression,
  resolveKnockoutNextSlot,
} from "../src/features/team-tournament/engines/teamKnockoutEngine.js";
import { addTeamToTournament, initializeTeamTournamentData } from "../src/features/team-tournament/engines/teamTournamentEngine.js";
import { isMatchupPublishedForReferee } from "../src/features/team-tournament/engines/teamRefereeEngine.js";
import { listMatchesWithoutReferee } from "../src/features/team-tournament/engines/refereeAssignEngine.js";
import {
  applyRefereeAssignmentTransaction,
  planRefereeAssignment,
  REFEREE_ASSIGN_ACTION,
} from "../src/features/team-tournament/engines/teamRefereeAssignmentLifecycle.js";
import { mapTeamTournamentDomainFailure } from "../src/features/team-tournament/engines/teamTournamentDomainErrors.js";
import {
  createDisciplineRecord,
  createMatchupRecord,
  lineupKey,
  normalizeMatchup,
  normalizeTeamData,
} from "../src/features/team-tournament/models/index.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pkgDir = path.join(
  root,
  "docs/v5/migrations/team-tournament-final-nextslot-null-remediation-01"
);

const PACKAGE_LF_SHA256 = Object.freeze({
  "01_PRECHECK.sql":
    "b450807dd77079e91265cf443cdf9386c897f354607fb8088b6a395459343c43",
  "02_APPLY.sql":
    "acbeb5894cb87a312d37be2c3a65f3630d518387c95cd4b71cfcc6ef4a2fbc5a",
  "03_VERIFY.sql":
    "7111fcf1bf0ab9f534277a9fe95338a3dd235f988732a9e6f5e5929f53a1dda3",
  "04_ROLLBACK.sql":
    "1c9ef6993033def637b5e8060da24d7a95aef6565d35f5ba3928cfa066be7954",
});

const OWNER_SF1_WINNER = "team-8xqls8it";
const OWNER_SF2_WINNER = "team-eixvc6s8";

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
    id: "ko-mugj641t",
    teamAId: "",
    teamBId: "",
    status: "lineup_open",
    stage: "knockout",
    competitionStage: "final",
    bracketRoundLabel: "Chung kết",
    ...overrides,
  };
}

function ownerSemifinals(overrides1 = {}, overrides2 = {}) {
  return [
    {
      id: "ko-7ebydj8c",
      teamAId: "team-sf1-a",
      teamBId: "team-sf1-b",
      status: MATCHUP_STATUS.COMPLETED,
      stage: "knockout",
      competitionStage: "semifinal",
      matchNumberInRound: 1,
      nextMatchupId: "ko-mugj641t",
      nextSlot: null,
      result: {
        winnerTeamId: OWNER_SF1_WINNER,
        teamAWins: 3,
        teamBWins: 1,
      },
      ...overrides1,
    },
    {
      id: "ko-fttp83ax",
      teamAId: "team-sf2-a",
      teamBId: OWNER_SF2_WINNER,
      status: MATCHUP_STATUS.COMPLETED,
      stage: "knockout",
      competitionStage: "semifinal",
      matchNumberInRound: 2,
      nextMatchupId: "ko-mugj641t",
      nextSlot: null,
      result: {
        winnerTeamId: OWNER_SF2_WINNER,
        teamAWins: 1,
        teamBWins: 3,
      },
      ...overrides2,
    },
  ];
}

function ownerTeamData(matchups) {
  return normalizeTeamData({
    teams: [
      { id: OWNER_SF1_WINNER, name: "SF1W", captainPlayerId: "p1" },
      { id: OWNER_SF2_WINNER, name: "SF2W", captainPlayerId: "p2" },
      { id: "team-sf1-a", name: "SF1A" },
      { id: "team-sf1-b", name: "SF1B" },
      { id: "team-sf2-a", name: "SF2A" },
    ],
    matchups,
  });
}

function withCompletedResult(matchup, winnerTeamId) {
  const winnerIsA = String(winnerTeamId) === String(matchup.teamAId);
  return {
    ...matchup,
    status: MATCHUP_STATUS.COMPLETED,
    result: {
      teamAWins: winnerIsA ? 1 : 0,
      teamBWins: winnerIsA ? 0 : 1,
      teamAPoints: winnerIsA ? 11 : 5,
      teamBPoints: winnerIsA ? 5 : 11,
      winnerTeamId,
    },
  };
}

function buildTwoGroupFixture() {
  let teamData = initializeTeamTournamentData({
    disciplines: [
      createDisciplineRecord({
        id: "d1",
        name: "Đôi nam",
        playerCount: 2,
        sortOrder: 1,
      }),
    ],
  });
  for (const [id, name] of [
    ["a1", "A1"],
    ["a2", "A2"],
    ["b1", "B1"],
    ["b2", "B2"],
  ]) {
    teamData = addTeamToTournament(teamData, {
      id,
      name,
      playerIds: [`${id}-p1`, `${id}-p2`],
      captainPlayerId: `${id}-p1`,
    });
  }
  const rrA = withCompletedResult(
    createMatchupRecord("a1", "a2", {
      id: "rr-a",
      groupId: "g-a",
      disciplines: teamData.disciplines,
      status: MATCHUP_STATUS.COMPLETED,
    }),
    "a1"
  );
  const rrB = withCompletedResult(
    createMatchupRecord("b1", "b2", {
      id: "rr-b",
      groupId: "g-b",
      disciplines: teamData.disciplines,
      status: MATCHUP_STATUS.COMPLETED,
    }),
    "b1"
  );
  return normalizeTeamData({
    ...teamData,
    groups: [
      { id: "g-a", name: "Bảng A", teamIds: ["a1", "a2"] },
      { id: "g-b", name: "Bảng B", teamIds: ["b1", "b2"] },
    ],
    matchups: [rrA, rrB],
  });
}

describe("team-tournament-final-nextslot-null-remediation-01", () => {
  it("locks LF SHA256 package hashes", () => {
    for (const [file, expected] of Object.entries(PACKAGE_LF_SHA256)) {
      assert.equal(sha256Lf(file), expected, file);
    }
  });

  it("SQL package is NULL-safe, forward-only, and does not restore NOT IN", () => {
    const apply = readPkg("02_APPLY.sql");
    const precheck = readPkg("01_PRECHECK.sql");
    const verify = readPkg("03_VERIFY.sql");
    assert.match(apply, /team_tournament_resolve_knockout_next_slot/);
    assert.match(apply, /team_tournament_reconcile_knockout_progression/);
    assert.match(apply, /is not distinct from/i);
    assert.doesNotMatch(apply, /v_slot not in/i);
    assert.match(verify, /Owner B Final not reconciled/);
    assert.match(precheck, /NEVER re-run|prior package required/i);
    assert.doesNotMatch(apply, /team-tournament-scenario-b-final-progression-referee-01\/02_APPLY/);
    assert.match(readPkg("04_ROLLBACK.sql"), /Do not restore NOT IN/i);
  });

  it("1. nextSlot='A' → A", () => {
    assert.equal(resolveKnockoutNextSlot({ nextSlot: "A" }), "A");
    assert.equal(normalizeKnockoutNextSlot("A"), "A");
  });

  it("2. nextSlot='B' → B", () => {
    assert.equal(resolveKnockoutNextSlot({ nextSlot: "B" }), "B");
    assert.equal(normalizeKnockoutNextSlot("b"), "B");
  });

  it("3. nextSlot=NULL + matchNumberInRound=1 → A", () => {
    assert.equal(
      resolveKnockoutNextSlot({ nextSlot: null, matchNumberInRound: 1 }),
      "A"
    );
  });

  it("4. nextSlot=NULL + matchNumberInRound=2 → B", () => {
    assert.equal(
      resolveKnockoutNextSlot({ nextSlot: null, matchNumberInRound: 2 }),
      "B"
    );
  });

  it("5. nextSlot='' + round number fallback", () => {
    assert.equal(
      resolveKnockoutNextSlot({
        nextSlot: "",
        scheduleMeta: { nextSlot: "  ", matchNumberInRound: 2 },
      }),
      "B"
    );
  });

  it("6. invalid nextSlot + canonical fallback", () => {
    assert.equal(normalizeKnockoutNextSlot("Z"), "");
    assert.equal(
      resolveKnockoutNextSlot({
        nextSlot: "Z",
        matchNumberInRound: 2,
      }),
      "B"
    );
  });

  it("7. two SF predecessors cannot both target same Final slot", () => {
    const [sf1, sf2] = ownerSemifinals(
      { nextSlot: "A" },
      { nextSlot: "A" }
    );
    const reconciled = reconcileKnockoutProgression(
      ownerTeamData([sf1, sf2, placeholderFinal()])
    );
    const finalMu = reconciled.teamData.matchups.find(
      (row) => row.id === "ko-mugj641t"
    );
    assert.equal(finalMu.teamAId, OWNER_SF1_WINNER);
    assert.equal(finalMu.teamBId, OWNER_SF2_WINNER);
    assert.notEqual(finalMu.teamAId, finalMu.teamBId);
    const stamped1 = reconciled.teamData.matchups.find(
      (row) => row.id === "ko-7ebydj8c"
    );
    const stamped2 = reconciled.teamData.matchups.find(
      (row) => row.id === "ko-fttp83ax"
    );
    assert.equal(stamped1.nextSlot, "A");
    assert.equal(stamped2.nextSlot, "B");
  });

  it("8. newly generated semifinal rows persist nextSlot", () => {
    const built = generateTeamKnockoutMatchups(buildTwoGroupFixture(), {
      qualifiersPerGroup: 2,
    });
    assert.equal(built.ok, true);
    const firstRound = listKnockoutMatchups(built.teamData).filter(
      (row) => Number(row.roundNumber) === 1
    );
    assert.equal(firstRound.length, 2);
    const slots = firstRound.map((row) => row.nextSlot).sort();
    assert.deepEqual(slots, ["A", "B"]);
    for (const row of firstRound) {
      assert.equal(row.scheduleMeta.nextSlot, row.nextSlot);
      assert.ok(row.nextMatchupId);
    }
  });

  it("9. one semifinal complete → Final remains inert", () => {
    const [sf1, sf2] = ownerSemifinals();
    sf2.status = "lineup_open";
    sf2.result = null;
    const advanced = maybeAdvanceKnockoutAfterResult(
      ownerTeamData([sf1, sf2, placeholderFinal()]),
      "ko-7ebydj8c"
    );
    const finalMu = advanced.teamData.matchups.find(
      (row) => row.id === "ko-mugj641t"
    );
    assert.equal(finalMu.teamAId, OWNER_SF1_WINNER);
    assert.equal(String(finalMu.teamBId || ""), "");
    assert.equal(isUnresolvedBracketPlaceholder(finalMu), true);
    const tasks = buildCaptainDashboardTasks({
      tournament: { id: "tour-1" },
      teamData: advanced.teamData,
      captainTeamId: OWNER_SF1_WINNER,
    });
    assert.equal(tasks.some((task) => task.matchupId === "ko-mugj641t"), false);
  });

  it("10. two semifinals complete → Final A+B resolved", () => {
    const [sf1, sf2] = ownerSemifinals();
    let teamData = ownerTeamData([sf1, sf2, placeholderFinal()]);
    teamData = maybeAdvanceKnockoutAfterResult(teamData, "ko-7ebydj8c").teamData;
    teamData = maybeAdvanceKnockoutAfterResult(teamData, "ko-fttp83ax").teamData;
    const finalMu = teamData.matchups.find((row) => row.id === "ko-mugj641t");
    assert.equal(finalMu.teamAId, OWNER_SF1_WINNER);
    assert.equal(finalMu.teamBId, OWNER_SF2_WINNER);
    assert.equal(isUnresolvedBracketPlaceholder(finalMu), false);
  });

  it("11. partial Final with correct A + empty B reconciles correctly", () => {
    const [sf1, sf2] = ownerSemifinals();
    const reconciled = reconcileKnockoutProgression(
      ownerTeamData([
        sf1,
        sf2,
        placeholderFinal({ teamAId: OWNER_SF1_WINNER, teamBId: "" }),
      ])
    );
    const finalMu = reconciled.teamData.matchups.find(
      (row) => row.id === "ko-mugj641t"
    );
    assert.equal(finalMu.teamAId, OWNER_SF1_WINNER);
    assert.equal(finalMu.teamBId, OWNER_SF2_WINNER);
  });

  it("12. partial Final with incorrect slot content reconciles from server truth", () => {
    const [sf1, sf2] = ownerSemifinals();
    const reconciled = reconcileKnockoutProgression(
      ownerTeamData([
        sf1,
        sf2,
        placeholderFinal({ teamAId: OWNER_SF2_WINNER, teamBId: "" }),
      ])
    );
    const finalMu = reconciled.teamData.matchups.find(
      (row) => row.id === "ko-mugj641t"
    );
    assert.equal(finalMu.teamAId, OWNER_SF1_WINNER);
    assert.equal(finalMu.teamBId, OWNER_SF2_WINNER);
    assert.notEqual(finalMu.teamAId, OWNER_SF2_WINNER);
  });

  it("13. rerun progression is idempotent", () => {
    const [sf1, sf2] = ownerSemifinals();
    let teamData = ownerTeamData([
      sf1,
      sf2,
      placeholderFinal({ teamAId: OWNER_SF2_WINNER, teamBId: "" }),
    ]);
    teamData = reconcileKnockoutProgression(teamData).teamData;
    const first = teamData.matchups.find((row) => row.id === "ko-mugj641t");
    teamData = reconcileKnockoutProgression(teamData).teamData;
    teamData = maybeAdvanceKnockoutAfterResult(teamData, "ko-7ebydj8c").teamData;
    teamData = maybeAdvanceKnockoutAfterResult(teamData, "ko-fttp83ax").teamData;
    const second = teamData.matchups.find((row) => row.id === "ko-mugj641t");
    assert.equal(second.teamAId, first.teamAId);
    assert.equal(second.teamBId, first.teamBId);
    assert.equal(
      teamData.matchups.filter((row) => row.competitionStage === "final").length,
      1
    );
  });

  it("14. Final fresh lineup task appears only after both teams resolved", () => {
    const [sf1, sf2] = ownerSemifinals();
    const unresolved = ownerTeamData([sf1, sf2, placeholderFinal()]);
    assert.equal(
      buildCaptainDashboardTasks({
        tournament: { id: "tour-1" },
        teamData: unresolved,
        captainTeamId: OWNER_SF1_WINNER,
      }).some((task) => task.matchupId === "ko-mugj641t"),
      false
    );
    const resolved = reconcileKnockoutProgression(
      ownerTeamData([
        sf1,
        sf2,
        placeholderFinal({ teamAId: OWNER_SF1_WINNER, teamBId: OWNER_SF2_WINNER }),
      ])
    ).teamData;
    const tasks = buildCaptainDashboardTasks({
      tournament: { id: "tour-1" },
      teamData: resolved,
      captainTeamId: OWNER_SF1_WINNER,
    });
    assert.equal(tasks.length, 1);
    assert.equal(tasks[0].matchupId, "ko-mugj641t");
  });

  it("15. Final gets zero inherited semifinal lineups", () => {
    const [sf1, sf2] = ownerSemifinals();
    const teamData = ownerTeamData([
      sf1,
      sf2,
      placeholderFinal({ teamAId: OWNER_SF1_WINNER, teamBId: OWNER_SF2_WINNER }),
    ]);
    teamData.lineups = {
      [lineupKey("ko-7ebydj8c", OWNER_SF1_WINNER)]: {
        matchupId: "ko-7ebydj8c",
        teamId: OWNER_SF1_WINNER,
        status: LINEUP_STATUS.PUBLISHED,
      },
    };
    const tasks = buildCaptainDashboardTasks({
      tournament: { id: "tour-1" },
      teamData,
      captainTeamId: OWNER_SF1_WINNER,
    });
    assert.equal(tasks.length, 1);
    assert.equal(tasks[0].matchupId, "ko-mugj641t");
    assert.equal(
      Boolean(teamData.lineups[lineupKey("ko-mugj641t", OWNER_SF1_WINNER)]),
      false
    );
  });

  it("16. referee task remains unavailable before both teams resolved", () => {
    const finalMu = placeholderFinal({
      status: MATCHUP_STATUS.PUBLISHED,
      teamAId: OWNER_SF2_WINNER,
      teamBId: "",
    });
    assert.equal(isMatchupPublishedForReferee(finalMu), false);
    assert.equal(
      listMatchesWithoutReferee({
        matchups: [finalMu],
        referees: [],
        refereeAssignments: {},
      }).length,
      0
    );
    const refTasks = buildRefereeDashboardAssignments({
      tournament: { id: "tour-1" },
      teamData: { teams: [], matchups: [finalMu] },
      assignments: [{ matchupId: "ko-mugj641t", matchId: "sm-1" }],
    });
    assert.equal(refTasks.length, 0);
  });

  it("17. referee task becomes available after both teams resolved", () => {
    const finalMu = {
      id: "ko-mugj641t",
      teamAId: OWNER_SF1_WINNER,
      teamBId: OWNER_SF2_WINNER,
      status: MATCHUP_STATUS.PUBLISHED,
      stage: "knockout",
    };
    assert.equal(isMatchupPublishedForReferee(finalMu), true);
  });

  it("18. F5/readback preserves resolved Final", () => {
    const persisted = {
      id: "ko-mugj641t",
      teamAId: OWNER_SF1_WINNER,
      teamBId: OWNER_SF2_WINNER,
      status: "lineup_open",
      stage: "knockout",
      scheduleMeta: { stage: "knockout" },
    };
    const roundTrip = normalizeMatchup(JSON.parse(JSON.stringify(persisted)));
    assert.equal(roundTrip.teamAId, OWNER_SF1_WINNER);
    assert.equal(roundTrip.teamBId, OWNER_SF2_WINNER);
    assert.equal(isUnresolvedBracketPlaceholder(roundTrip), false);
  });

  it("C3: same referee assignment is idempotent", () => {
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
      matchup: { teamAId: OWNER_SF1_WINNER, teamBId: OWNER_SF2_WINNER },
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
      matchup: { teamAId: OWNER_SF1_WINNER, teamBId: OWNER_SF2_WINNER },
    });
    assert.equal(applied.ok, true);
    assert.equal(applied.replayed, true);
    assert.equal(applied.liveCount, 1);
  });

  it("C3: A→B referee change is atomic with one current assignment", () => {
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
      matchup: { teamAId: OWNER_SF1_WINNER, teamBId: OWNER_SF2_WINNER },
    });
    assert.equal(applied.ok, true);
    assert.equal(applied.liveCount, 1);
    const live = applied.rows.filter((row) => row.status === "active");
    assert.equal(live.length, 1);
    assert.equal(live[0].refereeUserId, "ref-b");
  });

  it("C3/C4: unique violation maps to domain code, not raw 23505", () => {
    const mapped = mapTeamTournamentDomainFailure({
      code: "23505",
      error:
        'duplicate key value violates unique constraint "referee_assignments_tenant_id_tournament_id_match_id_role_r_key"',
    });
    assert.equal(mapped.code, "REFEREE_ASSIGNMENT_CONFLICT");
    assert.doesNotMatch(mapped.error, /duplicate key/i);
    assert.doesNotMatch(mapped.error, /23505/);
  });

  it("sequential advance of NULL nextSlot SFs does not double-fill slot A", () => {
    const [sf1, sf2] = ownerSemifinals();
    let teamData = ownerTeamData([sf1, sf2, placeholderFinal()]);
    teamData = advanceTeamKnockoutWinner(teamData, "ko-7ebydj8c").teamData;
    teamData = advanceTeamKnockoutWinner(teamData, "ko-fttp83ax").teamData;
    const finalMu = teamData.matchups.find((row) => row.id === "ko-mugj641t");
    assert.equal(finalMu.teamAId, OWNER_SF1_WINNER);
    assert.equal(finalMu.teamBId, OWNER_SF2_WINNER);
  });
});
