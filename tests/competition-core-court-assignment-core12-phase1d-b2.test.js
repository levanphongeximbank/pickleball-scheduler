/**
 * CORE-12 Phase 1D-B2 Option A — injected Venue provider tests + architecture locks.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  AVAILABILITY_BRIDGE_CODE,
  CORE12_COURT_ASSIGNMENT_SCHEMA_V1,
  CORE12_POLICY_VERSION,
  CORE12_COMPARATOR_VERSION,
  CORE12_COURT_SELECTION_STRATEGY_VERSION,
  CORE12_EXPECTED_VENUE_DESCRIPTOR_AUTHORITY,
  CORE12_EXPECTED_VENUE_SOURCE_CONTRACT_VERSION,
  CORE12_VENUE_AVAILABILITY_BRIDGE_V1,
  assignCourtsDeterministic,
  createAvailabilityEligibilityQuery,
  createInjectedVenueCourtAvailabilityProvider,
  createCourtAssignmentPolicy,
  normalizeVenueDescriptorEnvelope,
  projectEligibleCourtsToAvailableInputs,
  isVenueEligibilityProvider,
  isCanonicalCourtDescriptorProvider,
} from "../src/features/competition-core/court-assignment/index.js";

import {
  createFixedVenueEligibilityProvider,
  createFixedCanonicalCourtDescriptorProvider,
} from "../src/features/competition-core/court-assignment/adapters/availability/testDoubles.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CA_ROOT = path.join(
  ROOT,
  "src/features/competition-core/court-assignment"
);
const AVAIL_ROOT = path.join(CA_ROOT, "adapters/availability");
const ROOT_BARREL = path.join(ROOT, "src/features/competition-core/index.js");
const CA_INDEX = path.join(CA_ROOT, "index.js");
const AVAIL_INDEX = path.join(AVAIL_ROOT, "index.js");
const DOC = path.join(
  ROOT,
  "docs/competition-engine/core-12/10_PHASE_1D_B2_VENUE_PROVIDER.md"
);

const TZ = "Asia/Ho_Chi_Minh";
const WINDOW = Object.freeze({
  timezone: TZ,
  windowStart: "2026-07-22T03:00:00Z",
  windowEnd: "2026-07-22T04:00:00Z",
  civilDate: "2026-07-22",
  civilStartTime: "10:00",
  civilEndTime: "11:00",
});

function walkJsFiles(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walkJsFiles(full, out);
    else if (name.endsWith(".js")) out.push(full);
  }
  return out;
}

function read(p) {
  return readFileSync(p, "utf8");
}

function assertNoMatch(source, pattern, label) {
  assert.equal(pattern.test(source), false, `${label} must not match ${pattern}`);
}

function baseScope(overrides = {}) {
  return {
    tenantId: "venue-1",
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
    ...overrides,
  });
}

function baseCourtRow(overrides = {}) {
  return {
    courtId: "court-a",
    tenantId: "venue-1",
    clubId: "club-1",
    venueId: "venue-1",
    active: true,
    locked: false,
    capabilities: [],
    priority: 10,
    ...overrides,
  };
}

function baseEnvelope(overrides = {}) {
  return {
    tenantId: "venue-1",
    clubId: "club-1",
    venueId: "venue-1",
    descriptorAuthority: CORE12_EXPECTED_VENUE_DESCRIPTOR_AUTHORITY,
    sourceContractVersion: CORE12_EXPECTED_VENUE_SOURCE_CONTRACT_VERSION,
    sourceSnapshotId: null,
    sourceSnapshotVersion: null,
    courts: [baseCourtRow()],
    diagnostics: { excludedCourts: [] },
    ...overrides,
  };
}

function baseEligibility(overrides = {}) {
  return {
    tenantId: "venue-1",
    clubId: "club-1",
    venueId: "venue-1",
    date: WINDOW.civilDate,
    startTime: WINDOW.civilStartTime,
    endTime: WINDOW.civilEndTime,
    availableCourtIds: ["court-a"],
    unavailableCourts: [],
    ...overrides,
  };
}

function createBridge(eligibility, descriptors, opts = {}) {
  return createInjectedVenueCourtAvailabilityProvider({
    eligibilityProvider: isVenueEligibilityProvider(eligibility)
      ? eligibility
      : createFixedVenueEligibilityProvider(eligibility, opts.eligibilityAsync ? { async: true } : {}),
    descriptorProvider: isCanonicalCourtDescriptorProvider(descriptors)
      ? descriptors
      : createFixedCanonicalCourtDescriptorProvider(
          descriptors,
          opts.descriptorAsync ? { async: true } : {}
        ),
  });
}

// ---------------------------------------------------------------------------
// Documentation / Option A clearance
// ---------------------------------------------------------------------------

test("01 doc records Option A cleared and preserves historical blocker", () => {
  assert.equal(existsSync(DOC), true);
  const text = read(DOC);
  assert.match(text, /OPTION A/);
  assert.match(text, /BLOCKED_AUTHORITATIVE_DESCRIPTOR_PUBLIC_CONTRACT/);
  assert.match(text, /resolved/i);
  assert.match(text, /Phase 3B/);
  assert.match(text, /Phase 3C/);
  assert.match(text, /createInjectedVenueCourtAvailabilityProvider/);
  assert.match(text, /normalizeVenueDescriptorEnvelope/);
});

// ---------------------------------------------------------------------------
// Successful integration
// ---------------------------------------------------------------------------

test("02 exact descriptor projection + envelope authority copy", async () => {
  const bridge = createBridge(baseEligibility(), baseEnvelope());
  const result = await bridge.resolveAvailableCourtsProjection(baseQuery());
  assert.equal(result.ok, true);
  assert.equal(result.courts.length, 1);
  assert.equal(result.courts[0].courtId, "court-a");
  assert.equal(result.courtDescriptors[0].descriptorAuthority, CORE12_EXPECTED_VENUE_DESCRIPTOR_AUTHORITY);
  assert.equal(
    result.courtDescriptors[0].sourceContractVersion,
    CORE12_EXPECTED_VENUE_SOURCE_CONTRACT_VERSION
  );
  assert.equal(result.sourceSnapshotId, null);
  assert.equal(result.sourceSnapshotVersion, null);
  assert.equal(result.courts[0].priority, 10);
  assert.deepEqual(result.courts[0].capabilities, []);
  assert.equal(result.courts[0].availabilityIntervals.length, 1);
  assert.equal(result.courts[0].availabilityIntervals[0].start, WINDOW.windowStart);
  assert.equal(result.courts[0].availabilityIntervals[0].end, WINDOW.windowEnd);
  assert.equal(result.bridgeContractVersion, CORE12_VENUE_AVAILABILITY_BRIDGE_V1);
});

test("03 sync providers succeed", async () => {
  const bridge = createBridge(baseEligibility(), baseEnvelope());
  const result = await bridge.resolveAvailableCourtsProjection(baseQuery());
  assert.equal(result.ok, true);
});

test("04 async providers succeed", async () => {
  const bridge = createBridge(baseEligibility(), baseEnvelope(), {
    eligibilityAsync: true,
    descriptorAsync: true,
  });
  const result = await bridge.resolveAvailableCourtsProjection(baseQuery());
  assert.equal(result.ok, true);
});

test("05 mixed sync eligibility + async descriptors", async () => {
  const bridge = createBridge(baseEligibility(), baseEnvelope(), {
    descriptorAsync: true,
  });
  const result = await bridge.resolveAvailableCourtsProjection(baseQuery());
  assert.equal(result.ok, true);
});

test("06 eligibility ∩ descriptors join by courtId; descriptor-only excluded", async () => {
  const bridge = createBridge(
    baseEligibility({ availableCourtIds: ["court-a"] }),
    baseEnvelope({
      courts: [
        baseCourtRow({ courtId: "court-a", priority: 1 }),
        baseCourtRow({ courtId: "court-b", priority: 2 }),
      ],
    })
  );
  const result = await bridge.resolveAvailableCourtsProjection(baseQuery());
  assert.equal(result.ok, true);
  assert.equal(result.courts.length, 1);
  assert.equal(result.courts[0].courtId, "court-a");
});

test("07 empty eligibility is valid empty projection", async () => {
  const bridge = createBridge(
    baseEligibility({ availableCourtIds: [] }),
    baseEnvelope({ courts: [baseCourtRow()] })
  );
  const result = await bridge.resolveAvailableCourtsProjection(baseQuery());
  assert.equal(result.ok, true);
  assert.equal(result.courts.length, 0);
  assert.ok(
    result.findings.some(
      (f) => f.code === AVAILABILITY_BRIDGE_CODE.EMPTY_ELIGIBILITY_RESULT
    )
  );
});

test("08 deterministic repeated execution", async () => {
  const bridge = createBridge(
    baseEligibility({ availableCourtIds: ["court-b", "court-a"] }),
    baseEnvelope({
      courts: [
        baseCourtRow({ courtId: "court-b", priority: 5 }),
        baseCourtRow({ courtId: "court-a", priority: 5 }),
      ],
    })
  );
  const a = await bridge.resolveAvailableCourtsProjection(baseQuery());
  const b = await bridge.resolveAvailableCourtsProjection(baseQuery());
  assert.equal(a.ok, true);
  assert.equal(a.derivedAvailabilityFingerprint, b.derivedAvailabilityFingerprint);
  assert.deepEqual(
    a.courts.map((c) => c.courtId),
    b.courts.map((c) => c.courtId)
  );
});

test("09 priority affects assignment; equal priority uses courtId tie-break", async () => {
  const bridge = createBridge(
    baseEligibility({ availableCourtIds: ["court-b", "court-a"] }),
    baseEnvelope({
      courts: [
        baseCourtRow({ courtId: "court-b", priority: 1 }),
        baseCourtRow({ courtId: "court-a", priority: 50 }),
      ],
    })
  );
  const projected = await bridge.resolveAvailableCourtsProjection(baseQuery());
  assert.equal(projected.ok, true);

  function toRequestCourts(courts) {
    return courts.map((c) => ({
      courtId: c.courtId,
      tenantId: c.tenantId,
      clubId: c.clubId,
      venueId: c.venueId,
      availabilityStatus: c.availabilityStatus,
      active: c.active,
      eligible: c.eligible,
      capabilities: c.capabilities,
      priority: c.priority,
      availabilityIntervals: c.availabilityIntervals.map((iv) => ({
        start: iv.start,
        end: iv.end,
      })),
      availabilityWindows: c.availabilityWindows,
      metadata: c.metadata,
    }));
  }

  const policy = createCourtAssignmentPolicy({
    policyId: "pol-b2-1",
    policyVersion: CORE12_POLICY_VERSION,
    comparatorVersion: CORE12_COMPARATOR_VERSION,
    courtSelectionStrategyVersion: CORE12_COURT_SELECTION_STRATEGY_VERSION,
  });
  const request = {
    schemaVersion: CORE12_COURT_ASSIGNMENT_SCHEMA_V1,
    requestId: "req-1",
    tenantId: "venue-1",
    clubId: "club-1",
    venueId: "venue-1",
    competitionId: "comp-1",
    timezone: TZ,
    matches: [
      {
        matchId: "m1",
        competitionId: "comp-1",
        scheduledStart: WINDOW.windowStart,
        scheduledEnd: WINDOW.windowEnd,
      },
    ],
    courts: toRequestCourts(projected.courts),
    lockedAssignments: [],
    constraints: [],
    policy,
    availabilitySnapshotRef: {
      snapshotId: "derived-1",
      snapshotVersion: "1",
      fingerprint: projected.derivedAvailabilityFingerprint,
    },
  };
  const assigned = assignCourtsDeterministic(request);
  assert.equal(assigned.assignments[0].courtId, "court-a");

  const equal = await createBridge(
    baseEligibility({ availableCourtIds: ["court-b", "court-a"] }),
    baseEnvelope({
      courts: [
        baseCourtRow({ courtId: "court-b", priority: 5 }),
        baseCourtRow({ courtId: "court-a", priority: 5 }),
      ],
    })
  ).resolveAvailableCourtsProjection(baseQuery());
  const request2 = {
    schemaVersion: CORE12_COURT_ASSIGNMENT_SCHEMA_V1,
    requestId: "req-2",
    tenantId: "venue-1",
    clubId: "club-1",
    venueId: "venue-1",
    competitionId: "comp-1",
    timezone: TZ,
    matches: [
      {
        matchId: "m1",
        competitionId: "comp-1",
        scheduledStart: WINDOW.windowStart,
        scheduledEnd: WINDOW.windowEnd,
      },
    ],
    courts: toRequestCourts(equal.courts),
    lockedAssignments: [],
    constraints: [],
    policy,
    availabilitySnapshotRef: {
      snapshotId: "derived-2",
      snapshotVersion: "1",
      fingerprint: equal.derivedAvailabilityFingerprint,
    },
  };
  const assigned2 = assignCourtsDeterministic(request2);
  assert.equal(assigned2.assignments[0].courtId, "court-a");
});

test("10 normalizeVenueDescriptorEnvelope is pure and does not mutate input", () => {
  const envelope = baseEnvelope();
  const frozenCourts = JSON.parse(JSON.stringify(envelope.courts));
  const result = normalizeVenueDescriptorEnvelope(envelope, {
    expectedScope: baseScope(),
  });
  assert.equal(result.ok, true);
  assert.deepEqual(envelope.courts, frozenCourts);
  assert.equal(result.courtDescriptors[0].priority, 10);
});

// ---------------------------------------------------------------------------
// Fail-closed
// ---------------------------------------------------------------------------

test("11 missing eligibility provider", async () => {
  const bridge = createInjectedVenueCourtAvailabilityProvider({
    descriptorProvider: createFixedCanonicalCourtDescriptorProvider(baseEnvelope()),
  });
  const result = await bridge.resolveAvailableCourtsProjection(baseQuery());
  assert.equal(result.ok, false);
  assert.equal(result.code, AVAILABILITY_BRIDGE_CODE.MISSING_ELIGIBILITY_PROVIDER);
});

test("12 missing descriptor provider", async () => {
  const bridge = createInjectedVenueCourtAvailabilityProvider({
    eligibilityProvider: createFixedVenueEligibilityProvider(baseEligibility()),
  });
  const result = await bridge.resolveAvailableCourtsProjection(baseQuery());
  assert.equal(result.ok, false);
  assert.equal(result.code, AVAILABILITY_BRIDGE_CODE.MISSING_DESCRIPTOR_PROVIDER);
});

test("13 malformed descriptor envelope", async () => {
  const bridge = createBridge(baseEligibility(), null);
  const result = await bridge.resolveAvailableCourtsProjection(baseQuery());
  assert.equal(result.ok, false);
  assert.equal(result.code, AVAILABILITY_BRIDGE_CODE.MALFORMED_DESCRIPTOR_ENVELOPE);
});

test("14 missing authority", async () => {
  const env = baseEnvelope();
  delete env.descriptorAuthority;
  const bridge = createBridge(baseEligibility(), env);
  const result = await bridge.resolveAvailableCourtsProjection(baseQuery());
  assert.equal(result.ok, false);
  assert.equal(result.code, AVAILABILITY_BRIDGE_CODE.MISSING_DESCRIPTOR_AUTHORITY);
});

test("15 authority mismatch", async () => {
  const bridge = createBridge(
    baseEligibility(),
    baseEnvelope({ descriptorAuthority: "other.authority" })
  );
  const result = await bridge.resolveAvailableCourtsProjection(baseQuery());
  assert.equal(result.ok, false);
  assert.equal(result.code, AVAILABILITY_BRIDGE_CODE.DESCRIPTOR_AUTHORITY_MISMATCH);
});

test("16 missing / mismatched source contract version", async () => {
  const missing = await createBridge(
    baseEligibility(),
    (() => {
      const e = baseEnvelope();
      delete e.sourceContractVersion;
      return e;
    })()
  ).resolveAvailableCourtsProjection(baseQuery());
  assert.equal(missing.ok, false);
  assert.equal(
    missing.code,
    AVAILABILITY_BRIDGE_CODE.DESCRIPTOR_CONTRACT_VERSION_MISMATCH
  );

  const mismatched = await createBridge(
    baseEligibility(),
    baseEnvelope({ sourceContractVersion: "WRONG_V0" })
  ).resolveAvailableCourtsProjection(baseQuery());
  assert.equal(mismatched.ok, false);
  assert.equal(
    mismatched.code,
    AVAILABILITY_BRIDGE_CODE.DESCRIPTOR_CONTRACT_VERSION_MISMATCH
  );
});

test("17 duplicate descriptors", async () => {
  const bridge = createBridge(
    baseEligibility({ availableCourtIds: ["court-a"] }),
    baseEnvelope({
      courts: [baseCourtRow(), baseCourtRow()],
    })
  );
  const result = await bridge.resolveAvailableCourtsProjection(baseQuery());
  assert.equal(result.ok, false);
  assert.equal(
    result.code,
    AVAILABILITY_BRIDGE_CODE.DUPLICATE_CANONICAL_COURT_DESCRIPTOR
  );
});

test("17b duplicate eligibility IDs fail closed", async () => {
  const bridge = createBridge(
    baseEligibility({ availableCourtIds: ["court-a", "court-a"] }),
    baseEnvelope({ courts: [baseCourtRow()] })
  );
  const result = await bridge.resolveAvailableCourtsProjection(baseQuery());
  assert.equal(result.ok, false);
  assert.equal(result.code, AVAILABILITY_BRIDGE_CODE.DUPLICATE_ELIGIBLE_COURT_ID);
});

test("18 missing descriptor for eligible court", async () => {
  const bridge = createBridge(
    baseEligibility({ availableCourtIds: ["court-a", "court-missing"] }),
    baseEnvelope({ courts: [baseCourtRow()] })
  );
  const result = await bridge.resolveAvailableCourtsProjection(baseQuery());
  assert.equal(result.ok, false);
  assert.equal(
    result.code,
    AVAILABILITY_BRIDGE_CODE.MISSING_CANONICAL_COURT_DESCRIPTOR
  );
});

test("19 tenant / club / venue / per-court scope mismatch", async () => {
  const tenant = await createBridge(
    baseEligibility({ tenantId: "other-tenant" }),
    baseEnvelope()
  ).resolveAvailableCourtsProjection(baseQuery());
  assert.equal(tenant.ok, false);
  assert.equal(tenant.code, AVAILABILITY_BRIDGE_CODE.ELIGIBILITY_SCOPE_MISMATCH);

  const club = await createBridge(
    baseEligibility({ clubId: "other-club" }),
    baseEnvelope()
  ).resolveAvailableCourtsProjection(baseQuery());
  assert.equal(club.ok, false);
  assert.equal(club.code, AVAILABILITY_BRIDGE_CODE.ELIGIBILITY_SCOPE_MISMATCH);

  const venueEnv = await createBridge(
    baseEligibility(),
    baseEnvelope({ venueId: "other-venue" })
  ).resolveAvailableCourtsProjection(baseQuery());
  assert.equal(venueEnv.ok, false);
  assert.equal(venueEnv.code, AVAILABILITY_BRIDGE_CODE.DESCRIPTOR_SCOPE_MISMATCH);

  const perCourt = await createBridge(
    baseEligibility(),
    baseEnvelope({
      courts: [baseCourtRow({ venueId: "other-venue" })],
    })
  ).resolveAvailableCourtsProjection(baseQuery());
  assert.equal(perCourt.ok, false);
  assert.equal(perCourt.code, AVAILABILITY_BRIDGE_CODE.COURT_SCOPE_MISMATCH);
});

test("20 inactive and locked courts fail closed", async () => {
  const inactive = await createBridge(
    baseEligibility(),
    baseEnvelope({ courts: [baseCourtRow({ active: false })] })
  ).resolveAvailableCourtsProjection(baseQuery());
  assert.equal(inactive.ok, false);
  assert.equal(inactive.code, AVAILABILITY_BRIDGE_CODE.COURT_NOT_ENABLED);

  const locked = await createBridge(
    baseEligibility(),
    baseEnvelope({ courts: [baseCourtRow({ locked: true })] })
  ).resolveAvailableCourtsProjection(baseQuery());
  assert.equal(locked.ok, false);
  assert.equal(locked.code, AVAILABILITY_BRIDGE_CODE.COURT_DESCRIPTOR_LOCKED);
});

test("21 malformed eligibility evidence", async () => {
  const bridge = createBridge({ clubId: "club-1" }, baseEnvelope());
  const result = await bridge.resolveAvailableCourtsProjection(baseQuery());
  assert.equal(result.ok, false);
  assert.equal(result.code, AVAILABILITY_BRIDGE_CODE.MALFORMED_ELIGIBILITY_SNAPSHOT);
});

test("22 required capability with empty Venue capabilities fails closed", async () => {
  const bridge = createBridge(baseEligibility(), baseEnvelope());
  const result = await bridge.resolveAvailableCourtsProjection(baseQuery(), {
    requiredCapabilities: ["indoor"],
  });
  assert.equal(result.ok, false);
  assert.equal(result.code, AVAILABILITY_BRIDGE_CODE.COURT_CAPABILITY_UNKNOWN);
});

test("23 eligibility / descriptor provider throw and rejection", async () => {
  const throwElig = createInjectedVenueCourtAvailabilityProvider({
    eligibilityProvider: {
      resolveEligibility() {
        throw Object.assign(new Error("elig boom"), { code: "ELIG_FAIL" });
      },
    },
    descriptorProvider: createFixedCanonicalCourtDescriptorProvider(baseEnvelope()),
  });
  const e1 = await throwElig.resolveAvailableCourtsProjection(baseQuery());
  assert.equal(e1.ok, false);
  assert.equal(e1.code, "ELIG_FAIL");

  const rejectElig = createInjectedVenueCourtAvailabilityProvider({
    eligibilityProvider: {
      async resolveEligibility() {
        return Promise.reject(Object.assign(new Error("elig reject"), { code: "ELIG_REJ" }));
      },
    },
    descriptorProvider: createFixedCanonicalCourtDescriptorProvider(baseEnvelope()),
  });
  const e2 = await rejectElig.resolveAvailableCourtsProjection(baseQuery());
  assert.equal(e2.ok, false);
  assert.equal(e2.code, "ELIG_REJ");

  const throwDesc = createInjectedVenueCourtAvailabilityProvider({
    eligibilityProvider: createFixedVenueEligibilityProvider(baseEligibility()),
    descriptorProvider: {
      resolveDescriptors() {
        throw Object.assign(new Error("desc boom"), { code: "DESC_FAIL" });
      },
    },
  });
  const d1 = await throwDesc.resolveAvailableCourtsProjection(baseQuery());
  assert.equal(d1.ok, false);
  assert.equal(d1.code, "DESC_FAIL");

  const rejectDesc = createInjectedVenueCourtAvailabilityProvider({
    eligibilityProvider: createFixedVenueEligibilityProvider(baseEligibility()),
    descriptorProvider: {
      async resolveDescriptors() {
        return Promise.reject(
          Object.assign(new Error("desc reject"), { code: "DESC_REJ" })
        );
      },
    },
  });
  const d2 = await rejectDesc.resolveAvailableCourtsProjection(baseQuery());
  assert.equal(d2.ok, false);
  assert.equal(d2.code, "DESC_REJ");
});

test("24 snapshot metadata preserved null; never fabricated by bridge", async () => {
  const bridge = createBridge(baseEligibility(), baseEnvelope());
  const result = await bridge.resolveAvailableCourtsProjection(baseQuery());
  assert.equal(result.ok, true);
  assert.equal(result.sourceSnapshotId, null);
  assert.equal(result.sourceSnapshotVersion, null);
  assert.equal(result.queryFingerprint != null, true);
});

test("25 missing / string / non-finite priority rejected", async () => {
  const missing = normalizeVenueDescriptorEnvelope(
    baseEnvelope({
      courts: [
        (() => {
          const row = baseCourtRow();
          delete row.priority;
          return row;
        })(),
      ],
    }),
    { expectedScope: baseScope() }
  );
  assert.equal(missing.ok, false);
  assert.equal(missing.code, AVAILABILITY_BRIDGE_CODE.PRIORITY_NOT_AUTHORITATIVE);

  const asString = normalizeVenueDescriptorEnvelope(
    baseEnvelope({ courts: [baseCourtRow({ priority: "10" })] }),
    { expectedScope: baseScope() }
  );
  assert.equal(asString.ok, false);
  assert.equal(asString.code, AVAILABILITY_BRIDGE_CODE.PRIORITY_NOT_AUTHORITATIVE);

  const nonFinite = normalizeVenueDescriptorEnvelope(
    baseEnvelope({ courts: [baseCourtRow({ priority: Number.NaN })] }),
    { expectedScope: baseScope() }
  );
  assert.equal(nonFinite.ok, false);
  assert.equal(nonFinite.code, AVAILABILITY_BRIDGE_CODE.PRIORITY_NOT_AUTHORITATIVE);

  const infinite = normalizeVenueDescriptorEnvelope(
    baseEnvelope({ courts: [baseCourtRow({ priority: Number.POSITIVE_INFINITY })] }),
    { expectedScope: baseScope() }
  );
  assert.equal(infinite.ok, false);
  assert.equal(infinite.code, AVAILABILITY_BRIDGE_CODE.PRIORITY_NOT_AUTHORITATIVE);
});

test("26 invalid overnight window rejected before providers", async () => {
  const bridge = createBridge(baseEligibility(), baseEnvelope());
  const result = await bridge.resolveAvailableCourtsProjection({
    ...baseScope(),
    timezone: TZ,
    windowStart: "2026-07-22T16:00:00Z",
    windowEnd: "2026-07-23T02:00:00Z",
    civilDate: "2026-07-22",
    civilStartTime: "23:00",
    civilEndTime: "09:00",
  });
  assert.equal(result.ok, false);
  assert.ok(
    [
      AVAILABILITY_BRIDGE_CODE.UNSUPPORTED_OVERNIGHT_WINDOW,
      AVAILABILITY_BRIDGE_CODE.INVALID_QUERY_WINDOW,
      AVAILABILITY_BRIDGE_CODE.INVALID_AVAILABILITY_QUERY,
    ].includes(result.code)
  );
});

test("27 no first-club fallback — missing clubId rejected", async () => {
  const bridge = createBridge(baseEligibility(), baseEnvelope());
  const result = await bridge.resolveAvailableCourtsProjection({
    tenantId: "venue-1",
    venueId: "venue-1",
    competitionId: "comp-1",
    ...WINDOW,
  });
  assert.equal(result.ok, false);
  assert.equal(result.code, AVAILABILITY_BRIDGE_CODE.INVALID_AVAILABILITY_QUERY);
});

// ---------------------------------------------------------------------------
// Architecture locks
// ---------------------------------------------------------------------------

test("28 production modules do not import Venue internals / TE / CORE-14 / supabase", () => {
  const files = walkJsFiles(CA_ROOT);
  for (const file of files) {
    const src = read(file);
    const rel = path.relative(ROOT, file);
    assertNoMatch(src, /from\s+["'][^"']*venue-court[^"']*["']/, rel);
    assertNoMatch(src, /from\s+["'][^"']*domain\/courtService[^"']*["']/, rel);
    assertNoMatch(src, /from\s+["'][^"']*domain\/clubStorage[^"']*["']/, rel);
    assertNoMatch(src, /from\s+["'][^"']*tournament-engine[^"']*["']/, rel);
    assertNoMatch(src, /from\s+["'][^"']*resource-conflict[^"']*["']/, rel);
    assertNoMatch(src, /from\s+["'][^"']*supabase[^"']*["']/, rel);
  }
});

test("29 root barrel unchanged; production barrels do not export test doubles", async () => {
  const root = read(ROOT_BARREL);
  assertNoMatch(
    root,
    /createInjectedVenueCourtAvailabilityProvider|normalizeVenueDescriptorEnvelope|court-assignment/,
    "root barrel"
  );
  const avail = await import(
    "../src/features/competition-core/court-assignment/adapters/availability/index.js"
  );
  assert.equal(avail.createFixedVenueEligibilityProvider, undefined);
  assert.equal(avail.createFixedCanonicalCourtDescriptorProvider, undefined);
  assert.equal(typeof avail.createInjectedVenueCourtAvailabilityProvider, "function");
  assert.equal(typeof avail.normalizeVenueDescriptorEnvelope, "function");

  const ca = read(CA_INDEX);
  assertNoMatch(ca, /from\s+["'][^"']*testDoubles\.js["']/, "CA index");
  const availIdx = read(AVAIL_INDEX);
  assertNoMatch(availIdx, /from\s+["']\.\/testDoubles\.js["']/, "avail index");
});

test("30 no Date.now / Math.random / UUID fabrication in availability adapters", () => {
  for (const file of walkJsFiles(AVAIL_ROOT)) {
    const src = read(file);
    const rel = path.relative(ROOT, file);
    assertNoMatch(src, /Date\.now\s*\(/, rel);
    assertNoMatch(src, /Math\.random\s*\(/, rel);
    assertNoMatch(src, /\brandomUUID\b|crypto\.randomUUID/, rel);
  }
});

test("31 Option A provider modules exist; production export surface present", () => {
  assert.equal(
    existsSync(path.join(AVAIL_ROOT, "createInjectedVenueCourtAvailabilityProvider.js")),
    true
  );
  assert.equal(
    existsSync(path.join(AVAIL_ROOT, "normalizeVenueDescriptorEnvelope.js")),
    true
  );
  assert.equal(
    existsSync(path.join(CA_ROOT, "ports/venueEligibilityProvider.js")),
    true
  );
  assert.equal(
    existsSync(path.join(CA_ROOT, "ports/canonicalCourtDescriptorProvider.js")),
    true
  );
  const ca = read(CA_INDEX);
  assert.match(ca, /createInjectedVenueCourtAvailabilityProvider/);
  assert.match(ca, /normalizeVenueDescriptorEnvelope/);
});

test("32 projection still requires descriptors — eligibility IDs alone are not inventory", () => {
  const result = projectEligibleCourtsToAvailableInputs({
    ...WINDOW,
    eligibilitySnapshot: {
      schemaVersion: "CORE12_ELIGIBILITY_SNAPSHOT_V1",
      ...baseScope(),
      ...WINDOW,
      eligibleCourtIds: ["court-a"],
      ineligibleCourts: [],
      queryFingerprint: baseQuery().queryFingerprint,
      sourceSnapshotId: null,
      sourceSnapshotVersion: null,
    },
    courtDescriptors: [],
  });
  assert.equal(result.ok, false);
  assert.equal(
    result.code,
    AVAILABILITY_BRIDGE_CODE.MISSING_CANONICAL_COURT_DESCRIPTOR
  );
});
