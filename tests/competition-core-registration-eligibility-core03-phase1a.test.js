/**
 * Core-03 Phase 1A — Registration & Eligibility foundation tests.
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
  REGISTRATION_ALLOWED_TRANSITIONS,
  ELIGIBILITY_OUTCOME,
  ELIGIBILITY_CHECK_TYPE,
  ELIGIBILITY_REASON_SEVERITY,
  ELIGIBILITY_EVALUATOR_VERSION,
  REGISTRATION_ELIGIBILITY_ERROR_CODE,
  validateRegistrationTransition,
  applyRegistrationTransition,
  canTransitionRegistrationStatus,
  createCompetitionRegistration,
  createRegistrationTarget,
  createEligibilityReason,
  orderEligibilityReasons,
  createEligibilityCheckResult,
  createEligibilityDecision,
  createEligibilityPolicy,
  evaluateIdempotentSubmission,
  createIdempotencyRecordForRegistration,
  buildRegistrationIdempotencyKey,
  createFixedClockPort,
  createSequentialIdGeneratorPort,
  createInMemoryRegistrationRepositoryPort,
  createInMemoryEntryCreationPort,
  fixtureIndividualRegistration,
  fixturePairRegistration,
  fixtureTeamRegistration,
  createCore03TestFixture,
} from "../src/features/competition-core/registration-eligibility/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const MODULE_ROOT = join(
  __dirname,
  "../src/features/competition-core/registration-eligibility"
);

const FIXED_AT = "2026-07-20T05:00:00.000Z";

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
// Valid transitions
// ---------------------------------------------------------------------------

test("valid transitions: DRAFT → SUBMITTED", () => {
  const result = validateRegistrationTransition(
    REGISTRATION_STATUS.DRAFT,
    REGISTRATION_STATUS.SUBMITTED
  );
  assert.equal(result.ok, true);
});

test("valid transitions: SUBMITTED → UNDER_REVIEW", () => {
  assert.equal(
    validateRegistrationTransition(
      REGISTRATION_STATUS.SUBMITTED,
      REGISTRATION_STATUS.UNDER_REVIEW
    ).ok,
    true
  );
});

test("valid transitions: UNDER_REVIEW → APPROVED|CONDITIONAL|WAITLISTED|REJECTED", () => {
  for (const to of [
    REGISTRATION_STATUS.APPROVED,
    REGISTRATION_STATUS.CONDITIONAL,
    REGISTRATION_STATUS.WAITLISTED,
    REGISTRATION_STATUS.REJECTED,
  ]) {
    assert.equal(
      validateRegistrationTransition(REGISTRATION_STATUS.UNDER_REVIEW, to).ok,
      true,
      to
    );
  }
});

test("valid transitions: CONDITIONAL → APPROVED|REJECTED", () => {
  assert.equal(
    validateRegistrationTransition(
      REGISTRATION_STATUS.CONDITIONAL,
      REGISTRATION_STATUS.APPROVED
    ).ok,
    true
  );
  assert.equal(
    validateRegistrationTransition(
      REGISTRATION_STATUS.CONDITIONAL,
      REGISTRATION_STATUS.REJECTED
    ).ok,
    true
  );
});

test("valid transitions: WAITLISTED → APPROVED|WITHDRAWN", () => {
  assert.equal(
    validateRegistrationTransition(
      REGISTRATION_STATUS.WAITLISTED,
      REGISTRATION_STATUS.APPROVED
    ).ok,
    true
  );
  assert.equal(
    validateRegistrationTransition(
      REGISTRATION_STATUS.WAITLISTED,
      REGISTRATION_STATUS.WITHDRAWN
    ).ok,
    true
  );
});

test("valid transitions: withdraw from open statuses", () => {
  for (const from of [
    REGISTRATION_STATUS.DRAFT,
    REGISTRATION_STATUS.SUBMITTED,
    REGISTRATION_STATUS.UNDER_REVIEW,
    REGISTRATION_STATUS.CONDITIONAL,
    REGISTRATION_STATUS.WAITLISTED,
  ]) {
    assert.equal(
      canTransitionRegistrationStatus(from, REGISTRATION_STATUS.WITHDRAWN),
      true,
      from
    );
  }
});

test("applyRegistrationTransition sets submittedAt via clock", () => {
  const reg = fixtureIndividualRegistration();
  const next = applyRegistrationTransition(reg, REGISTRATION_STATUS.SUBMITTED, {
    clockNow: FIXED_AT,
  });
  assert.equal(next.status, REGISTRATION_STATUS.SUBMITTED);
  assert.equal(next.submittedAt, FIXED_AT);
});

// ---------------------------------------------------------------------------
// Invalid transitions + terminal protection
// ---------------------------------------------------------------------------

test("invalid transition: DRAFT → APPROVED fails closed", () => {
  const result = validateRegistrationTransition(
    REGISTRATION_STATUS.DRAFT,
    REGISTRATION_STATUS.APPROVED
  );
  assert.equal(result.ok, false);
  assert.equal(
    result.errors[0].code,
    REGISTRATION_ELIGIBILITY_ERROR_CODE.INVALID_TRANSITION
  );
});

test("invalid transition: SUBMITTED → APPROVED fails closed", () => {
  assert.equal(
    validateRegistrationTransition(
      REGISTRATION_STATUS.SUBMITTED,
      REGISTRATION_STATUS.APPROVED
    ).ok,
    false
  );
});

test("terminal statuses cannot reopen", () => {
  for (const from of TERMINAL_REGISTRATION_STATUSES) {
    assert.deepEqual(REGISTRATION_ALLOWED_TRANSITIONS[from], []);
    const result = validateRegistrationTransition(from, REGISTRATION_STATUS.DRAFT);
    assert.equal(result.ok, false, from);
    assert.equal(
      result.errors[0].code,
      REGISTRATION_ELIGIBILITY_ERROR_CODE.TERMINAL_STATUS
    );
  }
});

test("applyRegistrationTransition throws on invalid transition", () => {
  const reg = fixtureIndividualRegistration({ status: REGISTRATION_STATUS.APPROVED });
  assert.throws(
    () => applyRegistrationTransition(reg, REGISTRATION_STATUS.UNDER_REVIEW),
    /Terminal status|Invalid registration/
  );
});

// ---------------------------------------------------------------------------
// Deterministic eligibility reason ordering + blocking vs warning
// ---------------------------------------------------------------------------

test("orderEligibilityReasons is deterministic by severity then checkType then code", () => {
  const unordered = [
    createEligibilityReason({
      code: "INFO_A",
      checkType: ELIGIBILITY_CHECK_TYPE.DOCUMENT_REQUIREMENT,
      severity: ELIGIBILITY_REASON_SEVERITY.INFO,
      message: "info",
    }),
    createEligibilityReason({
      code: "BLOCK_Z",
      checkType: ELIGIBILITY_CHECK_TYPE.AGE_REQUIREMENT,
      severity: ELIGIBILITY_REASON_SEVERITY.BLOCKING,
      message: "age",
    }),
    createEligibilityReason({
      code: "WARN_B",
      checkType: ELIGIBILITY_CHECK_TYPE.RATING_RANGE,
      severity: ELIGIBILITY_REASON_SEVERITY.WARNING,
      message: "rating",
    }),
    createEligibilityReason({
      code: "BLOCK_A",
      checkType: ELIGIBILITY_CHECK_TYPE.AGE_REQUIREMENT,
      severity: ELIGIBILITY_REASON_SEVERITY.BLOCKING,
      message: "age2",
    }),
  ];

  const ordered = orderEligibilityReasons(unordered);
  assert.deepEqual(
    ordered.map((r) => r.code),
    ["BLOCK_A", "BLOCK_Z", "WARN_B", "INFO_A"]
  );

  const again = orderEligibilityReasons([...unordered].reverse());
  assert.deepEqual(
    again.map((r) => r.code),
    ordered.map((r) => r.code)
  );
});

test("blocking reasons yield INELIGIBLE", () => {
  const decision = createEligibilityDecision({
    id: "elig-1",
    evaluatedAt: FIXED_AT,
    competitionId: "comp-1",
    checkResults: [
      createEligibilityCheckResult({
        checkType: ELIGIBILITY_CHECK_TYPE.AGE_REQUIREMENT,
        passed: false,
        reasons: [
          {
            code: "AGE_TOO_YOUNG",
            checkType: ELIGIBILITY_CHECK_TYPE.AGE_REQUIREMENT,
            severity: ELIGIBILITY_REASON_SEVERITY.BLOCKING,
            message: "under min age",
          },
        ],
      }),
      createEligibilityCheckResult({
        checkType: ELIGIBILITY_CHECK_TYPE.DOCUMENT_REQUIREMENT,
        passed: true,
        reasons: [
          {
            code: "DOC_OPTIONAL_MISSING",
            checkType: ELIGIBILITY_CHECK_TYPE.DOCUMENT_REQUIREMENT,
            severity: ELIGIBILITY_REASON_SEVERITY.WARNING,
            message: "optional doc",
          },
        ],
      }),
    ],
  });

  assert.equal(decision.outcome, ELIGIBILITY_OUTCOME.INELIGIBLE);
  assert.equal(decision.evaluatorVersion, ELIGIBILITY_EVALUATOR_VERSION);
  assert.equal(decision.reasons[0].severity, ELIGIBILITY_REASON_SEVERITY.BLOCKING);
});

test("warnings alone yield ELIGIBLE; conditional code yields CONDITIONAL", () => {
  const eligible = createEligibilityDecision({
    id: "elig-2",
    evaluatedAt: FIXED_AT,
    checkResults: [
      createEligibilityCheckResult({
        checkType: ELIGIBILITY_CHECK_TYPE.PAYMENT_REQUIREMENT,
        passed: true,
        reasons: [
          {
            code: "PAYMENT_PENDING_SOFT",
            checkType: ELIGIBILITY_CHECK_TYPE.PAYMENT_REQUIREMENT,
            severity: ELIGIBILITY_REASON_SEVERITY.WARNING,
            message: "pay later",
          },
        ],
      }),
    ],
  });
  assert.equal(eligible.outcome, ELIGIBILITY_OUTCOME.ELIGIBLE);

  const conditional = createEligibilityDecision({
    id: "elig-3",
    evaluatedAt: FIXED_AT,
    policy: createEligibilityPolicy({ policyId: "pol-1", allowConditional: true }),
    checkResults: [
      createEligibilityCheckResult({
        checkType: ELIGIBILITY_CHECK_TYPE.DOCUMENT_REQUIREMENT,
        passed: true,
        reasons: [
          {
            code: "CONDITIONAL_REQUIREMENT",
            checkType: ELIGIBILITY_CHECK_TYPE.DOCUMENT_REQUIREMENT,
            severity: ELIGIBILITY_REASON_SEVERITY.WARNING,
            message: "submit waiver",
          },
        ],
      }),
    ],
  });
  assert.equal(conditional.outcome, ELIGIBILITY_OUTCOME.CONDITIONAL);
});

test("manual approval reason yields MANUAL_REVIEW_REQUIRED", () => {
  const decision = createEligibilityDecision({
    id: "elig-4",
    evaluatedAt: FIXED_AT,
    checkResults: [
      createEligibilityCheckResult({
        checkType: ELIGIBILITY_CHECK_TYPE.MANUAL_APPROVAL,
        passed: false,
        reasons: [
          {
            code: "MANUAL_REVIEW_REQUIRED",
            checkType: ELIGIBILITY_CHECK_TYPE.MANUAL_APPROVAL,
            severity: ELIGIBILITY_REASON_SEVERITY.WARNING,
            message: "director review",
          },
        ],
      }),
    ],
  });
  assert.equal(decision.outcome, ELIGIBILITY_OUTCOME.MANUAL_REVIEW_REQUIRED);
});

test("eligibility decision requires id and evaluatedAt (no Date.now in domain)", () => {
  assert.throws(() => createEligibilityDecision({ evaluatedAt: FIXED_AT }), /requires id/);
  assert.throws(() => createEligibilityDecision({ id: "x" }), /requires evaluatedAt/);
});

// ---------------------------------------------------------------------------
// Duplicate / idempotency
// ---------------------------------------------------------------------------

test("idempotency HIT returns existing registration without creating duplicate", () => {
  const target = createRegistrationTarget({
    targetType: REGISTRATION_TARGET_TYPE.INDIVIDUAL,
    participantId: "p-1",
  });
  const record = createIdempotencyRecordForRegistration({
    registrationId: "reg-existing",
    createdAt: FIXED_AT,
    competitionId: "comp-1",
    divisionId: "div-1",
    target,
    registrationRequestId: "req-1",
    idempotencyKey: "idem-1",
    requestFingerprint: { channel: "web" },
  });

  const hit = evaluateIdempotentSubmission(
    {
      idempotencyKey: "idem-1",
      registrationRequestId: "req-1",
      competitionId: "comp-1",
      divisionId: "div-1",
      target,
      requestFingerprint: { channel: "web" },
    },
    record
  );

  assert.equal(hit.ok, true);
  assert.equal(hit.value.kind, "HIT");
  assert.equal(hit.value.registrationId, "reg-existing");
});

test("idempotency CONFLICT when same key binds different request", () => {
  const target = createRegistrationTarget({
    targetType: REGISTRATION_TARGET_TYPE.INDIVIDUAL,
    participantId: "p-1",
  });
  const record = createIdempotencyRecordForRegistration({
    registrationId: "reg-existing",
    createdAt: FIXED_AT,
    competitionId: "comp-1",
    divisionId: "div-1",
    target,
    registrationRequestId: "req-1",
    idempotencyKey: "idem-1",
  });

  const conflict = evaluateIdempotentSubmission(
    {
      idempotencyKey: "idem-1",
      registrationRequestId: "req-OTHER",
      competitionId: "comp-1",
      divisionId: "div-1",
      target,
    },
    record
  );

  assert.equal(conflict.ok, false);
  assert.equal(
    conflict.errors[0].code,
    REGISTRATION_ELIGIBILITY_ERROR_CODE.IDEMPOTENCY_CONFLICT
  );
});

test("idempotency MISS then repository save does not duplicate on HIT", async () => {
  const repo = createInMemoryRegistrationRepositoryPort();
  const ids = createSequentialIdGeneratorPort("reg");
  const clock = createFixedClockPort(FIXED_AT);
  const target = createRegistrationTarget({
    targetType: REGISTRATION_TARGET_TYPE.INDIVIDUAL,
    participantId: "p-9",
  });
  const idempotencyKey = buildRegistrationIdempotencyKey({
    competitionId: "comp-1",
    divisionId: "div-1",
    target,
    registrationRequestId: "req-9",
    idempotencyKey: "client-key-9",
  });

  const miss = evaluateIdempotentSubmission(
    {
      idempotencyKey,
      registrationRequestId: "req-9",
      competitionId: "comp-1",
      divisionId: "div-1",
      target,
    },
    await repo.findIdempotencyRecord(idempotencyKey)
  );
  assert.equal(miss.value.kind, "MISS");

  const registration = createCompetitionRegistration({
    id: ids.nextId(),
    registrationRequestId: "req-9",
    idempotencyKey,
    competitionId: "comp-1",
    divisionId: "div-1",
    target,
  });
  await repo.save(registration);
  await repo.saveIdempotencyRecord(
    createIdempotencyRecordForRegistration({
      registrationId: registration.id,
      createdAt: clock.nowIso(),
      competitionId: "comp-1",
      divisionId: "div-1",
      target,
      registrationRequestId: "req-9",
      idempotencyKey,
    })
  );

  const second = evaluateIdempotentSubmission(
    {
      idempotencyKey,
      registrationRequestId: "req-9",
      competitionId: "comp-1",
      divisionId: "div-1",
      target,
    },
    await repo.findIdempotencyRecord(idempotencyKey)
  );
  assert.equal(second.value.kind, "HIT");
  assert.equal(second.value.registrationId, registration.id);
  assert.equal((await repo.listByCompetition("comp-1")).length, 1);
});

test("missing identifiers fail closed for idempotency evaluation", () => {
  const result = evaluateIdempotentSubmission(
    {
      idempotencyKey: "",
      registrationRequestId: "req",
      competitionId: "comp",
      target: createRegistrationTarget({
        targetType: REGISTRATION_TARGET_TYPE.INDIVIDUAL,
        participantId: "p-1",
      }),
    },
    null
  );
  assert.equal(result.ok, false);
  assert.equal(
    result.errors[0].code,
    REGISTRATION_ELIGIBILITY_ERROR_CODE.MISSING_IDENTIFIER
  );
});

// ---------------------------------------------------------------------------
// Individual / Pair / Team targets
// ---------------------------------------------------------------------------

test("INDIVIDUAL registration target requires participantId", () => {
  assert.throws(
    () =>
      createRegistrationTarget({
        targetType: REGISTRATION_TARGET_TYPE.INDIVIDUAL,
      }),
    /participantId/
  );
  const t = createRegistrationTarget({
    targetType: REGISTRATION_TARGET_TYPE.INDIVIDUAL,
    participantId: "p-1",
  });
  assert.equal(t.targetType, REGISTRATION_TARGET_TYPE.INDIVIDUAL);
  assert.equal(fixtureIndividualRegistration().target.participantId, "p-1");
});

test("PAIR registration target canonicalizes and requires two distinct ids", () => {
  assert.throws(
    () =>
      createRegistrationTarget({
        targetType: REGISTRATION_TARGET_TYPE.PAIR,
        participantIds: ["p-1"],
      }),
    /exactly 2/
  );
  assert.throws(
    () =>
      createRegistrationTarget({
        targetType: REGISTRATION_TARGET_TYPE.PAIR,
        participantIds: ["p-1", "p-1"],
      }),
    /distinct/
  );
  const pair = fixturePairRegistration();
  assert.deepEqual(pair.target.participantIds, ["p-1", "p-2"]);
  assert.match(pair.identityKey, /PAIR::p-1\+p-2/);
});

test("TEAM registration target requires teamId (no format hard-code)", () => {
  assert.throws(
    () =>
      createRegistrationTarget({
        targetType: REGISTRATION_TARGET_TYPE.TEAM,
      }),
    /teamId/
  );
  const team = fixtureTeamRegistration();
  assert.equal(team.target.teamId, "team-1");
  assert.match(team.identityKey, /TEAM::team-1/);
  assert.equal(team.formatHint, "TEAM_TOURNAMENT");
});

test("EntryCreationPort handoff stub works for APPROVED registration", async () => {
  const port = createInMemoryEntryCreationPort();
  const reg = fixtureIndividualRegistration({ status: REGISTRATION_STATUS.APPROVED });
  const result = await port.createEntryFromRegistration({
    registrationId: reg.id,
    competitionId: reg.competitionId,
    divisionId: reg.divisionId,
    target: reg.target,
    idempotencyKey: reg.idempotencyKey,
  });
  assert.equal(result.ok, true);
  assert.ok(result.entryId);
  assert.equal(port._created.length, 1);
});

test("createCore03TestFixture clock is injected and fixed", () => {
  const fx = createCore03TestFixture();
  assert.equal(fx.now(), FIXED_AT);
});

// ---------------------------------------------------------------------------
// Ownership / isolation scans
// ---------------------------------------------------------------------------

test("Core-03 module does not import Core-02 participants, Core-04 classification, or Core-01 constraints", () => {
  const files = collectJsFiles(MODULE_ROOT);
  assert.ok(files.length > 10);
  const banned = [
    "participants/",
    "classification/",
    "constraints/",
    "team-tournament/",
    "individual-tournament/",
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
    // Ban live wall-clock reads in executable code (ignore comment-only mentions).
    const withoutBlockComments = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    assert.equal(
      withoutBlockComments.includes("Date.now("),
      false,
      `${file} must not call Date.now`
    );
  }
});

test("Core-03 does not touch protected competition-core root barrel", () => {
  const rootBarrel = join(
    __dirname,
    "../src/features/competition-core/index.js"
  );
  const src = readFileSync(rootBarrel, "utf8");
  assert.equal(src.includes("registration-eligibility"), false);
});
