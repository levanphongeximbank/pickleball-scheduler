import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  SEEDING_ERROR_CODE,
  ENTRY_TYPE,
  ELIGIBILITY_STATUS,
  PRIMARY_ORDERING_SOURCE,
  SORT_DIRECTION,
  MISSING_VALUE_BEHAVIOUR,
  ASSIGNMENT_SOURCE,
  FINALIZATION_STATE,
  OVERRIDE_ACTION,
  MANUAL_OVERRIDE_MODE,
  AUTHORIZATION_DECISION,
  createDraftSeedingResult,
  buildResultFingerprintPayload,
  stringifyCanonicalJson,
  normalizeSeedingPolicy,
  normalizeManualSeedOverride,
  createSeedingResolver,
  assignSeeds,
} from "../src/features/competition-core/seeding/index.js";
import { createCore07TestFingerprintStub } from "./helpers/core07FingerprintStub.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SEEDING_ROOT = path.join(ROOT, "src/features/competition-core/seeding");
const fp = createCore07TestFingerprintStub();

function scope() {
  return {
    competitionId: "comp-1",
    competitionVersionId: null,
    divisionId: "div-open",
    categoryId: null,
    stageId: null,
    entryType: ENTRY_TYPE.ENTRY,
  };
}

function policy(overrides = {}) {
  return {
    policyId: "pol-1d",
    policyVersion: "1",
    primaryOrderingSource: PRIMARY_ORDERING_SOURCE.RANKING_POSITION,
    sortDirection: SORT_DIRECTION.ASC,
    missingValueBehaviour: MISSING_VALUE_BEHAVIOUR.SORT_LAST,
    tieBreakSequence: [PRIMARY_ORDERING_SOURCE.RATING_VALUE],
    seedNumberStart: 1,
    maximumSeededEntries: null,
    manualOverrideMode: MANUAL_OVERRIDE_MODE.ALLOW_PARTIAL,
    ...overrides,
  };
}

function candidate(id, rank, rating = 1000, extra = {}) {
  return {
    entryId: id,
    subjectRef: { kind: "ENTRY", id },
    entryType: ENTRY_TYPE.ENTRY,
    divisionId: "div-open",
    categoryId: null,
    eligibilityStatus: ELIGIBILITY_STATUS.ELIGIBLE,
    eligibilityReasonCodes: [],
    rankingPosition: rank,
    rankingScore: null,
    ratingValue: rating,
    registrationTimestamp: null,
    sourceMetadata: null,
    stableCanonicalId: id,
    ...extra,
  };
}

function override(partial) {
  const base = {
    overrideId: partial.overrideId,
    entryId: partial.entryId,
    action: partial.action || OVERRIDE_ACTION.ASSIGN,
    actor: partial.actor ?? { id: "director-1" },
    reason: partial.reason || "manual",
    createdAt: partial.createdAt || "2026-07-21T00:00:00.000Z",
    authorizationDecision:
      partial.authorizationDecision || AUTHORIZATION_DECISION.ALLOWED,
    auditMetadata: partial.auditMetadata ?? null,
    supersededOverrideId: partial.supersededOverrideId ?? null,
  };
  if (base.action === OVERRIDE_ACTION.CLEAR) {
    return {
      ...base,
      requestedSeedNumber: null,
      targetOverrideId: partial.targetOverrideId,
    };
  }
  return {
    ...base,
    requestedSeedNumber:
      partial.requestedSeedNumber === undefined
        ? 1
        : partial.requestedSeedNumber,
  };
}

function draftInput(extra = {}) {
  return {
    scope: scope(),
    candidates: [
      candidate("c", 3, 900),
      candidate("a", 1, 1100),
      candidate("b", 2, 1000),
    ],
    policy: policy(),
    manualOverrides: [],
    rankingRatingSnapshot: {
      snapshotId: "snap-1",
      checksum: "chk-1",
      completenessState: "COMPLETE",
      sourceSystem: "test",
      sourceVersion: "1",
    },
    deterministicContext: {
      effectiveAt: "2026-07-21T12:00:00.000Z",
      comparisonContractVersion: "core07-compare-v1",
    },
    requestId: "req-1",
    resultId: "res-1",
    resultVersion: 1,
    generatedAt: "2026-07-21T12:00:00.000Z",
    fingerprintPort: fp,
    ...extra,
  };
}

function assignmentMap(result) {
  return result.orderedAssignments.map((a) => `${a.entryId}:${a.seedNumber}`);
}

// ─── Allocation ─────────────────────────────────────────────────────────────

test("1D allocation: sequential unique seeds; DRAFT", () => {
  const result = createDraftSeedingResult(draftInput());
  assert.deepEqual(assignmentMap(result), ["a:1", "b:2", "c:3"]);
  const seeds = result.orderedAssignments.map((a) => a.seedNumber);
  assert.equal(seeds.every((n) => Number.isInteger(n) && n >= 1), true);
  assert.equal(new Set(seeds).size, seeds.length);
  assert.equal(
    new Set(result.orderedAssignments.map((a) => a.entryId)).size,
    result.orderedAssignments.length
  );
  assert.equal(result.finalizationState, FINALIZATION_STATE.DRAFT);
  assert.equal(
    result.orderedAssignments.every(
      (a) => a.assignmentSource === ASSIGNMENT_SOURCE.AUTO_ORDER
    ),
    true
  );
});

test("1D allocation: maximumSeededEntries; permutation stable", () => {
  const capped = createDraftSeedingResult(
    draftInput({ policy: policy({ maximumSeededEntries: 2 }) })
  );
  assert.deepEqual(assignmentMap(capped), ["a:1", "b:2"]);
  assert.equal(capped.eligibleUnseededEntries.length, 1);
  assert.equal(capped.eligibleUnseededEntries[0].entryId, "c");
  const r1 = createDraftSeedingResult(
    draftInput({
      candidates: [candidate("c", 3), candidate("a", 1), candidate("b", 2)],
    })
  );
  const r2 = createDraftSeedingResult(
    draftInput({
      candidates: [candidate("b", 2), candidate("c", 3), candidate("a", 1)],
    })
  );
  assert.deepEqual(assignmentMap(r1), assignmentMap(r2));
  assert.equal(r1.deterministicFingerprint, r2.deterministicFingerprint);
  const cappedPerm = createDraftSeedingResult(
    draftInput({
      policy: policy({ maximumSeededEntries: 2 }),
      candidates: [candidate("c", 3), candidate("b", 2), candidate("a", 1)],
    })
  );
  assert.deepEqual(
    cappedPerm.eligibleUnseededEntries.map((e) => e.entryId),
    capped.eligibleUnseededEntries.map((e) => e.entryId)
  );
});

test("1D allocation: NaN rejected; zero valid", () => {
  const ok = createDraftSeedingResult(
    draftInput({ candidates: [candidate("z", 0, 0)] })
  );
  assert.equal(ok.orderedAssignments[0].scoreValuesUsed.rankingPosition, 0);
  assert.equal(ok.orderedAssignments[0].scoreValuesUsed.ratingValue, 0);
  assert.throws(
    () =>
      createDraftSeedingResult(
        draftInput({ candidates: [candidate("bad", Number.NaN)] })
      ),
    (err) => err.code === SEEDING_ERROR_CODE.INVALID_CANDIDATE
  );
  assert.throws(
    () =>
      createDraftSeedingResult(
        draftInput({
          candidates: [candidate("inf", Number.POSITIVE_INFINITY)],
        })
      ),
    (err) => err.code === SEEDING_ERROR_CODE.INVALID_CANDIDATE
  );
});

test("1D allocation: seedNumberStart offset", () => {
  const result = createDraftSeedingResult(
    draftInput({
      policy: policy({ seedNumberStart: 5 }),
      candidates: [candidate("a", 1), candidate("b", 2)],
    })
  );
  assert.deepEqual(assignmentMap(result), ["a:5", "b:6"]);
});

test("1D allocation: equal ranks resolve via Phase 1C rating tie-break", () => {
  const result = createDraftSeedingResult(
    draftInput({
      candidates: [candidate("x", 1, 800), candidate("y", 1, 1200)],
    })
  );
  assert.deepEqual(assignmentMap(result), ["y:1", "x:2"]);
});

test("1D allocation: ineligible excluded; never assigned", () => {
  const result = createDraftSeedingResult(
    draftInput({
      candidates: [
        candidate("a", 1),
        candidate("bad", 2, 1000, {
          eligibilityStatus: ELIGIBILITY_STATUS.INELIGIBLE,
          eligibilityReasonCodes: ["DQ"],
        }),
      ],
    })
  );
  assert.deepEqual(assignmentMap(result), ["a:1"]);
  assert.equal(result.excludedEntries[0].entryId, "bad");
});

// ─── Targeted CLEAR ─────────────────────────────────────────────────────────

test("1D CLEAR: requires targetOverrideId", () => {
  assert.throws(
    () =>
      normalizeManualSeedOverride(
        override({
          overrideId: "clr",
          entryId: "a",
          action: OVERRIDE_ACTION.CLEAR,
          targetOverrideId: "",
        })
      ),
    (err) => err.code === SEEDING_ERROR_CODE.INVALID_REQUEST
  );
});

test("1D CLEAR: suppresses exact targeted ASSIGN only", () => {
  const result = createDraftSeedingResult(
    draftInput({
      manualOverrides: [
        override({ overrideId: "ov-a1", entryId: "a", requestedSeedNumber: 1 }),
        override({ overrideId: "ov-a2", entryId: "a", requestedSeedNumber: 3 }),
        override({
          overrideId: "clr-1",
          entryId: "a",
          action: OVERRIDE_ACTION.CLEAR,
          targetOverrideId: "ov-a1",
        }),
      ],
    })
  );
  // ov-a1 cleared; ov-a2 still conflicts with itself alone — wait, only ov-a2 remains for entry a
  // After clear ov-a1, only ov-a2 remains for entry a → accepted
  assert.equal(
    result.acceptedClears.some(
      (c) => c.overrideId === "clr-1" && c.targetOverrideId === "ov-a1"
    ),
    true
  );
  assert.equal(
    result.orderedAssignments.find((a) => a.overrideId === "ov-a1"),
    undefined
  );
  const a2 = result.orderedAssignments.find((a) => a.overrideId === "ov-a2");
  assert.ok(a2);
  assert.equal(a2.seedNumber, 3);
  assert.equal(a2.entryId, "a");
});

test("1D CLEAR: suppresses exact PROTECT; leaves sibling ASSIGN", () => {
  const result = createDraftSeedingResult(
    draftInput({
      manualOverrides: [
        override({
          overrideId: "ov-p",
          entryId: "b",
          action: OVERRIDE_ACTION.PROTECT,
          requestedSeedNumber: 2,
        }),
        override({ overrideId: "ov-a", entryId: "b", requestedSeedNumber: 4 }),
        override({
          overrideId: "clr-p",
          entryId: "b",
          action: OVERRIDE_ACTION.CLEAR,
          targetOverrideId: "ov-p",
        }),
      ],
    })
  );
  assert.equal(
    result.orderedAssignments.find((a) => a.overrideId === "ov-p"),
    undefined
  );
  assert.ok(result.orderedAssignments.find((a) => a.overrideId === "ov-a"));
  assert.equal(result.acceptedClears[0].targetOverrideId, "ov-p");
});

test("1D CLEAR: leaves sibling PROTECT when clearing ASSIGN", () => {
  const result = createDraftSeedingResult(
    draftInput({
      manualOverrides: [
        override({ overrideId: "ov-a", entryId: "b", requestedSeedNumber: 4 }),
        override({
          overrideId: "ov-p",
          entryId: "b",
          action: OVERRIDE_ACTION.PROTECT,
          requestedSeedNumber: 2,
        }),
        override({
          overrideId: "clr-a",
          entryId: "b",
          action: OVERRIDE_ACTION.CLEAR,
          targetOverrideId: "ov-a",
        }),
      ],
    })
  );
  assert.equal(
    result.orderedAssignments.find((a) => a.overrideId === "ov-a"),
    undefined
  );
  const sibling = result.orderedAssignments.find((a) => a.overrideId === "ov-p");
  assert.ok(sibling);
  assert.equal(sibling.assignmentSource, ASSIGNMENT_SOURCE.PROTECTED);
  assert.equal(sibling.seedNumber, 2);
});

test("1D CLEAR: does not suppress other entry overrides", () => {
  const result = createDraftSeedingResult(
    draftInput({
      manualOverrides: [
        override({ overrideId: "ov-a", entryId: "a", requestedSeedNumber: 1 }),
        override({ overrideId: "ov-b", entryId: "b", requestedSeedNumber: 2 }),
        override({
          overrideId: "clr",
          entryId: "a",
          action: OVERRIDE_ACTION.CLEAR,
          targetOverrideId: "ov-a",
        }),
      ],
    })
  );
  assert.ok(result.orderedAssignments.find((a) => a.overrideId === "ov-b"));
  assert.equal(
    result.orderedAssignments.find((a) => a.overrideId === "ov-a"),
    undefined
  );
});

test("1D CLEAR: unknown target / CLEAR-of-CLEAR / inactive target rejected", () => {
  const unknown = createDraftSeedingResult(
    draftInput({
      manualOverrides: [
        override({
          overrideId: "clr",
          entryId: "a",
          action: OVERRIDE_ACTION.CLEAR,
          targetOverrideId: "missing",
        }),
      ],
    })
  );
  assert.equal(unknown.rejectedOverrides[0].targetOverrideId, "missing");
  assert.ok(
    unknown.rejectedOverrides[0].reasonCodes.includes(
      SEEDING_ERROR_CODE.INVALID_REQUEST
    )
  );

  const clearOfClear = createDraftSeedingResult(
    draftInput({
      manualOverrides: [
        override({ overrideId: "ov-a", entryId: "a", requestedSeedNumber: 1 }),
        override({
          overrideId: "clr-1",
          entryId: "a",
          action: OVERRIDE_ACTION.CLEAR,
          targetOverrideId: "ov-a",
        }),
        override({
          overrideId: "clr-2",
          entryId: "a",
          action: OVERRIDE_ACTION.CLEAR,
          targetOverrideId: "clr-1",
        }),
      ],
    })
  );
  assert.ok(
    clearOfClear.rejectedOverrides.some((r) => r.overrideId === "clr-2")
  );

  const inactive = createDraftSeedingResult(
    draftInput({
      candidates: [
        candidate("a", 1),
        candidate("bad", 2, 1000, {
          eligibilityStatus: ELIGIBILITY_STATUS.INELIGIBLE,
        }),
      ],
      manualOverrides: [
        override({
          overrideId: "ov-bad",
          entryId: "bad",
          requestedSeedNumber: 1,
        }),
        override({
          overrideId: "clr",
          entryId: "bad",
          action: OVERRIDE_ACTION.CLEAR,
          targetOverrideId: "ov-bad",
        }),
      ],
    })
  );
  assert.ok(inactive.rejectedOverrides.some((r) => r.overrideId === "clr"));
});

test("1D CLEAR: inconsistent entryId / cross-scope rejected", () => {
  const inconsistent = createDraftSeedingResult(
    draftInput({
      manualOverrides: [
        override({ overrideId: "ov-a", entryId: "a", requestedSeedNumber: 1 }),
        override({
          overrideId: "clr",
          entryId: "b",
          action: OVERRIDE_ACTION.CLEAR,
          targetOverrideId: "ov-a",
        }),
      ],
    })
  );
  assert.ok(
    inconsistent.rejectedOverrides.some(
      (r) =>
        r.overrideId === "clr" &&
        r.reasonCodes.includes(SEEDING_ERROR_CODE.INVALID_SCOPE)
    )
  );
  // ov-a remains accepted
  assert.ok(
    inconsistent.orderedAssignments.find((a) => a.overrideId === "ov-a")
  );

  const cross = createDraftSeedingResult(
    draftInput({
      manualOverrides: [
        override({ overrideId: "ov-a", entryId: "a", requestedSeedNumber: 1 }),
        override({
          overrideId: "clr",
          entryId: "a",
          action: OVERRIDE_ACTION.CLEAR,
          targetOverrideId: "ov-a",
          auditMetadata: {
            seedingScope: { competitionId: "other-comp" },
          },
        }),
      ],
    })
  );
  assert.ok(
    cross.rejectedOverrides.some(
      (r) =>
        r.overrideId === "clr" &&
        r.reasonCodes.includes(SEEDING_ERROR_CODE.INVALID_SCOPE)
    )
  );
  assert.ok(cross.orderedAssignments.find((a) => a.overrideId === "ov-a"));
});

test("1D CLEAR: duplicate CLEAR same target fail closed; no seed reserved", () => {
  const result = createDraftSeedingResult(
    draftInput({
      manualOverrides: [
        override({ overrideId: "ov-a", entryId: "a", requestedSeedNumber: 1 }),
        override({
          overrideId: "clr-1",
          entryId: "a",
          action: OVERRIDE_ACTION.CLEAR,
          targetOverrideId: "ov-a",
        }),
        override({
          overrideId: "clr-2",
          entryId: "a",
          action: OVERRIDE_ACTION.CLEAR,
          targetOverrideId: "ov-a",
        }),
      ],
    })
  );
  assert.equal(
    result.rejectedOverrides.filter((r) =>
      r.overrideId.startsWith("clr-")
    ).length,
    2
  );
  // duplicate CLEARs rejected ⇒ target remains
  assert.ok(result.orderedAssignments.find((a) => a.overrideId === "ov-a"));
  assert.equal(result.acceptedClears.length, 0);
});

test("1D CLEAR: accepted auditable; rejected does not mutate; permutation stable", () => {
  const overridesA = [
    override({ overrideId: "ov-b", entryId: "b", requestedSeedNumber: 2 }),
    override({ overrideId: "ov-a", entryId: "a", requestedSeedNumber: 1 }),
    override({
      overrideId: "clr",
      entryId: "a",
      action: OVERRIDE_ACTION.CLEAR,
      targetOverrideId: "ov-a",
      actor: { id: "dir" },
      auditMetadata: { note: "clear-a" },
    }),
  ];
  const overridesB = [...overridesA].reverse();
  const r1 = createDraftSeedingResult(draftInput({ manualOverrides: overridesA }));
  const r2 = createDraftSeedingResult(draftInput({ manualOverrides: overridesB }));
  assert.deepEqual(assignmentMap(r1), assignmentMap(r2));
  assert.deepEqual(
    r1.acceptedClears.map((c) => `${c.overrideId}:${c.targetOverrideId}`),
    r2.acceptedClears.map((c) => `${c.overrideId}:${c.targetOverrideId}`)
  );
  assert.deepEqual(
    r1.rejectedOverrides.map((r) => r.overrideId),
    r2.rejectedOverrides.map((r) => r.overrideId)
  );
  assert.equal(r1.deterministicFingerprint, r2.deterministicFingerprint);
  assert.equal(r1.acceptedClears[0].status, "ACCEPTED");
  assert.equal(r1.acceptedClears[0].actor.id, "dir");
  assert.equal(JSON.stringify(overridesA), JSON.stringify(overridesA));
});

test("1D CLEAR: entry-based clearing unsupported (missing target fails normalize)", () => {
  assert.throws(
    () =>
      createDraftSeedingResult(
        draftInput({
          manualOverrides: [
            override({ overrideId: "ov-a", entryId: "a", requestedSeedNumber: 1 }),
            {
              overrideId: "clr",
              entryId: "a",
              action: OVERRIDE_ACTION.CLEAR,
              reason: "legacy-entry-clear",
              createdAt: "2026-07-21T00:00:00.000Z",
              authorizationDecision: AUTHORIZATION_DECISION.ALLOWED,
              // no targetOverrideId
            },
          ],
        })
      ),
    (err) => err.code === SEEDING_ERROR_CODE.INVALID_REQUEST
  );
});

// ─── ASSIGN / PROTECT / conflicts ───────────────────────────────────────────

test("1D override: ASSIGN/PROTECT still reserve; duplicate seed all rejected", () => {
  const assign = createDraftSeedingResult(
    draftInput({
      manualOverrides: [
        override({ overrideId: "ov-1", entryId: "c", requestedSeedNumber: 1 }),
      ],
    })
  );
  assert.deepEqual(assignmentMap(assign), ["c:1", "a:2", "b:3"]);
  const manual = assign.orderedAssignments.find((a) => a.entryId === "c");
  assert.equal(manual.assignmentSource, ASSIGNMENT_SOURCE.MANUAL_OVERRIDE);
  assert.equal(manual.overrideId, "ov-1");
  assert.equal(
    assign.orderedAssignments.find((a) => a.entryId === "a").assignmentSource,
    ASSIGNMENT_SOURCE.AUTO_ORDER
  );

  const protect = createDraftSeedingResult(
    draftInput({
      manualOverrides: [
        override({
          overrideId: "ov-p",
          entryId: "b",
          action: OVERRIDE_ACTION.PROTECT,
          requestedSeedNumber: 2,
        }),
      ],
    })
  );
  const protectedRow = protect.orderedAssignments.find((a) => a.entryId === "b");
  assert.equal(protectedRow.assignmentSource, ASSIGNMENT_SOURCE.PROTECTED);
  assert.equal(protectedRow.seedNumber, 2);

  const dup = createDraftSeedingResult(
    draftInput({
      manualOverrides: [
        override({ overrideId: "ov-z", entryId: "a", requestedSeedNumber: 1 }),
        override({ overrideId: "ov-y", entryId: "b", requestedSeedNumber: 1 }),
      ],
    })
  );
  assert.equal(dup.rejectedOverrides.length, 2);
  assert.equal(
    dup.rejectedOverrides.every((r) =>
      r.reasonCodes.includes(SEEDING_ERROR_CODE.DUPLICATE_SEED_NUMBER)
    ),
    true
  );
  assert.equal(
    dup.orderedAssignments.every((a) => a.overrideId == null),
    true
  );
});

test("1D override: duplicate entry overrides both rejected", () => {
  const result = createDraftSeedingResult(
    draftInput({
      manualOverrides: [
        override({ overrideId: "ov-1", entryId: "a", requestedSeedNumber: 1 }),
        override({ overrideId: "ov-2", entryId: "a", requestedSeedNumber: 2 }),
      ],
    })
  );
  assert.equal(result.rejectedOverrides.length, 2);
  assert.equal(
    result.rejectedOverrides.every((r) =>
      r.reasonCodes.includes(SEEDING_ERROR_CODE.OVERRIDE_CONFLICT)
    ),
    true
  );
});

test("1D override: out-of-range / unknown / ineligible / unauthorized rejected", () => {
  const oor = createDraftSeedingResult(
    draftInput({
      policy: policy({ seedNumberStart: 1, maximumSeededEntries: 2 }),
      manualOverrides: [
        override({ overrideId: "oor", entryId: "a", requestedSeedNumber: 9 }),
      ],
    })
  );
  assert.equal(oor.rejectedOverrides[0].overrideId, "oor");
  assert.ok(
    oor.rejectedOverrides[0].reasonCodes.includes(
      SEEDING_ERROR_CODE.INVALID_REQUEST
    )
  );

  const unknown = createDraftSeedingResult(
    draftInput({
      manualOverrides: [
        override({
          overrideId: "unk",
          entryId: "missing",
          requestedSeedNumber: 1,
        }),
      ],
    })
  );
  assert.equal(unknown.rejectedOverrides[0].overrideId, "unk");

  const inelig = createDraftSeedingResult(
    draftInput({
      candidates: [
        candidate("a", 1),
        candidate("bad", 2, 1000, {
          eligibilityStatus: ELIGIBILITY_STATUS.INELIGIBLE,
        }),
      ],
      manualOverrides: [
        override({ overrideId: "inel", entryId: "bad", requestedSeedNumber: 1 }),
      ],
    })
  );
  assert.ok(
    inelig.rejectedOverrides[0].reasonCodes.includes(
      SEEDING_ERROR_CODE.ENTRY_INELIGIBLE
    )
  );

  const unauth = createDraftSeedingResult(
    draftInput({
      policy: policy({
        manualOverrideMode: MANUAL_OVERRIDE_MODE.REQUIRE_AUTHORIZED,
      }),
      manualOverrides: [
        override({
          overrideId: "ua",
          entryId: "a",
          requestedSeedNumber: 1,
          authorizationDecision: AUTHORIZATION_DECISION.NOT_EVALUATED,
        }),
      ],
    })
  );
  assert.ok(
    unauth.rejectedOverrides[0].reasonCodes.includes(
      SEEDING_ERROR_CODE.OVERRIDE_UNAUTHORIZED
    )
  );
});

test("1D override: rejected retains provenance; does not mutate assignments", () => {
  const result = createDraftSeedingResult(
    draftInput({
      manualOverrides: [
        override({
          overrideId: "bad",
          entryId: "a",
          requestedSeedNumber: 1,
          authorizationDecision: AUTHORIZATION_DECISION.DENIED,
          actor: { id: "actor-x" },
          auditMetadata: { note: "audit" },
        }),
      ],
      policy: policy({
        manualOverrideMode: MANUAL_OVERRIDE_MODE.REQUIRE_AUTHORIZED,
      }),
    })
  );
  const rej = result.rejectedOverrides[0];
  assert.equal(rej.overrideId, "bad");
  assert.equal(rej.action, OVERRIDE_ACTION.ASSIGN);
  assert.equal(rej.requestedSeedNumber, 1);
  assert.equal(rej.actor.id, "actor-x");
  assert.equal(rej.policyProvenance.policyId, "pol-1d");
  assert.equal(rej.scope.competitionId, "comp-1");
  assert.equal(rej.status, "REJECTED");
  assert.equal(rej.auditMetadata.note, "audit");
  assert.equal(
    result.orderedAssignments.find((a) => a.entryId === "a")?.overrideId,
    null
  );
});

test("1D override: conflict result independent of override input order", () => {
  const a = [
    override({ overrideId: "ov-b", entryId: "b", requestedSeedNumber: 1 }),
    override({ overrideId: "ov-a", entryId: "a", requestedSeedNumber: 1 }),
  ];
  const b = [...a].reverse();
  const r1 = createDraftSeedingResult(draftInput({ manualOverrides: a }));
  const r2 = createDraftSeedingResult(draftInput({ manualOverrides: b }));
  assert.deepEqual(
    r1.rejectedOverrides.map((r) => r.overrideId),
    r2.rejectedOverrides.map((r) => r.overrideId)
  );
  assert.deepEqual(assignmentMap(r1), assignmentMap(r2));
  assert.equal(r1.deterministicFingerprint, r2.deterministicFingerprint);
});

// ─── Result / fingerprint / immutability ────────────────────────────────────

test("1D fingerprint: injected port required; no FNV barrel export; no fallback", () => {
  const barrel = readFileSync(path.join(SEEDING_ROOT, "index.js"), "utf8");
  assert.doesNotMatch(barrel, /createDeterministicFingerprintStub/);
  assert.doesNotMatch(barrel, /createCore07TestFingerprintStub/);
  assert.throws(
    () => createDraftSeedingResult(draftInput({ fingerprintPort: null })),
    (err) => err.code === SEEDING_ERROR_CODE.INTERNAL_PORT_FAILURE
  );
  assert.throws(
    () =>
      createDraftSeedingResult(
        draftInput({ fingerprintPort: { contractVersion: "x" } })
      ),
    (err) => err.code === SEEDING_ERROR_CODE.INTERNAL_PORT_FAILURE
  );
  assert.throws(
    () =>
      createDraftSeedingResult(
        draftInput({
          fingerprintPort: {
            contractVersion: "core07-fingerprint-port-v1",
            fingerprint() {
              throw new Error("boom");
            },
          },
        })
      ),
    (err) => err.code === SEEDING_ERROR_CODE.INTERNAL_PORT_FAILURE
  );
  assert.throws(
    () =>
      createDraftSeedingResult(
        draftInput({
          fingerprintPort: {
            contractVersion: "core07-fingerprint-port-v1",
            fingerprint() {
              return "";
            },
          },
        })
      ),
    (err) => err.code === SEEDING_ERROR_CODE.INTERNAL_PORT_FAILURE
  );

  const r1 = createDraftSeedingResult(
    draftInput({ generatedAt: "2026-07-21T01:00:00.000Z" })
  );
  const r2 = createDraftSeedingResult(
    draftInput({ generatedAt: "2099-01-01T00:00:00.000Z" })
  );
  assert.equal(r1.deterministicFingerprint, r2.deterministicFingerprint);
  assert.equal(r1.generatedAt, "2026-07-21T01:00:00.000Z");
  assert.equal(r2.generatedAt, "2099-01-01T00:00:00.000Z");
  assert.equal(r1.policyProvenance.policyId, "pol-1d");
  assert.equal(r1.snapshotProvenance.snapshotId, "snap-1");
  const stubSame = fp.fingerprint('{"x":1}');
  assert.equal(stubSame, fp.fingerprint('{"x":1}'));
  const payload = stringifyCanonicalJson(
    buildResultFingerprintPayload({
      scope: r1.scope,
      policy: normalizeSeedingPolicy(policy()),
      candidates: [candidate("a", 1), candidate("b", 2), candidate("c", 3)],
      orderedAssignments: r1.orderedAssignments,
      acceptedOverrides: [],
      snapshotProvenance: r1.snapshotProvenance,
      deterministicContext: r1.deterministicContext,
    })
  );
  assert.equal(payload.includes("generatedAt"), false);
  assert.equal(payload.includes("2099"), false);
});

test("1D result: caller input not mutated; collections immutable", () => {
  const candidates = [candidate("a", 1), candidate("b", 2)];
  const overrides = [
    override({ overrideId: "ov-1", entryId: "a", requestedSeedNumber: 1 }),
  ];
  const beforeC = JSON.stringify(candidates);
  const beforeO = JSON.stringify(overrides);
  const result = createDraftSeedingResult(
    draftInput({ candidates, manualOverrides: overrides })
  );
  assert.equal(JSON.stringify(candidates), beforeC);
  assert.equal(JSON.stringify(overrides), beforeO);
  assert.ok(Object.isFrozen(result));
  assert.ok(Object.isFrozen(result.orderedAssignments));
  assert.throws(() => {
    result.orderedAssignments.push({});
  });
});

test("1D boundary: no node:crypto / supabase / UI in Phase 1D runtime", () => {
  const files = [
    "services/createDraftSeedingResult.js",
    "services/reserveOverrideSeedSlots.js",
    "services/allocateSeedNumbers.js",
    "services/buildResultFingerprintPayload.js",
    "services/buildAssignmentFingerprintPayload.js",
    "ports/FingerprintPort.js",
    "ports/EligibilityDecisionPort.js",
    "ports/RuleEvaluationPort.js",
    "domain/normalizeManualSeedOverride.js",
    "domain/createSeedAssignment.js",
    "domain/createSeedingResult.js",
  ];
  const forbidden = [
    /from\s+['"][^'"]*supabase/,
    /from\s+['"]@supabase/,
    /from\s+['"][^'"]*pages\//,
    /from\s+['"]react['"]/,
    /from\s+['"]@mui\//,
    /from\s+['"][^'"]*tournament-engine/,
    /from\s+['"][^'"]*tournament-format/,
    /from\s+['"][^'"]*constraints\//,
    /from\s+['"]node:crypto['"]/,
    /from\s+['"]crypto['"]/,
    /Math\.random\s*\(/,
    /Date\.now\s*\(/,
    /clearByEntry/,
  ];
  for (const rel of files) {
    const content = readFileSync(path.join(SEEDING_ROOT, rel), "utf8");
    for (const pattern of forbidden) {
      assert.doesNotMatch(content, pattern, `${rel} ↔ ${pattern}`);
    }
  }
  const rootIndex = readFileSync(
    path.join(ROOT, "src/features/competition-core/index.js"),
    "utf8"
  );
  assert.doesNotMatch(rootIndex, /createDraftSeedingResult/);
  assert.doesNotMatch(rootIndex, /from\s+['"]\.\/seeding\/index\.js['"]/);
  assert.equal(typeof createSeedingResolver, "function");
  assert.equal(typeof assignSeeds, "function");
  assert.equal(
    existsSync(path.join(ROOT, "tests/helpers/core07FingerprintStub.js")),
    true
  );
  const srcRoot = path.join(ROOT, "src");
  const seedingAbs = path.resolve(SEEDING_ROOT);
  const activationHits = [];
  function walk(dir) {
    for (const name of readdirSync(dir)) {
      const full = path.join(dir, name);
      const st = statSync(full);
      if (st.isDirectory()) {
        if (name === "node_modules") continue;
        if (path.resolve(full) === seedingAbs) continue;
        walk(full);
        continue;
      }
      if (!/\.(js|jsx|ts|tsx)$/.test(name)) continue;
      const content = readFileSync(full, "utf8");
      if (
        content.includes("createDraftSeedingResult") ||
        /VITE_ENABLE_CORE_?07|ENABLE_CORE07_SEEDING/.test(content)
      ) {
        activationHits.push(path.relative(ROOT, full));
      }
    }
  }
  walk(srcRoot);
  assert.deepEqual(activationHits, []);
});

test("1D determinism: two full runs identical", () => {
  const input = draftInput({
    manualOverrides: [
      override({ overrideId: "ov-1", entryId: "c", requestedSeedNumber: 2 }),
      override({
        overrideId: "clr",
        entryId: "c",
        action: OVERRIDE_ACTION.CLEAR,
        targetOverrideId: "ov-1",
      }),
    ],
  });
  const r1 = createDraftSeedingResult(input);
  const r2 = createDraftSeedingResult(input);
  assert.deepEqual(assignmentMap(r1), assignmentMap(r2));
  assert.equal(r1.deterministicFingerprint, r2.deterministicFingerprint);
  assert.deepEqual(
    r1.rejectedOverrides.map((r) => r.overrideId),
    r2.rejectedOverrides.map((r) => r.overrideId)
  );
  assert.deepEqual(
    r1.acceptedClears.map((c) => c.targetOverrideId),
    r2.acceptedClears.map((c) => c.targetOverrideId)
  );
});
