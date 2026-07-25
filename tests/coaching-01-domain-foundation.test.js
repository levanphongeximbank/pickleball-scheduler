/**
 * COACHING-01 — Canonical domain, authorization & repository foundation.
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import * as Coaching from "../src/features/coaching/index.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const COACHING_ROOT = path.join(ROOT, "src/features/coaching");

const SCOPE_A = Object.freeze({ tenantId: "tenant-a", clubId: "club-a" });
const SCOPE_B = Object.freeze({ tenantId: "tenant-b", clubId: "club-b" });
const FIXED_NOW = "2026-07-25T08:00:00.000Z";

const ALL_ACTIONS = Object.values(Coaching.COACHING_ACTIONS);

function actorWith(actions, extras = {}) {
  return {
    userId: "user-1",
    tenantId: SCOPE_A.tenantId,
    clubIds: [SCOPE_A.clubId],
    actions,
    authenticated: true,
    ...extras,
  };
}

function createApp(options = {}) {
  let seq = 0;
  const idGenerator = {
    nextId(prefix) {
      seq += 1;
      return `${prefix}_${seq}`;
    },
  };
  const clock = Coaching.createFixedCoachingClock(FIXED_NOW);
  return Coaching.createMemoryCoachingApplication({
    clock,
    idGenerator,
    ...options,
  });
}

function readSources(dir) {
  /** @type {{ name: string, source: string }[]} */
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "services") continue;
      out.push(...readSources(full));
    } else if (entry.name.endsWith(".js")) {
      out.push({ name: full, source: fs.readFileSync(full, "utf8") });
    }
  }
  return out;
}

test("public facade exports foundation API", () => {
  for (const name of Coaching.COACHING_PUBLIC_EXPORTS) {
    assert.ok(name in Coaching, `missing export: ${name}`);
  }
  assert.equal(Coaching.COACHING_FOUNDATION_PHASE, "COACHING-01");
  assert.equal(typeof Coaching.createCoachingProgram, "function");
  assert.equal(typeof Coaching.createCoachingApplicationService, "function");
  assert.equal(typeof Coaching.createInMemoryCoachingRepositories, "function");
  assert.ok(Coaching.COACHING_ERROR_CODES.NOT_FOUND);
  assert.ok(Coaching.COACHING_ACTIONS.PROGRAM_CREATE.startsWith("coaching."));
});

test("fail-closed when repository adapter is not configured", async () => {
  const service = Coaching.createFailClosedCoachingApplication();
  const actor = actorWith(ALL_ACTIONS);
  await assert.rejects(
    () =>
      service.createProgram(actor, {
        ...SCOPE_A,
        name: "Program A",
      }),
    (err) =>
      err instanceof Coaching.CoachingError &&
      err.code === Coaching.COACHING_ERROR_CODES.RUNTIME_NOT_CONFIGURED
  );
});

test("explicit tenant/club scope required; cross-tenant deny", async () => {
  assert.throws(
    () => Coaching.createCoachingProgram({ name: "X" }, {
      nowIso: () => FIXED_NOW,
      nextId: () => "prog_1",
    }),
    (err) => err.code === Coaching.COACHING_ERROR_CODES.MISSING_SCOPE
  );

  const { service } = createApp();
  const actor = actorWith(ALL_ACTIONS);
  const program = await service.createProgram(actor, {
    ...SCOPE_A,
    name: "Scoped Program",
  });
  assert.equal(program.tenantId, SCOPE_A.tenantId);
  assert.equal(program.clubId, SCOPE_A.clubId);

  const foreign = actorWith(ALL_ACTIONS, {
    tenantId: SCOPE_B.tenantId,
    clubIds: [SCOPE_B.clubId],
  });
  await assert.rejects(
    () =>
      service.updateProgram(foreign, {
        ...SCOPE_A,
        programId: program.programId,
        expectedVersion: 1,
        name: "Hijack",
      }),
    (err) => err.code === Coaching.COACHING_ERROR_CODES.FORBIDDEN_SCOPE
  );
});

test("coach/player reference boundaries store ids only", () => {
  const ref = Coaching.createCoachReference(
    {
      ...SCOPE_A,
      coachPrincipalId: "principal-1",
      coachMembershipId: "membership-1",
      displayLabel: "HLV A",
    },
    { nowIso: () => FIXED_NOW, nextId: (p) => `${p}_1` }
  );
  assert.equal(ref.coachPrincipalId, "principal-1");
  assert.equal(ref.coachMembershipId, "membership-1");
  assert.equal("email" in ref, false);
  assert.equal("phone" in ref, false);
  assert.equal("playerProfile" in ref, false);

  const rel = Coaching.createCoachPlayerRelationship(
    {
      ...SCOPE_A,
      coachReferenceId: ref.coachReferenceId,
      playerId: "player-9",
    },
    { nowIso: () => FIXED_NOW, nextId: (p) => `${p}_1` }
  );
  assert.equal(rel.playerId, "player-9");
  assert.equal("playerName" in rel, false);
});

test("program lifecycle allow and deny", () => {
  const deps = { nowIso: () => FIXED_NOW, nextId: (p) => `${p}_1` };
  let program = Coaching.createCoachingProgram(
    { ...SCOPE_A, name: "Life" },
    deps
  );
  assert.equal(program.status, Coaching.PROGRAM_STATUS.DRAFT);

  program = Coaching.transitionCoachingProgram(
    program,
    Coaching.PROGRAM_STATUS.ACTIVE,
    deps,
    { expectedVersion: 1 }
  );
  assert.equal(program.status, Coaching.PROGRAM_STATUS.ACTIVE);
  assert.equal(program.version, 2);

  assert.throws(
    () =>
      Coaching.transitionCoachingProgram(
        program,
        Coaching.PROGRAM_STATUS.DRAFT,
        deps,
        { expectedVersion: 2 }
      ),
    (err) => err.code === Coaching.COACHING_ERROR_CODES.INVALID_TRANSITION
  );
});

test("enrollment + curriculum/lesson + scheduling via application", async () => {
  const { service } = createApp();
  const actor = actorWith(ALL_ACTIONS);

  const program = await service.createProgram(actor, {
    ...SCOPE_A,
    name: "Junior Path",
  });
  const curriculum = await service.createCurriculum(actor, {
    ...SCOPE_A,
    programId: program.programId,
    name: "Basics",
  });
  const lesson = await service.createLesson(actor, {
    ...SCOPE_A,
    curriculumId: curriculum.curriculumId,
    title: "Serve fundamentals",
    sequence: 1,
  });
  assert.equal(lesson.curriculumId, curriculum.curriculumId);

  const enrollment = await service.enrollPlayer(actor, {
    ...SCOPE_A,
    programId: program.programId,
    playerId: "player-1",
  });
  assert.equal(enrollment.status, Coaching.ENROLLMENT_STATUS.PENDING);

  const activated = await service.transitionEnrollment(actor, {
    ...SCOPE_A,
    enrollmentId: enrollment.enrollmentId,
    status: Coaching.ENROLLMENT_STATUS.ACTIVE,
    expectedVersion: 1,
  });
  assert.equal(activated.status, Coaching.ENROLLMENT_STATUS.ACTIVE);

  await assert.rejects(
    () =>
      service.transitionEnrollment(actor, {
        ...SCOPE_A,
        enrollmentId: enrollment.enrollmentId,
        status: Coaching.ENROLLMENT_STATUS.PENDING,
        expectedVersion: 2,
      }),
    (err) => err.code === Coaching.COACHING_ERROR_CODES.INVALID_TRANSITION
  );

  const session = await service.scheduleSession(actor, {
    ...SCOPE_A,
    programId: program.programId,
    lessonId: lesson.lessonId,
    enrollmentId: activated.enrollmentId,
    startsAt: "2026-07-26T01:00:00.000Z",
    endsAt: "2026-07-26T02:00:00.000Z",
    venueId: "venue-1",
    courtId: "court-1",
  });
  assert.equal(session.status, Coaching.SESSION_STATUS.SCHEDULED);
  assert.equal(session.schedule.courtId, "court-1");
});

test("attendance record + append-only correction", async () => {
  const { service, repositories } = createApp();
  const actor = actorWith(ALL_ACTIONS);
  const program = await service.createProgram(actor, {
    ...SCOPE_A,
    name: "Attend Prog",
  });
  const session = await service.scheduleSession(actor, {
    ...SCOPE_A,
    programId: program.programId,
    startsAt: "2026-07-26T03:00:00.000Z",
    endsAt: "2026-07-26T04:00:00.000Z",
  });
  const record = await service.recordAttendance(actor, {
    ...SCOPE_A,
    sessionId: session.sessionId,
    playerId: "player-2",
    status: Coaching.ATTENDANCE_STATUS.ABSENT,
  });
  assert.equal(record.status, Coaching.ATTENDANCE_STATUS.ABSENT);

  const corrected = await service.correctAttendance(actor, {
    ...SCOPE_A,
    attendanceId: record.attendanceId,
    correctedStatus: Coaching.ATTENDANCE_STATUS.EXCUSED,
    reason: "Medical note verified",
    expectedVersion: 1,
  });
  assert.equal(corrected.attendance.status, Coaching.ATTENDANCE_STATUS.EXCUSED);
  assert.equal(corrected.correction.previousStatus, Coaching.ATTENDANCE_STATUS.ABSENT);
  assert.equal(corrected.correction.correctedStatus, Coaching.ATTENDANCE_STATUS.EXCUSED);
  assert.equal(corrected.correction.reason, "Medical note verified");
  assert.equal(corrected.correction.actorId, "user-1");

  const history = repositories.attendanceCorrections.listByAttendanceId(
    SCOPE_A,
    record.attendanceId
  );
  assert.equal(history.length, 1);

  assert.throws(
    () =>
      repositories.attendanceCorrections.append({
        ...corrected.correction,
      }),
    (err) => err.code === Coaching.COACHING_ERROR_CODES.DUPLICATE
  );
});

test("dedicated package/entitlement actions — no fallback to old actions", async () => {
  const { service } = createApp();

  const programOnly = actorWith([Coaching.COACHING_ACTIONS.PROGRAM_CREATE]);
  await assert.rejects(
    () =>
      service.createPackage(programOnly, {
        ...SCOPE_A,
        name: "Should deny",
        sessionEntitlement: 4,
      }),
    (err) => err.code === Coaching.COACHING_ERROR_CODES.FORBIDDEN_ACTION
  );

  const enrollOnly = actorWith([Coaching.COACHING_ACTIONS.PLAYER_ENROLL]);
  await assert.rejects(
    () =>
      service.grantEntitlement(enrollOnly, {
        ...SCOPE_A,
        packageId: "pkg_missing",
        playerId: "player-x",
        sessionsGranted: 2,
      }),
    (err) => err.code === Coaching.COACHING_ERROR_CODES.FORBIDDEN_ACTION
  );

  const attendanceOnly = actorWith([Coaching.COACHING_ACTIONS.ATTENDANCE_RECORD]);
  await assert.rejects(
    () =>
      service.consumeEntitlement(attendanceOnly, {
        ...SCOPE_A,
        entitlementId: "ent_missing",
        expectedVersion: 1,
      }),
    (err) => err.code === Coaching.COACHING_ERROR_CODES.FORBIDDEN_ACTION
  );

  const packageActor = actorWith([
    Coaching.COACHING_ACTIONS.PACKAGE_CREATE,
    Coaching.COACHING_ACTIONS.ENTITLEMENT_GRANT,
    Coaching.COACHING_ACTIONS.ENTITLEMENT_CONSUME,
  ]);
  const pkg = await service.createPackage(packageActor, {
    ...SCOPE_A,
    name: "Dedicated pack",
    sessionEntitlement: 2,
  });
  assert.equal(pkg.name, "Dedicated pack");

  const entitlement = await service.grantEntitlement(packageActor, {
    ...SCOPE_A,
    packageId: pkg.packageId,
    playerId: "player-dedicated",
    sessionsGranted: 2,
  });
  assert.equal(entitlement.sessionsRemaining, 2);

  const consumed = await service.consumeEntitlement(packageActor, {
    ...SCOPE_A,
    entitlementId: entitlement.entitlementId,
    expectedVersion: 1,
  });
  assert.equal(consumed.sessionsRemaining, 1);

  assert.equal(
    Coaching.COACHING_ACTIONS.PACKAGE_CREATE,
    "coaching.package.create"
  );
  assert.equal(
    Coaching.COACHING_ACTIONS.ENTITLEMENT_GRANT,
    "coaching.entitlement.grant"
  );
  assert.equal(
    Coaching.COACHING_ACTIONS.ENTITLEMENT_CONSUME,
    "coaching.entitlement.consume"
  );
});

test("atomic attendance correction rolls back when append fails", async () => {
  const { service, repositories } = createApp();
  const actor = actorWith(ALL_ACTIONS);
  const program = await service.createProgram(actor, {
    ...SCOPE_A,
    name: "Atomic Prog",
  });
  const session = await service.scheduleSession(actor, {
    ...SCOPE_A,
    programId: program.programId,
    startsAt: "2026-07-26T05:00:00.000Z",
    endsAt: "2026-07-26T06:00:00.000Z",
  });
  const record = await service.recordAttendance(actor, {
    ...SCOPE_A,
    sessionId: session.sessionId,
    playerId: "player-atomic",
    status: Coaching.ATTENDANCE_STATUS.ABSENT,
  });
  assert.equal(record.version, 1);
  assert.equal(record.status, Coaching.ATTENDANCE_STATUS.ABSENT);

  const originalAppend = repositories.attendanceCorrections.append;
  repositories.attendanceCorrections.append = () => {
    throw new Coaching.CoachingError(
      Coaching.COACHING_ERROR_CODES.REPOSITORY_CONTRACT_VIOLATION,
      "Simulated correction append failure."
    );
  };

  await assert.rejects(
    () =>
      service.correctAttendance(actor, {
        ...SCOPE_A,
        attendanceId: record.attendanceId,
        correctedStatus: Coaching.ATTENDANCE_STATUS.EXCUSED,
        reason: "Should roll back",
        expectedVersion: 1,
      }),
    (err) =>
      err.code === Coaching.COACHING_ERROR_CODES.REPOSITORY_CONTRACT_VIOLATION
  );

  repositories.attendanceCorrections.append = originalAppend;

  const after = await repositories.attendance.getById(
    SCOPE_A,
    record.attendanceId
  );
  assert.equal(after.status, Coaching.ATTENDANCE_STATUS.ABSENT);
  assert.equal(after.version, 1);
  assert.equal(
    repositories.attendanceCorrections.listByAttendanceId(
      SCOPE_A,
      record.attendanceId
    ).length,
    0
  );
});

test("atomic attendance correction success increments once and appends history", async () => {
  const { service, repositories } = createApp();
  const actor = actorWith(ALL_ACTIONS);
  const program = await service.createProgram(actor, {
    ...SCOPE_A,
    name: "Atomic OK",
  });
  const session = await service.scheduleSession(actor, {
    ...SCOPE_A,
    programId: program.programId,
    startsAt: "2026-07-26T07:00:00.000Z",
    endsAt: "2026-07-26T08:00:00.000Z",
  });
  const record = await service.recordAttendance(actor, {
    ...SCOPE_A,
    sessionId: session.sessionId,
    playerId: "player-atomic-ok",
    status: Coaching.ATTENDANCE_STATUS.LATE,
  });

  const corrected = await service.correctAttendance(actor, {
    ...SCOPE_A,
    attendanceId: record.attendanceId,
    correctedStatus: Coaching.ATTENDANCE_STATUS.PRESENT,
    reason: "Clock skew",
    expectedVersion: 1,
  });

  assert.equal(corrected.attendance.status, Coaching.ATTENDANCE_STATUS.PRESENT);
  assert.equal(corrected.attendance.version, 2);
  assert.equal(
    corrected.correction.previousStatus,
    Coaching.ATTENDANCE_STATUS.LATE
  );
  assert.equal(
    repositories.attendanceCorrections.listByAttendanceId(
      SCOPE_A,
      record.attendanceId
    ).length,
    1
  );

  // Application must not call independent save+append — UoW port is required.
  assert.equal(
    typeof repositories.attendanceCorrectionUnitOfWork.applyCorrection,
    "function"
  );
  assert.match(
    fs.readFileSync(
      path.join(
        COACHING_ROOT,
        "application",
        "CoachingApplicationService.js"
      ),
      "utf8"
    ),
    /attendanceCorrectionUnitOfWork\.applyCorrection/
  );
  assert.equal(
    /attendance\.save\([\s\S]*attendanceCorrections\.append/.test(
      fs.readFileSync(
        path.join(
          COACHING_ROOT,
          "application",
          "CoachingApplicationService.js"
        ),
        "utf8"
      )
    ),
    false
  );
});

test("package entitlement usage + exhaustion", async () => {
  const { service } = createApp();
  const actor = actorWith(ALL_ACTIONS);
  const pkg = await service.createPackage(actor, {
    ...SCOPE_A,
    name: "8-session pack",
    sessionEntitlement: 2,
  });
  const entitlement = await service.grantEntitlement(actor, {
    ...SCOPE_A,
    packageId: pkg.packageId,
    playerId: "player-3",
    sessionsGranted: 2,
  });
  assert.equal(entitlement.sessionsRemaining, 2);

  const once = await service.consumeEntitlement(actor, {
    ...SCOPE_A,
    entitlementId: entitlement.entitlementId,
    expectedVersion: 1,
  });
  assert.equal(once.sessionsRemaining, 1);

  const twice = await service.consumeEntitlement(actor, {
    ...SCOPE_A,
    entitlementId: entitlement.entitlementId,
    expectedVersion: 2,
  });
  assert.equal(twice.sessionsRemaining, 0);

  await assert.rejects(
    () =>
      service.consumeEntitlement(actor, {
        ...SCOPE_A,
        entitlementId: entitlement.entitlementId,
        expectedVersion: 3,
      }),
    (err) => err.code === Coaching.COACHING_ERROR_CODES.ENTITLEMENT_EXHAUSTED
  );
});

test("evaluation submit + no silent overwrite + revision", async () => {
  const { service } = createApp();
  const actor = actorWith(ALL_ACTIONS);
  const submitted = await service.submitEvaluation(actor, {
    ...SCOPE_A,
    playerId: "player-4",
    summary: "Solid footwork",
    rating: 8,
  });
  assert.equal(submitted.status, Coaching.EVALUATION_STATUS.SUBMITTED);
  assert.equal(submitted.submittedAt, FIXED_NOW);

  assert.throws(
    () =>
      Coaching.updateCoachingEvaluationDraft(
        submitted,
        { summary: "silent" },
        { nowIso: () => FIXED_NOW },
        { expectedVersion: submitted.version }
      ),
    (err) => err.code === Coaching.COACHING_ERROR_CODES.IMMUTABLE_RECORD
  );

  const revision = await service.submitEvaluation(actor, {
    ...SCOPE_A,
    revisesEvaluationId: submitted.evaluationId,
    summary: "Revised: excellent footwork",
    rating: 9,
  });
  assert.equal(revision.revisesEvaluationId, submitted.evaluationId);
  assert.equal(revision.status, Coaching.EVALUATION_STATUS.SUBMITTED);
  assert.notEqual(revision.evaluationId, submitted.evaluationId);
});

test("authorization allow and deny + unknown action", () => {
  const actor = actorWith([Coaching.COACHING_ACTIONS.RECORDS_READ]);
  const allow = Coaching.authorizeCoaching(
    actor,
    Coaching.COACHING_ACTIONS.RECORDS_READ,
    SCOPE_A
  );
  assert.equal(allow.ok, true);

  const deny = Coaching.authorizeCoaching(
    actor,
    Coaching.COACHING_ACTIONS.PROGRAM_CREATE,
    SCOPE_A
  );
  assert.equal(deny.ok, false);
  assert.equal(deny.code, Coaching.COACHING_ERROR_CODES.FORBIDDEN_ACTION);

  const unknown = Coaching.authorizeCoaching(actor, "coaching.hack", SCOPE_A);
  assert.equal(unknown.ok, false);
  assert.equal(unknown.code, Coaching.COACHING_ERROR_CODES.FORBIDDEN_ACTION);

  const missingActor = Coaching.authorizeCoaching(
    null,
    Coaching.COACHING_ACTIONS.RECORDS_READ,
    SCOPE_A
  );
  assert.equal(missingActor.ok, false);
  assert.equal(missingActor.code, Coaching.COACHING_ERROR_CODES.MISSING_ACTOR);
});

test("missing authorization dependency fail-closed", async () => {
  const { service } = createApp({
    authorizationPort: { authorize: null },
  });
  const actor = actorWith(ALL_ACTIONS);
  await assert.rejects(
    () =>
      service.createProgram(actor, {
        ...SCOPE_A,
        name: "Blocked",
      }),
    (err) =>
      err.code === Coaching.COACHING_ERROR_CODES.DEPENDENCY_UNAVAILABLE
  );

  const malformed = Coaching.authorizeCoachingViaPort(
    {
      authorize() {
        return { ok: true };
      },
    },
    actor,
    Coaching.COACHING_ACTIONS.PROGRAM_CREATE,
    SCOPE_A
  );
  assert.equal(malformed.ok, false);
  assert.equal(
    malformed.code,
    Coaching.COACHING_ERROR_CODES.DEPENDENCY_UNAVAILABLE
  );
});

test("repository expectedVersion concurrency conflict", async () => {
  const repos = Coaching.createInMemoryCoachingRepositories();
  const deps = { nowIso: () => FIXED_NOW, nextId: (p) => `${p}_x` };
  const program = Coaching.createCoachingProgram(
    { ...SCOPE_A, name: "Concurrent" },
    deps
  );
  await repos.programs.save(program);

  const next = Coaching.updateCoachingProgram(
    program,
    { name: "Renamed" },
    deps,
    { expectedVersion: 1 }
  );
  await repos.programs.save(next, { expectedVersion: 1 });

  assert.throws(
    () => repos.programs.save(next, { expectedVersion: 1 }),
    (err) => err.code === Coaching.COACHING_ERROR_CODES.VERSION_CONFLICT
  );

  assert.equal(await repos.programs.getById(SCOPE_B, program.programId), null);
});

test("deterministic clock and identifier injection", () => {
  const clock = Coaching.createFixedCoachingClock("2026-01-02T03:04:05.000Z");
  const ids = Coaching.createSequentialCoachingIdGenerator(() => "fixed");
  assert.equal(clock.nowIso(), "2026-01-02T03:04:05.000Z");
  assert.equal(ids.nextId("prog"), "prog_fixed_1");
  assert.equal(ids.nextId("prog"), "prog_fixed_2");

  assert.throws(
    () =>
      Coaching.createCoachingProgram({
        ...SCOPE_A,
        name: "No clock",
        programId: "prog_manual",
      }),
    (err) => err.code === Coaching.COACHING_ERROR_CODES.DEPENDENCY_UNAVAILABLE
  );
});

test("canonical layers do not import legacy localStorage service", () => {
  const sources = readSources(COACHING_ROOT).filter((row) => {
    const rel = path.relative(COACHING_ROOT, row.name).replace(/\\/g, "/");
    return (
      rel.startsWith("domain/") ||
      rel.startsWith("application/") ||
      rel.startsWith("repositories/") ||
      rel.startsWith("authorization/")
    );
  });
  assert.ok(sources.length > 0);
  for (const { name, source } of sources) {
    assert.equal(
      /coachingService|pickleball-coaching-v1|localStorage/.test(source),
      false,
      name
    );
    assert.equal(/Date\.now\s*\(/.test(source), false, name);
    assert.equal(/Math\.random\s*\(/.test(source), false, name);
    assert.equal(/randomUUID\s*\(/.test(source), false, name);
  }
});

test("legacy localStorage implementation still present and isolated", () => {
  const legacyPath = path.join(
    COACHING_ROOT,
    "services",
    "coachingService.js"
  );
  assert.equal(fs.existsSync(legacyPath), true);
  const source = fs.readFileSync(legacyPath, "utf8");
  assert.match(source, /LEGACY \/ PROTOTYPE PERSISTENCE/);
  assert.match(source, /pickleball-coaching-v1/);
  assert.equal(typeof Coaching.loadCoachingStore, "function");
  assert.equal(typeof Coaching.listCoaches, "function");
  assert.equal(
    Coaching.COACHING_LEGACY_STORAGE_KEY_PREFIX,
    "pickleball-coaching-v1"
  );
});

test("Platform Core adoption metadata exposed", () => {
  const adoption = Coaching.getCoachingPlatformAdoption();
  assert.equal(adoption.phase, "COACHING-01");
  assert.equal(adoption.adapterStatus, "ADAPTER_AVAILABLE");
  assert.equal(adoption.durablePersistence, false);
  assert.equal(adoption.localStorageCanonical, false);
  assert.equal(Object.isFrozen(adoption), true);
});

test("coach assign + protected read", async () => {
  const { service } = createApp();
  const actor = actorWith(ALL_ACTIONS);
  const assigned = await service.assignCoach(actor, {
    ...SCOPE_A,
    coachPrincipalId: "principal-22",
    playerId: "player-22",
  });
  assert.ok(assigned.coachReference.coachReferenceId);
  assert.equal(assigned.relationship.playerId, "player-22");

  const records = await service.readRecords(actor, SCOPE_A);
  assert.ok(Array.isArray(records.programs));
});
