/**
 * CORE-13 canonical assignment runtime closure — targeted regression suite.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  ASSIGNMENT_COMMAND,
  ASSIGNMENT_COMMAND_ERROR_CODE,
  ASSIGNMENT_COMPETITION_MODE,
  ASSIGNMENT_LIFECYCLE_STATE,
  CORE13_CANONICAL_ASSIGNMENT_RUNTIME,
  createCompetitionRefereeAssignmentCommandService,
  createInMemoryCanonicalAssignmentPersistence,
  createModeAssignmentCommandBridge,
  evaluateAssignmentLifecycleGate,
  isCompetitionRefereeAssignmentCommandError,
} from "../src/features/competition-engine/operations/referee/assignment/index.js";
import {
  LEGACY_INDIVIDUAL_ASSIGNMENT_AUTHORITY,
  assignRefereeToIndividualMatch,
} from "../src/features/individual-tournament/engines/refereeAssignEngine.js";
import {
  LEGACY_TEAM_BLOB_ASSIGNMENT_AUTHORITY,
  assignReferee as assignTeamBlobReferee,
} from "../src/features/team-tournament/engines/refereeAssignEngine.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function baseCommand(overrides = {}) {
  return {
    tenantId: "tenant-a",
    tournamentId: "tourn-a",
    matchId: "match-1",
    refereeId: "ref-001",
    actorId: "actor-1",
    expectedVersion: 0,
    idempotencyKey: `idem-${Math.random().toString(16).slice(2)}`,
    lifecycleState: ASSIGNMENT_LIFECYCLE_STATE.PRE_MATCH,
    authorizedTenantId: "tenant-a",
    authorizedTournamentId: "tourn-a",
    ...overrides,
  };
}

function createService() {
  const persistence = createInMemoryCanonicalAssignmentPersistence({
    clockIso: "2026-08-17T12:00:00.000Z",
  });
  return createCompetitionRefereeAssignmentCommandService({
    persistence,
    production: false,
  });
}

test("runtime lock constants", () => {
  assert.equal(CORE13_CANONICAL_ASSIGNMENT_RUNTIME.assignmentAuthority, "CORE-13");
  assert.equal(CORE13_CANONICAL_ASSIGNMENT_RUNTIME.adapterBAuthority, "TRANSLATION_ONLY");
  assert.equal(CORE13_CANONICAL_ASSIGNMENT_RUNTIME.contract08Changed, false);
  assert.equal(CORE13_CANONICAL_ASSIGNMENT_RUNTIME.seedAssignmentsBypass, false);
  assert.equal(CORE13_CANONICAL_ASSIGNMENT_RUNTIME.inMemoryProductionFallback, false);
});

test("authority: assign calls CORE-13 and persists", async () => {
  const service = createService();
  const result = await service.assignReferee(baseCommand());
  assert.equal(result.ok, true);
  assert.equal(result.core13Decision, "ACCEPT");
  assert.equal(result.assignment.refereeId, "ref-001");
  assert.equal(result.assignment.version, 1);
  assert.ok(result.audit);
});

test("seedAssignments cannot bypass CORE-13", async () => {
  const service = createService();
  await assert.rejects(
    () =>
      service.seedAssignmentsThroughCore13({
        tenantId: "tenant-a",
        tournamentId: "tourn-a",
        actorId: "actor-1",
        allowCore13Bypass: true,
        assignments: [{ matchId: "m1", refereeId: "r1" }],
      }),
    (err) =>
      isCompetitionRefereeAssignmentCommandError(err) &&
      err.code === ASSIGNMENT_COMMAND_ERROR_CODE.SEED_BYPASS_DENIED
  );
});

test("legacy individual writer neutralized", () => {
  assert.equal(LEGACY_INDIVIDUAL_ASSIGNMENT_AUTHORITY.productWriters, 0);
  const result = assignRefereeToIndividualMatch({}, "m1", "r1", {});
  assert.equal(result.ok, false);
  assert.equal(result.code, "LEGACY_ASSIGNMENT_AUTHORITY_RETIRED");
});

test("legacy team blob writer neutralized", () => {
  assert.equal(LEGACY_TEAM_BLOB_ASSIGNMENT_AUTHORITY.productWriters, 0);
  const result = assignTeamBlobReferee({ settings: {}, matchups: [{ id: "m1" }] }, "m1", "r1");
  assert.equal(result.ok, false);
  assert.equal(result.code, "LEGACY_ASSIGNMENT_AUTHORITY_RETIRED");
});

test("lifecycle PRE_MATCH allow assign/replace/unassign", () => {
  for (const command of [
    ASSIGNMENT_COMMAND.ASSIGN,
    ASSIGNMENT_COMMAND.REPLACE,
    ASSIGNMENT_COMMAND.UNASSIGN,
  ]) {
    const gate = evaluateAssignmentLifecycleGate({
      command,
      lifecycleState: ASSIGNMENT_LIFECYCLE_STATE.PRE_MATCH,
    });
    assert.equal(gate.allowed, true, command);
  }
});

test("lifecycle IN_PROGRESS policies", async () => {
  const denyAssign = evaluateAssignmentLifecycleGate({
    command: ASSIGNMENT_COMMAND.ASSIGN,
    lifecycleState: ASSIGNMENT_LIFECYCLE_STATE.IN_PROGRESS,
  });
  assert.equal(denyAssign.allowed, false);

  const denyUnassign = evaluateAssignmentLifecycleGate({
    command: ASSIGNMENT_COMMAND.UNASSIGN,
    lifecycleState: ASSIGNMENT_LIFECYCLE_STATE.IN_PROGRESS,
  });
  assert.equal(denyUnassign.allowed, false);
  assert.equal(
    denyUnassign.code,
    ASSIGNMENT_COMMAND_ERROR_CODE.UNASSIGN_WITHOUT_REPLACEMENT_DENIED
  );

  const allowReplace = evaluateAssignmentLifecycleGate({
    command: ASSIGNMENT_COMMAND.REPLACE,
    lifecycleState: ASSIGNMENT_LIFECYCLE_STATE.IN_PROGRESS,
  });
  assert.equal(allowReplace.allowed, true);

  const service = createService();
  await service.assignReferee(baseCommand({ idempotencyKey: "lc-assign" }));
  const replaced = await service.replaceReferee(
    baseCommand({
      matchId: "match-1",
      newRefereeId: "ref-002",
      expectedVersion: 1,
      idempotencyKey: "lc-replace",
      lifecycleState: ASSIGNMENT_LIFECYCLE_STATE.IN_PROGRESS,
      candidates: [
        { refereeId: "ref-001", active: true },
        { refereeId: "ref-002", active: true },
      ],
    })
  );
  assert.equal(replaced.ok, true);
  assert.equal(replaced.assignment.refereeId, "ref-002");
  assert.equal(replaced.assignment.version, 2);
});

test("lifecycle SCORING_ACTIVE requires emergency replacement", async () => {
  const normal = evaluateAssignmentLifecycleGate({
    command: ASSIGNMENT_COMMAND.REPLACE,
    lifecycleState: ASSIGNMENT_LIFECYCLE_STATE.SCORING_ACTIVE,
    emergencyReplacement: false,
  });
  assert.equal(normal.allowed, false);
  assert.equal(
    normal.code,
    ASSIGNMENT_COMMAND_ERROR_CODE.EMERGENCY_REPLACEMENT_REQUIRED
  );

  const unauthorized = evaluateAssignmentLifecycleGate({
    command: ASSIGNMENT_COMMAND.REPLACE,
    lifecycleState: ASSIGNMENT_LIFECYCLE_STATE.SCORING_ACTIVE,
    emergencyReplacement: true,
    emergencyAuthorized: false,
  });
  assert.equal(unauthorized.allowed, false);

  const emergency = evaluateAssignmentLifecycleGate({
    command: ASSIGNMENT_COMMAND.REPLACE,
    lifecycleState: ASSIGNMENT_LIFECYCLE_STATE.SCORING_ACTIVE,
    emergencyReplacement: true,
    emergencyAuthorized: true,
  });
  assert.equal(emergency.allowed, true);

  const service = createService();
  await service.assignReferee(baseCommand({ idempotencyKey: "sc-assign" }));
  const result = await service.replaceReferee(
    baseCommand({
      newRefereeId: "ref-009",
      expectedVersion: 1,
      idempotencyKey: "sc-emergency",
      lifecycleState: ASSIGNMENT_LIFECYCLE_STATE.SCORING_ACTIVE,
      emergencyReplacement: true,
      emergencyAuthorized: true,
      candidates: [
        { refereeId: "ref-001", active: true },
        { refereeId: "ref-009", active: true },
      ],
    })
  );
  assert.equal(result.ok, true);
  assert.match(result.lifecyclePolicy, /EMERGENCY/);
});

test("lifecycle LOCKED and COMPLETED deny all", () => {
  for (const lifecycleState of [
    ASSIGNMENT_LIFECYCLE_STATE.LOCKED,
    ASSIGNMENT_LIFECYCLE_STATE.COMPLETED,
  ]) {
    for (const command of Object.values(ASSIGNMENT_COMMAND)) {
      const gate = evaluateAssignmentLifecycleGate({ command, lifecycleState });
      assert.equal(gate.allowed, false, `${lifecycleState}:${command}`);
    }
  }
});

test("CAS: correct expectedVersion passes; stale fails", async () => {
  const service = createService();
  await service.assignReferee(baseCommand({ idempotencyKey: "cas-1" }));
  await assert.rejects(
    () =>
      service.replaceReferee(
        baseCommand({
          newRefereeId: "ref-002",
          expectedVersion: 0,
          idempotencyKey: "cas-stale",
          candidates: [
            { refereeId: "ref-001", active: true },
            { refereeId: "ref-002", active: true },
          ],
        })
      ),
    (err) => err.code === ASSIGNMENT_COMMAND_ERROR_CODE.STALE_WRITE
  );
  const ok = await service.replaceReferee(
    baseCommand({
      newRefereeId: "ref-002",
      expectedVersion: 1,
      idempotencyKey: "cas-ok",
      candidates: [
        { refereeId: "ref-001", active: true },
        { refereeId: "ref-002", active: true },
      ],
    })
  );
  assert.equal(ok.assignment.version, 2);
});

test("concurrent replace: one winner, stale loser", async () => {
  const service = createService();
  await service.assignReferee(baseCommand({ idempotencyKey: "conc-0" }));
  const p1 = service.replaceReferee(
    baseCommand({
      newRefereeId: "ref-a",
      expectedVersion: 1,
      idempotencyKey: "conc-a",
      candidates: [
        { refereeId: "ref-001", active: true },
        { refereeId: "ref-a", active: true },
      ],
    })
  );
  const p2 = service.replaceReferee(
    baseCommand({
      newRefereeId: "ref-b",
      expectedVersion: 1,
      idempotencyKey: "conc-b",
      candidates: [
        { refereeId: "ref-001", active: true },
        { refereeId: "ref-b", active: true },
      ],
    })
  );
  const settled = await Promise.allSettled([p1, p2]);
  const fulfilled = settled.filter((s) => s.status === "fulfilled");
  const rejected = settled.filter((s) => s.status === "rejected");
  assert.equal(fulfilled.length, 1);
  assert.equal(rejected.length, 1);
  assert.equal(
    rejected[0].reason.code,
    ASSIGNMENT_COMMAND_ERROR_CODE.STALE_WRITE
  );
});

test("idempotency: duplicate assign/replace/unassign + conflicting payload", async () => {
  const service = createService();
  const key = "idem-assign-1";
  const first = await service.assignReferee(
    baseCommand({ idempotencyKey: key, refereeId: "ref-001" })
  );
  const second = await service.assignReferee(
    baseCommand({ idempotencyKey: key, refereeId: "ref-001", expectedVersion: 0 })
  );
  assert.equal(second.replayed, true);
  assert.equal(second.assignment.assignmentId, first.assignment.assignmentId);

  await assert.rejects(
    () =>
      service.assignReferee(
        baseCommand({
          idempotencyKey: key,
          refereeId: "ref-OTHER",
          expectedVersion: 0,
        })
      ),
    (err) => err.code === ASSIGNMENT_COMMAND_ERROR_CODE.IDEMPOTENCY_CONFLICT
  );

  const replaceKey = "idem-replace-1";
  const replaced = await service.replaceReferee(
    baseCommand({
      newRefereeId: "ref-002",
      expectedVersion: 1,
      idempotencyKey: replaceKey,
      candidates: [
        { refereeId: "ref-001", active: true },
        { refereeId: "ref-002", active: true },
      ],
    })
  );
  const replacedAgain = await service.replaceReferee(
    baseCommand({
      newRefereeId: "ref-002",
      expectedVersion: 1,
      idempotencyKey: replaceKey,
      candidates: [
        { refereeId: "ref-001", active: true },
        { refereeId: "ref-002", active: true },
      ],
    })
  );
  assert.equal(replacedAgain.replayed, true);
  assert.equal(
    replacedAgain.assignment.assignmentId,
    replaced.assignment.assignmentId
  );

  const unKey = "idem-unassign-1";
  const un1 = await service.unassignReferee(
    baseCommand({
      expectedVersion: 2,
      idempotencyKey: unKey,
      reason: "done",
    })
  );
  const un2 = await service.unassignReferee(
    baseCommand({
      expectedVersion: 2,
      idempotencyKey: unKey,
      reason: "done",
    })
  );
  assert.equal(un1.ok, true);
  assert.equal(un2.replayed, true);
});

test("identity/security: canonical refereeId + cross-tenant/tournament + unauthorized", async () => {
  const service = createService();
  await assert.rejects(
    () => service.assignReferee(baseCommand({ refereeId: "a@b.com" })),
    (err) => err.code === ASSIGNMENT_COMMAND_ERROR_CODE.EMAIL_AS_AUTHORITY_DENIED
  );
  await assert.rejects(
    () => service.assignReferee(baseCommand({ refereeId: "+84901234567" })),
    (err) => err.code === ASSIGNMENT_COMMAND_ERROR_CODE.PHONE_AS_AUTHORITY_DENIED
  );
  await assert.rejects(
    () => service.assignReferee(baseCommand({ refereeId: "Nguyen Van A" })),
    (err) => err.code === ASSIGNMENT_COMMAND_ERROR_CODE.DISPLAY_NAME_IDENTITY_DENIED
  );
  await assert.rejects(
    () =>
      service.assignReferee(
        baseCommand({
          authorizedTenantId: "other-tenant",
          idempotencyKey: "x-tenant",
        })
      ),
    (err) => err.code === ASSIGNMENT_COMMAND_ERROR_CODE.CROSS_TENANT_DENIED
  );
  await assert.rejects(
    () =>
      service.assignReferee(
        baseCommand({
          authorizedTournamentId: "other-tourn",
          idempotencyKey: "x-tourn",
        })
      ),
    (err) => err.code === ASSIGNMENT_COMMAND_ERROR_CODE.CROSS_TOURNAMENT_DENIED
  );
  await assert.rejects(
    () =>
      service.assignReferee(
        baseCommand({
          clientGrantedPermissions: ["referee.assign"],
          idempotencyKey: "client-grant",
        })
      ),
    (err) => err.code === ASSIGNMENT_COMMAND_ERROR_CODE.CLIENT_GRANT_TRUST_REJECTED
  );
  await assert.rejects(
    () =>
      service.assignReferee(
        baseCommand({ actorId: "", idempotencyKey: "no-actor" })
      ),
    (err) => err.code === ASSIGNMENT_COMMAND_ERROR_CODE.UNAUTHORIZED_ACTOR
  );
});

test("mode adoption bridges bind CORE-13", async () => {
  const persistence = createInMemoryCanonicalAssignmentPersistence();
  const service = createCompetitionRefereeAssignmentCommandService({
    persistence,
  });
  for (const mode of [
    ASSIGNMENT_COMPETITION_MODE.INTERNAL,
    ASSIGNMENT_COMPETITION_MODE.OFFICIAL_OPEN,
    ASSIGNMENT_COMPETITION_MODE.TEAM,
  ]) {
    const bridge = createModeAssignmentCommandBridge({
      commandService: service,
      competitionMode: mode,
    });
    assert.equal(bridge.core13Bound, true);
    assert.equal(bridge.legacyWriterStatus.PRODUCT_WRITERS, 0);
  }

  const dailyOff = createModeAssignmentCommandBridge({
    commandService: service,
    competitionMode: ASSIGNMENT_COMPETITION_MODE.DAILY_PLAY,
  });
  await assert.rejects(
    () =>
      dailyOff.assignReferee(
        baseCommand({ refereeFeatureEnabled: false, idempotencyKey: "daily-off" })
      ),
    (err) => err.code === ASSIGNMENT_COMMAND_ERROR_CODE.DAILY_PLAY_NOT_APPLICABLE
  );

  const dailyOn = createModeAssignmentCommandBridge({
    commandService: service,
    competitionMode: ASSIGNMENT_COMPETITION_MODE.DAILY_PLAY,
  });
  const assigned = await dailyOn.assignReferee(
    baseCommand({
      matchId: "daily-1",
      refereeFeatureEnabled: true,
      idempotencyKey: "daily-on",
    })
  );
  assert.equal(assigned.ok, true);
});

test("production forbids in-memory persistence", () => {
  const persistence = createInMemoryCanonicalAssignmentPersistence();
  assert.throws(
    () =>
      createCompetitionRefereeAssignmentCommandService({
        persistence,
        production: true,
      }),
    (err) =>
      err.code === ASSIGNMENT_COMMAND_ERROR_CODE.IN_MEMORY_PRODUCTION_FORBIDDEN
  );
});

test("architecture guards: SQL package authored; Contract #08 untouched", () => {
  const sqlDir = path.join(
    ROOT,
    "docs/v5/migrations/core13-canonical-assignment-runtime-closure-01"
  );
  for (const file of [
    "README.md",
    "01_PRECHECK.sql",
    "02_APPLY.sql",
    "03_VERIFY.sql",
    "04_ROLLBACK.sql",
  ]) {
    assert.equal(existsSync(path.join(sqlDir, file)), true, file);
  }
  const apply = readFileSync(path.join(sqlDir, "02_APPLY.sql"), "utf8");
  assert.match(apply, /competition_assign_referee/);
  assert.match(apply, /competition_replace_referee/);
  assert.match(apply, /competition_unassign_referee/);
  assert.match(apply, /competition_referee_assignment_audit/);
  assert.match(apply, /STALE_WRITE|stale/i);

  const contract = readFileSync(
    path.join(
      ROOT,
      "src/features/competition-engine/integration/referee/constants.js"
    ),
    "utf8"
  );
  assert.match(contract, /competition\.referee\.adapter\.v1/);

  // Panel cutover evidence
  const panel = readFileSync(
    path.join(ROOT, "src/components/tournament/RefereeAssignPanel.jsx"),
    "utf8"
  );
  assert.match(panel, /createCompetitionRefereeAssignmentCommandService/);
  assert.doesNotMatch(panel, /assignRefereeToIndividualMatch/);

  const teamPanel = readFileSync(
    path.join(ROOT, "src/components/tournament/team/TeamRefereeSafetyPanel.jsx"),
    "utf8"
  );
  assert.match(teamPanel, /assignTeamRefereeViaCore13/);
  assert.doesNotMatch(teamPanel, /planRefereeAssignment/);
});

test("architecture guard: no product UI import of neutralized writers as authority", () => {
  const uiRoots = [
    path.join(ROOT, "src/components/tournament"),
    path.join(ROOT, "src/pages/tournament"),
  ];
  const forbidden = [
    /assignRefereeToIndividualMatch/,
    /unassignRefereeFromMatch/,
    /from\s+['"].*team-tournament\/engines\/refereeAssignEngine/,
  ];
  function walk(dir) {
    if (!existsSync(dir)) return [];
    const out = [];
    for (const name of readdirSync(dir)) {
      const full = path.join(dir, name);
      const st = statSync(full);
      if (st.isDirectory()) out.push(...walk(full));
      else if (/\.(js|jsx)$/.test(name)) out.push(full);
    }
    return out;
  }
  for (const file of uiRoots.flatMap(walk)) {
    const content = readFileSync(file, "utf8");
    for (const pattern of forbidden) {
      assert.doesNotMatch(
        content,
        pattern,
        `forbidden legacy writer import in ${path.relative(ROOT, file)}`
      );
    }
  }
});
