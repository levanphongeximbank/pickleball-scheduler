/**
 * CORE-14 Phase 1D — dormant conflict detector tests.
 * Capability-local only. Not added to Integrator unit-test-files.json.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  RESOURCE_KIND,
  SCOPE_TYPE,
  OCCUPANCY_SOURCE,
  RESOURCE_FINDING_CODE,
  INPUT_DIAGNOSTIC_CODE,
  SEVERITY,
  EVALUATION_STATUS,
  PLAN_STATUS,
  AVAILABILITY_CERTIFICATION,
  AVAILABILITY_MODE,
  createResourceOccupancy,
  getMinimumSeverity,
  detectTimeOverlaps,
  detectCapacityExceeded,
  detectRestViolations,
  detectAvailabilityFindings,
  materializeAvailabilityFactsFromPort,
  suppressDuplicateRootCauses,
  detectResourceConflicts,
  normalizeCapacityPolicy,
  REST_MODE,
  AVAILABILITY_STATUS,
  serializeCanonicalResourceKey,
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

function key(kind, id, scopeType = SCOPE_TYPE.EVENT, scopeId = "event-1") {
  return {
    resourceKind: kind,
    resourceId: id,
    scopeType,
    scopeId: scopeType === SCOPE_TYPE.GLOBAL ? null : scopeId,
  };
}

function occ(overrides = {}) {
  return createResourceOccupancy({
    occupancyId: "occ-1",
    resourceKey: key(RESOURCE_KIND.PLAYER, "player-1"),
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
  });
}

function rawOcc(overrides = {}) {
  return {
    occupancyId: "occ-1",
    resourceKey: key(RESOURCE_KIND.PLAYER, "player-1"),
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

function capacityPolicy(entries = [], exclusiveLocations = []) {
  const normalized = normalizeCapacityPolicy({
    capacities: entries,
    exclusiveLocations,
    policyVersion: "core14-capacity-policy-v1",
  });
  assert.equal(normalized.ok, true);
  return normalized.value;
}

// ——— TIME OVERLAP (1–16) ———

test("1. Empty occupancy set yields no overlap findings", () => {
  assert.deepEqual(detectTimeOverlaps([]), []);
});

test("2. One occupancy yields no overlap findings", () => {
  assert.deepEqual(detectTimeOverlaps([occ()]), []);
});

test("3. Adjacent intervals do not overlap", () => {
  const findings = detectTimeOverlaps([
    occ({ occupancyId: "a", assignmentId: "a1", startMs: 0, endMs: 100 }),
    occ({ occupancyId: "b", assignmentId: "b1", startMs: 100, endMs: 200 }),
  ]);
  assert.equal(findings.length, 0);
});

test("4. Partial overlap emits one finding", () => {
  const findings = detectTimeOverlaps([
    occ({ occupancyId: "a", assignmentId: "a1", startMs: 0, endMs: 150 }),
    occ({ occupancyId: "b", assignmentId: "b1", startMs: 100, endMs: 200 }),
  ]);
  assert.equal(findings.length, 1);
  assert.equal(findings[0].code, RESOURCE_FINDING_CODE.PLAYER_TIME_OVERLAP);
  assert.equal(findings[0].violationStartMs, 100);
  assert.equal(findings[0].violationEndMs, 150);
});

test("5. Full containment emits overlap", () => {
  const findings = detectTimeOverlaps([
    occ({ occupancyId: "outer", assignmentId: "a1", startMs: 0, endMs: 300 }),
    occ({ occupancyId: "inner", assignmentId: "b1", startMs: 50, endMs: 100 }),
  ]);
  assert.equal(findings.length, 1);
  assert.equal(findings[0].violationStartMs, 50);
  assert.equal(findings[0].violationEndMs, 100);
});

test("6. Three-way overlap emits three pairwise findings", () => {
  const findings = detectTimeOverlaps([
    occ({ occupancyId: "a", assignmentId: "a1", startMs: 0, endMs: 300 }),
    occ({ occupancyId: "b", assignmentId: "b1", startMs: 50, endMs: 250 }),
    occ({ occupancyId: "c", assignmentId: "c1", startMs: 100, endMs: 200 }),
  ]);
  assert.equal(findings.length, 3);
});

test("7. Same time but different resource keys do not overlap", () => {
  const findings = detectTimeOverlaps([
    occ({
      occupancyId: "a",
      assignmentId: "a1",
      resourceKey: key(RESOURCE_KIND.PLAYER, "p1"),
      startMs: 0,
      endMs: 100,
    }),
    occ({
      occupancyId: "b",
      assignmentId: "b1",
      resourceKey: key(RESOURCE_KIND.PLAYER, "p2"),
      startMs: 0,
      endMs: 100,
    }),
  ]);
  assert.equal(findings.length, 0);
});

test("8. Player overlap uses PLAYER_TIME_OVERLAP", () => {
  const findings = detectTimeOverlaps([
    occ({ occupancyId: "a", assignmentId: "a1", startMs: 0, endMs: 100 }),
    occ({ occupancyId: "b", assignmentId: "b1", startMs: 50, endMs: 150 }),
  ]);
  assert.equal(findings[0].code, RESOURCE_FINDING_CODE.PLAYER_TIME_OVERLAP);
});

test("9. Team overlap uses TEAM_TIME_OVERLAP", () => {
  const rk = key(RESOURCE_KIND.TEAM, "team-1");
  const findings = detectTimeOverlaps([
    occ({ occupancyId: "a", assignmentId: "a1", resourceKey: rk, startMs: 0, endMs: 100 }),
    occ({ occupancyId: "b", assignmentId: "b1", resourceKey: rk, startMs: 50, endMs: 150 }),
  ]);
  assert.equal(findings[0].code, RESOURCE_FINDING_CODE.TEAM_TIME_OVERLAP);
});

test("10. Court overlap uses COURT_TIME_OVERLAP", () => {
  const rk = key(RESOURCE_KIND.COURT, "court-1", SCOPE_TYPE.VENUE, "venue-1");
  const findings = detectTimeOverlaps([
    occ({ occupancyId: "a", assignmentId: "a1", resourceKey: rk, startMs: 0, endMs: 100 }),
    occ({ occupancyId: "b", assignmentId: "b1", resourceKey: rk, startMs: 50, endMs: 150 }),
  ]);
  assert.equal(findings[0].code, RESOURCE_FINDING_CODE.COURT_TIME_OVERLAP);
});

test("11. Referee overlap uses REFEREE_TIME_OVERLAP", () => {
  const rk = key(RESOURCE_KIND.REFEREE, "ref-1");
  const findings = detectTimeOverlaps([
    occ({ occupancyId: "a", assignmentId: "a1", resourceKey: rk, startMs: 0, endMs: 100 }),
    occ({ occupancyId: "b", assignmentId: "b1", resourceKey: rk, startMs: 50, endMs: 150 }),
  ]);
  assert.equal(findings[0].code, RESOURCE_FINDING_CODE.REFEREE_TIME_OVERLAP);
});

test("12. Same venue does not automatically emit venue overlap", () => {
  const courtA = key(RESOURCE_KIND.COURT, "c1", SCOPE_TYPE.VENUE, "venue-9");
  const courtB = key(RESOURCE_KIND.COURT, "c2", SCOPE_TYPE.VENUE, "venue-9");
  const findings = detectTimeOverlaps([
    occ({ occupancyId: "a", assignmentId: "a1", resourceKey: courtA, venueId: "venue-9", startMs: 0, endMs: 100 }),
    occ({ occupancyId: "b", assignmentId: "b1", resourceKey: courtB, venueId: "venue-9", startMs: 0, endMs: 100 }),
  ]);
  assert.equal(findings.length, 0);
  const venueKey = key(RESOURCE_KIND.VENUE, "venue-9", SCOPE_TYPE.GLOBAL, null);
  const venueFindings = detectTimeOverlaps([
    occ({ occupancyId: "v1", assignmentId: "a1", resourceKey: venueKey, startMs: 0, endMs: 100 }),
    occ({ occupancyId: "v2", assignmentId: "b1", resourceKey: venueKey, startMs: 0, endMs: 100 }),
  ]);
  assert.equal(venueFindings.length, 0);
});

test("13. Exclusive location overlap emits LOCATION_TIME_OVERLAP", () => {
  const rk = key(RESOURCE_KIND.LOCATION, "loc-1", SCOPE_TYPE.VENUE, "venue-1");
  const exclusive = new Set([serializeCanonicalResourceKey(rk)]);
  const findings = detectTimeOverlaps(
    [
      occ({ occupancyId: "a", assignmentId: "a1", resourceKey: rk, startMs: 0, endMs: 100 }),
      occ({ occupancyId: "b", assignmentId: "b1", resourceKey: rk, startMs: 50, endMs: 150 }),
    ],
    { exclusiveLocationKeys: exclusive }
  );
  assert.equal(findings.length, 1);
  assert.equal(findings[0].code, RESOURCE_FINDING_CODE.LOCATION_TIME_OVERLAP);
});

test("14. Non-exclusive location does not emit location overlap", () => {
  const rk = key(RESOURCE_KIND.LOCATION, "loc-1", SCOPE_TYPE.VENUE, "venue-1");
  const findings = detectTimeOverlaps([
    occ({ occupancyId: "a", assignmentId: "a1", resourceKey: rk, startMs: 0, endMs: 100 }),
    occ({ occupancyId: "b", assignmentId: "b1", resourceKey: rk, startMs: 50, endMs: 150 }),
  ]);
  assert.equal(findings.length, 0);
});

test("15. Deterministic pair ordering of occupancyIds", () => {
  const findings = detectTimeOverlaps([
    occ({ occupancyId: "z-occ", assignmentId: "a1", startMs: 0, endMs: 100 }),
    occ({ occupancyId: "a-occ", assignmentId: "b1", startMs: 50, endMs: 150 }),
  ]);
  assert.deepEqual([...findings[0].occupancyIds], ["a-occ", "z-occ"]);
});

test("16. Reordered input parity for overlap findings", () => {
  const a = [
    occ({ occupancyId: "a", assignmentId: "a1", startMs: 0, endMs: 100 }),
    occ({ occupancyId: "b", assignmentId: "b1", startMs: 50, endMs: 150 }),
    occ({ occupancyId: "c", assignmentId: "c1", startMs: 200, endMs: 300 }),
  ];
  const b = [a[2], a[1], a[0]];
  const fa = detectTimeOverlaps(a).map((f) => f.findingId).sort();
  const fb = detectTimeOverlaps(b).map((f) => f.findingId).sort();
  assert.deepEqual(fa, fb);
});

// ——— CAPACITY (17–28) ———

test("17. Capacity exactly met emits no finding", () => {
  const rk = key(RESOURCE_KIND.EQUIPMENT, "ball-bucket", SCOPE_TYPE.VENUE, "v1");
  const policy = capacityPolicy([{ resourceKey: rk, capacity: 2 }]);
  const out = detectCapacityExceeded(
    [
      occ({ occupancyId: "a", assignmentId: "a1", resourceKey: rk, capacityUnits: 1, startMs: 0, endMs: 100 }),
      occ({ occupancyId: "b", assignmentId: "b1", resourceKey: rk, capacityUnits: 1, startMs: 0, endMs: 100 }),
    ],
    { capacityPolicy: policy }
  );
  assert.equal(out.findings.length, 0);
});

test("18. Capacity exceeded emits RESOURCE_CAPACITY_EXCEEDED", () => {
  const rk = key(RESOURCE_KIND.EQUIPMENT, "ball-bucket", SCOPE_TYPE.VENUE, "v1");
  const policy = capacityPolicy([{ resourceKey: rk, capacity: 1 }]);
  const out = detectCapacityExceeded(
    [
      occ({ occupancyId: "a", assignmentId: "a1", resourceKey: rk, capacityUnits: 1, startMs: 0, endMs: 100 }),
      occ({ occupancyId: "b", assignmentId: "b1", resourceKey: rk, capacityUnits: 1, startMs: 0, endMs: 100 }),
    ],
    { capacityPolicy: policy }
  );
  assert.equal(out.findings.length, 1);
  assert.equal(out.findings[0].code, RESOURCE_FINDING_CODE.RESOURCE_CAPACITY_EXCEEDED);
  assert.equal(out.findings[0].evidence.peakCapacityUnits, 2);
});

test("19. Release before acquire at same timestamp does not accumulate", () => {
  const rk = key(RESOURCE_KIND.EQUIPMENT, "net", SCOPE_TYPE.VENUE, "v1");
  const policy = capacityPolicy([{ resourceKey: rk, capacity: 1 }]);
  const out = detectCapacityExceeded(
    [
      occ({ occupancyId: "a", assignmentId: "a1", resourceKey: rk, startMs: 0, endMs: 100 }),
      occ({ occupancyId: "b", assignmentId: "b1", resourceKey: rk, startMs: 100, endMs: 200 }),
    ],
    { capacityPolicy: policy }
  );
  assert.equal(out.findings.length, 0);
});

test("20. Multiple over-capacity windows", () => {
  const rk = key(RESOURCE_KIND.EQUIPMENT, "paddle", SCOPE_TYPE.VENUE, "v1");
  const policy = capacityPolicy([{ resourceKey: rk, capacity: 1 }]);
  const out = detectCapacityExceeded(
    [
      occ({ occupancyId: "a", assignmentId: "a1", resourceKey: rk, startMs: 0, endMs: 50 }),
      occ({ occupancyId: "b", assignmentId: "b1", resourceKey: rk, startMs: 0, endMs: 50 }),
      occ({ occupancyId: "c", assignmentId: "c1", resourceKey: rk, startMs: 100, endMs: 150 }),
      occ({ occupancyId: "d", assignmentId: "d1", resourceKey: rk, startMs: 100, endMs: 150 }),
    ],
    { capacityPolicy: policy }
  );
  assert.equal(out.findings.length, 2);
});

test("21. Maximal contiguous violating window", () => {
  const rk = key(RESOURCE_KIND.EQUIPMENT, "chair", SCOPE_TYPE.VENUE, "v1");
  const policy = capacityPolicy([{ resourceKey: rk, capacity: 1 }]);
  const out = detectCapacityExceeded(
    [
      occ({ occupancyId: "a", assignmentId: "a1", resourceKey: rk, startMs: 0, endMs: 100 }),
      occ({ occupancyId: "b", assignmentId: "b1", resourceKey: rk, startMs: 20, endMs: 80 }),
      occ({ occupancyId: "c", assignmentId: "c1", resourceKey: rk, startMs: 40, endMs: 60 }),
    ],
    { capacityPolicy: policy }
  );
  assert.equal(out.findings.length, 1);
  assert.equal(out.findings[0].violationStartMs, 20);
  assert.equal(out.findings[0].violationEndMs, 80);
});

test("22. Venue capacity uses VENUE_CAPACITY_EXCEEDED", () => {
  const rk = key(RESOURCE_KIND.VENUE, "venue-1", SCOPE_TYPE.GLOBAL, null);
  const policy = capacityPolicy([{ resourceKey: rk, capacity: 1 }]);
  const out = detectCapacityExceeded(
    [
      occ({ occupancyId: "a", assignmentId: "a1", resourceKey: rk, startMs: 0, endMs: 100 }),
      occ({ occupancyId: "b", assignmentId: "b1", resourceKey: rk, startMs: 0, endMs: 100 }),
    ],
    { capacityPolicy: policy }
  );
  assert.equal(out.findings[0].code, RESOURCE_FINDING_CODE.VENUE_CAPACITY_EXCEEDED);
});

test("23. Equipment capacity uses generic RESOURCE_CAPACITY_EXCEEDED", () => {
  const rk = key(RESOURCE_KIND.EQUIPMENT, "eq-1", SCOPE_TYPE.VENUE, "v1");
  const policy = capacityPolicy([{ resourceKey: rk, capacity: 1 }]);
  const out = detectCapacityExceeded(
    [
      occ({ occupancyId: "a", assignmentId: "a1", resourceKey: rk, startMs: 0, endMs: 100 }),
      occ({ occupancyId: "b", assignmentId: "b1", resourceKey: rk, startMs: 0, endMs: 100 }),
    ],
    { capacityPolicy: policy }
  );
  assert.equal(out.findings[0].code, RESOURCE_FINDING_CODE.RESOURCE_CAPACITY_EXCEEDED);
});

test("24. Custom resource capacity uses generic code", () => {
  const rk = key(RESOURCE_KIND.CUSTOM_RESOURCE, "custom-1");
  const policy = capacityPolicy([{ resourceKey: rk, capacity: 1 }]);
  const out = detectCapacityExceeded(
    [
      occ({ occupancyId: "a", assignmentId: "a1", resourceKey: rk, startMs: 0, endMs: 100 }),
      occ({ occupancyId: "b", assignmentId: "b1", resourceKey: rk, startMs: 0, endMs: 100 }),
    ],
    { capacityPolicy: policy }
  );
  assert.equal(out.findings[0].code, RESOURCE_FINDING_CODE.RESOURCE_CAPACITY_EXCEEDED);
});

test("25. No generic capacity duplicate for court overlap", () => {
  const rk = key(RESOURCE_KIND.COURT, "court-1", SCOPE_TYPE.VENUE, "v1");
  const result = detectResourceConflicts({
    occupancies: [
      rawOcc({ occupancyId: "a", assignmentId: "a1", resourceKey: rk, startMs: 0, endMs: 100 }),
      rawOcc({ occupancyId: "b", assignmentId: "b1", resourceKey: rk, startMs: 50, endMs: 150 }),
    ],
    capacityCheckEnabled: true,
    capacityPolicy: { capacities: [] },
  });
  assert.equal(result.evaluationStatus, EVALUATION_STATUS.COMPLETED);
  assert.equal(result.findings.length, 1);
  assert.equal(result.findings[0].code, RESOURCE_FINDING_CODE.COURT_TIME_OVERLAP);
  assert.equal(
    result.findings.some((f) => f.code === RESOURCE_FINDING_CODE.RESOURCE_CAPACITY_EXCEEDED),
    false
  );
});

test("26. No generic capacity duplicate for exclusive location overlap", () => {
  const rk = key(RESOURCE_KIND.LOCATION, "loc-1", SCOPE_TYPE.VENUE, "v1");
  const result = detectResourceConflicts({
    occupancies: [
      rawOcc({ occupancyId: "a", assignmentId: "a1", resourceKey: rk, startMs: 0, endMs: 100 }),
      rawOcc({ occupancyId: "b", assignmentId: "b1", resourceKey: rk, startMs: 50, endMs: 150 }),
    ],
    capacityCheckEnabled: true,
    capacityPolicy: {
      capacities: [{ resourceKey: rk, capacity: 1, exclusive: true }],
      exclusiveLocations: [rk],
    },
  });
  assert.equal(result.findings.length, 1);
  assert.equal(result.findings[0].code, RESOURCE_FINDING_CODE.LOCATION_TIME_OVERLAP);
});

test("27. Missing required capacity fails closed", () => {
  const rk = key(RESOURCE_KIND.EQUIPMENT, "eq-missing", SCOPE_TYPE.VENUE, "v1");
  const result = detectResourceConflicts({
    occupancies: [
      rawOcc({ occupancyId: "a", assignmentId: "a1", resourceKey: rk, startMs: 0, endMs: 100 }),
    ],
    capacityCheckEnabled: true,
    capacityPolicy: { capacities: [] },
  });
  assert.equal(result.evaluationStatus, EVALUATION_STATUS.REJECTED_INVALID_INPUT);
  assert.equal(
    result.inputDiagnostics.some((d) => d.code === INPUT_DIAGNOSTIC_CODE.CAPACITY_MISSING),
    true
  );
});

test("28. Invalid capacity fails closed", () => {
  const rk = key(RESOURCE_KIND.EQUIPMENT, "eq-bad", SCOPE_TYPE.VENUE, "v1");
  const result = detectResourceConflicts({
    occupancies: [
      rawOcc({ occupancyId: "a", assignmentId: "a1", resourceKey: rk, startMs: 0, endMs: 100 }),
    ],
    capacityCheckEnabled: true,
    capacityPolicy: { capacities: [{ resourceKey: rk, capacity: 0 }] },
  });
  assert.equal(result.evaluationStatus, EVALUATION_STATUS.REJECTED_INVALID_INPUT);
  assert.equal(
    result.inputDiagnostics.some((d) => d.code === INPUT_DIAGNOSTIC_CODE.INVALID_CAPACITY),
    true
  );
});

// ——— REST (29–39) ———

test("29. Mandatory rest violation", () => {
  const findings = detectRestViolations(
    [
      occ({ occupancyId: "a", assignmentId: "a1", startMs: 0, endMs: 100 }),
      occ({ occupancyId: "b", assignmentId: "b1", startMs: 150, endMs: 250 }),
    ],
    {
      restPolicy: {
        restMode: REST_MODE.MANDATORY,
        minimumRestMs: 100,
        applicableResourceKinds: [RESOURCE_KIND.PLAYER],
        policyVersion: "rest-v1",
      },
    }
  );
  assert.equal(findings.length, 1);
  assert.equal(findings[0].code, RESOURCE_FINDING_CODE.MANDATORY_REST_VIOLATION);
  assert.equal(findings[0].severity, SEVERITY.HARD);
});

test("30. Preferred rest warning", () => {
  const findings = detectRestViolations(
    [
      occ({ occupancyId: "a", assignmentId: "a1", startMs: 0, endMs: 100 }),
      occ({ occupancyId: "b", assignmentId: "b1", startMs: 120, endMs: 220 }),
    ],
    {
      restPolicy: {
        restMode: REST_MODE.PREFERRED,
        minimumRestMs: 50,
        applicableResourceKinds: [RESOURCE_KIND.PLAYER],
        policyVersion: "rest-v1",
      },
    }
  );
  assert.equal(findings[0].code, RESOURCE_FINDING_CODE.PREFERRED_REST_WARNING);
  assert.equal(findings[0].severity, SEVERITY.SOFT);
});

test("31. Rest exactly equal to minimum emits no finding", () => {
  const findings = detectRestViolations(
    [
      occ({ occupancyId: "a", assignmentId: "a1", startMs: 0, endMs: 100 }),
      occ({ occupancyId: "b", assignmentId: "b1", startMs: 150, endMs: 250 }),
    ],
    {
      restPolicy: {
        restMode: REST_MODE.MANDATORY,
        minimumRestMs: 50,
        applicableResourceKinds: [RESOURCE_KIND.PLAYER],
        policyVersion: "rest-v1",
      },
    }
  );
  assert.equal(findings.length, 0);
});

test("32. Rest greater than minimum emits no finding", () => {
  const findings = detectRestViolations(
    [
      occ({ occupancyId: "a", assignmentId: "a1", startMs: 0, endMs: 100 }),
      occ({ occupancyId: "b", assignmentId: "b1", startMs: 300, endMs: 400 }),
    ],
    {
      restPolicy: {
        restMode: REST_MODE.MANDATORY,
        minimumRestMs: 50,
        applicableResourceKinds: [RESOURCE_KIND.PLAYER],
        policyVersion: "rest-v1",
      },
    }
  );
  assert.equal(findings.length, 0);
});

test("33. Negative gap emits overlap only (no rest finding)", () => {
  const result = detectResourceConflicts({
    occupancies: [
      rawOcc({ occupancyId: "a", assignmentId: "a1", startMs: 0, endMs: 100 }),
      rawOcc({ occupancyId: "b", assignmentId: "b1", startMs: 50, endMs: 150 }),
    ],
    restPolicy: {
      restMode: REST_MODE.MANDATORY,
      minimumRestMs: 100,
      applicableResourceKinds: [RESOURCE_KIND.PLAYER],
      policyVersion: "rest-v1",
    },
  });
  assert.equal(result.findings.length, 1);
  assert.equal(result.findings[0].code, RESOURCE_FINDING_CODE.PLAYER_TIME_OVERLAP);
});

test("34. Player rest applies", () => {
  const findings = detectRestViolations(
    [
      occ({ occupancyId: "a", assignmentId: "a1", startMs: 0, endMs: 100 }),
      occ({ occupancyId: "b", assignmentId: "b1", startMs: 110, endMs: 200 }),
    ],
    {
      restPolicy: {
        restMode: REST_MODE.MANDATORY,
        minimumRestMs: 50,
        applicableResourceKinds: [RESOURCE_KIND.PLAYER],
        policyVersion: "rest-v1",
      },
    }
  );
  assert.equal(findings.length, 1);
});

test("35. Team rest applies", () => {
  const rk = key(RESOURCE_KIND.TEAM, "team-1");
  const findings = detectRestViolations(
    [
      occ({ occupancyId: "a", assignmentId: "a1", resourceKey: rk, startMs: 0, endMs: 100 }),
      occ({ occupancyId: "b", assignmentId: "b1", resourceKey: rk, startMs: 110, endMs: 200 }),
    ],
    {
      restPolicy: {
        restMode: REST_MODE.PREFERRED,
        minimumRestMs: 50,
        applicableResourceKinds: [RESOURCE_KIND.TEAM],
        policyVersion: "rest-v1",
      },
    }
  );
  assert.equal(findings[0].code, RESOURCE_FINDING_CODE.PREFERRED_REST_WARNING);
});

test("36. Court receives no rest finding", () => {
  const rk = key(RESOURCE_KIND.COURT, "court-1", SCOPE_TYPE.VENUE, "v1");
  const findings = detectRestViolations(
    [
      occ({ occupancyId: "a", assignmentId: "a1", resourceKey: rk, startMs: 0, endMs: 100 }),
      occ({ occupancyId: "b", assignmentId: "b1", resourceKey: rk, startMs: 110, endMs: 200 }),
    ],
    {
      restPolicy: {
        restMode: REST_MODE.MANDATORY,
        minimumRestMs: 50,
        applicableResourceKinds: [RESOURCE_KIND.PLAYER, RESOURCE_KIND.TEAM],
        policyVersion: "rest-v1",
      },
    }
  );
  assert.equal(findings.length, 0);
});

test("37. Deterministic consecutive ordering for rest", () => {
  const a = detectRestViolations(
    [
      occ({ occupancyId: "b", assignmentId: "b1", startMs: 200, endMs: 300 }),
      occ({ occupancyId: "a", assignmentId: "a1", startMs: 0, endMs: 100 }),
    ],
    {
      restPolicy: {
        restMode: REST_MODE.MANDATORY,
        minimumRestMs: 150,
        applicableResourceKinds: [RESOURCE_KIND.PLAYER],
        policyVersion: "rest-v1",
      },
    }
  );
  const b = detectRestViolations(
    [
      occ({ occupancyId: "a", assignmentId: "a1", startMs: 0, endMs: 100 }),
      occ({ occupancyId: "b", assignmentId: "b1", startMs: 200, endMs: 300 }),
    ],
    {
      restPolicy: {
        restMode: REST_MODE.MANDATORY,
        minimumRestMs: 150,
        applicableResourceKinds: [RESOURCE_KIND.PLAYER],
        policyVersion: "rest-v1",
      },
    }
  );
  assert.equal(a[0].findingId, b[0].findingId);
  assert.equal(a[0].evidence.actualRestMs, 100);
});

test("38. Zero minimum rest never emits rest findings for non-negative gaps", () => {
  const findings = detectRestViolations(
    [
      occ({ occupancyId: "a", assignmentId: "a1", startMs: 0, endMs: 100 }),
      occ({ occupancyId: "b", assignmentId: "b1", startMs: 100, endMs: 200 }),
    ],
    {
      restPolicy: {
        restMode: REST_MODE.MANDATORY,
        minimumRestMs: 0,
        applicableResourceKinds: [RESOURCE_KIND.PLAYER],
        policyVersion: "rest-v1",
      },
    }
  );
  assert.equal(findings.length, 0);
});

test("39. Invalid rest policy fails closed", () => {
  const result = detectResourceConflicts({
    occupancies: [rawOcc()],
    restPolicy: { restMode: "SOMETIMES", minimumRestMs: 10 },
  });
  assert.equal(result.evaluationStatus, EVALUATION_STATUS.REJECTED_INVALID_INPUT);
});

// ——— AVAILABILITY (40–49) ———

test("40. Authoritative available emits no finding", () => {
  const o = occ();
  const out = detectAvailabilityFindings(
    [o],
    [
      {
        resourceKey: o.resourceKey,
        occupancyId: o.occupancyId,
        startMs: o.startMs,
        endMs: o.endMs,
        status: AVAILABILITY_STATUS.AVAILABLE,
        providerVersion: "p1",
      },
    ],
    { availabilityMode: AVAILABILITY_MODE.AUTHORITATIVE }
  );
  assert.equal(out.findings.length, 0);
  assert.equal(out.authoritativeFailure, false);
  assert.equal(out.definitiveCount, 1);
});

test("41. Authoritative unavailable is HARD", () => {
  assert.equal(
    getMinimumSeverity(RESOURCE_FINDING_CODE.RESOURCE_UNAVAILABLE, {
      availabilityMode: AVAILABILITY_MODE.AUTHORITATIVE,
    }),
    SEVERITY.HARD
  );
  const o = occ();
  const out = detectAvailabilityFindings(
    [o],
    [
      {
        resourceKey: o.resourceKey,
        occupancyId: o.occupancyId,
        startMs: o.startMs,
        endMs: o.endMs,
        status: AVAILABILITY_STATUS.UNAVAILABLE,
        providerVersion: "p1",
      },
    ],
    { availabilityMode: AVAILABILITY_MODE.AUTHORITATIVE }
  );
  assert.equal(out.findings[0].severity, SEVERITY.HARD);
  assert.equal(out.findings[0].code, RESOURCE_FINDING_CODE.RESOURCE_UNAVAILABLE);
});

test("42. Authoritative unknown yields DATA_UNAVAILABLE", () => {
  const o = rawOcc();
  const result = detectResourceConflicts({
    occupancies: [o],
    availabilityCheckEnabled: true,
    availabilityMode: AVAILABILITY_MODE.AUTHORITATIVE,
    availabilityFacts: [
      {
        resourceKey: o.resourceKey,
        occupancyId: o.occupancyId,
        startMs: o.startMs,
        endMs: o.endMs,
        status: AVAILABILITY_STATUS.UNKNOWN,
        providerVersion: "p1",
      },
    ],
  });
  assert.equal(result.evaluationStatus, EVALUATION_STATUS.DATA_UNAVAILABLE);
  assert.equal(result.planStatus, PLAN_STATUS.NOT_EVALUATED);
  assert.equal(result.availabilityCertification, AVAILABILITY_CERTIFICATION.NOT_EVALUATED);
});

test("43. Advisory available emits no finding", () => {
  const o = occ();
  const out = detectAvailabilityFindings(
    [o],
    [
      {
        resourceKey: o.resourceKey,
        occupancyId: o.occupancyId,
        startMs: o.startMs,
        endMs: o.endMs,
        status: AVAILABILITY_STATUS.AVAILABLE,
        providerVersion: "p1",
      },
    ],
    { availabilityMode: AVAILABILITY_MODE.ADVISORY }
  );
  assert.equal(out.findings.length, 0);
});

test("44. Advisory unavailable is SOFT", () => {
  assert.equal(
    getMinimumSeverity(RESOURCE_FINDING_CODE.RESOURCE_UNAVAILABLE, {
      availabilityMode: AVAILABILITY_MODE.ADVISORY,
    }),
    SEVERITY.SOFT
  );
  const o = occ();
  const out = detectAvailabilityFindings(
    [o],
    [
      {
        resourceKey: o.resourceKey,
        occupancyId: o.occupancyId,
        startMs: o.startMs,
        endMs: o.endMs,
        status: AVAILABILITY_STATUS.UNAVAILABLE,
        providerVersion: "p1",
      },
    ],
    { availabilityMode: AVAILABILITY_MODE.ADVISORY }
  );
  assert.equal(out.findings[0].severity, SEVERITY.SOFT);
});

test("45. Advisory unknown yields PARTIAL certification", () => {
  const o = rawOcc();
  const result = detectResourceConflicts({
    occupancies: [o],
    availabilityCheckEnabled: true,
    availabilityMode: AVAILABILITY_MODE.ADVISORY,
    availabilityFacts: [
      {
        resourceKey: o.resourceKey,
        occupancyId: o.occupancyId,
        startMs: o.startMs,
        endMs: o.endMs,
        status: AVAILABILITY_STATUS.UNKNOWN,
        providerVersion: "p1",
      },
    ],
  });
  assert.equal(result.evaluationStatus, EVALUATION_STATUS.COMPLETED);
  assert.equal(result.planStatus, PLAN_STATUS.VALID_WITH_WARNINGS);
  assert.equal(result.availabilityCertification, AVAILABILITY_CERTIFICATION.PARTIAL);
});

test("46. Venue unavailable uses VENUE_UNAVAILABLE", () => {
  const rk = key(RESOURCE_KIND.VENUE, "venue-1", SCOPE_TYPE.GLOBAL, null);
  const o = occ({ resourceKey: rk, occupancyId: "v1", assignmentId: "a1" });
  const out = detectAvailabilityFindings(
    [o],
    [
      {
        resourceKey: rk,
        occupancyId: "v1",
        startMs: o.startMs,
        endMs: o.endMs,
        status: AVAILABILITY_STATUS.UNAVAILABLE,
        providerVersion: "p1",
      },
    ],
    { availabilityMode: AVAILABILITY_MODE.AUTHORITATIVE }
  );
  assert.equal(out.findings[0].code, RESOURCE_FINDING_CODE.VENUE_UNAVAILABLE);
});

test("47. No generic plus venue unavailable duplicate", () => {
  const rk = key(RESOURCE_KIND.VENUE, "venue-1", SCOPE_TYPE.GLOBAL, null);
  const generic = {
    code: RESOURCE_FINDING_CODE.RESOURCE_UNAVAILABLE,
    resourceKey: rk,
    occupancyIds: ["v1"],
    findingId: "g",
  };
  const venue = {
    code: RESOURCE_FINDING_CODE.VENUE_UNAVAILABLE,
    resourceKey: rk,
    occupancyIds: ["v1"],
    findingId: "v",
  };
  const retained = suppressDuplicateRootCauses([generic, venue]);
  assert.equal(retained.length, 1);
  assert.equal(retained[0].code, RESOURCE_FINDING_CODE.VENUE_UNAVAILABLE);
});

test("48. Explicit unavailable with complete data produces FULL certification", () => {
  const o = rawOcc();
  const result = detectResourceConflicts({
    occupancies: [o],
    availabilityCheckEnabled: true,
    availabilityMode: AVAILABILITY_MODE.ADVISORY,
    availabilityFacts: [
      {
        resourceKey: o.resourceKey,
        occupancyId: o.occupancyId,
        startMs: o.startMs,
        endMs: o.endMs,
        status: AVAILABILITY_STATUS.UNAVAILABLE,
        providerVersion: "p1",
      },
    ],
  });
  assert.equal(result.availabilityCertification, AVAILABILITY_CERTIFICATION.FULL);
  assert.equal(result.planStatus, PLAN_STATUS.VALID_WITH_WARNINGS);
});

test("49. Unknown is never treated as available", () => {
  const o = occ();
  const out = detectAvailabilityFindings(
    [o],
    [
      {
        resourceKey: o.resourceKey,
        occupancyId: o.occupancyId,
        startMs: o.startMs,
        endMs: o.endMs,
        status: AVAILABILITY_STATUS.UNKNOWN,
        providerVersion: "p1",
      },
    ],
    { availabilityMode: AVAILABILITY_MODE.ADVISORY }
  );
  assert.equal(out.findings.length, 0);
  assert.equal(out.unknownOrProviderFailureCount, 1);
  assert.equal(out.definitiveCount, 0);
});

// ——— ORCHESTRATION (50–68) ———

test("50. Invalid input rejected before detectors", () => {
  const result = detectResourceConflicts({
    occupancies: [{ occupancyId: "x", startMs: 1, endMs: 0 }],
  });
  assert.equal(result.evaluationStatus, EVALUATION_STATUS.REJECTED_INVALID_INPUT);
  assert.equal(result.planStatus, PLAN_STATUS.NOT_EVALUATED);
  assert.equal(result.findings.length, 0);
});

test("51. Duplicate occupancy diagnostic", () => {
  const result = detectResourceConflicts({
    occupancies: [
      rawOcc({ occupancyId: "dup", assignmentId: "a1" }),
      rawOcc({ occupancyId: "dup", assignmentId: "a2", startMs: 3000, endMs: 4000 }),
    ],
  });
  assert.equal(result.evaluationStatus, EVALUATION_STATUS.REJECTED_INVALID_INPUT);
  assert.equal(
    result.inputDiagnostics.some((d) => d.code === INPUT_DIAGNOSTIC_CODE.DUPLICATE_OCCUPANCY_ID),
    true
  );
});

test("52. Duplicate assignment diagnostic", () => {
  const result = detectResourceConflicts({
    occupancies: [
      rawOcc({ occupancyId: "o1", assignmentId: "same" }),
      rawOcc({ occupancyId: "o2", assignmentId: "same", startMs: 3000, endMs: 4000 }),
    ],
  });
  assert.equal(result.evaluationStatus, EVALUATION_STATUS.REJECTED_INVALID_INPUT);
  assert.equal(
    result.inputDiagnostics.some((d) => d.code === INPUT_DIAGNOSTIC_CODE.DUPLICATE_ASSIGNMENT),
    true
  );
});

test("53. Hard finding gives INVALID_HARD_CONFLICTS", () => {
  const result = detectResourceConflicts({
    occupancies: [
      rawOcc({ occupancyId: "a", assignmentId: "a1", startMs: 0, endMs: 100 }),
      rawOcc({ occupancyId: "b", assignmentId: "b1", startMs: 50, endMs: 150 }),
    ],
  });
  assert.equal(result.planStatus, PLAN_STATUS.INVALID_HARD_CONFLICTS);
});

test("54. Soft-only finding gives VALID_WITH_WARNINGS", () => {
  const result = detectResourceConflicts({
    occupancies: [
      rawOcc({ occupancyId: "a", assignmentId: "a1", startMs: 0, endMs: 100 }),
      rawOcc({ occupancyId: "b", assignmentId: "b1", startMs: 120, endMs: 220 }),
    ],
    restPolicy: {
      restMode: REST_MODE.PREFERRED,
      minimumRestMs: 50,
      applicableResourceKinds: [RESOURCE_KIND.PLAYER],
      policyVersion: "rest-v1",
    },
  });
  assert.equal(result.planStatus, PLAN_STATUS.VALID_WITH_WARNINGS);
  assert.equal(result.softFindingCount, 1);
});

test("55. No findings gives VALID", () => {
  const result = detectResourceConflicts({
    occupancies: [rawOcc()],
  });
  assert.equal(result.evaluationStatus, EVALUATION_STATUS.COMPLETED);
  assert.equal(result.planStatus, PLAN_STATUS.VALID);
});

test("56. Authoritative failure gives NOT_EVALUATED", () => {
  const o = rawOcc();
  const result = detectResourceConflicts({
    occupancies: [o],
    availabilityCheckEnabled: true,
    availabilityMode: AVAILABILITY_MODE.AUTHORITATIVE,
    availabilityFacts: [],
  });
  assert.equal(result.evaluationStatus, EVALUATION_STATUS.DATA_UNAVAILABLE);
  assert.equal(result.planStatus, PLAN_STATUS.NOT_EVALUATED);
});

test("57. recommendationCount remains zero", () => {
  const result = detectResourceConflicts({
    occupancies: [
      rawOcc({ occupancyId: "a", assignmentId: "a1", startMs: 0, endMs: 100 }),
      rawOcc({ occupancyId: "b", assignmentId: "b1", startMs: 50, endMs: 150 }),
    ],
  });
  assert.equal(result.recommendationCount, 0);
  assert.equal(result.recommendations.length, 0);
});

test("58. Deterministic finding IDs", () => {
  const req = {
    occupancies: [
      rawOcc({ occupancyId: "a", assignmentId: "a1", startMs: 0, endMs: 100 }),
      rawOcc({ occupancyId: "b", assignmentId: "b1", startMs: 50, endMs: 150 }),
    ],
  };
  const a = detectResourceConflicts(req);
  const b = detectResourceConflicts(req);
  assert.equal(a.findings[0].findingId, b.findings[0].findingId);
});

test("59. Deterministic result fingerprint", () => {
  const req = {
    occupancies: [
      rawOcc({ occupancyId: "a", assignmentId: "a1", startMs: 0, endMs: 100 }),
      rawOcc({ occupancyId: "b", assignmentId: "b1", startMs: 50, endMs: 150 }),
    ],
  };
  const a = detectResourceConflicts(req);
  const b = detectResourceConflicts(req);
  assert.equal(a.deterministicFingerprint, b.deterministicFingerprint);
});

test("60. Reordered equivalent request parity", () => {
  const a = detectResourceConflicts({
    occupancies: [
      rawOcc({ occupancyId: "a", assignmentId: "a1", startMs: 0, endMs: 100 }),
      rawOcc({ occupancyId: "b", assignmentId: "b1", startMs: 50, endMs: 150 }),
    ],
  });
  const b = detectResourceConflicts({
    occupancies: [
      rawOcc({ occupancyId: "b", assignmentId: "b1", startMs: 50, endMs: 150 }),
      rawOcc({ occupancyId: "a", assignmentId: "a1", startMs: 0, endMs: 100 }),
    ],
  });
  assert.equal(a.deterministicFingerprint, b.deterministicFingerprint);
  assert.deepEqual(
    a.findings.map((f) => f.findingId),
    b.findings.map((f) => f.findingId)
  );
});

test("61. Caller-input mutation safety", () => {
  const occupancies = [
    rawOcc({ occupancyId: "a", assignmentId: "a1", startMs: 0, endMs: 100 }),
    rawOcc({ occupancyId: "b", assignmentId: "b1", startMs: 50, endMs: 150 }),
  ];
  const snapshot = JSON.stringify(occupancies);
  detectResourceConflicts({ occupancies });
  assert.equal(JSON.stringify(occupancies), snapshot);
});

test("62. Independent court and referee conflicts both remain", () => {
  const court = key(RESOURCE_KIND.COURT, "c1", SCOPE_TYPE.VENUE, "v1");
  const ref = key(RESOURCE_KIND.REFEREE, "r1");
  const result = detectResourceConflicts({
    occupancies: [
      rawOcc({ occupancyId: "c-a", assignmentId: "m1-court", resourceKey: court, startMs: 0, endMs: 100 }),
      rawOcc({ occupancyId: "c-b", assignmentId: "m2-court", resourceKey: court, startMs: 50, endMs: 150 }),
      rawOcc({ occupancyId: "r-a", assignmentId: "m1-ref", resourceKey: ref, startMs: 0, endMs: 100 }),
      rawOcc({ occupancyId: "r-b", assignmentId: "m2-ref", resourceKey: ref, startMs: 50, endMs: 150 }),
    ],
  });
  assert.equal(result.findings.length, 2);
  const codes = result.findings.map((f) => f.code).sort();
  assert.deepEqual(codes, [
    RESOURCE_FINDING_CODE.COURT_TIME_OVERLAP,
    RESOURCE_FINDING_CODE.REFEREE_TIME_OVERLAP,
  ]);
});

test("63. Root-cause duplicate suppression for venue capacity", () => {
  const rk = key(RESOURCE_KIND.VENUE, "venue-1", SCOPE_TYPE.GLOBAL, null);
  const retained = suppressDuplicateRootCauses([
    {
      code: RESOURCE_FINDING_CODE.RESOURCE_CAPACITY_EXCEEDED,
      resourceKey: rk,
      occupancyIds: ["a", "b"],
      findingId: "generic",
    },
    {
      code: RESOURCE_FINDING_CODE.VENUE_CAPACITY_EXCEEDED,
      resourceKey: rk,
      occupancyIds: ["a", "b"],
      findingId: "venue",
    },
  ]);
  assert.equal(retained.length, 1);
  assert.equal(retained[0].code, RESOURCE_FINDING_CODE.VENUE_CAPACITY_EXCEEDED);
});

test("64. No adjacent CORE implementation imports", () => {
  const files = listJsFiles(RC_ROOT);
  const forbidden = [
    "competition-core/optimizer",
    "competition-core/scheduling",
    "competition-core/standings",
    "features/venue",
    "features/court",
  ];
  for (const file of files) {
    const text = readFileSync(file, "utf8");
    for (const needle of forbidden) {
      assert.equal(text.includes(needle), false, `${file} must not import ${needle}`);
    }
  }
});

test("65. No root competition-core export of resource-conflict", () => {
  assert.equal(existsSync(CC_INDEX), true);
  const text = readFileSync(CC_INDEX, "utf8");
  assert.equal(text.includes("resource-conflict"), false);
});

test("66. No Date.now or Math.random in detectors/services/policy", () => {
  const dirs = ["detectors", "services", "policy"].map((d) => path.join(RC_ROOT, d));
  for (const dir of dirs) {
    for (const file of listJsFiles(dir)) {
      const text = readFileSync(file, "utf8");
      assert.equal(text.includes("Date.now"), false, file);
      assert.equal(text.includes("Math.random"), false, file);
    }
  }
});

test("67. No production availability adapter", () => {
  const files = listJsFiles(RC_ROOT);
  for (const file of files) {
    const text = readFileSync(file, "utf8");
    assert.equal(/supabase/i.test(text), false, file);
    assert.equal(text.includes("createVenueAvailability"), false, file);
  }
  const o = occ();
  const facts = materializeAvailabilityFactsFromPort([o], {
    getResourceAvailability: () => ({
      status: AVAILABILITY_STATUS.AVAILABLE,
      providerVersion: "test-double",
    }),
  });
  assert.equal(facts.length, 1);
  assert.equal(facts[0].status, AVAILABILITY_STATUS.AVAILABLE);
});

test("68. Detection orchestration does not apply recommendations", () => {
  const detectorFiles = listJsFiles(path.join(RC_ROOT, "detectors"));
  for (const file of detectorFiles) {
    const text = readFileSync(file, "utf8");
    assert.equal(text.includes("recommendResolution"), false, file);
    assert.equal(text.includes("proposeResourceConflictResolutions"), false, file);
  }
  const detectService = path.join(RC_ROOT, "services/detectResourceConflicts.js");
  const detectText = readFileSync(detectService, "utf8");
  assert.equal(detectText.includes("proposeResourceConflictResolutions"), false);
  const result = detectResourceConflicts({ occupancies: [rawOcc()] });
  assert.equal(result.recommendationCount, 0);
  assert.deepEqual(result.recommendations, []);
});
