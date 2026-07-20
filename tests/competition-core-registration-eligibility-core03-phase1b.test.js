/**
 * Core-03 Phase 1B — Registration lifecycle service tests.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import {
  REGISTRATION_STATUS,
  TERMINAL_REGISTRATION_STATUSES,
  REGISTRATION_TARGET_TYPE,
  REGISTRATION_ELIGIBILITY_ERROR_CODE,
  REGISTRATION_LIFECYCLE_OPERATION,
  REGISTRATION_LIFECYCLE_SERVICE_VERSION,
  REGISTRATION_ALLOWED_TRANSITIONS,
  createRegistrationLifecycleService,
  createCore03TestFixture,
  createCompetitionRegistration,
  createFixedClockPort,
  createSequentialIdGeneratorPort,
  createInMemoryRegistrationRepositoryPort,
  createInMemoryRegistrationAuditPort,
} from "../src/features/competition-core/registration-eligibility/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const MODULE_ROOT = join(
  __dirname,
  "../src/features/competition-core/registration-eligibility"
);
const SERVICES_ROOT = join(MODULE_ROOT, "services");

const FIXED_AT = "2026-07-20T05:00:00.000Z";
const FIXED_AT_SUBMIT = "2026-07-20T06:00:00.000Z";

function createService(overrides = {}) {
  const fx = createCore03TestFixture({ clockIso: FIXED_AT, idSeed: "reg" });
  return {
    fx,
    service: createRegistrationLifecycleService({
      repository: overrides.repository ?? fx.repository,
      audit: overrides.audit ?? fx.audit,
      clock: overrides.clock ?? fx.clock,
      ids: overrides.ids ?? fx.ids,
    }),
  };
}

function baseDraftRequest(overrides = {}) {
  return {
    competitionId: "comp-1",
    divisionId: "div-1",
    registrationRequestId: "req-1",
    idempotencyKey: "idem-1",
    applicant: { platformUserId: "user-1", participantId: "p-1" },
    target: {
      targetType: REGISTRATION_TARGET_TYPE.INDIVIDUAL,
      participantId: "p-1",
    },
    actorId: "user-1",
    ...overrides,
  };
}

function collectJsFiles(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) out.push(...collectJsFiles(full));
    else if (name.endsWith(".js")) out.push(full);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Create draft — target types
// ---------------------------------------------------------------------------

test("1. create INDIVIDUAL draft successfully", async () => {
  const { service, fx } = createService();
  const result = await service.createDraftRegistration(baseDraftRequest());
  assert.equal(result.ok, true);
  assert.equal(result.operation, REGISTRATION_LIFECYCLE_OPERATION.CREATE_DRAFT);
  assert.equal(result.registration?.status, REGISTRATION_STATUS.DRAFT);
  assert.equal(result.registration?.target.targetType, REGISTRATION_TARGET_TYPE.INDIVIDUAL);
  assert.equal(result.idempotencyResult, "MISS");
  assert.equal(result.replayed, false);
  assert.ok(result.auditEventId);
  assert.equal(fx.audit._events.length, 1);
});

test("2. create PAIR draft successfully", async () => {
  const { service } = createService();
  const result = await service.createDraftRegistration(
    baseDraftRequest({
      registrationRequestId: "req-pair",
      idempotencyKey: "idem-pair",
      target: {
        targetType: REGISTRATION_TARGET_TYPE.PAIR,
        participantIds: ["p-2", "p-1"],
      },
    })
  );
  assert.equal(result.ok, true);
  assert.equal(result.registration?.target.targetType, REGISTRATION_TARGET_TYPE.PAIR);
  assert.deepEqual(result.registration?.target.participantIds, ["p-1", "p-2"]);
});

test("3. create TEAM draft successfully", async () => {
  const { service } = createService();
  const result = await service.createDraftRegistration(
    baseDraftRequest({
      registrationRequestId: "req-team",
      idempotencyKey: "idem-team",
      target: {
        targetType: REGISTRATION_TARGET_TYPE.TEAM,
        teamId: "team-1",
        representativeParticipantId: "p-cap",
      },
      applicant: { platformUserId: "user-cap", participantId: "p-cap" },
    })
  );
  assert.equal(result.ok, true);
  assert.equal(result.registration?.target.targetType, REGISTRATION_TARGET_TYPE.TEAM);
  assert.equal(result.registration?.target.teamId, "team-1");
});

// ---------------------------------------------------------------------------
// Create draft — validation
// ---------------------------------------------------------------------------

test("4. missing competitionId fails closed", async () => {
  const { service } = createService();
  const result = await service.createDraftRegistration(
    baseDraftRequest({ competitionId: "" })
  );
  assert.equal(result.ok, false);
  assert.equal(result.errors?.[0].code, REGISTRATION_ELIGIBILITY_ERROR_CODE.MISSING_IDENTIFIER);
});

test("5. invalid applicant fails closed", async () => {
  const { service } = createService();
  const result = await service.createDraftRegistration(
    baseDraftRequest({ applicant: { displayName: "no ids" } })
  );
  assert.equal(result.ok, false);
  assert.equal(result.errors?.[0].path, "applicant");
});

test("6. invalid target fails closed", async () => {
  const { service } = createService();
  const result = await service.createDraftRegistration(
    baseDraftRequest({
      target: { targetType: REGISTRATION_TARGET_TYPE.INDIVIDUAL },
    })
  );
  assert.equal(result.ok, false);
  assert.equal(result.errors?.[0].code, REGISTRATION_ELIGIBILITY_ERROR_CODE.INVALID_TARGET);
});

// ---------------------------------------------------------------------------
// Idempotency
// ---------------------------------------------------------------------------

test("7. idempotent draft replay returns existing registration", async () => {
  const { service } = createService();
  const request = baseDraftRequest({ requestFingerprint: { channel: "web" } });
  const first = await service.createDraftRegistration(request);
  const second = await service.createDraftRegistration(request);
  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  assert.equal(second.replayed, true);
  assert.equal(second.idempotencyResult, "HIT");
  assert.equal(second.registration?.id, first.registration?.id);
  assert.equal(second.auditEventId, null);
});

test("8. conflicting idempotency-key reuse fails", async () => {
  const { service } = createService();
  await service.createDraftRegistration(baseDraftRequest());
  const conflict = await service.createDraftRegistration(
    baseDraftRequest({ registrationRequestId: "req-other" })
  );
  assert.equal(conflict.ok, false);
  assert.equal(
    conflict.errors?.[0].code,
    REGISTRATION_ELIGIBILITY_ERROR_CODE.IDEMPOTENCY_CONFLICT
  );
  assert.equal(conflict.idempotencyResult, "CONFLICT");
});

// ---------------------------------------------------------------------------
// Submit
// ---------------------------------------------------------------------------

test("9. submit DRAFT → SUBMITTED succeeds", async () => {
  const { service } = createService();
  const draft = await service.createDraftRegistration(baseDraftRequest());
  const submit = await service.submitRegistration({
    registrationId: draft.registration.id,
    actorId: "user-1",
  });
  assert.equal(submit.ok, true);
  assert.equal(submit.previousStatus, REGISTRATION_STATUS.DRAFT);
  assert.equal(submit.currentStatus, REGISTRATION_STATUS.SUBMITTED);
});

test("10. submit sets submittedAt from ClockPort", async () => {
  const fx = createCore03TestFixture({ clockIso: FIXED_AT_SUBMIT, idSeed: "reg" });
  const service = createRegistrationLifecycleService({
    repository: fx.repository,
    audit: fx.audit,
    clock: fx.clock,
    ids: fx.ids,
  });
  const draft = await service.createDraftRegistration(baseDraftRequest());
  const submit = await service.submitRegistration({
    registrationId: draft.registration.id,
  });
  assert.equal(submit.registration?.submittedAt, FIXED_AT_SUBMIT);
});

test("11. submit writes exactly one audit event", async () => {
  const { service, fx } = createService();
  const draft = await service.createDraftRegistration(baseDraftRequest());
  assert.equal(fx.audit._events.length, 1);
  await service.submitRegistration({ registrationId: draft.registration.id });
  assert.equal(fx.audit._events.length, 2);
  const submitEvents = fx.audit._events.filter(
    (e) => e.operation === REGISTRATION_LIFECYCLE_OPERATION.SUBMIT
  );
  assert.equal(submitEvents.length, 1);
});

test("12. safe submit replay does not create duplicate registration or audit", async () => {
  const { service, fx } = createService();
  const draft = await service.createDraftRegistration(baseDraftRequest());
  const first = await service.submitRegistration({
    registrationId: draft.registration.id,
    idempotencyKey: "idem-1",
  });
  const second = await service.submitRegistration({
    registrationId: draft.registration.id,
    idempotencyKey: "idem-1",
  });
  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  assert.equal(second.replayed, true);
  assert.equal(second.auditEventId, null);
  assert.equal(
    fx.audit._events.filter((e) => e.operation === REGISTRATION_LIFECYCLE_OPERATION.SUBMIT).length,
    1
  );
  assert.equal((await fx.repository.listByCompetition("comp-1")).length, 1);
});

// ---------------------------------------------------------------------------
// Begin review
// ---------------------------------------------------------------------------

test("13. SUBMITTED → UNDER_REVIEW succeeds", async () => {
  const { service } = createService();
  const draft = await service.createDraftRegistration(baseDraftRequest());
  await service.submitRegistration({ registrationId: draft.registration.id });
  const review = await service.beginRegistrationReview({
    registrationId: draft.registration.id,
    actorId: "reviewer-1",
  });
  assert.equal(review.ok, true);
  assert.equal(review.previousStatus, REGISTRATION_STATUS.SUBMITTED);
  assert.equal(review.currentStatus, REGISTRATION_STATUS.UNDER_REVIEW);
});

test("14. invalid direct DRAFT → UNDER_REVIEW fails", async () => {
  const { service } = createService();
  const draft = await service.createDraftRegistration(baseDraftRequest());
  const review = await service.beginRegistrationReview({
    registrationId: draft.registration.id,
  });
  assert.equal(review.ok, false);
  assert.equal(
    review.errors?.[0].code,
    REGISTRATION_ELIGIBILITY_ERROR_CODE.INVALID_TRANSITION
  );
});

// ---------------------------------------------------------------------------
// Withdraw
// ---------------------------------------------------------------------------

test("15. withdrawal succeeds from every allowed open status", async () => {
  const openStatuses = [
    REGISTRATION_STATUS.DRAFT,
    REGISTRATION_STATUS.SUBMITTED,
    REGISTRATION_STATUS.UNDER_REVIEW,
    REGISTRATION_STATUS.CONDITIONAL,
    REGISTRATION_STATUS.WAITLISTED,
  ];

  for (const status of openStatuses) {
    const fx = createCore03TestFixture({ clockIso: FIXED_AT, idSeed: `wd-${status}` });
    const service = createRegistrationLifecycleService({
      repository: fx.repository,
      audit: fx.audit,
      clock: fx.clock,
      ids: fx.ids,
    });

    let registrationId;
    if (status === REGISTRATION_STATUS.DRAFT) {
      const draft = await service.createDraftRegistration(
        baseDraftRequest({
          registrationRequestId: `req-${status}`,
          idempotencyKey: `idem-${status}`,
        })
      );
      registrationId = draft.registration.id;
    } else {
      const reg = createCompetitionRegistration({
        id: fx.ids.nextId("reg"),
        registrationRequestId: `req-${status}`,
        idempotencyKey: `idem-${status}`,
        competitionId: "comp-1",
        divisionId: "div-1",
        status,
        target: {
          targetType: REGISTRATION_TARGET_TYPE.INDIVIDUAL,
          participantId: `p-${status}`,
        },
        applicant: { platformUserId: "user-1", participantId: `p-${status}` },
      });
      await fx.repository.save(reg);
      registrationId = reg.id;
    }

    const result = await service.withdrawRegistration({
      registrationId,
      actorId: "user-1",
      reason: "changed plans",
    });
    assert.equal(result.ok, true, status);
    assert.equal(result.currentStatus, REGISTRATION_STATUS.WITHDRAWN, status);
    assert.equal(result.registration?.audit?.reason, "changed plans", status);
  }
});

test("16. withdrawal fails from protected terminal statuses", async () => {
  for (const status of TERMINAL_REGISTRATION_STATUSES) {
    const fx = createCore03TestFixture({ clockIso: FIXED_AT, idSeed: `term-${status}` });
    const service = createRegistrationLifecycleService({
      repository: fx.repository,
      audit: fx.audit,
      clock: fx.clock,
      ids: fx.ids,
    });
    const reg = createCompetitionRegistration({
      id: fx.ids.nextId("reg"),
      registrationRequestId: `req-${status}`,
      idempotencyKey: `idem-${status}`,
      competitionId: "comp-1",
      divisionId: "div-1",
      status,
      target: {
        targetType: REGISTRATION_TARGET_TYPE.INDIVIDUAL,
        participantId: `p-${status}`,
      },
      applicant: { platformUserId: "user-1", participantId: `p-${status}` },
    });
    await fx.repository.save(reg);

    const result = await service.withdrawRegistration({
      registrationId: reg.id,
      actorId: "user-1",
    });
    assert.equal(result.ok, false, status);
    assert.equal(result.errors?.[0].code, REGISTRATION_ELIGIBILITY_ERROR_CODE.TERMINAL_STATUS, status);
  }
});

// ---------------------------------------------------------------------------
// Cancel and expire
// ---------------------------------------------------------------------------

test("17. cancel succeeds only through approved transitions", async () => {
  const allowedFrom = Object.entries(REGISTRATION_ALLOWED_TRANSITIONS)
    .filter(([, targets]) => targets.includes(REGISTRATION_STATUS.CANCELLED))
    .map(([from]) => from);

  for (const status of allowedFrom) {
    const fx = createCore03TestFixture({ clockIso: FIXED_AT, idSeed: `cn-${status}` });
    const service = createRegistrationLifecycleService({
      repository: fx.repository,
      audit: fx.audit,
      clock: fx.clock,
      ids: fx.ids,
    });
    const reg = createCompetitionRegistration({
      id: fx.ids.nextId("reg"),
      registrationRequestId: `req-cn-${status}`,
      idempotencyKey: `idem-cn-${status}`,
      competitionId: "comp-1",
      divisionId: "div-1",
      status,
      target: {
        targetType: REGISTRATION_TARGET_TYPE.INDIVIDUAL,
        participantId: `p-cn-${status}`,
      },
      applicant: { platformUserId: "user-1", participantId: `p-cn-${status}` },
    });
    await fx.repository.save(reg);
    const result = await service.cancelRegistration({
      registrationId: reg.id,
      actorId: "director-1",
      reason: "event cancelled",
    });
    assert.equal(result.ok, true, status);
    assert.equal(result.currentStatus, REGISTRATION_STATUS.CANCELLED, status);
  }

  const fx = createCore03TestFixture({ clockIso: FIXED_AT, idSeed: "cn-bad" });
  const service = createRegistrationLifecycleService({
    repository: fx.repository,
    audit: fx.audit,
    clock: fx.clock,
    ids: fx.ids,
  });
  const approved = createCompetitionRegistration({
    id: fx.ids.nextId("reg"),
    registrationRequestId: "req-approved",
    idempotencyKey: "idem-approved",
    competitionId: "comp-1",
    divisionId: "div-1",
    status: REGISTRATION_STATUS.APPROVED,
    target: {
      targetType: REGISTRATION_TARGET_TYPE.INDIVIDUAL,
      participantId: "p-approved",
    },
    applicant: { platformUserId: "user-1", participantId: "p-approved" },
  });
  await fx.repository.save(approved);
  const fail = await service.cancelRegistration({ registrationId: approved.id });
  assert.equal(fail.ok, false);
});

test("18. expire succeeds only through approved transitions", async () => {
  const allowedFrom = Object.entries(REGISTRATION_ALLOWED_TRANSITIONS)
    .filter(([, targets]) => targets.includes(REGISTRATION_STATUS.EXPIRED))
    .map(([from]) => from);

  for (const status of allowedFrom) {
    const fx = createCore03TestFixture({ clockIso: FIXED_AT, idSeed: `ex-${status}` });
    const service = createRegistrationLifecycleService({
      repository: fx.repository,
      audit: fx.audit,
      clock: fx.clock,
      ids: fx.ids,
    });
    const reg = createCompetitionRegistration({
      id: fx.ids.nextId("reg"),
      registrationRequestId: `req-ex-${status}`,
      idempotencyKey: `idem-ex-${status}`,
      competitionId: "comp-1",
      divisionId: "div-1",
      status,
      target: {
        targetType: REGISTRATION_TARGET_TYPE.INDIVIDUAL,
        participantId: `p-ex-${status}`,
      },
      applicant: { platformUserId: "user-1", participantId: `p-ex-${status}` },
    });
    await fx.repository.save(reg);
    const result = await service.expireRegistration({
      registrationId: reg.id,
      reason: "window closed",
    });
    assert.equal(result.ok, true, status);
    assert.equal(result.currentStatus, REGISTRATION_STATUS.EXPIRED, status);
  }

  const fx = createCore03TestFixture({ clockIso: FIXED_AT, idSeed: "ex-draft" });
  const service = createRegistrationLifecycleService({
    repository: fx.repository,
    audit: fx.audit,
    clock: fx.clock,
    ids: fx.ids,
  });
  const draft = await service.createDraftRegistration(
    baseDraftRequest({ registrationRequestId: "req-draft-ex", idempotencyKey: "idem-draft-ex" })
  );
  const fail = await service.expireRegistration({ registrationId: draft.registration.id });
  assert.equal(fail.ok, false);
  assert.equal(fail.errors?.[0].code, REGISTRATION_ELIGIBILITY_ERROR_CODE.INVALID_TRANSITION);
});

// ---------------------------------------------------------------------------
// Errors and consistency
// ---------------------------------------------------------------------------

test("19. missing registration fails closed", async () => {
  const { service } = createService();
  const result = await service.submitRegistration({ registrationId: "missing-reg" });
  assert.equal(result.ok, false);
  assert.equal(
    result.errors?.[0].code,
    REGISTRATION_ELIGIBILITY_ERROR_CODE.REGISTRATION_NOT_FOUND
  );
});

test("20. repository error is propagated deterministically", async () => {
  const repo = createInMemoryRegistrationRepositoryPort();
  const audit = createInMemoryRegistrationAuditPort();
  const clock = createFixedClockPort(FIXED_AT);
  const ids = createSequentialIdGeneratorPort("reg");
  const service = createRegistrationLifecycleService({
    repository: {
      ...repo,
      async getById() {
        const err = new Error("REPOSITORY_READ_FAILED");
        err.code = "REG_ELIG_FAIL_CLOSED";
        throw err;
      },
    },
    audit,
    clock,
    ids,
  });
  const result = await service.submitRegistration({ registrationId: "reg-0001" });
  assert.equal(result.ok, false);
  assert.match(result.errors?.[0].message ?? "", /REPOSITORY_READ_FAILED/);
});

test("21. audit error is not hidden", async () => {
  const fx = createCore03TestFixture({ clockIso: FIXED_AT, idSeed: "reg" });
  const failingAudit = {
    async append() {
      throw new Error("AUDIT_SINK_UNAVAILABLE");
    },
    async listByRegistration() {
      return [];
    },
  };
  const service = createRegistrationLifecycleService({
    repository: fx.repository,
    audit: failingAudit,
    clock: fx.clock,
    ids: fx.ids,
  });
  const result = await service.createDraftRegistration(baseDraftRequest());
  assert.equal(result.ok, false);
  assert.equal(result.errors?.[0].code, REGISTRATION_ELIGIBILITY_ERROR_CODE.AUDIT_APPEND_FAILED);
  assert.equal(result.metadata?.persistedWithoutAudit, true);
  assert.equal(result.registration?.status, REGISTRATION_STATUS.DRAFT);
  const stored = await fx.repository.getById(result.registration.id);
  assert.ok(stored);
});

// ---------------------------------------------------------------------------
// Isolation scans
// ---------------------------------------------------------------------------

test("22. lifecycle services do not call Date.now directly", () => {
  const files = collectJsFiles(SERVICES_ROOT);
  for (const file of files) {
    const src = readFileSync(file, "utf8");
    const withoutBlockComments = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    assert.equal(
      withoutBlockComments.includes("Date.now("),
      false,
      `${file} must not call Date.now`
    );
  }
});

test("23. lifecycle services do not generate random IDs", () => {
  const files = collectJsFiles(SERVICES_ROOT);
  for (const file of files) {
    const src = readFileSync(file, "utf8");
    assert.equal(src.includes("Math.random("), false, `${file} must not call Math.random`);
    assert.equal(src.includes("crypto.random"), false, `${file} must not use crypto.random*`);
  }
});

test("24. lifecycle services do not import Core-01, Core-02, Core-04, or legacy Phase 3C", () => {
  const files = collectJsFiles(SERVICES_ROOT);
  const banned = [
    "participants/",
    "classification/",
    "constraints/",
    "team-tournament/",
    "individual-tournament/",
    "registrations/services/",
  ];
  for (const file of files) {
    const src = readFileSync(file, "utf8");
    for (const bannedPath of banned) {
      assert.equal(
        src.includes(`../${bannedPath}`) ||
          src.includes(`../../${bannedPath}`) ||
          src.includes(`competition-core/${bannedPath}`),
        false,
        `${file} must not import ${bannedPath}`
      );
    }
  }
});

test("25. audit events include serviceVersion and lifecycle fields", async () => {
  const { service, fx } = createService();
  const draft = await service.createDraftRegistration(baseDraftRequest());
  const event = fx.audit._events[0];
  assert.equal(event.serviceVersion, REGISTRATION_LIFECYCLE_SERVICE_VERSION);
  assert.equal(event.competitionId, "comp-1");
  assert.equal(event.operation, REGISTRATION_LIFECYCLE_OPERATION.CREATE_DRAFT);
  assert.equal(event.registrationId, draft.registration.id);
});
