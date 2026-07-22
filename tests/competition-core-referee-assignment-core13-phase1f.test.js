/**
 * CORE-13 Phase 1F — final certification (SHA-256 oracle, replay, boundaries).
 * node:crypto is used ONLY as an independent test oracle.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import * as Core13 from "../src/features/competition-core/referee-assignment/index.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MOD_ROOT = path.join(
  ROOT,
  "src/features/competition-core/referee-assignment"
);
const ROOT_BARREL = path.join(ROOT, "src/features/competition-core/index.js");
const CERT_DOC = path.join(
  ROOT,
  "docs/competition-engine/core-13/09_PHASE_1F_FINAL_CERTIFICATION.md"
);
const MANIFEST_DOC = path.join(
  ROOT,
  "docs/competition-engine/core-13/10_PUBLIC_SURFACE_MANIFEST.md"
);

const {
  CORE13_DIGEST_DOMAIN,
  CORE13_ID_PREFIX,
  CORE13_ID_DIGEST_HEX_LEN,
  CORE13_DIGEST_VERSION,
  CORE13_SCHEMA_VERSION,
  sha256HexUtf8,
  serializeCanonical,
  canonicalizeJsonValue,
  digestCanonical,
  fingerprintValue,
  buildAssignmentId,
  buildPlanId,
  buildReplacementId,
  REFEREE_ROLE_CODE,
  REFEREE_ASSIGNMENT_STATUS,
  REFEREE_ASSIGNMENT_SOURCE,
  REFEREE_SOFT_OBJECTIVE_KEY,
  REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE,
  createRefereeCandidate,
  createRefereeQualification,
  createRefereeAvailabilityWindow,
  createRefereeAssignmentPolicy,
  createRefereeAssignmentRequest,
  createRefereeAssignment,
  createPopulatedSnapshotResult,
  createEmptySnapshotResult,
  createMissingSnapshotResult,
  createInvalidSnapshotResult,
  createMatchScheduleRow,
  evaluateRefereeEligibility,
  detectRefereeConflicts,
  calculateRefereeWorkload,
  validateManualRefereeAssignment,
  explainUnassignedMatch,
  assignReferees,
  replaceRefereeAssignment,
  createManualRefereeAssignmentRequest,
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

function oracleSha256(text) {
  return createHash("sha256").update(String(text), "utf8").digest("hex");
}

function assertDigest(text, label) {
  const got = sha256HexUtf8(text);
  const expected = oracleSha256(text);
  assert.equal(got, expected, label || text);
  assert.match(got, /^[0-9a-f]{64}$/);
}

function fixedAscii(len, ch = "x") {
  return ch.repeat(len);
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

function avail(refereeId) {
  return createRefereeAvailabilityWindow({
    windowId: `w-${refereeId}`,
    refereeId,
    startAt: "2026-07-22T00:00:00.000Z",
    endAt: "2026-07-22T23:59:59.000Z",
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
  return {
    request,
    policy: pol,
    directorySnapshot: createPopulatedSnapshotResult(candidates),
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
      matches.map((m) => createMatchScheduleRow(m))
    ),
    conflictPolicy,
    roleRequirementsByMatch,
  };
}

function deepClonePlain(value) {
  return JSON.parse(JSON.stringify(value));
}

function assertFrozenDeep(value, seen = new WeakSet()) {
  if (value === null || typeof value !== "object") return;
  if (seen.has(value)) return;
  seen.add(value);
  assert.ok(Object.isFrozen(value));
  if (Array.isArray(value)) {
    for (const item of value) assertFrozenDeep(item, seen);
  } else {
    for (const key of Object.keys(value)) assertFrozenDeep(value[key], seen);
  }
}

// ---- SHA-256 oracle ----

test("P1F-01: SHA-256 known answers and length boundary oracle", () => {
  assertDigest("", "empty");
  assertDigest("abc", "abc");
  assertDigest(
    "The quick brown fox jumps over the lazy dog",
    "quick-brown-fox"
  );
  assertDigest(fixedAscii(70, "a"), "multi-block");
  assertDigest("Xin chào Việt Nam", "vietnamese");
  assertDigest("e\u0301", "combining");
  assertDigest("hello 😀 world", "emoji");
  for (const len of [55, 56, 63, 64, 65, 127, 128, 129]) {
    assertDigest(fixedAscii(len), `len-${len}`);
  }
  assert.equal(CORE13_DIGEST_VERSION, "CORE13_DIGEST_SHA256_V1");
});

test("P1F-02: production digest has no Node crypto import; UTF-8 matches TextEncoder", () => {
  const fpSrc = readFileSync(
    path.join(MOD_ROOT, "deterministic/fingerprint.js"),
    "utf8"
  );
  assert.equal(/from\s+["']node:crypto["']/.test(fpSrc), false);
  assert.equal(/from\s+["']crypto["']/.test(fpSrc), false);
  assert.equal(/require\s*\(\s*["'](?:node:)?crypto["']\s*\)/.test(fpSrc), false);

  const samples = ["abc", "Xin chào", "😀", "e\u0301", "e\u00e9"];
  for (const s of samples) {
    const utf8 = new TextEncoder().encode(s);
    const fromBytes = createHash("sha256").update(Buffer.from(utf8)).digest("hex");
    assert.equal(sha256HexUtf8(s), fromBytes);
  }
  // Distinct code-point sequences remain distinct (no silent NFC)
  assert.notEqual(sha256HexUtf8("e\u0301"), sha256HexUtf8("\u00e9"));
});

// ---- Canonicalization ----

test("P1F-03: canonicalization rules and rejections", () => {
  assert.equal(
    serializeCanonical({ b: 1, a: 2 }),
    serializeCanonical({ a: 2, b: 1 })
  );
  const setA = [{ id: "b" }, { id: "a" }];
  const setB = [{ id: "a" }, { id: "b" }];
  const norm = (arr) =>
    [...arr].sort((x, y) => (x.id < y.id ? -1 : x.id > y.id ? 1 : 0));
  assert.equal(
    serializeCanonical(norm(setA)),
    serializeCanonical(norm(setB))
  );
  assert.notEqual(
    serializeCanonical({ roles: ["PRIMARY", "ASSISTANT"] }),
    serializeCanonical({ roles: ["ASSISTANT", "PRIMARY"] })
  );

  assert.equal(canonicalizeJsonValue(-0), 0);
  assert.throws(() => canonicalizeJsonValue(undefined));
  assert.throws(() => canonicalizeJsonValue(() => {}));
  assert.throws(() => canonicalizeJsonValue(new Date("2026-01-01T00:00:00.000Z")));
  assert.throws(() => canonicalizeJsonValue(new Map()));
  assert.throws(() => canonicalizeJsonValue(new Set()));
  assert.throws(() => canonicalizeJsonValue(Symbol("x")));
  assert.throws(() => canonicalizeJsonValue(1n));
  assert.throws(() => canonicalizeJsonValue(NaN));
  assert.throws(() => canonicalizeJsonValue(Infinity));
  assert.throws(() => canonicalizeJsonValue(-Infinity));

  const cyclic = { a: 1 };
  cyclic.self = cyclic;
  assert.throws(() => canonicalizeJsonValue(cyclic));

  const input = { z: 1, a: [2, 3] };
  const before = deepClonePlain(input);
  serializeCanonical(input);
  assert.deepEqual(input, before);
});

test("P1F-04: domain separation and ID formats", () => {
  const payload = { x: 1, y: "z" };
  const domains = Object.values(CORE13_DIGEST_DOMAIN);
  assert.equal(new Set(domains).size, domains.length);
  const digests = domains.map((d) => digestCanonical(d, payload));
  assert.equal(new Set(digests).size, digests.length);
  for (const d of digests) assert.match(d, /^[0-9a-f]{64}$/);

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
  assert.equal(CORE13_ID_PREFIX.AUDIT, "core13_audit_v1_");
  assert.ok(CORE13_ID_DIGEST_HEX_LEN >= 32);
  assert.equal(asg.slice(CORE13_ID_PREFIX.ASSIGNMENT.length).length, 32);
  assert.match(fingerprintValue(payload, CORE13_DIGEST_DOMAIN.PLAN_FINGERPRINT), /^[0-9a-f]{64}$/);
});

// ---- Public surface ----

test("P1F-05: public export freeze matches manifest", () => {
  const names = Object.keys(Core13).sort();
  assert.equal(new Set(names).size, names.length);
  assert.equal(typeof Core13.assignReferees, "function");
  assert.equal(typeof Core13.replaceRefereeAssignment, "function");
  assert.equal("autoAssignReferees" in Core13, false);
  assert.equal("dispatchReferees" in Core13, false);
  assert.equal("planRefereeAssignments" in Core13, false);
  assert.equal("reassignReferee" in Core13, false);
  assert.equal("hashStringToUint32" in Core13, false);
  assert.equal("sha256DigestBytes" in Core13, false);
  assert.equal("buildSoftScoreVector" in Core13, false);
  assert.equal("compareCandidates" in Core13, false);
  assert.ok(existsSync(MANIFEST_DOC));
  const manifest = readFileSync(MANIFEST_DOC, "utf8");
  for (const name of names) {
    assert.ok(manifest.includes(name), `manifest missing ${name}`);
  }
  assert.equal(CORE13_SCHEMA_VERSION, "CORE13_REFEREE_ASSIGNMENT_SCHEMA_V1");
});

// ---- Replay ----

test("P1F-06: deterministic replay across 25 runs", () => {
  const scenarios = [
    () => assignReferees(planInput({ candidates: [cand("ref-1")], matches: [MATCH] })),
    () =>
      assignReferees(
        planInput({
          candidates: [cand("ref-2"), cand("ref-1")],
          matches: [
            MATCH,
            {
              matchId: "m-2",
              startAt: "2026-07-22T12:00:00.000Z",
              endAt: "2026-07-22T13:00:00.000Z",
              courtId: "court-2",
              participantRefs: ["p3", "p4"],
              teamRefs: [],
              clubIds: [],
            },
          ],
        })
      ),
    () =>
      assignReferees(
        planInput({
          candidates: [cand("ref-1"), cand("ref-2")],
          roleRequirementsByMatch: {
            "m-1": [
              {
                roleCode: REFEREE_ROLE_CODE.PRIMARY,
                mandatory: true,
                minCount: 1,
                maxCount: 1,
              },
              {
                roleCode: REFEREE_ROLE_CODE.ASSISTANT,
                mandatory: true,
                minCount: 1,
                maxCount: 1,
              },
            ],
          },
        })
      ),
    () =>
      assignReferees({
        ...planInput({ candidates: [] }),
        directorySnapshot: createEmptySnapshotResult(),
      }),
    () =>
      assignReferees(
        planInput({
          candidates: [cand("ref-1")],
          seed: "fixed-seed-1",
          pol: policy({ enableSeededExploration: true }),
        })
      ),
  ];

  for (const run of scenarios) {
    const first = run();
    const canon = serializeCanonical(first);
    for (let i = 0; i < 25; i += 1) {
      const next = run();
      assert.equal(serializeCanonical(next), canon);
      if (first.ok && next.ok) {
        assert.equal(next.plan.planId, first.plan.planId);
        assert.equal(next.plan.planFingerprint, first.plan.planFingerprint);
      }
    }
  }

  const prior = createRefereeAssignment({
    assignmentId: "asg-prior",
    matchId: "m-1",
    refereeId: "ref-1",
    roleCode: REFEREE_ROLE_CODE.PRIMARY,
    status: REFEREE_ASSIGNMENT_STATUS.CONFIRMED,
  });
  const repInput = {
    request: {
      requestId: "rep-1",
      tenantId: "tenant-1",
      tournamentId: "tourn-1",
      assignmentId: "asg-prior",
      incomingRefereeId: "ref-2",
      reasonCode: "SWAP",
    },
    directorySnapshot: createPopulatedSnapshotResult([cand("ref-1"), cand("ref-2")]),
    qualificationSnapshot: createPopulatedSnapshotResult([
      qual("ref-1"),
      qual("ref-2"),
    ]),
    availabilitySnapshot: createPopulatedSnapshotResult([
      avail("ref-1"),
      avail("ref-2"),
    ]),
    existingAssignmentSnapshot: createPopulatedSnapshotResult([prior]),
    scheduleSnapshot: createPopulatedSnapshotResult([
      createMatchScheduleRow(MATCH),
    ]),
    conflictPolicy: {},
    policy: policy(),
  };
  const repFirst = replaceRefereeAssignment(repInput);
  const repCanon = serializeCanonical(repFirst);
  for (let i = 0; i < 25; i += 1) {
    assert.equal(serializeCanonical(replaceRefereeAssignment(repInput)), repCanon);
  }
  assert.equal(repFirst.ok, true);

  const reject = replaceRefereeAssignment({
    ...repInput,
    request: { ...repInput.request, incomingRefereeId: "ref-1" },
  });
  assert.equal(reject.ok, false);
  const rejectCanon = serializeCanonical(reject);
  for (let i = 0; i < 25; i += 1) {
    assert.equal(
      serializeCanonical(
        replaceRefereeAssignment({
          ...repInput,
          request: { ...repInput.request, incomingRefereeId: "ref-1" },
        })
      ),
      rejectCanon
    );
  }
});

test("P1F-07: shuffled set-like inputs and recoverability", () => {
  const a = assignReferees(
    planInput({ candidates: [cand("ref-1"), cand("ref-2")] })
  );
  const b = assignReferees(
    planInput({ candidates: [cand("ref-2"), cand("ref-1")] })
  );
  assert.equal(a.plan.planFingerprint, b.plan.planFingerprint);

  const empty = assignReferees({
    ...planInput({ candidates: [] }),
    directorySnapshot: createEmptySnapshotResult(),
  });
  assert.equal(empty.ok, true);

  const gap = assignReferees(
    planInput({
      matches: [
        MATCH,
        { matchId: "m-bad" },
        {
          matchId: "m-2",
          startAt: "2026-07-22T12:00:00.000Z",
          endAt: "2026-07-22T13:00:00.000Z",
          courtId: "court-2",
          participantRefs: ["p3", "p4"],
          teamRefs: [],
          clubIds: [],
        },
      ],
      candidates: [cand("ref-1"), cand("ref-2")],
    })
  );
  assert.equal(gap.ok, true);
  assert.ok(gap.plan.assignments.some((x) => x.matchId === "m-1"));
  assert.ok(gap.plan.assignments.some((x) => x.matchId === "m-2"));
  assert.ok(gap.plan.unassigned.some((u) => u.matchId === "m-bad"));

  const fatalMissing = assignReferees({
    ...planInput(),
    scheduleSnapshot: createMissingSnapshotResult(),
  });
  assert.equal(fatalMissing.ok, false);
  const fatalInvalid = assignReferees({
    ...planInput(),
    directorySnapshot: createInvalidSnapshotResult(),
  });
  assert.equal(fatalInvalid.ok, false);
});

test("P1F-08: input immutability for all seven public operations", () => {
  const candidate = cand("ref-1");
  const match = createMatchScheduleRow(MATCH);
  const quals = [qual("ref-1")];
  const windows = [avail("ref-1")];
  const existing = [];
  const scheduleRows = [match];
  const conflictPolicy = { disallowAffiliatedTeamReferee: false };
  const pol = policy();

  const snap = (obj) => serializeCanonical(obj);
  const beforeCand = snap(candidate);
  const beforeMatch = snap(match);
  const beforeQuals = snap(quals);
  const beforeWindows = snap(windows);
  const beforeExisting = snap(existing);
  const beforeSchedule = snap(scheduleRows);
  const beforePolicy = snap(pol);
  const beforeConflict = snap(conflictPolicy);

  const eligibility = evaluateRefereeEligibility({
    tenantId: "tenant-1",
    tournamentId: "tourn-1",
    candidate,
    match,
    roleCode: REFEREE_ROLE_CODE.PRIMARY,
    qualifications: quals,
    availabilityWindows: windows,
    existingAssignments: existing,
    scheduleRows,
    conflictPolicy,
    policy: pol,
  });
  detectRefereeConflicts({
    refereeId: "ref-1",
    candidate,
    match,
    roleCode: REFEREE_ROLE_CODE.PRIMARY,
    existingAssignments: existing,
    scheduleRows,
    conflictPolicy,
    policy: pol,
  });
  calculateRefereeWorkload({
    assignments: existing,
    scheduleRows,
    populationRefereeIds: ["ref-1"],
  });
  explainUnassignedMatch({
    tenantId: "tenant-1",
    tournamentId: "tourn-1",
    match,
    roleRequirement: {
      roleCode: REFEREE_ROLE_CODE.PRIMARY,
      mandatory: true,
      minCount: 1,
      maxCount: 1,
    },
    candidates: [candidate],
    qualifications: quals,
    availabilityWindows: windows,
    existingAssignments: existing,
    scheduleRows,
    conflictPolicy,
    policy: pol,
  });
  validateManualRefereeAssignment({
    request: createManualRefereeAssignmentRequest({
      requestId: "man-1",
      tenantId: "tenant-1",
      tournamentId: "tourn-1",
      matchId: "m-1",
      refereeId: "ref-1",
      roleCode: REFEREE_ROLE_CODE.PRIMARY,
    }),
    directorySnapshot: createPopulatedSnapshotResult([candidate]),
    qualificationSnapshot: createPopulatedSnapshotResult(quals),
    availabilitySnapshot: createPopulatedSnapshotResult(windows),
    existingAssignmentSnapshot: createEmptySnapshotResult(),
    scheduleSnapshot: createPopulatedSnapshotResult(scheduleRows),
    conflictPolicy,
    policy: pol,
  });
  const plan = assignReferees(planInput({ candidates: [candidate] }));
  const prior = createRefereeAssignment({
    assignmentId: "asg-prior",
    matchId: "m-1",
    refereeId: "ref-1",
    roleCode: REFEREE_ROLE_CODE.PRIMARY,
    status: REFEREE_ASSIGNMENT_STATUS.CONFIRMED,
  });
  replaceRefereeAssignment({
    request: {
      requestId: "rep-1",
      tenantId: "tenant-1",
      tournamentId: "tourn-1",
      assignmentId: "asg-prior",
      incomingRefereeId: "ref-1",
    },
    directorySnapshot: createPopulatedSnapshotResult([candidate]),
    qualificationSnapshot: createPopulatedSnapshotResult(quals),
    availabilitySnapshot: createPopulatedSnapshotResult(windows),
    existingAssignmentSnapshot: createPopulatedSnapshotResult([prior]),
    scheduleSnapshot: createPopulatedSnapshotResult(scheduleRows),
    conflictPolicy,
    policy: pol,
  });

  assert.equal(snap(candidate), beforeCand);
  assert.equal(snap(match), beforeMatch);
  assert.equal(snap(quals), beforeQuals);
  assert.equal(snap(windows), beforeWindows);
  assert.equal(snap(existing), beforeExisting);
  assert.equal(snap(scheduleRows), beforeSchedule);
  assert.equal(snap(pol), beforePolicy);
  assert.equal(snap(conflictPolicy), beforeConflict);

  assertFrozenDeep(eligibility);
  assertFrozenDeep(plan);
});

test("P1F-09: architecture boundaries, scans, docs, regressions gate", async () => {
  assert.ok(existsSync(CERT_DOC));
  assert.ok(existsSync(MANIFEST_DOC));
  const barrel = readFileSync(ROOT_BARREL, "utf8");
  assert.equal(barrel.includes("referee-assignment"), false);

  const prohibitedImport =
    /from\s+["'][^"']*(?:\/react["']|["']react["']|@supabase|referee-v5|resource-conflict|core-14|\/core14|court-engine|match-lifecycle|\/scoring\/|features\/scoring)[^"']*["']/i;
  const prohibitedSymbol =
    /Math\.random\s*\(|Date\.now\s*\(|randomUUID\s*\(|localeCompare|2166136261|16777619|hashStringToUint32|0x811c9dc5|0x01000193/;
  const cryptoImport =
    /from\s+["'](?:node:)?crypto["']|require\s*\(\s*["'](?:node:)?crypto["']\s*\)/;

  for (const file of listJsFiles(MOD_ROOT)) {
    const src = readFileSync(file, "utf8");
    assert.equal(prohibitedImport.test(src), false, `import ${file}`);
    assert.equal(prohibitedSymbol.test(src), false, `symbol ${file}`);
    assert.equal(cryptoImport.test(src), false, `crypto-import ${file}`);
    assert.equal(/globalThis\.crypto|window\.crypto/.test(src), false, file);
    // syntax / import validation
    await import(pathToFileURL(file).href);
  }

  // Integration boundary: schedule via ports/snapshots only; court is opaque ref
  const schedulePort = readFileSync(
    path.join(MOD_ROOT, "ports/matchScheduleInputPort.js"),
    "utf8"
  );
  assert.ok(schedulePort.includes("createMatchScheduleRow"));
  assert.equal(schedulePort.includes("schedule-engine"), false);

  const soft = readFileSync(path.join(MOD_ROOT, "planning/softScoring.js"), "utf8");
  assert.ok(soft.includes("courtId") || soft.includes("courtTransition"));

  const projection = readFileSync(
    path.join(MOD_ROOT, "contracts/refereeResourceConflictProjection.js"),
    "utf8"
  );
  assert.ok(projection.includes("CORE-14") || projection.includes("resourceType"));
  assert.equal(/from\s+["'][^"']*core-14/.test(projection), false);

  // Paths authorized
  assert.ok(existsSync(path.join(ROOT, "tests/competition-core-referee-assignment-core13-phase1f.test.js")));
  void REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE;
  void REFEREE_ASSIGNMENT_SOURCE;
});
