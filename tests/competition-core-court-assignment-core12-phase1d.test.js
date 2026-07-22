/**
 * CORE-12 Phase 1D-B1 — availability contract foundation tests.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  CORE12_AVAILABILITY_PROVIDER_CONTRACT_V1,
  CORE12_AVAILABILITY_QUERY_V1,
  CORE12_ELIGIBILITY_SNAPSHOT_V1,
  CORE12_CANONICAL_COURT_DESCRIPTOR_V1,
  CORE12_AVAILABILITY_PROJECTION_V1,
  AVAILABILITY_BRIDGE_CODE,
  AVAILABILITY_SNAPSHOT_PROVIDER_METHODS,
  isAvailabilitySnapshotProvider,
  createExactAvailabilityQueryWindow,
  createAvailabilityEligibilityQuery,
  createEligibilitySnapshot,
  createCanonicalCourtDescriptor,
  computeAvailabilityQueryFingerprint,
  computeDerivedEligibilityFingerprint,
  projectEligibleCourtsToAvailableInputs,
  invokeAvailabilitySnapshotProvider,
  COURT_AVAILABILITY_STATUS,
} from "../src/features/competition-core/court-assignment/index.js";

import {
  createFixedEligibilitySnapshotProvider,
  createAsyncEligibilitySnapshotProvider,
} from "../src/features/competition-core/court-assignment/adapters/availability/testDoubles.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CA_ROOT = path.join(
  ROOT,
  "src/features/competition-core/court-assignment"
);
const ROOT_BARREL = path.join(ROOT, "src/features/competition-core/index.js");

const TZ = "Asia/Ho_Chi_Minh";
const WINDOW = Object.freeze({
  timezone: TZ,
  windowStart: "2026-07-22T03:00:00Z",
  windowEnd: "2026-07-22T04:00:00Z",
  civilDate: "2026-07-22",
  civilStartTime: "10:00",
  civilEndTime: "11:00",
});

function baseScope(overrides = {}) {
  return {
    tenantId: "tenant-1",
    clubId: "club-1",
    venueId: "venue-1",
    competitionId: "comp-1",
    ...overrides,
  };
}

function baseQuery(overrides = {}) {
  return createAvailabilityEligibilityQuery({
    ...baseScope(),
    ...WINDOW,
    adapterContractVersion: CORE12_AVAILABILITY_QUERY_V1,
    providerContractVersion: CORE12_AVAILABILITY_PROVIDER_CONTRACT_V1,
    ...overrides,
  });
}

function baseDescriptor(overrides = {}) {
  return createCanonicalCourtDescriptor({
    courtId: "court-a",
    tenantId: "tenant-1",
    clubId: "club-1",
    venueId: "venue-1",
    active: true,
    locked: false,
    capabilities: { courtType: "indoor" },
    priority: 10,
    sourceContractVersion: CORE12_CANONICAL_COURT_DESCRIPTOR_V1,
    descriptorAuthority: "TEST_DESCRIPTOR_AUTHORITY_V1",
    ...overrides,
  });
}

function baseSnapshot(overrides = {}) {
  const query = baseQuery();
  return createEligibilitySnapshot({
    schemaVersion: CORE12_ELIGIBILITY_SNAPSHOT_V1,
    tenantId: query.tenantId,
    clubId: query.clubId,
    venueId: query.venueId,
    competitionId: query.competitionId,
    timezone: query.timezone,
    windowStart: query.windowStart,
    windowEnd: query.windowEnd,
    civilDate: query.civilDate,
    civilStartTime: query.civilStartTime,
    civilEndTime: query.civilEndTime,
    eligibleCourtIds: ["court-a"],
    ineligibleCourts: [],
    sourceSnapshotId: null,
    sourceSnapshotVersion: null,
    sourceContractVersion: null,
    queryFingerprint: query.queryFingerprint,
    ...overrides,
  });
}

function listJsFiles(dir) {
  /** @type {string[]} */
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) out.push(...listJsFiles(full));
    else if (name.endsWith(".js")) out.push(full);
  }
  return out;
}

function importedSourceText(filePath) {
  return readFileSync(filePath, "utf8");
}

// ---------------------------------------------------------------------------
// Provider / invoke
// ---------------------------------------------------------------------------

test("01 provider contract method name is resolveEligibilitySnapshot", () => {
  assert.deepEqual(AVAILABILITY_SNAPSHOT_PROVIDER_METHODS, [
    "resolveEligibilitySnapshot",
  ]);
});

test("02 provider contract accepts Promise implementation", async () => {
  const query = baseQuery();
  const snap = baseSnapshot();
  const provider = createAsyncEligibilitySnapshotProvider(async () => snap);
  assert.equal(isAvailabilitySnapshotProvider(provider), true);
  const result = await invokeAvailabilitySnapshotProvider(provider, query);
  assert.equal(result.ok, true);
  assert.deepEqual(result.snapshot.eligibleCourtIds, ["court-a"]);
});

test("03 provider contract accepts synchronous implementation via async invoke", async () => {
  const query = baseQuery();
  const snap = baseSnapshot();
  const provider = createFixedEligibilitySnapshotProvider(snap);
  const result = await invokeAvailabilitySnapshotProvider(provider, query);
  assert.equal(result.ok, true);
  assert.equal(result.snapshot.derived, true);
});

test("04 missing provider fails closed", async () => {
  const result = await invokeAvailabilitySnapshotProvider(null, baseQuery());
  assert.equal(result.ok, false);
  assert.equal(result.code, AVAILABILITY_BRIDGE_CODE.MISSING_AVAILABILITY_PROVIDER);
});

test("05 rejected Promise produces structured failure", async () => {
  const provider = createAsyncEligibilitySnapshotProvider(async () => {
    throw Object.freeze({
      code: "UPSTREAM_FAIL",
      message: "boom",
    });
  });
  const result = await invokeAvailabilitySnapshotProvider(provider, baseQuery());
  assert.equal(result.ok, false);
  assert.equal(result.code, "UPSTREAM_FAIL");
});

test("06 malformed snapshot fails closed", async () => {
  const provider = createFixedEligibilitySnapshotProvider({
    eligibleCourtIds: "not-an-array",
  });
  const result = await invokeAvailabilitySnapshotProvider(provider, baseQuery());
  assert.equal(result.ok, false);
  assert.ok(
    result.code === AVAILABILITY_BRIDGE_CODE.MALFORMED_ELIGIBILITY_SNAPSHOT ||
      result.code === AVAILABILITY_BRIDGE_CODE.PROVIDER_RESULT_INVALID ||
      result.code === AVAILABILITY_BRIDGE_CODE.INVALID_QUERY_WINDOW ||
      result.code === AVAILABILITY_BRIDGE_CODE.INVALID_TIMEZONE
  );
});

// ---------------------------------------------------------------------------
// Empty / windows / timezone
// ---------------------------------------------------------------------------

test("07 successful empty snapshot is not unrestricted", () => {
  const empty = baseSnapshot({ eligibleCourtIds: [] });
  const projected = projectEligibleCourtsToAvailableInputs({
    queryWindow: WINDOW,
    eligibilitySnapshot: empty,
    courtDescriptors: [baseDescriptor()],
  });
  assert.equal(projected.ok, true);
  assert.equal(projected.courts.length, 0);
  assert.ok(
    projected.findings.some(
      (f) => f.code === AVAILABILITY_BRIDGE_CODE.EMPTY_ELIGIBILITY_RESULT
    )
  );
  assert.equal(
    projected.courts.some(
      (c) =>
        c.availabilityStatus === COURT_AVAILABILITY_STATUS.AVAILABLE &&
        (c.availabilityIntervals || []).length === 0
    ),
    false
  );
});

test("08 exact query scope propagation", () => {
  const query = baseQuery();
  assert.equal(query.tenantId, "tenant-1");
  assert.equal(query.clubId, "club-1");
  assert.equal(query.venueId, "venue-1");
  assert.equal(query.competitionId, "comp-1");
});

test("09 exact absolute window propagation", () => {
  const window = createExactAvailabilityQueryWindow(WINDOW);
  assert.equal(window.windowStart, WINDOW.windowStart);
  assert.equal(window.windowEnd, WINDOW.windowEnd);
});

test("10 valid IANA timezone accepted", () => {
  assert.equal(createExactAvailabilityQueryWindow(WINDOW).timezone, TZ);
});

test("11 timezone-less input rejected", () => {
  assert.throws(
    () =>
      createExactAvailabilityQueryWindow({
        ...WINDOW,
        timezone: null,
      }),
    (err) =>
      err.code === AVAILABILITY_BRIDGE_CODE.INVALID_TIMEZONE ||
      err.code === "TIMEZONE_REQUIRED"
  );
});

test("12 invalid timezone rejected", () => {
  assert.throws(
    () =>
      createExactAvailabilityQueryWindow({
        ...WINDOW,
        timezone: "Not/A_Real_Zone",
      }),
    (err) => err.code === AVAILABILITY_BRIDGE_CODE.INVALID_TIMEZONE
  );
});

test("13 reversed window rejected", () => {
  assert.throws(
    () =>
      createExactAvailabilityQueryWindow({
        ...WINDOW,
        windowStart: WINDOW.windowEnd,
        windowEnd: WINDOW.windowStart,
        civilStartTime: "11:00",
        civilEndTime: "10:00",
      }),
    (err) =>
      err.code === AVAILABILITY_BRIDGE_CODE.INVALID_QUERY_WINDOW ||
      err.code === AVAILABILITY_BRIDGE_CODE.UNSUPPORTED_OVERNIGHT_WINDOW
  );
});

test("14 equal endpoints rejected", () => {
  assert.throws(
    () =>
      createExactAvailabilityQueryWindow({
        ...WINDOW,
        windowEnd: WINDOW.windowStart,
        civilEndTime: "10:00",
      }),
    (err) =>
      err.code === AVAILABILITY_BRIDGE_CODE.INVALID_QUERY_WINDOW ||
      err.code === AVAILABILITY_BRIDGE_CODE.UNSUPPORTED_OVERNIGHT_WINDOW
  );
});

test("15 cross-midnight civil window rejected", () => {
  assert.throws(
    () =>
      createExactAvailabilityQueryWindow({
        timezone: TZ,
        windowStart: "2026-07-22T16:00:00Z",
        windowEnd: "2026-07-22T18:00:00Z",
        civilDate: "2026-07-22",
        civilStartTime: "23:00",
        civilEndTime: "01:00",
      }),
    (err) =>
      err.code === AVAILABILITY_BRIDGE_CODE.UNSUPPORTED_OVERNIGHT_WINDOW ||
      err.code === AVAILABILITY_BRIDGE_CODE.INVALID_QUERY_WINDOW
  );
});

test("16 DST-invalid civil time rejected by canonical civilTime rule", () => {
  // America/New_York spring-forward gap approx 2026-03-08 02:30 local
  assert.throws(
    () =>
      createExactAvailabilityQueryWindow({
        timezone: "America/New_York",
        windowStart: "2026-03-08T07:30:00Z",
        windowEnd: "2026-03-08T08:30:00Z",
        civilDate: "2026-03-08",
        civilStartTime: "02:30",
        civilEndTime: "03:30",
      }),
    (err) =>
      err.code === AVAILABILITY_BRIDGE_CODE.INVALID_QUERY_WINDOW ||
      err.code === AVAILABILITY_BRIDGE_CODE.INVALID_TIMEZONE
  );
});

// ---------------------------------------------------------------------------
// Projection
// ---------------------------------------------------------------------------

test("17 one eligible ID plus matching descriptor projects one court", () => {
  const result = projectEligibleCourtsToAvailableInputs({
    queryWindow: WINDOW,
    eligibilitySnapshot: baseSnapshot(),
    courtDescriptors: [baseDescriptor()],
  });
  assert.equal(result.ok, true);
  assert.equal(result.courts.length, 1);
  assert.equal(result.courts[0].courtId, "court-a");
  assert.equal(
    result.courts[0].availabilityStatus,
    COURT_AVAILABILITY_STATUS.AVAILABLE
  );
});

test("18 projected interval equals exact query window", () => {
  const result = projectEligibleCourtsToAvailableInputs({
    queryWindow: WINDOW,
    eligibilitySnapshot: baseSnapshot(),
    courtDescriptors: [baseDescriptor()],
  });
  assert.equal(result.ok, true);
  assert.deepEqual(result.courts[0].availabilityIntervals, [
    { start: WINDOW.windowStart, end: WINDOW.windowEnd, _startMs: result.courts[0].availabilityIntervals[0]._startMs, _endMs: result.courts[0].availabilityIntervals[0]._endMs },
  ]);
  assert.equal(result.courts[0].availabilityIntervals.length, 1);
  assert.equal(result.courts[0].availabilityIntervals[0].start, WINDOW.windowStart);
  assert.equal(result.courts[0].availabilityIntervals[0].end, WINDOW.windowEnd);
});

test("19 no interval outside query window", () => {
  const result = projectEligibleCourtsToAvailableInputs({
    queryWindow: WINDOW,
    eligibilitySnapshot: baseSnapshot(),
    courtDescriptors: [baseDescriptor()],
  });
  assert.equal(result.ok, true);
  for (const iv of result.courts[0].availabilityIntervals) {
    assert.ok(iv._startMs >= Date.parse(WINDOW.windowStart));
    assert.ok(iv._endMs <= Date.parse(WINDOW.windowEnd));
  }
});

test("20 eligible ID without descriptor rejected", () => {
  const result = projectEligibleCourtsToAvailableInputs({
    queryWindow: WINDOW,
    eligibilitySnapshot: baseSnapshot({ eligibleCourtIds: ["court-a", "court-b"] }),
    courtDescriptors: [baseDescriptor()],
  });
  assert.equal(result.ok, false);
  assert.equal(
    result.code,
    AVAILABILITY_BRIDGE_CODE.MISSING_CANONICAL_COURT_DESCRIPTOR
  );
});

test("21 descriptor without eligibility does not project", () => {
  const result = projectEligibleCourtsToAvailableInputs({
    queryWindow: WINDOW,
    eligibilitySnapshot: baseSnapshot({ eligibleCourtIds: ["court-a"] }),
    courtDescriptors: [
      baseDescriptor(),
      baseDescriptor({ courtId: "court-b", priority: 1 }),
    ],
  });
  assert.equal(result.ok, true);
  assert.equal(result.courts.length, 1);
  assert.equal(result.courts[0].courtId, "court-a");
  assert.ok(
    result.findings.some((f) =>
      String(f.message || "").includes("court-b")
    )
  );
});

test("22 duplicate eligible IDs fail closed", () => {
  const query = baseQuery();
  assert.throws(
    () =>
      createEligibilitySnapshot({
        schemaVersion: CORE12_ELIGIBILITY_SNAPSHOT_V1,
        ...baseScope(),
        ...WINDOW,
        eligibleCourtIds: ["court-a", "court-a"],
        ineligibleCourts: [],
        sourceSnapshotId: null,
        sourceSnapshotVersion: null,
        sourceContractVersion: null,
        queryFingerprint: query.queryFingerprint,
      }),
    (err) => err.code === AVAILABILITY_BRIDGE_CODE.DUPLICATE_ELIGIBLE_COURT_ID
  );
});

test("23 duplicate descriptors fail closed", () => {
  const result = projectEligibleCourtsToAvailableInputs({
    queryWindow: WINDOW,
    eligibilitySnapshot: baseSnapshot(),
    courtDescriptors: [baseDescriptor(), baseDescriptor()],
  });
  assert.equal(result.ok, false);
  assert.equal(
    result.code,
    AVAILABILITY_BRIDGE_CODE.DUPLICATE_CANONICAL_COURT_DESCRIPTOR
  );
});

test("24 cross-venue descriptor rejected", () => {
  const result = projectEligibleCourtsToAvailableInputs({
    queryWindow: WINDOW,
    eligibilitySnapshot: baseSnapshot(),
    courtDescriptors: [baseDescriptor({ venueId: "venue-other" })],
  });
  assert.equal(result.ok, false);
  assert.equal(result.code, AVAILABILITY_BRIDGE_CODE.COURT_SCOPE_MISMATCH);
});

test("25 cross-club descriptor rejected", () => {
  const result = projectEligibleCourtsToAvailableInputs({
    queryWindow: WINDOW,
    eligibilitySnapshot: baseSnapshot(),
    courtDescriptors: [baseDescriptor({ clubId: "club-other" })],
  });
  assert.equal(result.ok, false);
  assert.equal(result.code, AVAILABILITY_BRIDGE_CODE.COURT_SCOPE_MISMATCH);
});

test("26 disabled descriptor rejected", () => {
  const result = projectEligibleCourtsToAvailableInputs({
    queryWindow: WINDOW,
    eligibilitySnapshot: baseSnapshot(),
    courtDescriptors: [baseDescriptor({ active: false })],
  });
  assert.equal(result.ok, false);
  assert.equal(result.code, AVAILABILITY_BRIDGE_CODE.COURT_NOT_ENABLED);
});

test("27 missing capability when required fails closed", () => {
  const result = projectEligibleCourtsToAvailableInputs({
    queryWindow: WINDOW,
    eligibilitySnapshot: baseSnapshot(),
    courtDescriptors: [baseDescriptor({ capabilities: {} })],
    requiredCapabilities: ["indoor"],
  });
  assert.equal(result.ok, false);
  assert.equal(result.code, AVAILABILITY_BRIDGE_CODE.COURT_CAPABILITY_UNKNOWN);
});

test("28 capability mismatch fails closed", () => {
  const result = projectEligibleCourtsToAvailableInputs({
    queryWindow: WINDOW,
    eligibilitySnapshot: baseSnapshot(),
    courtDescriptors: [baseDescriptor({ capabilities: { courtType: "outdoor" } })],
    requiredCapabilities: ["indoor"],
  });
  assert.equal(result.ok, false);
  assert.equal(result.code, AVAILABILITY_BRIDGE_CODE.COURT_CAPABILITY_MISMATCH);
});

test("29 no capability requirement permits projection without inventing caps", () => {
  const result = projectEligibleCourtsToAvailableInputs({
    queryWindow: WINDOW,
    eligibilitySnapshot: baseSnapshot(),
    courtDescriptors: [baseDescriptor({ capabilities: {} })],
  });
  assert.equal(result.ok, true);
  assert.deepEqual(result.courts[0].capabilities, {});
});

// ---------------------------------------------------------------------------
// Snapshot / fingerprints / determinism
// ---------------------------------------------------------------------------

test("30 source snapshot fields remain null when absent", () => {
  const snap = baseSnapshot();
  assert.equal(snap.sourceSnapshotId, null);
  assert.equal(snap.sourceSnapshotVersion, null);
  assert.equal(snap.sourceContractVersion, null);
});

test("31 source snapshot identity is never fabricated by projection", () => {
  const result = projectEligibleCourtsToAvailableInputs({
    queryWindow: WINDOW,
    eligibilitySnapshot: baseSnapshot(),
    courtDescriptors: [baseDescriptor()],
  });
  assert.equal(result.ok, true);
  assert.equal(result.sourceSnapshotId, null);
  assert.equal(result.sourceSnapshotVersion, null);
});

test("32 query fingerprint stability", () => {
  const a = baseQuery();
  const b = baseQuery({
    requestedCourtIds: ["z", "a"],
  });
  const c = baseQuery({
    requestedCourtIds: ["a", "z"],
  });
  assert.equal(a.queryFingerprint, computeAvailabilityQueryFingerprint(a));
  assert.equal(b.queryFingerprint, c.queryFingerprint);
});

test("33 eligibility fingerprint stability", () => {
  const a = baseSnapshot({ eligibleCourtIds: ["court-b", "court-a"] });
  const b = baseSnapshot({ eligibleCourtIds: ["court-a", "court-b"] });
  assert.equal(a.derivedEligibilityFingerprint, b.derivedEligibilityFingerprint);
  assert.equal(
    a.derivedEligibilityFingerprint,
    computeDerivedEligibilityFingerprint(a)
  );
});

test("34 availability fingerprint stability", () => {
  const a = projectEligibleCourtsToAvailableInputs({
    queryWindow: WINDOW,
    eligibilitySnapshot: baseSnapshot(),
    courtDescriptors: [baseDescriptor()],
  });
  const b = projectEligibleCourtsToAvailableInputs({
    queryWindow: WINDOW,
    eligibilitySnapshot: baseSnapshot(),
    courtDescriptors: [baseDescriptor()],
  });
  assert.equal(a.ok, true);
  assert.equal(a.derivedAvailabilityFingerprint, b.derivedAvailabilityFingerprint);
});

test("35 input permutation invariance for descriptors order", () => {
  const snap = baseSnapshot({ eligibleCourtIds: ["court-a", "court-b"] });
  const d1 = baseDescriptor({ courtId: "court-a", priority: 2 });
  const d2 = baseDescriptor({ courtId: "court-b", priority: 1 });
  const a = projectEligibleCourtsToAvailableInputs({
    queryWindow: WINDOW,
    eligibilitySnapshot: snap,
    courtDescriptors: [d1, d2],
  });
  const b = projectEligibleCourtsToAvailableInputs({
    queryWindow: WINDOW,
    eligibilitySnapshot: snap,
    courtDescriptors: [d2, d1],
  });
  assert.equal(a.ok, true);
  assert.equal(a.derivedAvailabilityFingerprint, b.derivedAvailabilityFingerprint);
  assert.deepEqual(
    a.courts.map((c) => c.courtId),
    b.courts.map((c) => c.courtId)
  );
});

test("36 stable output ordering by courtId", () => {
  const result = projectEligibleCourtsToAvailableInputs({
    queryWindow: WINDOW,
    eligibilitySnapshot: baseSnapshot({
      eligibleCourtIds: ["court-b", "court-a"],
    }),
    courtDescriptors: [
      baseDescriptor({ courtId: "court-b" }),
      baseDescriptor({ courtId: "court-a" }),
    ],
  });
  assert.equal(result.ok, true);
  assert.deepEqual(
    result.courts.map((c) => c.courtId),
    ["court-a", "court-b"]
  );
});

test("37 no mutation of caller inputs", () => {
  const descriptors = [
    {
      courtId: "court-a",
      tenantId: "tenant-1",
      clubId: "club-1",
      venueId: "venue-1",
      active: true,
      locked: false,
      capabilities: { courtType: "indoor" },
      priority: 10,
      sourceContractVersion: CORE12_CANONICAL_COURT_DESCRIPTOR_V1,
    },
  ];
  const snapPartial = {
    schemaVersion: CORE12_ELIGIBILITY_SNAPSHOT_V1,
    ...baseScope(),
    ...WINDOW,
    eligibleCourtIds: ["court-a"],
    ineligibleCourts: [],
    sourceSnapshotId: null,
    sourceSnapshotVersion: null,
    sourceContractVersion: null,
    queryFingerprint: baseQuery().queryFingerprint,
  };
  const beforeDesc = JSON.stringify(descriptors);
  const beforeSnap = JSON.stringify(snapPartial);
  const result = projectEligibleCourtsToAvailableInputs({
    queryWindow: WINDOW,
    eligibilitySnapshot: snapPartial,
    courtDescriptors: descriptors,
  });
  assert.equal(result.ok, true);
  assert.equal(JSON.stringify(descriptors), beforeDesc);
  assert.equal(JSON.stringify(snapPartial), beforeSnap);
});

// ---------------------------------------------------------------------------
// Import / export audits
// ---------------------------------------------------------------------------

test("38 no Date.now Math.random or UUID in Phase 1D-B1 availability files", () => {
  const dirs = [
    path.join(CA_ROOT, "adapters", "availability"),
    path.join(CA_ROOT, "contracts"),
  ];
  const files = dirs.flatMap((d) => listJsFiles(d)).filter((f) => {
    const base = path.basename(f);
    return (
      base.includes("availability") ||
      base.includes("Eligibility") ||
      base.includes("eligibility") ||
      base.includes("CanonicalCourt") ||
      base.includes("exactAvailability") ||
      base.includes("projectEligible") ||
      base.includes("invokeAvailability")
    );
  });
  // Also include provider port
  files.push(path.join(CA_ROOT, "ports", "availabilitySnapshotProvider.js"));
  for (const f of files) {
    const src = importedSourceText(f);
    assert.doesNotMatch(src, /\bDate\.now\b/);
    assert.doesNotMatch(src, /\bMath\.random\b/);
    assert.doesNotMatch(src, /\brandomUUID\b/);
    assert.doesNotMatch(src, /\buuid\b/i);
  }
});

test("39 no Venue runtime import in Phase 1D-B1 foundation files", () => {
  const files = [
    ...listJsFiles(path.join(CA_ROOT, "adapters", "availability")),
    path.join(CA_ROOT, "ports", "availabilitySnapshotProvider.js"),
    path.join(CA_ROOT, "contracts", "availabilityBridgeCodes.js"),
    path.join(CA_ROOT, "contracts", "availabilityEligibilityQuery.js"),
    path.join(CA_ROOT, "contracts", "availabilityFingerprints.js"),
    path.join(CA_ROOT, "contracts", "eligibilitySnapshot.js"),
    path.join(CA_ROOT, "contracts", "canonicalCourtDescriptor.js"),
    path.join(CA_ROOT, "contracts", "exactAvailabilityQueryWindow.js"),
  ];
  for (const f of files) {
    const src = importedSourceText(f);
    assert.doesNotMatch(src, /venue-court/);
    assert.doesNotMatch(src, /getCompetitionCourtAvailability/);
    assert.doesNotMatch(src, /getCourtAvailability/);
    assert.doesNotMatch(src, /clubStorage/);
    assert.doesNotMatch(src, /supabase/i);
    assert.doesNotMatch(src, /tournament-engine/);
    assert.doesNotMatch(src, /resource-conflict/);
    assert.doesNotMatch(src, /scheduling\//);
  }
});

test("40 production barrel does not export test-only eligibility providers", async () => {
  const prod = await import(
    "../src/features/competition-core/court-assignment/index.js"
  );
  assert.equal(prod.createFixedEligibilitySnapshotProvider, undefined);
  assert.equal(prod.createAsyncEligibilitySnapshotProvider, undefined);
  assert.equal(typeof prod.projectEligibleCourtsToAvailableInputs, "function");
  assert.equal(typeof prod.invokeAvailabilitySnapshotProvider, "function");
  assert.equal(typeof prod.createEligibilitySnapshot, "function");
  assert.equal(typeof prod.createCanonicalCourtDescriptor, "function");
  assert.equal(prod.CORE12_AVAILABILITY_PROJECTION_V1, CORE12_AVAILABILITY_PROJECTION_V1);
});

test("41 no root Competition Core export of Phase 1D-B1 surface", () => {
  if (!statSync(ROOT_BARREL, { throwIfNoEntry: false })) {
    assert.ok(true);
    return;
  }
  const src = importedSourceText(ROOT_BARREL);
  assert.doesNotMatch(src, /projectEligibleCourtsToAvailableInputs/);
  assert.doesNotMatch(src, /AvailabilitySnapshotProvider/);
  assert.doesNotMatch(src, /createEligibilitySnapshot/);
});

test("42 locked descriptor fails closed with COURT_DESCRIPTOR_LOCKED", () => {
  const result = projectEligibleCourtsToAvailableInputs({
    queryWindow: WINDOW,
    eligibilitySnapshot: baseSnapshot(),
    courtDescriptors: [baseDescriptor({ locked: true })],
  });
  assert.equal(result.ok, false);
  assert.equal(result.code, AVAILABILITY_BRIDGE_CODE.COURT_DESCRIPTOR_LOCKED);
});

test("43 invoke rejects scope-mismatched provider snapshot", async () => {
  const query = baseQuery();
  const bad = {
    ...baseSnapshot(),
    clubId: "club-other",
    derivedEligibilityFingerprint: undefined,
  };
  // Rebuild fingerprint will happen inside createEligibilitySnapshot via invoke merge;
  // force provider to return wrong club with matching window by crafting after query.
  const provider = createFixedEligibilitySnapshotProvider((q) => ({
    schemaVersion: CORE12_ELIGIBILITY_SNAPSHOT_V1,
    tenantId: q.tenantId,
    clubId: "club-other",
    venueId: q.venueId,
    competitionId: q.competitionId,
    timezone: q.timezone,
    windowStart: q.windowStart,
    windowEnd: q.windowEnd,
    civilDate: q.civilDate,
    civilStartTime: q.civilStartTime,
    civilEndTime: q.civilEndTime,
    eligibleCourtIds: [],
    ineligibleCourts: [],
    sourceSnapshotId: null,
    sourceSnapshotVersion: null,
    sourceContractVersion: null,
    queryFingerprint: q.queryFingerprint,
  }));
  const result = await invokeAvailabilitySnapshotProvider(provider, query);
  assert.equal(result.ok, false);
  assert.equal(result.code, AVAILABILITY_BRIDGE_CODE.ELIGIBILITY_SCOPE_MISMATCH);
  void bad;
});

// ---------------------------------------------------------------------------
// 1D-B1-C certification extras
// ---------------------------------------------------------------------------

test("44 all-ineligible snapshot is empty eligibility evidence (not unrestricted)", () => {
  const result = projectEligibleCourtsToAvailableInputs({
    queryWindow: WINDOW,
    eligibilitySnapshot: baseSnapshot({
      eligibleCourtIds: [],
      ineligibleCourts: [
        { courtId: "court-a", reasons: ["booked"], codes: ["BOOKING"] },
      ],
    }),
    courtDescriptors: [baseDescriptor()],
  });
  assert.equal(result.ok, true);
  assert.equal(result.courts.length, 0);
  assert.ok(
    result.findings.some(
      (f) => f.code === AVAILABILITY_BRIDGE_CODE.EMPTY_ELIGIBILITY_RESULT
    )
  );
});

test("45 missing snapshot fails closed", () => {
  const result = projectEligibleCourtsToAvailableInputs({
    queryWindow: WINDOW,
    courtDescriptors: [baseDescriptor()],
  });
  assert.equal(result.ok, false);
  assert.equal(
    result.code,
    AVAILABILITY_BRIDGE_CODE.MALFORMED_ELIGIBILITY_SNAPSHOT
  );
});

test("46 null snapshot fails closed", () => {
  const result = projectEligibleCourtsToAvailableInputs({
    queryWindow: WINDOW,
    eligibilitySnapshot: null,
    courtDescriptors: [baseDescriptor()],
  });
  assert.equal(result.ok, false);
});

test("47 provider throw Error becomes structured PROVIDER_REJECTED or code", async () => {
  const provider = createAsyncEligibilitySnapshotProvider(async () => {
    throw new Error("network down");
  });
  const result = await invokeAvailabilitySnapshotProvider(provider, baseQuery());
  assert.equal(result.ok, false);
  assert.equal(result.code, AVAILABILITY_BRIDGE_CODE.PROVIDER_REJECTED);
});

test("48 invalid query via invoke fails before provider call", async () => {
  let called = 0;
  const provider = createFixedEligibilitySnapshotProvider(() => {
    called += 1;
    return baseSnapshot();
  });
  const result = await invokeAvailabilitySnapshotProvider(provider, {
    ...baseScope(),
    ...WINDOW,
    timezone: "",
  });
  assert.equal(result.ok, false);
  assert.equal(called, 0);
  assert.ok(
    result.code === AVAILABILITY_BRIDGE_CODE.INVALID_TIMEZONE ||
      result.code === AVAILABILITY_BRIDGE_CODE.INVALID_AVAILABILITY_QUERY
  );
});

test("49 unsupported overnight rejected at window factory", () => {
  assert.throws(
    () =>
      createExactAvailabilityQueryWindow({
        timezone: TZ,
        windowStart: "2026-07-22T16:00:00Z",
        windowEnd: "2026-07-23T01:00:00Z",
        civilDate: "2026-07-22",
        civilStartTime: "23:00",
        civilEndTime: "08:00",
      }),
    (err) =>
      err.code === AVAILABILITY_BRIDGE_CODE.UNSUPPORTED_OVERNIGHT_WINDOW ||
      err.code === AVAILABILITY_BRIDGE_CODE.INVALID_QUERY_WINDOW
  );
});

test("50 metadata order does not affect availability fingerprint (metadata excluded)", () => {
  const a = projectEligibleCourtsToAvailableInputs({
    queryWindow: WINDOW,
    eligibilitySnapshot: baseSnapshot(),
    courtDescriptors: [
      baseDescriptor({ metadata: { a: 1, b: 2 } }),
    ],
  });
  const b = projectEligibleCourtsToAvailableInputs({
    queryWindow: WINDOW,
    eligibilitySnapshot: baseSnapshot(),
    courtDescriptors: [
      baseDescriptor({ metadata: { b: 2, a: 1 } }),
    ],
  });
  assert.equal(a.ok, true);
  assert.equal(
    a.derivedAvailabilityFingerprint,
    b.derivedAvailabilityFingerprint
  );
});

test("51 capability array order is fingerprint-invariant", () => {
  const a = projectEligibleCourtsToAvailableInputs({
    queryWindow: WINDOW,
    eligibilitySnapshot: baseSnapshot(),
    courtDescriptors: [baseDescriptor({ capabilities: ["indoor", "premium"] })],
  });
  const b = projectEligibleCourtsToAvailableInputs({
    queryWindow: WINDOW,
    eligibilitySnapshot: baseSnapshot(),
    courtDescriptors: [baseDescriptor({ capabilities: ["premium", "indoor"] })],
  });
  assert.equal(a.ok, true);
  assert.equal(
    a.derivedAvailabilityFingerprint,
    b.derivedAvailabilityFingerprint
  );
});

test("52 descriptor without authority declaration fails closed", () => {
  assert.throws(
    () =>
      createCanonicalCourtDescriptor({
        courtId: "court-a",
        tenantId: "tenant-1",
        clubId: "club-1",
        venueId: "venue-1",
        active: true,
      }),
    (err) => err.code === AVAILABILITY_BRIDGE_CODE.MISSING_DESCRIPTOR_AUTHORITY
  );
});

test("53 structural validation is not independently verified inventory authority", () => {
  const d = baseDescriptor({
    descriptorAuthority: "CALLER_DECLARED_ONLY_V1",
    sourceContractVersion: "CALLER_DECLARED_ONLY_V1",
  });
  assert.equal(d.descriptorAuthority, "CALLER_DECLARED_ONLY_V1");
  // Shape-valid ≠ Owner-verified inventory provenance (documented contract).
  assert.notEqual(d.descriptorAuthority, "VENUE_INVENTORY_VERIFIED");
});

test("54 AVAILABILITY_BRIDGE_CODE inventory is complete and unique", () => {
  const values = Object.values(AVAILABILITY_BRIDGE_CODE);
  assert.equal(new Set(values).size, values.length);
  assert.ok(values.includes("COURT_DESCRIPTOR_LOCKED"));
  assert.ok(values.includes("MISSING_DESCRIPTOR_AUTHORITY"));
  assert.ok(values.includes("EMPTY_ELIGIBILITY_RESULT"));
});

test("55 production availability barrel does not export test doubles", async () => {
  const avail = await import(
    "../src/features/competition-core/court-assignment/adapters/availability/index.js"
  );
  assert.equal(avail.createFixedEligibilitySnapshotProvider, undefined);
  assert.equal(avail.createAsyncEligibilitySnapshotProvider, undefined);
  assert.equal(typeof avail.projectEligibleCourtsToAvailableInputs, "function");
  assert.equal(typeof avail.invokeAvailabilitySnapshotProvider, "function");
});

test("56 queryFingerprint mismatch on projection fails closed", () => {
  const result = projectEligibleCourtsToAvailableInputs({
    queryWindow: WINDOW,
    queryFingerprint: "deadbeef",
    eligibilitySnapshot: baseSnapshot(),
    courtDescriptors: [baseDescriptor()],
  });
  assert.equal(result.ok, false);
  assert.equal(result.code, AVAILABILITY_BRIDGE_CODE.QUERY_FINGERPRINT_MISMATCH);
});
