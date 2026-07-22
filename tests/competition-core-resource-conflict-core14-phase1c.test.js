/**
 * CORE-14 Phase 1C — Resource Conflict Resolver dormant domain foundation tests.
 * Capability-local only. Not added to Integrator unit-test-files.json.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  CORE14_CRK_V1,
  CORE14_IDENTITY,
  RESOURCE_KIND,
  SCOPE_TYPE,
  OCCUPANCY_SOURCE,
  ACTIVITY_IDENTITY_TYPE,
  RESOURCE_FINDING_CODE,
  INPUT_DIAGNOSTIC_CODE,
  INPUT_DIAGNOSTIC_CODE_VALUES,
  DOMAIN_CONTRACT_ERROR_CODE,
  SEVERITY,
  EVALUATION_STATUS,
  PLAN_STATUS,
  AVAILABILITY_CERTIFICATION,
  AVAILABILITY_MODE,
  createCanonicalResourceKey,
  serializeCanonicalResourceKey,
  validateCanonicalResourceKey,
  validateEventScopeIdentity,
  createResourceOccupancy,
  validateResourceOccupancy,
  isSafeEpochMs,
  validateHalfOpenInterval,
  intervalsOverlap,
  intervalIntersection,
  resolveActivityIdentity,
  serializeLogicalAssignmentKeyV1,
  serializeOccupancyIndexKey,
  evaluateDuplicateIntegrity,
  getMinimumSeverity,
  evaluateSeverityOverride,
  createResourceFinding,
  createDetectionResult,
  createRejectedInvalidInputResult,
  createInputDiagnostic,
  canonicalSerialize,
  canonicalSerializeIdentifierSet,
  hashUtf8Sha256Hex,
  isValidSha256Hex,
  fingerprintValue,
  fingerprintCore14Material,
  createFindingId,
  ResourceConflictContractError,
  compareUtf8Bytewise,
} from "../src/features/competition-core/resource-conflict/index.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const RC_ROOT = path.join(ROOT, "src/features/competition-core/resource-conflict");
const CC_INDEX = path.join(ROOT, "src/features/competition-core/index.js");

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

function baseKey(overrides = {}) {
  return {
    resourceKind: RESOURCE_KIND.PLAYER,
    resourceId: "player-1",
    scopeType: SCOPE_TYPE.EVENT,
    scopeId: "event-9",
    ...overrides,
  };
}

function baseOccupancy(overrides = {}) {
  return {
    occupancyId: "occ-1",
    resourceKey: baseKey(),
    assignmentId: "asg-1",
    activityId: null,
    matchId: null,
    competitionId: null,
    venueId: null,
    startMs: 1000,
    endMs: 2000,
    capacityUnits: 1,
    locked: false,
    published: false,
    source: OCCUPANCY_SOURCE.MANUAL,
    metadata: null,
    ...overrides,
  };
}

// 1. Resource key excludes time
test("1. CanonicalResourceKey excludes time fields", () => {
  const key = createCanonicalResourceKey(baseKey());
  assert.equal("startMs" in key, false);
  assert.equal("endMs" in key, false);
  const serialized = serializeCanonicalResourceKey(key);
  assert.equal(serialized.includes("startMs"), false);
  assert.equal(serialized.includes("1000"), false);
});

// 2. Deterministic serialization
test("2. Resource key deterministic CORE14_CRK_V1 serialization", () => {
  const a = serializeCanonicalResourceKey(baseKey({ resourceKind: RESOURCE_KIND.COURT, resourceId: "court-12", scopeType: SCOPE_TYPE.VENUE, scopeId: "venue-9" }));
  const b = serializeCanonicalResourceKey(baseKey({ resourceKind: RESOURCE_KIND.COURT, resourceId: "court-12", scopeType: SCOPE_TYPE.VENUE, scopeId: "venue-9" }));
  assert.equal(a, b);
  assert.equal(
    a,
    `${CORE14_CRK_V1}|k=COURT|i=court-12|st=VENUE|sid=venue-9`
  );
});

// 3. GLOBAL without scopeId
test("3. GLOBAL scope allows null/absent scopeId", () => {
  const key = createCanonicalResourceKey({
    resourceKind: RESOURCE_KIND.PLAYER,
    resourceId: "p-1",
    scopeType: SCOPE_TYPE.GLOBAL,
    scopeId: null,
  });
  assert.equal(key.scopeId, null);
  assert.equal(
    serializeCanonicalResourceKey(key),
    `${CORE14_CRK_V1}|k=PLAYER|i=p-1|st=GLOBAL|sid=null`
  );
});

// 4. Non-GLOBAL requires scopeId
test("4. Non-GLOBAL scope requires non-empty scopeId", () => {
  const result = validateCanonicalResourceKey({
    resourceKind: RESOURCE_KIND.COURT,
    resourceId: "c-1",
    scopeType: SCOPE_TYPE.VENUE,
    scopeId: null,
  });
  assert.equal(result.ok, false);
  assert.equal(result.diagnostics[0].code, INPUT_DIAGNOSTIC_CODE.SCOPE_MISSING);
});

// 5. EVENT scope uses scopeId
test("5. EVENT scope uses scopeId as canonical event identity", () => {
  const key = createCanonicalResourceKey(baseKey({ scopeType: SCOPE_TYPE.EVENT, scopeId: "evt-canonical" }));
  assert.equal(key.scopeId, "evt-canonical");
  assert.equal(key.scopeType, SCOPE_TYPE.EVENT);
});

// 6. Event adapter identity mismatch
test("6. Event adapter identity mismatch emits SCOPE_IDENTITY_MISMATCH", () => {
  const mismatch = validateEventScopeIdentity("evt-A", "evt-B");
  assert.equal(mismatch.ok, false);
  assert.equal(mismatch.diagnostic.code, INPUT_DIAGNOSTIC_CODE.SCOPE_IDENTITY_MISMATCH);
  const match = validateEventScopeIdentity("evt-A", "evt-A");
  assert.equal(match.ok, true);
});

// 7. Unknown resourceKind
test("7. Unknown resourceKind fails closed", () => {
  const result = validateCanonicalResourceKey(baseKey({ resourceKind: "WIDGET" }));
  assert.equal(result.ok, false);
  assert.equal(result.diagnostics[0].code, INPUT_DIAGNOSTIC_CODE.UNKNOWN_RESOURCE_TYPE);
});

// 8. Unknown scopeType
test("8. Unknown scopeType fails closed", () => {
  const result = validateCanonicalResourceKey(baseKey({ scopeType: "GALAXY" }));
  assert.equal(result.ok, false);
  assert.equal(result.diagnostics[0].code, INPUT_DIAGNOSTIC_CODE.SCOPE_MISSING);
});

// 9–13. Time validation
test("9. Safe-integer epoch milliseconds accepted", () => {
  assert.equal(isSafeEpochMs(0), true);
  assert.equal(isSafeEpochMs(1_700_000_000_000), true);
  const v = validateHalfOpenInterval(100, 200);
  assert.equal(v.ok, true);
});

test("10. Fractional milliseconds rejected", () => {
  assert.equal(isSafeEpochMs(1.5), false);
  assert.equal(validateHalfOpenInterval(1.5, 2).ok, false);
});

test("11. String-form milliseconds rejected", () => {
  assert.equal(isSafeEpochMs("1000"), false);
  assert.equal(validateHalfOpenInterval("1000", "2000").ok, false);
});

test("12. Unsafe integers rejected", () => {
  assert.equal(isSafeEpochMs(Number.MAX_SAFE_INTEGER + 1), false);
  assert.equal(isSafeEpochMs(Infinity), false);
  assert.equal(isSafeEpochMs(NaN), false);
});

test("13. startMs >= endMs rejected", () => {
  assert.equal(validateHalfOpenInterval(200, 200).ok, false);
  assert.equal(validateHalfOpenInterval(300, 200).ok, false);
});

// 14–15. Interval primitives
test("14. Adjacent intervals do not overlap", () => {
  assert.equal(intervalsOverlap(100, 200, 200, 300), false);
  assert.equal(intervalsOverlap(100, 200, 50, 100), false);
});

test("15. Partial overlap detected by interval primitive", () => {
  assert.equal(intervalsOverlap(100, 200, 150, 250), true);
  const ix = intervalIntersection(100, 200, 150, 250);
  assert.deepEqual(ix, { startMs: 150, endMs: 200 });
});

// 16 + 40. Caller input not mutated
test("16/40. Caller occupancy input is not mutated", () => {
  const input = baseOccupancy({
    metadata: { note: "x" },
    resourceKey: baseKey(),
  });
  const snapshot = JSON.stringify(input);
  const normalized = createResourceOccupancy(input);
  assert.equal(JSON.stringify(input), snapshot);
  input.occupancyId = "mutated";
  input.metadata.note = "y";
  assert.equal(normalized.occupancyId, "occ-1");
  assert.equal(normalized.metadata.note, "x");
});

// 17–18. Capacity
test("17. capacityUnits safe integer greater than zero accepted", () => {
  const occ = createResourceOccupancy(baseOccupancy({ capacityUnits: 3 }));
  assert.equal(occ.capacityUnits, 3);
});

test("18. Fractional capacity rejected", () => {
  const result = validateResourceOccupancy(baseOccupancy({ capacityUnits: 1.5 }));
  assert.equal(result.ok, false);
  assert.equal(
    result.diagnostics.some((d) => d.code === INPUT_DIAGNOSTIC_CODE.INVALID_CAPACITY),
    true
  );
});

// 19–22. Activity identity
test("19. Activity identity required", () => {
  const result = validateResourceOccupancy(
    baseOccupancy({ assignmentId: null, activityId: null, matchId: null })
  );
  assert.equal(result.ok, false);
  assert.equal(
    result.diagnostics.some((d) => d.code === INPUT_DIAGNOSTIC_CODE.ACTIVITY_IDENTITY_MISSING),
    true
  );
});

test("20. assignmentId precedence", () => {
  const id = resolveActivityIdentity({
    assignmentId: "A",
    activityId: "B",
    matchId: "C",
  });
  assert.equal(id.ok, true);
  assert.equal(id.activityIdentityType, ACTIVITY_IDENTITY_TYPE.ASSIGNMENT_ID);
  assert.equal(id.activityIdentityValue, "A");
});

test("21. activityId fallback", () => {
  const id = resolveActivityIdentity({
    assignmentId: null,
    activityId: "B",
    matchId: "C",
  });
  assert.equal(id.activityIdentityType, ACTIVITY_IDENTITY_TYPE.ACTIVITY_ID);
  assert.equal(id.activityIdentityValue, "B");
});

test("22. matchId fallback", () => {
  const id = resolveActivityIdentity({
    assignmentId: "",
    activityId: "",
    matchId: "C",
  });
  assert.equal(id.activityIdentityType, ACTIVITY_IDENTITY_TYPE.MATCH_ID);
  assert.equal(id.activityIdentityValue, "C");
});

// 23–26. Duplicates
test("23. Duplicate occupancy ID detected", () => {
  const a = createResourceOccupancy(baseOccupancy({ occupancyId: "dup", assignmentId: "a1" }));
  const b = createResourceOccupancy(baseOccupancy({ occupancyId: "dup", assignmentId: "a2", startMs: 3000, endMs: 4000 }));
  const result = evaluateDuplicateIntegrity([a, b]);
  assert.equal(result.ok, false);
  assert.equal(result.diagnostics[0].code, INPUT_DIAGNOSTIC_CODE.DUPLICATE_OCCUPANCY_ID);
});

test("24. Duplicate logical assignment detected", () => {
  const a = createResourceOccupancy(baseOccupancy({ occupancyId: "o1", assignmentId: "same" }));
  const b = createResourceOccupancy(baseOccupancy({ occupancyId: "o2", assignmentId: "same", startMs: 3000, endMs: 4000 }));
  const result = evaluateDuplicateIntegrity([a, b]);
  assert.equal(
    result.diagnostics.some((d) => d.code === INPUT_DIAGNOSTIC_CODE.DUPLICATE_ASSIGNMENT),
    true
  );
});

test("25. Different resources for same match are not duplicate assignments", () => {
  const a = createResourceOccupancy(
    baseOccupancy({
      occupancyId: "o1",
      assignmentId: null,
      matchId: "m-1",
      resourceKey: baseKey({ resourceKind: RESOURCE_KIND.PLAYER, resourceId: "p1" }),
    })
  );
  const b = createResourceOccupancy(
    baseOccupancy({
      occupancyId: "o2",
      assignmentId: null,
      matchId: "m-1",
      resourceKey: baseKey({ resourceKind: RESOURCE_KIND.COURT, resourceId: "c1", scopeType: SCOPE_TYPE.VENUE, scopeId: "v1" }),
      startMs: 3000,
      endMs: 4000,
    })
  );
  const result = evaluateDuplicateIntegrity([a, b]);
  assert.equal(result.ok, true);
});

test("26. Source does not conceal duplicate logical assignment", () => {
  const a = createResourceOccupancy(
    baseOccupancy({ occupancyId: "o1", assignmentId: "asg-x", source: OCCUPANCY_SOURCE.SCHEDULE })
  );
  const b = createResourceOccupancy(
    baseOccupancy({
      occupancyId: "o2",
      assignmentId: "asg-x",
      source: OCCUPANCY_SOURCE.EXTERNAL,
      startMs: 5000,
      endMs: 6000,
    })
  );
  assert.notEqual(a.source, b.source);
  assert.equal(
    serializeLogicalAssignmentKeyV1(a),
    serializeLogicalAssignmentKeyV1(b)
  );
  const result = evaluateDuplicateIntegrity([a, b]);
  assert.equal(
    result.diagnostics.some((d) => d.code === INPUT_DIAGNOSTIC_CODE.DUPLICATE_ASSIGNMENT),
    true
  );
});

// 27–30. Severity
test("27. Severity downgrade rejected", () => {
  const result = evaluateSeverityOverride({
    findingCode: RESOURCE_FINDING_CODE.REFEREE_TIME_OVERLAP,
    requestedSeverity: SEVERITY.SOFT,
  });
  assert.equal(result.downgradeRejected, true);
  assert.equal(result.effectiveSeverity, SEVERITY.HARD);
  assert.equal(result.diagnostic.code, INPUT_DIAGNOSTIC_CODE.SEVERITY_DOWNGRADE_REJECTED);
});

test("28. Severity raise accepted", () => {
  const result = evaluateSeverityOverride({
    findingCode: RESOURCE_FINDING_CODE.PREFERRED_REST_WARNING,
    requestedSeverity: SEVERITY.HARD,
  });
  assert.equal(result.downgradeRejected, false);
  assert.equal(result.effectiveSeverity, SEVERITY.HARD);
  assert.equal(result.raised, true);
});

test("29. PREFERRED_REST_WARNING minimum SOFT", () => {
  assert.equal(getMinimumSeverity(RESOURCE_FINDING_CODE.PREFERRED_REST_WARNING), SEVERITY.SOFT);
});

test("30. Referee overlap finding minimum HARD", () => {
  assert.equal(getMinimumSeverity(RESOURCE_FINDING_CODE.REFEREE_TIME_OVERLAP), SEVERITY.HARD);
  const finding = createResourceFinding({
    code: RESOURCE_FINDING_CODE.REFEREE_TIME_OVERLAP,
    resourceKey: baseKey({ resourceKind: RESOURCE_KIND.REFEREE, resourceId: "ref-1" }),
    occupancyIds: ["o2", "o1"],
    violationStartMs: 100,
    violationEndMs: 200,
  });
  assert.equal(finding.severity, SEVERITY.HARD);
  assert.equal(finding.blocksPlanValidity, true);
});

// 31–32. Status separation
test("31. EvaluationStatus and PlanStatus are separate", () => {
  const result = createRejectedInvalidInputResult([
    {
      code: INPUT_DIAGNOSTIC_CODE.DUPLICATE_OCCUPANCY_ID,
      message: "dup",
      path: null,
      resourceKey: null,
      occupancyId: "x",
      assignmentId: null,
      details: null,
    },
  ]);
  assert.equal(result.evaluationStatus, EVALUATION_STATUS.REJECTED_INVALID_INPUT);
  assert.equal(result.planStatus, PLAN_STATUS.NOT_EVALUATED);
  assert.equal("ok" in result, false);
  assert.notEqual(EVALUATION_STATUS.COMPLETED, PLAN_STATUS.VALID);
});

test("32. Advisory availability certification constants", () => {
  assert.equal(AVAILABILITY_CERTIFICATION.FULL, "FULL");
  assert.equal(AVAILABILITY_CERTIFICATION.PARTIAL, "PARTIAL");
  assert.equal(AVAILABILITY_CERTIFICATION.NOT_EVALUATED, "NOT_EVALUATED");
  assert.equal(AVAILABILITY_MODE.ADVISORY, "ADVISORY");
  const result = createDetectionResult({
    evaluationStatus: EVALUATION_STATUS.COMPLETED,
    planStatus: PLAN_STATUS.VALID_WITH_WARNINGS,
    availabilityCertification: AVAILABILITY_CERTIFICATION.PARTIAL,
    availabilityMode: AVAILABILITY_MODE.ADVISORY,
    findings: [],
  });
  assert.equal(result.availabilityCertification, AVAILABILITY_CERTIFICATION.PARTIAL);
});

// 33–36. Serialize / hash / fingerprint / metadata
test("33. Canonical serializer rejects unsupported values", () => {
  assert.throws(() => canonicalSerialize(() => {}), ResourceConflictContractError);
  assert.throws(() => canonicalSerialize(Symbol("x")), ResourceConflictContractError);
  assert.throws(() => canonicalSerialize(1.5), ResourceConflictContractError);
  assert.throws(() => canonicalSerialize(NaN), ResourceConflictContractError);
  assert.throws(() => canonicalSerialize(Infinity), ResourceConflictContractError);
  assert.throws(() => canonicalSerialize(10n), ResourceConflictContractError);
});

test("34. SHA-256 output is lowercase hexadecimal", () => {
  const hex = hashUtf8Sha256Hex("CORE14");
  assert.equal(isValidSha256Hex(hex), true);
  assert.equal(hex, hex.toLowerCase());
  assert.match(hex, /^[a-f0-9]{64}$/);
});

test("35. Equivalent reordered input gives identical fingerprint", () => {
  const a = fingerprintValue({ z: 1, a: ["b", "a"], n: 2 });
  const b = fingerprintValue({ n: 2, a: ["b", "a"], z: 1 });
  assert.equal(a, b);
  const f1 = fingerprintCore14Material({
    sortedFindingIds: ["f2", "f1"],
    planStatus: PLAN_STATUS.VALID,
    evaluationStatus: EVALUATION_STATUS.COMPLETED,
  });
  const f2 = fingerprintCore14Material({
    evaluationStatus: EVALUATION_STATUS.COMPLETED,
    planStatus: PLAN_STATUS.VALID,
    sortedFindingIds: ["f2", "f1"],
  });
  assert.equal(f1, f2);
});

test("36. Metadata excluded from identity/fingerprint unless selected", () => {
  const without = fingerprintValue({ id: "x", metadata: { secret: 1 } });
  const withOnlyId = fingerprintValue({ id: "x" });
  assert.equal(without, withOnlyId);
  const included = fingerprintValue(
    { id: "x", metadata: { secret: 1 } },
    { includeMetadata: true }
  );
  assert.notEqual(included, without);
  const lakA = serializeLogicalAssignmentKeyV1({
    resourceKey: baseKey(),
    assignmentId: "asg-1",
  });
  assert.equal(lakA.includes("metadata"), false);
});

// 37–39. Architecture / entropy / export boundaries
test("37. No Date.now or Math.random usage in CORE-14 module", () => {
  const files = listJsFiles(RC_ROOT);
  assert.ok(files.length > 0);
  for (const file of files) {
    const src = readFileSync(file, "utf8");
    assert.equal(src.includes("Date.now"), false, file);
    assert.equal(src.includes("Math.random"), false, file);
  }
});

test("38. No imports from unfinished adjacent CORE implementations", () => {
  const files = listJsFiles(RC_ROOT);
  const importLine = /^\s*import\s+[\s\S]*?from\s+["']([^"']+)["']/gm;
  for (const file of files) {
    const src = readFileSync(file, "utf8");
    assert.equal(src.includes("node:crypto"), false, file);
    let match;
    const re = new RegExp(importLine);
    while ((match = re.exec(src)) !== null) {
      const spec = match[1];
      assert.equal(spec.includes("optimizer"), false, `${file} imports ${spec}`);
      assert.equal(spec.includes("scheduling"), false, `${file} imports ${spec}`);
      assert.equal(spec.includes("match-generation"), false, `${file} imports ${spec}`);
      assert.equal(spec.includes("draw-runtime"), false, `${file} imports ${spec}`);
      assert.equal(spec.endsWith("competition-core/index.js"), false, `${file} imports ${spec}`);
      assert.equal(spec.includes("node:crypto"), false, `${file} imports ${spec}`);
    }
  }
});

test("39. No root competition-core export of resource-conflict", () => {
  assert.equal(existsSync(CC_INDEX), true);
  const root = readFileSync(CC_INDEX, "utf8");
  assert.equal(root.includes("resource-conflict"), false);
  assert.equal(CORE14_IDENTITY.engineId.includes("resource-conflict"), true);
});

test("Identity strings are not silently trimmed or lower-cased", () => {
  const key = createCanonicalResourceKey({
    resourceKind: RESOURCE_KIND.PLAYER,
    resourceId: " AbC ",
    scopeType: SCOPE_TYPE.EVENT,
    scopeId: " Event-1 ",
  });
  assert.equal(key.resourceId, " AbC ");
  assert.equal(key.scopeId, " Event-1 ");
  const serialized = serializeCanonicalResourceKey(key);
  assert.equal(serialized.includes(" AbC "), true);
});

// ---------------------------------------------------------------------------
// Phase 1C-S certification
// ---------------------------------------------------------------------------

function nodeSha256Hex(text) {
  return createHash("sha256").update(String(text), "utf8").digest("hex");
}

test("1C-S: OCCUPANCY_ID_MISSING / SOURCE_MISSING / BOOLEAN_INVALID diagnostics", () => {
  const missingId = validateResourceOccupancy(baseOccupancy({ occupancyId: "" }));
  assert.equal(missingId.ok, false);
  assert.equal(missingId.diagnostics[0].code, INPUT_DIAGNOSTIC_CODE.OCCUPANCY_ID_MISSING);
  assert.equal(missingId.diagnostics[0].details.fieldName, "occupancyId");

  const missingSource = validateResourceOccupancy(baseOccupancy({ source: "" }));
  assert.equal(
    missingSource.diagnostics.some((d) => d.code === INPUT_DIAGNOSTIC_CODE.OCCUPANCY_SOURCE_MISSING),
    true
  );

  const badLocked = validateResourceOccupancy(baseOccupancy({ locked: "yes" }));
  const boolDiag = badLocked.diagnostics.find((d) => d.code === INPUT_DIAGNOSTIC_CODE.OCCUPANCY_BOOLEAN_INVALID);
  assert.ok(boolDiag);
  assert.equal(boolDiag.details.fieldName, "locked");
  assert.equal(boolDiag.details.expectedType, "boolean");
  assert.equal(boolDiag.details.actualType, "string");
});

test("1C-S: extensible source accepted; different sources do not conceal LAK duplicate", () => {
  const namespaced = "EXTERNAL_ADAPTER:venue-sync";
  const a = createResourceOccupancy(
    baseOccupancy({ occupancyId: "o1", assignmentId: "same-asg", source: namespaced })
  );
  const b = createResourceOccupancy(
    baseOccupancy({
      occupancyId: "o2",
      assignmentId: "same-asg",
      source: OCCUPANCY_SOURCE.CORE_12,
      startMs: 9000,
      endMs: 10000,
    })
  );
  assert.equal(a.source, namespaced);
  assert.equal(serializeLogicalAssignmentKeyV1(a), serializeLogicalAssignmentKeyV1(b));
  const dup = evaluateDuplicateIntegrity([a, b]);
  assert.equal(
    dup.diagnostics.some((d) => d.code === INPUT_DIAGNOSTIC_CODE.DUPLICATE_ASSIGNMENT),
    true
  );
});

test("1C-S: source not trimmed or lower-cased", () => {
  const occ = createResourceOccupancy(baseOccupancy({ source: " Adapter:X " }));
  assert.equal(occ.source, " Adapter:X ");
});

test("1C-S: SHA-256 empty UTF-8 vector", () => {
  const hex = hashUtf8Sha256Hex("");
  assert.equal(hex, "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
  assert.equal(hex, nodeSha256Hex(""));
});

test('1C-S: SHA-256 ASCII "abc" vector', () => {
  const hex = hashUtf8Sha256Hex("abc");
  assert.equal(hex, "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  assert.equal(hex, nodeSha256Hex("abc"));
});

test("1C-S: SHA-256 input longer than one block", () => {
  const long = "a".repeat(200);
  const hex = hashUtf8Sha256Hex(long);
  assert.equal(isValidSha256Hex(hex), true);
  assert.equal(hex, nodeSha256Hex(long));
});

test("1C-S: SHA-256 Unicode UTF-8 input", () => {
  const text = "pickleball 🏓 café";
  const hex = hashUtf8Sha256Hex(text);
  assert.equal(hex, nodeSha256Hex(text));
  assert.match(hex, /^[a-f0-9]{64}$/);
});

test("1C-S: SHA-256 over escaped canonical serialization", () => {
  const canonical = canonicalSerialize({ k: "a|b=c\\d", n: 1 });
  const hex = hashUtf8Sha256Hex(canonical);
  assert.equal(hex, nodeSha256Hex(canonical));
});

test("1C-S: SHA-256 repeated deterministic execution + lowercase 64 hex", () => {
  const a = hashUtf8Sha256Hex("CORE14_FP_V1");
  const b = hashUtf8Sha256Hex("CORE14_FP_V1");
  assert.equal(a, b);
  assert.equal(a, a.toLowerCase());
  assert.equal(a.length, 64);
  assert.equal(a, nodeSha256Hex("CORE14_FP_V1"));
});

test("1C-S: canonical serialization certification", () => {
  const s1 = canonicalSerialize({ z: true, a: null, s: "", n: 0 });
  const s2 = canonicalSerialize({ n: 0, s: "", a: null, z: true });
  assert.equal(s1, s2);
  assert.equal(s1, '{"a":null,"n":0,"s":"","z":true}');

  assert.equal(canonicalSerialize(null), "null");
  assert.equal(canonicalSerialize(true), "true");
  assert.equal(canonicalSerialize(false), "false");
  assert.equal(canonicalSerialize(""), '""');
  assert.equal(canonicalSerialize(0), "0");
  assert.notEqual(canonicalSerialize(null), canonicalSerialize(false));
  assert.notEqual(canonicalSerialize(""), canonicalSerialize(null));

  // Sequences preserve order.
  assert.equal(canonicalSerialize(["b", "a"]), '["b","a"]');
  // Identifier sets sort.
  assert.equal(
    canonicalSerializeIdentifierSet(["b", "a"]),
    canonicalSerializeIdentifierSet(["a", "b"])
  );

  assert.throws(() => canonicalSerialize(1.25), (err) => {
    assert.equal(err.code, INPUT_DIAGNOSTIC_CODE.UNSUPPORTED_CANONICAL_VALUE);
    assert.equal(err.details.reason, "NON_SAFE_INTEGER");
    assert.equal(typeof err.details.valuePath, "string");
    assert.equal(typeof err.details.valueType, "string");
    return true;
  });
  assert.throws(() => canonicalSerialize(Number.MAX_SAFE_INTEGER + 1), ResourceConflictContractError);
  assert.throws(() => canonicalSerialize(() => {}), ResourceConflictContractError);

  const withMeta = fingerprintValue({ id: "x", metadata: { hide: 1 } });
  const noMeta = fingerprintValue({ id: "x" });
  assert.equal(withMeta, noMeta);

  // Unicode hashed as UTF-8 (parity with node crypto over same serialized text).
  const uni = canonicalSerialize({ id: "đường" });
  assert.equal(hashUtf8Sha256Hex(uni), nodeSha256Hex(uni));

  // Locale-free comparator: compareUtf8Bytewise is used (smoke).
  assert.ok(compareUtf8Bytewise("a", "b") < 0);
});

test("1C-S: deterministic identity certification", () => {
  const keyA = serializeCanonicalResourceKey(baseKey());
  const keyB = serializeCanonicalResourceKey(baseKey());
  assert.equal(keyA, keyB);

  const oik1 = serializeOccupancyIndexKey({ resourceKey: baseKey(), occupancyId: "occ-9" });
  const oik2 = serializeOccupancyIndexKey({ resourceKey: baseKey(), occupancyId: "occ-9" });
  assert.equal(oik1, oik2);

  const lak1 = serializeLogicalAssignmentKeyV1({
    resourceKey: baseKey(),
    assignmentId: "asg",
    source: "A",
  });
  const lak2 = serializeLogicalAssignmentKeyV1({
    resourceKey: baseKey(),
    assignmentId: "asg",
    source: "B",
  });
  assert.equal(lak1, lak2);

  const fid1 = createFindingId({
    code: RESOURCE_FINDING_CODE.PLAYER_TIME_OVERLAP,
    resourceKeyCanonical: keyA,
    occupancyIds: ["o2", "o1"],
    violationStartMs: 10,
    violationEndMs: 20,
    reasonCode: "R",
    policyVersion: "v1",
  });
  const fid2 = createFindingId({
    code: RESOURCE_FINDING_CODE.PLAYER_TIME_OVERLAP,
    resourceKeyCanonical: keyA,
    occupancyIds: ["o1", "o2"],
    violationStartMs: 10,
    violationEndMs: 20,
    reasonCode: "R",
    policyVersion: "v1",
  });
  assert.equal(fid1, fid2);

  const fidTime = createFindingId({
    code: RESOURCE_FINDING_CODE.PLAYER_TIME_OVERLAP,
    resourceKeyCanonical: keyA,
    occupancyIds: ["o1", "o2"],
    violationStartMs: 11,
    violationEndMs: 20,
    reasonCode: "R",
    policyVersion: "v1",
  });
  assert.notEqual(fid1, fidTime);

  const changedKey = serializeCanonicalResourceKey(baseKey({ resourceId: "other" }));
  assert.notEqual(keyA, changedKey);
  const changedActivity = serializeLogicalAssignmentKeyV1({
    resourceKey: baseKey(),
    assignmentId: "other-asg",
  });
  assert.notEqual(lak1, changedActivity);

  const fp1 = fingerprintCore14Material({
    sortedFindingIds: ["f2", "f1"],
    planStatus: PLAN_STATUS.VALID,
    evaluationStatus: EVALUATION_STATUS.COMPLETED,
  });
  const fp2 = fingerprintCore14Material({
    evaluationStatus: EVALUATION_STATUS.COMPLETED,
    planStatus: PLAN_STATUS.VALID,
    sortedFindingIds: ["f2", "f1"],
  });
  assert.equal(fp1, fp2);
  assert.equal(fp1, fingerprintCore14Material({
    sortedFindingIds: ["f2", "f1"],
    planStatus: PLAN_STATUS.VALID,
    evaluationStatus: EVALUATION_STATUS.COMPLETED,
  }));
});

test("1C-S: all emitted input diagnostic codes are catalogued", () => {
  for (const code of INPUT_DIAGNOSTIC_CODE_VALUES) {
    const d = createInputDiagnostic({ code, message: "stable" });
    assert.equal(d.code, code);
  }
  assert.ok(INPUT_DIAGNOSTIC_CODE_VALUES.includes(INPUT_DIAGNOSTIC_CODE.OCCUPANCY_ID_MISSING));
  assert.ok(INPUT_DIAGNOSTIC_CODE_VALUES.includes(INPUT_DIAGNOSTIC_CODE.OCCUPANCY_SOURCE_MISSING));
  assert.ok(INPUT_DIAGNOSTIC_CODE_VALUES.includes(INPUT_DIAGNOSTIC_CODE.OCCUPANCY_BOOLEAN_INVALID));
  assert.ok(INPUT_DIAGNOSTIC_CODE_VALUES.includes(INPUT_DIAGNOSTIC_CODE.UNSUPPORTED_CANONICAL_VALUE));
  assert.equal(DOMAIN_CONTRACT_ERROR_CODE.UNKNOWN_FINDING_CODE, "UNKNOWN_FINDING_CODE");
});

test("1C-S: validate returns diagnostics; create throws same frozen code", () => {
  const invalid = baseOccupancy({ locked: 1 });
  const validated = validateResourceOccupancy(invalid);
  assert.equal(validated.ok, false);
  assert.equal(validated.diagnostics[0].code, INPUT_DIAGNOSTIC_CODE.OCCUPANCY_BOOLEAN_INVALID);
  assert.throws(() => createResourceOccupancy(invalid), (err) => {
    assert.equal(err instanceof ResourceConflictContractError, true);
    assert.equal(err.code, INPUT_DIAGNOSTIC_CODE.OCCUPANCY_BOOLEAN_INVALID);
    assert.ok(Array.isArray(err.details.diagnostics));
    assert.equal("timestamp" in err, false);
    return true;
  });
});

test("1C-S: architecture boundary re-certification after sync", () => {
  const files = listJsFiles(RC_ROOT);
  const forbiddenSpecs = [
    "optimizer",
    "scheduling",
    "match-generation",
    "draw-runtime",
    "venue-court",
    "tournament",
    "node:crypto",
  ];
  for (const file of files) {
    const src = readFileSync(file, "utf8");
    assert.equal(src.includes("Date.now"), false, file);
    assert.equal(src.includes("Math.random"), false, file);
    const re = /^\s*import\s+[\s\S]*?from\s+["']([^"']+)["']/gm;
    let match;
    while ((match = re.exec(src)) !== null) {
      const spec = match[1];
      for (const token of forbiddenSpecs) {
        if (token === "tournament") {
          assert.equal(spec.includes("tournament-engine"), false, `${file} -> ${spec}`);
        } else {
          assert.equal(spec.includes(token), false, `${file} -> ${spec}`);
        }
      }
    }
  }
  const root = readFileSync(CC_INDEX, "utf8");
  assert.equal(root.includes("resource-conflict"), false);
});
