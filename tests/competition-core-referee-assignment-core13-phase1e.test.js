/**
 * CORE-13 Phase 1E — SHA-256 fingerprints, cohort, seed, certification.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import * as Core13 from "../src/features/competition-core/referee-assignment/index.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MOD_ROOT = path.join(
  ROOT,
  "src/features/competition-core/referee-assignment"
);
const ROOT_BARREL = path.join(ROOT, "src/features/competition-core/index.js");
const CERT_DOC = path.join(
  ROOT,
  "docs/competition-engine/core-13/08_PHASE_1E_CERTIFICATION.md"
);

const {
  REFEREE_ROLE_CODE,
  REFEREE_ASSIGNMENT_STATUS,
  REFEREE_ASSIGNMENT_SOURCE,
  REFEREE_SOFT_OBJECTIVE_KEY,
  REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE,
  CORE13_DIGEST_VERSION,
  CORE13_DIGEST_DOMAIN,
  CORE13_ID_PREFIX,
  CORE13_ID_DIGEST_HEX_LEN,
  digestCanonical,
  fingerprintValue,
  serializeCanonical,
  canonicalizeJsonValue,
  buildAssignmentId,
  buildPlanId,
  buildReplacementId,
  createRefereeCandidate,
  createRefereeQualification,
  createRefereeAvailabilityWindow,
  createRefereeAssignmentPolicy,
  createRefereeAssignmentRequest,
  createRefereeAssignment,
  createPopulatedSnapshotResult,
  createEmptySnapshotResult,
  createMissingSnapshotResult,
  createMatchScheduleRow,
  assignReferees,
  replaceRefereeAssignment,
} = Core13;

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

const MATCH = {
  matchId: "m-1",
  startAt: "2026-07-22T10:00:00.000Z",
  endAt: "2026-07-22T11:00:00.000Z",
  courtId: "court-1",
  participantRefs: ["player-a", "player-b"],
  teamRefs: [],
  clubIds: [],
};

function cand(id, overrides = {}) {
  return createRefereeCandidate({
    refereeId: id,
    active: true,
    playerId: `player-${id}`,
    clubIds: ["club-x"],
    organizationIds: ["org-x"],
    ...overrides,
  });
}

function qual(refereeId, roleCode = REFEREE_ROLE_CODE.PRIMARY) {
  return createRefereeQualification({
    qualificationId: `q-${refereeId}-${roleCode}`,
    refereeId,
    roleCode,
    certificationCode: "CERT",
    validFrom: "2026-01-01T00:00:00.000Z",
    validTo: "2027-01-01T00:00:00.000Z",
  });
}

function avail(refereeId, overrides = {}) {
  return createRefereeAvailabilityWindow({
    windowId: `w-${refereeId}`,
    refereeId,
    startAt: "2026-07-22T00:00:00.000Z",
    endAt: "2026-07-22T23:59:59.000Z",
    ...overrides,
  });
}

function policy(overrides = {}) {
  return createRefereeAssignmentPolicy({
    policyId: "pol-1",
    policyVersion: "1",
    softObjectiveKeys: [REFEREE_SOFT_OBJECTIVE_KEY.WORKLOAD_BALANCE],
    ...overrides,
  });
}

function planInput({
  candidates = [cand("ref-1"), cand("ref-2")],
  matches = [MATCH],
  existing = [],
  pol = policy(),
  conflictPolicy = {},
  roleRequirementsByMatch,
  seed,
  directoryItems,
  scheduleItems,
} = {}) {
  const matchIds = matches.map((m) => m.matchId);
  const request = createRefereeAssignmentRequest({
    requestId: "req-1",
    tenantId: "tenant-1",
    tournamentId: "tourn-1",
    matchIds,
    policy: pol,
    seed: seed === undefined ? null : seed,
    context: {
      tenantId: "tenant-1",
      tournamentId: "tourn-1",
      matchIds,
      snapshotRefs: [
        { snapshotId: "s1", snapshotVersion: "v1", fingerprint: "abcd1234" },
      ],
    },
  });
  const dirItems = directoryItems || candidates;
  return {
    request,
    policy: pol,
    directorySnapshot: createPopulatedSnapshotResult(dirItems),
    qualificationSnapshot: createPopulatedSnapshotResult(
      candidates.flatMap((c) => [
        qual(c.refereeId, REFEREE_ROLE_CODE.PRIMARY),
        qual(c.refereeId, REFEREE_ROLE_CODE.ASSISTANT),
      ])
    ),
    availabilitySnapshot: createPopulatedSnapshotResult(
      candidates.map((c) => avail(c.refereeId))
    ),
    existingAssignmentSnapshot:
      existing.length > 0
        ? createPopulatedSnapshotResult(existing)
        : createEmptySnapshotResult(),
    scheduleSnapshot: createPopulatedSnapshotResult(
      (scheduleItems || matches).map((m) => createMatchScheduleRow(m))
    ),
    conflictPolicy,
    roleRequirementsByMatch,
  };
}

const HEX64 = /^[0-9a-f]{64}$/;

test("P1E-01: authoritative fingerprints are SHA-256 not FNV", () => {
  assert.equal(CORE13_DIGEST_VERSION, "CORE13_DIGEST_SHA256_V1");
  const fp = fingerprintValue({ a: 1 }, CORE13_DIGEST_DOMAIN.GENERIC);
  assert.match(fp, HEX64);
  assert.notEqual(fp.length, 8);
  for (const file of listJsFiles(MOD_ROOT)) {
    const src = readFileSync(file, "utf8");
    assert.equal(src.includes("2166136261"), false, file);
    assert.equal(src.includes("16777619"), false, file);
    assert.equal(/hashStringToUint32/.test(src), false, file);
    assert.equal(/\bfnv1a\b/i.test(src), false, file);
  }
});

test("P1E-02: ID namespaces and ≥128-bit truncation; domain separation", () => {
  const asg = buildAssignmentId({
    requestId: "r",
    tenantId: "t",
    tournamentId: "u",
    matchId: "m",
    roleCode: "PRIMARY",
    slotIndex: 0,
    refereeId: "ref-1",
    source: "AUTO",
  });
  const plan = buildPlanId({
    requestId: "r",
    tenantId: "t",
    tournamentId: "u",
    policyId: "p",
    policyVersion: "1",
    seed: null,
  });
  const rep = buildReplacementId({
    requestId: "r",
    tenantId: "t",
    tournamentId: "u",
    matchId: "m",
    roleCode: "PRIMARY",
    refereeId: "ref-2",
    priorAssignmentId: "prior",
    source: "REPLACEMENT",
  });
  assert.ok(asg.startsWith(CORE13_ID_PREFIX.ASSIGNMENT));
  assert.ok(plan.startsWith(CORE13_ID_PREFIX.PLAN));
  assert.ok(rep.startsWith(CORE13_ID_PREFIX.REPLACEMENT));
  assert.equal(asg.slice(CORE13_ID_PREFIX.ASSIGNMENT.length).length, CORE13_ID_DIGEST_HEX_LEN);
  assert.equal(CORE13_ID_DIGEST_HEX_LEN >= 32, true);

  const payload = { x: 1 };
  const d1 = digestCanonical(CORE13_DIGEST_DOMAIN.ASSIGNMENT, payload);
  const d2 = digestCanonical(CORE13_DIGEST_DOMAIN.PLAN, payload);
  assert.match(d1, HEX64);
  assert.notEqual(d1, d2);
});

test("P1E-03: canonical serialization stability and rejection", () => {
  const a = serializeCanonical({ b: 1, a: 2 });
  const b = serializeCanonical({ a: 2, b: 1 });
  assert.equal(a, b);
  assert.deepEqual(canonicalizeJsonValue({ b: 1, a: 2 }), { a: 2, b: 1 });

  const setLikeA = fingerprintValue(
    [{ id: "b" }, { id: "a" }].sort((x, y) =>
      x.id < y.id ? -1 : x.id > y.id ? 1 : 0
    )
  );
  const setLikeB = fingerprintValue([{ id: "a" }, { id: "b" }]);
  assert.equal(setLikeA, setLikeB);

  // Decision-relevant ordered arrays remain significant when not sorted by caller contract
  const ordered1 = fingerprintValue({ roles: ["PRIMARY", "ASSISTANT"] });
  const ordered2 = fingerprintValue({ roles: ["ASSISTANT", "PRIMARY"] });
  assert.notEqual(ordered1, ordered2);

  assert.throws(() => canonicalizeJsonValue(undefined));
  assert.throws(() => canonicalizeJsonValue(() => {}));
  assert.throws(() => canonicalizeJsonValue(new Date("2026-01-01T00:00:00.000Z")));
  assert.throws(() => canonicalizeJsonValue(new Map()));
  assert.throws(() => canonicalizeJsonValue(new Set()));
  assert.throws(() => canonicalizeJsonValue(Symbol("x")));
  assert.throws(() => canonicalizeJsonValue(1n));
  assert.throws(() => canonicalizeJsonValue(NaN));
  assert.throws(() => canonicalizeJsonValue(Infinity));
});

test("P1E-04: assignmentId / planId / planFingerprint stability and sensitivity", () => {
  const baseFacts = {
    requestId: "req-1",
    tenantId: "tenant-1",
    tournamentId: "tourn-1",
    matchId: "m-1",
    roleCode: REFEREE_ROLE_CODE.PRIMARY,
    slotIndex: 0,
    refereeId: "ref-1",
    source: REFEREE_ASSIGNMENT_SOURCE.AUTO,
  };
  assert.equal(buildAssignmentId(baseFacts), buildAssignmentId(baseFacts));
  assert.notEqual(
    buildAssignmentId(baseFacts),
    buildAssignmentId({ ...baseFacts, slotIndex: 1 })
  );
  assert.notEqual(
    buildAssignmentId(baseFacts),
    buildAssignmentId({ ...baseFacts, refereeId: "ref-2" })
  );

  const a = assignReferees(planInput({ candidates: [cand("ref-1")] }));
  const b = assignReferees(planInput({ candidates: [cand("ref-1")] }));
  assert.equal(a.ok, true);
  assert.equal(a.plan.planId, b.plan.planId);
  assert.equal(a.plan.planFingerprint, b.plan.planFingerprint);
  assert.match(a.plan.planFingerprint, HEX64);
  assert.ok(a.plan.planId.startsWith(CORE13_ID_PREFIX.PLAN));
  assert.ok(
    a.plan.assignments[0].assignmentId.startsWith(CORE13_ID_PREFIX.ASSIGNMENT)
  );

  const changedTenant = assignReferees({
    ...planInput({ candidates: [cand("ref-1")] }),
    request: createRefereeAssignmentRequest({
      requestId: "req-1",
      tenantId: "tenant-OTHER",
      tournamentId: "tourn-1",
      matchIds: ["m-1"],
      policy: policy(),
      context: {
        tenantId: "tenant-OTHER",
        tournamentId: "tourn-1",
        matchIds: ["m-1"],
        snapshotRefs: [
          { snapshotId: "s1", snapshotVersion: "v1", fingerprint: "abcd1234" },
        ],
      },
    }),
  });
  assert.notEqual(a.plan.planFingerprint, changedTenant.plan.planFingerprint);

  const labelA = assignReferees(
    planInput({ candidates: [cand("ref-1", { displayLabel: "Alpha" })] })
  );
  const labelB = assignReferees(
    planInput({ candidates: [cand("ref-1", { displayLabel: "Beta" })] })
  );
  assert.equal(labelA.plan.planFingerprint, labelB.plan.planFingerprint);
});

test("P1E-05: replacement fingerprint domains and sink timestamp independence", () => {
  const prior = createRefereeAssignment({
    assignmentId: "asg-prior",
    matchId: "m-1",
    refereeId: "ref-1",
    roleCode: REFEREE_ROLE_CODE.PRIMARY,
    status: REFEREE_ASSIGNMENT_STATUS.CONFIRMED,
  });
  const base = {
    directorySnapshot: createPopulatedSnapshotResult([cand("ref-1"), cand("ref-2"), cand("ref-3")]),
    qualificationSnapshot: createPopulatedSnapshotResult([
      qual("ref-1"),
      qual("ref-2"),
      qual("ref-3"),
    ]),
    availabilitySnapshot: createPopulatedSnapshotResult([
      avail("ref-1"),
      avail("ref-2"),
      avail("ref-3"),
    ]),
    existingAssignmentSnapshot: createPopulatedSnapshotResult([prior]),
    scheduleSnapshot: createPopulatedSnapshotResult([
      createMatchScheduleRow(MATCH),
    ]),
    conflictPolicy: {},
    policy: policy(),
  };
  const r1 = replaceRefereeAssignment({
    ...base,
    request: {
      requestId: "rep-1",
      tenantId: "tenant-1",
      tournamentId: "tourn-1",
      assignmentId: "asg-prior",
      incomingRefereeId: "ref-2",
      reasonCode: "SWAP",
    },
  });
  const r1b = replaceRefereeAssignment({
    ...base,
    request: {
      requestId: "rep-1",
      tenantId: "tenant-1",
      tournamentId: "tourn-1",
      assignmentId: "asg-prior",
      incomingRefereeId: "ref-2",
      reasonCode: "SWAP",
    },
  });
  assert.equal(r1.ok, true);
  assert.equal(r1.resultFingerprint, r1b.resultFingerprint);
  assert.match(r1.resultFingerprint, HEX64);
  assert.ok(
    r1.incomingAssignment.assignmentId.startsWith(CORE13_ID_PREFIX.REPLACEMENT)
  );
  assert.equal(r1.auditPayload.recordedAt, null);

  const r2 = replaceRefereeAssignment({
    ...base,
    request: {
      requestId: "rep-1",
      tenantId: "tenant-1",
      tournamentId: "tourn-1",
      assignmentId: "asg-prior",
      incomingRefereeId: "ref-3",
      reasonCode: "SWAP",
    },
  });
  assert.notEqual(r1.resultFingerprint, r2.resultFingerprint);
});

test("P1E-06: fairness cohort active-only; unavailable still included; dedupe", () => {
  const unavailableWindow = avail("ref-2", {
    startAt: "2026-07-22T14:00:00.000Z",
    endAt: "2026-07-22T15:00:00.000Z",
  });
  const input = planInput({
    candidates: [cand("ref-1"), cand("ref-2"), cand("ref-inactive", { active: false })],
  });
  input.availabilitySnapshot = createPopulatedSnapshotResult([
    avail("ref-1"),
    unavailableWindow,
  ]);
  const result = assignReferees(input);
  assert.equal(result.ok, true);
  assert.equal(result.plan.replayMetadata.workloadCohortSize, 2);

  const dup = assignReferees(
    planInput({
      candidates: [cand("ref-1")],
      directoryItems: [cand("ref-1"), cand("ref-1")],
    })
  );
  assert.equal(dup.ok, true);
  assert.equal(dup.plan.replayMetadata.workloadCohortSize, 1);

  const conflict = assignReferees(
    planInput({
      candidates: [cand("ref-1")],
      directoryItems: [
        cand("ref-1", { playerId: "player-a" }),
        cand("ref-1", { playerId: "player-b" }),
      ],
    })
  );
  assert.equal(conflict.ok, false);
  assert.equal(
    conflict.failure.code,
    REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.NON_DETERMINISTIC_INPUT
  );
});

test("P1E-07: schedule duplicate identical ok; conflicting fatal", () => {
  const row = createMatchScheduleRow(MATCH);
  const ok = assignReferees({
    ...planInput({ candidates: [cand("ref-1")] }),
    scheduleSnapshot: createPopulatedSnapshotResult([row, { ...row }]),
  });
  assert.equal(ok.ok, true);

  const bad = assignReferees({
    ...planInput({ candidates: [cand("ref-1")] }),
    scheduleSnapshot: createPopulatedSnapshotResult([
      row,
      createMatchScheduleRow({
        ...MATCH,
        courtId: "court-OTHER",
      }),
    ]),
  });
  assert.equal(bad.ok, false);
  assert.equal(
    bad.failure.code,
    REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.NON_DETERMINISTIC_INPUT
  );
});

test("P1E-08: seed modes — absent, disabled ignore, enabled replay, required missing", () => {
  const a = assignReferees(planInput({ candidates: [cand("ref-1"), cand("ref-2")] }));
  const b = assignReferees(planInput({ candidates: [cand("ref-1"), cand("ref-2")] }));
  assert.equal(a.plan.planFingerprint, b.plan.planFingerprint);

  const withIgnoredSeed = assignReferees(
    planInput({
      candidates: [cand("ref-1"), cand("ref-2")],
      seed: "seed-A",
      pol: policy({ enableSeededExploration: false }),
    })
  );
  assert.equal(a.plan.assignments[0].refereeId, withIgnoredSeed.plan.assignments[0].refereeId);
  assert.equal(a.plan.planFingerprint, withIgnoredSeed.plan.planFingerprint);

  const seeded1 = assignReferees(
    planInput({
      candidates: [cand("ref-1"), cand("ref-2")],
      seed: "seed-A",
      pol: policy({
        enableSeededExploration: true,
        softObjectiveKeys: [],
      }),
    })
  );
  const seeded1b = assignReferees(
    planInput({
      candidates: [cand("ref-1"), cand("ref-2")],
      seed: "seed-A",
      pol: policy({
        enableSeededExploration: true,
        softObjectiveKeys: [],
      }),
    })
  );
  assert.equal(seeded1.ok, true);
  assert.equal(seeded1.plan.planFingerprint, seeded1b.plan.planFingerprint);

  const seeded2 = assignReferees(
    planInput({
      candidates: [cand("ref-1"), cand("ref-2")],
      seed: "seed-B",
      pol: policy({
        enableSeededExploration: true,
        softObjectiveKeys: [],
      }),
    })
  );
  // Different seeds may change tie-break among eligible; fingerprints differ
  assert.notEqual(seeded1.plan.planFingerprint, seeded2.plan.planFingerprint);

  // Seed never bypasses hard — inactive still excluded
  const hard = assignReferees(
    planInput({
      candidates: [cand("ref-bad", { active: false }), cand("ref-1")],
      seed: "seed-A",
      pol: policy({ enableSeededExploration: true, softObjectiveKeys: [] }),
    })
  );
  assert.equal(hard.plan.assignments[0].refereeId, "ref-1");

  const missing = assignReferees(
    planInput({
      candidates: [cand("ref-1")],
      pol: policy({ requireSeed: true, enableSeededExploration: true }),
    })
  );
  assert.equal(missing.ok, false);
  assert.equal(
    missing.failure.code,
    REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.NON_DETERMINISTIC_INPUT
  );
});

test("P1E-09: recoverability, exports, architecture, immutability, matrix", () => {
  const empty = assignReferees({
    ...planInput({ candidates: [] }),
    directorySnapshot: createEmptySnapshotResult(),
  });
  assert.equal(empty.ok, true);
  assert.ok(empty.plan.unassigned.length > 0);

  const windowGap = assignReferees(
    planInput({
      matches: [MATCH, { matchId: "m-bad" }],
      candidates: [cand("ref-1")],
    })
  );
  assert.equal(windowGap.ok, true);
  assert.ok(windowGap.plan.unassigned.some((u) => u.matchId === "m-bad"));

  const missingSnap = assignReferees({
    ...planInput(),
    scheduleSnapshot: createMissingSnapshotResult(),
  });
  assert.equal(missingSnap.ok, false);

  assert.equal(typeof Core13.assignReferees, "function");
  assert.equal(typeof Core13.replaceRefereeAssignment, "function");
  assert.equal("autoAssignReferees" in Core13, false);
  assert.equal("hashStringToUint32" in Core13, false);
  const barrel = readFileSync(ROOT_BARREL, "utf8");
  assert.equal(barrel.includes("referee-assignment"), false);

  for (const file of listJsFiles(MOD_ROOT)) {
    const src = readFileSync(file, "utf8");
    assert.equal(/Math\.random\s*\(/.test(src), false, file);
    assert.equal(/Date\.now\s*\(/.test(src), false, file);
    assert.equal(/randomUUID\s*\(/.test(src), false, file);
    assert.equal(src.includes("localeCompare"), false, file);
    assert.equal(/from\s+["']react["']/.test(src), false, file);
    assert.equal(src.includes("@supabase"), false, file);
    assert.equal(src.includes("referee-v5"), false, file);
    assert.equal(
      /from\s+["'][^"']*(?:resource-conflict|core-14|\/core14)/i.test(src),
      false,
      file
    );
  }

  assert.ok(Object.isFrozen(empty.plan));
  assert.ok(existsSync(CERT_DOC));
  const doc = readFileSync(CERT_DOC, "utf8");
  for (let i = 1; i <= 58; i += 1) {
    assert.ok(
      doc.includes(`| ${i} |`) || doc.includes(`| ${i}|`),
      `traceability missing requirement ${i}`
    );
  }
});
