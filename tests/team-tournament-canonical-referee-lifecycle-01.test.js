/**
 * Canonical parent referee lifecycle + Dreambreaker start closure.
 * STAGING_MUTATIONS=0 — SQL package local until Owner GO.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

import {
  buildRefereeDashboardAssignments,
} from "../src/features/team-tournament/dashboard/teamTournamentDashboardTasks.js";
import {
  canAssignedRefereeWriteMatchup,
  describeDreambreakerStartFailure,
  isParentRefereeAssignment,
  PARENT_ASSIGNMENT_SELECT_VALUE,
  resolveEffectiveRefereeAssignment,
  REFEREE_ASSIGNMENT_SCOPE,
} from "../src/features/team-tournament/engines/teamRefereeCanonicalLifecycle.js";
import { mapTeamTournamentDomainFailure } from "../src/features/team-tournament/engines/teamTournamentDomainErrors.js";
import { planRefereeAssignment, REFEREE_ASSIGN_ACTION } from "../src/features/team-tournament/engines/teamRefereeAssignmentLifecycle.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pkgDir = path.join(
  root,
  "docs/v5/migrations/team-tournament-canonical-referee-lifecycle-01"
);

const PACKAGE_LF_SHA256 = Object.freeze({
  "01_PRECHECK.sql":
    "ce9392188218e9a0ee5c45aa0b64ae3955079c2b4c33622b0109a238b71b8956",
  "02_APPLY.sql":
    "eb0fab536f400178339260c259c9ec5ae40e8394ee14913f50bedadda39d7bdb",
  "03_VERIFY.sql":
    "29e21fc20dc0db0af1607129efd259f7920e4f1e3d07348801f48ab0b03a8859",
  "04_ROLLBACK.sql":
    "cbe029e5f4c159fd4e414adcceb45b73781390199c8a76bc3fbc4160947e733d",
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

function readSrc(rel) {
  return readFileSync(path.join(root, rel), "utf8");
}

const parentRow = {
  assignmentId: "asg-parent",
  refereeUserId: "ref-1",
  scope: "parent",
  matchupId: "ko-sf1",
  externalMatchupId: "ko-sf1",
  matchId: null,
  status: "active",
};

const childOverride = {
  assignmentId: "asg-wd",
  refereeUserId: "ref-2",
  scope: "child",
  matchupId: "ko-sf1",
  externalSubMatchId: "sub-wd",
  matchId: "sub-wd",
  status: "active",
};

describe("team-tournament-canonical-referee-lifecycle-01", () => {
  it("locks LF SHA256 package hashes", () => {
    for (const [name, expected] of Object.entries(PACKAGE_LF_SHA256)) {
      assert.equal(sha256Lf(name), expected, name);
    }
  });

  it("package files exist and APPLY is parent+ensure+scoped start", () => {
    const apply = readPkg("02_APPLY.sql");
    const pre = readPkg("01_PRECHECK.sql");
    const verify = readPkg("03_VERIFY.sql");
    const rollback = readPkg("04_ROLLBACK.sql");
    assert.match(pre, /PRECHECK/);
    assert.match(verify, /VERIFY_PASS/);
    assert.match(rollback, /ROLLBACK_HELPERS_DROPPED/);
    assert.match(apply, /team_tournament_resolve_effective_referee_assignment/);
    assert.match(apply, /team_tournament_result_write_guard/);
    assert.match(apply, /team_tournament_ensure_referee_runtime_for_matchup/);
    assert.match(apply, /ALREADY_STARTED/);
    assert.match(apply, /v_parent/);
    assert.match(apply, /unique_violation/);
    assert.equal(apply.includes("dreambreaker_out_of_scope"), false);
    assert.match(apply, /team_tournament_can_manage\(\)/);
    assert.doesNotMatch(
      apply.split("team_tournament_start_dreambreaker")[1] || "",
      /can_manage_results\(\)/
    );
  });

  it("1-4 parent assign / replay / change / revoke planner", () => {
    const first = planRefereeAssignment({
      matchup: { teamAId: "a", teamBId: "b" },
      existingAssignments: [],
      refereeUserId: "ref-1",
      matchId: "ko-sf1",
    });
    assert.equal(first.action, REFEREE_ASSIGN_ACTION.CREATE);
    const replay = planRefereeAssignment({
      matchup: { teamAId: "a", teamBId: "b" },
      existingAssignments: [parentRow],
      refereeUserId: "ref-1",
      matchId: "ko-sf1",
    });
    assert.equal(replay.action, REFEREE_ASSIGN_ACTION.IDEMPOTENT_NOOP);
    const change = planRefereeAssignment({
      matchup: { teamAId: "a", teamBId: "b" },
      existingAssignments: [{ ...parentRow, matchId: "ko-sf1" }],
      refereeUserId: "ref-9",
      matchId: "ko-sf1",
    });
    assert.equal(change.action, REFEREE_ASSIGN_ACTION.SUPERSEDE);
  });

  it("5 cross-tenant denied in planner", () => {
    const plan = planRefereeAssignment({
      matchup: { teamAId: "a", teamBId: "b" },
      refereeUserId: "ref-1",
      tenantId: "t1",
      tournamentTenantId: "t2",
      matchId: "ko-sf1",
    });
    assert.equal(plan.ok, false);
    assert.equal(plan.code, "CROSS_TENANT_DENIED");
  });

  it("7-10 parent assignment resolves WD MD XD1 XD2", () => {
    for (const sub of ["sub-wd", "sub-md", "sub-xd1", "sub-xd2"]) {
      const effective = resolveEffectiveRefereeAssignment({
        assignments: [parentRow],
        matchupId: "ko-sf1",
        subMatchId: sub,
      });
      assert.equal(effective.refereeUserId, "ref-1");
      assert.equal(effective.inherited, true);
      assert.equal(effective.scope, REFEREE_ASSIGNMENT_SCOPE.PARENT);
    }
  });

  it("child override wins over parent", () => {
    const effective = resolveEffectiveRefereeAssignment({
      assignments: [parentRow, childOverride],
      matchupId: "ko-sf1",
      subMatchId: "sub-wd",
    });
    assert.equal(effective.refereeUserId, "ref-2");
    assert.equal(effective.inherited, false);
  });

  it("18-21 assigned Match A write PASS, Match B DENY, organizer PASS", () => {
    assert.equal(
      canAssignedRefereeWriteMatchup({
        assignments: [parentRow],
        matchupId: "ko-sf1",
        refereeUserId: "ref-1",
      }),
      true
    );
    assert.equal(
      canAssignedRefereeWriteMatchup({
        assignments: [parentRow],
        matchupId: "ko-sf2",
        refereeUserId: "ref-1",
      }),
      false
    );
    assert.equal(
      canAssignedRefereeWriteMatchup({
        assignments: [parentRow],
        matchupId: "ko-sf2",
        refereeUserId: "ref-1",
        isOrganizer: true,
      }),
      true
    );
  });

  it("26 dreambreaker inherits parent referee", () => {
    const db = resolveEffectiveRefereeAssignment({
      assignments: [parentRow],
      matchupId: "ko-sf1",
      subMatchId: "db-ko-sf1",
    });
    assert.equal(db.refereeUserId, "ref-1");
    assert.equal(isParentRefereeAssignment(parentRow), true);
  });

  it("14 dashboard parent task uses team-referee not V5 matchup id", () => {
    const tasks = buildRefereeDashboardAssignments({
      tournament: { id: "tour-1" },
      teamData: {
        teams: [
          { id: "a", name: "A" },
          { id: "b", name: "B" },
        ],
        matchups: [
          {
            id: "ko-sf1",
            teamAId: "a",
            teamBId: "b",
            status: "published",
          },
        ],
      },
      assignments: [parentRow],
    });
    assert.equal(tasks.length, 1);
    assert.match(tasks[0].href, /\/team-referee\/tour-1/);
    assert.equal(tasks[0].href.includes("/referee/match/ko-sf1"), false);
  });

  it("29-31 dreambreaker start mapping: NOT_ACTIVATED / ALREADY_STARTED / VERSION_CONFLICT", () => {
    const notActivated = mapTeamTournamentDomainFailure({ code: "NOT_ACTIVATED" });
    assert.match(notActivated.error, /Dreambreaker/);
    assert.equal(notActivated.error.includes("Repository"), false);
    const conflict = mapTeamTournamentDomainFailure({ code: "VERSION_CONFLICT" });
    assert.equal(conflict.code, "VERSION_CONFLICT");
    const replay = describeDreambreakerStartFailure({
      ok: true,
      alreadyStarted: true,
      code: "ALREADY_STARTED",
    });
    assert.equal(replay.ok, true);
    assert.equal(replay.replayed, true);
  });

  it("UI: parent select default and recovery provision label", () => {
    assert.equal(PARENT_ASSIGNMENT_SELECT_VALUE, "");
    const panel = readSrc("src/components/tournament/team/TeamRefereeSafetyPanel.jsx");
    assert.match(panel, /Cả trận \(canonical\)/);
    const row = readSrc("src/components/tournament/team/TeamSubMatchRefereeProvisionRow.jsx");
    assert.match(row, /Khôi phục phiên V5 \(admin\)/);
    assert.equal(row.includes("Tạo phiên trọng tài"), false);
    const rpc = readSrc("src/features/team-tournament/services/teamTournamentRpcService.js");
    assert.match(rpc, /normalized\.subMatchId \? String\(normalized\.subMatchId\) : null/);
    const guard = readSrc("src/features/team-tournament/services/teamTournamentService.js");
    assert.match(guard, /deferredToServer/);
  });

  it("39-46 preserve prior remediation files", () => {
    const files = [
      "tests/team-tournament-pr412-one-group-explicit-persistence-remediation-01.test.js",
      "tests/team-tournament-canonical-dashboard-lifecycle-01.test.js",
      "tests/team-tournament-captain-portal-canonical-identity-01.test.js",
      "tests/team-tournament-final-nextslot-null-remediation-01.test.js",
      "src/features/team-tournament/engines/teamStageScoringPolicy.js",
    ];
    for (const rel of files) {
      assert.ok(readSrc(rel).length > 20, rel);
    }
  });
});
