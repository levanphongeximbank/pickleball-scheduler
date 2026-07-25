/**
 * I&A-07 — Venue, Court and Club Analytics certification tests.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import * as IA from "../src/features/intelligence-analytics/index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MODULE_ROOT = path.resolve(
  __dirname,
  "../src/features/intelligence-analytics"
);
const VCC_ROOT = path.join(MODULE_ROOT, "venue-court-club-analytics");

const SOURCE = Object.freeze({
  sourceId: "venue-court-club-analytics-explicit",
  sourceKind: "explicit_input",
  ownerModule: "intelligence-analytics",
  reference: "ia-07-certification",
});

const PROVENANCE = Object.freeze({
  source: SOURCE,
  observedAt: "2026-07-20T12:00:00.000Z",
  ingestedAt: "2026-07-20T12:05:00.000Z",
  transformer: "in-memory-venue-court-club-analytics",
});

const FIXED_NOW = "2026-07-25T00:00:00.000Z";
const TENANT = "tenant-a";
const VENUE = "venue-1";
const COURT_A = "court-a";
const COURT_B = "court-b";
const CLUB = "club-1";

function tenantScope(overrides = {}) {
  return {
    kind: IA.ANALYTICS_TENANT_SCOPE_KIND.TENANT,
    tenantId: TENANT,
    ...overrides,
  };
}

function context(overrides = {}) {
  return {
    tenantScope: tenantScope(),
    ...overrides,
  };
}

function identity(overrides = {}) {
  return {
    tenantId: TENANT,
    provenance: PROVENANCE,
    sourceTimestamp: "2026-07-20T12:00:00.000Z",
    canonicalSourceRef: "explicit-certification-snapshot",
    ...overrides,
  };
}

function baseSnapshot(overrides = {}) {
  return {
    context: context(),
    provenance: PROVENANCE,
    freshness: IA.ANALYTICS_FRESHNESS_STATE.FRESH,
    completeness: IA.VENUE_COURT_CLUB_ANALYTICS_COMPLETENESS.COMPLETE,
    sourceTimestamp: "2026-07-20T12:00:00.000Z",
    venues: [
      { ...identity(), venueId: VENUE, status: "ACTIVE", capacity: 8 },
      { ...identity(), venueId: "venue-2", status: "INACTIVE" },
    ],
    venueOperatingHours: [
      {
        ...identity(),
        venueId: VENUE,
        configured: true,
        configuredMinutes: 600,
        dayKey: "mon",
      },
      {
        ...identity(),
        venueId: VENUE,
        configured: true,
        configuredMinutes: 600,
        dayKey: "tue",
      },
      {
        ...identity(),
        venueId: "venue-2",
        configured: false,
      },
    ],
    venueCapacities: [
      { ...identity(), venueId: VENUE, capacity: 8, courtCount: 2 },
    ],
    courts: [
      {
        ...identity(),
        courtId: COURT_A,
        venueId: VENUE,
        status: "ACTIVE",
        courtType: "indoor",
      },
      {
        ...identity(),
        courtId: COURT_B,
        venueId: VENUE,
        status: "ACTIVE",
        courtType: "outdoor",
      },
      {
        ...identity(),
        courtId: "court-c",
        venueId: "venue-2",
        status: "INACTIVE",
        courtType: "indoor",
      },
    ],
    courtStatuses: [
      { ...identity(), courtId: COURT_A, venueId: VENUE, status: "ACTIVE" },
      { ...identity(), courtId: COURT_B, venueId: VENUE, status: "ACTIVE" },
      { ...identity(), courtId: "court-c", venueId: "venue-2", status: "INACTIVE" },
    ],
    courtAvailabilities: [
      {
        ...identity(),
        courtId: COURT_A,
        venueId: VENUE,
        availabilityStatus: "AVAILABLE",
        eligibleMinutes: 600,
      },
      {
        ...identity(),
        courtId: COURT_B,
        venueId: VENUE,
        availabilityStatus: "UNAVAILABLE",
        unavailableReason: "BOOKING_CONFLICT",
        eligibleMinutes: 600,
      },
    ],
    courtBookings: [
      {
        ...identity(),
        bookingId: "b1",
        courtId: COURT_A,
        venueId: VENUE,
        status: "CONFIRMED",
        bookedMinutes: 90,
      },
      {
        ...identity(),
        bookingId: "b2",
        courtId: COURT_A,
        venueId: VENUE,
        status: "COMPLETED",
        bookedMinutes: 60,
      },
      {
        ...identity(),
        bookingId: "b3",
        courtId: COURT_B,
        venueId: VENUE,
        status: "CANCELLED",
        bookedMinutes: 120,
      },
    ],
    courtMaintenances: [
      {
        ...identity(),
        maintenanceId: "m1",
        courtId: COURT_B,
        venueId: VENUE,
        category: "SURFACE",
      },
    ],
    courtDowntimes: [
      {
        ...identity(),
        downtimeId: "d1",
        courtId: COURT_B,
        venueId: VENUE,
        downtimeMinutes: 120,
        category: "MAINTENANCE",
      },
    ],
    clubs: [
      { ...identity(), clubId: CLUB, venueId: VENUE, status: "ACTIVE" },
      { ...identity(), clubId: "club-2", venueId: VENUE, status: "INACTIVE" },
    ],
    clubMemberships: [
      {
        ...identity(),
        membershipId: "mem-1",
        clubId: CLUB,
        memberId: "u1",
        status: "ACTIVE",
      },
      {
        ...identity(),
        membershipId: "mem-2",
        clubId: CLUB,
        memberId: "u2",
        status: "ACTIVE",
      },
      {
        ...identity(),
        membershipId: "mem-3",
        clubId: CLUB,
        memberId: "u3",
        status: "SUSPENDED",
      },
    ],
    clubRoles: [
      {
        ...identity(),
        assignmentId: "ra-1",
        clubId: CLUB,
        roleId: "OWNER",
        memberId: "u1",
      },
      {
        ...identity(),
        assignmentId: "ra-2",
        clubId: CLUB,
        roleId: "COACH",
        memberId: "u2",
      },
      {
        ...identity(),
        assignmentId: "ra-3",
        clubId: CLUB,
        roleId: "COACH",
        memberId: "u4",
      },
    ],
    clubActivities: [
      {
        ...identity(),
        activityId: "act-1",
        clubId: CLUB,
        activityKind: "SESSION",
        occurredAt: "2026-07-19T10:00:00.000Z",
      },
      {
        ...identity(),
        activityId: "act-2",
        clubId: CLUB,
        activityKind: "EVENT",
        occurredAt: "2026-07-20T10:00:00.000Z",
      },
    ],
    ...overrides,
  };
}

function buildSource(snapshotOverrides = {}, adapterExtras = {}) {
  const source = IA.createInMemoryVenueCourtClubAnalyticsSource({
    snapshot: baseSnapshot(snapshotOverrides),
    ...adapterExtras,
  });
  assert.equal(source.ok, true, source.error?.message);
  return source.value;
}

function buildFacade(snapshotOverrides = {}, adapterExtras = {}) {
  const sourceAdapter = buildSource(snapshotOverrides, adapterExtras);
  const facade = IA.createVenueCourtClubAnalyticsFacade({
    sourceAdapter,
    nowIso: () => FIXED_NOW,
  });
  assert.equal(facade.ok, true, facade.error?.message);
  return { facade: facade.value, sourceAdapter };
}

function listJsFiles(dir) {
  /** @type {string[]} */
  const files = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) files.push(...listJsFiles(full));
    else if (entry.endsWith(".js")) files.push(full);
  }
  return files;
}

test("public exports include I&A-07 venue court club analytics API", () => {
  for (const name of IA.INTELLIGENCE_ANALYTICS_PUBLIC_EXPORTS) {
    assert.ok(name in IA, `missing export: ${name}`);
  }
  assert.equal(
    IA.INTELLIGENCE_ANALYTICS_VENUE_COURT_CLUB_ANALYTICS.workstreamId,
    "I&A-07"
  );
  assert.equal(typeof IA.createVenueCourtClubAnalyticsFacade, "function");
  assert.equal(typeof IA.projectVenueCourtClubSummary, "function");
});

test("1. valid analytics context is created", () => {
  const result = IA.createVenueCourtClubAnalyticsContext(
    context({ venueId: VENUE, clubId: CLUB })
  );
  assert.equal(result.ok, true);
  assert.equal(result.value.venueId, VENUE);
  assert.equal(result.value.clubId, CLUB);
  assert.ok(Object.isFrozen(result.value));
});

test("2. missing tenant is rejected", () => {
  const result = IA.createVenueCourtClubAnalyticsContext({ venueId: VENUE });
  assert.equal(result.ok, false);
  assert.equal(result.error.code, IA.ANALYTICS_ERROR_CODE.TENANT_CONTEXT_REQUIRED);
});

test("3. source tenant mismatch is rejected", () => {
  const { facade } = buildFacade();
  const result = facade.analyze({
    context: context({
      tenantScope: { kind: "tenant", tenantId: "other-tenant" },
    }),
  });
  assert.equal(result.ok, false);
  assert.equal(
    result.error.code,
    IA.ANALYTICS_ERROR_CODE.VENUE_COURT_CLUB_TENANT_MISMATCH
  );
});

test("4. mixed-tenant facts are rejected", () => {
  const snapshot = baseSnapshot({
    venues: [
      { ...identity(), venueId: VENUE, status: "ACTIVE" },
      {
        ...identity({ tenantId: "tenant-b" }),
        venueId: "venue-x",
        status: "ACTIVE",
      },
    ],
  });
  const created = IA.createVenueCourtClubAnalyticsSnapshot(snapshot);
  assert.equal(created.ok, true);
  const guard = IA.guardVenueCourtClubAnalyticsSnapshot(
    context(),
    created.value
  );
  assert.equal(guard.ok, false);
  assert.equal(
    guard.error.code,
    IA.ANALYTICS_ERROR_CODE.VENUE_COURT_CLUB_TENANT_MISMATCH
  );
});

test("5. venue scope mismatch is rejected", () => {
  const { facade } = buildFacade();
  const result = facade.analyze({
    context: context({ venueId: "venue-other" }),
  });
  assert.equal(result.ok, false);
  assert.ok(
    result.error.code ===
      IA.ANALYTICS_ERROR_CODE.VENUE_COURT_CLUB_VENUE_MISMATCH ||
      result.error.code ===
        IA.ANALYTICS_ERROR_CODE.VENUE_COURT_CLUB_COURT_VENUE_MISMATCH
  );
});

test("6. court scope mismatch is rejected", () => {
  const { facade } = buildFacade();
  const result = facade.analyze({
    context: context({ courtId: "court-missing" }),
  });
  assert.equal(result.ok, false);
  assert.equal(
    result.error.code,
    IA.ANALYTICS_ERROR_CODE.VENUE_COURT_CLUB_COURT_MISMATCH
  );
});

test("7. club scope mismatch is rejected", () => {
  const { facade } = buildFacade();
  const result = facade.analyze({
    context: context({ clubId: "club-other" }),
  });
  assert.equal(result.ok, false);
  assert.equal(
    result.error.code,
    IA.ANALYTICS_ERROR_CODE.VENUE_COURT_CLUB_CLUB_MISMATCH
  );
});

test("8. court-to-venue mismatch is rejected", () => {
  const snapshot = baseSnapshot({
    courts: [
      {
        ...identity(),
        courtId: COURT_A,
        venueId: VENUE,
        status: "ACTIVE",
      },
      {
        ...identity(),
        courtId: COURT_A,
        venueId: "venue-other",
        status: "ACTIVE",
      },
    ],
    courtAvailabilities: [],
    courtBookings: [],
    courtStatuses: [],
    courtMaintenances: [],
    courtDowntimes: [],
  });
  const created = IA.createVenueCourtClubAnalyticsSnapshot(snapshot);
  assert.equal(created.ok, true);
  const guard = IA.guardVenueCourtClubAnalyticsSnapshot(
    context(),
    created.value
  );
  assert.equal(guard.ok, false);
  assert.equal(
    guard.error.code,
    IA.ANALYTICS_ERROR_CODE.VENUE_COURT_CLUB_COURT_VENUE_MISMATCH
  );
});

test("9. input is not mutated", () => {
  const query = {
    context: context(),
    includeDashboardPayloads: false,
  };
  const before = JSON.stringify(query);
  const { facade } = buildFacade();
  const result = facade.analyze(query);
  assert.equal(result.ok, true);
  assert.equal(JSON.stringify(query), before);
});

test("10. output does not leak mutable state", () => {
  const { facade } = buildFacade();
  const result = facade.analyze({ context: context() });
  assert.equal(result.ok, true);
  assert.ok(Object.isFrozen(result.value));
  assert.ok(Object.isFrozen(result.value.summary));
  assert.throws(() => {
    result.value.summary.venueCount = 999;
  });
});

test("11. metric definitions have stable ID/version", () => {
  const defs = IA.createVenueCourtClubAnalyticsMetricDefinitions();
  assert.equal(defs.ok, true);
  assert.ok(defs.value.length >= 20);
  for (const def of defs.value) {
    assert.ok(def.metricId);
    assert.equal(def.version, "1.0.0");
  }
  assert.equal(
    IA.VENUE_COURT_CLUB_ANALYTICS_METRIC_IDS.VENUE_COUNT,
    "venue.count"
  );
  assert.equal(
    IA.VENUE_COURT_CLUB_ANALYTICS_METRIC_IDS.COURT_UTILIZATION_RATE,
    "court.utilization_rate"
  );
});

test("12. metric catalog registers validly", () => {
  const entries = IA.createVenueCourtClubAnalyticsMetricCatalogEntries();
  assert.equal(entries.ok, true);
  const registry = IA.createMetricRegistry({ entries: entries.value });
  assert.equal(registry.ok, true);
  const found = registry.value.registry.getMetric(
    IA.VENUE_COURT_CLUB_ANALYTICS_METRIC_IDS.CLUB_MEMBERS_COUNT,
    "1.0.0"
  );
  assert.equal(found.ok, true);
});

test("13. duplicate metric conflict is deterministic", () => {
  const entries = IA.createVenueCourtClubAnalyticsMetricCatalogEntries();
  assert.equal(entries.ok, true);
  const conflicting = IA.createMetricRegistry({
    entries: [
      entries.value[0],
      {
        ...entries.value[0],
        definition: {
          ...entries.value[0].definition,
          definition:
            "Different conflicting definition text for same ID/version.",
        },
      },
    ],
  });
  assert.equal(conflicting.ok, true);
  const conflictRegistration = conflicting.value.registrations.find(
    (item) => item.ok === false
  );
  assert.ok(conflictRegistration);
  assert.equal(
    conflictRegistration.error.code,
    IA.ANALYTICS_ERROR_CODE.REGISTRY_CONFLICT
  );
});

test("14-18. venue and court inventory counts/distributions", () => {
  const { facade } = buildFacade();
  const result = facade.analyze({ context: context() });
  assert.equal(result.ok, true);
  const s = result.value.summary;
  assert.equal(s.venueCount, 2);
  assert.equal(s.activeVenueCount, 1);
  assert.equal(s.inactiveVenueCount, 1);
  assert.equal(s.courtCount, 3);
  assert.equal(s.courtCountByVenue[VENUE], 2);
  assert.equal(s.courtStatusDistribution.active, 2);
  assert.equal(s.courtStatusDistribution.inactive, 1);
});

test("19-21. available/unavailable counts and availability rate", () => {
  const { facade } = buildFacade();
  const result = facade.analyze({ context: context() });
  assert.equal(result.ok, true);
  const s = result.value.summary;
  assert.equal(s.availableCount, 1);
  assert.equal(s.unavailableCount, 1);
  assert.equal(s.availabilityRate, 0.5);
});

test("22. zero denominator does not return Infinity", () => {
  const { facade } = buildFacade({
    courtAvailabilities: [
      {
        ...identity(),
        courtId: COURT_A,
        venueId: VENUE,
        availabilityStatus: "AVAILABLE",
        eligibleMinutes: 0,
      },
    ],
    courtBookings: [
      {
        ...identity(),
        bookingId: "b1",
        courtId: COURT_A,
        venueId: VENUE,
        status: "CONFIRMED",
        bookedMinutes: 30,
      },
    ],
    courtDowntimes: [],
  });
  const result = facade.analyze({ context: context() });
  assert.equal(result.ok, true);
  assert.equal(result.value.summary.utilizationRate, null);
  assert.notEqual(result.value.summary.utilizationRate, Infinity);
});

test("23. missing availability is not coerced to zero", () => {
  const { facade } = buildFacade({
    courtAvailabilities: [],
  });
  const result = facade.analyze({ context: context() });
  assert.equal(result.ok, true);
  assert.equal(result.value.summary.availableCount, null);
  assert.equal(result.value.summary.unavailableCount, null);
  assert.equal(result.value.summary.availabilityRate, null);
});

test("24-25. operating-hours total; missing not 24/7", () => {
  const { facade } = buildFacade();
  const result = facade.analyze({ context: context() });
  assert.equal(result.ok, true);
  assert.equal(result.value.summary.totalConfiguredOperatingMinutes, 1200);
  assert.equal(result.value.summary.operatingHours.assumedTwentyFourSeven, false);
  assert.equal(result.value.summary.operatingHours.missingConfigurationCount, 1);
});

test("26-28. booking count, status distribution, booked minutes", () => {
  const { facade } = buildFacade();
  const result = facade.analyze({ context: context() });
  assert.equal(result.ok, true);
  const s = result.value.summary;
  assert.equal(s.bookingCount, 3);
  assert.equal(s.bookingStatusDistribution.CONFIRMED, 1);
  assert.equal(s.bookingStatusDistribution.CANCELLED, 1);
  assert.equal(s.bookedMinutes, 150);
});

test("29. cancelled booking policy is deterministic", () => {
  const { facade } = buildFacade();
  const excluded = facade.analyze({
    context: context(),
    cancellationPolicy: IA.BOOKING_CANCELLATION_POLICY.EXCLUDE_CANCELLED,
  });
  const included = facade.analyze({
    context: context(),
    cancellationPolicy: IA.BOOKING_CANCELLATION_POLICY.INCLUDE_CANCELLED,
  });
  assert.equal(excluded.ok, true);
  assert.equal(included.ok, true);
  assert.equal(excluded.value.summary.bookedMinutes, 150);
  assert.equal(included.value.summary.bookedMinutes, 270);
});

test("30-31. utilization rate and method version", () => {
  const { facade } = buildFacade();
  const result = facade.analyze({ context: context() });
  assert.equal(result.ok, true);
  // occupied 150 / eligible (600+600-120 downtime) = 150/1080
  assert.equal(result.value.summary.utilizationRate, 150 / 1080);
  assert.equal(
    result.value.summary.utilization.analyticalMethodVersion,
    IA.VENUE_COURT_CLUB_ANALYTICS_METHOD_VERSION.UTILIZATION
  );
});

test("32. missing denominator returns indeterminate/null with warning", () => {
  const { facade } = buildFacade({
    courtAvailabilities: [
      {
        ...identity(),
        courtId: COURT_A,
        venueId: VENUE,
        availabilityStatus: "AVAILABLE",
      },
    ],
    courtDowntimes: [],
  });
  const result = facade.analyze({ context: context() });
  assert.equal(result.ok, true);
  assert.equal(result.value.summary.utilizationRate, null);
  assert.ok(
    result.value.summary.warnings.some(
      (w) => w.code === "ANALYTICS_VENUE_COURT_CLUB_UTILIZATION_INDETERMINATE"
    )
  );
});

test("33-35. downtime minutes, maintenance count, downtime rate", () => {
  const { facade } = buildFacade();
  const result = facade.analyze({ context: context() });
  assert.equal(result.ok, true);
  assert.equal(result.value.summary.downtimeMinutes, 120);
  assert.equal(result.value.summary.maintenanceCount, 1);
  assert.equal(result.value.summary.downtimeRate, 120 / 1200);
});

test("36. invalid timestamp typed error", () => {
  const fact = IA.createCourtBookingFact({
    ...identity(),
    bookingId: "b-bad",
    courtId: COURT_A,
    startsAt: "not-a-timestamp",
  });
  assert.equal(fact.ok, false);
  assert.equal(
    fact.error.code,
    IA.ANALYTICS_ERROR_CODE.VENUE_COURT_CLUB_TIMESTAMP_INVALID
  );
});

test("37. negative duration typed error", () => {
  const fact = IA.createCourtDowntimeFact({
    ...identity(),
    downtimeId: "d-bad",
    courtId: COURT_A,
    downtimeMinutes: -5,
  });
  assert.equal(fact.ok, false);
  assert.equal(
    fact.error.code,
    IA.ANALYTICS_ERROR_CODE.VENUE_COURT_CLUB_DURATION_INVALID
  );
});

test("38-44. club counts, membership, roles, activities", () => {
  const { facade } = buildFacade();
  const result = facade.analyze({ context: context() });
  assert.equal(result.ok, true);
  const s = result.value.summary;
  assert.equal(s.clubCount, 2);
  assert.equal(s.activeClubCount, 1);
  assert.equal(s.inactiveClubCount, 1);
  assert.equal(s.membershipCount, 3);
  assert.equal(s.membershipStatusDistribution.ACTIVE, 2);
  assert.equal(s.membershipStatusDistribution.SUSPENDED, 1);
  assert.equal(s.roleAssignmentCount, 3);
  assert.equal(s.roleDistribution.OWNER, 1);
  assert.equal(s.roleDistribution.COACH, 2);
  assert.equal(s.activityCount, 2);
});

test("45-46. historical observations compatible with I&A-05", () => {
  const { facade } = buildFacade();
  const result = facade.analyze({
    context: context(),
    includeHistoricalObservations: true,
  });
  assert.equal(result.ok, true);
  const hist = result.value.historicalObservations;
  assert.ok(hist.observations.length >= 7);
  assert.equal(
    hist.analyticalMethodVersion,
    IA.VENUE_COURT_CLUB_ANALYTICS_METHOD_VERSION.HISTORICAL
  );
  const members = hist.observations.find(
    (o) =>
      o.metricId === IA.VENUE_COURT_CLUB_ANALYTICS_METRIC_IDS.CLUB_MEMBERS_COUNT
  );
  assert.equal(members.value, 3);
  assert.equal(members.missing, false);
});

test("47-48. dashboard KPI and breakdown payloads compatible with I&A-04", () => {
  const { facade } = buildFacade();
  const result = facade.analyze({
    context: context(),
    includeDashboardPayloads: true,
  });
  assert.equal(result.ok, true);
  const dash = result.value.dashboardPayloads;
  assert.equal(dash.kpis.venues.value, 2);
  assert.equal(dash.kpis.courts.value, 3);
  assert.equal(dash.kpis.members.value, 3);
  assert.ok(dash.courtStatusBreakdown.categories.includes("active"));
  assert.deepEqual(
    dash.membershipBreakdown.categories,
    [...dash.membershipBreakdown.categories].sort()
  );
});

test("49-52. provenance, freshness, stale warning, incomplete snapshot", () => {
  const { facade } = buildFacade({
    freshness: IA.ANALYTICS_FRESHNESS_STATE.STALE,
    completeness: IA.VENUE_COURT_CLUB_ANALYTICS_COMPLETENESS.PARTIAL,
  });
  const result = facade.analyze({ context: context() });
  assert.equal(result.ok, true);
  assert.equal(result.value.stale, true);
  assert.equal(result.value.summary.incompleteSnapshot, true);
  assert.equal(
    result.value.summary.provenance.source.sourceId,
    SOURCE.sourceId
  );
  assert.ok(
    result.value.summary.warnings.some(
      (w) => w.code === "ANALYTICS_VENUE_COURT_CLUB_STALE_SOURCE"
    )
  );
  assert.notEqual(result.value.summary.completeness, "complete");
});

test("53. missing data is not auto-filled with zero", () => {
  const { facade } = buildFacade({
    courtBookings: [
      {
        ...identity(),
        bookingId: "b-no-min",
        courtId: COURT_A,
        venueId: VENUE,
        status: "CONFIRMED",
      },
    ],
  });
  const result = facade.analyze({ context: context() });
  assert.equal(result.ok, true);
  assert.equal(result.value.summary.bookedMinutes, null);
});

test("54-57. no availability/conflict/revenue/permission recalculation", () => {
  const { facade } = buildFacade();
  const result = facade.analyze({ context: context() });
  assert.equal(result.ok, true);
  const s = result.value.summary;
  assert.equal(s.availabilityRecalculated, false);
  assert.equal(s.bookingConflictRecalculated, false);
  assert.equal(s.revenueCalculated, false);
  assert.equal(s.clubPermissionCalculated, false);
  assert.equal(s.isCanonicalVenueCourtClubState, false);
  assert.equal(s.isCanonicalModuleState, false);
});

test("58. source failure is wrapped", () => {
  const { facade } = buildFacade({}, { failMode: "throw" });
  const result = facade.analyze({ context: context() });
  assert.equal(result.ok, false);
  assert.equal(
    result.error.code,
    IA.ANALYTICS_ERROR_CODE.VENUE_COURT_CLUB_SOURCE_FAILURE
  );
});

test("59. invalid query does not call source", () => {
  let loadCalls = 0;
  const sourceAdapter = {
    load() {
      loadCalls += 1;
      return { ok: true, value: { snapshot: {} } };
    },
  };
  const facade = IA.createVenueCourtClubAnalyticsFacade({ sourceAdapter });
  assert.equal(facade.ok, true);
  const result = facade.value.analyze({ notAContext: true });
  assert.equal(result.ok, false);
  assert.equal(loadCalls, 0);
});

test("60. read-only facade does not expose write", () => {
  const { facade } = buildFacade();
  const rejected = facade.write();
  assert.equal(rejected.ok, false);
  assert.equal(
    rejected.error.code,
    IA.ANALYTICS_ERROR_CODE.FACADE_WRITE_REJECTED
  );
});

test("61-64. no React / Supabase / Platform Core / private module imports", () => {
  const files = listJsFiles(VCC_ROOT);
  assert.ok(files.length > 0);
  const importPattern =
    /(?:from|import)\s+['"][^'"]*(?:react|@mui\/|supabase|core\/platform|features\/venue-court|features\/club\/|domain\/bookingService|domain\/courtBookingEngine)[^'"]*['"]/i;
  const storagePattern = /localStorage\.(?:getItem|setItem|removeItem)/;
  for (const file of files) {
    const content = readFileSync(file, "utf8");
    assert.equal(importPattern.test(content), false, file);
    assert.equal(storagePattern.test(content), false, file);
  }
});

test("65. no global singleton", () => {
  const a = buildFacade().facade;
  const b = buildFacade().facade;
  assert.notEqual(a, b);
});

test("66. empty facts produce deterministic result", () => {
  const { facade } = buildFacade({
    venues: [],
    venueOperatingHours: [],
    venueCapacities: [],
    courts: [],
    courtStatuses: [],
    courtAvailabilities: [],
    courtBookings: [],
    courtMaintenances: [],
    courtDowntimes: [],
    clubs: [],
    clubMemberships: [],
    clubRoles: [],
    clubActivities: [],
  });
  const a = facade.analyze({ context: context() });
  const b = facade.analyze({ context: context() });
  assert.equal(a.ok, true);
  assert.equal(b.ok, true);
  assert.equal(a.value.summary.venueCount, 0);
  assert.equal(a.value.summary.courtCount, 0);
  assert.equal(a.value.summary.clubCount, 0);
  assert.deepEqual(a.value.summary, b.value.summary);
});

test("67. same input creates same result", () => {
  const { facade } = buildFacade();
  const a = facade.analyze({ context: context() });
  const b = facade.analyze({ context: context() });
  assert.equal(a.ok, true);
  assert.deepEqual(a.value.summary, b.value.summary);
});

test("68. mixed venue/court/club facts stay scoped (no silent mix success)", () => {
  const { facade } = buildFacade();
  const scoped = facade.analyze({
    context: context({ venueId: VENUE, clubId: CLUB }),
  });
  // Snapshot contains venue-2 courts/clubs → must fail closed
  assert.equal(scoped.ok, false);
});

test("69. analytics result does not claim canonical state", () => {
  const { facade } = buildFacade();
  const result = facade.analyze({ context: context() });
  assert.equal(result.ok, true);
  assert.equal(result.value.isCanonicalVenueCourtClubState, false);
  assert.equal(result.value.isCanonicalModuleState, false);
  assert.equal(result.value.summary.isCanonicalVenueCourtClubState, false);
});

test("70. I&A-01 through I&A-06 markers still present", () => {
  assert.equal(IA.INTELLIGENCE_ANALYTICS_FOUNDATION.workstreamId, "I&A-01");
  assert.equal(IA.INTELLIGENCE_ANALYTICS_METRIC_REGISTRY.workstreamId, "I&A-02");
  assert.equal(IA.INTELLIGENCE_ANALYTICS_QUERY_RUNTIME.workstreamId, "I&A-03");
  assert.equal(
    IA.INTELLIGENCE_ANALYTICS_DASHBOARD_REPORTING.workstreamId,
    "I&A-04"
  );
  assert.equal(IA.INTELLIGENCE_ANALYTICS_HISTORICAL_TREND.workstreamId, "I&A-05");
  assert.equal(
    IA.INTELLIGENCE_ANALYTICS_COMPETITION_ANALYTICS.workstreamId,
    "I&A-06"
  );
  assert.equal(typeof IA.createCompetitionAnalyticsFacade, "function");
  assert.equal(typeof IA.createMetricRegistry, "function");
  assert.equal(typeof IA.createAnalyticsHistoricalObservation, "function");
  assert.equal(typeof IA.createAnalyticsKpiPayload, "function");
});

test("validate does not call source", () => {
  let loadCalls = 0;
  const sourceAdapter = {
    load() {
      loadCalls += 1;
      return { ok: true, value: { snapshot: {} } };
    },
  };
  const facade = IA.createVenueCourtClubAnalyticsFacade({ sourceAdapter });
  assert.equal(facade.ok, true);
  const validated = facade.value.validate({ context: context() });
  assert.equal(validated.ok, true);
  assert.equal(loadCalls, 0);
});
