/**
 * Core-03 Phase 1F — Persistence Foundation tests.
 * Run: node --test tests/competition-core-registration-eligibility-core03-phase1f.test.js
 */

import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

import {
  REGISTRATION_STATUS,
  REGISTRATION_TARGET_TYPE,
  REGISTRATION_ELIGIBILITY_ERROR_CODE,
  ELIGIBILITY_OUTCOME,
  ELIGIBILITY_CHECK_TYPE,
  ELIGIBILITY_REASON_SEVERITY,
  PERSISTENCE_FOUNDATION_VERSION,
  CORE03_PHASE_1F_MIGRATION_STATUS,
  createRegistrationTarget,
  createCompetitionRegistration,
  createRegistrationIdempotencyRecord,
  createEligibilityEvaluationEvidence,
  createEligibilityReason,
  createEligibilityCheckResult,
  createRegistrationAuditEvent,
  createCapacityReservation,
  createWaitlistEntry,
  createFixedClockPort,
  createSequentialIdGeneratorPort,
  createCore02EntryCreationAdapter,
  ENTRY_CREATION_COMPATIBILITY_GAP,
  createCore03PersistenceRepositories,
  createCore03MemoryPersistenceStore,
  buildInsertRegistrationSql,
  buildInsertAuditEventSql,
  isSafeParameterizedStatement,
  createParameterizedSqlStatement,
  runPersistenceTransaction,
} from "../src/features/competition-core/registration-eligibility/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..");
const MODULE_ROOT = join(
  REPO_ROOT,
  "src/features/competition-core/registration-eligibility"
);
const PERSISTENCE_ROOT = join(MODULE_ROOT, "persistence");
const SQL_PATH = join(
  REPO_ROOT,
  "docs/competition-engine/core-03/supabase-core03-phase1f-persistence.sql"
);
const CLOCK = createFixedClockPort("2026-07-20T08:00:00.000Z");
const NOW = CLOCK.nowIso();
const IDS = createSequentialIdGeneratorPort("p1f");

function collectJsFiles(root) {
  /** @type {string[]} */
  const out = [];
  for (const name of readdirSync(root)) {
    const full = join(root, name);
    const st = statSync(full);
    if (st.isDirectory()) out.push(...collectJsFiles(full));
    else if (name.endsWith(".js")) out.push(full);
  }
  return out;
}

function baseRegistration(overrides = {}) {
  const {
    participantId = "p-1",
    target,
    id,
    registrationRequestId,
    competitionId = "comp-1",
    divisionId = "div-1",
    status = REGISTRATION_STATUS.DRAFT,
    idempotencyKey = null,
    stateVersion = 0,
    createdAt = NOW,
    updatedAt = NOW,
    ...rest
  } = overrides;
  return createCompetitionRegistration({
    id: id || IDS.nextId("reg"),
    registrationRequestId: registrationRequestId || IDS.nextId("req"),
    competitionId,
    divisionId,
    status,
    target:
      target ||
      createRegistrationTarget({
        targetType: REGISTRATION_TARGET_TYPE.INDIVIDUAL,
        participantId,
      }),
    idempotencyKey,
    stateVersion,
    createdAt,
    updatedAt,
    ...rest,
  });
}

function createPersistence() {
  return createCore03PersistenceRepositories();
}

// ---------------------------------------------------------------------------
// 1–8 Registration persistence
// ---------------------------------------------------------------------------

test("1. Registration persistence round trip", async () => {
  const p = createPersistence();
  const reg = baseRegistration({ id: "reg-rt-1", registrationRequestId: "req-rt-1" });
  const saved = await p.registration.save(reg);
  const loaded = await p.registration.getById("reg-rt-1");
  assert.equal(saved.id, "reg-rt-1");
  assert.equal(loaded?.id, "reg-rt-1");
  assert.equal(loaded?.competitionId, "comp-1");
  assert.equal(loaded?.status, REGISTRATION_STATUS.DRAFT);
});

test("2. Defensive read copies", async () => {
  const p = createPersistence();
  const reg = baseRegistration({ id: "reg-def-1", registrationRequestId: "req-def-1" });
  await p.registration.save(reg);
  const a = await p.registration.getById("reg-def-1");
  const b = await p.registration.getById("reg-def-1");
  assert.notEqual(a, b);
  a.status = REGISTRATION_STATUS.APPROVED;
  assert.equal(b.status, REGISTRATION_STATUS.DRAFT);
  const again = await p.registration.getById("reg-def-1");
  assert.equal(again.status, REGISTRATION_STATUS.DRAFT);
});

test("3. Registration ID uniqueness", async () => {
  const p = createPersistence();
  await p.registration.save(
    baseRegistration({ id: "reg-uid-1", registrationRequestId: "req-uid-1", stateVersion: 0 })
  );
  await assert.rejects(
    () =>
      p.registration.save(
        baseRegistration({
          id: "reg-uid-1",
          registrationRequestId: "req-uid-2",
          stateVersion: 0,
          participantId: "p-2",
        }),
        { expectedStateVersion: 999 }
      ),
    (err) => err.code === REGISTRATION_ELIGIBILITY_ERROR_CODE.STALE_REGISTRATION_VERSION
  );
});

test("4. Registration request ID uniqueness", async () => {
  const p = createPersistence();
  await p.registration.save(
    baseRegistration({ id: "reg-req-1", registrationRequestId: "same-req", participantId: "p-1" })
  );
  await assert.rejects(
    () =>
      p.registration.save(
        baseRegistration({
          id: "reg-req-2",
          registrationRequestId: "same-req",
          participantId: "p-2",
        })
      ),
    (err) =>
      err.code === REGISTRATION_ELIGIBILITY_ERROR_CODE.DUPLICATE_REGISTRATION_REQUEST_ID
  );
});

test("5. Registration idempotency uniqueness", async () => {
  const p = createPersistence();
  const record = createRegistrationIdempotencyRecord({
    idempotencyKey: "REG_IDEMP::comp-1::div-1::INDIVIDUAL:p-1::r1",
    registrationId: "reg-idem-1",
    registrationRequestId: "req-idem-1",
    competitionId: "comp-1",
    divisionId: "div-1",
    targetType: REGISTRATION_TARGET_TYPE.INDIVIDUAL,
    targetStableIdentity: "INDIVIDUAL:p-1",
    createdAt: NOW,
  });
  await p.registration.saveIdempotencyRecord(record);
  await assert.rejects(
    () =>
      p.registration.saveIdempotencyRecord({
        ...record,
        registrationId: "reg-idem-2",
      }),
    (err) => err.code === REGISTRATION_ELIGIBILITY_ERROR_CODE.IDEMPOTENCY_CONFLICT
  );
});

test("6. Active target identity conflict", async () => {
  const p = createPersistence();
  await p.registration.save(
    baseRegistration({
      id: "reg-id-1",
      registrationRequestId: "req-id-1",
      participantId: "p-same",
      status: REGISTRATION_STATUS.SUBMITTED,
    })
  );
  await assert.rejects(
    () =>
      p.registration.save(
        baseRegistration({
          id: "reg-id-2",
          registrationRequestId: "req-id-2",
          participantId: "p-same",
          status: REGISTRATION_STATUS.DRAFT,
        })
      ),
    (err) => err.code === REGISTRATION_ELIGIBILITY_ERROR_CODE.DUPLICATE_REGISTRATION
  );
});

test("7. Missing scope fails closed", async () => {
  const p = createPersistence();
  await assert.rejects(
    () =>
      p.registration.save({
        id: "reg-noscope",
        registrationRequestId: "req-noscope",
        competitionId: "",
        target: createRegistrationTarget({
          targetType: REGISTRATION_TARGET_TYPE.INDIVIDUAL,
          participantId: "p-1",
        }),
      }),
    (err) => err instanceof TypeError || err.code === REGISTRATION_ELIGIBILITY_ERROR_CODE.PERSISTENCE_SCOPE_REQUIRED
  );
  await assert.rejects(() => p.capacityState.listByCompetition(""));
});

test("8. Stale registration version rejected", async () => {
  const p = createPersistence();
  await p.registration.save(
    baseRegistration({ id: "reg-stale", registrationRequestId: "req-stale", stateVersion: 1 })
  );
  await assert.rejects(
    () =>
      p.registration.save(
        baseRegistration({
          id: "reg-stale",
          registrationRequestId: "req-stale",
          stateVersion: 2,
          status: REGISTRATION_STATUS.SUBMITTED,
        }),
        { expectedStateVersion: 0 }
      ),
    (err) => err.code === REGISTRATION_ELIGIBILITY_ERROR_CODE.STALE_REGISTRATION_VERSION
  );
});

// ---------------------------------------------------------------------------
// 9–12 Eligibility / evidence
// ---------------------------------------------------------------------------

test("9. Eligibility decision round trip", async () => {
  const p = createPersistence();
  const reasons = [
    createEligibilityReason({
      code: "OK",
      checkType: ELIGIBILITY_CHECK_TYPE.PARTICIPANT_STATUS,
      severity: ELIGIBILITY_REASON_SEVERITY.INFO,
      message: "ok",
    }),
  ];
  const evidence = createEligibilityEvaluationEvidence({
    id: "ev-1",
    evaluationRequestId: "eval-1",
    registrationId: "reg-ev-1",
    competitionId: "comp-1",
    divisionId: "div-1",
    outcome: ELIGIBILITY_OUTCOME.ELIGIBLE,
    evaluatedAt: NOW,
    reasons,
    checkResults: [
      createEligibilityCheckResult({
        checkType: ELIGIBILITY_CHECK_TYPE.PARTICIPANT_STATUS,
        passed: true,
        reasons,
      }),
    ],
    requiredCheckTypes: [ELIGIBILITY_CHECK_TYPE.PARTICIPANT_STATUS],
    canonicalRequestFingerprint: "fp-ev-1",
  });
  const saved = await p.eligibilityEvidence.saveEvidence(evidence);
  const loaded = await p.eligibilityEvidence.getLatestByRegistrationId("reg-ev-1");
  assert.equal(saved.id, "ev-1");
  assert.equal(loaded?.outcome, ELIGIBILITY_OUTCOME.ELIGIBLE);
});

test("10. Ordered reasons preserved", async () => {
  const p = createPersistence();
  const reasons = [
    createEligibilityReason({
      code: "B",
      checkType: ELIGIBILITY_CHECK_TYPE.AGE_REQUIREMENT,
      severity: ELIGIBILITY_REASON_SEVERITY.BLOCKING,
      message: "too young",
    }),
    createEligibilityReason({
      code: "A",
      checkType: ELIGIBILITY_CHECK_TYPE.PARTICIPANT_STATUS,
      severity: ELIGIBILITY_REASON_SEVERITY.INFO,
      message: "info",
    }),
  ];
  await p.eligibilityEvidence.saveEvidence(
    createEligibilityEvaluationEvidence({
      id: "ev-ord",
      evaluationRequestId: "eval-ord",
      registrationId: "reg-ord",
      competitionId: "comp-1",
      outcome: ELIGIBILITY_OUTCOME.INELIGIBLE,
      evaluatedAt: NOW,
      reasons,
      checkResults: [],
      requiredCheckTypes: [],
      canonicalRequestFingerprint: "fp-ord",
    })
  );
  const loaded = await p.eligibilityEvidence.getById("ev-ord");
  assert.equal(loaded.reasons[0].severity, ELIGIBILITY_REASON_SEVERITY.BLOCKING);
  assert.equal(loaded.reasons[0].code, "B");
});

test("11. Evaluation fingerprint uniqueness", async () => {
  const p = createPersistence();
  const base = {
    competitionId: "comp-1",
    outcome: ELIGIBILITY_OUTCOME.ELIGIBLE,
    evaluatedAt: NOW,
    reasons: [],
    checkResults: [],
    requiredCheckTypes: [],
    canonicalRequestFingerprint: "fp-unique",
  };
  await p.eligibilityEvidence.saveEvidence(
    createEligibilityEvaluationEvidence({
      ...base,
      id: "ev-fp-1",
      evaluationRequestId: "eval-fp-1",
      registrationId: "reg-fp-1",
    })
  );
  await assert.rejects(
    () =>
      p.eligibilityEvidence.saveEvidence(
        createEligibilityEvaluationEvidence({
          ...base,
          id: "ev-fp-2",
          evaluationRequestId: "eval-fp-2",
          registrationId: "reg-fp-2",
        })
      ),
    (err) =>
      err.code === REGISTRATION_ELIGIBILITY_ERROR_CODE.DUPLICATE_EVALUATION_FINGERPRINT
  );
});

test("12. Evaluation replay returns same logical record", async () => {
  const p = createPersistence();
  const evidence = createEligibilityEvaluationEvidence({
    id: "ev-replay",
    evaluationRequestId: "eval-replay",
    registrationId: "reg-replay",
    competitionId: "comp-1",
    outcome: ELIGIBILITY_OUTCOME.ELIGIBLE,
    evaluatedAt: NOW,
    reasons: [],
    checkResults: [],
    requiredCheckTypes: [],
    canonicalRequestFingerprint: "fp-replay",
  });
  const first = await p.eligibilityEvidence.saveEvidence(evidence);
  const second = await p.eligibilityEvidence.saveEvidence(evidence);
  assert.equal(first.id, second.id);
  assert.equal(second.evaluationRequestId, "eval-replay");
});

// ---------------------------------------------------------------------------
// 13–19 Capacity / reservation
// ---------------------------------------------------------------------------

test("13. Capacity state round trip", async () => {
  const p = createPersistence();
  const saved = await p.capacityState.saveState({
    competitionId: "comp-1",
    divisionId: "div-1",
    limit: 10,
    used: 2,
    reserved: 1,
    stateVersion: 1,
    updatedAt: NOW,
  });
  const loaded = await p.capacityState.getState("comp-1", "div-1");
  assert.equal(saved.limit, 10);
  assert.equal(loaded.used, 2);
  assert.equal(loaded.reserved, 1);
});

test("14. Negative capacity rejected", async () => {
  const p = createPersistence();
  await assert.rejects(
    () =>
      p.capacityState.saveState({
        competitionId: "comp-1",
        divisionId: null,
        limit: 5,
        used: -1,
        reserved: 0,
        stateVersion: 1,
      }),
    (err) =>
      err.code === REGISTRATION_ELIGIBILITY_ERROR_CODE.INVALID_CAPACITY_CONFIGURATION
  );
});

test("15. Over-limit capacity rejected", async () => {
  const p = createPersistence();
  await assert.rejects(
    () =>
      p.capacityState.saveState({
        competitionId: "comp-1",
        divisionId: null,
        limit: 2,
        used: 2,
        reserved: 1,
        stateVersion: 1,
      }),
    (err) =>
      err.code === REGISTRATION_ELIGIBILITY_ERROR_CODE.INVALID_CAPACITY_CONFIGURATION
  );
});

test("16. Stale capacity version rejected", async () => {
  const p = createPersistence();
  await p.capacityState.saveState({
    competitionId: "comp-1",
    divisionId: "div-s",
    limit: 5,
    used: 0,
    reserved: 0,
    stateVersion: 3,
  });
  await assert.rejects(
    () =>
      p.capacityState.saveState(
        {
          competitionId: "comp-1",
          divisionId: "div-s",
          limit: 5,
          used: 1,
          reserved: 0,
          stateVersion: 4,
        },
        { expectedStateVersion: 1 }
      ),
    (err) => err.code === REGISTRATION_ELIGIBILITY_ERROR_CODE.STALE_CAPACITY_VERSION
  );
});

test("17. Reservation persistence consumes one reservation", async () => {
  const p = createPersistence();
  await p.capacityState.saveState({
    competitionId: "comp-1",
    divisionId: "div-r",
    limit: 2,
    used: 0,
    reserved: 0,
    stateVersion: 0,
  });
  const reservation = createCapacityReservation({
    reservationId: "res-1",
    registrationId: "reg-res-1",
    competitionId: "comp-1",
    divisionId: "div-r",
    status: "ACTIVE",
    reservedAt: NOW,
    stateVersion: 1,
    requestId: "cap-req-1",
    operationFingerprint: "cap-fp-1",
  });
  await p.capacityReservations.save(reservation);
  await p.capacityState.saveState(
    {
      competitionId: "comp-1",
      divisionId: "div-r",
      limit: 2,
      used: 0,
      reserved: 1,
      stateVersion: 1,
    },
    { expectedStateVersion: 0 }
  );
  const state = await p.capacityState.getState("comp-1", "div-r");
  assert.equal(state.reserved, 1);
  const active = await p.capacityReservations.findActiveByRegistrationId("reg-res-1");
  assert.equal(active?.reservationId, "res-1");
});

test("18. Duplicate active reservation rejected", async () => {
  const p = createPersistence();
  await p.capacityReservations.save(
    createCapacityReservation({
      reservationId: "res-a",
      registrationId: "reg-dup-res",
      competitionId: "comp-1",
      status: "ACTIVE",
      reservedAt: NOW,
      stateVersion: 1,
    })
  );
  await assert.rejects(
    () =>
      p.capacityReservations.save(
        createCapacityReservation({
          reservationId: "res-b",
          registrationId: "reg-dup-res",
          competitionId: "comp-1",
          status: "ACTIVE",
          reservedAt: NOW,
          stateVersion: 1,
        })
      ),
    (err) =>
      err.code === REGISTRATION_ELIGIBILITY_ERROR_CODE.DUPLICATE_ACTIVE_RESERVATION
  );
});

test("19. Release is idempotent", async () => {
  const p = createPersistence();
  const active = createCapacityReservation({
    reservationId: "res-rel",
    registrationId: "reg-rel",
    competitionId: "comp-1",
    status: "ACTIVE",
    reservedAt: NOW,
    stateVersion: 1,
  });
  await p.capacityReservations.save(active);
  const released = createCapacityReservation({
    ...active,
    status: "RELEASED",
    releasedAt: NOW,
    releaseReason: "WITHDRAWN",
    stateVersion: 2,
  });
  await p.capacityReservations.save(released);
  const again = await p.capacityReservations.save(released);
  assert.equal(again.status, "RELEASED");
  assert.equal(await p.capacityReservations.findActiveByRegistrationId("reg-rel"), null);
});

// ---------------------------------------------------------------------------
// 20–22 Waitlist
// ---------------------------------------------------------------------------

test("20. Waitlist entry round trip", async () => {
  const p = createPersistence();
  const entry = createWaitlistEntry({
    waitlistEntryId: "wl-1",
    registrationId: "reg-wl-1",
    competitionId: "comp-1",
    divisionId: "div-1",
    status: "ACTIVE",
    priorityRank: 10,
    submittedAt: NOW,
    waitlistedAt: NOW,
    waitlistVersion: 0,
    requestId: "wl-req-1",
    operationFingerprint: "wl-fp-1",
  });
  const saved = await p.waitlist.save(entry);
  const loaded = await p.waitlist.getById("wl-1");
  assert.equal(saved.waitlistEntryId, "wl-1");
  assert.equal(loaded?.priorityRank, 10);
  assert.ok(loaded.waitlistVersion >= 1);
});

test("21. Duplicate active waitlist entry rejected", async () => {
  const p = createPersistence();
  await p.waitlist.save(
    createWaitlistEntry({
      waitlistEntryId: "wl-a",
      registrationId: "reg-wl-dup",
      competitionId: "comp-1",
      status: "ACTIVE",
      waitlistedAt: NOW,
      waitlistVersion: 0,
    })
  );
  await assert.rejects(
    () =>
      p.waitlist.save(
        createWaitlistEntry({
          waitlistEntryId: "wl-b",
          registrationId: "reg-wl-dup",
          competitionId: "comp-1",
          status: "ACTIVE",
          waitlistedAt: NOW,
          waitlistVersion: 0,
        })
      ),
    (err) =>
      err.code === REGISTRATION_ELIGIBILITY_ERROR_CODE.WAITLIST_ENTRY_ALREADY_EXISTS
  );
});

test("22. Waitlist ordering fields preserved", async () => {
  const p = createPersistence();
  await p.waitlist.save(
    createWaitlistEntry({
      waitlistEntryId: "wl-ord-1",
      registrationId: "reg-wl-ord-1",
      competitionId: "comp-1",
      divisionId: "div-ord",
      status: "ACTIVE",
      priorityRank: 5,
      submittedAt: "2026-07-20T07:00:00.000Z",
      waitlistedAt: "2026-07-20T07:30:00.000Z",
      waitlistVersion: 0,
    })
  );
  const loaded = await p.waitlist.getById("wl-ord-1");
  assert.equal(loaded.priorityRank, 5);
  assert.equal(loaded.submittedAt, "2026-07-20T07:00:00.000Z");
  assert.equal(loaded.waitlistedAt, "2026-07-20T07:30:00.000Z");
});

// ---------------------------------------------------------------------------
// 23–25 Audit + partial success
// ---------------------------------------------------------------------------

test("23. Audit append is immutable", async () => {
  const p = createPersistence();
  const event = createRegistrationAuditEvent({
    id: "aud-1",
    registrationId: "reg-aud-1",
    eventType: "REGISTRATION_CREATED",
    occurredAt: NOW,
    competitionId: "comp-1",
    divisionId: "div-1",
    actorId: "system",
    serviceVersion: PERSISTENCE_FOUNDATION_VERSION,
  });
  await p.audit.append(event);
  const listed = await p.audit.listByRegistration("reg-aud-1");
  assert.equal(listed.length, 1);
  assert.equal(Object.isFrozen(listed[0]), true);
  assert.throws(() => {
    listed[0].eventType = "MUTATED";
  });
  const again = await p.audit.listByRegistration("reg-aud-1");
  assert.equal(again[0].eventType, "REGISTRATION_CREATED");
});

test("24. Audit update/delete rejected or unavailable", async () => {
  const p = createPersistence();
  await assert.rejects(
    () => p.audit.update(),
    (err) => err.code === REGISTRATION_ELIGIBILITY_ERROR_CODE.AUDIT_IMMUTABLE
  );
  await assert.rejects(
    () => p.audit.delete(),
    (err) => err.code === REGISTRATION_ELIGIBILITY_ERROR_CODE.AUDIT_IMMUTABLE
  );
});

test("25. Partial-success metadata persists", async () => {
  const p = createPersistence();
  const event = createRegistrationAuditEvent({
    id: "aud-ps",
    registrationId: "reg-ps",
    eventType: "PARTIAL_SUCCESS",
    occurredAt: NOW,
    reconciliationRequired: true,
    partialSuccess: {
      completedSteps: ["reserve"],
      failedSteps: ["audit"],
    },
  });
  await p.audit.append(event);
  const listed = await p.audit.listByRegistration("reg-ps");
  assert.equal(listed[0].reconciliationRequired, true);
  assert.deepEqual(listed[0].partialSuccess.completedSteps, ["reserve"]);
  const rec = await p.store.saveReconciliationRecord({
    id: "recon-1",
    operation: "reserve",
    completedSteps: ["reserve"],
    failedSteps: ["audit"],
    reconciliationRequired: true,
  });
  assert.equal(rec.reconciliationRequired, true);
  assert.equal((await p.store.getReconciliationRecord("recon-1")).id, "recon-1");
});

// ---------------------------------------------------------------------------
// 26–28 Transactions
// ---------------------------------------------------------------------------

test("26. Transaction success path", async () => {
  const p = createPersistence();
  const result = await p.runTransaction({
    operation: "create-draft",
    steps: [
      async () => {
        await p.registration.save(
          baseRegistration({ id: "reg-tx-ok", registrationRequestId: "req-tx-ok" })
        );
      },
      async () => {
        await p.audit.append(
          createRegistrationAuditEvent({
            id: "aud-tx-ok",
            registrationId: "reg-tx-ok",
            eventType: "DRAFT_CREATED",
            occurredAt: NOW,
          })
        );
      },
    ],
  });
  assert.equal(result.ok, true);
  assert.equal(result.atomic, true);
  assert.equal(result.rolledBack, false);
  assert.ok(await p.registration.getById("reg-tx-ok"));
});

test("27. Transaction failure rolls back where transaction adapter supports it", async () => {
  const p = createPersistence();
  const result = await p.runTransaction({
    operation: "create-draft-fail",
    steps: [
      async () => {
        await p.registration.save(
          baseRegistration({ id: "reg-tx-fail", registrationRequestId: "req-tx-fail" })
        );
      },
      async () => {
        throw new Error("forced-failure");
      },
    ],
  });
  assert.equal(result.ok, false);
  assert.equal(result.rolledBack, true);
  assert.equal(result.atomic, true);
  assert.equal(await p.registration.getById("reg-tx-fail"), null);
});

test("28. Reconciliation flag returned where rollback is unavailable", async () => {
  const store = {
    supportsTransactions: false,
    async saveReconciliationRecord(record) {
      return record;
    },
  };
  const result = await runPersistenceTransaction({
    store,
    operation: "non-atomic",
    reconciliationId: "recon-non-atomic",
    steps: [
      async () => "step-1",
      async () => {
        throw new Error("boom");
      },
    ],
  });
  assert.equal(result.ok, false);
  assert.equal(result.rolledBack, false);
  assert.equal(result.atomic, false);
  assert.equal(result.partialSuccess?.reconciliationRequired, true);
  assert.deepEqual(result.partialSuccess?.completedSteps, ["non-atomic:step-1"]);
});

// ---------------------------------------------------------------------------
// 29–32 Query safety / no Date.now / no random
// ---------------------------------------------------------------------------

test("29. Parameterized-query or safe-query-builder audit", () => {
  const stmt = buildInsertRegistrationSql({
    id: "reg-sql",
    registrationRequestId: "req-sql",
    competitionId: "comp-1",
    status: "DRAFT",
    targetType: "INDIVIDUAL",
    targetStableIdentity: "INDIVIDUAL:p-1",
  });
  assert.equal(isSafeParameterizedStatement(stmt), true);
  assert.equal(stmt.values[0], "reg-sql");
  assert.ok(!stmt.text.includes("reg-sql"));
});

test("30. No raw SQL interpolation of request values", () => {
  const evil = "'; DROP TABLE users; --";
  const stmt = buildInsertAuditEventSql({
    id: "aud-sql",
    registrationId: evil,
    eventType: "X",
    occurredAt: NOW,
  });
  assert.ok(!stmt.text.includes(evil));
  assert.equal(stmt.values[1], evil);
  assert.throws(() =>
    createParameterizedSqlStatement("SELECT * FROM t WHERE id = '${id}'", [], "bad")
  );
});

test("31. No direct Date.now usage", () => {
  const files = collectJsFiles(PERSISTENCE_ROOT);
  for (const file of files) {
    const src = readFileSync(file, "utf8");
    assert.equal(
      /Date\.now\s*\(/.test(src),
      false,
      `Date.now found in ${relative(REPO_ROOT, file)}`
    );
  }
});

test("32. No random ID generation", () => {
  const files = collectJsFiles(PERSISTENCE_ROOT);
  for (const file of files) {
    const src = readFileSync(file, "utf8");
    assert.equal(
      /Math\.random\s*\(|crypto\.randomUUID\s*\(|uuidv4\s*\(/.test(src),
      false,
      `random ID generation found in ${relative(REPO_ROOT, file)}`
    );
  }
});

// ---------------------------------------------------------------------------
// 33–36 Core-02 boundary / no Production DB
// ---------------------------------------------------------------------------

test("33. No Core-02 Entry creation", async () => {
  const p = createPersistence();
  assert.equal(p.entryCreationDeferred, "DEFERRED_FAIL_CLOSED");
  const files = collectJsFiles(PERSISTENCE_ROOT);
  for (const file of files) {
    const src = readFileSync(file, "utf8");
    assert.equal(
      /createEntryFromRegistration|EntryRepositoryPort\.save|createCompetitionEntry/.test(
        src
      ),
      false,
      `Entry creation reference in ${relative(REPO_ROOT, file)}`
    );
  }
});

test("34. EntryCreationPort remains DEFERRED_FAIL_CLOSED", async () => {
  assert.equal(ENTRY_CREATION_COMPATIBILITY_GAP.status, "DEFERRED_FAIL_CLOSED");
  const adapter = createCore02EntryCreationAdapter({ clock: CLOCK });
  const result = await adapter.createEntryFromRegistration({
    registrationId: "reg-1",
    competitionId: "comp-1",
    target: createRegistrationTarget({
      targetType: REGISTRATION_TARGET_TYPE.INDIVIDUAL,
      participantId: "p-1",
    }),
  });
  assert.equal(result.ok, false);
  assert.equal(
    result.errorCode,
    REGISTRATION_ELIGIBILITY_ERROR_CODE.ENTRY_CREATION_ADAPTER_UNAVAILABLE
  );
});

test("35. No direct sibling private imports", () => {
  const files = collectJsFiles(PERSISTENCE_ROOT);
  const forbidden = [
    "/participants/",
    "/constraints/",
    "/classification/",
    "/teams/",
    "/registrations/",
  ];
  for (const file of files) {
    const src = readFileSync(file, "utf8");
    for (const pattern of forbidden) {
      assert.equal(
        src.includes(`competition-core${pattern}`) ||
          src.includes(`../..${pattern}`) ||
          /from\s+["'].*participants\//.test(src),
        false,
        `sibling private import in ${relative(REPO_ROOT, file)}`
      );
    }
  }
});

test("36. No Production database connection", () => {
  const p = createPersistence();
  assert.equal(p.databaseConnected, false);
  assert.equal(p.sqlApplied, false);
  const files = collectJsFiles(PERSISTENCE_ROOT);
  for (const file of files) {
    const src = readFileSync(file, "utf8");
    assert.equal(
      /createClient\s*\(|postgres\s*\(|pg\.Pool|DATABASE_URL|supabase\.from\s*\(/.test(
        src
      ),
      false,
      `DB connection pattern in ${relative(REPO_ROOT, file)}`
    );
  }
});

// ---------------------------------------------------------------------------
// 37 Migration authored not applied
// ---------------------------------------------------------------------------

test("37. Migration SQL is authored but not applied", () => {
  assert.equal(existsSync(SQL_PATH), true);
  assert.equal(CORE03_PHASE_1F_MIGRATION_STATUS.authored, true);
  assert.equal(CORE03_PHASE_1F_MIGRATION_STATUS.applied, false);
  const sql = readFileSync(SQL_PATH, "utf8");
  const sqlWithoutComments = sql
    .split("\n")
    .filter((line) => !line.trim().startsWith("--"))
    .join("\n");
  assert.match(sql, /core03_competition_registrations/);
  assert.match(sql, /DO NOT APPLY/i);
  assert.match(sql, /core03_registration_audit_events/);
  assert.equal(/using\s*\(\s*true\s*\)/i.test(sqlWithoutComments), false);
  assert.equal(/with\s+check\s*\(\s*true\s*\)/i.test(sqlWithoutComments), false);
  assert.match(sqlWithoutComments, /using\s*\(\s*false\s*\)/i);
  assert.match(sql, /TENANT_CLIENT_RLS_POLICY\s*=\s*DEFERRED_FAIL_CLOSED/);
  assert.match(sql, /MIGRATION_STATUS\s*=\s*AUTHORED_NOT_APPLIED/);
  assert.equal(CORE03_PHASE_1F_MIGRATION_STATUS.status, "AUTHORED_NOT_APPLIED");
  assert.equal(
    CORE03_PHASE_1F_MIGRATION_STATUS.tenantClientRlsPolicy,
    "DEFERRED_FAIL_CLOSED"
  );
  assert.equal(
    CORE03_PHASE_1F_MIGRATION_STATUS.core02EntryCreation,
    "DEFERRED_FAIL_CLOSED"
  );
});


// ---------------------------------------------------------------------------
// 38–42 Phase regression markers (executed via separate node --test runs;
//       these assert prior phase modules/exports remain intact)
// ---------------------------------------------------------------------------

test("38. Phase 1E regression surface intact", async () => {
  const { createCore03SiblingAdapters, createFakeSiblingFacades, SIBLING_ADAPTERS_VERSION } =
    await import("../src/features/competition-core/registration-eligibility/index.js");
  assert.ok(typeof createCore03SiblingAdapters === "function");
  assert.ok(typeof createFakeSiblingFacades === "function");
  assert.equal(SIBLING_ADAPTERS_VERSION, "core03-sibling-adapters-1.0.0");
  assert.equal(
    existsSync(
      join(REPO_ROOT, "tests/competition-core-registration-eligibility-core03-phase1e.test.js")
    ),
    true
  );
});

test("39. Phase 1D regression surface intact", async () => {
  const { createCapacityWaitlistService, CAPACITY_WAITLIST_SERVICE_VERSION } = await import(
    "../src/features/competition-core/registration-eligibility/index.js"
  );
  assert.ok(typeof createCapacityWaitlistService === "function");
  assert.equal(CAPACITY_WAITLIST_SERVICE_VERSION, "core03-capacity-waitlist-1.0.0");
});

test("40. Phase 1C regression surface intact", async () => {
  const { createEligibilityEvaluationService, ELIGIBILITY_EVALUATION_SERVICE_VERSION } =
    await import("../src/features/competition-core/registration-eligibility/index.js");
  assert.ok(typeof createEligibilityEvaluationService === "function");
  assert.equal(ELIGIBILITY_EVALUATION_SERVICE_VERSION, "core03-eligibility-eval-1.0.0");
});

test("41. Phase 1B regression surface intact", async () => {
  const { createRegistrationLifecycleService, REGISTRATION_LIFECYCLE_SERVICE_VERSION } =
    await import("../src/features/competition-core/registration-eligibility/index.js");
  assert.ok(typeof createRegistrationLifecycleService === "function");
  assert.equal(REGISTRATION_LIFECYCLE_SERVICE_VERSION, "core03-lifecycle-1.0.0");
});

test("42. Phase 1A regression surface intact", async () => {
  const {
    REGISTRATION_STATUS: statuses,
    createCompetitionRegistration: createReg,
    REGISTRATION_ELIGIBILITY_SCHEMA_VERSION,
  } = await import("../src/features/competition-core/registration-eligibility/index.js");
  assert.equal(statuses.DRAFT, "DRAFT");
  assert.equal(REGISTRATION_ELIGIBILITY_SCHEMA_VERSION, "1");
  assert.ok(
    typeof createReg === "function" &&
      typeof createCore03MemoryPersistenceStore === "function"
  );
  assert.equal(PERSISTENCE_FOUNDATION_VERSION, "core03-persistence-1.0.0");
});
