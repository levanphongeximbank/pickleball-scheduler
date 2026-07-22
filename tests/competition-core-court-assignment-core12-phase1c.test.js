/**
 * CORE-12 Phase 1C-R — TE compatibility + shadow parity certification.
 * Capability-local only. No production cutover.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  CORE12_COURT_ASSIGNMENT_SCHEMA_V1,
  CORE12_POLICY_VERSION,
  CORE12_TE_ADAPTER_CONTRACT_V1,
  CORE12_PARITY_CLASSIFICATION_PRECEDENCE_V1,
  CORE12_LEGACY_SOURCE_ANCHOR_V1,
  assignCourtsDeterministic,
  COURT_ASSIGNMENT_STATUS,
  COURT_AVAILABILITY_STATUS,
} from "../src/features/competition-core/court-assignment/index.js";

import {
  adaptTournamentEngineCourtAssignmentInput,
  TE_ADAPTER_MAPPING_CODE,
  normalizeLegacySuccessHeuristic,
  LEGACY_SUCCESS_CLASS,
} from "../src/features/competition-core/court-assignment/compatibility/index.js";

import {
  PARITY_CLASSIFICATION,
  PARITY_CLASSIFICATION_VALUES,
  PARITY_CLASSIFICATION_ENTRY_CONDITIONS,
  resolveFinalParityClassification,
  INTENTIONAL_DIVERGENCE_CATALOG,
  listIntentionalDivergenceIds,
  runShadowParity,
  runLegacyAssignCourtsReference,
  compareLegacyAndCore12CourtAssignment,
  LEGACY_SOURCE_ANCHOR,
  LEGACY_TE_COURT_ASSIGNMENT_SOURCE_PATH,
  detectLegacyTeCourtAssignmentDrift,
} from "../src/features/competition-core/court-assignment/parity/index.js";

import {
  createTeParityFixtureCatalog,
  TE_PARITY_FIXTURE_CATEGORY_COUNT,
  REQUIRED_TE_PARITY_FIXTURE_IDS,
  buildTeParityFixtureManifest,
  certifyTeParityFixtureManifest,
} from "../src/features/competition-core/court-assignment/fixtures/index.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CA_ROOT = path.join(
  ROOT,
  "src/features/competition-core/court-assignment"
);
const ROOT_BARREL = path.join(ROOT, "src/features/competition-core/index.js");
const TE_COURT_ENGINE = path.join(ROOT, LEGACY_TE_COURT_ASSIGNMENT_SOURCE_PATH);

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

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function baseAdapterInput(overrides = {}) {
  return {
    tenantId: "tenant-1",
    clubId: "club-1",
    venueId: "venue-1",
    competitionId: "comp-1",
    timezone: "Asia/Ho_Chi_Minh",
    requestId: "adapt-1",
    matches: [
      {
        id: "m1",
        scheduledStart: "2026-07-22T10:00:00Z",
        scheduledEnd: "2026-07-22T10:45:00Z",
        status: "waiting",
      },
    ],
    courtAvailabilitySnapshots: [
      {
        courtId: "c1",
        tenantId: "tenant-1",
        clubId: "club-1",
        venueId: "venue-1",
        availabilityStatus: COURT_AVAILABILITY_STATUS.AVAILABLE,
        active: true,
        eligible: true,
        priority: 10,
        capabilities: [],
        availabilityIntervals: [
          { start: "2026-07-22T00:00:00Z", end: "2026-07-22T23:59:00Z" },
        ],
      },
    ],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Fixture catalog / manifest certification
// ---------------------------------------------------------------------------

test("01 fixture catalog covers 30 required categories", () => {
  const catalog = createTeParityFixtureCatalog();
  assert.equal(catalog.length, TE_PARITY_FIXTURE_CATEGORY_COUNT);
  assert.equal(REQUIRED_TE_PARITY_FIXTURE_IDS.length, 30);
});

test("02 fixture-manifest certification (unique IDs, F01–F30, expected class)", () => {
  const cert = certifyTeParityFixtureManifest();
  assert.equal(cert.ok, true, cert.errors.join("; "));
  assert.equal(cert.fixtureCount, 30);
  const manifest = buildTeParityFixtureManifest();
  assert.equal(manifest.length, 30);
  for (const entry of manifest) {
    assert.ok(entry.fixtureId);
    assert.ok(entry.expectedClassification);
    assert.equal(typeof entry.representableByCore12, "boolean");
    assert.equal(typeof entry.legacyBehaviorSafe, "boolean");
  }
});

test("03 every catalog fixture executed; single final classification; stable repeat", () => {
  const catalog = createTeParityFixtureCatalog();
  /** @type {string[]} */
  const executed = [];
  for (const fx of catalog) {
    const a = runShadowParity(fx);
    const b = runShadowParity(fx);
    executed.push(fx.id);
    assert.equal(
      a.expectedMatched,
      true,
      `${fx.id} expected ${fx.expectedClassification} got ${a.finalClassification} candidates=${JSON.stringify(a.candidateClassifications)}`
    );
    assert.equal(a.finalClassification, fx.expectedClassification);
    assert.equal(a.finalClassification, a.primaryClassification);
    assert.equal(a.deterministicFingerprint, b.deterministicFingerprint);
    assert.equal(a.finalClassification, b.finalClassification);
    assert.ok(a.immutability.fixtureUnchanged, fx.id);
    assert.ok(a.immutability.legacyInputUnchanged, fx.id);
    assert.ok(a.immutability.adapterInputUnchanged, fx.id);
  }
  assert.equal(executed.length, 30);
  assert.deepEqual([...executed].sort(), [...REQUIRED_TE_PARITY_FIXTURE_IDS].sort());
});

// ---------------------------------------------------------------------------
// Adapter mapping
// ---------------------------------------------------------------------------

test("04 adapter mapping success", () => {
  const adapted = adaptTournamentEngineCourtAssignmentInput(baseAdapterInput());
  assert.equal(adapted.ok, true);
  assert.equal(adapted.adapterContractVersion, CORE12_TE_ADAPTER_CONTRACT_V1);
  const result = assignCourtsDeterministic(adapted.request);
  assert.equal(result.status, COURT_ASSIGNMENT_STATUS.SUCCESS);
});

test("05 adapter rejects missing venue / timezone-less / ambiguous lock", () => {
  assert.equal(
    adaptTournamentEngineCourtAssignmentInput(baseAdapterInput({ venueId: null }))
      .ok,
    false
  );
  assert.ok(
    adaptTournamentEngineCourtAssignmentInput(
      baseAdapterInput({
        matches: [
          {
            id: "m1",
            scheduledStart: "2026-07-22T10:00:00",
            scheduledEnd: "2026-07-22T10:45:00",
          },
        ],
      })
    ).failures.some((f) => f.code === TE_ADAPTER_MAPPING_CODE.TIMEZONE_LESS_INSTANT)
  );
  assert.ok(
    adaptTournamentEngineCourtAssignmentInput(
      baseAdapterInput({
        matches: [
          {
            id: "m1",
            scheduledStart: "2026-07-22T10:00:00Z",
            scheduledEnd: "2026-07-22T10:45:00Z",
            manualCourtLock: true,
          },
        ],
      })
    ).failures.some(
      (f) => f.code === TE_ADAPTER_MAPPING_CODE.AMBIGUOUS_LOCKED_ASSIGNMENT
    )
  );
});

test("06 adapter safety — missing snapshot / empty intervals fail-closed / cross venue / disabled", () => {
  assert.ok(
    adaptTournamentEngineCourtAssignmentInput(
      baseAdapterInput({ courtAvailabilitySnapshots: undefined })
    ).failures.some(
      (f) => f.code === TE_ADAPTER_MAPPING_CODE.MISSING_AVAILABILITY_SNAPSHOT
    )
  );

  // Empty availabilityIntervals is UNREPRESENTABLE (Phase 1C boundary — not Phase 1B unrestricted).
  const emptyIntervals = adaptTournamentEngineCourtAssignmentInput(
    baseAdapterInput({
      courtAvailabilitySnapshots: [
        {
          courtId: "c1",
          tenantId: "tenant-1",
          clubId: "club-1",
          venueId: "venue-1",
          availabilityStatus: COURT_AVAILABILITY_STATUS.AVAILABLE,
          availabilityIntervals: [],
        },
      ],
    })
  );
  assert.equal(emptyIntervals.ok, false);
  assert.ok(
    emptyIntervals.failures.some(
      (f) => f.code === TE_ADAPTER_MAPPING_CODE.EMPTY_COURT_AVAILABILITY
    )
  );
  assert.equal(emptyIntervals.request, null);

  // Null / missing intervals field
  const nullIntervals = adaptTournamentEngineCourtAssignmentInput(
    baseAdapterInput({
      courtAvailabilitySnapshots: [
        {
          courtId: "c1",
          tenantId: "tenant-1",
          clubId: "club-1",
          venueId: "venue-1",
          availabilityIntervals: null,
        },
      ],
    })
  );
  assert.equal(nullIntervals.ok, false);
  assert.ok(
    nullIntervals.failures.some(
      (f) => f.code === TE_ADAPTER_MAPPING_CODE.EMPTY_COURT_AVAILABILITY
    )
  );

  const missingField = adaptTournamentEngineCourtAssignmentInput(
    baseAdapterInput({
      courtAvailabilitySnapshots: [
        {
          courtId: "c1",
          tenantId: "tenant-1",
          clubId: "club-1",
          venueId: "venue-1",
        },
      ],
    })
  );
  assert.equal(missingField.ok, false);
  assert.ok(
    missingField.failures.some(
      (f) => f.code === TE_ADAPTER_MAPPING_CODE.EMPTY_COURT_AVAILABILITY
    )
  );

  // Non-array intervals
  const notArray = adaptTournamentEngineCourtAssignmentInput(
    baseAdapterInput({
      courtAvailabilitySnapshots: [
        {
          courtId: "c1",
          tenantId: "tenant-1",
          clubId: "club-1",
          venueId: "venue-1",
          availabilityIntervals: "all-day",
        },
      ],
    })
  );
  assert.equal(notArray.ok, false);
  assert.ok(
    notArray.failures.some(
      (f) => f.code === TE_ADAPTER_MAPPING_CODE.INVALID_AVAILABILITY_INTERVAL
    )
  );

  // Only invalid intervals
  const onlyInvalid = adaptTournamentEngineCourtAssignmentInput(
    baseAdapterInput({
      courtAvailabilitySnapshots: [
        {
          courtId: "c1",
          tenantId: "tenant-1",
          clubId: "club-1",
          venueId: "venue-1",
          availabilityIntervals: [
            { start: "2026-07-22T10:00:00", end: "2026-07-22T11:00:00" },
          ],
        },
      ],
    })
  );
  assert.equal(onlyInvalid.ok, false);

  // Mixed valid + invalid → deterministic reject (no partial keep of valid intervals)
  const mixed = adaptTournamentEngineCourtAssignmentInput(
    baseAdapterInput({
      courtAvailabilitySnapshots: [
        {
          courtId: "c1",
          tenantId: "tenant-1",
          clubId: "club-1",
          venueId: "venue-1",
          availabilityIntervals: [
            { start: "2026-07-22T00:00:00Z", end: "2026-07-22T23:59:00Z" },
            { start: "bad", end: "also-bad" },
          ],
        },
      ],
    })
  );
  assert.equal(mixed.ok, false);
  assert.ok(
    mixed.failures.some(
      (f) =>
        f.code === TE_ADAPTER_MAPPING_CODE.INVALID_AVAILABILITY_INTERVAL ||
        f.code === TE_ADAPTER_MAPPING_CODE.TIMEZONE_LESS_INSTANT ||
        f.code === TE_ADAPTER_MAPPING_CODE.INVALID_CALENDAR_INSTANT
    )
  );

  // Match interval present but empty court availability
  const matchNoAvail = adaptTournamentEngineCourtAssignmentInput(
    baseAdapterInput({
      courtAvailabilitySnapshots: [
        {
          courtId: "c1",
          tenantId: "tenant-1",
          clubId: "club-1",
          venueId: "venue-1",
          availabilityIntervals: [],
        },
      ],
    })
  );
  assert.equal(matchNoAvail.ok, false);

  // Tournament window present but empty court availability
  const windowEmpty = adaptTournamentEngineCourtAssignmentInput({
    ...baseAdapterInput({
      courtAvailabilitySnapshots: [
        {
          courtId: "c1",
          tenantId: "tenant-1",
          clubId: "club-1",
          venueId: "venue-1",
          availabilityIntervals: [],
        },
      ],
    }),
    scheduleConfig: { date: "2026-07-22", startTime: "08:00", endTime: "18:00" },
  });
  assert.equal(windowEmpty.ok, false);
  assert.ok(
    windowEmpty.failures.some(
      (f) => f.code === TE_ADAPTER_MAPPING_CODE.EMPTY_COURT_AVAILABILITY
    )
  );

  // Court enabled but empty availability
  const enabledEmpty = adaptTournamentEngineCourtAssignmentInput(
    baseAdapterInput({
      courtAvailabilitySnapshots: [
        {
          courtId: "c1",
          tenantId: "tenant-1",
          clubId: "club-1",
          venueId: "venue-1",
          active: true,
          eligible: true,
          availabilityStatus: COURT_AVAILABILITY_STATUS.AVAILABLE,
          availabilityIntervals: [],
        },
      ],
    })
  );
  assert.equal(enabledEmpty.ok, false);

  // One valid interval maps successfully
  const oneValid = adaptTournamentEngineCourtAssignmentInput(baseAdapterInput());
  assert.equal(oneValid.ok, true);
  assert.equal(oneValid.request.courts[0].availabilityIntervals.length, 1);

  // Empty snapshots array still maps (no courts) — distinct from empty intervals
  const noCourts = adaptTournamentEngineCourtAssignmentInput(
    baseAdapterInput({ courtAvailabilitySnapshots: [] })
  );
  assert.equal(noCourts.ok, true);
  assert.equal(noCourts.request.courts.length, 0);

  // Adjacent intervals that do not individually cover the match — mapping succeeds; assign infeasible.
  const adjacent = adaptTournamentEngineCourtAssignmentInput(
    baseAdapterInput({
      matches: [
        {
          id: "m1",
          scheduledStart: "2026-07-22T09:30:00Z",
          scheduledEnd: "2026-07-22T10:30:00Z",
        },
      ],
      courtAvailabilitySnapshots: [
        {
          courtId: "c1",
          tenantId: "tenant-1",
          clubId: "club-1",
          venueId: "venue-1",
          availabilityStatus: COURT_AVAILABILITY_STATUS.AVAILABLE,
          availabilityIntervals: [
            { start: "2026-07-22T08:00:00Z", end: "2026-07-22T10:00:00Z" },
            { start: "2026-07-22T10:00:00Z", end: "2026-07-22T12:00:00Z" },
          ],
        },
      ],
    })
  );
  assert.equal(adjacent.ok, true);
  const adjResult = assignCourtsDeterministic(adjacent.request);
  assert.equal(adjResult.status, COURT_ASSIGNMENT_STATUS.INFEASIBLE);

  // Court exists but disabled (with explicit intervals)
  const disabled = adaptTournamentEngineCourtAssignmentInput(
    baseAdapterInput({
      courtAvailabilitySnapshots: [
        {
          courtId: "c1",
          tenantId: "tenant-1",
          clubId: "club-1",
          venueId: "venue-1",
          locked: true,
          eligible: false,
          availabilityIntervals: [
            { start: "2026-07-22T00:00:00Z", end: "2026-07-22T23:59:00Z" },
          ],
        },
      ],
    })
  );
  assert.equal(disabled.ok, true);
  assert.equal(disabled.request.courts[0].eligible, false);

  // Other venue on snapshot
  assert.ok(
    adaptTournamentEngineCourtAssignmentInput(
      baseAdapterInput({
        courtAvailabilitySnapshots: [
          {
            courtId: "c1",
            tenantId: "tenant-1",
            clubId: "club-1",
            venueId: "venue-OTHER",
            availabilityIntervals: [
              { start: "2026-07-22T00:00:00Z", end: "2026-07-22T23:59:00Z" },
            ],
          },
        ],
      })
    ).failures.some((f) => f.code === TE_ADAPTER_MAPPING_CODE.CROSS_SCOPE_DATA)
  );

  // Missing scope
  assert.ok(
    adaptTournamentEngineCourtAssignmentInput(
      baseAdapterInput({ tenantId: null, competitionId: null })
    ).failures.length >= 2
  );

  // Unknown manual court lock (representable; CORE-12 conflicts later)
  const unknownLock = adaptTournamentEngineCourtAssignmentInput(
    baseAdapterInput({
      matches: [
        {
          id: "m1",
          scheduledStart: "2026-07-22T10:00:00Z",
          scheduledEnd: "2026-07-22T10:45:00Z",
          courtId: "missing-court",
          manualCourtLock: true,
        },
      ],
    })
  );
  assert.equal(unknownLock.ok, true);

  // Malformed / invalid calendar date
  assert.ok(
    adaptTournamentEngineCourtAssignmentInput(
      baseAdapterInput({
        matches: [
          {
            id: "m1",
            scheduledStart: "2026-02-30T10:00:00Z",
            scheduledEnd: "2026-02-30T10:45:00Z",
          },
        ],
      })
    ).ok === false
  );

  // Permuted empty-availability courts → stable rejection ordering
  const permA = adaptTournamentEngineCourtAssignmentInput(
    baseAdapterInput({
      courtAvailabilitySnapshots: [
        {
          courtId: "c-b",
          tenantId: "tenant-1",
          clubId: "club-1",
          venueId: "venue-1",
          availabilityIntervals: [],
        },
        {
          courtId: "c-a",
          tenantId: "tenant-1",
          clubId: "club-1",
          venueId: "venue-1",
          availabilityIntervals: [],
        },
      ],
    })
  );
  const permB = adaptTournamentEngineCourtAssignmentInput(
    baseAdapterInput({
      courtAvailabilitySnapshots: [
        {
          courtId: "c-a",
          tenantId: "tenant-1",
          clubId: "club-1",
          venueId: "venue-1",
          availabilityIntervals: [],
        },
        {
          courtId: "c-b",
          tenantId: "tenant-1",
          clubId: "club-1",
          venueId: "venue-1",
          availabilityIntervals: [],
        },
      ],
    })
  );
  assert.equal(permA.ok, false);
  assert.equal(permB.ok, false);
  assert.deepEqual(
    permA.failures.map((f) => `${f.code}:${f.details.courtId}`),
    permB.failures.map((f) => `${f.code}:${f.details.courtId}`)
  );

  // No usable request / no empty-interval AvailableCourtInput emitted
  assert.equal(permA.request, null);
});

test("06b empty availability parity classification is UNREPRESENTABLE", () => {
  const adapterInput = baseAdapterInput({
    courtAvailabilitySnapshots: [
      {
        courtId: "c1",
        tenantId: "tenant-1",
        clubId: "club-1",
        venueId: "venue-1",
        active: true,
        eligible: true,
        availabilityIntervals: [],
      },
    ],
  });
  const report = runShadowParity({
    id: "empty-avail-contract",
    expectedClassification: PARITY_CLASSIFICATION.UNREPRESENTABLE_LEGACY_INPUT,
    legacyUnsafe: true,
    legacyUnsafeReason:
      "legacy LEGACY-mode may still assign without availability snapshots",
    adapterInput,
    legacyContext: {
      matches: [
        {
          id: "m1",
          status: "waiting",
          scheduledStart: "2026-07-22T10:00:00Z",
          scheduledEnd: "2026-07-22T10:45:00Z",
        },
      ],
      courts: [{ id: "c1", name: "Court A", priority: 10, locked: false }],
    },
  });
  assert.equal(
    report.finalClassification,
    PARITY_CLASSIFICATION.UNREPRESENTABLE_LEGACY_INPUT
  );
  assert.ok(
    report.findings.some(
      (f) => f.classification === PARITY_CLASSIFICATION.LEGACY_UNSAFE
    )
  );
  assert.equal(report.adapter.ok, false);
  assert.equal(report.adapter.request, null);
});

test("07 adapter does not invent availability or mutate input", () => {
  const input = baseAdapterInput();
  const before = deepClone(input);
  const adapted = adaptTournamentEngineCourtAssignmentInput(input);
  assert.deepEqual(input, before);
  assert.equal(adapted.ok, true);
  // Must not invent a second court or all-day windows beyond explicit snapshots.
  assert.equal(adapted.request.courts.length, 1);
  assert.deepEqual(adapted.request.courts[0].availabilityIntervals, [
    { start: "2026-07-22T00:00:00Z", end: "2026-07-22T23:59:00Z" },
  ]);
  assert.ok(adapted.request.courts[0].availabilityIntervals.length >= 1);
});

// ---------------------------------------------------------------------------
// Legacy source anchor (Model B)
// ---------------------------------------------------------------------------

test("08 legacy source-anchor Model B + drift detector", () => {
  assert.equal(LEGACY_SOURCE_ANCHOR.model, "FROZEN_BEHAVIORAL_REFERENCE");
  assert.equal(LEGACY_SOURCE_ANCHOR.anchorVersion, CORE12_LEGACY_SOURCE_ANCHOR_V1);
  assert.ok(existsSync(TE_COURT_ENGINE));
  const src = readFileSync(TE_COURT_ENGINE, "utf8");
  const drift = detectLegacyTeCourtAssignmentDrift(src);
  assert.equal(drift.ok, true, JSON.stringify(drift));
  assert.equal(drift.drifted, false);
  // Tamper detection
  const tampered = detectLegacyTeCourtAssignmentDrift(src + "\n// tamper");
  assert.equal(tampered.drifted, true);
});

test("09 legacy reference harness mirrors unsafe first-court + lock gap", () => {
  const noTime = runLegacyAssignCourtsReference({
    matches: [{ id: "m1", status: "waiting" }],
    courts: [
      { id: "c1", name: "Court A", priority: 1, locked: false },
      { id: "c2", name: "Court B", priority: 10, locked: false },
    ],
  });
  assert.equal(noTime.ok, true);
  assert.equal(noTime.data.assignments[0].courtId, "c2");

  const lockGap = runLegacyAssignCourtsReference({
    matches: [
      {
        id: "m1",
        status: "waiting",
        scheduledStart: "2026-07-22T10:00:00Z",
        scheduledEnd: "2026-07-22T10:45:00Z",
        courtId: "c1",
        manualCourtLock: true,
      },
      {
        id: "m2",
        status: "waiting",
        scheduledStart: "2026-07-22T10:00:00Z",
        scheduledEnd: "2026-07-22T10:45:00Z",
      },
    ],
    courts: [{ id: "c1", name: "Court A", priority: 10, locked: false }],
  });
  // Legacy does not register lock on courtSchedule → may still assign m2 to c1.
  assert.equal(lockGap.ok, true);
  assert.ok(lockGap.data.assignments.some((a) => a.matchId === "m2"));
});

// ---------------------------------------------------------------------------
// Classification / heuristic / divergences
// ---------------------------------------------------------------------------

test("10 classification precedence is mutually exclusive and versioned", () => {
  assert.equal(
    PARITY_CLASSIFICATION_ENTRY_CONDITIONS.version,
    CORE12_PARITY_CLASSIFICATION_PRECEDENCE_V1
  );
  assert.equal(
    resolveFinalParityClassification([
      PARITY_CLASSIFICATION.EXACT_PARITY,
      PARITY_CLASSIFICATION.UNREPRESENTABLE_LEGACY_INPUT,
      PARITY_CLASSIFICATION.LEGACY_UNSAFE,
    ]),
    PARITY_CLASSIFICATION.UNREPRESENTABLE_LEGACY_INPUT
  );
  assert.equal(
    resolveFinalParityClassification([
      PARITY_CLASSIFICATION.INTENTIONAL_DIVERGENCE,
      PARITY_CLASSIFICATION.SEMANTIC_PARITY,
      PARITY_CLASSIFICATION.EXACT_PARITY,
    ]),
    PARITY_CLASSIFICATION.INTENTIONAL_DIVERGENCE
  );
});

test("11 legacy ok heuristic normalized; not mapped to CORE-12 SUCCESS", () => {
  const partialOk = {
    ok: true,
    data: {
      assignments: [{ matchId: "m1", courtId: "c1" }],
      conflicts: [{ matchId: "m2", message: "x" }],
    },
  };
  const norm = normalizeLegacySuccessHeuristic(partialOk);
  assert.equal(norm.successClass, LEGACY_SUCCESS_CLASS.PARTIAL_REPORTED_OK);
  assert.equal(norm.ambiguousHeuristic, true);

  const fx = createTeParityFixtureCatalog().find(
    (f) => f.id === "F22_legacy_ambiguous_ok"
  );
  const report = runShadowParity(fx);
  assert.equal(
    report.finalClassification,
    PARITY_CLASSIFICATION.INTENTIONAL_DIVERGENCE
  );
  assert.notEqual(report.core12Result?.status, COURT_ASSIGNMENT_STATUS.SUCCESS);
  assert.ok(
    report.findings.some(
      (f) => f.details && f.details.legacyOkNotMappedToCore12Success === true
    )
  );
});

test("12 intentional divergence catalog traceability", () => {
  assert.equal(INTENTIONAL_DIVERGENCE_CATALOG.length, 12);
  const ids = listIntentionalDivergenceIds();
  assert.equal(new Set(ids).size, ids.length);
  const catalog = createTeParityFixtureCatalog();
  const fixtureIds = new Set(catalog.map((f) => f.id));
  for (const entry of INTENTIONAL_DIVERGENCE_CATALOG) {
    assert.ok(entry.fixtureIds.length >= 1, entry.id);
    for (const fid of entry.fixtureIds) {
      assert.ok(fixtureIds.has(fid), `${entry.id} → ${fid}`);
    }
    assert.ok(entry.approvedInvariant);
    assert.equal(typeof entry.productionCompatibilityRemaining, "boolean");
  }
  for (const fx of catalog) {
    for (const d of fx.divergenceIds || []) {
      assert.ok(
        INTENTIONAL_DIVERGENCE_CATALOG.some((e) => e.id === d),
        `${fx.id} unknown divergence ${d}`
      );
    }
  }
});

test("13 classification vocabulary complete", () => {
  assert.deepEqual(
    [...PARITY_CLASSIFICATION_VALUES].sort(),
    [
      "CORE12_REGRESSION",
      "EXACT_PARITY",
      "FIXTURE_INVALID",
      "INTENTIONAL_DIVERGENCE",
      "LEGACY_UNSAFE",
      "SEMANTIC_PARITY",
      "UNREPRESENTABLE_LEGACY_INPUT",
    ]
  );
});

// ---------------------------------------------------------------------------
// Production export / isolation
// ---------------------------------------------------------------------------

test("14 production index does not export parity/fixtures/legacy harness/adapter", async () => {
  const prod = await import(
    "../src/features/competition-core/court-assignment/index.js"
  );
  assert.equal(prod.runShadowParity, undefined);
  assert.equal(prod.adaptTournamentEngineCourtAssignmentInput, undefined);
  assert.equal(prod.createTeParityFixtureCatalog, undefined);
  assert.equal(prod.runLegacyAssignCourtsReference, undefined);
  assert.equal(prod.detectLegacyTeCourtAssignmentDrift, undefined);
  assert.equal(typeof prod.assignCourtsDeterministic, "function");
  assert.ok(prod.CORE12_TE_ADAPTER_CONTRACT_V1);
  assert.ok(prod.CORE12_SHADOW_PARITY_V1);
  assert.ok(prod.CORE12_PARITY_CLASSIFICATION_PRECEDENCE_V1);
  assert.ok(prod.CORE12_LEGACY_SOURCE_ANCHOR_V1);
  assert.ok(prod.CORE12_DIVERGENCE_CATALOG_V1);
});

test("15 adapters barrel does not export TE adapter; compatibility does", async () => {
  const adapters = await import(
    "../src/features/competition-core/court-assignment/adapters/index.js"
  );
  assert.equal(adapters.adaptTournamentEngineCourtAssignmentInput, undefined);
  assert.equal(typeof adapters.createFailClosedCourtAssignmentPort, "function");
  const compat = await import(
    "../src/features/competition-core/court-assignment/compatibility/index.js"
  );
  assert.equal(typeof compat.adaptTournamentEngineCourtAssignmentInput, "function");
});

test("16 root competition-core export audit", () => {
  assert.ok(existsSync(ROOT_BARREL));
  const src = readFileSync(ROOT_BARREL, "utf8");
  assert.doesNotMatch(src, /court-assignment/);
  assert.doesNotMatch(src, /CORE12_/);
  assert.doesNotMatch(src, /runShadowParity/);
});

test("17 production index source does not transitively load parity/fixtures", () => {
  const prodSrc = readFileSync(path.join(CA_ROOT, "index.js"), "utf8");
  assert.doesNotMatch(prodSrc, /\/parity\//);
  assert.doesNotMatch(prodSrc, /\/fixtures\//);
  assert.doesNotMatch(prodSrc, /legacyReferenceAssignCourts/);
  assert.doesNotMatch(prodSrc, /te-compat/);
  assert.doesNotMatch(prodSrc, /runShadowParity/);
});

test("18 forbidden import / runtime API / TE modification audits", () => {
  const phase1cDirs = [
    path.join(CA_ROOT, "adapters/te-compat"),
    path.join(CA_ROOT, "compatibility"),
    path.join(CA_ROOT, "parity"),
    path.join(CA_ROOT, "fixtures"),
  ];
  const forbidden = [
    "competitionCourtAvailabilityAdapter",
    "getCompetitionCourtAvailability",
    "courtAvailabilityService",
    "@supabase",
    "createClient",
    "from \"react\"",
    "from 'react'",
    "pages/",
    "resource-conflict/",
    "optimizer/",
  ];
  const forbiddenApis = ["Date.now(", "Math.random(", "randomUUID(", "crypto.random"];
  for (const dir of phase1cDirs) {
    for (const file of listJsFiles(dir)) {
      const src = readFileSync(file, "utf8");
      for (const needle of forbidden) {
        assert.equal(src.includes(needle), false, `${file} :: ${needle}`);
      }
      assert.doesNotMatch(src, /from\s+['"][^'"]*tournament-engine[^'"]*['"]/);
      // Allow node:crypto only in legacySourceAnchor drift detector.
      if (!file.replace(/\\/g, "/").endsWith("/parity/legacySourceAnchor.js")) {
        for (const api of forbiddenApis) {
          assert.equal(src.includes(api), false, `${file} :: ${api}`);
        }
        assert.doesNotMatch(src, /from\s+["']node:crypto["']/);
      }
    }
  }
  const teRoot = path.join(ROOT, "src/features/tournament-engine");
  for (const file of listJsFiles(teRoot)) {
    assert.doesNotMatch(
      readFileSync(file, "utf8"),
      /competition-core\/court-assignment/
    );
  }
  const teSrc = readFileSync(TE_COURT_ENGINE, "utf8");
  assert.match(teSrc, /export function assignCourts/);
  assert.doesNotMatch(teSrc, /assignCourtsDeterministic/);
});

test("19 Phase 1B behavior gate + deterministic permuted adapter requests", () => {
  const result = assignCourtsDeterministic({
    schemaVersion: CORE12_COURT_ASSIGNMENT_SCHEMA_V1,
    requestId: "p1b-gate",
    tenantId: "tenant-1",
    clubId: "club-1",
    venueId: "venue-1",
    competitionId: "comp-1",
    timezone: "Asia/Ho_Chi_Minh",
    matches: [
      {
        matchId: "m1",
        competitionId: "comp-1",
        tenantId: "tenant-1",
        venueId: "venue-1",
        clubId: "club-1",
        scheduledStart: "2026-07-22T10:00:00Z",
        scheduledEnd: "2026-07-22T10:45:00Z",
      },
    ],
    courts: [
      {
        courtId: "court-a",
        tenantId: "tenant-1",
        venueId: "venue-1",
        clubId: "club-1",
        availabilityStatus: COURT_AVAILABILITY_STATUS.AVAILABLE,
        availabilityIntervals: [
          { start: "2026-07-22T00:00:00Z", end: "2026-07-22T23:59:00Z" },
        ],
      },
    ],
    lockedAssignments: [],
    constraints: [],
    policy: { policyId: "pol", policyVersion: CORE12_POLICY_VERSION },
    availabilitySnapshotRef: {
      snapshotId: "a",
      snapshotVersion: "v1",
      fingerprint: "aa",
    },
    scheduleSnapshotRef: {
      snapshotId: "s",
      snapshotVersion: "v1",
      fingerprint: "bb",
    },
  });
  assert.equal(result.status, COURT_ASSIGNMENT_STATUS.SUCCESS);

  const a = adaptTournamentEngineCourtAssignmentInput(
    baseAdapterInput({
      requestId: "perm",
      matches: [
        {
          id: "m2",
          scheduledStart: "2026-07-22T11:00:00Z",
          scheduledEnd: "2026-07-22T11:45:00Z",
        },
        {
          id: "m1",
          scheduledStart: "2026-07-22T10:00:00Z",
          scheduledEnd: "2026-07-22T10:45:00Z",
        },
      ],
      courtAvailabilitySnapshots: [
        {
          courtId: "c2",
          tenantId: "tenant-1",
          clubId: "club-1",
          venueId: "venue-1",
          availabilityStatus: COURT_AVAILABILITY_STATUS.AVAILABLE,
          priority: 5,
          availabilityIntervals: [
            { start: "2026-07-22T00:00:00Z", end: "2026-07-22T23:59:00Z" },
          ],
        },
        {
          courtId: "c1",
          tenantId: "tenant-1",
          clubId: "club-1",
          venueId: "venue-1",
          availabilityStatus: COURT_AVAILABILITY_STATUS.AVAILABLE,
          priority: 10,
          availabilityIntervals: [
            { start: "2026-07-22T00:00:00Z", end: "2026-07-22T23:59:00Z" },
          ],
        },
      ],
    })
  );
  const b = adaptTournamentEngineCourtAssignmentInput(
    baseAdapterInput({
      requestId: "perm",
      matches: [
        {
          id: "m1",
          scheduledStart: "2026-07-22T10:00:00Z",
          scheduledEnd: "2026-07-22T10:45:00Z",
        },
        {
          id: "m2",
          scheduledStart: "2026-07-22T11:00:00Z",
          scheduledEnd: "2026-07-22T11:45:00Z",
        },
      ],
      courtAvailabilitySnapshots: [
        {
          courtId: "c1",
          tenantId: "tenant-1",
          clubId: "club-1",
          venueId: "venue-1",
          availabilityStatus: COURT_AVAILABILITY_STATUS.AVAILABLE,
          priority: 10,
          availabilityIntervals: [
            { start: "2026-07-22T00:00:00Z", end: "2026-07-22T23:59:00Z" },
          ],
        },
        {
          courtId: "c2",
          tenantId: "tenant-1",
          clubId: "club-1",
          venueId: "venue-1",
          availabilityStatus: COURT_AVAILABILITY_STATUS.AVAILABLE,
          priority: 5,
          availabilityIntervals: [
            { start: "2026-07-22T00:00:00Z", end: "2026-07-22T23:59:00Z" },
          ],
        },
      ],
    })
  );
  assert.deepEqual(
    a.request.matches.map((m) => m.matchId),
    b.request.matches.map((m) => m.matchId)
  );
  assert.equal(
    assignCourtsDeterministic(a.request).resultFingerprint,
    assignCourtsDeterministic(b.request).resultFingerprint
  );
});

test("20 compareLegacy finds stable ordering for multi-candidate fixtures", () => {
  const report = compareLegacyAndCore12CourtAssignment({
    fixtureId: "order-check",
    adapterOk: false,
    adapterFailures: [{ code: "X" }],
    expectedClassification: PARITY_CLASSIFICATION.UNREPRESENTABLE_LEGACY_INPUT,
    legacyUnsafe: true,
    divergenceIds: ["DET_ORDERING", "NO_AMBIGUOUS_OK"],
  });
  assert.equal(
    report.finalClassification,
    PARITY_CLASSIFICATION.UNREPRESENTABLE_LEGACY_INPUT
  );
  assert.equal(report.findings[0].classification, PARITY_CLASSIFICATION.UNREPRESENTABLE_LEGACY_INPUT);
});
