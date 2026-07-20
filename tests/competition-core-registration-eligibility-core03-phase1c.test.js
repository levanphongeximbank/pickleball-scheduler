/**
 * Core-03 Phase 1C — Eligibility evaluation orchestration tests.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import {
  REGISTRATION_STATUS,
  REGISTRATION_TARGET_TYPE,
  ELIGIBILITY_OUTCOME,
  ELIGIBILITY_CHECK_TYPE,
  ELIGIBILITY_REASON_SEVERITY,
  ELIGIBILITY_EVALUATOR_VERSION,
  ELIGIBILITY_EVALUATION_SERVICE_VERSION,
  ELIGIBILITY_EVALUATION_OPERATION,
  REGISTRATION_ELIGIBILITY_ERROR_CODE,
  orderEligibilityReasons,
  createEligibilityEvaluationService,
  createEligibilityEvaluationTestHarness,
  createNullRuleEvaluationPort,
  createInMemoryEntryLookupPort,
  fixtureIndividualRegistration,
  fixturePairRegistration,
  fixtureTeamRegistration,
  fixtureDefaultCompetitionPolicy,
} from "../src/features/competition-core/registration-eligibility/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const MODULE_ROOT = join(
  __dirname,
  "../src/features/competition-core/registration-eligibility"
);
const SERVICES_ROOT = join(MODULE_ROOT, "services");

function policyWithChecks(requiredCheckTypes, extra = {}) {
  return fixtureDefaultCompetitionPolicy({
    eligibilityPolicy: {
      policyId: "pol-test",
      requiredCheckTypes,
      ...extra.eligibilityPolicy,
    },
    ...extra,
  });
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

async function evaluateSubmitted(harness, registration, evaluationRequestId = "eval-req-1") {
  const reg = await harness.seedRegistration(
    fixtureIndividualRegistration({
      ...registration,
      status: registration.status ?? REGISTRATION_STATUS.SUBMITTED,
    })
  );
  return harness.service.evaluateRegistrationEligibility({
    registrationId: reg.id,
    evaluationRequestId,
  });
}

// ---------------------------------------------------------------------------
// Happy paths
// ---------------------------------------------------------------------------

test("1. eligible individual registration produces ELIGIBLE", async () => {
  const harness = createEligibilityEvaluationTestHarness();
  const result = await evaluateSubmitted(harness, { id: "reg-ind-elig" });
  assert.equal(result.ok, true);
  assert.equal(result.decision?.outcome, ELIGIBILITY_OUTCOME.ELIGIBLE);
  assert.equal(result.evaluatorVersion, ELIGIBILITY_EVALUATOR_VERSION);
  assert.equal(result.replayed, false);
  assert.ok(result.auditEventId);
});

test("2. eligible pair evaluates both participants", async () => {
  const harness = createEligibilityEvaluationTestHarness({
    competitionPolicies: {
      "comp-1": policyWithChecks([
        ELIGIBILITY_CHECK_TYPE.REGISTRATION_WINDOW,
        ELIGIBILITY_CHECK_TYPE.PARTICIPANT_STATUS,
      ]),
    },
  });
  const reg = await harness.seedRegistration(
    fixturePairRegistration({ id: "reg-pair-elig", status: REGISTRATION_STATUS.SUBMITTED })
  );
  const result = await harness.service.evaluateRegistrationEligibility({
    registrationId: reg.id,
    evaluationRequestId: "eval-pair-1",
  });
  assert.equal(result.ok, true);
  assert.equal(result.decision?.outcome, ELIGIBILITY_OUTCOME.ELIGIBLE);
  const participantCheck = result.checkResults.find(
    (c) => c.checkType === ELIGIBILITY_CHECK_TYPE.PARTICIPANT_STATUS
  );
  assert.ok(participantCheck?.passed);
});

test("3. eligible team invokes TeamRosterValidationPort", async () => {
  let rosterCalls = 0;
  const harness = createEligibilityEvaluationTestHarness({
    competitionPolicies: {
      "comp-1": policyWithChecks([
        ELIGIBILITY_CHECK_TYPE.REGISTRATION_WINDOW,
        ELIGIBILITY_CHECK_TYPE.TEAM_ROSTER_REQUIREMENT,
      ]),
    },
    teamRosterImpl: async (args) => {
      rosterCalls += 1;
      assert.equal(args.teamId, "team-1");
      return { valid: true, reasonCodes: [], memberCount: 4 };
    },
  });
  const reg = await harness.seedRegistration(
    fixtureTeamRegistration({ id: "reg-team-elig", status: REGISTRATION_STATUS.SUBMITTED })
  );
  const result = await harness.service.evaluateRegistrationEligibility({
    registrationId: reg.id,
    evaluationRequestId: "eval-team-1",
  });
  assert.equal(result.ok, true);
  assert.equal(rosterCalls, 1);
});

// ---------------------------------------------------------------------------
// Fail closed — validation
// ---------------------------------------------------------------------------

test("4. missing registration fails closed", async () => {
  const harness = createEligibilityEvaluationTestHarness();
  const result = await harness.service.evaluateRegistrationEligibility({
    registrationId: "missing",
    evaluationRequestId: "eval-missing",
  });
  assert.equal(result.ok, false);
  assert.equal(result.errors?.[0].code, REGISTRATION_ELIGIBILITY_ERROR_CODE.REGISTRATION_NOT_FOUND);
});

test("5. invalid registration state fails closed", async () => {
  const harness = createEligibilityEvaluationTestHarness();
  const reg = await harness.seedRegistration(
    fixtureIndividualRegistration({ id: "reg-draft", status: REGISTRATION_STATUS.DRAFT })
  );
  const result = await harness.service.evaluateRegistrationEligibility({
    registrationId: reg.id,
    evaluationRequestId: "eval-draft",
  });
  assert.equal(result.ok, false);
  assert.equal(result.errors?.[0].code, REGISTRATION_ELIGIBILITY_ERROR_CODE.INVALID_STATUS);
});

test("6. missing competition policy fails closed", async () => {
  const harness = createEligibilityEvaluationTestHarness({
    competitionPolicies: {},
  });
  const reg = await harness.seedRegistration(
    fixtureIndividualRegistration({ id: "reg-no-pol", status: REGISTRATION_STATUS.SUBMITTED })
  );
  const result = await harness.service.evaluateRegistrationEligibility({
    registrationId: reg.id,
    evaluationRequestId: "eval-no-pol",
  });
  assert.equal(result.ok, false);
  assert.equal(result.errors?.[0].code, REGISTRATION_ELIGIBILITY_ERROR_CODE.FAIL_CLOSED);
});

// ---------------------------------------------------------------------------
// Check failures
// ---------------------------------------------------------------------------

test("7. registration-window failure produces INELIGIBLE", async () => {
  const harness = createEligibilityEvaluationTestHarness({
    competitionPolicies: {
      "comp-1": policyWithChecks(
        [ELIGIBILITY_CHECK_TYPE.REGISTRATION_WINDOW, ELIGIBILITY_CHECK_TYPE.PARTICIPANT_STATUS],
        { windowOpen: false }
      ),
    },
  });
  const result = await evaluateSubmitted(harness, { id: "reg-window" });
  assert.equal(result.ok, true);
  assert.equal(result.decision?.outcome, ELIGIBILITY_OUTCOME.INELIGIBLE);
});

test("8. participant inactive produces INELIGIBLE", async () => {
  const harness = createEligibilityEvaluationTestHarness({
    participants: [{ id: "p-1", status: "INACTIVE", birthDate: "1990-01-01", rating: 3.5 }],
  });
  const result = await evaluateSubmitted(harness, { id: "reg-inactive" });
  assert.equal(result.decision?.outcome, ELIGIBILITY_OUTCOME.INELIGIBLE);
});

test("9. age mismatch produces INELIGIBLE", async () => {
  const harness = createEligibilityEvaluationTestHarness({
    competitionPolicies: {
      "comp-1": policyWithChecks(
        [
          ELIGIBILITY_CHECK_TYPE.REGISTRATION_WINDOW,
          ELIGIBILITY_CHECK_TYPE.PARTICIPANT_STATUS,
          ELIGIBILITY_CHECK_TYPE.AGE_REQUIREMENT,
        ],
        {
          eligibilityPolicy: {
            policyId: "pol-age",
            requiredCheckTypes: [
              ELIGIBILITY_CHECK_TYPE.REGISTRATION_WINDOW,
              ELIGIBILITY_CHECK_TYPE.PARTICIPANT_STATUS,
              ELIGIBILITY_CHECK_TYPE.AGE_REQUIREMENT,
            ],
            parameters: { minAge: 40 },
          },
        }
      ),
    },
  });
  const result = await evaluateSubmitted(harness, { id: "reg-age" });
  assert.equal(result.decision?.outcome, ELIGIBILITY_OUTCOME.INELIGIBLE);
});

test("10. rating outside range produces INELIGIBLE", async () => {
  const harness = createEligibilityEvaluationTestHarness({
    competitionPolicies: {
      "comp-1": policyWithChecks(
        [
          ELIGIBILITY_CHECK_TYPE.REGISTRATION_WINDOW,
          ELIGIBILITY_CHECK_TYPE.PARTICIPANT_STATUS,
          ELIGIBILITY_CHECK_TYPE.RATING_RANGE,
        ],
        {
          eligibilityPolicy: {
            policyId: "pol-rating",
            requiredCheckTypes: [
              ELIGIBILITY_CHECK_TYPE.REGISTRATION_WINDOW,
              ELIGIBILITY_CHECK_TYPE.PARTICIPANT_STATUS,
              ELIGIBILITY_CHECK_TYPE.RATING_RANGE,
            ],
            parameters: { minRating: 4.5, maxRating: 5.0 },
          },
        }
      ),
    },
  });
  const result = await evaluateSubmitted(harness, { id: "reg-rating" });
  assert.equal(result.decision?.outcome, ELIGIBILITY_OUTCOME.INELIGIBLE);
});

test("11. division incompatibility produces INELIGIBLE", async () => {
  const harness = createEligibilityEvaluationTestHarness({
    competitionPolicies: {
      "comp-1": policyWithChecks([
        ELIGIBILITY_CHECK_TYPE.REGISTRATION_WINDOW,
        ELIGIBILITY_CHECK_TYPE.DIVISION_COMPATIBILITY,
      ]),
    },
    divisionImpl: async () => ({
      acceptsRegistration: false,
      reasonCodes: ["DIVISION_INCOMPATIBLE"],
    }),
  });
  const result = await evaluateSubmitted(harness, { id: "reg-div" });
  assert.equal(result.decision?.outcome, ELIGIBILITY_OUTCOME.INELIGIBLE);
});

test("12. missing required membership produces INELIGIBLE", async () => {
  const harness = createEligibilityEvaluationTestHarness({
    competitionPolicies: {
      "comp-1": policyWithChecks(
        [
          ELIGIBILITY_CHECK_TYPE.REGISTRATION_WINDOW,
          ELIGIBILITY_CHECK_TYPE.PARTICIPANT_STATUS,
          ELIGIBILITY_CHECK_TYPE.MEMBERSHIP_REQUIREMENT,
        ],
        {
          eligibilityPolicy: {
            policyId: "pol-member",
            requiredCheckTypes: [
              ELIGIBILITY_CHECK_TYPE.REGISTRATION_WINDOW,
              ELIGIBILITY_CHECK_TYPE.PARTICIPANT_STATUS,
              ELIGIBILITY_CHECK_TYPE.MEMBERSHIP_REQUIREMENT,
            ],
            parameters: { clubId: "club-1" },
          },
        }
      ),
    },
    membershipImpl: async () => ({
      isMember: false,
      status: "NON_MEMBER",
      reasonCodes: ["MEMBERSHIP_REQUIRED"],
    }),
  });
  const result = await evaluateSubmitted(harness, { id: "reg-member" });
  assert.equal(result.decision?.outcome, ELIGIBILITY_OUTCOME.INELIGIBLE);
});

test("13. invalid team roster produces INELIGIBLE", async () => {
  const harness = createEligibilityEvaluationTestHarness({
    competitionPolicies: {
      "comp-1": policyWithChecks([
        ELIGIBILITY_CHECK_TYPE.REGISTRATION_WINDOW,
        ELIGIBILITY_CHECK_TYPE.TEAM_ROSTER_REQUIREMENT,
      ]),
    },
    teamRosterImpl: async () => ({
      valid: false,
      reasonCodes: ["ROSTER_UNDER_MIN"],
      memberCount: 1,
    }),
  });
  const reg = await harness.seedRegistration(
    fixtureTeamRegistration({ id: "reg-roster-bad", status: REGISTRATION_STATUS.SUBMITTED })
  );
  const result = await harness.service.evaluateRegistrationEligibility({
    registrationId: reg.id,
    evaluationRequestId: "eval-roster-bad",
  });
  assert.equal(result.decision?.outcome, ELIGIBILITY_OUTCOME.INELIGIBLE);
});

test("14. required payment pending produces CONDITIONAL", async () => {
  const harness = createEligibilityEvaluationTestHarness({
    competitionPolicies: {
      "comp-1": policyWithChecks([
        ELIGIBILITY_CHECK_TYPE.REGISTRATION_WINDOW,
        ELIGIBILITY_CHECK_TYPE.PARTICIPANT_STATUS,
        ELIGIBILITY_CHECK_TYPE.PAYMENT_REQUIREMENT,
      ]),
    },
    paymentImpl: async () => ({
      status: "UNPAID",
      requirementMet: false,
    }),
  });
  const result = await evaluateSubmitted(harness, { id: "reg-pay" });
  assert.equal(result.decision?.outcome, ELIGIBILITY_OUTCOME.CONDITIONAL);
});

test("15. manual approval produces MANUAL_REVIEW_REQUIRED", async () => {
  const harness = createEligibilityEvaluationTestHarness({
    competitionPolicies: {
      "comp-1": policyWithChecks(
        [ELIGIBILITY_CHECK_TYPE.REGISTRATION_WINDOW, ELIGIBILITY_CHECK_TYPE.MANUAL_APPROVAL],
        {
          eligibilityPolicy: {
            policyId: "pol-manual",
            requiredCheckTypes: [
              ELIGIBILITY_CHECK_TYPE.REGISTRATION_WINDOW,
              ELIGIBILITY_CHECK_TYPE.MANUAL_APPROVAL,
            ],
            requireManualApproval: true,
          },
        }
      ),
    },
  });
  const result = await evaluateSubmitted(harness, { id: "reg-manual" });
  assert.equal(result.decision?.outcome, ELIGIBILITY_OUTCOME.MANUAL_REVIEW_REQUIRED);
});

// ---------------------------------------------------------------------------
// Precedence
// ---------------------------------------------------------------------------

test("16. blocking reason takes precedence over manual review", async () => {
  const harness = createEligibilityEvaluationTestHarness({
    competitionPolicies: {
      "comp-1": policyWithChecks(
        [
          ELIGIBILITY_CHECK_TYPE.REGISTRATION_WINDOW,
          ELIGIBILITY_CHECK_TYPE.PARTICIPANT_STATUS,
          ELIGIBILITY_CHECK_TYPE.MANUAL_APPROVAL,
        ],
        {
          eligibilityPolicy: {
            policyId: "pol-precedence-1",
            requiredCheckTypes: [
              ELIGIBILITY_CHECK_TYPE.REGISTRATION_WINDOW,
              ELIGIBILITY_CHECK_TYPE.PARTICIPANT_STATUS,
              ELIGIBILITY_CHECK_TYPE.MANUAL_APPROVAL,
            ],
            requireManualApproval: true,
          },
        }
      ),
    },
    participants: [{ id: "p-1", status: "INACTIVE" }],
  });
  const result = await evaluateSubmitted(harness, { id: "reg-prec-1" });
  assert.equal(result.decision?.outcome, ELIGIBILITY_OUTCOME.INELIGIBLE);
});

test("17. manual review takes precedence over conditional", async () => {
  const harness = createEligibilityEvaluationTestHarness({
    competitionPolicies: {
      "comp-1": policyWithChecks(
        [
          ELIGIBILITY_CHECK_TYPE.REGISTRATION_WINDOW,
          ELIGIBILITY_CHECK_TYPE.PAYMENT_REQUIREMENT,
          ELIGIBILITY_CHECK_TYPE.MANUAL_APPROVAL,
        ],
        {
          eligibilityPolicy: {
            policyId: "pol-precedence-2",
            requiredCheckTypes: [
              ELIGIBILITY_CHECK_TYPE.REGISTRATION_WINDOW,
              ELIGIBILITY_CHECK_TYPE.PAYMENT_REQUIREMENT,
              ELIGIBILITY_CHECK_TYPE.MANUAL_APPROVAL,
            ],
            requireManualApproval: true,
            allowConditional: true,
          },
        }
      ),
    },
    paymentImpl: async () => ({ status: "UNPAID", requirementMet: false }),
  });
  const result = await evaluateSubmitted(harness, { id: "reg-prec-2" });
  assert.equal(result.decision?.outcome, ELIGIBILITY_OUTCOME.MANUAL_REVIEW_REQUIRED);
});

test("18. warning-only result remains ELIGIBLE", async () => {
  const harness = createEligibilityEvaluationTestHarness({
    competitionPolicies: {
      "comp-1": policyWithChecks([
        ELIGIBILITY_CHECK_TYPE.REGISTRATION_WINDOW,
        ELIGIBILITY_CHECK_TYPE.PARTICIPANT_STATUS,
      ]),
    },
  });
  const result = await evaluateSubmitted(harness, { id: "reg-warn-only" });
  const hasBlocking = result.decision?.reasons.some(
    (r) => r.severity === ELIGIBILITY_REASON_SEVERITY.BLOCKING
  );
  assert.equal(hasBlocking, false);
  assert.equal(result.decision?.outcome, ELIGIBILITY_OUTCOME.ELIGIBLE);
});

// ---------------------------------------------------------------------------
// Determinism
// ---------------------------------------------------------------------------

test("19. reasons are ordered deterministically", async () => {
  const harness = createEligibilityEvaluationTestHarness({
    competitionPolicies: {
      "comp-1": policyWithChecks(
        [
          ELIGIBILITY_CHECK_TYPE.REGISTRATION_WINDOW,
          ELIGIBILITY_CHECK_TYPE.PARTICIPANT_STATUS,
          ELIGIBILITY_CHECK_TYPE.AGE_REQUIREMENT,
          ELIGIBILITY_CHECK_TYPE.RATING_RANGE,
        ],
        {
          windowOpen: false,
          eligibilityPolicy: {
            policyId: "pol-order",
            requiredCheckTypes: [
              ELIGIBILITY_CHECK_TYPE.RATING_RANGE,
              ELIGIBILITY_CHECK_TYPE.AGE_REQUIREMENT,
              ELIGIBILITY_CHECK_TYPE.PARTICIPANT_STATUS,
              ELIGIBILITY_CHECK_TYPE.REGISTRATION_WINDOW,
            ],
            parameters: { minAge: 40, minRating: 5 },
          },
        }
      ),
    },
    participants: [{ id: "p-1", status: "INACTIVE", birthDate: "2010-01-01", rating: 1 }],
  });
  const result = await evaluateSubmitted(harness, { id: "reg-order" });
  const codes = result.decision?.reasons.map((r) => r.code) ?? [];
  const expected = orderEligibilityReasons(result.decision?.reasons ?? []).map((r) => r.code);
  assert.deepEqual(codes, expected);
});

test("20. port completion order does not alter reason ordering", async () => {
  const harness = createEligibilityEvaluationTestHarness({
    competitionPolicies: {
      "comp-1": policyWithChecks(
        [
          ELIGIBILITY_CHECK_TYPE.REGISTRATION_WINDOW,
          ELIGIBILITY_CHECK_TYPE.PARTICIPANT_STATUS,
          ELIGIBILITY_CHECK_TYPE.DIVISION_COMPATIBILITY,
        ],
        {
          eligibilityPolicy: {
            policyId: "pol-exec-order",
            requiredCheckTypes: [
              ELIGIBILITY_CHECK_TYPE.DIVISION_COMPATIBILITY,
              ELIGIBILITY_CHECK_TYPE.PARTICIPANT_STATUS,
              ELIGIBILITY_CHECK_TYPE.REGISTRATION_WINDOW,
            ],
          },
        }
      ),
    },
    divisionImpl: async () => ({
      acceptsRegistration: false,
      reasonCodes: ["DIVISION_INCOMPATIBLE"],
    }),
    participants: [{ id: "p-1", status: "INACTIVE" }],
  });
  const result = await evaluateSubmitted(harness, { id: "reg-exec-order" });
  const ordered = orderEligibilityReasons(result.decision?.reasons ?? []);
  assert.deepEqual(
    result.decision?.reasons.map((r) => r.code),
    ordered.map((r) => r.code)
  );
});

// ---------------------------------------------------------------------------
// Adapter behavior
// ---------------------------------------------------------------------------

test("21. missing mandatory adapter fails closed", async () => {
  const harness = createEligibilityEvaluationTestHarness({
    competitionPolicies: {
      "comp-1": policyWithChecks([ELIGIBILITY_CHECK_TYPE.RANKING_REQUIREMENT]),
    },
  });
  const service = createEligibilityEvaluationService({
    repository: harness.repository,
    audit: harness.audit,
    clock: harness.clock,
    ids: harness.ids,
    participantLookup: harness.participantLookup,
    entryLookup: harness.entryLookup,
    divisionEligibility: harness.divisionEligibility,
    competitionPolicy: harness.competitionPolicy,
    ruleEvaluation: createNullRuleEvaluationPort(),
    paymentStatus: harness.paymentStatus,
    membershipStatus: harness.membershipStatus,
    teamRosterValidation: harness.teamRosterValidation,
  });
  const reg = await harness.seedRegistration(
    fixtureIndividualRegistration({ id: "reg-port-req", status: REGISTRATION_STATUS.SUBMITTED })
  );
  const result = await service.evaluateRegistrationEligibility({
    registrationId: reg.id,
    evaluationRequestId: "eval-port-req",
  });
  assert.equal(result.ok, false);
  assert.equal(result.errors?.[0].code, REGISTRATION_ELIGIBILITY_ERROR_CODE.PORT_REQUIRED);
});

test("22. optional unavailable adapter produces documented warning behavior", async () => {
  const harness = createEligibilityEvaluationTestHarness({
    competitionPolicies: {
      "comp-1": policyWithChecks(
        [
          ELIGIBILITY_CHECK_TYPE.REGISTRATION_WINDOW,
          ELIGIBILITY_CHECK_TYPE.PARTICIPANT_STATUS,
          ELIGIBILITY_CHECK_TYPE.DOCUMENT_REQUIREMENT,
        ],
        {
          eligibilityPolicy: {
            policyId: "pol-opt-doc",
            requiredCheckTypes: [
              ELIGIBILITY_CHECK_TYPE.REGISTRATION_WINDOW,
              ELIGIBILITY_CHECK_TYPE.PARTICIPANT_STATUS,
              ELIGIBILITY_CHECK_TYPE.DOCUMENT_REQUIREMENT,
            ],
            parameters: {
              optionalCheckTypes: [ELIGIBILITY_CHECK_TYPE.DOCUMENT_REQUIREMENT],
            },
          },
        }
      ),
    },
  });
  const service = createEligibilityEvaluationService({
    repository: harness.repository,
    audit: harness.audit,
    clock: harness.clock,
    ids: harness.ids,
    participantLookup: harness.participantLookup,
    entryLookup: harness.entryLookup,
    divisionEligibility: harness.divisionEligibility,
    competitionPolicy: harness.competitionPolicy,
    ruleEvaluation: createNullRuleEvaluationPort(),
    paymentStatus: harness.paymentStatus,
    membershipStatus: harness.membershipStatus,
    teamRosterValidation: harness.teamRosterValidation,
  });
  const reg = await harness.seedRegistration(
    fixtureIndividualRegistration({ id: "reg-opt-doc", status: REGISTRATION_STATUS.SUBMITTED })
  );
  const evalResult = await service.evaluateRegistrationEligibility({
    registrationId: reg.id,
    evaluationRequestId: "eval-opt-doc",
  });
  assert.equal(evalResult.ok, true);
  assert.equal(evalResult.decision?.outcome, ELIGIBILITY_OUTCOME.ELIGIBLE);
  assert.ok(
    evalResult.warnings.some((w) => w.code === REGISTRATION_ELIGIBILITY_ERROR_CODE.PORT_REQUIRED)
  );
});

test("23. RuleEvaluationPort success is normalized correctly", async () => {
  const harness = createEligibilityEvaluationTestHarness({
    competitionPolicies: {
      "comp-1": policyWithChecks([ELIGIBILITY_CHECK_TYPE.RANKING_REQUIREMENT]),
    },
    ruleEvaluationImpl: async () => ({
      accepted: true,
      reasonCodes: [],
      ruleSetVersion: "rs-1",
      traceRef: "trace-1",
    }),
  });
  const reg = await harness.seedRegistration(
    fixtureIndividualRegistration({ id: "reg-rule-ok", status: REGISTRATION_STATUS.SUBMITTED })
  );
  const result = await harness.service.evaluateRegistrationEligibility({
    registrationId: reg.id,
    evaluationRequestId: "eval-rule-ok",
  });
  assert.equal(result.ok, true);
  const check = result.checkResults.find((c) => c.checkType === ELIGIBILITY_CHECK_TYPE.RANKING_REQUIREMENT);
  assert.equal(check?.passed, true);
  assert.equal(check?.ruleRef, "trace-1");
});

test("24. RuleEvaluationPort failure is not treated as eligible", async () => {
  const harness = createEligibilityEvaluationTestHarness({
    competitionPolicies: {
      "comp-1": policyWithChecks([ELIGIBILITY_CHECK_TYPE.RANKING_REQUIREMENT]),
    },
    ruleEvaluationImpl: async () => ({
      accepted: false,
      reasonCodes: ["RANK_TOO_LOW"],
      ruleSetVersion: "rs-1",
    }),
  });
  const reg = await harness.seedRegistration(
    fixtureIndividualRegistration({ id: "reg-rule-fail", status: REGISTRATION_STATUS.SUBMITTED })
  );
  const result = await harness.service.evaluateRegistrationEligibility({
    registrationId: reg.id,
    evaluationRequestId: "eval-rule-fail",
  });
  assert.equal(result.decision?.outcome, ELIGIBILITY_OUTCOME.INELIGIBLE);
});

test("25. duplicate registration check works", async () => {
  const harness = createEligibilityEvaluationTestHarness({
    competitionPolicies: {
      "comp-1": policyWithChecks([
        ELIGIBILITY_CHECK_TYPE.REGISTRATION_WINDOW,
        ELIGIBILITY_CHECK_TYPE.DUPLICATE_REGISTRATION,
      ]),
    },
  });
  const existing = await harness.seedRegistration(
    fixtureIndividualRegistration({
      id: "reg-dup-existing",
      status: REGISTRATION_STATUS.SUBMITTED,
      target: { targetType: REGISTRATION_TARGET_TYPE.INDIVIDUAL, participantId: "p-1" },
    })
  );
  const phantom = fixtureIndividualRegistration({
    id: "reg-dup-new",
    status: REGISTRATION_STATUS.SUBMITTED,
    registrationRequestId: "req-dup-new",
    idempotencyKey: "idem-dup-new",
    target: { targetType: REGISTRATION_TARGET_TYPE.INDIVIDUAL, participantId: "p-1" },
  });
  const origGetById = harness.repository.getById.bind(harness.repository);
  harness.repository.getById = async (id) => {
    if (id === phantom.id) return phantom;
    return origGetById(id);
  };
  const result = await harness.service.evaluateRegistrationEligibility({
    registrationId: phantom.id,
    evaluationRequestId: "eval-dup",
  });
  assert.equal(result.decision?.outcome, ELIGIBILITY_OUTCOME.INELIGIBLE);
  assert.ok(existing.identityKey);
});

test("26. existing Entry check works", async () => {
  const harness = createEligibilityEvaluationTestHarness({
    competitionPolicies: {
      "comp-1": policyWithChecks([
        ELIGIBILITY_CHECK_TYPE.REGISTRATION_WINDOW,
        ELIGIBILITY_CHECK_TYPE.ENTRY_LIMIT,
      ]),
    },
  });
  harness.entryLookup = createInMemoryEntryLookupPort([
    {
      id: "entry-1",
      competitionId: "comp-1",
      identityKey: "comp-1::div-1::INDIVIDUAL::p-1",
    },
  ]);
  const service = createEligibilityEvaluationService({
    repository: harness.repository,
    audit: harness.audit,
    clock: harness.clock,
    ids: harness.ids,
    participantLookup: harness.participantLookup,
    entryLookup: harness.entryLookup,
    divisionEligibility: harness.divisionEligibility,
    competitionPolicy: harness.competitionPolicy,
    ruleEvaluation: harness.ruleEvaluation,
    paymentStatus: harness.paymentStatus,
    membershipStatus: harness.membershipStatus,
    teamRosterValidation: harness.teamRosterValidation,
  });
  const reg = await harness.seedRegistration(
    fixtureIndividualRegistration({ id: "reg-entry", status: REGISTRATION_STATUS.SUBMITTED })
  );
  const result = await service.evaluateRegistrationEligibility({
    registrationId: reg.id,
    evaluationRequestId: "eval-entry",
  });
  assert.equal(result.decision?.outcome, ELIGIBILITY_OUTCOME.INELIGIBLE);
});

// ---------------------------------------------------------------------------
// Evidence & audit
// ---------------------------------------------------------------------------

test("27. evaluation evidence contains required metadata", async () => {
  const harness = createEligibilityEvaluationTestHarness();
  const result = await evaluateSubmitted(harness, { id: "reg-evidence" }, "eval-evidence");
  assert.ok(result.evidence);
  assert.equal(result.evidence?.registrationId, "reg-evidence");
  assert.equal(result.evidence?.evaluationRequestId, "eval-evidence");
  assert.equal(result.evidence?.evaluatorVersion, ELIGIBILITY_EVALUATOR_VERSION);
  assert.ok(Array.isArray(result.evidence?.requiredCheckTypes));
  assert.ok(result.evidence?.outcome);
});

test("28. audit event is appended once", async () => {
  const harness = createEligibilityEvaluationTestHarness();
  await evaluateSubmitted(harness, { id: "reg-audit-once" }, "eval-audit-once");
  assert.equal(harness.audit._events.length, 1);
  assert.equal(
    harness.audit._events[0].operation,
    ELIGIBILITY_EVALUATION_OPERATION.EVALUATE_REGISTRATION
  );
  assert.equal(harness.audit._events[0].serviceVersion, ELIGIBILITY_EVALUATION_SERVICE_VERSION);
});

test("29. audit failure is not hidden", async () => {
  const harness = createEligibilityEvaluationTestHarness();
  const failingAudit = {
    async append() {
      throw new Error("AUDIT_SINK_UNAVAILABLE");
    },
    async listByRegistration() {
      return [];
    },
  };
  const service = createEligibilityEvaluationService({
    repository: harness.repository,
    audit: failingAudit,
    clock: harness.clock,
    ids: harness.ids,
    participantLookup: harness.participantLookup,
    entryLookup: harness.entryLookup,
    divisionEligibility: harness.divisionEligibility,
    competitionPolicy: harness.competitionPolicy,
    ruleEvaluation: harness.ruleEvaluation,
    paymentStatus: harness.paymentStatus,
    membershipStatus: harness.membershipStatus,
    teamRosterValidation: harness.teamRosterValidation,
  });
  const reg = await harness.seedRegistration(
    fixtureIndividualRegistration({ id: "reg-audit-fail", status: REGISTRATION_STATUS.SUBMITTED })
  );
  const result = await service.evaluateRegistrationEligibility({
    registrationId: reg.id,
    evaluationRequestId: "eval-audit-fail",
  });
  assert.equal(result.ok, false);
  assert.equal(result.errors?.[0].code, REGISTRATION_ELIGIBILITY_ERROR_CODE.AUDIT_APPEND_FAILED);
  assert.equal(result.metadata?.evaluatedWithoutAudit, true);
  assert.ok(result.decision);
});

test("30. safe evaluation replay does not duplicate audit", async () => {
  const harness = createEligibilityEvaluationTestHarness();
  const reg = await harness.seedRegistration(
    fixtureIndividualRegistration({ id: "reg-replay", status: REGISTRATION_STATUS.SUBMITTED })
  );
  const first = await harness.service.evaluateRegistrationEligibility({
    registrationId: reg.id,
    evaluationRequestId: "eval-replay",
  });
  const second = await harness.service.evaluateRegistrationEligibility({
    registrationId: reg.id,
    evaluationRequestId: "eval-replay",
  });
  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  assert.equal(second.replayed, true);
  assert.equal(harness.audit._events.length, 1);
  assert.equal(second.decision?.outcome, first.decision?.outcome);
});

test("31. conflicting evaluation request ID fails", async () => {
  const harness = createEligibilityEvaluationTestHarness();
  const regA = await harness.seedRegistration(
    fixtureIndividualRegistration({
      id: "reg-conflict-a",
      status: REGISTRATION_STATUS.SUBMITTED,
      target: { targetType: REGISTRATION_TARGET_TYPE.INDIVIDUAL, participantId: "p-1" },
    })
  );
  const regB = await harness.seedRegistration(
    fixtureIndividualRegistration({
      id: "reg-conflict-b",
      status: REGISTRATION_STATUS.SUBMITTED,
      registrationRequestId: "req-b",
      idempotencyKey: "idem-b",
      target: { targetType: REGISTRATION_TARGET_TYPE.INDIVIDUAL, participantId: "p-2" },
      divisionId: "div-doubles",
    })
  );
  await harness.service.evaluateRegistrationEligibility({
    registrationId: regA.id,
    evaluationRequestId: "eval-conflict",
  });
  const conflict = await harness.service.evaluateRegistrationEligibility({
    registrationId: regB.id,
    evaluationRequestId: "eval-conflict",
  });
  assert.equal(conflict.ok, false);
  assert.equal(conflict.idempotencyResult, "CONFLICT");
});

test("31b. same evaluationRequestId + different rule-set version CONFLICT", async () => {
  const policies = {
    "comp-1": policyWithChecks(
      [ELIGIBILITY_CHECK_TYPE.REGISTRATION_WINDOW, ELIGIBILITY_CHECK_TYPE.PARTICIPANT_STATUS],
      {
        eligibilityPolicy: {
          policyId: "pol-rs",
          ruleSetId: "rs-1",
          ruleSetVersion: "1.0.0",
          requiredCheckTypes: [
            ELIGIBILITY_CHECK_TYPE.REGISTRATION_WINDOW,
            ELIGIBILITY_CHECK_TYPE.PARTICIPANT_STATUS,
          ],
        },
      }
    ),
  };
  const harness = createEligibilityEvaluationTestHarness({ competitionPolicies: policies });
  const reg = await harness.seedRegistration(
    fixtureIndividualRegistration({ id: "reg-rs-conflict", status: REGISTRATION_STATUS.SUBMITTED })
  );
  const first = await harness.service.evaluateRegistrationEligibility({
    registrationId: reg.id,
    evaluationRequestId: "eval-rs-conflict",
  });
  assert.equal(first.ok, true);

  policies["comp-1"] = policyWithChecks(
    [ELIGIBILITY_CHECK_TYPE.REGISTRATION_WINDOW, ELIGIBILITY_CHECK_TYPE.PARTICIPANT_STATUS],
    {
      eligibilityPolicy: {
        policyId: "pol-rs",
        ruleSetId: "rs-1",
        ruleSetVersion: "2.0.0",
        requiredCheckTypes: [
          ELIGIBILITY_CHECK_TYPE.REGISTRATION_WINDOW,
          ELIGIBILITY_CHECK_TYPE.PARTICIPANT_STATUS,
        ],
      },
    }
  );

  const conflict = await harness.service.evaluateRegistrationEligibility({
    registrationId: reg.id,
    evaluationRequestId: "eval-rs-conflict",
  });
  assert.equal(conflict.ok, false);
  assert.equal(conflict.idempotencyResult, "CONFLICT");
  assert.equal(conflict.errors?.[0].code, REGISTRATION_ELIGIBILITY_ERROR_CODE.IDEMPOTENCY_CONFLICT);
  assert.equal(harness.audit._events.length, 1);
});

test("31c. same evaluationRequestId + different required check set CONFLICT", async () => {
  const policies = {
    "comp-1": policyWithChecks([
      ELIGIBILITY_CHECK_TYPE.REGISTRATION_WINDOW,
      ELIGIBILITY_CHECK_TYPE.PARTICIPANT_STATUS,
    ]),
  };
  const harness = createEligibilityEvaluationTestHarness({ competitionPolicies: policies });
  const reg = await harness.seedRegistration(
    fixtureIndividualRegistration({ id: "reg-checks-conflict", status: REGISTRATION_STATUS.SUBMITTED })
  );
  const first = await harness.service.evaluateRegistrationEligibility({
    registrationId: reg.id,
    evaluationRequestId: "eval-checks-conflict",
  });
  assert.equal(first.ok, true);

  policies["comp-1"] = policyWithChecks([
    ELIGIBILITY_CHECK_TYPE.REGISTRATION_WINDOW,
    ELIGIBILITY_CHECK_TYPE.PARTICIPANT_STATUS,
    ELIGIBILITY_CHECK_TYPE.MANUAL_APPROVAL,
  ]);

  const conflict = await harness.service.evaluateRegistrationEligibility({
    registrationId: reg.id,
    evaluationRequestId: "eval-checks-conflict",
  });
  assert.equal(conflict.ok, false);
  assert.equal(conflict.idempotencyResult, "CONFLICT");
});

test("31d. same evaluationRequestId + different policy identity CONFLICT", async () => {
  const policies = {
    "comp-1": policyWithChecks(
      [ELIGIBILITY_CHECK_TYPE.REGISTRATION_WINDOW, ELIGIBILITY_CHECK_TYPE.PARTICIPANT_STATUS],
      {
        eligibilityPolicy: {
          policyId: "pol-a",
          requiredCheckTypes: [
            ELIGIBILITY_CHECK_TYPE.REGISTRATION_WINDOW,
            ELIGIBILITY_CHECK_TYPE.PARTICIPANT_STATUS,
          ],
          parameters: { policyVersion: "1" },
        },
      }
    ),
  };
  const harness = createEligibilityEvaluationTestHarness({ competitionPolicies: policies });
  const reg = await harness.seedRegistration(
    fixtureIndividualRegistration({ id: "reg-pol-conflict", status: REGISTRATION_STATUS.SUBMITTED })
  );
  await harness.service.evaluateRegistrationEligibility({
    registrationId: reg.id,
    evaluationRequestId: "eval-pol-conflict",
  });

  policies["comp-1"] = policyWithChecks(
    [ELIGIBILITY_CHECK_TYPE.REGISTRATION_WINDOW, ELIGIBILITY_CHECK_TYPE.PARTICIPANT_STATUS],
    {
      eligibilityPolicy: {
        policyId: "pol-b",
        requiredCheckTypes: [
          ELIGIBILITY_CHECK_TYPE.REGISTRATION_WINDOW,
          ELIGIBILITY_CHECK_TYPE.PARTICIPANT_STATUS,
        ],
        parameters: { policyVersion: "1" },
      },
    }
  );

  const conflict = await harness.service.evaluateRegistrationEligibility({
    registrationId: reg.id,
    evaluationRequestId: "eval-pol-conflict",
  });
  assert.equal(conflict.ok, false);
  assert.equal(conflict.idempotencyResult, "CONFLICT");
});

test("31e. missing evaluationRequestId fails closed", async () => {
  const harness = createEligibilityEvaluationTestHarness();
  const reg = await harness.seedRegistration(
    fixtureIndividualRegistration({ id: "reg-missing-eval-id", status: REGISTRATION_STATUS.SUBMITTED })
  );
  const result = await harness.service.evaluateRegistrationEligibility({
    registrationId: reg.id,
    evaluationRequestId: "",
  });
  assert.equal(result.ok, false);
  assert.equal(result.errors?.[0].code, REGISTRATION_ELIGIBILITY_ERROR_CODE.MISSING_IDENTIFIER);
});

// ---------------------------------------------------------------------------
// Isolation scans
// ---------------------------------------------------------------------------

test("32. no direct Date.now usage in orchestration services", () => {
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

test("33. no random identifier generation in orchestration services", () => {
  const files = collectJsFiles(SERVICES_ROOT);
  for (const file of files) {
    const src = readFileSync(file, "utf8");
    assert.equal(src.includes("Math.random("), false, `${file} must not call Math.random`);
    assert.equal(src.includes("crypto.random"), false, `${file} must not use crypto.random*`);
  }
});

test("34. no direct runtime imports from sibling cores or legacy Phase 3C", () => {
  const files = collectJsFiles(MODULE_ROOT);
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

test("35. Phase 1A regression import smoke", async () => {
  const mod = await import("../src/features/competition-core/registration-eligibility/index.js");
  assert.equal(typeof mod.createEligibilityDecision, "function");
  assert.equal(typeof mod.orderEligibilityReasons, "function");
});

test("36. Phase 1B regression import smoke", async () => {
  const mod = await import("../src/features/competition-core/registration-eligibility/index.js");
  assert.equal(typeof mod.createRegistrationLifecycleService, "function");
  assert.equal(typeof mod.createEligibilityEvaluationService, "function");
});
