import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
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

// ─── Allocation (regression) ────────────────────────────────────────────────

test("1D allocation: sequential unique seeds; DRAFT", () => {
  const result = createDraftSeedingResult(draftInput());
  assert.deepEqual(assignmentMap(result), ["a:1", "b:2", "c:3"]);
  assert.equal(result.finalizationState, FINALIZATION_STATE.DRAFT);
});

test("1D allocation: maximumSeededEntries; permutation stable", () => {
  const capped = createDraftSeedingResult(
    draftInput({ policy: policy({ maximumSeededEntries: 2 }) })
  );
  assert.deepEqual(assignmentMap(capped), ["a:1", "b:2"]);
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
});

test("1D allocation: NaN rejected; zero valid", () => {
  const ok = createDraftSeedingResult(
    draftInput({ candidates: [candidate("z", 0, 0)] })
  );
  assert.equal(ok.orderedAssignments[0].scoreValuesUsed.rankingPosition, 0);
  assert.throws(
    () =>
      createDraftSeedingResult(
        draftInput({ candidates: [candidate("bad", Number.NaN)] })
      ),
    (err) => err.code === SEEDING_ERROR_CODE.INVALID_CANDIDATE
  );
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

// ─── Other overrides / fingerprint ──────────────────────────────────────────

test("1D override: ASSIGN/PROTECT still reserve; duplicate seed all rejected", () => {
  const assign = createDraftSeedingResult(
    draftInput({
      manualOverrides: [
        override({ overrideId: "ov-1", entryId: "c", requestedSeedNumber: 1 }),
      ],
    })
  );
  assert.deepEqual(assignmentMap(assign), ["c:1", "a:2", "b:3"]);
  assert.equal(
    assign.orderedAssignments.find((a) => a.entryId === "c").assignmentSource,
    ASSIGNMENT_SOURCE.MANUAL_OVERRIDE
  );

  const dup = createDraftSeedingResult(
    draftInput({
      manualOverrides: [
        override({ overrideId: "ov-z", entryId: "a", requestedSeedNumber: 1 }),
        override({ overrideId: "ov-y", entryId: "b", requestedSeedNumber: 1 }),
      ],
    })
  );
  assert.equal(dup.rejectedOverrides.length, 2);
});

test("1D fingerprint: injected port required; no FNV barrel export; no fallback", () => {
  const barrel = readFileSync(
    path.join(SEEDING_ROOT, "index.js"),
    "utf8"
  );
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
});

test("1D boundary: no node:crypto / supabase / UI in Phase 1D runtime", () => {
  const files = [
    "services/createDraftSeedingResult.js",
    "services/reserveOverrideSeedSlots.js",
    "services/allocateSeedNumbers.js",
    "ports/FingerprintPort.js",
    "domain/normalizeManualSeedOverride.js",
  ];
  for (const rel of files) {
    const content = readFileSync(path.join(SEEDING_ROOT, rel), "utf8");
    assert.doesNotMatch(content, /node:crypto|from\s+['"]crypto['"]/);
    assert.doesNotMatch(content, /supabase|from\s+['"]react['"]|Date\.now\s*\(|Math\.random\s*\(/);
    assert.doesNotMatch(content, /clearByEntry/);
  }
  assert.equal(typeof createSeedingResolver, "function");
  assert.equal(typeof assignSeeds, "function");
  assert.equal(
    existsSync(path.join(ROOT, "tests/helpers/core07FingerprintStub.js")),
    true
  );
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
