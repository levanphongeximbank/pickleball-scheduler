/**
 * Core-03 Phase 1G — Runtime QA, migration readiness, and closure tests.
 * Run: node --test tests/competition-core-registration-eligibility-core03-phase1g.test.js
 *
 * Does not connect to a database, apply SQL, deploy, or mutate Production.
 */

import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

import {
  REGISTRATION_STATUS,
  REGISTRATION_TARGET_TYPE,
  REGISTRATION_ELIGIBILITY_ERROR_CODE,
  ELIGIBILITY_OUTCOME,
  ELIGIBILITY_CHECK_TYPE,
  CORE03_PHASE_1F_MIGRATION_STATUS,
  CORE03_PHASE_1G_CLOSURE_STATUS,
  ENTRY_CREATION_COMPATIBILITY_GAP,
  createRegistrationTarget,
  createRegistrationApplicant,
  createCompetitionRegistration,
  createCore03PersistenceRepositories,
  createCore03MemoryPersistenceStore,
  runPersistenceTransaction,
} from "../src/features/competition-core/registration-eligibility/index.js";

import {
  createCore03RuntimeCompositionHarness,
  runtimeWaitlistPlacementAuth,
  runtimeWaitlistPromotionAuth,
  CORE03_RECONCILIATION_SCENARIOS,
} from "../src/features/competition-core/registration-eligibility/fixtures/runtimeCompositionHarness.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..");
const MODULE_ROOT = join(
  REPO_ROOT,
  "src/features/competition-core/registration-eligibility"
);
const CAPABILITY_INDEX = join(MODULE_ROOT, "index.js");
const ROOT_BARREL = join(REPO_ROOT, "src/features/competition-core/index.js");
const SQL_PATH = join(
  REPO_ROOT,
  "docs/competition-engine/core-03/supabase-core03-phase1f-persistence.sql"
);
const ROLLBACK_PATH = join(
  REPO_ROOT,
  "docs/competition-engine/core-03/supabase-core03-phase1f-persistence-rollback.sql"
);
const VERIFICATION_DOC = join(
  REPO_ROOT,
  "docs/competition-engine/core-03/09_MIGRATION_VERIFICATION_QUERIES.md"
);
const STAGING_DOC = join(
  REPO_ROOT,
  "docs/competition-engine/core-03/10_STAGING_ROLLOUT_CHECKLIST.md"
);
const CLOSURE_DOC = join(
  REPO_ROOT,
  "docs/competition-engine/core-03/08_PHASE_1G_RUNTIME_QA_CLOSURE.md"
);
const RECON_DOC = join(
  REPO_ROOT,
  "docs/competition-engine/core-03/11_RECONCILIATION_QA.md"
);

function collectJsFiles(root) {
  const out = [];
  for (const name of readdirSync(root)) {
    const full = join(root, name);
    const st = statSync(full);
    if (st.isDirectory()) out.push(...collectJsFiles(full));
    else if (name.endsWith(".js")) out.push(full);
  }
  return out;
}

function exhaustedCapacityStates(scope = "competition") {
  if (scope === "division") {
    return [
      {
        competitionId: "comp-1",
        divisionId: null,
        limit: 100,
        used: 0,
        reserved: 0,
        stateVersion: 0,
      },
      {
        competitionId: "comp-1",
        divisionId: "div-1",
        limit: 0,
        used: 0,
        reserved: 0,
        stateVersion: 0,
      },
    ];
  }
  return [
    {
      competitionId: "comp-1",
      divisionId: null,
      limit: 0,
      used: 0,
      reserved: 0,
      stateVersion: 0,
    },
    {
      competitionId: "comp-1",
      divisionId: "div-1",
      limit: 0,
      used: 0,
      reserved: 0,
      stateVersion: 0,
    },
  ];
}

async function readyIndividual(rt, overrides = {}) {
  const draft = await rt.createDraftIndividual(overrides);
  assert.equal(draft.ok, true);
  const advanced = await rt.advanceToUnderReview(draft);
  assert.equal(advanced.submitted.ok, true);
  assert.equal(advanced.review.ok, true);
  const evaluation = await rt.evaluateAndBridge(draft.registration.id);
  assert.equal(evaluation.ok, true);
  assert.equal(evaluation.decision.outcome, ELIGIBILITY_OUTCOME.ELIGIBLE);
  return { draft, advanced, evaluation, registration: advanced.review.registration };
}

// ---------------------------------------------------------------------------
// 1–7 Lifecycle composition
// ---------------------------------------------------------------------------

test("1. Create draft registration via composed lifecycle", async () => {
  const rt = createCore03RuntimeCompositionHarness();
  const draft = await rt.createDraftIndividual({
    registrationRequestId: "req-1g-1",
    idempotencyKey: "idem-1g-1",
  });
  assert.equal(draft.ok, true);
  assert.equal(draft.registration.status, REGISTRATION_STATUS.DRAFT);
  assert.equal(rt.productionCompositionRoot, false);
  assert.equal(rt.isTestOnlyComposition, true);
});

test("2. Submit registration", async () => {
  const rt = createCore03RuntimeCompositionHarness();
  const draft = await rt.createDraftIndividual();
  const submitted = await rt.lifecycle.submitRegistration({
    registrationId: draft.registration.id,
    actorId: "user-1",
    requestId: "submit-1g-2",
  });
  assert.equal(submitted.ok, true);
  assert.equal(submitted.currentStatus, REGISTRATION_STATUS.SUBMITTED);
});

test("3. Begin review", async () => {
  const rt = createCore03RuntimeCompositionHarness();
  const draft = await rt.createDraftIndividual();
  await rt.lifecycle.submitRegistration({
    registrationId: draft.registration.id,
    actorId: "user-1",
    requestId: "submit-1g-3",
  });
  const review = await rt.lifecycle.beginRegistrationReview({
    registrationId: draft.registration.id,
    actorId: "director-1",
    requestId: "review-1g-3",
  });
  assert.equal(review.ok, true);
  assert.equal(review.currentStatus, REGISTRATION_STATUS.UNDER_REVIEW);
});

test("4. Evaluate eligible individual registration", async () => {
  const rt = createCore03RuntimeCompositionHarness();
  const { evaluation } = await readyIndividual(rt, {
    registrationRequestId: "req-1g-4",
    idempotencyKey: "idem-1g-4",
  });
  assert.equal(evaluation.decision.outcome, ELIGIBILITY_OUTCOME.ELIGIBLE);
  const evidence = await rt.persistence.eligibilityEvidence.getLatestByRegistrationId(
    evaluation.registrationId
  );
  assert.ok(evidence);
  assert.equal(evidence.outcome, ELIGIBILITY_OUTCOME.ELIGIBLE);
});

test("5. Reserve capacity", async () => {
  const rt = createCore03RuntimeCompositionHarness();
  const { registration } = await readyIndividual(rt);
  const reserve = await rt.capacity.reserveRegistrationCapacity({
    registrationId: registration.id,
    requestId: "reserve-1g-5",
    actorId: "director-1",
  });
  assert.equal(reserve.ok, true);
  assert.ok(reserve.reservation?.reservationId);
  assert.equal(reserve.reservation.status, "ACTIVE");
});

test("6. Approve registration after reservation (test-only composition helper)", async () => {
  const rt = createCore03RuntimeCompositionHarness();
  const { registration } = await readyIndividual(rt);
  await rt.capacity.reserveRegistrationCapacity({
    registrationId: registration.id,
    requestId: "reserve-1g-6",
  });
  const approved = await rt.approveReservedRegistration({
    registrationId: registration.id,
    requestId: "approve-1g-6",
    actorId: "director-1",
  });
  assert.equal(approved.ok, true);
  assert.equal(approved.currentStatus, REGISTRATION_STATUS.APPROVED);
  assert.equal(approved.handoffPending, true);
});

test("7. Confirm no Core-02 Entry is created on approve", async () => {
  const rt = createCore03RuntimeCompositionHarness();
  const { registration } = await readyIndividual(rt);
  await rt.capacity.reserveRegistrationCapacity({
    registrationId: registration.id,
    requestId: "reserve-1g-7",
  });
  const approved = await rt.approveReservedRegistration({
    registrationId: registration.id,
    requestId: "approve-1g-7",
  });
  assert.equal(approved.entryCreated, false);
  assert.equal(approved.entryCreation.ok, false);
  assert.equal(
    approved.entryCreation.errorCode,
    REGISTRATION_ELIGIBILITY_ERROR_CODE.ENTRY_CREATION_ADAPTER_UNAVAILABLE
  );
});

// ---------------------------------------------------------------------------
// 8–12 Eligibility sibling integration
// ---------------------------------------------------------------------------

test("8. Evaluate pair registration with canonical participant identity", async () => {
  const rt = createCore03RuntimeCompositionHarness({
    competitionPolicies: {
      "comp-1": {
        policyAvailable: true,
        windowOpen: true,
        policyRef: "pol-pair",
        allowWaitlist: true,
        eligibilityPolicy: {
          policyId: "pol-pair",
          requiredCheckTypes: [
            ELIGIBILITY_CHECK_TYPE.REGISTRATION_WINDOW,
            ELIGIBILITY_CHECK_TYPE.PARTICIPANT_STATUS,
          ],
        },
      },
    },
  });
  const draft = await rt.lifecycle.createDraftRegistration({
    competitionId: "comp-1",
    divisionId: "div-doubles",
    applicant: createRegistrationApplicant({
      platformUserId: "user-1",
      participantId: "p-1",
    }),
    target: createRegistrationTarget({
      targetType: REGISTRATION_TARGET_TYPE.PAIR,
      participantIds: ["p-2", "p-1"],
    }),
    registrationRequestId: "req-pair-1g",
    idempotencyKey: "idem-pair-1g",
    actorId: "user-1",
  });
  assert.equal(draft.ok, true);
  await rt.lifecycle.submitRegistration({
    registrationId: draft.registration.id,
    actorId: "user-1",
    requestId: "submit-pair",
  });
  await rt.lifecycle.beginRegistrationReview({
    registrationId: draft.registration.id,
    actorId: "director-1",
    requestId: "review-pair",
  });
  const evaluation = await rt.evaluateAndBridge(draft.registration.id, "eval-pair-1g");
  assert.equal(evaluation.ok, true);
  assert.equal(evaluation.decision.outcome, ELIGIBILITY_OUTCOME.ELIGIBLE);
});

test("9. Detect duplicate active Entry", async () => {
  const rt = createCore03RuntimeCompositionHarness({
    entries: [
      {
        id: "entry-dup-1",
        competitionId: "comp-1",
        divisionId: "div-1",
        status: "ACTIVE",
        participantId: "p-1",
        identityKey: "comp-1::div-1::INDIVIDUAL::p-1",
      },
    ],
    competitionPolicies: {
      "comp-1": {
        policyAvailable: true,
        windowOpen: true,
        policyRef: "pol-dup",
        allowWaitlist: true,
        eligibilityPolicy: {
          policyId: "pol-dup",
          requiredCheckTypes: [
            ELIGIBILITY_CHECK_TYPE.REGISTRATION_WINDOW,
            ELIGIBILITY_CHECK_TYPE.PARTICIPANT_STATUS,
            ELIGIBILITY_CHECK_TYPE.ENTRY_LIMIT,
          ],
        },
      },
    },
  });
  const draft = await rt.createDraftIndividual({
    registrationRequestId: "req-dup-1g",
    idempotencyKey: "idem-dup-1g",
  });
  await rt.lifecycle.submitRegistration({
    registrationId: draft.registration.id,
    actorId: "user-1",
    requestId: "submit-dup",
  });
  await rt.lifecycle.beginRegistrationReview({
    registrationId: draft.registration.id,
    actorId: "director-1",
    requestId: "review-dup",
  });
  const evaluation = await rt.evaluateAndBridge(draft.registration.id, "eval-dup-1g");
  assert.equal(evaluation.ok, true);
  assert.notEqual(evaluation.decision.outcome, ELIGIBILITY_OUTCOME.ELIGIBLE);
});

test("10. Evaluate team registration with valid roster", async () => {
  const rt = createCore03RuntimeCompositionHarness({
    competitionPolicies: {
      "comp-1": {
        policyAvailable: true,
        windowOpen: true,
        policyRef: "pol-team",
        allowWaitlist: true,
        eligibilityPolicy: {
          policyId: "pol-team",
          requiredCheckTypes: [
            ELIGIBILITY_CHECK_TYPE.REGISTRATION_WINDOW,
            ELIGIBILITY_CHECK_TYPE.PARTICIPANT_STATUS,
            ELIGIBILITY_CHECK_TYPE.TEAM_ROSTER_REQUIREMENT,
          ],
        },
      },
    },
  });
  const draft = await rt.lifecycle.createDraftRegistration({
    competitionId: "comp-1",
    divisionId: "div-team",
    applicant: createRegistrationApplicant({
      platformUserId: "user-cap",
      participantId: "p-captain",
    }),
    target: createRegistrationTarget({
      targetType: REGISTRATION_TARGET_TYPE.TEAM,
      teamId: "team-1",
      representativeParticipantId: "p-captain",
    }),
    registrationRequestId: "req-team-1g",
    idempotencyKey: "idem-team-1g",
    actorId: "user-cap",
  });
  assert.equal(draft.ok, true);
  await rt.lifecycle.submitRegistration({
    registrationId: draft.registration.id,
    actorId: "user-cap",
    requestId: "submit-team",
  });
  await rt.lifecycle.beginRegistrationReview({
    registrationId: draft.registration.id,
    actorId: "director-1",
    requestId: "review-team",
  });
  const evaluation = await rt.evaluateAndBridge(draft.registration.id, "eval-team-1g");
  assert.equal(evaluation.ok, true);
  assert.equal(evaluation.decision.outcome, ELIGIBILITY_OUTCOME.ELIGIBLE);
  assert.ok(rt.facades.calls.validateTeamRoster >= 1);
});

test("11. Reject invalid or stale team roster", async () => {
  const rt = createCore03RuntimeCompositionHarness({
    facades: {
      rosterResult: {
        ok: false,
        issues: [{ code: "ROSTER_STALE", message: "Roster version stale" }],
        value: null,
      },
    },
    competitionPolicies: {
      "comp-1": {
        policyAvailable: true,
        windowOpen: true,
        policyRef: "pol-team-bad",
        allowWaitlist: true,
        eligibilityPolicy: {
          policyId: "pol-team-bad",
          requiredCheckTypes: [
            ELIGIBILITY_CHECK_TYPE.REGISTRATION_WINDOW,
            ELIGIBILITY_CHECK_TYPE.PARTICIPANT_STATUS,
            ELIGIBILITY_CHECK_TYPE.TEAM_ROSTER_REQUIREMENT,
          ],
        },
      },
    },
  });
  const draft = await rt.lifecycle.createDraftRegistration({
    competitionId: "comp-1",
    divisionId: "div-team",
    applicant: createRegistrationApplicant({
      platformUserId: "user-cap",
      participantId: "p-captain",
    }),
    target: createRegistrationTarget({
      targetType: REGISTRATION_TARGET_TYPE.TEAM,
      teamId: "team-1",
      representativeParticipantId: "p-captain",
    }),
    registrationRequestId: "req-team-bad",
    idempotencyKey: "idem-team-bad",
  });
  await rt.lifecycle.submitRegistration({
    registrationId: draft.registration.id,
    actorId: "user-cap",
    requestId: "submit-team-bad",
  });
  await rt.lifecycle.beginRegistrationReview({
    registrationId: draft.registration.id,
    actorId: "director-1",
    requestId: "review-team-bad",
  });
  const evaluation = await rt.evaluateAndBridge(draft.registration.id, "eval-team-bad");
  assert.equal(evaluation.ok, true);
  assert.notEqual(evaluation.decision.outcome, ELIGIBILITY_OUTCOME.ELIGIBLE);
});

test("12. Reject incompatible division", async () => {
  const rt = createCore03RuntimeCompositionHarness({
    facades: {
      divisionResult: {
        ok: false,
        errors: [{ code: "DIVISION_INCOMPATIBLE", message: "Incompatible" }],
        warnings: [],
        value: null,
      },
    },
    competitionPolicies: {
      "comp-1": {
        policyAvailable: true,
        windowOpen: true,
        policyRef: "pol-div",
        allowWaitlist: true,
        eligibilityPolicy: {
          policyId: "pol-div",
          requiredCheckTypes: [
            ELIGIBILITY_CHECK_TYPE.REGISTRATION_WINDOW,
            ELIGIBILITY_CHECK_TYPE.PARTICIPANT_STATUS,
            ELIGIBILITY_CHECK_TYPE.DIVISION_COMPATIBILITY,
          ],
        },
      },
    },
  });
  const draft = await rt.createDraftIndividual({
    registrationRequestId: "req-div-1g",
    idempotencyKey: "idem-div-1g",
  });
  await rt.lifecycle.submitRegistration({
    registrationId: draft.registration.id,
    actorId: "user-1",
    requestId: "submit-div",
  });
  await rt.lifecycle.beginRegistrationReview({
    registrationId: draft.registration.id,
    actorId: "director-1",
    requestId: "review-div",
  });
  const evaluation = await rt.evaluateAndBridge(draft.registration.id, "eval-div-1g");
  assert.equal(evaluation.ok, true);
  assert.notEqual(evaluation.decision.outcome, ELIGIBILITY_OUTCOME.ELIGIBLE);
});

// ---------------------------------------------------------------------------
// 13–22 Capacity / waitlist
// ---------------------------------------------------------------------------

test("13. Waitlist when competition capacity is exhausted", async () => {
  const rt = createCore03RuntimeCompositionHarness({
    capacityStates: exhaustedCapacityStates("competition"),
  });
  const { registration } = await readyIndividual(rt, {
    registrationRequestId: "req-wl-comp",
    idempotencyKey: "idem-wl-comp",
  });
  const reserve = await rt.capacity.reserveRegistrationCapacity({
    registrationId: registration.id,
    requestId: "reserve-wl-comp",
  });
  assert.equal(reserve.ok, false);
  assert.equal(
    reserve.errors[0].code,
    REGISTRATION_ELIGIBILITY_ERROR_CODE.CAPACITY_EXHAUSTED
  );
  const waitlisted = await rt.capacity.placeRegistrationOnWaitlist({
    registrationId: registration.id,
    requestId: "wl-comp-1",
    waitlistAuthorization: runtimeWaitlistPlacementAuth(registration),
  });
  assert.equal(waitlisted.ok, true);
  assert.equal(waitlisted.currentStatus, REGISTRATION_STATUS.WAITLISTED);
});

test("14. Waitlist when division capacity is exhausted", async () => {
  const rt = createCore03RuntimeCompositionHarness({
    capacityStates: exhaustedCapacityStates("division"),
  });
  const { registration } = await readyIndividual(rt, {
    registrationRequestId: "req-wl-div",
    idempotencyKey: "idem-wl-div",
  });
  const reserve = await rt.capacity.reserveRegistrationCapacity({
    registrationId: registration.id,
    requestId: "reserve-wl-div",
  });
  assert.equal(reserve.ok, false);
  const waitlisted = await rt.capacity.placeRegistrationOnWaitlist({
    registrationId: registration.id,
    requestId: "wl-div-1",
    waitlistAuthorization: runtimeWaitlistPlacementAuth(registration),
  });
  assert.equal(waitlisted.ok, true);
  assert.equal(waitlisted.currentStatus, REGISTRATION_STATUS.WAITLISTED);
});

test("15. Deterministic waitlist position", async () => {
  const rt = createCore03RuntimeCompositionHarness({
    capacityStates: exhaustedCapacityStates("competition"),
  });
  const a = await readyIndividual(rt, {
    registrationRequestId: "req-pos-a",
    idempotencyKey: "idem-pos-a",
    participantId: "p-1",
  });
  const bDraft = await rt.createDraftIndividual({
    registrationRequestId: "req-pos-b",
    idempotencyKey: "idem-pos-b",
    participantId: "p-2",
  });
  const bAdv = await rt.advanceToUnderReview(bDraft);
  await rt.evaluateAndBridge(bDraft.registration.id, "eval-pos-b");

  await rt.capacity.placeRegistrationOnWaitlist({
    registrationId: a.registration.id,
    requestId: "wl-pos-a",
    priorityRank: 10,
    waitlistAuthorization: runtimeWaitlistPlacementAuth(a.registration, {
      authorizationRef: "AUTHZ-A",
    }),
  });
  await rt.capacity.placeRegistrationOnWaitlist({
    registrationId: bAdv.review.registration.id,
    requestId: "wl-pos-b",
    priorityRank: 20,
    waitlistAuthorization: runtimeWaitlistPlacementAuth(bAdv.review.registration, {
      authorizationRef: "AUTHZ-B",
    }),
  });
  const listed = await rt.capacity.listWaitlist({
    competitionId: "comp-1",
    divisionId: "div-1",
  });
  assert.equal(listed.ok, true);
  const entries = listed.metadata.waitlistEntries;
  const positions = listed.metadata.waitlistPositions;
  assert.equal(entries[0].registrationId, a.registration.id);
  assert.equal(positions[0].registrationId, a.registration.id);
  assert.equal(positions[0].position, 1);
  assert.equal(positions[1].registrationId, bAdv.review.registration.id);
  assert.equal(positions[1].position, 2);
});

test("16. Release capacity", async () => {
  const rt = createCore03RuntimeCompositionHarness();
  const { registration } = await readyIndividual(rt);
  await rt.capacity.reserveRegistrationCapacity({
    registrationId: registration.id,
    requestId: "reserve-rel-1",
  });
  const released = await rt.capacity.releaseRegistrationCapacity({
    registrationId: registration.id,
    requestId: "release-1g-16",
    actorId: "director-1",
  });
  assert.equal(released.ok, true);
  const active = await rt.persistence.capacityReservations.findActiveByRegistrationId(
    registration.id
  );
  assert.equal(active, null);
});

test("17. Select promotion candidate", async () => {
  const rt = createCore03RuntimeCompositionHarness({
    capacityStates: exhaustedCapacityStates("competition"),
  });
  const { registration } = await readyIndividual(rt, {
    registrationRequestId: "req-promo-cand",
    idempotencyKey: "idem-promo-cand",
  });
  await rt.capacity.placeRegistrationOnWaitlist({
    registrationId: registration.id,
    requestId: "wl-promo-cand",
    waitlistAuthorization: runtimeWaitlistPlacementAuth(registration),
  });
  // Free capacity for promotion path
  await rt.seedCapacityStates([
    {
      competitionId: "comp-1",
      divisionId: null,
      limit: 5,
      used: 0,
      reserved: 0,
      stateVersion: 1,
    },
    {
      competitionId: "comp-1",
      divisionId: "div-1",
      limit: 5,
      used: 0,
      reserved: 0,
      stateVersion: 1,
    },
  ]);
  const selected = await rt.capacity.selectWaitlistPromotionCandidates({
    competitionId: "comp-1",
    divisionId: "div-1",
    limit: 1,
  });
  assert.equal(selected.ok, true);
  assert.equal(selected.promotionCandidates[0].registrationId, registration.id);
});

test("18. Promote only with valid scope-bound authorization", async () => {
  const rt = createCore03RuntimeCompositionHarness({
    capacityStates: exhaustedCapacityStates("competition"),
  });
  const { registration } = await readyIndividual(rt, {
    registrationRequestId: "req-promo-ok",
    idempotencyKey: "idem-promo-ok",
  });
  await rt.capacity.placeRegistrationOnWaitlist({
    registrationId: registration.id,
    requestId: "wl-promo-ok",
    waitlistAuthorization: runtimeWaitlistPlacementAuth(registration),
  });
  await rt.seedCapacityStates([
    {
      competitionId: "comp-1",
      divisionId: null,
      limit: 5,
      used: 0,
      reserved: 0,
      stateVersion: 1,
    },
    {
      competitionId: "comp-1",
      divisionId: "div-1",
      limit: 5,
      used: 0,
      reserved: 0,
      stateVersion: 1,
    },
  ]);
  const promoted = await rt.capacity.promoteWaitlistedRegistration({
    registrationId: registration.id,
    requestId: "promo-ok-1",
    approvalAuthorization: runtimeWaitlistPromotionAuth(registration),
  });
  assert.equal(promoted.ok, true);
  assert.equal(promoted.currentStatus, REGISTRATION_STATUS.APPROVED);
  assert.equal(promoted.metadata?.entryCreated, false);
});

test("19. Reject bare promotion boolean", async () => {
  const rt = createCore03RuntimeCompositionHarness({
    capacityStates: exhaustedCapacityStates("competition"),
  });
  const { registration } = await readyIndividual(rt, {
    registrationRequestId: "req-promo-bool",
    idempotencyKey: "idem-promo-bool",
  });
  await rt.capacity.placeRegistrationOnWaitlist({
    registrationId: registration.id,
    requestId: "wl-promo-bool",
    waitlistAuthorization: runtimeWaitlistPlacementAuth(registration),
  });
  const rejected = await rt.capacity.promoteWaitlistedRegistration({
    registrationId: registration.id,
    requestId: "promo-bool-1",
    approvalAuthorization: true,
  });
  assert.equal(rejected.ok, false);
  assert.equal(
    rejected.errors[0].code,
    REGISTRATION_ELIGIBILITY_ERROR_CODE.INVALID_PROMOTION_PRECONDITION
  );
});

test("20. Reject stale capacity version", async () => {
  const rt = createCore03RuntimeCompositionHarness();
  const { registration } = await readyIndividual(rt);
  const rejected = await rt.capacity.reserveRegistrationCapacity({
    registrationId: registration.id,
    requestId: "reserve-stale-cap",
    expectedStateVersion: 99,
  });
  assert.equal(rejected.ok, false);
  assert.equal(
    rejected.errors[0].code,
    REGISTRATION_ELIGIBILITY_ERROR_CODE.STALE_CAPACITY_VERSION
  );
});

test("21. Reject stale waitlist version", async () => {
  const rt = createCore03RuntimeCompositionHarness({
    capacityStates: exhaustedCapacityStates("competition"),
  });
  const { registration } = await readyIndividual(rt, {
    registrationRequestId: "req-stale-wl",
    idempotencyKey: "idem-stale-wl",
  });
  await rt.capacity.placeRegistrationOnWaitlist({
    registrationId: registration.id,
    requestId: "wl-stale",
    waitlistAuthorization: runtimeWaitlistPlacementAuth(registration),
  });
  await rt.seedCapacityStates([
    {
      competitionId: "comp-1",
      divisionId: null,
      limit: 5,
      used: 0,
      reserved: 0,
      stateVersion: 1,
    },
    {
      competitionId: "comp-1",
      divisionId: "div-1",
      limit: 5,
      used: 0,
      reserved: 0,
      stateVersion: 1,
    },
  ]);
  const rejected = await rt.capacity.promoteWaitlistedRegistration({
    registrationId: registration.id,
    requestId: "promo-stale-wl",
    approvalAuthorization: runtimeWaitlistPromotionAuth(registration),
    expectedWaitlistVersion: 0,
  });
  assert.equal(rejected.ok, false);
  assert.equal(
    rejected.errors[0].code,
    REGISTRATION_ELIGIBILITY_ERROR_CODE.STALE_WAITLIST_VERSION
  );
});

test("22. Withdraw waitlisted registration", async () => {
  const rt = createCore03RuntimeCompositionHarness({
    capacityStates: exhaustedCapacityStates("competition"),
  });
  const { registration } = await readyIndividual(rt, {
    registrationRequestId: "req-wl-wd",
    idempotencyKey: "idem-wl-wd",
  });
  await rt.capacity.placeRegistrationOnWaitlist({
    registrationId: registration.id,
    requestId: "wl-wd",
    waitlistAuthorization: runtimeWaitlistPlacementAuth(registration),
  });
  const withdrawn = await rt.capacity.withdrawWaitlistedRegistration({
    registrationId: registration.id,
    requestId: "wl-wd-out",
    actorId: "user-1",
  });
  assert.equal(withdrawn.ok, true);
  assert.equal(withdrawn.currentStatus, REGISTRATION_STATUS.WITHDRAWN);
});

// ---------------------------------------------------------------------------
// 23–28 Idempotency / audit once
// ---------------------------------------------------------------------------

test("23. Exact registration request replay", async () => {
  const rt = createCore03RuntimeCompositionHarness();
  const first = await rt.createDraftIndividual({
    registrationRequestId: "req-replay-reg",
    idempotencyKey: "idem-replay-reg",
    requestFingerprint: { competitionId: "comp-1", participantId: "p-1" },
  });
  const second = await rt.createDraftIndividual({
    registrationRequestId: "req-replay-reg",
    idempotencyKey: "idem-replay-reg",
    requestFingerprint: { competitionId: "comp-1", participantId: "p-1" },
  });
  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  assert.equal(second.replayed, true);
  assert.equal(second.registration.id, first.registration.id);
});

test("24. Exact eligibility evaluation replay", async () => {
  const rt = createCore03RuntimeCompositionHarness();
  const { registration } = await readyIndividual(rt, {
    registrationRequestId: "req-eval-replay",
    idempotencyKey: "idem-eval-replay",
  });
  // readyIndividual already evaluated once; replay same evaluationRequestId
  const first = await rt.eligibility.evaluateRegistrationEligibility({
    registrationId: registration.id,
    evaluationRequestId: "eval-replay-exact",
    actorId: "director-1",
  });
  assert.equal(first.ok, true);
  await rt.persistEvaluationEvidence(first);
  const second = await rt.eligibility.evaluateRegistrationEligibility({
    registrationId: registration.id,
    evaluationRequestId: "eval-replay-exact",
    actorId: "director-1",
  });
  assert.equal(second.ok, true);
  assert.equal(second.replayed, true);
  assert.equal(second.decision.id, first.decision.id);
});

test("25. Exact capacity reservation replay", async () => {
  const rt = createCore03RuntimeCompositionHarness();
  const { registration } = await readyIndividual(rt);
  const first = await rt.capacity.reserveRegistrationCapacity({
    registrationId: registration.id,
    requestId: "reserve-replay-exact",
  });
  const second = await rt.capacity.reserveRegistrationCapacity({
    registrationId: registration.id,
    requestId: "reserve-replay-exact",
  });
  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  assert.equal(second.replayed, true);
  assert.equal(second.reservation.reservationId, first.reservation.reservationId);
});

test("26. Exact waitlist placement replay", async () => {
  const rt = createCore03RuntimeCompositionHarness({
    capacityStates: exhaustedCapacityStates("competition"),
  });
  const { registration } = await readyIndividual(rt, {
    registrationRequestId: "req-wl-replay",
    idempotencyKey: "idem-wl-replay",
  });
  const auth = runtimeWaitlistPlacementAuth(registration);
  const first = await rt.capacity.placeRegistrationOnWaitlist({
    registrationId: registration.id,
    requestId: "wl-replay-exact",
    waitlistAuthorization: auth,
  });
  const second = await rt.capacity.placeRegistrationOnWaitlist({
    registrationId: registration.id,
    requestId: "wl-replay-exact",
    waitlistAuthorization: auth,
  });
  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  assert.equal(second.replayed, true);
});

test("27. Request-ID conflict with different fingerprint", async () => {
  const rt = createCore03RuntimeCompositionHarness();
  const first = await rt.createDraftIndividual({
    registrationRequestId: "req-conflict",
    idempotencyKey: "idem-conflict",
    requestFingerprint: { competitionId: "comp-1", participantId: "p-1" },
  });
  assert.equal(first.ok, true);
  const conflict = await rt.lifecycle.createDraftRegistration({
    competitionId: "comp-1",
    divisionId: "div-1",
    applicant: createRegistrationApplicant({
      platformUserId: "user-1",
      participantId: "p-2",
    }),
    target: createRegistrationTarget({
      targetType: REGISTRATION_TARGET_TYPE.INDIVIDUAL,
      participantId: "p-2",
    }),
    registrationRequestId: "req-conflict-other",
    idempotencyKey: "idem-conflict",
    requestFingerprint: { competitionId: "comp-1", participantId: "p-2" },
    actorId: "user-1",
  });
  assert.equal(conflict.ok, false);
  assert.equal(
    conflict.errors[0].code,
    REGISTRATION_ELIGIBILITY_ERROR_CODE.IDEMPOTENCY_CONFLICT
  );
});

test("28. Audit event emitted exactly once per exact replay", async () => {
  const rt = createCore03RuntimeCompositionHarness();
  const first = await rt.createDraftIndividual({
    registrationRequestId: "req-audit-once",
    idempotencyKey: "idem-audit-once",
  });
  await rt.createDraftIndividual({
    registrationRequestId: "req-audit-once",
    idempotencyKey: "idem-audit-once",
  });
  const events = await rt.persistence.audit.listByRegistration(first.registration.id);
  const createEvents = events.filter((e) => e.operation === "CREATE_DRAFT" || e.eventType === "CREATE_DRAFT");
  assert.equal(createEvents.length, 1);
});

// ---------------------------------------------------------------------------
// 29–34 Partial success / concurrency / transactions
// ---------------------------------------------------------------------------

test("29. Partial audit failure produces reconciliationRequired", async () => {
  const rt = createCore03RuntimeCompositionHarness();
  const { registration } = await readyIndividual(rt);
  rt.hooks.failNextAuditAppend = true;
  const result = await rt.capacity.reserveRegistrationCapacity({
    registrationId: registration.id,
    requestId: "reserve-audit-fail",
  });
  assert.equal(result.ok, false);
  assert.equal(result.metadata?.reconciliationRequired, true);
  assert.equal(result.metadata?.persistedWithoutAudit, true);
});

test("30. Retry after partial failure does not duplicate reservation", async () => {
  const rt = createCore03RuntimeCompositionHarness();
  const { registration } = await readyIndividual(rt);
  rt.hooks.failNextAuditAppend = true;
  const first = await rt.capacity.reserveRegistrationCapacity({
    registrationId: registration.id,
    requestId: "reserve-partial-30",
  });
  assert.equal(first.ok, false);
  assert.equal(first.metadata?.capacityReservationPersisted, true);
  const second = await rt.capacity.reserveRegistrationCapacity({
    registrationId: registration.id,
    requestId: "reserve-partial-30-retry",
  });
  assert.equal(second.ok, false);
  assert.equal(
    second.errors[0].code,
    REGISTRATION_ELIGIBILITY_ERROR_CODE.DUPLICATE_ACTIVE_RESERVATION
  );
});

test("31. Retry after partial failure does not duplicate waitlist entry", async () => {
  const rt = createCore03RuntimeCompositionHarness({
    capacityStates: exhaustedCapacityStates("competition"),
  });
  const { registration } = await readyIndividual(rt, {
    registrationRequestId: "req-wl-partial",
    idempotencyKey: "idem-wl-partial",
  });
  rt.hooks.failNextAuditAppend = true;
  const first = await rt.capacity.placeRegistrationOnWaitlist({
    registrationId: registration.id,
    requestId: "wl-partial-31",
    waitlistAuthorization: runtimeWaitlistPlacementAuth(registration),
  });
  assert.equal(first.ok, false);
  assert.equal(first.metadata?.reconciliationRequired, true);
  // Registration may already be WAITLISTED with or without waitlist row depending on order.
  const second = await rt.capacity.placeRegistrationOnWaitlist({
    registrationId: registration.id,
    requestId: "wl-partial-31-retry",
    waitlistAuthorization: runtimeWaitlistPlacementAuth(registration, {
      authorizationRef: "AUTHZ-RETRY",
    }),
  });
  assert.equal(second.ok, false);
});

test("32. Repository stale write is rejected", async () => {
  const p = createCore03PersistenceRepositories();
  const reg = createCompetitionRegistration({
    id: "reg-stale-1g",
    registrationRequestId: "req-stale-1g",
    competitionId: "comp-1",
    divisionId: "div-1",
    status: REGISTRATION_STATUS.DRAFT,
    target: createRegistrationTarget({
      targetType: REGISTRATION_TARGET_TYPE.INDIVIDUAL,
      participantId: "p-1",
    }),
    stateVersion: 0,
    createdAt: "2026-07-20T05:00:00.000Z",
    updatedAt: "2026-07-20T05:00:00.000Z",
  });
  await p.registration.save(reg);
  await p.registration.save(
    { ...reg, status: REGISTRATION_STATUS.SUBMITTED, stateVersion: 1 },
    { expectedStateVersion: 0 }
  );
  await assert.rejects(
    () =>
      p.registration.save(
        { ...reg, status: REGISTRATION_STATUS.UNDER_REVIEW, stateVersion: 2 },
        { expectedStateVersion: 0 }
      ),
    (err) =>
      err.code === REGISTRATION_ELIGIBILITY_ERROR_CODE.STALE_REGISTRATION_VERSION ||
      String(err.message).includes("STALE")
  );
});

test("33. Transaction rollback succeeds where supported", async () => {
  const p = createCore03PersistenceRepositories();
  assert.equal(p.store.supportsTransactions, true);
  const result = await p.runTransaction({
    operation: "1G_TX_ROLLBACK",
    steps: [
      async () => {
        await p.registration.save(
          createCompetitionRegistration({
            id: "reg-tx-1g",
            registrationRequestId: "req-tx-1g",
            competitionId: "comp-1",
            divisionId: "div-1",
            status: REGISTRATION_STATUS.DRAFT,
            target: createRegistrationTarget({
              targetType: REGISTRATION_TARGET_TYPE.INDIVIDUAL,
              participantId: "p-1",
            }),
            stateVersion: 0,
            createdAt: "2026-07-20T05:00:00.000Z",
            updatedAt: "2026-07-20T05:00:00.000Z",
          })
        );
      },
      async () => {
        throw new Error("FORCE_ROLLBACK");
      },
    ],
  });
  assert.equal(result.ok, false);
  assert.equal(result.rolledBack, true);
  assert.equal(await p.registration.getById("reg-tx-1g"), null);
});

test("34. Non-transaction path reports partial-success state", async () => {
  const store = createCore03MemoryPersistenceStore();
  store.supportsTransactions = false;
  const p = createCore03PersistenceRepositories({ store });
  const result = await runPersistenceTransaction({
    store,
    operation: "1G_NON_TX",
    steps: [
      () => "step-1",
      () => {
        throw new Error("STEP_2_FAIL");
      },
    ],
  });
  assert.equal(result.ok, false);
  assert.equal(result.atomic, false);
  assert.equal(result.partialSuccess?.reconciliationRequired, true);
  assert.ok(result.partialSuccess?.completedSteps.length >= 1);
  void p;
});

// ---------------------------------------------------------------------------
// 35–40 Fail-closed / deferred Entry
// ---------------------------------------------------------------------------

test("35. Missing mandatory scope fails closed", async () => {
  const p = createCore03PersistenceRepositories();
  assert.throws(
    () => p.store.listRegistrationsByCompetition(""),
    (err) => err.code === REGISTRATION_ELIGIBILITY_ERROR_CODE.PERSISTENCE_SCOPE_REQUIRED
  );
  assert.throws(
    () => p.store.listRegistrationsByCompetition(null),
    (err) => err.code === REGISTRATION_ELIGIBILITY_ERROR_CODE.PERSISTENCE_SCOPE_REQUIRED
  );
});

test("36. Sibling adapter malformed result fails closed", async () => {
  const rt = createCore03RuntimeCompositionHarness({
    facades: {
      ruleResult: "not-a-canonical-result",
    },
  });
  const rule = await rt.adapters.ruleEvaluation.evaluateRules({
    registrationId: "reg-x",
    competitionId: "comp-1",
    ruleSetId: "rs-1",
    context: {},
  });
  assert.equal(rule.accepted, false);
});

test("37. Sibling adapter exception fails closed", async () => {
  const rt = createCore03RuntimeCompositionHarness({
    facades: {
      divisionResult: async () => {
        throw new Error("CORE04_BOOM");
      },
    },
  });
  const result = await rt.adapters.divisionEligibility.getDivisionEligibilityContext({
    competitionId: "comp-1",
    divisionId: "div-1",
    target: createRegistrationTarget({
      targetType: REGISTRATION_TARGET_TYPE.INDIVIDUAL,
      participantId: "p-1",
    }),
  });
  assert.equal(result.acceptsRegistration, false);
});

test("38. Entry creation remains DEFERRED_FAIL_CLOSED", async () => {
  assert.equal(ENTRY_CREATION_COMPATIBILITY_GAP.status, "DEFERRED_FAIL_CLOSED");
  assert.equal(CORE03_PHASE_1G_CLOSURE_STATUS.core02EntryCreation, "DEFERRED_FAIL_CLOSED");
  const rt = createCore03RuntimeCompositionHarness();
  const result = await rt.adapters.entryCreation.createEntryFromRegistration({
    registrationId: "reg-x",
    competitionId: "comp-1",
    registrationStatus: REGISTRATION_STATUS.APPROVED,
    handoffRequestId: "handoff-x",
  });
  assert.equal(result.ok, false);
  assert.equal(
    result.errorCode,
    REGISTRATION_ELIGIBILITY_ERROR_CODE.ENTRY_CREATION_ADAPTER_UNAVAILABLE
  );
});

test("39. Request cannot enable Entry creation", async () => {
  const rt = createCore03RuntimeCompositionHarness();
  const result = await rt.adapters.entryCreation.createEntryFromRegistration({
    registrationId: "reg-x",
    competitionId: "comp-1",
    registrationStatus: REGISTRATION_STATUS.APPROVED,
    handoffRequestId: "handoff-req-enable",
    allowUnapprovedEntryCreationFacade: true,
    allowUnapprovedFacade: true,
  });
  assert.equal(result.ok, false);
  assert.equal(
    result.errorCode,
    REGISTRATION_ELIGIBILITY_ERROR_CODE.ENTRY_CREATION_ADAPTER_UNAVAILABLE
  );
});

test("40. Environment cannot enable Entry creation", async () => {
  const previous = process.env.CORE03_ALLOW_ENTRY_CREATION;
  process.env.CORE03_ALLOW_ENTRY_CREATION = "true";
  try {
    const rt = createCore03RuntimeCompositionHarness();
    const result = await rt.adapters.entryCreation.createEntryFromRegistration({
      registrationId: "reg-env",
      competitionId: "comp-1",
      registrationStatus: REGISTRATION_STATUS.APPROVED,
      handoffRequestId: "handoff-env",
    });
    assert.equal(result.ok, false);
    assert.equal(
      result.errorCode,
      REGISTRATION_ELIGIBILITY_ERROR_CODE.ENTRY_CREATION_ADAPTER_UNAVAILABLE
    );
    const moduleSources = collectJsFiles(join(MODULE_ROOT, "adapters"))
      .map((f) => readFileSync(f, "utf8"))
      .join("\n");
    assert.equal(moduleSources.includes("process.env"), false);
  } finally {
    if (previous === undefined) delete process.env.CORE03_ALLOW_ENTRY_CREATION;
    else process.env.CORE03_ALLOW_ENTRY_CREATION = previous;
  }
});

// ---------------------------------------------------------------------------
// 41–45 Audit completeness / reconciliation / migration docs
// ---------------------------------------------------------------------------

test("41. Audit completeness for state-changing lifecycle ops", async () => {
  const rt = createCore03RuntimeCompositionHarness();
  const { registration } = await readyIndividual(rt, {
    registrationRequestId: "req-audit-meta",
    idempotencyKey: "idem-audit-meta",
  });
  const events = await rt.persistence.audit.listByRegistration(registration.id);
  assert.ok(events.length >= 3);
  for (const event of events) {
    assert.ok(event.operation || event.eventType);
    assert.equal(event.registrationId, registration.id);
    assert.ok(event.competitionId);
    assert.ok(event.occurredAt);
    assert.ok(event.serviceVersion || event.operation);
  }
});

test("42. Reconciliation scenario catalog is complete and non-automatic", async () => {
  assert.ok(CORE03_RECONCILIATION_SCENARIOS.length >= 7);
  for (const scenario of CORE03_RECONCILIATION_SCENARIOS) {
    assert.ok(scenario.id);
    assert.equal(scenario.reconciliationRequired, true);
    assert.equal(scenario.automaticRecoverySafe, false);
    assert.ok(scenario.operatorRecoveryAction);
  }
  assert.ok(existsSync(RECON_DOC));
  const recon = readFileSync(RECON_DOC, "utf8");
  assert.match(recon, /REG_PERSISTED_AUDIT_FAILED/);
  assert.match(recon, /Automatic recovery\s*\|\s*unsafe/i);
});

test("43. Migration readiness remains AUTHORED_NOT_APPLIED", async () => {
  assert.equal(CORE03_PHASE_1F_MIGRATION_STATUS.status, "AUTHORED_NOT_APPLIED");
  assert.equal(CORE03_PHASE_1F_MIGRATION_STATUS.applied, false);
  assert.equal(CORE03_PHASE_1G_CLOSURE_STATUS.migrationStatus, "AUTHORED_NOT_APPLIED");
  assert.equal(CORE03_PHASE_1G_CLOSURE_STATUS.databaseConnected, false);
  assert.equal(CORE03_PHASE_1G_CLOSURE_STATUS.sqlApplied, false);
  const sql = readFileSync(SQL_PATH, "utf8");
  const rollback = readFileSync(ROLLBACK_PATH, "utf8");
  const sqlNoComments = sql
    .split(/\r?\n/)
    .filter((line) => !line.trim().startsWith("--"))
    .join("\n");
  assert.match(sql, /AUTHORED_NOT_APPLIED/);
  assert.match(sql, /DEFERRED_FAIL_CLOSED/);
  assert.match(sql, /enable row level security/i);
  assert.match(sqlNoComments, /using \(false\)/i);
  assert.doesNotMatch(sqlNoComments, /using\s*\(\s*true\s*\)/i);
  assert.doesNotMatch(sqlNoComments, /grant\s+(insert|update|delete)\s+on/i);
  assert.match(rollback, /drop table/i);
});

test("44. Verification query pack and Staging checklist exist (not executed)", async () => {
  assert.ok(existsSync(VERIFICATION_DOC));
  assert.ok(existsSync(STAGING_DOC));
  assert.ok(existsSync(CLOSURE_DOC));
  const verification = readFileSync(VERIFICATION_DOC, "utf8");
  const staging = readFileSync(STAGING_DOC, "utf8");
  assert.match(verification, /core03_competition_registrations/);
  assert.match(verification, /row level security|relrowsecurity/i);
  assert.match(verification, /reconciliationRequired|core03_persistence_reconciliation/i);
  assert.match(staging, /Owner GO/);
  assert.match(staging, /Staging only/i);
  assert.match(staging, /Separate Production rollout decision/i);
  assert.doesNotMatch(verification, /psql\s+/i);
});

test("45. Test-only composition harness is not on capability or root barrels", async () => {
  const capability = readFileSync(CAPABILITY_INDEX, "utf8");
  const root = readFileSync(ROOT_BARREL, "utf8");
  assert.equal(capability.includes("createCore03RuntimeCompositionHarness"), false);
  assert.equal(capability.includes("CORE03_RECONCILIATION_SCENARIOS"), false);
  assert.equal(root.includes("registration-eligibility"), false);
  assert.equal(root.includes("createCore03RuntimeCompositionHarness"), false);
  assert.equal(CORE03_PHASE_1G_CLOSURE_STATUS.testOnlyRuntimeHarnessExportedOnCapabilityBarrel, false);
  assert.equal(CORE03_PHASE_1G_CLOSURE_STATUS.productionCompositionRoot, false);
});

// ---------------------------------------------------------------------------
// 46–52 Extra runtime / safety / docs closure
// ---------------------------------------------------------------------------

test("46. Capacity reserve audit includes required metadata fields", async () => {
  const rt = createCore03RuntimeCompositionHarness();
  const { registration } = await readyIndividual(rt);
  const reserve = await rt.capacity.reserveRegistrationCapacity({
    registrationId: registration.id,
    requestId: "reserve-audit-meta",
    actorId: "director-1",
    correlationId: "corr-audit-meta",
  });
  assert.equal(reserve.ok, true);
  const events = await rt.persistence.audit.listByRegistration(registration.id);
  const reserveEvent = events.find(
    (e) => e.operation === "RESERVE_CAPACITY" || e.eventType === "RESERVE_CAPACITY"
  );
  assert.ok(reserveEvent);
  assert.equal(reserveEvent.registrationId, registration.id);
  assert.equal(reserveEvent.competitionId, "comp-1");
  assert.equal(reserveEvent.requestId, "reserve-audit-meta");
  assert.equal(reserveEvent.correlationId, "corr-audit-meta");
  assert.ok(reserveEvent.serviceVersion);
  assert.ok(reserveEvent.reservationId || reserveEvent.payload?.reservationId);
});

test("47. Promotion metadata confirms deferred Entry handoff", async () => {
  const rt = createCore03RuntimeCompositionHarness({
    capacityStates: exhaustedCapacityStates("competition"),
  });
  const { registration } = await readyIndividual(rt, {
    registrationRequestId: "req-handoff",
    idempotencyKey: "idem-handoff",
  });
  await rt.capacity.placeRegistrationOnWaitlist({
    registrationId: registration.id,
    requestId: "wl-handoff",
    waitlistAuthorization: runtimeWaitlistPlacementAuth(registration),
  });
  await rt.seedCapacityStates([
    {
      competitionId: "comp-1",
      divisionId: null,
      limit: 3,
      used: 0,
      reserved: 0,
      stateVersion: 1,
    },
    {
      competitionId: "comp-1",
      divisionId: "div-1",
      limit: 3,
      used: 0,
      reserved: 0,
      stateVersion: 1,
    },
  ]);
  const promoted = await rt.capacity.promoteWaitlistedRegistration({
    registrationId: registration.id,
    requestId: "promo-handoff",
    approvalAuthorization: runtimeWaitlistPromotionAuth(registration),
  });
  assert.equal(promoted.ok, true);
  assert.equal(promoted.metadata?.entryCreated, false);
  assert.equal(promoted.metadata?.core02Entry ?? null, null);
});

test("48. Persistence public metadata never claims DB connection", async () => {
  const rt = createCore03RuntimeCompositionHarness();
  const meta = rt.persistence.getPublicMetadata();
  assert.equal(meta.databaseConnected, false);
  assert.equal(meta.sqlApplied, false);
  assert.equal(meta.entryCreationDeferred, "DEFERRED_FAIL_CLOSED");
});

test("49. RLS fail-closed and no permissive client policies in authored SQL", async () => {
  const sql = readFileSync(SQL_PATH, "utf8");
  const sqlNoComments = sql
    .split(/\r?\n/)
    .filter((line) => !line.trim().startsWith("--"))
    .join("\n");
  assert.match(sqlNoComments, /create policy[\s\S]*using \(false\)/i);
  assert.doesNotMatch(sqlNoComments, /using\s*\(\s*true\s*\)/i);
  assert.doesNotMatch(sqlNoComments, /with check\s*\(\s*true\s*\)/i);
  assert.match(sql, /revoke\s+all/i);
  assert.doesNotMatch(sqlNoComments, /alter table\s+public\.(profiles|club_data|tournament_)/i);
});

test("50. Deep-import / sibling isolation for runtime harness module", async () => {
  const harnessSrc = readFileSync(
    join(MODULE_ROOT, "fixtures/runtimeCompositionHarness.js"),
    "utf8"
  );
  assert.doesNotMatch(harnessSrc, /from ["'].*constraints\//);
  assert.doesNotMatch(harnessSrc, /from ["'].*participants\//);
  assert.doesNotMatch(harnessSrc, /from ["'].*classification\//);
  assert.doesNotMatch(harnessSrc, /from ["'].*teams\//);
  assert.doesNotMatch(harnessSrc, /createClient|@supabase|postgres/i);
});

test("51. Closure document and phase docs are present", async () => {
  assert.ok(existsSync(CLOSURE_DOC));
  const closure = readFileSync(CLOSURE_DOC, "utf8");
  assert.match(closure, /Phase 1A/);
  assert.match(closure, /Phase 1G/);
  assert.match(closure, /DEFERRED_FAIL_CLOSED/);
  assert.match(closure, /AUTHORED_NOT_APPLIED/);
  assert.match(closure, /CORE03_READY_TO_CLOSE|READY_WITH_CONDITIONS|closure verdict/i);
});

test("52. Secret scan — Phase 1G artifacts contain no credentials", async () => {
  const files = [
    join(MODULE_ROOT, "fixtures/runtimeCompositionHarness.js"),
    CAPABILITY_INDEX,
    SQL_PATH,
    VERIFICATION_DOC,
    STAGING_DOC,
    CLOSURE_DOC,
  ];
  for (const file of files) {
    const text = readFileSync(file, "utf8");
    assert.doesNotMatch(text, /supabase_key|service_role|BEGIN PRIVATE KEY|password\s*=\s*['"][^'"]+['"]/i);
  }
});
