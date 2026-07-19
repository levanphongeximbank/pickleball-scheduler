/**
 * Core-05 Phase 1 — Team & Roster management domain tests.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  createTeamRosterService,
  createInMemoryTeamRosterRepository,
  createAllowlistAuthorizationAdapter,
  createDenyAuthorizationAdapter,
  createRuleAdapter,
  createEligibilityAdapter,
  createClassificationAdapter,
  TEAM_ROSTER_AUTH_ACTION,
  TEAM_RUNTIME_ERROR_CODE,
  sortDomainIssues,
  buildTeamIdentityKey,
} from "../src/features/competition-core/teams/index.js";
import { COMPETITION_ROSTER_STATUS } from "../src/features/competition-core/participants/enums/statuses.js";

function person(id) {
  return { kind: "PLAYER_PROFILE", id };
}

function createService(overrides = {}) {
  const repository = createInMemoryTeamRosterRepository();
  const service = createTeamRosterService({
    repository,
    clock: () => "2026-07-20T00:00:00.000Z",
    ...overrides,
  });
  return { service, repository };
}

describe("Core-05 team roster foundation", () => {
  it("creates team with stable identity and empty roster", async () => {
    const { service } = createService();
    const created = await service.createTeam({
      id: "team-a",
      competitionId: "comp-1",
      name: "Alpha",
      tenantId: "tenant-1",
      divisionId: "div-1",
    });
    assert.equal(created.ok, true);
    assert.equal(created.value.team.id, "team-a");
    assert.equal(
      created.value.team.identityKey,
      buildTeamIdentityKey({ competitionId: "comp-1", stableTeamId: "team-a" })
    );
    assert.equal(created.value.roster.teamId, "team-a");
    assert.equal(created.value.roster.rosterVersion, 0);
    assert.equal(created.value.roster.members.length, 0);
  });

  it("enforces tenant isolation when classification requires tenantId", async () => {
    const { service } = createService({
      classification: createClassificationAdapter({ requireTenantId: true }),
    });
    const missing = await service.createTeam({
      id: "team-a",
      competitionId: "comp-1",
      name: "Alpha",
    });
    assert.equal(missing.ok, false);
    assert.equal(missing.code, TEAM_RUNTIME_ERROR_CODE.MISSING_REQUIRED_CONTEXT);
    assert.ok(missing.issues.some((i) => i.path === "tenantId"));
  });

  it("enforces competition isolation on roster", async () => {
    const { service, repository } = createService();
    await service.createTeam({
      id: "team-a",
      competitionId: "comp-1",
      name: "Alpha",
    });
    const roster = await repository.getRosterByTeamId("team-a");
    await repository.saveRoster({ ...roster, competitionId: "other-comp" });
    const validated = await service.validateRoster("team-a");
    assert.equal(validated.ok, false);
    assert.ok(
      validated.issues.some((i) => i.code === TEAM_RUNTIME_ERROR_CODE.COMPETITION_MISMATCH)
    );
  });

  it("enforces division isolation when required", async () => {
    const { service } = createService({
      classification: createClassificationAdapter({ requireDivisionId: true }),
    });
    const missing = await service.createTeam({
      id: "team-a",
      competitionId: "comp-1",
      name: "Alpha",
      tenantId: "t1",
    });
    assert.equal(missing.ok, false);
    assert.ok(missing.issues.some((i) => i.path === "divisionId"));

    const ok = await service.createTeam({
      id: "team-b",
      competitionId: "comp-1",
      name: "Beta",
      divisionId: "div-1",
    });
    assert.equal(ok.ok, true);
  });

  it("prevents duplicate active members and supports idempotent add", async () => {
    const { service } = createService();
    await service.createTeam({
      id: "team-a",
      competitionId: "comp-1",
      name: "Alpha",
      divisionId: "div-1",
      maxSize: 4,
    });
    const first = await service.addRosterMember("team-a", person("p1"));
    assert.equal(first.ok, true);
    assert.equal(first.value.idempotent, false);
    assert.equal(first.value.roster.rosterVersion, 1);

    const second = await service.addRosterMember("team-a", person("p1"));
    assert.equal(second.ok, true);
    assert.equal(second.value.idempotent, true);
    assert.equal(second.value.roster.rosterVersion, 1);
  });

  it("denies cross-team membership by default", async () => {
    const { service } = createService();
    await service.createTeam({
      id: "team-a",
      competitionId: "comp-1",
      name: "Alpha",
      divisionId: "div-1",
    });
    await service.createTeam({
      id: "team-b",
      competitionId: "comp-1",
      name: "Beta",
      divisionId: "div-1",
    });
    await service.addRosterMember("team-a", person("p1"));
    const denied = await service.addRosterMember("team-b", person("p1"));
    assert.equal(denied.ok, false);
    assert.equal(denied.code, TEAM_RUNTIME_ERROR_CODE.CROSS_TEAM_MEMBERSHIP);
  });

  it("allows cross-team membership when rule adapter permits", async () => {
    const { service } = createService({
      rules: createRuleAdapter(async () => true),
    });
    await service.createTeam({
      id: "team-a",
      competitionId: "comp-1",
      name: "Alpha",
      divisionId: "div-1",
    });
    await service.createTeam({
      id: "team-b",
      competitionId: "comp-1",
      name: "Beta",
      divisionId: "div-1",
    });
    await service.addRosterMember("team-a", person("p1"));
    const allowed = await service.addRosterMember("team-b", person("p1"));
    assert.equal(allowed.ok, true);
  });

  it("enforces min and max roster size", async () => {
    const { service } = createService();
    await service.createTeam({
      id: "team-a",
      competitionId: "comp-1",
      name: "Alpha",
      maxSize: 1,
      minSize: 1,
    });
    await service.addRosterMember("team-a", person("p1"));
    const over = await service.addRosterMember("team-a", person("p2"));
    assert.equal(over.ok, false);
    assert.equal(over.code, TEAM_RUNTIME_ERROR_CODE.ROSTER_SIZE_VIOLATION);

    const under = await service.validateRoster("team-a");
    // min satisfied with 1
    assert.equal(under.ok, true);

    await service.createTeam({
      id: "team-b",
      competitionId: "comp-1",
      name: "Beta",
      minSize: 2,
      divisionId: "div-2",
    });
    await service.addRosterMember("team-b", person("p3"));
    const tooSmall = await service.validateRoster("team-b");
    assert.equal(tooSmall.ok, false);
    assert.ok(
      tooSmall.issues.some((i) => i.code === TEAM_RUNTIME_ERROR_CODE.ROSTER_SIZE_VIOLATION)
    );
  });

  it("requires captain to be an active roster member", async () => {
    const { service } = createService();
    await service.createTeam({
      id: "team-a",
      competitionId: "comp-1",
      name: "Alpha",
    });
    await service.addRosterMember("team-a", person("p1"));
    const bad = await service.assignCaptain("team-a", person("p2"));
    assert.equal(bad.ok, false);
    assert.equal(bad.code, TEAM_RUNTIME_ERROR_CODE.CAPTAIN_NOT_ON_ROSTER);

    const ok = await service.assignCaptain("team-a", person("p1"));
    assert.equal(ok.ok, true);
    assert.equal(ok.value.team.captainRef.id, "p1");
  });

  it("clears captain when captain is removed", async () => {
    const { service } = createService();
    await service.createTeam({
      id: "team-a",
      competitionId: "comp-1",
      name: "Alpha",
    });
    await service.addRosterMember("team-a", person("p1"));
    await service.assignCaptain("team-a", person("p1"));
    const removed = await service.removeRosterMember("team-a", person("p1"));
    assert.equal(removed.ok, true);
    assert.equal(removed.value.team.captainRef, null);
  });

  it("blocks membership mutations when roster is locked", async () => {
    const { service } = createService();
    await service.createTeam({
      id: "team-a",
      competitionId: "comp-1",
      name: "Alpha",
      minSize: 1,
    });
    await service.addRosterMember("team-a", person("p1"));
    await service.assignCaptain("team-a", person("p1"));
    const locked = await service.lockRoster("team-a");
    assert.equal(locked.ok, true);
    assert.equal(locked.value.roster.status, COMPETITION_ROSTER_STATUS.ROSTER_LOCKED);

    const blocked = await service.addRosterMember("team-a", person("p2"));
    assert.equal(blocked.ok, false);
    assert.equal(blocked.code, TEAM_RUNTIME_ERROR_CODE.ROSTER_LOCKED);
  });

  it("denies unlock without authorization and allows with TEAM_ROSTER_UNLOCK", async () => {
    const denyService = createService({
      authorization: createDenyAuthorizationAdapter(),
    }).service;
    await denyService.createTeam({
      id: "team-a",
      competitionId: "comp-1",
      name: "Alpha",
      minSize: 1,
    });
    await denyService.addRosterMember("team-a", person("p1"));
    await denyService.assignCaptain("team-a", person("p1"));
    await denyService.lockRoster("team-a");
    const denied = await denyService.unlockRoster("team-a", { actor: "btc" });
    assert.equal(denied.ok, false);
    assert.equal(denied.code, TEAM_RUNTIME_ERROR_CODE.TEAM_ROSTER_UNLOCK_DENIED);

    const { service } = createService({
      authorization: createAllowlistAuthorizationAdapter([
        TEAM_ROSTER_AUTH_ACTION.TEAM_ROSTER_UNLOCK,
      ]),
    });
    await service.createTeam({
      id: "team-b",
      competitionId: "comp-1",
      name: "Beta",
      minSize: 1,
      divisionId: "div-x",
    });
    await service.addRosterMember("team-b", person("p9"));
    await service.assignCaptain("team-b", person("p9"));
    await service.lockRoster("team-b");
    const unlocked = await service.unlockRoster("team-b", { actor: "btc" });
    assert.equal(unlocked.ok, true);
    assert.equal(unlocked.value.roster.status, COMPETITION_ROSTER_STATUS.DRAFT);
  });

  it("requires entryId before activateTeam", async () => {
    const { service } = createService();
    await service.createTeam({
      id: "team-a",
      competitionId: "comp-1",
      name: "Alpha",
    });
    await service.addRosterMember("team-a", person("p1"));
    await service.assignCaptain("team-a", person("p1"));
    const missing = await service.activateTeam("team-a");
    assert.equal(missing.ok, false);
    assert.equal(missing.code, TEAM_RUNTIME_ERROR_CODE.ENTRY_ID_REQUIRED);

    const ok = await service.activateTeam("team-a", { entryId: "entry:team:comp-1:team-a" });
    assert.equal(ok.ok, true);
    assert.equal(ok.value.team.status, "ACTIVE");
    assert.equal(ok.value.team.entryId, "entry:team:comp-1:team-a");
  });

  it("fails closed when eligibility is required", async () => {
    const { service } = createService({
      eligibility: createEligibilityAdapter({
        isRequired: true,
        assertEligible: async () => ({
          ok: false,
          code: TEAM_RUNTIME_ERROR_CODE.ELIGIBILITY_DENIED,
          message: "not eligible",
        }),
      }),
    });
    const created = await service.createTeam({
      id: "team-a",
      competitionId: "comp-1",
      name: "Alpha",
    });
    assert.equal(created.ok, false);
    assert.equal(created.code, TEAM_RUNTIME_ERROR_CODE.ELIGIBILITY_DENIED);
  });

  it("keeps replacement history traceable and bumps rosterVersion", async () => {
    const { service } = createService();
    await service.createTeam({
      id: "team-a",
      competitionId: "comp-1",
      name: "Alpha",
    });
    await service.addRosterMember("team-a", person("p1"));
    const v1 = await service.getRosterVersion("team-a");
    assert.equal(v1.value.rosterVersion, 1);

    const replaced = await service.replaceRosterMember(
      "team-a",
      person("p1"),
      person("p2"),
      { reason: "injury" }
    );
    assert.equal(replaced.ok, true);
    assert.equal(replaced.value.replacedMember.status, "REPLACED");
    assert.equal(replaced.value.replacementMember.replacedMemberId, replaced.value.replacedMember.id);
    assert.equal(replaced.value.replacementMember.replacementReason, "injury");
    assert.ok(replaced.value.roster.amendments.length >= 1);
    assert.equal(replaced.value.roster.rosterVersion, 2);
  });

  it("orders validation issues deterministically", () => {
    const issues = sortDomainIssues([
      { code: "B", path: "z", message: "m2" },
      { code: "A", path: "b", message: "m1" },
      { code: "A", path: "a", message: "m0" },
    ]);
    assert.deepEqual(
      issues.map((i) => `${i.code}:${i.path}`),
      ["A:a", "A:b", "B:z"]
    );
  });

  it("creates deterministic roster snapshots", async () => {
    const { service } = createService();
    await service.createTeam({
      id: "team-a",
      competitionId: "comp-1",
      name: "Alpha",
    });
    await service.addRosterMember("team-a", person("p2"));
    await service.addRosterMember("team-a", person("p1"));
    const snap1 = await service.createRosterSnapshot("team-a", { reason: "freeze" });
    const snap2 = await service.createRosterSnapshot("team-a", { reason: "freeze" });
    assert.equal(snap1.ok, true);
    assert.deepEqual(snap1.value.memberIds, snap2.value.memberIds);
    assert.equal(snap1.value.contentHash, snap2.value.contentHash);
    assert.equal(snap1.value.rosterVersion, snap2.value.rosterVersion);
  });

  it("lists teams and returns active roster", async () => {
    const { service } = createService();
    await service.createTeam({
      id: "team-b",
      competitionId: "comp-1",
      name: "Beta",
      divisionId: "div-1",
    });
    await service.createTeam({
      id: "team-a",
      competitionId: "comp-1",
      name: "Alpha",
      divisionId: "div-1",
    });
    await service.addRosterMember("team-a", person("p1"));
    const listed = await service.listTeams({ competitionId: "comp-1" });
    assert.equal(listed.ok, true);
    assert.deepEqual(
      listed.value.map((t) => t.id),
      ["team-a", "team-b"]
    );
    const active = await service.getActiveRoster("team-a");
    assert.equal(active.ok, true);
    assert.equal(active.value.activeMembers.length, 1);
  });
});
