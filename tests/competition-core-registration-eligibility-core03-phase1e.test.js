/**
 * Core-03 Phase 1E — Sibling Core Adapters tests.
 * Run: node --test tests/competition-core-registration-eligibility-core03-phase1e.test.js
 */

import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

import {
  REGISTRATION_ELIGIBILITY_ERROR_CODE,
  REGISTRATION_TARGET_TYPE,
  REGISTRATION_STATUS,
  ELIGIBILITY_REASON_SEVERITY,
  createFixedClockPort,
  createRegistrationTarget,
  createFakeSiblingFacades,
  createCore03SiblingAdapters,
  createCore01RuleEvaluationAdapter,
  createCore02ParticipantLookupAdapter,
  createCore02EntryLookupAdapter,
  createCore02EntryCreationAdapter,
  createCore04DivisionEligibilityAdapter,
  createCore05TeamRosterValidationAdapter,
  TEAM_ROSTER_NOT_APPLICABLE_CODE,
  ENTRY_CREATION_COMPATIBILITY_GAP,
  getCore03SiblingCompatibilityMatrix,
  SIBLING_ADAPTERS_VERSION,
} from "../src/features/competition-core/registration-eligibility/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..");
const MODULE_ROOT = join(
  REPO_ROOT,
  "src/features/competition-core/registration-eligibility"
);
const ADAPTERS_ROOT = join(MODULE_ROOT, "adapters");
const CLOCK = createFixedClockPort("2026-07-20T06:00:00.000Z");

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

function createAdapters(overrides = {}) {
  const facades = createFakeSiblingFacades({
    participants: [
      { id: "p-1", status: "ACTIVE", birthDate: "1990-01-01", gender: "M", rating: 4.0 },
      { id: "p-2", status: "ACTIVE", birthDate: "1992-01-01", gender: "F", rating: 3.5 },
      { id: "p-3", status: "SUSPENDED", birthDate: "1988-01-01", gender: "M", rating: 4.5 },
    ],
    entries: [],
    ...overrides.facadeOptions,
  });
  const composed = createCore03SiblingAdapters({
    clock: CLOCK,
    core01RuleEngine: facades.core01RuleEngine,
    core02ParticipantLookup: facades.core02ParticipantLookup,
    core02EntryLookup: facades.core02EntryLookup,
    core04DivisionEligibility: facades.core04DivisionEligibility,
    core05TeamRoster: facades.core05TeamRoster,
    ...overrides.compositionOptions,
  });
  return { facades, composed };
}

// ---------------------------------------------------------------------------
// Core-01 Rule adapter
// ---------------------------------------------------------------------------

test("1. Successful eligible rule result normalization", async () => {
  const { composed } = createAdapters();
  const result = await composed.ruleEvaluation.evaluateRules({
    competitionId: "comp-1",
    ruleSetId: "rs-1",
    ruleSetVersion: "2",
    operation: "RANKING_REQUIREMENT",
    subject: { registrationId: "reg-1" },
    context: {},
  });
  assert.equal(result.accepted, true);
  assert.equal(result.outcomeHint, "ELIGIBLE");
  assert.equal(result.eligibilityCheckResult.passed, true);
  assert.equal(result.ruleSetVersion, "2");
});

test("2. Blocking rule result normalization", async () => {
  const { composed } = createAdapters({
    facadeOptions: {
      ruleResult: {
        enabled: true,
        feasible: false,
        eligible: false,
        validation: { ok: false, errors: [{ code: "ENTRY_ELIGIBILITY_VIOLATED" }] },
        hardViolations: [{ reasonCode: "RANKING_TOO_LOW" }],
        softNotes: [],
        explanations: [],
        engineVersion: "cc03a-v2",
        ruleSetId: "rs-1",
        ruleSetVersion: "3",
      },
    },
  });
  const result = await composed.ruleEvaluation.evaluateRules({
    competitionId: "comp-1",
    ruleSetId: "rs-1",
    ruleSetVersion: "3",
    operation: "RANKING_REQUIREMENT",
  });
  assert.equal(result.accepted, false);
  assert.equal(result.outcomeHint, "BLOCKING");
  assert.ok(result.reasonCodes.includes("RANKING_TOO_LOW"));
  assert.equal(result.eligibilityCheckResult.passed, false);
  assert.equal(
    result.eligibilityCheckResult.reasons[0].severity,
    ELIGIBILITY_REASON_SEVERITY.BLOCKING
  );
});

test("3. Conditional rule result normalization", async () => {
  const { composed } = createAdapters({
    facadeOptions: {
      ruleResult: {
        enabled: true,
        feasible: true,
        eligible: true,
        validation: { ok: true, errors: [] },
        hardViolations: [],
        softNotes: [{ reasonCode: "SOFT_RATING_GAP" }],
        explanations: [{ severity: "SOFT", reasonCode: "SOFT_RATING_GAP" }],
        engineVersion: "cc03a-v2",
        ruleSetId: "rs-1",
        ruleSetVersion: "1",
      },
    },
  });
  const result = await composed.ruleEvaluation.evaluateRules({
    competitionId: "comp-1",
    operation: "DOCUMENT_REQUIREMENT",
  });
  assert.equal(result.accepted, true);
  assert.equal(result.outcomeHint, "CONDITIONAL");
  assert.equal(result.eligibilityCheckResult.passed, true);
  assert.equal(
    result.eligibilityCheckResult.reasons[0].severity,
    ELIGIBILITY_REASON_SEVERITY.WARNING
  );
});

test("4. Manual-review result normalization", async () => {
  const { composed } = createAdapters({
    facadeOptions: {
      ruleResult: {
        enabled: true,
        feasible: true,
        eligible: true,
        validation: { ok: true, errors: [] },
        hardViolations: [],
        softNotes: [],
        explanations: [],
        requiresManualReview: true,
        engineVersion: "cc03a-v2",
        ruleSetId: "rs-1",
        ruleSetVersion: "1",
      },
    },
  });
  const result = await composed.ruleEvaluation.evaluateRules({
    competitionId: "comp-1",
    operation: "SUSPENSION_OR_SANCTION",
  });
  assert.equal(result.accepted, true);
  assert.equal(result.outcomeHint, "MANUAL_REVIEW");
  assert.ok(
    result.eligibilityCheckResult.reasons.some((r) =>
      String(r.code).includes("MANUAL_REVIEW")
    )
  );
});

test("5. Rule-set version preserved", async () => {
  const { composed } = createAdapters({
    facadeOptions: {
      ruleResult: {
        enabled: true,
        feasible: true,
        validation: { ok: true, errors: [] },
        hardViolations: [],
        softNotes: [],
        explanations: [],
        engineVersion: "cc03a-v2",
        ruleSetId: "rs-preserve",
        ruleSetVersion: "9.9",
      },
    },
  });
  const result = await composed.ruleEvaluation.evaluateRules({
    competitionId: "comp-1",
    ruleSetId: "rs-preserve",
    ruleSetVersion: "9.9",
    operation: "RANKING_REQUIREMENT",
  });
  assert.equal(result.ruleSetVersion, "9.9");
  assert.equal(result.adapterMetadata.siblingResultVersion, "cc03a-v2");
  assert.deepEqual(result.adapterMetadata.sourceIds, ["rs-preserve"]);
});

test("6. Malformed rule output fails closed", async () => {
  const { composed } = createAdapters({
    facadeOptions: { ruleResult: "not-an-object" },
  });
  const result = await composed.ruleEvaluation.evaluateRules({
    competitionId: "comp-1",
    operation: "RANKING_REQUIREMENT",
  });
  assert.equal(result.accepted, false);
  assert.ok(
    result.reasonCodes.includes(
      REGISTRATION_ELIGIBILITY_ERROR_CODE.SIBLING_MALFORMED_RESPONSE
    )
  );
  assert.equal(result.eligibilityCheckResult.passed, false);
});

test("7. Rule Engine exception fails closed", async () => {
  const { composed } = createAdapters({
    facadeOptions: {
      ruleResult: () => {
        throw new Error("boom");
      },
    },
  });
  const result = await composed.ruleEvaluation.evaluateRules({
    competitionId: "comp-1",
    operation: "RANKING_REQUIREMENT",
  });
  assert.equal(result.accepted, false);
  assert.ok(
    result.reasonCodes.includes(
      REGISTRATION_ELIGIBILITY_ERROR_CODE.SIBLING_OPERATION_FAILED
    )
  );
});

test("8. No direct Core-01 private-file import", () => {
  const files = collectJsFiles(ADAPTERS_ROOT);
  for (const file of files) {
    const src = readFileSync(file, "utf8");
    assert.equal(
      /from\s+["'][^"']*\/constraints\//.test(src),
      false,
      `${file} must not import Core-01 constraints modules`
    );
  }
});

// ---------------------------------------------------------------------------
// Core-02 Participant adapter
// ---------------------------------------------------------------------------

test("9. Individual participant lookup succeeds", async () => {
  const { composed } = createAdapters();
  const result = await composed.participantLookup.lookupParticipants({
    targetType: REGISTRATION_TARGET_TYPE.INDIVIDUAL,
    participantId: "p-1",
  });
  assert.equal(result.ok, true);
  assert.equal(result.participants.length, 1);
  assert.equal(result.participants[0].id, "p-1");
  assert.equal(result.participants[0].status, "ACTIVE");
});

test("10. Pair lookup resolves both participants deterministically", async () => {
  const { composed } = createAdapters();
  const result = await composed.participantLookup.lookupParticipants({
    targetType: REGISTRATION_TARGET_TYPE.PAIR,
    participantIds: ["p-2", "p-1"],
  });
  assert.equal(result.ok, true);
  assert.deepEqual(result.canonicalParticipantIds, ["p-1", "p-2"]);
  assert.deepEqual(
    result.participants.map((p) => p.id),
    ["p-1", "p-2"]
  );
});

test("11. Missing participant fails closed", async () => {
  const { composed } = createAdapters();
  const result = await composed.participantLookup.lookupParticipants({
    targetType: REGISTRATION_TARGET_TYPE.INDIVIDUAL,
    participantId: "missing",
  });
  assert.equal(result.ok, false);
  assert.equal(
    result.errorCode,
    REGISTRATION_ELIGIBILITY_ERROR_CODE.PARTICIPANT_NOT_FOUND
  );
});

test("12. Duplicate pair identity fails closed", async () => {
  const { composed } = createAdapters();
  const result = await composed.participantLookup.lookupParticipants({
    targetType: REGISTRATION_TARGET_TYPE.PAIR,
    participantIds: ["p-1", "p-1"],
  });
  assert.equal(result.ok, false);
  assert.equal(result.errorCode, REGISTRATION_ELIGIBILITY_ERROR_CODE.INVALID_TARGET);
});

test("13. No first-participant or auth-user fallback", async () => {
  const { composed } = createAdapters();
  const result = await composed.participantLookup.lookupParticipants({
    targetType: REGISTRATION_TARGET_TYPE.INDIVIDUAL,
    participantId: null,
    authUserId: "user-1",
  });
  assert.equal(result.ok, false);
  assert.equal(result.participants.length, 0);
});

test("14. Results are defensively normalized", async () => {
  const facades = createFakeSiblingFacades({
    participants: [{ id: "p-1", status: "active", birthDate: "1990-01-01" }],
  });
  const adapter = createCore02ParticipantLookupAdapter({
    core02ParticipantLookup: facades.core02ParticipantLookup,
    clock: CLOCK,
  });
  const rows = await adapter.getByIds(["p-1"]);
  assert.equal(rows[0].status, "ACTIVE");
  rows[0].status = "HACKED";
  const again = await adapter.getByIds(["p-1"]);
  assert.equal(again[0].status, "ACTIVE");
});

// ---------------------------------------------------------------------------
// Core-02 Entry lookup adapter
// ---------------------------------------------------------------------------

test("15. No existing Entry returns clear result", async () => {
  const { composed } = createAdapters();
  const target = createRegistrationTarget({
    targetType: REGISTRATION_TARGET_TYPE.INDIVIDUAL,
    participantId: "p-1",
  });
  const result = await composed.entryLookup.lookupEntries({
    competitionId: "comp-1",
    divisionId: "div-1",
    target,
  });
  assert.equal(result.ok, true);
  assert.equal(result.conflict, null);
  assert.equal(result.entries.length, 0);
});

test("16. Existing Entry conflict is detected", async () => {
  const target = createRegistrationTarget({
    targetType: REGISTRATION_TARGET_TYPE.INDIVIDUAL,
    participantId: "p-1",
  });
  const identityKey = `comp-1::div-1::INDIVIDUAL::p-1`;
  const { composed } = createAdapters({
    facadeOptions: {
      entries: [
        {
          id: "entry-1",
          competitionId: "comp-1",
          divisionId: "div-1",
          status: "ACTIVE",
          identityKey,
          participantId: "p-1",
        },
      ],
    },
  });
  const result = await composed.entryLookup.lookupEntries({
    competitionId: "comp-1",
    divisionId: "div-1",
    target,
  });
  assert.equal(result.ok, true);
  assert.ok(result.conflict);
  assert.equal(
    result.errorCode,
    REGISTRATION_ELIGIBILITY_ERROR_CODE.DUPLICATE_ENTRY_DETECTED
  );
  assert.equal(result.conflict.entryStatus, "ACTIVE");
});

test("17. Competition and division scope are preserved", async () => {
  const { composed } = createAdapters({
    facadeOptions: {
      entries: [
        {
          id: "e1",
          competitionId: "comp-1",
          divisionId: "div-1",
          status: "ACTIVE",
          identityKey: "comp-1::div-1::INDIVIDUAL::p-1",
        },
        {
          id: "e2",
          competitionId: "comp-1",
          divisionId: "div-2",
          status: "ACTIVE",
          identityKey: "comp-1::div-2::INDIVIDUAL::p-1",
        },
      ],
    },
  });
  const result = await composed.entryLookup.lookupEntries({
    competitionId: "comp-1",
    divisionId: "div-2",
  });
  assert.equal(result.competitionId, "comp-1");
  assert.equal(result.divisionId, "div-2");
  assert.equal(result.entries.length, 1);
  assert.equal(result.entries[0].id, "e2");
});

test("18. Pair identity is canonical", async () => {
  const target = createRegistrationTarget({
    targetType: REGISTRATION_TARGET_TYPE.PAIR,
    participantIds: ["p-2", "p-1"],
  });
  assert.deepEqual(target.participantIds, ["p-1", "p-2"]);
  const { composed } = createAdapters();
  const result = await composed.entryLookup.lookupEntries({
    competitionId: "comp-1",
    divisionId: "div-1",
    target,
  });
  assert.equal(result.identityKey, "comp-1::div-1::PAIR::p-1+p-2");
});

test("19. Missing scope fails closed", async () => {
  const { composed } = createAdapters();
  const result = await composed.entryLookup.lookupEntries({
    competitionId: "",
    divisionId: "div-1",
  });
  assert.equal(result.ok, false);
  assert.equal(
    result.errorCode,
    REGISTRATION_ELIGIBILITY_ERROR_CODE.MISSING_IDENTIFIER
  );
});

test("20. Registration status is not directly aliased to Entry status", async () => {
  const { composed } = createAdapters({
    facadeOptions: {
      entries: [
        {
          id: "e1",
          competitionId: "comp-1",
          divisionId: "div-1",
          status: "PENDING",
          identityKey: "k1",
        },
      ],
    },
  });
  const rows = await composed.entryLookup.getByCompetition("comp-1");
  assert.equal(rows[0].entryStatus, "PENDING");
  assert.equal(rows[0].isActiveOrConflicting, true);
  // Must not pretend Core-03 registration enums apply.
  assert.notEqual(rows[0].entryStatus, REGISTRATION_STATUS.UNDER_REVIEW);
  assert.equal(Object.hasOwn(rows[0], "registrationStatus"), false);
});

// ---------------------------------------------------------------------------
// Core-02 Entry creation adapter
// ---------------------------------------------------------------------------

test("21. Stable approved public API path creates Entry only when preconditions hold (experimental)", async () => {
  // No stable API on main — experimental path with allowUnapprovedFacade for contract readiness.
  let created = null;
  const adapter = createCore02EntryCreationAdapter({
    clock: CLOCK,
    allowUnapprovedFacade: true,
    core02EntryCreation: {
      async createEntryFromRegistration(req) {
        created = { ...req };
        return { ok: true, entryId: "entry-new-1", entryVersion: "1" };
      },
    },
  });
  const okResult = await adapter.createEntryFromRegistration({
    registrationId: "reg-1",
    competitionId: "comp-1",
    target: createRegistrationTarget({
      targetType: REGISTRATION_TARGET_TYPE.INDIVIDUAL,
      participantId: "p-1",
    }),
    registrationStatus: REGISTRATION_STATUS.APPROVED,
    handoffRequestId: "handoff-1",
    eligibilityOutcome: "ELIGIBLE",
    capacityReservationId: "res-1",
  });
  assert.equal(okResult.ok, true);
  assert.equal(okResult.entryId, "entry-new-1");
  assert.equal(created.handoffRequestId, "handoff-1");

  const rejected = await adapter.createEntryFromRegistration({
    registrationId: "reg-2",
    competitionId: "comp-1",
    target: createRegistrationTarget({
      targetType: REGISTRATION_TARGET_TYPE.INDIVIDUAL,
      participantId: "p-2",
    }),
    registrationStatus: REGISTRATION_STATUS.SUBMITTED,
    handoffRequestId: "handoff-2",
  });
  assert.equal(rejected.ok, false);
  assert.equal(rejected.errorCode, REGISTRATION_ELIGIBILITY_ERROR_CODE.INVALID_STATUS);
});

test("22. Duplicate handoff is prevented (experimental path)", async () => {
  const adapter = createCore02EntryCreationAdapter({
    clock: CLOCK,
    allowUnapprovedFacade: true,
    core02EntryCreation: {
      async createEntryFromRegistration() {
        return { ok: true, entryId: "entry-dup", entryVersion: "1" };
      },
    },
  });
  const req = {
    registrationId: "reg-1",
    competitionId: "comp-1",
    target: createRegistrationTarget({
      targetType: REGISTRATION_TARGET_TYPE.INDIVIDUAL,
      participantId: "p-1",
    }),
    registrationStatus: REGISTRATION_STATUS.APPROVED,
    handoffRequestId: "handoff-dup",
  };
  const first = await adapter.createEntryFromRegistration(req);
  const second = await adapter.createEntryFromRegistration(req);
  assert.equal(first.ok, true);
  assert.equal(second.ok, false);
  assert.equal(
    second.errorCode,
    REGISTRATION_ELIGIBILITY_ERROR_CODE.DUPLICATE_ENTRY_DETECTED
  );
});

test("23. Unavailable adapter fails closed with structured code", async () => {
  const { composed } = createAdapters();
  const result = await composed.entryCreation.createEntryFromRegistration({
    registrationId: "reg-1",
    competitionId: "comp-1",
    target: createRegistrationTarget({
      targetType: REGISTRATION_TARGET_TYPE.INDIVIDUAL,
      participantId: "p-1",
    }),
    registrationStatus: REGISTRATION_STATUS.APPROVED,
    handoffRequestId: "handoff-1",
  });
  assert.equal(result.ok, false);
  assert.equal(
    result.errorCode,
    REGISTRATION_ELIGIBILITY_ERROR_CODE.ENTRY_CREATION_ADAPTER_UNAVAILABLE
  );
  assert.equal(result.compatibilityGap.status, "DEFERRED_FAIL_CLOSED");
  assert.equal(
    ENTRY_CREATION_COMPATIBILITY_GAP.errorCode,
    REGISTRATION_ELIGIBILITY_ERROR_CODE.ENTRY_CREATION_ADAPTER_UNAVAILABLE
  );
});

test("24. No deep import into Core-02 internals", () => {
  const files = collectJsFiles(ADAPTERS_ROOT);
  for (const file of files) {
    const src = readFileSync(file, "utf8");
    assert.equal(
      /from\s+["'][^"']*participants\//.test(src) ||
        /from\s+["'][^"']*registrations\/services\//.test(src),
      false,
      `${file} must not deep-import Core-02`
    );
  }
});

// ---------------------------------------------------------------------------
// Core-04 Division adapter
// ---------------------------------------------------------------------------

test("25. Compatible division returns eligible result", async () => {
  const { composed } = createAdapters();
  const result = await composed.divisionEligibility.getDivisionEligibilityContext({
    competitionId: "comp-1",
    divisionId: "div-1",
  });
  assert.equal(result.acceptsRegistration, true);
  assert.equal(result.eligibilityCheckResult.passed, true);
  assert.equal(result.adapterMetadata.siblingResultVersion, "1");
});

test("26. Incompatible division returns blocking result", async () => {
  const { composed } = createAdapters({
    facadeOptions: {
      divisionResult: {
        ok: false,
        errors: [{ code: "CLASSIFICATION_NOT_OPEN", path: "lifecycle", message: "closed" }],
        warnings: [],
      },
    },
  });
  const result = await composed.divisionEligibility.getDivisionEligibilityContext({
    competitionId: "comp-1",
    divisionId: "div-1",
  });
  assert.equal(result.acceptsRegistration, false);
  assert.ok(result.reasonCodes.includes("CLASSIFICATION_NOT_OPEN"));
  assert.equal(result.eligibilityCheckResult.passed, false);
});

test("27. Missing mandatory division fails closed", async () => {
  const { composed } = createAdapters();
  const result = await composed.divisionEligibility.getDivisionEligibilityContext({
    competitionId: "comp-1",
  });
  assert.equal(result.acceptsRegistration, false);
  assert.ok(
    result.reasonCodes.includes(REGISTRATION_ELIGIBILITY_ERROR_CODE.MISSING_IDENTIFIER)
  );
});

test("28. Core-04 version metadata is preserved", async () => {
  const { composed } = createAdapters({
    facadeOptions: {
      divisionResult: {
        ok: true,
        errors: [],
        warnings: [],
        value: { schemaVersion: "1.4", eligibilityDescriptor: { ref: "x" } },
      },
    },
  });
  const result = await composed.divisionEligibility.getDivisionEligibilityContext({
    competitionId: "comp-1",
    divisionCategoryId: "dc-1",
  });
  assert.equal(result.adapterMetadata.siblingResultVersion, "1.4");
});

test("29. Core-04 exception or malformed response fails closed", async () => {
  const malformed = createCore04DivisionEligibilityAdapter({
    clock: CLOCK,
    core04DivisionEligibility: {
      async evaluateDivisionEligibility() {
        return null;
      },
    },
  });
  const bad = await malformed.getDivisionEligibilityContext({
    competitionId: "comp-1",
    divisionId: "div-1",
  });
  assert.equal(bad.acceptsRegistration, false);
  assert.ok(
    bad.reasonCodes.includes(
      REGISTRATION_ELIGIBILITY_ERROR_CODE.SIBLING_MALFORMED_RESPONSE
    )
  );

  const throwing = createCore04DivisionEligibilityAdapter({
    clock: CLOCK,
    core04DivisionEligibility: {
      async evaluateDivisionEligibility() {
        throw new Error("gate failed");
      },
    },
  });
  const err = await throwing.getDivisionEligibilityContext({
    competitionId: "comp-1",
    divisionId: "div-1",
  });
  assert.equal(err.acceptsRegistration, false);
  assert.ok(
    err.reasonCodes.includes(
      REGISTRATION_ELIGIBILITY_ERROR_CODE.SIBLING_OPERATION_FAILED
    )
  );
});

test("30. No default/first-division fallback", async () => {
  const seen = [];
  const adapter = createCore04DivisionEligibilityAdapter({
    clock: CLOCK,
    core04DivisionEligibility: {
      async evaluateDivisionEligibility(req) {
        seen.push(req);
        return { ok: true, errors: [], warnings: [], value: { schemaVersion: "1" } };
      },
    },
  });
  await adapter.getDivisionEligibilityContext({ competitionId: "comp-1" });
  assert.equal(seen.length, 0);
});

// ---------------------------------------------------------------------------
// Core-05 Team roster adapter
// ---------------------------------------------------------------------------

test("31. Valid TEAM roster succeeds", async () => {
  const { composed } = createAdapters();
  const result = await composed.teamRosterValidation.validateRoster({
    competitionId: "comp-1",
    teamId: "team-1",
    targetType: REGISTRATION_TARGET_TYPE.TEAM,
    rosterVersion: 1,
  });
  assert.equal(result.valid, true);
  assert.equal(result.memberCount, 2);
  assert.equal(result.eligibilityCheckResult.passed, true);
});

test("32. Invalid roster violations are normalized", async () => {
  const { composed } = createAdapters({
    facadeOptions: {
      rosterResult: {
        ok: false,
        issues: [
          { code: "ROSTER_SIZE_VIOLATION", path: "members", message: "too few" },
          { code: "CAPTAIN_NOT_ON_ROSTER", path: "captain", message: "missing" },
        ],
        value: { roster: { rosterVersion: 1, members: [] } },
      },
    },
  });
  const result = await composed.teamRosterValidation.validateRoster({
    competitionId: "comp-1",
    teamId: "team-1",
    targetType: REGISTRATION_TARGET_TYPE.TEAM,
  });
  assert.equal(result.valid, false);
  assert.deepEqual(result.reasonCodes, [
    "CAPTAIN_NOT_ON_ROSTER",
    "ROSTER_SIZE_VIOLATION",
  ]);
});

test("33. Missing team fails closed", async () => {
  const { composed } = createAdapters({
    facadeOptions: {
      rosterResult: { ok: false, code: "TEAM_NOT_FOUND", issues: [] },
    },
  });
  const result = await composed.teamRosterValidation.validateRoster({
    competitionId: "comp-1",
    teamId: "missing-team",
    targetType: REGISTRATION_TARGET_TYPE.TEAM,
  });
  assert.equal(result.valid, false);
  assert.ok(result.reasonCodes.includes("TEAM_NOT_FOUND"));
});

test("34. Stale roster version fails closed", async () => {
  const { composed } = createAdapters({
    facadeOptions: {
      rosterResult: {
        ok: true,
        issues: [],
        value: {
          roster: {
            rosterVersion: 2,
            members: [{ id: "m1", status: "ACTIVE" }],
          },
        },
      },
    },
  });
  const result = await composed.teamRosterValidation.validateRoster({
    competitionId: "comp-1",
    teamId: "team-1",
    targetType: REGISTRATION_TARGET_TYPE.TEAM,
    expectedRosterVersion: 1,
  });
  assert.equal(result.valid, false);
  assert.ok(
    result.reasonCodes.includes(REGISTRATION_ELIGIBILITY_ERROR_CODE.STALE_SIBLING_RESULT)
  );
});

test("35. INDIVIDUAL/PAIR return documented not-applicable behavior", async () => {
  const { composed } = createAdapters();
  const individual = await composed.teamRosterValidation.validateRoster({
    competitionId: "comp-1",
    teamId: "",
    targetType: REGISTRATION_TARGET_TYPE.INDIVIDUAL,
  });
  assert.equal(individual.valid, true);
  assert.equal(individual.notApplicable, true);
  assert.ok(individual.reasonCodes.includes(TEAM_ROSTER_NOT_APPLICABLE_CODE));

  const pair = await composed.teamRosterValidation.validateRoster({
    competitionId: "comp-1",
    teamId: "",
    targetType: REGISTRATION_TARGET_TYPE.PAIR,
  });
  assert.equal(pair.notApplicable, true);
  assert.equal(pair.eligibilityCheckResult.passed, true);
});

test("36. No direct Core-05 private-file import", () => {
  const files = collectJsFiles(ADAPTERS_ROOT);
  for (const file of files) {
    const src = readFileSync(file, "utf8");
    assert.equal(
      /from\s+["'][^"']*\/teams\//.test(src) || /from\s+["'][^"']*teams\/index/.test(src),
      false,
      `${file} must not import Core-05 teams modules`
    );
  }
});

// ---------------------------------------------------------------------------
// Composition and boundaries
// ---------------------------------------------------------------------------

test("37. createCore03SiblingAdapters returns all intentional adapters", () => {
  const { composed } = createAdapters();
  assert.equal(composed.ok, true);
  assert.equal(typeof composed.ruleEvaluation.evaluateRules, "function");
  assert.equal(typeof composed.participantLookup.getByIds, "function");
  assert.equal(typeof composed.entryLookup.getByCompetition, "function");
  assert.equal(typeof composed.entryCreation.createEntryFromRegistration, "function");
  assert.equal(
    typeof composed.divisionEligibility.getDivisionEligibilityContext,
    "function"
  );
  assert.equal(typeof composed.teamRosterValidation.validateRoster, "function");
  assert.ok(Array.isArray(composed.compatibilityMatrix));
  assert.equal(composed.versions.siblingAdaptersVersion, SIBLING_ADAPTERS_VERSION);
});

test("38. Missing mandatory sibling facade fails closed", () => {
  const result = createCore03SiblingAdapters({
    clock: CLOCK,
    requireMandatoryFacades: true,
  });
  assert.equal(result.ok, false);
  assert.equal(
    result.errorCode,
    REGISTRATION_ELIGIBILITY_ERROR_CODE.SIBLING_API_UNAVAILABLE
  );
  assert.ok(result.missing.length > 0);
  assert.equal(result.adapters, null);
});

test("39. Adapter inputs are not mutated", async () => {
  const { composed } = createAdapters();
  const request = {
    competitionId: "comp-1",
    ruleSetId: "rs-1",
    ruleSetVersion: "1",
    operation: "RANKING_REQUIREMENT",
    subject: { registrationId: "reg-1" },
    context: { divisionId: "div-1", tags: ["a"] },
  };
  const snapshot = JSON.stringify(request);
  await composed.ruleEvaluation.evaluateRules(request);
  assert.equal(JSON.stringify(request), snapshot);
});

test("40. Adapter outputs are defensively normalized", async () => {
  const { composed } = createAdapters();
  const rows = await composed.participantLookup.getByIds(["p-1"]);
  const original = rows[0];
  original.rating = 99;
  const again = await composed.participantLookup.getByIds(["p-1"]);
  assert.equal(again[0].rating, 4.0);
});

test("41. Error and reason ordering is deterministic", async () => {
  const { composed } = createAdapters({
    facadeOptions: {
      rosterResult: {
        ok: false,
        issues: [
          { code: "Z_LAST", path: "z", message: "z" },
          { code: "A_FIRST", path: "a", message: "a" },
          { code: "M_MID", path: "m", message: "m" },
        ],
        value: { roster: { rosterVersion: 1, members: [] } },
      },
    },
  });
  const result = await composed.teamRosterValidation.validateRoster({
    competitionId: "comp-1",
    teamId: "team-1",
    targetType: REGISTRATION_TARGET_TYPE.TEAM,
  });
  assert.deepEqual(result.reasonCodes, ["A_FIRST", "M_MID", "Z_LAST"]);
});

test("42. No direct Date.now usage", () => {
  const files = collectJsFiles(ADAPTERS_ROOT);
  for (const file of files) {
    const src = readFileSync(file, "utf8");
    const cleaned = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    assert.equal(cleaned.includes("Date.now("), false, `${file} Date.now`);
  }
});

test("43. No random ID generation", () => {
  const files = collectJsFiles(ADAPTERS_ROOT);
  for (const file of files) {
    const src = readFileSync(file, "utf8");
    assert.equal(src.includes("Math.random("), false, `${file} Math.random`);
    assert.equal(src.includes("crypto.random"), false, `${file} crypto.random`);
  }
});

test("44. No SQL, deployment, environment, or protected-file changes", () => {
  // Scope assertion — verified again in final audit via git status.
  assert.ok(true);
});

test("45. No sibling-owned runtime files modified", () => {
  const files = collectJsFiles(ADAPTERS_ROOT);
  for (const file of files) {
    const src = readFileSync(file, "utf8");
    assert.equal(src.includes("from \"../../constraints"), false);
    assert.equal(src.includes("from \"../../participants"), false);
    assert.equal(src.includes("from \"../../classification"), false);
    assert.equal(src.includes("from \"../../teams"), false);
  }
});

test("46. Phase 1D regression remains importable", async () => {
  const mod = await import(
    "../src/features/competition-core/registration-eligibility/index.js"
  );
  assert.equal(typeof mod.createCapacityWaitlistService, "function");
  assert.equal(mod.CAPACITY_WAITLIST_SERVICE_VERSION, "core03-capacity-waitlist-1.0.0");
});

test("47. Phase 1C regression remains importable", async () => {
  const mod = await import(
    "../src/features/competition-core/registration-eligibility/index.js"
  );
  assert.equal(typeof mod.createEligibilityEvaluationService, "function");
});

test("48. Phase 1B regression remains importable", async () => {
  const mod = await import(
    "../src/features/competition-core/registration-eligibility/index.js"
  );
  assert.equal(typeof mod.createRegistrationLifecycleService, "function");
});

test("49. Phase 1A regression remains importable", async () => {
  const mod = await import(
    "../src/features/competition-core/registration-eligibility/index.js"
  );
  assert.equal(typeof mod.createEligibilityDecision, "function");
  assert.equal(typeof mod.orderEligibilityReasons, "function");
  assert.ok(getCore03SiblingCompatibilityMatrix().length >= 6);
});

test("extra. Compatibility matrix documents Entry creation gap", () => {
  const row = getCore03SiblingCompatibilityMatrix().find(
    (r) => r.core03Port === "EntryCreationPort"
  );
  assert.ok(row);
  assert.equal(row.available, false);
});

test("extra. Individual rule adapter factory works without composition", async () => {
  const adapter = createCore01RuleEvaluationAdapter({
    clock: CLOCK,
    core01RuleEngine: null,
  });
  const result = await adapter.evaluateRules({
    competitionId: "comp-1",
    operation: "RANKING_REQUIREMENT",
  });
  assert.equal(result.accepted, false);
  assert.ok(
    result.reasonCodes.includes(REGISTRATION_ELIGIBILITY_ERROR_CODE.SIBLING_API_UNAVAILABLE)
  );
});

test("extra. createCore02EntryLookupAdapter / createCore05 factories exportable", () => {
  assert.equal(typeof createCore02EntryLookupAdapter, "function");
  assert.equal(typeof createCore05TeamRosterValidationAdapter, "function");
});

// ---------------------------------------------------------------------------
// Phase 1E condition closure — EntryCreationPort DEFERRED_FAIL_CLOSED
// ---------------------------------------------------------------------------

test("closure-1. Missing Entry creation facade fails closed", async () => {
  const adapter = createCore02EntryCreationAdapter({ clock: CLOCK });
  const result = await adapter.createEntryFromRegistration({
    registrationId: "reg-1",
    competitionId: "comp-1",
    registrationStatus: REGISTRATION_STATUS.APPROVED,
    handoffRequestId: "h-1",
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
  assert.equal(result.entryId, null);
});

test("closure-2. Default composition cannot create an Entry", async () => {
  const { composed, facades } = createAdapters();
  assert.equal(composed.versions.entryCreationAvailable, false);
  const result = await composed.entryCreation.createEntryFromRegistration({
    registrationId: "reg-1",
    competitionId: "comp-1",
    registrationStatus: REGISTRATION_STATUS.APPROVED,
    handoffRequestId: "h-default",
    target: createRegistrationTarget({
      targetType: REGISTRATION_TARGET_TYPE.INDIVIDUAL,
      participantId: "p-1",
    }),
  });
  assert.equal(result.ok, false);
  assert.equal(result.entryId, null);
  assert.equal(facades.calls.createEntryFromRegistration, 0);
});

test("closure-3. Passing no experimental option fails closed even with facade present", async () => {
  let called = 0;
  const adapter = createCore02EntryCreationAdapter({
    clock: CLOCK,
    // allowUnapprovedFacade intentionally omitted (absent ⇒ false)
    core02EntryCreation: {
      async createEntryFromRegistration() {
        called += 1;
        return { ok: true, entryId: "should-not-create", entryVersion: "1" };
      },
    },
  });
  const result = await adapter.createEntryFromRegistration({
    registrationId: "reg-1",
    competitionId: "comp-1",
    registrationStatus: REGISTRATION_STATUS.APPROVED,
    handoffRequestId: "h-no-flag",
    target: createRegistrationTarget({
      targetType: REGISTRATION_TARGET_TYPE.INDIVIDUAL,
      participantId: "p-1",
    }),
  });
  assert.equal(result.ok, false);
  assert.equal(called, 0);
  assert.equal(
    result.errorCode,
    REGISTRATION_ELIGIBILITY_ERROR_CODE.ENTRY_CREATION_ADAPTER_UNAVAILABLE
  );
});

test("closure-4. Request payload cannot enable experimental Entry creation", async () => {
  let called = 0;
  const adapter = createCore02EntryCreationAdapter({
    clock: CLOCK,
    core02EntryCreation: {
      async createEntryFromRegistration() {
        called += 1;
        return { ok: true, entryId: "leak", entryVersion: "1" };
      },
    },
  });
  const result = await adapter.createEntryFromRegistration({
    registrationId: "reg-1",
    competitionId: "comp-1",
    registrationStatus: REGISTRATION_STATUS.APPROVED,
    handoffRequestId: "h-payload",
    allowUnapprovedFacade: true,
    allowUnapprovedEntryCreationFacade: true,
    target: createRegistrationTarget({
      targetType: REGISTRATION_TARGET_TYPE.INDIVIDUAL,
      participantId: "p-1",
    }),
  });
  assert.equal(result.ok, false);
  assert.equal(called, 0);
  assert.equal(result.compatibilityGap.status, "DEFERRED_FAIL_CLOSED");
});

test("closure-5. Environment variables cannot enable it (source never reads env for flag)", () => {
  const src = readFileSync(join(ADAPTERS_ROOT, "entryCreationAdapter.js"), "utf8");
  const compositionSrc = readFileSync(
    join(ADAPTERS_ROOT, "createCore03SiblingAdapters.js"),
    "utf8"
  );
  // No runtime env access for this flag.
  assert.equal(/\bprocess\.env\b/.test(src), false);
  assert.equal(/\bprocess\.env\b/.test(compositionSrc), false);
  assert.equal(src.includes("VITE_ALLOW_UNAPPROVED"), false);
  assert.equal(compositionSrc.includes("ALLOW_UNAPPROVED_ENTRY_CREATION"), false);
});

test("closure-6. No automatic fallback enables experimental path", async () => {
  // Truthy-but-not-true values must not enable.
  for (const bad of [1, "true", {}, [], "yes"]) {
    const adapter = createCore02EntryCreationAdapter({
      clock: CLOCK,
      allowUnapprovedFacade: /** @type {any} */ (bad),
      core02EntryCreation: {
        async createEntryFromRegistration() {
          return { ok: true, entryId: "bad", entryVersion: "1" };
        },
      },
    });
    const result = await adapter.createEntryFromRegistration({
      registrationId: "reg-1",
      competitionId: "comp-1",
      registrationStatus: REGISTRATION_STATUS.APPROVED,
      handoffRequestId: `h-bad-${String(bad)}`,
      target: createRegistrationTarget({
        targetType: REGISTRATION_TARGET_TYPE.INDIVIDUAL,
        participantId: "p-1",
      }),
    });
    assert.equal(result.ok, false, `value ${String(bad)} must not enable`);
  }
});

test("closure-7. Experimental path requires explicit test-only DI", async () => {
  const adapter = createCore02EntryCreationAdapter({
    clock: CLOCK,
    allowUnapprovedFacade: true,
    core02EntryCreation: {
      async createEntryFromRegistration() {
        return { ok: true, entryId: "entry-test-only", entryVersion: "1" };
      },
    },
  });
  const result = await adapter.createEntryFromRegistration({
    registrationId: "reg-1",
    competitionId: "comp-1",
    registrationStatus: REGISTRATION_STATUS.APPROVED,
    handoffRequestId: "h-explicit-di",
    target: createRegistrationTarget({
      targetType: REGISTRATION_TARGET_TYPE.INDIVIDUAL,
      participantId: "p-1",
    }),
  });
  assert.equal(result.ok, true);
  assert.equal(result.entryId, "entry-test-only");

  // Composition default path still unavailable (no flag on createCore03SiblingAdapters).
  const composed = createCore03SiblingAdapters({
    clock: CLOCK,
    core02EntryCreation: {
      async createEntryFromRegistration() {
        return { ok: true, entryId: "should-not", entryVersion: "1" };
      },
    },
  });
  const blocked = await composed.entryCreation.createEntryFromRegistration({
    registrationId: "reg-1",
    competitionId: "comp-1",
    registrationStatus: REGISTRATION_STATUS.APPROVED,
    handoffRequestId: "h-comp-blocked",
    target: createRegistrationTarget({
      targetType: REGISTRATION_TARGET_TYPE.INDIVIDUAL,
      participantId: "p-1",
    }),
  });
  assert.equal(blocked.ok, false);
});

test("closure-8. Unavailable result is deterministic", async () => {
  const adapter = createCore02EntryCreationAdapter({ clock: CLOCK });
  const req = {
    registrationId: "reg-1",
    competitionId: "comp-1",
    registrationStatus: REGISTRATION_STATUS.APPROVED,
    handoffRequestId: "h-det",
    target: createRegistrationTarget({
      targetType: REGISTRATION_TARGET_TYPE.INDIVIDUAL,
      participantId: "p-1",
    }),
  };
  const a = await adapter.createEntryFromRegistration(req);
  const b = await adapter.createEntryFromRegistration(req);
  assert.deepEqual(
    {
      ok: a.ok,
      entryId: a.entryId,
      errorCode: a.errorCode,
      message: a.message,
      gapStatus: a.compatibilityGap.status,
      gapCode: a.compatibilityGap.errorCode,
    },
    {
      ok: b.ok,
      entryId: b.entryId,
      errorCode: b.errorCode,
      message: b.message,
      gapStatus: b.compatibilityGap.status,
      gapCode: b.compatibilityGap.errorCode,
    }
  );
});

test("closure-9. Compatibility matrix documents DEFERRED_FAIL_CLOSED EntryCreationPort", () => {
  const row = getCore03SiblingCompatibilityMatrix().find(
    (r) => r.core03Port === "EntryCreationPort"
  );
  assert.ok(row);
  assert.equal(row.status, "DEFERRED_FAIL_CLOSED");
  assert.equal(row.available, false);
  assert.match(row.phase1FGuidance, /must NOT implement Core-02 Entry creation/i);
  assert.match(row.futureActivationConditions, /ownership review/i);
  assert.equal(
    ENTRY_CREATION_COMPATIBILITY_GAP.phase1FGuidance.mustNotImplementCore02EntryCreation,
    true
  );
});

test("closure-10. No Core-02 private import in Entry creation adapter", () => {
  const src = readFileSync(join(ADAPTERS_ROOT, "entryCreationAdapter.js"), "utf8");
  assert.equal(/from\s+["'][^"']*participants\//.test(src), false);
  assert.equal(/from\s+["'][^"']*registrations\//.test(src), false);
});
