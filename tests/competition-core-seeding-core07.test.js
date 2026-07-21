import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  SEEDING_ERROR_CODE,
  SeedingDomainError,
  normalizeSeedingScope,
  buildSeedingScopeKey,
  normalizeSeedingCandidate,
  normalizeSeedingCandidates,
  normalizeSeedingPolicy,
  createDeterministicCandidateComparator,
  orderCandidatesByDeterministicComparator,
  PRIMARY_ORDERING_SOURCE,
  SORT_DIRECTION,
  MISSING_VALUE_BEHAVIOUR,
  ENTRY_TYPE,
  ELIGIBILITY_STATUS,
  SCOPE_PROVENANCE_EXCLUSIONS,
  CORE07_COMPARISON_CONTRACT_VERSION,
  createSeedingResolver,
  compareCandidatesForSeed,
  assignSeeds,
} from "../src/features/competition-core/seeding/index.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SEEDING_ROOT = path.join(ROOT, "src/features/competition-core/seeding");

function listJsFiles(dir) {
  const out = [];
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) out.push(...listJsFiles(full));
    else if (name.endsWith(".js")) out.push(full);
  }
  return out;
}

function baseScope(overrides = {}) {
  return {
    competitionId: "comp-1",
    competitionVersionId: null,
    divisionId: "div-open",
    categoryId: null,
    stageId: null,
    entryType: ENTRY_TYPE.ENTRY,
    ...overrides,
  };
}

function baseCandidate(overrides = {}) {
  return {
    entryId: "entry-1",
    subjectRef: { kind: "ENTRY", id: "subj-1" },
    entryType: ENTRY_TYPE.ENTRY,
    divisionId: "div-open",
    categoryId: null,
    eligibilityStatus: ELIGIBILITY_STATUS.ELIGIBLE,
    eligibilityReasonCodes: [],
    rankingPosition: 1,
    rankingScore: null,
    ratingValue: 1000,
    registrationTimestamp: null,
    sourceMetadata: null,
    stableCanonicalId: "canon-1",
    ...overrides,
  };
}

function basePolicy(overrides = {}) {
  return {
    policyId: "pol-core07",
    policyVersion: "1",
    primaryOrderingSource: PRIMARY_ORDERING_SOURCE.RANKING_POSITION,
    sortDirection: SORT_DIRECTION.ASC,
    missingValueBehaviour: MISSING_VALUE_BEHAVIOUR.SORT_LAST,
    tieBreakSequence: [PRIMARY_ORDERING_SOURCE.RATING_VALUE],
    ...overrides,
  };
}

function sign(n) {
  if (n < 0) return -1;
  if (n > 0) return 1;
  return 0;
}

// ─── Scope (T01 + Owner Phase 1C scope cases) ───────────────────────────────

test("T01 scope: missing competitionId → INVALID_SCOPE", () => {
  assert.throws(
    () => normalizeSeedingScope(baseScope({ competitionId: "" })),
    (err) =>
      err instanceof SeedingDomainError &&
      err.code === SEEDING_ERROR_CODE.INVALID_SCOPE
  );
});

test("scope: valid minimal scope", () => {
  const scope = normalizeSeedingScope(baseScope());
  assert.equal(scope.competitionId, "comp-1");
  assert.equal(scope.divisionId, "div-open");
  assert.equal(scope.categoryId, null);
  assert.equal(scope.entryType, ENTRY_TYPE.ENTRY);
  assert.ok(Object.isFrozen(scope));
});

test("scope: optional competitionVersionId and stageId", () => {
  const scope = normalizeSeedingScope(
    baseScope({
      competitionVersionId: "cv-9",
      stageId: "playoff",
    })
  );
  assert.equal(scope.competitionVersionId, "cv-9");
  assert.equal(scope.stageId, "playoff");
});

test("scope: invalid division/category combination (neither)", () => {
  assert.throws(
    () =>
      normalizeSeedingScope(
        baseScope({ divisionId: null, categoryId: null })
      ),
    (err) => err.code === SEEDING_ERROR_CODE.INVALID_SCOPE
  );
});

test("scope: category-only pool is valid", () => {
  const scope = normalizeSeedingScope(
    baseScope({ divisionId: null, categoryId: "cat-a" })
  );
  assert.equal(scope.categoryId, "cat-a");
  assert.equal(scope.divisionId, null);
});

test("scope: policy provenance excluded from scope identity", () => {
  const raw = baseScope({
    policyId: "should-not-appear",
    policyVersion: "99",
    snapshotId: "snap-x",
    resultVersion: 3,
    requestId: "req-x",
    fingerprint: "fp-x",
  });
  const scope = normalizeSeedingScope(raw);
  for (const key of SCOPE_PROVENANCE_EXCLUSIONS) {
    assert.equal(
      Object.prototype.hasOwnProperty.call(scope, key),
      false,
      key
    );
  }
  const key = buildSeedingScopeKey(scope);
  assert.equal(key.includes("should-not-appear"), false);
  assert.equal(key.includes("snap-x"), false);
  const sameWithoutProvenance = buildSeedingScopeKey(
    normalizeSeedingScope(baseScope())
  );
  assert.equal(key, sameWithoutProvenance);
});

// ─── Candidate normalization ────────────────────────────────────────────────

test("T02 candidate: missing stableCanonicalId → MISSING_STABLE_IDENTIFIER", () => {
  assert.throws(
    () =>
      normalizeSeedingCandidate(
        baseCandidate({ stableCanonicalId: "  " })
      ),
    (err) => err.code === SEEDING_ERROR_CODE.MISSING_STABLE_IDENTIFIER
  );
});

test("candidate: required identifiers and zero values preserved", () => {
  const c = normalizeSeedingCandidate(
    baseCandidate({
      rankingPosition: 0,
      rankingScore: 0,
      ratingValue: 0,
    })
  );
  assert.equal(c.rankingPosition, 0);
  assert.equal(c.rankingScore, 0);
  assert.equal(c.ratingValue, 0);
  assert.equal(c.stableCanonicalId, "canon-1");
});

test("candidate: absent optional numeric remains missing", () => {
  const c = normalizeSeedingCandidate(
    baseCandidate({
      rankingPosition: undefined,
      rankingScore: null,
      ratingValue: "",
    })
  );
  assert.equal(c.rankingPosition, null);
  assert.equal(c.rankingScore, null);
  assert.equal(c.ratingValue, null);
});

test("candidate: zero ranking value remains zero", () => {
  const c = normalizeSeedingCandidate(baseCandidate({ rankingPosition: 0 }));
  assert.equal(c.rankingPosition, 0);
});

test("candidate: zero rating value remains zero", () => {
  const c = normalizeSeedingCandidate(baseCandidate({ ratingValue: 0 }));
  assert.equal(c.ratingValue, 0);
});

test("T05 candidate: NaN rejected with INVALID_CANDIDATE", () => {
  assert.throws(
    () =>
      normalizeSeedingCandidate(baseCandidate({ ratingValue: Number.NaN })),
    (err) => err.code === SEEDING_ERROR_CODE.INVALID_CANDIDATE
  );
});

test("candidate: Infinity rejected with INVALID_CANDIDATE", () => {
  assert.throws(
    () =>
      normalizeSeedingCandidate(
        baseCandidate({ rankingPosition: Number.POSITIVE_INFINITY })
      ),
    (err) => err.code === SEEDING_ERROR_CODE.INVALID_CANDIDATE
  );
});

test("candidate: -Infinity rejected with INVALID_CANDIDATE", () => {
  assert.throws(
    () =>
      normalizeSeedingCandidate(
        baseCandidate({ rankingScore: Number.NEGATIVE_INFINITY })
      ),
    (err) => err.code === SEEDING_ERROR_CODE.INVALID_CANDIDATE
  );
});

test("candidate: invalid number types rejected", () => {
  assert.throws(
    () =>
      normalizeSeedingCandidate(baseCandidate({ ratingValue: { n: 1 } })),
    (err) => err.code === SEEDING_ERROR_CODE.INVALID_CANDIDATE
  );
  assert.throws(
    () => normalizeSeedingCandidate(baseCandidate({ rankingPosition: true })),
    (err) => err.code === SEEDING_ERROR_CODE.INVALID_CANDIDATE
  );
  assert.throws(
    () => normalizeSeedingCandidate(baseCandidate({ rankingScore: "1" })),
    (err) => err.code === SEEDING_ERROR_CODE.INVALID_CANDIDATE
  );
});

test("candidate: invalid numeric does not enter MISSING_FIRST / MISSING_LAST ordering", () => {
  const ctx = {
    scopeEntryType: ENTRY_TYPE.ENTRY,
    scopeDivisionId: "div-open",
    scopeCategoryId: null,
  };
  for (const mode of [
    MISSING_VALUE_BEHAVIOUR.SORT_FIRST,
    MISSING_VALUE_BEHAVIOUR.SORT_LAST,
  ]) {
    const policy = normalizeSeedingPolicy(
      basePolicy({
        missingValueBehaviour: mode,
        tieBreakSequence: [],
      })
    );
    assert.throws(
      () =>
        normalizeSeedingCandidate(
          baseCandidate({
            entryId: "bad",
            stableCanonicalId: "bad",
            rankingPosition: Number.NaN,
            subjectRef: { kind: "ENTRY", id: "bad" },
          }),
          ctx
        ),
      (err) => err.code === SEEDING_ERROR_CODE.INVALID_CANDIDATE
    );
    // Comparator never receives an invalid-as-missing candidate.
    const present = normalizeSeedingCandidate(
      baseCandidate({
        entryId: "ok",
        stableCanonicalId: "ok",
        rankingPosition: 1,
        subjectRef: { kind: "ENTRY", id: "ok" },
      }),
      ctx
    );
    const missing = normalizeSeedingCandidate(
      baseCandidate({
        entryId: "miss",
        stableCanonicalId: "miss",
        rankingPosition: null,
        subjectRef: { kind: "ENTRY", id: "miss" },
      }),
      ctx
    );
    const compare = createDeterministicCandidateComparator(policy);
    if (mode === MISSING_VALUE_BEHAVIOUR.SORT_LAST) {
      assert.equal(compare(present, missing) < 0, true);
    } else {
      assert.equal(compare(missing, present) < 0, true);
    }
  }
});

test("candidate: caller input unmodified after numeric rejection", () => {
  const raw = baseCandidate({ ratingValue: Number.NaN });
  const snapshot = {
    ratingValue: raw.ratingValue,
    rankingPosition: raw.rankingPosition,
    entryId: raw.entryId,
  };
  assert.throws(
    () => normalizeSeedingCandidate(raw),
    (err) => err.code === SEEDING_ERROR_CODE.INVALID_CANDIDATE
  );
  assert.equal(Number.isNaN(raw.ratingValue), true);
  assert.equal(raw.rankingPosition, snapshot.rankingPosition);
  assert.equal(raw.entryId, snapshot.entryId);
});

test("candidate: explicit ISO-UTC timestamp normalized; caller input not mutated", () => {
  const raw = baseCandidate({
    registrationTimestamp: "2026-07-21T01:02:03.000Z",
  });
  const before = JSON.stringify(raw);
  const c = normalizeSeedingCandidate(raw);
  assert.equal(JSON.stringify(raw), before);
  assert.equal(c.registrationTimestamp.form, "isoUtc");
  assert.equal(c.registrationTimestamp.value, "2026-07-21T01:02:03.000Z");
  assert.ok(Object.isFrozen(c));
});

test("candidate: timestamp without Z → NON_DETERMINISTIC_INPUT", () => {
  assert.throws(
    () =>
      normalizeSeedingCandidate(
        baseCandidate({ registrationTimestamp: "2026-07-21T01:02:03" })
      ),
    (err) => err.code === SEEDING_ERROR_CODE.NON_DETERMINISTIC_INPUT
  );
});

test("candidate: opaque IDs are not lowercased", () => {
  const c = normalizeSeedingCandidate(
    baseCandidate({
      entryId: "Entry-ABC",
      stableCanonicalId: "Canon-XYZ",
    })
  );
  assert.equal(c.entryId, "Entry-ABC");
  assert.equal(c.stableCanonicalId, "Canon-XYZ");
});

// ─── Duplicate detection ────────────────────────────────────────────────────

test("T03/T04 duplicates: entryId and stableCanonicalId rejected; no silent dedupe", () => {
  const ctx = {
    scopeEntryType: ENTRY_TYPE.ENTRY,
    scopeDivisionId: "div-open",
    scopeCategoryId: null,
  };
  assert.throws(
    () =>
      normalizeSeedingCandidates(
        [
          baseCandidate({ entryId: "e1", stableCanonicalId: "c1" }),
          baseCandidate({
            entryId: "e1",
            stableCanonicalId: "c2",
            subjectRef: { kind: "ENTRY", id: "s2" },
          }),
        ],
        ctx
      ),
    (err) => err.code === SEEDING_ERROR_CODE.DUPLICATE_CANDIDATE
  );

  assert.throws(
    () =>
      normalizeSeedingCandidates(
        [
          baseCandidate({ entryId: "e1", stableCanonicalId: "same" }),
          baseCandidate({
            entryId: "e2",
            stableCanonicalId: "same",
            subjectRef: { kind: "ENTRY", id: "s2" },
          }),
        ],
        ctx
      ),
    (err) => err.code === SEEDING_ERROR_CODE.DUPLICATE_CANDIDATE
  );
});

// ─── Policy ─────────────────────────────────────────────────────────────────

test("T06 policy: missing policy → POLICY_REQUIRED", () => {
  assert.throws(
    () => normalizeSeedingPolicy(null),
    (err) => err.code === SEEDING_ERROR_CODE.POLICY_REQUIRED
  );
});

test("T07 policy: conflicting version declarations → POLICY_VERSION_MISMATCH", () => {
  assert.throws(
    () =>
      normalizeSeedingPolicy(
        basePolicy({ policyVersion: "1", version: "2" })
      ),
    (err) => err.code === SEEDING_ERROR_CODE.POLICY_VERSION_MISMATCH
  );
});

test("T08 policy: unknown tie-break field → INVALID_TIE_BREAK", () => {
  assert.throws(
    () =>
      normalizeSeedingPolicy(
        basePolicy({ tieBreakSequence: ["DISPLAY_NAME"] })
      ),
    (err) => err.code === SEEDING_ERROR_CODE.INVALID_TIE_BREAK
  );
});

test("policy: valid primary sources, ASC/DESC, missing-first/last, final stableCanonicalId", () => {
  const asc = normalizeSeedingPolicy(
    basePolicy({
      primaryOrderingSource: PRIMARY_ORDERING_SOURCE.RANKING_POSITION,
      sortDirection: SORT_DIRECTION.ASC,
      missingValueBehaviour: MISSING_VALUE_BEHAVIOUR.SORT_FIRST,
      tieBreakSequence: [],
    })
  );
  assert.equal(asc.sortDirection, SORT_DIRECTION.ASC);
  assert.equal(asc.missingValueBehaviour, MISSING_VALUE_BEHAVIOUR.SORT_FIRST);
  assert.equal(
    asc.tieBreakSequence[asc.tieBreakSequence.length - 1].field,
    "stableCanonicalId"
  );

  const desc = normalizeSeedingPolicy(
    basePolicy({
      primaryOrderingSource: PRIMARY_ORDERING_SOURCE.RATING_VALUE,
      sortDirection: SORT_DIRECTION.DESC,
      missingValueBehaviour: MISSING_VALUE_BEHAVIOUR.SORT_LAST,
    })
  );
  assert.equal(desc.primaryOrderingSource, PRIMARY_ORDERING_SOURCE.RATING_VALUE);
  assert.equal(desc.sortDirection, SORT_DIRECTION.DESC);
  assert.equal(desc.missingValueBehaviour, MISSING_VALUE_BEHAVIOUR.SORT_LAST);
});

test("policy: stableCanonicalId mid-sequence rejected", () => {
  assert.throws(
    () =>
      normalizeSeedingPolicy(
        basePolicy({
          tieBreakSequence: [
            "stableCanonicalId",
            PRIMARY_ORDERING_SOURCE.RATING_VALUE,
          ],
        })
      ),
    (err) => err.code === SEEDING_ERROR_CODE.INVALID_TIE_BREAK
  );
});

// ─── Comparator (T09–T15, T41–T45) ──────────────────────────────────────────

function makeNormalizedPair() {
  const policy = normalizeSeedingPolicy(basePolicy());
  const ctx = {
    scopeEntryType: ENTRY_TYPE.ENTRY,
    scopeDivisionId: "div-open",
    scopeCategoryId: null,
  };
  const a = normalizeSeedingCandidate(
    baseCandidate({
      entryId: "a",
      stableCanonicalId: "canon-a",
      rankingPosition: 1,
      ratingValue: 900,
      subjectRef: { kind: "ENTRY", id: "sa" },
    }),
    ctx
  );
  const b = normalizeSeedingCandidate(
    baseCandidate({
      entryId: "b",
      stableCanonicalId: "canon-b",
      rankingPosition: 2,
      ratingValue: 1100,
      subjectRef: { kind: "ENTRY", id: "sb" },
    }),
    ctx
  );
  const c = normalizeSeedingCandidate(
    baseCandidate({
      entryId: "c",
      stableCanonicalId: "canon-c",
      rankingPosition: 3,
      ratingValue: 1000,
      subjectRef: { kind: "ENTRY", id: "sc" },
    }),
    ctx
  );
  return { policy, a, b, c, ctx };
}

test("T09 compare: ranking ASC — lower rank precedes", () => {
  const { policy, a, b } = makeNormalizedPair();
  const compare = createDeterministicCandidateComparator(policy);
  assert.equal(compare(a, b) < 0, true);
});

test("T10 compare: rating DESC primary — higher rating precedes", () => {
  const policy = normalizeSeedingPolicy(
    basePolicy({
      primaryOrderingSource: PRIMARY_ORDERING_SOURCE.RATING_VALUE,
      sortDirection: SORT_DIRECTION.DESC,
      tieBreakSequence: [],
    })
  );
  const ctx = {
    scopeEntryType: ENTRY_TYPE.ENTRY,
    scopeDivisionId: "div-open",
    scopeCategoryId: null,
  };
  const high = normalizeSeedingCandidate(
    baseCandidate({
      entryId: "h",
      stableCanonicalId: "h",
      ratingValue: 1200,
      rankingPosition: null,
      subjectRef: { kind: "ENTRY", id: "h" },
    }),
    ctx
  );
  const low = normalizeSeedingCandidate(
    baseCandidate({
      entryId: "l",
      stableCanonicalId: "l",
      ratingValue: 800,
      rankingPosition: null,
      subjectRef: { kind: "ENTRY", id: "l" },
    }),
    ctx
  );
  const compare = createDeterministicCandidateComparator(policy);
  assert.equal(compare(high, low) < 0, true);
});

test("T11 compare: missing SORT_LAST — present precedes missing", () => {
  const policy = normalizeSeedingPolicy(
    basePolicy({
      missingValueBehaviour: MISSING_VALUE_BEHAVIOUR.SORT_LAST,
      tieBreakSequence: [],
    })
  );
  const ctx = {
    scopeEntryType: ENTRY_TYPE.ENTRY,
    scopeDivisionId: "div-open",
    scopeCategoryId: null,
  };
  const present = normalizeSeedingCandidate(
    baseCandidate({
      entryId: "p",
      stableCanonicalId: "p",
      rankingPosition: 5,
      subjectRef: { kind: "ENTRY", id: "p" },
    }),
    ctx
  );
  const missing = normalizeSeedingCandidate(
    baseCandidate({
      entryId: "m",
      stableCanonicalId: "m",
      rankingPosition: null,
      subjectRef: { kind: "ENTRY", id: "m" },
    }),
    ctx
  );
  const compare = createDeterministicCandidateComparator(policy);
  assert.equal(compare(present, missing) < 0, true);

  const firstPolicy = normalizeSeedingPolicy(
    basePolicy({
      missingValueBehaviour: MISSING_VALUE_BEHAVIOUR.SORT_FIRST,
      tieBreakSequence: [],
    })
  );
  const compareFirst = createDeterministicCandidateComparator(firstPolicy);
  assert.equal(compareFirst(missing, present) < 0, true);
});

test("T12/T41/T42 compare: full tie → stableCanonicalId; reflexive; distinct never 0", () => {
  const policy = normalizeSeedingPolicy(
    basePolicy({
      primaryOrderingSource: PRIMARY_ORDERING_SOURCE.RANKING_POSITION,
      tieBreakSequence: [PRIMARY_ORDERING_SOURCE.RATING_VALUE],
    })
  );
  const ctx = {
    scopeEntryType: ENTRY_TYPE.ENTRY,
    scopeDivisionId: "div-open",
    scopeCategoryId: null,
  };
  const left = normalizeSeedingCandidate(
    baseCandidate({
      entryId: "x1",
      stableCanonicalId: "aaa",
      rankingPosition: 1,
      ratingValue: 1000,
      subjectRef: { kind: "ENTRY", id: "x1" },
    }),
    ctx
  );
  const right = normalizeSeedingCandidate(
    baseCandidate({
      entryId: "x2",
      stableCanonicalId: "zzz",
      rankingPosition: 1,
      ratingValue: 1000,
      subjectRef: { kind: "ENTRY", id: "x2" },
    }),
    ctx
  );
  const compare = createDeterministicCandidateComparator(policy);
  assert.equal(compare(left, left), 0);
  assert.notEqual(compare(left, right), 0);
  assert.equal(compare(left, right) < 0, true);
});

test("T13 compare: input permutation → identical sorted order", () => {
  const { policy, a, b, c } = makeNormalizedPair();
  const order1 = orderCandidatesByDeterministicComparator([a, b, c], policy).map(
    (x) => x.entryId
  );
  const order2 = orderCandidatesByDeterministicComparator([c, a, b], policy).map(
    (x) => x.entryId
  );
  const order3 = orderCandidatesByDeterministicComparator([b, c, a], policy).map(
    (x) => x.entryId
  );
  assert.deepEqual(order1, ["a", "b", "c"]);
  assert.deepEqual(order2, order1);
  assert.deepEqual(order3, order1);
});

test("T14 compare: string code-unit order without localeCompare", () => {
  const policy = normalizeSeedingPolicy(
    basePolicy({
      primaryOrderingSource: PRIMARY_ORDERING_SOURCE.RANKING_POSITION,
      tieBreakSequence: [],
    })
  );
  const ctx = {
    scopeEntryType: ENTRY_TYPE.ENTRY,
    scopeDivisionId: "div-open",
    scopeCategoryId: null,
  };
  const left = normalizeSeedingCandidate(
    baseCandidate({
      entryId: "s1",
      stableCanonicalId: "A",
      rankingPosition: 1,
      ratingValue: 1,
      subjectRef: { kind: "ENTRY", id: "s1" },
    }),
    ctx
  );
  const right = normalizeSeedingCandidate(
    baseCandidate({
      entryId: "s2",
      stableCanonicalId: "a",
      rankingPosition: 1,
      ratingValue: 1,
      subjectRef: { kind: "ENTRY", id: "s2" },
    }),
    ctx
  );
  const compare = createDeterministicCandidateComparator(policy);
  // UTF-16: 'A' (65) < 'a' (97)
  assert.equal(compare(left, right) < 0, true);
});

test("T15 compare: mixed timestamp forms → NON_DETERMINISTIC_INPUT", () => {
  const policy = normalizeSeedingPolicy(
    basePolicy({
      primaryOrderingSource: PRIMARY_ORDERING_SOURCE.REGISTRATION_TIMESTAMP,
      sortDirection: SORT_DIRECTION.ASC,
      tieBreakSequence: [],
    })
  );
  const ctx = {
    scopeEntryType: ENTRY_TYPE.ENTRY,
    scopeDivisionId: "div-open",
    scopeCategoryId: null,
  };
  const epoch = normalizeSeedingCandidate(
    baseCandidate({
      entryId: "t1",
      stableCanonicalId: "t1",
      rankingPosition: null,
      registrationTimestamp: 1_700_000_000_000,
      subjectRef: { kind: "ENTRY", id: "t1" },
    }),
    ctx
  );
  const iso = normalizeSeedingCandidate(
    baseCandidate({
      entryId: "t2",
      stableCanonicalId: "t2",
      rankingPosition: null,
      registrationTimestamp: "2023-11-14T22:13:20.000Z",
      subjectRef: { kind: "ENTRY", id: "t2" },
    }),
    ctx
  );
  const compare = createDeterministicCandidateComparator(policy);
  assert.throws(
    () => compare(epoch, iso),
    (err) => err.code === SEEDING_ERROR_CODE.NON_DETERMINISTIC_INPUT
  );
});

test("T43 duplicate stableCanonicalId fails before sort", () => {
  const ctx = {
    scopeEntryType: ENTRY_TYPE.ENTRY,
    scopeDivisionId: "div-open",
    scopeCategoryId: null,
  };
  assert.throws(
    () =>
      normalizeSeedingCandidates(
        [
          baseCandidate({ entryId: "d1", stableCanonicalId: "dup" }),
          baseCandidate({
            entryId: "d2",
            stableCanonicalId: "dup",
            subjectRef: { kind: "ENTRY", id: "d2" },
          }),
        ],
        ctx
      ),
    (err) => err.code === SEEDING_ERROR_CODE.DUPLICATE_CANDIDATE
  );
});

test("T44/T45 compare: antisymmetry and transitivity", () => {
  const { policy, a, b, c } = makeNormalizedPair();
  const compare = createDeterministicCandidateComparator(policy);
  assert.equal(sign(compare(a, b)), -sign(compare(b, a)));
  assert.equal(sign(compare(b, c)), -sign(compare(c, b)));
  assert.equal(compare(a, b) < 0 && compare(b, c) < 0, true);
  assert.equal(compare(a, c) < 0, true);
});

test("compare: equal primary resolves through policy tie-break (rating)", () => {
  const policy = normalizeSeedingPolicy(
    basePolicy({
      primaryOrderingSource: PRIMARY_ORDERING_SOURCE.RANKING_POSITION,
      tieBreakSequence: [PRIMARY_ORDERING_SOURCE.RATING_VALUE],
    })
  );
  const ctx = {
    scopeEntryType: ENTRY_TYPE.ENTRY,
    scopeDivisionId: "div-open",
    scopeCategoryId: null,
  };
  const stronger = normalizeSeedingCandidate(
    baseCandidate({
      entryId: "r1",
      stableCanonicalId: "r1",
      rankingPosition: 2,
      ratingValue: 1500,
      subjectRef: { kind: "ENTRY", id: "r1" },
    }),
    ctx
  );
  const weaker = normalizeSeedingCandidate(
    baseCandidate({
      entryId: "r2",
      stableCanonicalId: "r2",
      rankingPosition: 2,
      ratingValue: 1200,
      subjectRef: { kind: "ENTRY", id: "r2" },
    }),
    ctx
  );
  const compare = createDeterministicCandidateComparator(policy);
  // Default rating direction in tie-break is DESC → higher rating first
  assert.equal(compare(stronger, weaker) < 0, true);
});

test("compare: same normalized inputs → same ordering; no wall-clock dependency", () => {
  const { policy, a, b, c } = makeNormalizedPair();
  const first = orderCandidatesByDeterministicComparator(
    [c, b, a],
    policy
  ).map((x) => x.stableCanonicalId);
  const second = orderCandidatesByDeterministicComparator(
    [a, c, b],
    policy
  ).map((x) => x.stableCanonicalId);
  assert.deepEqual(first, second);
  assert.equal(CORE07_COMPARISON_CONTRACT_VERSION, "core07-compare-v1");
});

// ─── Boundary protection ────────────────────────────────────────────────────

test("boundary: CORE-07 Phase 1C modules have no forbidden imports", () => {
  const core07Paths = [
    path.join(SEEDING_ROOT, "domain"),
    path.join(SEEDING_ROOT, "policies", "normalizeSeedingPolicy.js"),
    path.join(SEEDING_ROOT, "policies", "normalizeTieBreakSequence.js"),
    path.join(SEEDING_ROOT, "services", "buildCandidateOrderingTuple.js"),
    path.join(
      SEEDING_ROOT,
      "services",
      "createDeterministicCandidateComparator.js"
    ),
    path.join(SEEDING_ROOT, "errors", "seedingErrorCodes.js"),
    path.join(SEEDING_ROOT, "errors", "SeedingDomainError.js"),
  ];
  const files = [];
  for (const p of core07Paths) {
    const st = statSync(p);
    if (st.isDirectory()) files.push(...listJsFiles(p));
    else files.push(p);
  }
  const forbidden = [
    /from\s+['"][^'"]*supabase/,
    /from\s+['"]@supabase/,
    /from\s+['"][^'"]*pages\//,
    /from\s+['"][^'"]*components\//,
    /from\s+['"]react['"]/,
    /from\s+['"]@mui\//,
    /from\s+['"][^'"]*tournament-engine/,
    /from\s+['"][^'"]*team-tournament/,
    /from\s+['"][^'"]*constraints\//,
    /Math\.random\s*\(/,
    /Date\.now\s*\(/,
  ];
  for (const file of files) {
    const content = readFileSync(file, "utf8");
    for (const pattern of forbidden) {
      assert.doesNotMatch(
        content,
        pattern,
        `forbidden in ${path.relative(ROOT, file)}`
      );
    }
  }
});

test("boundary: root competition-core index does not export CORE-07 seeding", () => {
  const indexPath = path.join(ROOT, "src/features/competition-core/index.js");
  const content = readFileSync(indexPath, "utf8");
  assert.doesNotMatch(content, /from\s+['"]\.\/seeding\/index\.js['"]/);
  assert.doesNotMatch(content, /normalizeSeedingScope/);
  assert.doesNotMatch(content, /createDeterministicCandidateComparator/);
});

test("boundary: Phase 3G legacy APIs remain exported and callable", () => {
  assert.equal(typeof createSeedingResolver, "function");
  assert.equal(typeof compareCandidatesForSeed, "function");
  assert.equal(typeof assignSeeds, "function");
});
