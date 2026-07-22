/**
 * CORE-13 Phase 1B — contracts, enums, errors, ports, determinism, ownership guards.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import * as Core13 from "../src/features/competition-core/referee-assignment/index.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MOD_ROOT = path.join(
  ROOT,
  "src/features/competition-core/referee-assignment"
);
const ROOT_BARREL = path.join(ROOT, "src/features/competition-core/index.js");
const DOCS_ROOT = path.join(ROOT, "docs/competition-engine/core-13");

const {
  CORE13_SCHEMA_VERSION,
  CORE13_IDENTITY,
  REFEREE_ROLE_CODE,
  REFEREE_ASSIGNMENT_STATUS,
  REFEREE_ASSIGNMENT_SOURCE,
  REFEREE_CONFLICT_TYPE,
  REFEREE_CONSTRAINT_KIND,
  REFEREE_DIAGNOSTIC_SEVERITY,
  REFEREE_AVAILABILITY_SOURCE,
  REFEREE_AUDIT_ACTION,
  REFEREE_SNAPSHOT_STATUS,
  REFEREE_RESOURCE_TYPE,
  REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE,
  RefereeAssignmentContractError,
  createRefereeCandidate,
  createRefereeQualification,
  createRefereeAvailabilityWindow,
  createRefereeRoleRequirement,
  createRefereeAssignmentPolicy,
  createRefereeAssignmentContext,
  createRefereeAssignmentRequest,
  createRefereeConflict,
  createRefereeWorkload,
  createRefereeAssignment,
  createUnassignedRefereeRequirement,
  createRefereeAssignmentFailure,
  createManualAssignmentRejection,
  createRefereeAssignmentPlan,
  createManualRefereeAssignmentRequest,
  createRefereeReplacementRequest,
  createRefereeReplacementResult,
  createRefereeAssignmentAuditRecord,
  createRefereeResourceConflictProjection,
  compareStableString,
  sortStableIds,
  prepareFingerprintMaterial,
  createFailClosedRefereeDirectoryPort,
  createFixedRefereeDirectoryPort,
  createFailClosedMatchScheduleInputPort,
  createFixedMatchScheduleInputPort,
  createFixedRefereeWorkloadHistoryPort,
} = Core13;

function listJsFiles(dir) {
  const out = [];
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) out.push(...listJsFiles(full));
    else if (name.endsWith(".js")) out.push(full);
  }
  return out;
}

function basePolicy(overrides = {}) {
  return {
    policyId: "pol-1",
    policyVersion: "1",
    defaultRoleRequirements: [
      {
        roleCode: REFEREE_ROLE_CODE.PRIMARY,
        mandatory: true,
        minCount: 1,
        maxCount: 1,
      },
    ],
    ...overrides,
  };
}

function baseContext(overrides = {}) {
  return {
    tenantId: "tenant-1",
    tournamentId: "tourn-1",
    matchIds: ["m-1", "m-2"],
    snapshotRefs: [
      {
        snapshotId: "snap-dir",
        snapshotVersion: "v1",
        fingerprint: "abcd1234",
        kind: "DIRECTORY",
      },
    ],
    scheduleWindow: {
      startAt: "2026-07-22T00:00:00.000Z",
      endAt: "2026-07-22T23:59:59.000Z",
    },
    ...overrides,
  };
}

function baseRequest(overrides = {}) {
  return {
    requestId: "req-1",
    tenantId: "tenant-1",
    tournamentId: "tourn-1",
    matchIds: ["m-2", "m-1"],
    policy: basePolicy(),
    context: baseContext(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// A. Contracts — happy paths & scope
// ---------------------------------------------------------------------------

test("A01: schema version is canonical single identifier", () => {
  assert.equal(CORE13_SCHEMA_VERSION, "CORE13_REFEREE_ASSIGNMENT_SCHEMA_V1");
  assert.equal(CORE13_IDENTITY.schemaVersion, CORE13_SCHEMA_VERSION);
});

test("A02: RefereeCandidate happy path is frozen projection", () => {
  const c = createRefereeCandidate({
    refereeId: " ref-1 ",
    active: true,
    userId: "user-1",
    playerId: "player-1",
    organizationIds: ["org-b", "org-a"],
    clubIds: ["club-2", "club-1"],
    qualificationRefs: ["q-2", "q-1"],
    preferenceTags: ["lang:en", "lang:vi"],
    displayLabel: "Display Only",
  });
  assert.ok(Object.isFrozen(c));
  assert.equal(c.refereeId, "ref-1");
  assert.equal(c.displayLabel, "Display Only");
  assert.deepEqual([...c.organizationIds], ["org-a", "org-b"]);
  assert.equal(c.schemaVersion, CORE13_SCHEMA_VERSION);
  assert.equal("name" in c, false);
  assert.equal("phone" in c, false);
});

test("A03: missing tenant/tournament/match scope fails", () => {
  assert.throws(
    () => createRefereeAssignmentRequest(baseRequest({ tenantId: "" })),
    (err) =>
      err instanceof RefereeAssignmentContractError &&
      err.code === REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.TENANT_SCOPE_REQUIRED
  );
  assert.throws(
    () => createRefereeAssignmentRequest(baseRequest({ tournamentId: null })),
    (err) =>
      err instanceof RefereeAssignmentContractError &&
      err.code === REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.TOURNAMENT_SCOPE_REQUIRED
  );
  assert.throws(
    () =>
      createRefereeAssignmentRequest(
        baseRequest({
          matchIds: [],
          context: baseContext({ matchIds: [] }),
        })
      ),
    (err) =>
      err instanceof RefereeAssignmentContractError &&
      err.code === REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.MATCH_SCOPE_REQUIRED
  );
});

test("A04: identity fields remain separated on assignment + candidate", () => {
  const a = createRefereeAssignment({
    assignmentId: "asg-1",
    matchId: "m-1",
    refereeId: "ref-1",
    roleCode: REFEREE_ROLE_CODE.PRIMARY,
    status: REFEREE_ASSIGNMENT_STATUS.PLANNED,
    source: REFEREE_ASSIGNMENT_SOURCE.MANUAL,
  });
  assert.equal(a.refereeId, "ref-1");
  assert.equal(a.matchId, "m-1");
  assert.equal("playerId" in a, false);
  assert.equal("userId" in a, false);

  const c = createRefereeCandidate({
    refereeId: "ref-1",
    userId: "u-1",
    playerId: "p-1",
  });
  assert.notEqual(c.refereeId, c.userId);
  assert.notEqual(c.refereeId, c.playerId);
});

test("A05: candidate rejects profile-like unknown fields", () => {
  assert.throws(
    () =>
      createRefereeCandidate({
        refereeId: "ref-1",
        name: "Should Fail",
        phone: "0900",
      }),
    (err) =>
      err instanceof RefereeAssignmentContractError &&
      err.code === REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.INVALID_ASSIGNMENT_REQUEST
  );
});

test("A06: returned objects are immutable", () => {
  const c = createRefereeCandidate({ refereeId: "ref-1" });
  assert.throws(() => {
    c.refereeId = "hacked";
  });
  assert.throws(() => {
    c.organizationIds.push("x");
  });
});

test("A07: unknown fields rejected on request", () => {
  assert.throws(
    () =>
      createRefereeAssignmentRequest({
        ...baseRequest(),
        unexpectedField: true,
      }),
    (err) => err instanceof RefereeAssignmentContractError
  );
});

test("A08: Date, Map, Set, function, NaN, Infinity rejected", () => {
  assert.throws(
    () =>
      createRefereeCandidate({
        refereeId: "ref-1",
        metadata: { when: new Date("2026-01-01") },
      }),
    (err) =>
      err.code === REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.NON_DETERMINISTIC_INPUT
  );
  assert.throws(
    () =>
      createRefereeCandidate({
        refereeId: "ref-1",
        metadata: { m: new Map() },
      }),
    (err) =>
      err.code === REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.NON_DETERMINISTIC_INPUT
  );
  assert.throws(
    () =>
      createRefereeCandidate({
        refereeId: "ref-1",
        metadata: { s: new Set([1]) },
      }),
    (err) =>
      err.code === REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.NON_DETERMINISTIC_INPUT
  );
  assert.throws(
    () =>
      createRefereeCandidate({
        refereeId: "ref-1",
        metadata: { fn: () => 1 },
      }),
    (err) =>
      err.code === REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.NON_DETERMINISTIC_INPUT
  );
  assert.throws(
    () =>
      createRefereeCandidate({
        refereeId: "ref-1",
        metadata: { n: NaN },
      }),
    (err) =>
      err.code === REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.NON_DETERMINISTIC_INPUT
  );
  assert.throws(
    () =>
      createRefereeCandidate({
        refereeId: "ref-1",
        metadata: { n: Infinity },
      }),
    (err) =>
      err.code === REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.NON_DETERMINISTIC_INPUT
  );
});

test("A09: remaining contract factories happy paths", () => {
  const q = createRefereeQualification({
    qualificationId: "qual-1",
    refereeId: "ref-1",
    roleCode: REFEREE_ROLE_CODE.PRIMARY,
    certificationCode: "CERT-A",
    validFrom: "2026-01-01T00:00:00.000Z",
    validTo: "2027-01-01T00:00:00.000Z",
  });
  assert.equal(q.certificationCode, "CERT-A");

  const w = createRefereeAvailabilityWindow({
    windowId: "win-1",
    refereeId: "ref-1",
    startAt: "2026-07-22T08:00:00.000Z",
    endAt: "2026-07-22T12:00:00.000Z",
    source: REFEREE_AVAILABILITY_SOURCE.TOURNAMENT,
  });
  assert.equal(w.source, REFEREE_AVAILABILITY_SOURCE.TOURNAMENT);

  const rr = createRefereeRoleRequirement({
    roleCode: REFEREE_ROLE_CODE.ASSISTANT,
    mandatory: false,
    minCount: 0,
    maxCount: 2,
  });
  assert.equal(rr.maxCount, 2);

  const conflict = createRefereeConflict({
    conflictId: "cf-1",
    conflictType: REFEREE_CONFLICT_TYPE.OVERLAP,
    refereeId: "ref-1",
    matchId: "m-1",
    relatedMatchIds: ["m-2"],
    reasonCodes: [REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.REFEREE_ALREADY_ASSIGNED],
    severity: REFEREE_DIAGNOSTIC_SEVERITY.MATCH_RECOVERABLE,
  });
  assert.equal(conflict.conflictType, REFEREE_CONFLICT_TYPE.OVERLAP);

  const wl = createRefereeWorkload({
    refereeId: "ref-1",
    assignmentCount: 2,
    fairnessDelta: 1,
  });
  assert.equal(wl.assignmentCount, 2);

  const un = createUnassignedRefereeRequirement({
    matchId: "m-1",
    roleCode: REFEREE_ROLE_CODE.PRIMARY,
    reasonCodes: [REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.SCHEDULE_WINDOW_REQUIRED],
    candidateCountEligible: 0,
  });
  assert.equal(un.reasonCodes.length, 1);

  const plan = createRefereeAssignmentPlan({
    planId: "plan-1",
    requestId: "req-1",
    assignments: [
      {
        assignmentId: "asg-1",
        matchId: "m-1",
        refereeId: "ref-1",
        roleCode: REFEREE_ROLE_CODE.PRIMARY,
      },
    ],
    unassigned: [],
    workloads: [{ refereeId: "ref-1", assignmentCount: 1 }],
  });
  assert.equal(plan.assignments.length, 1);

  const manual = createManualRefereeAssignmentRequest({
    requestId: "man-1",
    tenantId: "tenant-1",
    tournamentId: "tourn-1",
    matchId: "m-1",
    refereeId: "ref-1",
    roleCode: REFEREE_ROLE_CODE.PRIMARY,
    allowSoftOverride: true,
  });
  assert.equal(manual.allowSoftOverride, true);

  const replReq = createRefereeReplacementRequest({
    requestId: "rep-1",
    tenantId: "tenant-1",
    tournamentId: "tourn-1",
    matchId: "m-1",
    roleCode: REFEREE_ROLE_CODE.PRIMARY,
    incomingRefereeId: "ref-2",
  });
  assert.equal(replReq.incomingRefereeId, "ref-2");

  const replOk = createRefereeReplacementResult({
    requestId: "rep-1",
    ok: true,
    incomingAssignment: {
      assignmentId: "asg-2",
      matchId: "m-1",
      refereeId: "ref-2",
      roleCode: REFEREE_ROLE_CODE.PRIMARY,
      source: REFEREE_ASSIGNMENT_SOURCE.REPLACEMENT,
    },
  });
  assert.equal(replOk.ok, true);

  const audit = createRefereeAssignmentAuditRecord({
    auditId: "aud-1",
    action: REFEREE_AUDIT_ACTION.PLAN_GENERATED,
    requestId: "req-1",
    recordedAt: "2026-07-22T10:00:00.000Z",
  });
  assert.equal(audit.action, REFEREE_AUDIT_ACTION.PLAN_GENERATED);

  const ctx = createRefereeAssignmentContext(baseContext());
  assert.ok(Object.isFrozen(ctx));
  const pol = createRefereeAssignmentPolicy(basePolicy());
  assert.equal(pol.comparatorVersion.length > 0, true);
  void REFEREE_CONSTRAINT_KIND;
});

// ---------------------------------------------------------------------------
// B. Determinism
// ---------------------------------------------------------------------------

test("B01: stable ordering across shuffled equivalent inputs", () => {
  const a = createRefereeCandidate({
    refereeId: "ref-1",
    clubIds: ["c-3", "c-1", "c-2"],
    preferenceTags: ["z", "a"],
  });
  const b = createRefereeCandidate({
    refereeId: "ref-1",
    clubIds: ["c-1", "c-2", "c-3"],
    preferenceTags: ["a", "z"],
  });
  assert.deepEqual([...a.clubIds], [...b.clubIds]);
  assert.deepEqual([...a.preferenceTags], [...b.preferenceTags]);

  const r1 = createRefereeAssignmentRequest(
    baseRequest({ matchIds: ["m-2", "m-1", "m-3"] })
  );
  const r2 = createRefereeAssignmentRequest(
    baseRequest({ matchIds: ["m-3", "m-1", "m-2"] })
  );
  assert.deepEqual([...r1.matchIds], [...r2.matchIds]);
});

test("B02: compareStableString does not use localeCompare", () => {
  const src = readFileSync(
    path.join(MOD_ROOT, "deterministic/compare.js"),
    "utf8"
  );
  assert.equal(src.includes("localeCompare"), false);
  assert.ok(compareStableString("a", "b") < 0);
  assert.ok(compareStableString("b", "a") > 0);
  assert.equal(compareStableString("same", "same"), 0);
  assert.deepEqual(sortStableIds(["b", "a", "c"]), ["a", "b", "c"]);
});

test("B03: fingerprint prep is stable for equivalent objects", () => {
  const p1 = prepareFingerprintMaterial({ b: 2, a: 1 });
  const p2 = prepareFingerprintMaterial({ a: 1, b: 2 });
  assert.deepEqual(p1, p2);
});

test("B04: no Math.random, Date.now, or randomUUID in CORE-13 module", () => {
  const files = listJsFiles(MOD_ROOT);
  assert.ok(files.length > 0);
  for (const file of files) {
    const src = readFileSync(file, "utf8");
    assert.equal(
      /Math\.random\s*\(/.test(src),
      false,
      `Math.random in ${file}`
    );
    assert.equal(/Date\.now\s*\(/.test(src), false, `Date.now in ${file}`);
    assert.equal(
      /randomUUID\s*\(/.test(src),
      false,
      `randomUUID in ${file}`
    );
  }
});

// ---------------------------------------------------------------------------
// C. Manual rejection + resource conflict
// ---------------------------------------------------------------------------

test("C01: manual rejection envelope preserves underlying reason code", () => {
  const failure = createManualAssignmentRejection(
    REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.REFEREE_CONFLICT_OF_INTEREST,
    {
      matchId: "m-1",
      refereeId: "ref-1",
    }
  );
  assert.equal(
    failure.code,
    REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.MANUAL_ASSIGNMENT_REJECTED
  );
  assert.equal(
    failure.causedBy,
    REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.REFEREE_CONFLICT_OF_INTEREST
  );
  assert.ok(
    failure.reasonCodes.includes(
      REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.REFEREE_CONFLICT_OF_INTEREST
    )
  );
  assert.equal(failure.severity, REFEREE_DIAGNOSTIC_SEVERITY.FATAL);

  assert.throws(() =>
    createRefereeAssignmentFailure({
      code: REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.MANUAL_ASSIGNMENT_REJECTED,
      message: "no reason",
    })
  );
});

test("C02: resource conflict projection uses resourceType REFEREE", () => {
  const proj = createRefereeResourceConflictProjection({
    conflictId: "rc-1",
    refereeId: "ref-1",
    matchId: "m-1",
    conflictingMatchId: "m-2",
    conflictType: REFEREE_CONFLICT_TYPE.OVERLAP,
    startAt: "2026-07-22T08:00:00.000Z",
    endAt: "2026-07-22T09:00:00.000Z",
    reasonCodes: [REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.REFEREE_ALREADY_ASSIGNED],
  });
  assert.equal(proj.resourceType, REFEREE_RESOURCE_TYPE.REFEREE);
  assert.equal(proj.resourceType, "REFEREE");
  assert.throws(() =>
    createRefereeResourceConflictProjection({
      conflictId: "rc-1",
      resourceType: "COURT",
      refereeId: "ref-1",
      matchId: "m-1",
      conflictType: REFEREE_CONFLICT_TYPE.OVERLAP,
    })
  );
});

// ---------------------------------------------------------------------------
// D. Ports — missing vs empty
// ---------------------------------------------------------------------------

test("D01: directory fail-closed is FATAL missing", async () => {
  const port = createFailClosedRefereeDirectoryPort();
  const result = await port.resolveRefereeDirectory({
    tenantId: "t1",
    tournamentId: "tr1",
  });
  assert.equal(result.ok, false);
  assert.equal(result.status, REFEREE_SNAPSHOT_STATUS.MISSING);
  assert.equal(
    result.code,
    REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.SNAPSHOT_MISSING
  );
  assert.equal(result.severity, REFEREE_DIAGNOSTIC_SEVERITY.FATAL);
});

test("D02: valid empty directory is ok EMPTY (not malformed)", async () => {
  const port = createFixedRefereeDirectoryPort("empty");
  const result = await port.resolveRefereeDirectory({});
  assert.equal(result.ok, true);
  assert.equal(result.status, REFEREE_SNAPSHOT_STATUS.EMPTY);
  assert.equal(result.items.length, 0);
});

test("D03: populated directory and missing schedule differ", async () => {
  const dir = createFixedRefereeDirectoryPort([
    { refereeId: "ref-1", active: true },
  ]);
  const dirResult = await dir.resolveRefereeDirectory({});
  assert.equal(dirResult.status, REFEREE_SNAPSHOT_STATUS.POPULATED);

  const schedMissing = createFailClosedMatchScheduleInputPort();
  const miss = await schedMissing.resolveMatchSchedule({});
  assert.equal(miss.status, REFEREE_SNAPSHOT_STATUS.MISSING);
  assert.equal(miss.ok, false);

  const schedEmpty = createFixedMatchScheduleInputPort("empty");
  const empty = await schedEmpty.resolveMatchSchedule({});
  assert.equal(empty.ok, true);
  assert.equal(empty.status, REFEREE_SNAPSHOT_STATUS.EMPTY);

  const hist = createFixedRefereeWorkloadHistoryPort("empty");
  const h = await hist.resolveWorkloadHistory({});
  assert.equal(h.ok, true);
});

test("D04: invalid snapshot is FATAL", async () => {
  const port = createFixedRefereeDirectoryPort("invalid");
  const result = await port.resolveRefereeDirectory({});
  assert.equal(result.ok, false);
  assert.equal(result.status, REFEREE_SNAPSHOT_STATUS.INVALID);
  assert.equal(
    result.code,
    REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.SNAPSHOT_INVALID
  );
});

// ---------------------------------------------------------------------------
// E. Architecture / export / barrel guards
// ---------------------------------------------------------------------------

test("E01: no imports from React, Supabase, referee-v5, or legacy engines", () => {
  const forbidden = [
    "react",
    "react-dom",
    "@supabase",
    "referee-v5",
    "individual-tournament/engines/refereeAssignEngine",
    "team-tournament/engines/refereeAssignEngine",
    "court-engine/services/refereeDispatchService",
    "tournament/engines/refereeEngine",
  ];
  for (const file of listJsFiles(MOD_ROOT)) {
    const src = readFileSync(file, "utf8");
    for (const token of forbidden) {
      assert.equal(
        src.includes(token),
        false,
        `${path.relative(ROOT, file)} must not reference ${token}`
      );
    }
  }
});

test("E02: capability-local index exports Phase 1B surface", () => {
  const required = [
    "CORE13_SCHEMA_VERSION",
    "createRefereeCandidate",
    "createRefereeAssignmentRequest",
    "createManualAssignmentRejection",
    "createRefereeResourceConflictProjection",
    "createFailClosedRefereeDirectoryPort",
    "createFixedMatchScheduleInputPort",
    "compareStableString",
    "REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE",
    "REFEREE_RESOURCE_TYPE",
  ];
  for (const key of required) {
    assert.equal(key in Core13, true, `missing export ${key}`);
  }
  // Public aliases must NEVER exist
  assert.equal("scoreRefereeCandidates" in Core13, false);
  assert.equal("autoAssignReferees" in Core13, false);
  assert.equal("dispatchReferees" in Core13, false);
});

test("E03: root Competition Core barrel remains untouched by CORE-13", () => {
  const barrel = readFileSync(ROOT_BARREL, "utf8");
  assert.equal(barrel.includes("referee-assignment"), false);
  assert.equal(barrel.includes("CORE13"), false);
});

test("E04: ownership docs exist and state Owner corrections", () => {
  const ownership = readFileSync(
    path.join(DOCS_ROOT, "00_OWNERSHIP_BOUNDARY.md"),
    "utf8"
  );
  assert.ok(ownership.includes("MOVE TO OPERATIONS"));
  assert.ok(ownership.includes("superseded"));
  assert.ok(ownership.includes("Resource Conflict Resolver"));
  assert.ok(ownership.includes("not Match Lifecycle"));
  assert.ok(ownership.includes("canonical Competition Core owner"));

  for (const name of [
    "01_PUBLIC_CONTRACTS.md",
    "02_DETERMINISM_POLICY.md",
    "03_PORTS.md",
    "04_CONSTRAINT_MODEL.md",
    "05_ERROR_TAXONOMY.md",
  ]) {
    assert.ok(existsSync(path.join(DOCS_ROOT, name)), name);
  }
});

test("E05: enums are frozen and include required sets", () => {
  assert.ok(Object.isFrozen(REFEREE_ROLE_CODE));
  assert.ok(Object.isFrozen(REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE));
  assert.equal(REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.REPLACEMENT_REFEREE_REJECTED, "REPLACEMENT_REFEREE_REJECTED");
  assert.equal(REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.INVALID_REPLACEMENT_REQUEST, "INVALID_REPLACEMENT_REQUEST");
});
