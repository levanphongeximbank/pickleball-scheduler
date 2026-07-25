/**
 * COACHING-02 — Durable persistence adapter tests (injected fake client).
 * No live database. No Supabase credentials. No localStorage.
 */

import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, test } from "node:test";
import { fileURLToPath } from "node:url";

import { COACHING_ERROR_CODES } from "../src/features/coaching/constants/errorCodes.js";
import { CoachingError, isCoachingError } from "../src/features/coaching/errors/CoachingError.js";
import {
  createAttendanceRecord,
  correctAttendanceRecord,
  createCoachingPackage,
  createPackageEntitlement,
  consumePackageEntitlement,
  createCoachingProgram,
  createFixedCoachingClock,
  createSequentialCoachingIdGenerator,
} from "../src/features/coaching/index.js";
import {
  COACHING_DURABLE_RUNTIME_DEFAULT,
  createDurableCoachingRepositories,
  createFakeCoachingDatabaseClient,
  requireCoachingDatabaseClientPort,
} from "../src/features/coaching/persistence/index.js";
import { createMemoryCoachingApplication } from "../src/features/coaching/application/index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const CLOCK = createFixedCoachingClock("2026-07-25T10:00:00.000Z");
const IDS = createSequentialCoachingIdGenerator(() => "t");
const SCOPE = { tenantId: "tenant-a", clubId: "club-a" };
const OTHER = { tenantId: "tenant-b", clubId: "club-b" };

function deps() {
  return { nowIso: CLOCK.nowIso, nextId: IDS.nextId };
}

function createHarness() {
  const db = createFakeCoachingDatabaseClient();
  const repos = createDurableCoachingRepositories({ db });
  return { db, repos };
}

describe("COACHING-02 durable adapter — injection and safety", () => {
  test("requires injected database client port (no singleton)", () => {
    assert.throws(
      () => createDurableCoachingRepositories({}),
      (err) =>
        isCoachingError(err) &&
        err.code === COACHING_ERROR_CODES.RUNTIME_NOT_CONFIGURED
    );
    assert.throws(
      () => requireCoachingDatabaseClientPort(null),
      (err) =>
        isCoachingError(err) &&
        err.code === COACHING_ERROR_CODES.RUNTIME_NOT_CONFIGURED
    );
  });

  test("durable adapter is not the runtime default", () => {
    assert.equal(COACHING_DURABLE_RUNTIME_DEFAULT, false);
    const app = createMemoryCoachingApplication();
    assert.ok(app);
    // Memory factory must not import durable path as default wiring.
    const appSrc = readFileSync(
      path.join(ROOT, "src/features/coaching/application/index.js"),
      "utf8"
    );
    assert.doesNotMatch(appSrc, /createDurableCoachingRepositories/);
    assert.doesNotMatch(appSrc, /persistence\//);
  });

  test("durable adapter does not import legacy coachingService or localStorage", () => {
    const persistenceDir = path.join(ROOT, "src/features/coaching/persistence");
    function walk(dir) {
      const out = [];
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) out.push(...walk(full));
        else if (entry.name.endsWith(".js")) out.push(full);
      }
      return out;
    }
    for (const file of walk(persistenceDir)) {
      const src = readFileSync(file, "utf8");
      const code = src
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/\/\/[^\n]*/g, "");
      assert.doesNotMatch(code, /coachingService/);
      assert.doesNotMatch(code, /\blocalStorage\b/);
      assert.doesNotMatch(code, /pickleball-coaching-v1/);
      assert.doesNotMatch(code, /createClient\s*\(/);
      assert.doesNotMatch(code, /process\.env/);
      assert.doesNotMatch(code, /SUPABASE_/);
      assert.doesNotMatch(code, /from\s+["'].*services\/coachingService/);
    }
  });

  test("legacy localStorage service still exists and UI path unchanged", () => {
    const legacy = readFileSync(
      path.join(ROOT, "src/features/coaching/services/coachingService.js"),
      "utf8"
    );
    assert.match(legacy, /localStorage/);
    assert.match(legacy, /pickleball-coaching-v1/);
  });
});

describe("COACHING-02 durable adapter — scoped CRUD and mapping", () => {
  test("create/save maps domain ↔ rows and returns domain objects", async () => {
    const { repos } = createHarness();
    const program = createCoachingProgram(
      { ...SCOPE, name: "Junior Pathway" },
      deps()
    );
    const saved = await repos.programs.save(program);
    assert.equal(saved.programId, program.programId);
    assert.equal(saved.name, "Junior Pathway");
    assert.equal(saved.tenantId, SCOPE.tenantId);
    assert.equal(saved.clubId, SCOPE.clubId);
    assert.equal(saved.version, 1);
    assert.ok(!("program_id" in saved));

    const loaded = await repos.programs.getById(SCOPE, program.programId);
    assert.deepEqual(loaded, saved);
  });

  test("list is tenant/club scoped with deterministic ordering", async () => {
    const { repos } = createHarness();
    const a = createCoachingProgram(
      { ...SCOPE, name: "B", programId: "prog_b" },
      deps()
    );
    const b = createCoachingProgram(
      { ...SCOPE, name: "A", programId: "prog_a" },
      deps()
    );
    const other = createCoachingProgram(
      { ...OTHER, name: "X", programId: "prog_x" },
      deps()
    );
    await repos.programs.save(a);
    await repos.programs.save(b);
    await repos.programs.save(other);

    const listed = await repos.programs.list(SCOPE);
    assert.equal(listed.length, 2);
    assert.deepEqual(
      listed.map((p) => p.programId),
      ["prog_a", "prog_b"]
    );

    const cross = await repos.programs.getById(OTHER, a.programId);
    assert.equal(cross, null);
    const wrongTenant = await repos.programs.getById(
      { tenantId: OTHER.tenantId, clubId: SCOPE.clubId },
      a.programId
    );
    assert.equal(wrongTenant, null);
  });

  test("missing scope fail-closed", async () => {
    const { repos } = createHarness();
    await assert.rejects(
      () => repos.programs.list({ tenantId: "t" }),
      (err) =>
        isCoachingError(err) && err.code === COACHING_ERROR_CODES.MISSING_SCOPE
    );
    await assert.rejects(
      () => repos.programs.list({}),
      (err) =>
        isCoachingError(err) && err.code === COACHING_ERROR_CODES.MISSING_SCOPE
    );
  });

  test("expectedVersion success and concurrency conflict (zero rows)", async () => {
    const { repos, db } = createHarness();
    const program = createCoachingProgram(
      { ...SCOPE, name: "V1", programId: "prog_v" },
      deps()
    );
    await repos.programs.save(program);

    const next = { ...program, name: "V2", version: 2, updatedAt: CLOCK.nowIso() };
    const saved = await repos.programs.save(next, { expectedVersion: 1 });
    assert.equal(saved.version, 2);
    assert.equal(saved.name, "V2");

    await assert.rejects(
      () =>
        repos.programs.save(
          { ...saved, name: "V3", version: 3 },
          { expectedVersion: 1 }
        ),
      (err) =>
        isCoachingError(err) &&
        err.code === COACHING_ERROR_CODES.VERSION_CONFLICT
    );

    // Simulate lost update: filter matches zero rows after version drift.
    await db.update({
      table: "coaching_programs",
      values: { version: 99, name: "hijacked" },
      filters: {
        tenant_id: SCOPE.tenantId,
        club_id: SCOPE.clubId,
        program_id: "prog_v",
      },
    });
    await assert.rejects(
      () =>
        repos.programs.save(
          { ...saved, name: "V3", version: 3 },
          { expectedVersion: 2 }
        ),
      (err) =>
        isCoachingError(err) &&
        err.code === COACHING_ERROR_CODES.VERSION_CONFLICT
    );
  });

  test("duplicate mapping on create", async () => {
    const { repos } = createHarness();
    const program = createCoachingProgram(
      { ...SCOPE, name: "Dup", programId: "prog_dup" },
      deps()
    );
    await repos.programs.save(program);
    // Second create-shaped save without expectedVersion conflicts with existing row.
    await assert.rejects(
      () => repos.programs.save({ ...program, name: "Again" }),
      (err) =>
        isCoachingError(err) &&
        (err.code === COACHING_ERROR_CODES.INVALID_INPUT ||
          err.code === COACHING_ERROR_CODES.DUPLICATE)
    );

    await repos.attendanceCorrections.append({
      correctionId: "acorr_dup",
      tenantId: SCOPE.tenantId,
      clubId: SCOPE.clubId,
      venueId: null,
      attendanceId: "att_x",
      previousStatus: "present",
      correctedStatus: "late",
      reason: "r",
      actorId: "actor",
      correctedAt: CLOCK.nowIso(),
      createdAt: CLOCK.nowIso(),
      version: 1,
    });
    await assert.rejects(
      () =>
        repos.attendanceCorrections.append({
          correctionId: "acorr_dup",
          tenantId: SCOPE.tenantId,
          clubId: SCOPE.clubId,
          venueId: null,
          attendanceId: "att_x",
          previousStatus: "present",
          correctedStatus: "late",
          reason: "r",
          actorId: "actor",
          correctedAt: CLOCK.nowIso(),
          createdAt: CLOCK.nowIso(),
          version: 1,
        }),
      (err) =>
        isCoachingError(err) && err.code === COACHING_ERROR_CODES.DUPLICATE
    );
  });

  test("not-found mapping for getById", async () => {
    const { repos } = createHarness();
    const missing = await repos.programs.getById(SCOPE, "missing");
    assert.equal(missing, null);
  });
});

describe("COACHING-02 durable adapter — atomic attendance correction", () => {
  test("applyCorrection uses single RPC and appends history", async () => {
    const db = createFakeCoachingDatabaseClient();
    let rpcCalls = 0;
    const innerRpc = db.rpc.bind(db);
    db.rpc = async (req) => {
      rpcCalls += 1;
      return innerRpc(req);
    };
    const repos = createDurableCoachingRepositories({ db });

    const attendance = createAttendanceRecord(
      {
        ...SCOPE,
        sessionId: "sess_1",
        playerId: "player_1",
        status: "present",
        attendanceId: "att_1",
      },
      deps()
    );
    await repos.attendance.save(attendance);

    const { attendance: next, correction } = correctAttendanceRecord(
      attendance,
      {
        correctedStatus: "late",
        reason: "Arrived 10 minutes late",
        actorId: "actor_1",
        correctionId: "acorr_1",
      },
      deps(),
      { expectedVersion: 1 }
    );

    const result = await repos.attendanceCorrectionUnitOfWork.applyCorrection({
      scope: SCOPE,
      attendance: next,
      correction,
      expectedVersion: 1,
    });

    assert.equal(rpcCalls, 1);
    assert.equal(result.attendance.status, "late");
    assert.equal(result.attendance.version, 2);
    assert.equal(result.correction.previousStatus, "present");
    assert.equal(result.correction.correctedStatus, "late");

    const history = await repos.attendanceCorrections.listByAttendanceId(
      SCOPE,
      "att_1"
    );
    assert.equal(history.length, 1);

    // Version conflict rolls back atomically (no partial correction)
    await assert.rejects(
      () =>
        repos.attendanceCorrectionUnitOfWork.applyCorrection({
          scope: SCOPE,
          attendance: { ...result.attendance, status: "excused", version: 3 },
          correction: {
            ...correction,
            correctionId: "acorr_2",
            previousStatus: "late",
            correctedStatus: "excused",
          },
          expectedVersion: 1,
        }),
      (err) =>
        isCoachingError(err) &&
        err.code === COACHING_ERROR_CODES.VERSION_CONFLICT
    );
    const afterFail = await repos.attendance.getById(SCOPE, "att_1");
    assert.equal(afterFail.version, 2);
    assert.equal(afterFail.status, "late");
    const historyAfter = await repos.attendanceCorrections.listByAttendanceId(
      SCOPE,
      "att_1"
    );
    assert.equal(historyAfter.length, 1);
  });
});

describe("COACHING-02 durable adapter — entitlement consume atomicity", () => {
  test("consume routes through RPC, appends usage, rejects conflict and exhaustion", async () => {
    const { repos } = createHarness();
    const pkg = createCoachingPackage(
      {
        ...SCOPE,
        name: "10-pack",
        sessionEntitlement: 2,
        status: "active",
        packageId: "pkg_1",
      },
      deps()
    );
    await repos.packages.save(pkg);

    const entitlement = createPackageEntitlement(
      {
        ...SCOPE,
        packageId: "pkg_1",
        playerId: "player_1",
        sessionsGranted: 2,
        entitlementId: "ent_1",
      },
      deps()
    );
    await repos.entitlements.save(entitlement);

    const consumed = consumePackageEntitlement(entitlement, deps(), {
      expectedVersion: 1,
    });
    const saved = await repos.entitlements.save(consumed, {
      expectedVersion: 1,
      idempotencyKey: "idem-1",
      usageEventId: "usage_1",
    });
    assert.equal(saved.sessionsConsumed, 1);
    assert.equal(saved.sessionsRemaining, 1);
    assert.equal(saved.version, 2);

    const usage = await repos._listUsageEvents(SCOPE);
    assert.equal(usage.length, 1);
    assert.equal(usage[0].idempotencyKey, "idem-1");

    // Idempotent replay does not double-consume
    const replay = await repos.entitlements.save(consumed, {
      expectedVersion: 1,
      idempotencyKey: "idem-1",
      usageEventId: "usage_1b",
    });
    assert.equal(replay.sessionsConsumed, 1);
    assert.equal((await repos._listUsageEvents(SCOPE)).length, 1);

    // Concurrent stale version
    await assert.rejects(
      () =>
        repos.entitlements.save(
          consumePackageEntitlement(entitlement, deps(), { expectedVersion: 1 }),
          { expectedVersion: 1, idempotencyKey: "idem-stale", usageEventId: "u_stale" }
        ),
      (err) =>
        isCoachingError(err) &&
        err.code === COACHING_ERROR_CODES.VERSION_CONFLICT
    );

    // Exhaust remaining
    const second = consumePackageEntitlement(saved, deps(), { expectedVersion: 2 });
    const exhausted = await repos.entitlements.save(second, {
      expectedVersion: 2,
      idempotencyKey: "idem-2",
      usageEventId: "usage_2",
    });
    assert.equal(exhausted.sessionsRemaining, 0);

    assert.throws(
      () => consumePackageEntitlement(exhausted, deps(), { expectedVersion: 3 }),
      (err) =>
        isCoachingError(err) &&
        err.code === COACHING_ERROR_CODES.ENTITLEMENT_EXHAUSTED
    );
  });
});

describe("COACHING-02 durable adapter — error typing", () => {
  test("known persistence failures throw CoachingError not generic Error", async () => {
    const { repos } = createHarness();
    try {
      await repos.attendanceCorrections.append({
        correctionId: "acorr_err",
        tenantId: SCOPE.tenantId,
        clubId: SCOPE.clubId,
        venueId: null,
        attendanceId: "att_err",
        previousStatus: "present",
        correctedStatus: "absent",
        reason: "typo",
        actorId: "actor",
        correctedAt: CLOCK.nowIso(),
        createdAt: CLOCK.nowIso(),
        version: 1,
      });
      await repos.attendanceCorrections.append({
        correctionId: "acorr_err",
        tenantId: SCOPE.tenantId,
        clubId: SCOPE.clubId,
        venueId: null,
        attendanceId: "att_err",
        previousStatus: "present",
        correctedStatus: "absent",
        reason: "typo",
        actorId: "actor",
        correctedAt: CLOCK.nowIso(),
        createdAt: CLOCK.nowIso(),
        version: 1,
      });
      assert.fail("expected duplicate");
    } catch (err) {
      assert.ok(err instanceof CoachingError);
      assert.equal(err.code, COACHING_ERROR_CODES.DUPLICATE);
      assert.equal(err.name, "CoachingError");
    }
  });
});

describe("COACHING-02 durable adapter — actor integrity", () => {
  test("correction actor_id comes from auth.uid; forged p_actor_id is rejected", async () => {
    const AUTH = "11111111-1111-4111-8111-111111111111";
    const db = createFakeCoachingDatabaseClient({ authUid: AUTH });
    const repos = createDurableCoachingRepositories({ db });
    const attendance = createAttendanceRecord(
      {
        ...SCOPE,
        sessionId: "sess_actor",
        playerId: "player_1",
        status: "present",
        attendanceId: "att_actor",
      },
      deps()
    );
    await repos.attendance.save(attendance);
    const { attendance: next, correction } = correctAttendanceRecord(
      attendance,
      {
        correctedStatus: "late",
        reason: "late arrival",
        actorId: "forged-should-be-ignored",
        correctionId: "acorr_actor",
      },
      deps(),
      { expectedVersion: 1 }
    );
    const result = await repos.attendanceCorrectionUnitOfWork.applyCorrection({
      scope: SCOPE,
      attendance: next,
      correction,
      expectedVersion: 1,
    });
    assert.equal(result.correction.actorId, AUTH);
    assert.notEqual(result.correction.actorId, "forged-should-be-ignored");

    await assert.rejects(
      () =>
        db.rpc({
          fn: "coaching_apply_attendance_correction",
          args: {
            p_tenant_id: SCOPE.tenantId,
            p_club_id: SCOPE.clubId,
            p_attendance_id: "att_actor",
            p_expected_version: 2,
            p_corrected_status: "excused",
            p_reason: "x",
            p_actor_id: "forged",
            p_correction_id: "acorr_forged",
          },
        }),
      (err) => /forged actor_id|FORBIDDEN/i.test(String(err.message || err))
    );
  });

  test("RPC rejects missing auth.uid", async () => {
    const db = createFakeCoachingDatabaseClient({ authUid: null });
    await assert.rejects(
      () =>
        db.rpc({
          fn: "coaching_consume_entitlement",
          args: {
            p_tenant_id: SCOPE.tenantId,
            p_club_id: SCOPE.clubId,
            p_entitlement_id: "ent_x",
            p_expected_version: 1,
            p_player_id: "p1",
            p_idempotency_key: "k",
            p_usage_event_id: "u",
          },
        }),
      (err) => /COACHING_MISSING_ACTOR/i.test(String(err.message || err))
    );
  });
});
