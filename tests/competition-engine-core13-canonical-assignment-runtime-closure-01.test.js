/**
 * CORE-13 canonical assignment runtime closure — targeted regression suite.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { createHash } from "node:crypto";
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
const SQL_PKG = path.join(
  ROOT,
  "docs/v5/migrations/core13-canonical-assignment-runtime-closure-01"
);

const PACKAGE_LF_SHA256 = Object.freeze({
  "01_PRECHECK.sql":
    "c2879ba0a4a123c7b328a58bb98d3e16d6ed95a11ef06b6846bb3fd138a8fa25",
  "02_APPLY.sql":
    "4a98aa8c66491d4e2ee2c939118b6cf327f2a52e1248d2e5ed47f9b3d87f9ed3",
  "03_VERIFY.sql":
    "b4886d61e9b7ec5a4e67afd81f96d50ae4447b30e8857b00026e45df7d401194",
  "04_ROLLBACK.sql":
    "0b33233fcb7d51d4781d4a214c32a68737dd9367d53ae5e014bf42e5e5a73209",
  "05_STAGING_SQL_ACCEPTANCE.sql":
    "661504f517e8bf4cda1988caa551bb56d317247e2628dadcf4dbfcd224cfee48",
  "06_STAGING_SURGICAL_LIFECYCLE_SCORING_PARITY.sql":
    "35d418dba34fab93ba0e20d944feb1250d496ea522e92b199c27b62da51777b8",
  "07_STAGING_SURGICAL_LIFECYCLE_SCORING_PARITY_ROLLBACK.sql":
    "638bce12d3b03eb2aa80fe1acb5c7605e21b5833e26c997fe24e8d783de8d66e",
});

function sha256Lf(name) {
  const raw = readFileSync(path.join(SQL_PKG, name));
  const lf = Buffer.from(
    raw.toString("utf8").replace(/\r\n/g, "\n").replace(/\r/g, "\n")
  );
  return createHash("sha256").update(lf).digest("hex");
}

function readSql(name) {
  return readFileSync(path.join(SQL_PKG, name), "utf8");
}

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
  assert.equal(CORE13_CANONICAL_ASSIGNMENT_RUNTIME.adapterBServerReuse, true);
  assert.equal(CORE13_CANONICAL_ASSIGNMENT_RUNTIME.contract08Changed, false);
  assert.equal(CORE13_CANONICAL_ASSIGNMENT_RUNTIME.seedAssignmentsBypass, false);
  assert.equal(CORE13_CANONICAL_ASSIGNMENT_RUNTIME.inMemoryProductionFallback, false);
  assert.equal(CORE13_CANONICAL_ASSIGNMENT_RUNTIME.authoritativeExecutionLocation, "TRUSTED_SERVER");
  assert.equal(CORE13_CANONICAL_ASSIGNMENT_RUNTIME.authenticatedDirectRpcExecute, "DENY");
  assert.equal(CORE13_CANONICAL_ASSIGNMENT_RUNTIME.interimBlobAuthorityPostCutover, false);
  assert.equal(CORE13_CANONICAL_ASSIGNMENT_RUNTIME.hardcodedScheduleWindow, false);
  assert.equal(CORE13_CANONICAL_ASSIGNMENT_RUNTIME.refereeQualificationEvidence, "NOT_CONFIGURED");
  assert.equal(CORE13_CANONICAL_ASSIGNMENT_RUNTIME.identityContract01Changed, false);
  assert.equal(CORE13_CANONICAL_ASSIGNMENT_RUNTIME.directIdentityTableReadFromCompetition, false);
  assert.equal(CORE13_CANONICAL_ASSIGNMENT_RUNTIME.sharedContractCapabilityGap, false);
  assert.equal(CORE13_CANONICAL_ASSIGNMENT_RUNTIME.contractGapId, null);
  assert.equal(
    CORE13_CANONICAL_ASSIGNMENT_RUNTIME.identitySubjectDirectoryCapability,
    "RESOLVE_SUBJECT_IDENTITY"
  );
  assert.equal(CORE13_CANONICAL_ASSIGNMENT_RUNTIME.contract01ResolveSubjectIdentity, "BOUND");
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
    "05_STAGING_SQL_ACCEPTANCE.sql",
    "06_STAGING_SURGICAL_LIFECYCLE_SCORING_PARITY.sql",
    "07_STAGING_SURGICAL_LIFECYCLE_SCORING_PARITY_ROLLBACK.sql",
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

  const determinism = readFileSync(
    path.join(
      ROOT,
      "docs/competition-engine/core-13/02_DETERMINISM_POLICY.md"
    ),
    "utf8"
  );
  assert.match(determinism, /CORE-13/);

  // Panel cutover evidence
  const panel = readFileSync(
    path.join(ROOT, "src/components/tournament/RefereeAssignPanel.jsx"),
    "utf8"
  );
  assert.match(panel, /createCompetitionRefereeAssignmentTrustedClient/);
  assert.doesNotMatch(panel, /createBlobCanonicalAssignmentPersistence/);
  assert.doesNotMatch(panel, /createCompetitionRefereeAssignmentCommandService/);
  assert.doesNotMatch(panel, /assignRefereeToIndividualMatch/);

  const teamPanel = readFileSync(
    path.join(ROOT, "src/components/tournament/team/TeamRefereeSafetyPanel.jsx"),
    "utf8"
  );
  assert.match(teamPanel, /assignTeamRefereeViaCore13/);
  assert.doesNotMatch(teamPanel, /planRefereeAssignment/);
  assert.doesNotMatch(teamPanel, /rpcTeamTournamentRevokeRefereeAssignment/);
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

test("SQL package LF SHA256 lock", () => {
  for (const [name, expected] of Object.entries(PACKAGE_LF_SHA256)) {
    assert.equal(sha256Lf(name), expected, name);
  }
  const readme = readSql("README.md");
  for (const [name, expected] of Object.entries(PACKAGE_LF_SHA256)) {
    assert.match(readme, new RegExp(expected));
    assert.match(readme, new RegExp(name.replace(".", "\\.")));
  }
});

test("SQL security: actor spoofing closed; audit not globally readable", () => {
  const apply = readSql("02_APPLY.sql");
  const verify = readSql("03_VERIFY.sql");
  const precheck = readSql("01_PRECHECK.sql");
  const acceptance = readSql("05_STAGING_SQL_ACCEPTANCE.sql");

  assert.doesNotMatch(apply, /coalesce\s*\(\s*p_actor_id\s*,\s*auth\.uid\s*\(\s*\)\s*\)/i);
  assert.match(apply, /SERVICE_ROLE_REQUIRED/);
  assert.match(apply, /ORIGINATING_ACTOR_REQUIRED/);
  assert.match(apply, /v_actor := p_actor_id/);
  assert.doesNotMatch(apply, /v_actor := auth\.uid\(\)/);

  assert.doesNotMatch(
    apply,
    /grant\s+select\s+on\s+table\s+public\.competition_referee_assignment_audit/i
  );
  assert.match(
    apply,
    /revoke all on table public\.competition_referee_assignment_audit from public, anon, authenticated/i
  );
  assert.doesNotMatch(
    apply,
    /using\s*\(\s*auth\.uid\s*\(\s*\)\s+is not null\s*\)/i
  );

  assert.match(precheck, /canonical_tournament_assert_tenant/);
  assert.match(precheck, /canonical_tournament_assert_permission/);
  assert.match(precheck, /user_venue_id/);
  assert.match(precheck, /team_tournament_can_manage/);
  assert.match(precheck, /ACTIVE_DUPLICATE_SCOPE_COUNT=/);
  assert.match(precheck, /INVALID_VERSION_ROW_COUNT=/);
  assert.match(precheck, /INDEX_COMPATIBILITY=/);
  assert.match(precheck, /PRECHECK_FINAL=/);
  assert.match(precheck, /group by ra\.tenant_id, ra\.tournament_id, ra\.match_id, ra\.role/);
  assert.match(precheck, /having count\(\*\) > 1/);
  assert.doesNotMatch(precheck, /\binsert\s+into\b/i);
  assert.doesNotMatch(precheck, /\bupdate\s+public\./i);
  assert.doesNotMatch(precheck, /\bdelete\s+from\b/i);
  assert.doesNotMatch(precheck, /\balter\s+table\b/i);
  assert.doesNotMatch(precheck, /\bdrop\s+(table|index|function)\b/i);

  assert.match(verify, /anon\.execute/);
  assert.match(verify, /grant\.audit\.select\.authenticated/);
  assert.match(verify, /authenticated\.execute\./);
  assert.match(verify, /service_role\.execute\.missing/);
  assert.match(verify, /search_path=public/);
  assert.match(verify, /has_function_privilege\('anon'/);

  assert.match(
    acceptance,
    /STAGING_SQL_ACCEPTANCE_TEST_NOT_RUN_REQUIRES_OWNER_GO/
  );
  assert.match(
    acceptance,
    /raise exception\s+'STAGING_SQL_ACCEPTANCE_TEST_NOT_RUN_REQUIRES_OWNER_GO/
  );
});

test("SQL security: direct RPC cannot bypass canonical tenant/tournament authz", () => {
  const apply = readSql("02_APPLY.sql");
  const assignFn = apply.split("create or replace function public.competition_assign_referee")[1];
  const replaceFn = apply.split("create or replace function public.competition_replace_referee")[1];
  const unassignFn = apply.split("create or replace function public.competition_unassign_referee")[1];
  const boundary = apply.split(
    "create or replace function public.competition_assignment_assert_mutation_boundary"
  )[1].split("create or replace function")[0];

  assert.match(boundary, /SERVICE_ROLE_REQUIRED/);
  assert.match(boundary, /ORIGINATING_ACTOR_REQUIRED/);
  assert.match(boundary, /team_tournament_resolve_header/);
  assert.match(boundary, /CROSS_TOURNAMENT_DENIED/);
  assert.match(boundary, /CROSS_TENANT_DENIED/);
  assert.doesNotMatch(boundary, /p_lifecycle_state/);

  for (const [name, body] of [
    ["assign", assignFn],
    ["replace", replaceFn],
    ["unassign", unassignFn],
  ]) {
    assert.match(
      body,
      /competition_assignment_assert_mutation_boundary/,
      `${name} must call SQL authz boundary`
    );
    assert.match(body, /grant execute[\s\S]*to service_role/i, name);
    assert.match(body, /revoke all[\s\S]*from public, anon, authenticated/i, name);
    assert.doesNotMatch(body, /grant execute[\s\S]*to authenticated/i, name);
    assert.doesNotMatch(body, /grant execute[\s\S]*to anon/i, name);
  }

  assert.match(apply, /LIFECYCLE_DENIED/);
  assert.match(apply, /UNASSIGN_WITHOUT_REPLACEMENT_DENIED/);
  assert.match(apply, /EMERGENCY_REPLACEMENT_REQUIRED/);
  assert.match(apply, /set search_path = public/);
  assert.match(apply, /ATOMIC: revoke old \+ activate new/);
});

test("SQL security: helpers are not client-executable", () => {
  const apply = readSql("02_APPLY.sql");
  const helpers = [
    "competition_assignment_assert_mutation_boundary",
    "competition_assignment_write_audit",
    "competition_assignment_check_idempotency",
    "competition_assignment_remember_idempotency",
    "competition_assignment_scope_version",
  ];
  for (const helper of helpers) {
    assert.match(apply, new RegExp(`create or replace function public\\.${helper}`));
    assert.match(
      apply,
      new RegExp(
        `revoke all on function public\\.${helper}[\\s\\S]{0,400}from public, anon, authenticated`,
        "i"
      ),
      `${helper} must revoke public/anon/authenticated`
    );
  }
});

test("ROLLBACK drops security helper and never referee_assignments", () => {
  const rollback = readSql("04_ROLLBACK.sql");
  assert.match(rollback, /competition_assignment_assert_mutation_boundary/);
  assert.match(rollback, /NEVER: drop table public\.referee_assignments/);
  assert.doesNotMatch(rollback, /^\s*drop table public\.referee_assignments;/m);
  assert.doesNotMatch(rollback, /^\s*delete from public\.referee_assignments;/m);
  assert.doesNotMatch(rollback, /^\s*truncate public\.referee_assignments;/m);
});

function evaluateActiveAssignmentUniqueIndexPrecheck(rows = []) {
  const active = rows.filter((row) => String(row.status) === "active");
  const scopes = new Map();
  for (const row of active) {
    const key = [row.tenant_id, row.tournament_id, row.match_id, row.role].join("\0");
    scopes.set(key, (scopes.get(key) || 0) + 1);
  }
  const duplicateScopeCount = [...scopes.values()].filter((count) => count > 1).length;
  const invalidScopeCount = active.filter(
    (row) =>
      !String(row.tenant_id || "").trim() ||
      !String(row.tournament_id || "").trim() ||
      !String(row.match_id || "").trim() ||
      !String(row.role || "").trim()
  ).length;
  const invalidVersionCount = rows.filter(
    (row) => row.version == null || Number(row.version) < 0
  ).length;
  const fail =
    duplicateScopeCount > 0 || invalidScopeCount > 0 || invalidVersionCount > 0;
  return {
    ACTIVE_DUPLICATE_SCOPE_COUNT: duplicateScopeCount,
    INVALID_SCOPE_ACTIVE_ROW_COUNT: invalidScopeCount,
    INVALID_VERSION_ROW_COUNT: invalidVersionCount,
    PRECHECK_FINAL: fail ? "FAIL" : "PASS",
  };
}

test("SQL PRECHECK invariant: duplicate active assignments fail closed; clean rows pass", () => {
  const clean = evaluateActiveAssignmentUniqueIndexPrecheck([
    {
      tenant_id: "t1",
      tournament_id: "tn1",
      match_id: "m1",
      role: "REFEREE",
      status: "active",
      version: 1,
    },
    {
      tenant_id: "t1",
      tournament_id: "tn1",
      match_id: "m1",
      role: "REFEREE",
      status: "revoked",
      version: 1,
    },
  ]);
  assert.equal(clean.PRECHECK_FINAL, "PASS");
  assert.equal(clean.ACTIVE_DUPLICATE_SCOPE_COUNT, 0);

  const duplicates = evaluateActiveAssignmentUniqueIndexPrecheck([
    {
      tenant_id: "t1",
      tournament_id: "tn1",
      match_id: "m1",
      role: "REFEREE",
      status: "active",
      version: 1,
    },
    {
      tenant_id: "t1",
      tournament_id: "tn1",
      match_id: "m1",
      role: "REFEREE",
      status: "active",
      version: 2,
    },
  ]);
  assert.equal(duplicates.PRECHECK_FINAL, "FAIL");
  assert.equal(duplicates.ACTIVE_DUPLICATE_SCOPE_COUNT, 1);

  const invalidVersion = evaluateActiveAssignmentUniqueIndexPrecheck([
    {
      tenant_id: "t1",
      tournament_id: "tn1",
      match_id: "m1",
      role: "REFEREE",
      status: "revoked",
      version: -1,
    },
  ]);
  assert.equal(invalidVersion.PRECHECK_FINAL, "FAIL");
  assert.equal(invalidVersion.INVALID_VERSION_ROW_COUNT, 1);
});

test("APPLY unique index scope + transaction model; VERIFY index predicate", () => {
  const apply = readSql("02_APPLY.sql");
  const verify = readSql("03_VERIFY.sql");
  assert.match(apply, /APPLY_TRANSACTION_MODEL=SINGLE_EXPLICIT_TRANSACTION/);
  assert.match(apply, /^\s*begin;/m);
  assert.match(apply, /^\s*commit;/m);
  assert.doesNotMatch(apply, /create unique index concurrently/i);
  assert.match(
    apply,
    /on public\.referee_assignments \(tenant_id, tournament_id, match_id, role\)/
  );
  assert.match(apply, /where status = 'active'/);
  assert.match(verify, /indexdef ilike '%tenant_id%'/);
  assert.match(verify, /indexdef ilike '%role%'/);
  assert.match(verify, /active_match_role_unique_index/);
});
