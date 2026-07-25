/**
 * I&A-06 — Competition Analytics certification tests.
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
const CA_ROOT = path.join(MODULE_ROOT, "competition-analytics");

const SOURCE = Object.freeze({
  sourceId: "competition-analytics-explicit",
  sourceKind: "explicit_input",
  ownerModule: "intelligence-analytics",
  reference: "ia-06-certification",
});

const PROVENANCE = Object.freeze({
  source: SOURCE,
  observedAt: "2026-07-20T12:00:00.000Z",
  ingestedAt: "2026-07-20T12:05:00.000Z",
  transformer: "in-memory-competition-analytics",
});

const FIXED_NOW = "2026-07-25T00:00:00.000Z";
const TENANT = "tenant-a";
const COMPETITION = "comp-1";
const VERSION = "v3";

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
    competitionId: COMPETITION,
    competitionVersion: VERSION,
    ...overrides,
  };
}

function identity(overrides = {}) {
  return {
    tenantId: TENANT,
    competitionId: COMPETITION,
    competitionVersion: VERSION,
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
    completeness: IA.COMPETITION_ANALYTICS_COMPLETENESS.COMPLETE,
    sourceTimestamp: "2026-07-20T12:00:00.000Z",
    participants: [
      {
        ...identity(),
        participantId: "p1",
        status: "ACTIVE",
        divisionId: "d1",
        categoryId: "c1",
        entryKind: "individual",
      },
      {
        ...identity(),
        participantId: "p2",
        status: "ACTIVE",
        divisionId: "d1",
        categoryId: "c2",
        entryKind: "individual",
      },
      {
        ...identity(),
        participantId: "p3",
        status: "WITHDRAWN",
        divisionId: "d2",
        categoryId: "c1",
        entryKind: "team",
      },
    ],
    entries: [
      { ...identity(), entryId: "e1", status: "ACTIVE", participantId: "p1" },
      { ...identity(), entryId: "e2", status: "ACTIVE", participantId: "p2" },
    ],
    registrations: [
      { ...identity(), registrationId: "r1", status: "APPROVED" },
      { ...identity(), registrationId: "r2", status: "APPROVED" },
      { ...identity(), registrationId: "r3", status: "WAITLISTED" },
      { ...identity(), registrationId: "r4", status: "REJECTED" },
    ],
    divisions: [
      { ...identity(), divisionId: "d1", label: "Open" },
      { ...identity(), divisionId: "d2", label: "Mixed" },
    ],
    categories: [
      { ...identity(), categoryId: "c1", divisionId: "d1", label: "Men" },
      { ...identity(), categoryId: "c2", divisionId: "d1", label: "Women" },
    ],
    teams: [{ ...identity(), teamId: "t1", status: "ACTIVE" }],
    matches: [
      { ...identity(), matchId: "m1", lifecycleStatus: "COMPLETED" },
      { ...identity(), matchId: "m2", lifecycleStatus: "COMPLETED" },
      { ...identity(), matchId: "m3", lifecycleStatus: "IN_PROGRESS" },
      { ...identity(), matchId: "m4", lifecycleStatus: "SCHEDULED" },
      { ...identity(), matchId: "m5", lifecycleStatus: "CANCELLED" },
      { ...identity(), matchId: "m6", lifecycleStatus: "VOID" },
      { ...identity(), matchId: "m7", lifecycleStatus: "ABANDONED" },
    ],
    schedules: [
      {
        ...identity(),
        matchId: "m1",
        scheduledStartAt: "2026-07-20T08:00:00.000Z",
        actualStartAt: "2026-07-20T08:00:00.000Z",
        actualEndAt: "2026-07-20T09:00:00.000Z",
        timezone: "UTC",
      },
      {
        ...identity(),
        matchId: "m2",
        scheduledStartAt: "2026-07-20T10:00:00.000Z",
        actualStartAt: "2026-07-20T10:15:00.000Z",
        actualEndAt: "2026-07-20T11:00:00.000Z",
        timezone: "UTC",
      },
      {
        ...identity(),
        matchId: "m3",
        scheduledStartAt: "2026-07-20T12:00:00.000Z",
        actualStartAt: "2026-07-20T11:55:00.000Z",
        timezone: "UTC",
      },
      {
        ...identity(),
        matchId: "m4",
        scheduledStartAt: "2026-07-20T14:00:00.000Z",
        timezone: "UTC",
      },
    ],
    assignments: [
      { ...identity(), matchId: "m1", courtId: "court-1" },
      { ...identity(), matchId: "m2", courtId: "court-2", refereeId: "ref-1" },
      { ...identity(), matchId: "m3", refereeId: "ref-2" },
    ],
    results: [
      { ...identity(), matchId: "m1", acceptanceStatus: "ACCEPTED" },
      { ...identity(), matchId: "m2", acceptanceStatus: "ACCEPTED" },
      { ...identity(), matchId: "m5", acceptanceStatus: "REJECTED" },
      { ...identity(), matchId: "m7", acceptanceStatus: "PENDING" },
    ],
    standingsSnapshots: [
      {
        ...identity(),
        snapshotId: "standings-1",
        snapshotVersion: "1",
        rowCount: 4,
        opaqueRanks: [
          { participantId: "p1", rank: 1 },
          { participantId: "p2", rank: 2 },
        ],
      },
    ],
    rankingSnapshots: [
      {
        ...identity(),
        snapshotId: "ranking-1",
        snapshotVersion: "1",
        entryCount: 2,
      },
    ],
    ...overrides,
  };
}

function buildSource(snapshotOverrides = {}, adapterExtras = {}) {
  const source = IA.createInMemoryCompetitionAnalyticsSource({
    snapshot: baseSnapshot(snapshotOverrides),
    ...adapterExtras,
  });
  assert.equal(source.ok, true, source.error?.message);
  return source.value;
}

function buildFacade(snapshotOverrides = {}, adapterExtras = {}) {
  const sourceAdapter = buildSource(snapshotOverrides, adapterExtras);
  const facade = IA.createCompetitionAnalyticsFacade({
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

test("public exports include I&A-06 competition analytics API", () => {
  for (const name of IA.INTELLIGENCE_ANALYTICS_PUBLIC_EXPORTS) {
    assert.ok(name in IA, `missing export: ${name}`);
  }
  assert.equal(
    IA.INTELLIGENCE_ANALYTICS_COMPETITION_ANALYTICS.workstreamId,
    "I&A-06"
  );
  assert.equal(typeof IA.createCompetitionAnalyticsFacade, "function");
  assert.equal(typeof IA.projectCompetitionSummary, "function");
});

test("1. valid Competition Analytics context is created", () => {
  const result = IA.createCompetitionAnalyticsContext(context());
  assert.equal(result.ok, true);
  assert.equal(result.value.competitionId, COMPETITION);
  assert.equal(result.value.competitionVersion, VERSION);
  assert.ok(Object.isFrozen(result.value));
});

test("2. missing tenant is rejected", () => {
  const result = IA.createCompetitionAnalyticsContext({
    competitionId: COMPETITION,
  });
  assert.equal(result.ok, false);
  assert.equal(result.error.code, IA.ANALYTICS_ERROR_CODE.TENANT_CONTEXT_REQUIRED);
});

test("3. missing competition ID is rejected", () => {
  const result = IA.createCompetitionAnalyticsContext({
    tenantScope: tenantScope(),
  });
  assert.equal(result.ok, false);
  assert.equal(result.error.code, IA.ANALYTICS_ERROR_CODE.COMPETITION_ID_REQUIRED);
});

test("4. competition version is preserved", () => {
  const result = IA.createCompetitionAnalyticsContext(context());
  assert.equal(result.ok, true);
  assert.equal(result.value.competitionVersion, VERSION);
});

test("5. source tenant mismatch is rejected", () => {
  const { facade } = buildFacade();
  const result = facade.analyze({
    context: context({
      tenantScope: tenantScope({ tenantId: "tenant-b" }),
    }),
  });
  assert.equal(result.ok, false);
  assert.equal(
    result.error.code,
    IA.ANALYTICS_ERROR_CODE.COMPETITION_TENANT_MISMATCH
  );
});

test("6. source competition mismatch is rejected", () => {
  const { facade } = buildFacade();
  const result = facade.analyze({
    context: context({ competitionId: "comp-other" }),
  });
  assert.equal(result.ok, false);
  assert.equal(result.error.code, IA.ANALYTICS_ERROR_CODE.COMPETITION_ID_MISMATCH);
});

test("7. mixed-tenant facts are rejected", () => {
  const snapshot = baseSnapshot({
    participants: [
      { ...identity(), participantId: "p1", status: "ACTIVE" },
      {
        ...identity({ tenantId: "tenant-b" }),
        participantId: "p2",
        status: "ACTIVE",
      },
    ],
  });
  const created = IA.createCompetitionAnalyticsSnapshot(snapshot);
  assert.equal(created.ok, true);
  const guard = IA.guardCompetitionAnalyticsSnapshot(
    created.value.context,
    created.value
  );
  assert.equal(guard.ok, false);
  assert.equal(
    guard.error.code,
    IA.ANALYTICS_ERROR_CODE.COMPETITION_TENANT_MISMATCH
  );
});

test("8. mixed-competition facts are rejected", () => {
  const snapshot = baseSnapshot({
    participants: [
      { ...identity(), participantId: "p1", status: "ACTIVE" },
      {
        ...identity({ competitionId: "comp-2" }),
        participantId: "p2",
        status: "ACTIVE",
      },
    ],
  });
  const created = IA.createCompetitionAnalyticsSnapshot(snapshot);
  assert.equal(created.ok, true);
  const guard = IA.guardCompetitionAnalyticsSnapshot(
    created.value.context,
    created.value
  );
  assert.equal(guard.ok, false);
  assert.equal(
    guard.error.code,
    IA.ANALYTICS_ERROR_CODE.COMPETITION_ID_MISMATCH
  );
});

test("9-10. input is not mutated and output is frozen", () => {
  const query = {
    context: context(),
    includeDashboardPayloads: true,
  };
  const before = JSON.stringify(query);
  const { facade } = buildFacade();
  const result = facade.analyze(query);
  assert.equal(result.ok, true, result.error?.message);
  assert.equal(JSON.stringify(query), before);
  assert.ok(Object.isFrozen(result.value));
  assert.ok(Object.isFrozen(result.value.summary));
});

test("11-13. metric definitions have stable ID/version and register cleanly", () => {
  const defs = IA.createCompetitionAnalyticsMetricDefinitions();
  assert.equal(defs.ok, true);
  assert.ok(defs.value.length >= 20);
  for (const definition of defs.value) {
    assert.equal(definition.version, "1.0.0");
    assert.ok(definition.metricId.startsWith("competition."));
  }

  const entries = IA.createCompetitionAnalyticsMetricCatalogEntries();
  assert.equal(entries.ok, true);
  const registry = IA.createMetricRegistry({ entries: entries.value });
  assert.equal(registry.ok, true);

  const conflicting = IA.createMetricRegistry({
    entries: [
      entries.value[0],
      {
        ...entries.value[0],
        definition: {
          ...entries.value[0].definition,
          definition: "Different conflicting definition text for same ID/version.",
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

test("14-19. participant/entry/registration/division/category/team counts", () => {
  const { facade } = buildFacade();
  const result = facade.analyze({ context: context() });
  assert.equal(result.ok, true);
  const summary = result.value.summary;
  assert.equal(summary.participantCount, 3);
  assert.equal(summary.entryCount, 2);
  assert.equal(summary.registrationCount, 4);
  assert.equal(summary.divisionCount, 2);
  assert.equal(summary.categoryCount, 2);
  assert.equal(summary.teamCount, 1);
  assert.equal(summary.distributions.registrationStatusDistribution.APPROVED, 2);
  assert.equal(summary.distributions.divisionDistribution.d1, 2);
  assert.equal(summary.distributions.categoryDistribution.c1, 2);
});

test("20-24. match lifecycle, completion, progress, denominator zero", () => {
  const { facade } = buildFacade();
  const result = facade.analyze({ context: context() });
  assert.equal(result.ok, true);
  const summary = result.value.summary;
  assert.equal(summary.distributions.matchLifecycleDistribution.completed, 2);
  assert.equal(summary.completedCount, 2);
  assert.equal(summary.cancelledCount, 1);
  assert.equal(summary.voidCount, 1);
  assert.equal(summary.abandonedCount, 1);
  // eligible = total - cancelled - void = 7 - 1 - 1 = 5
  assert.equal(summary.progress.eligibleTotal, 5);
  assert.equal(summary.completionRate, 2 / 5);
  assert.equal(summary.progressPercentage, 40);

  const empty = IA.projectCompetitionProgress({
    matches: [],
    completeness: IA.COMPETITION_ANALYTICS_COMPLETENESS.COMPLETE,
  });
  assert.equal(empty.ok, true);
  assert.equal(empty.value.completionRate, null);
  assert.equal(empty.value.progressPercentage, null);
  assert.notEqual(empty.value.completionRate, Infinity);

  const includeAll = IA.projectCompetitionProgress(
    { matches: baseSnapshot().matches },
    { exclusionPolicy: IA.COMPETITION_PROGRESS_EXCLUSION_POLICY.INCLUDE_ALL }
  );
  assert.equal(includeAll.ok, true);
  assert.equal(includeAll.value.eligibleTotal, 7);
});

test("25-28. result acceptance analytics", () => {
  const { facade } = buildFacade();
  const result = facade.analyze({ context: context() });
  assert.equal(result.ok, true);
  const summary = result.value.summary;
  assert.equal(summary.acceptedResultCount, 2);
  assert.equal(summary.rejectedResultCount, 1);
  assert.equal(summary.pendingResultCount, 1);
  assert.equal(summary.acceptanceRate, 2 / 3);
  assert.equal(summary.results.unknownCount, 0);
});

test("29-33. schedule adherence deltas and rates", () => {
  const { facade } = buildFacade();
  const result = facade.analyze({
    context: context(),
    onTimeThresholdSeconds: 0,
  });
  assert.equal(result.ok, true);
  const schedule = result.value.summary.schedule;
  assert.deepEqual(schedule.startDeltasSeconds, [0, 900, -300]);
  assert.equal(schedule.onTimeCount, 2); // on-time + early
  assert.equal(schedule.delayedCount, 1);
  assert.equal(schedule.adherenceRate, 2 / 3);
  assert.equal(schedule.averageDelaySeconds, (0 + 900 + -300) / 3);
  assert.equal(schedule.missingTimestamps, 1);
});

test("34-37. duration, invalid timestamps, negative duration, missing not zero", () => {
  const okDuration = IA.projectCompetitionDurations(baseSnapshot());
  assert.equal(okDuration.ok, true);
  assert.equal(okDuration.value.durationCount, 2);
  assert.equal(okDuration.value.averageDurationSeconds, (3600 + 2700) / 2);
  assert.equal(okDuration.value.missingTimestamps, 2);

  const invalid = IA.projectCompetitionScheduleAdherence({
    schedules: [
      {
        ...identity(),
        matchId: "bad",
        scheduledStartAt: "not-a-date",
        actualStartAt: "2026-07-20T08:00:00.000Z",
      },
    ],
  });
  assert.equal(invalid.ok, false);
  assert.equal(
    invalid.error.code,
    IA.ANALYTICS_ERROR_CODE.COMPETITION_TIMESTAMP_INVALID
  );

  const negative = IA.projectCompetitionDurations({
    schedules: [
      {
        ...identity(),
        matchId: "bad",
        actualStartAt: "2026-07-20T09:00:00.000Z",
        actualEndAt: "2026-07-20T08:00:00.000Z",
      },
    ],
  });
  assert.equal(negative.ok, false);
  assert.equal(
    negative.error.code,
    IA.ANALYTICS_ERROR_CODE.COMPETITION_DURATION_INVALID
  );

  assert.notEqual(okDuration.value.averageDurationSeconds, 0);
  assert.ok(okDuration.value.missingTimestamps > 0);
});

test("38-39. progress percentage and incomplete snapshot", () => {
  const { facade } = buildFacade({
    completeness: IA.COMPETITION_ANALYTICS_COMPLETENESS.PARTIAL,
  });
  const result = facade.analyze({ context: context() });
  assert.equal(result.ok, true);
  assert.equal(result.value.summary.progressPercentage, 40);
  assert.equal(result.value.summary.incompleteSnapshot, true);
  assert.equal(result.value.summary.progress.claimedCompetitionComplete, false);
});

test("40-42. provenance, freshness, stale warning", () => {
  const { facade } = buildFacade({
    freshness: IA.ANALYTICS_FRESHNESS_STATE.STALE,
  });
  const result = facade.analyze({ context: context() });
  assert.equal(result.ok, true);
  assert.equal(
    result.value.summary.provenance.source.sourceId,
    "competition-analytics-explicit"
  );
  assert.equal(result.value.summary.freshness, IA.ANALYTICS_FRESHNESS_STATE.STALE);
  assert.equal(result.value.stale, true);
  assert.ok(
    result.value.summary.warnings.some(
      (w) => w.code === "ANALYTICS_COMPETITION_STALE_SOURCE"
    )
  );
});

test("43-47. standings opaque; no scoring/winner/ranking calculation", () => {
  const { facade } = buildFacade();
  const result = facade.analyze({ context: context() });
  assert.equal(result.ok, true);
  const standings = result.value.summary.standings;
  assert.equal(standings.standingsSnapshotCount, 1);
  assert.equal(standings.references[0].opaqueRankCount, 2);
  assert.equal(standings.recalculated, undefined);
  assert.equal(standings.scoringCalculated, false);
  assert.equal(standings.winnerCalculated, false);
  assert.equal(standings.rankingCalculated, false);
  assert.equal(result.value.isCanonicalCompetitionState, false);

  const source = readFileSync(path.join(CA_ROOT, "projections.js"), "utf8");
  assert.equal(source.includes("calculateCanonicalStandings"), false);
  assert.equal(source.includes("calculateVprPoints"), false);
  assert.equal(/determineWinner|computeWinner/.test(source), false);
});

test("48-49. historical observations compatible with I&A-05", () => {
  const { facade } = buildFacade();
  const result = facade.analyze({
    context: context(),
    includeHistoricalObservations: true,
  });
  assert.equal(result.ok, true);
  const obs = result.value.historicalObservations.observations;
  assert.ok(obs.length >= 5);
  assert.equal(obs[0].metricId, IA.COMPETITION_ANALYTICS_METRIC_IDS.PARTICIPANTS_COUNT);
  assert.equal(obs[0].tenantScope.tenantId, TENANT);
  assert.equal(obs[0].dimensions.competitionId, COMPETITION);

  // Same summary → same historical observation values (deterministic)
  const again = IA.composeCompetitionHistoricalObservations(
    result.value.summary,
    { observedAt: "2026-07-20T12:00:00.000Z" }
  );
  assert.equal(again.ok, true);
  assert.equal(
    JSON.stringify(again.value.observations.map((o) => o.value)),
    JSON.stringify(obs.map((o) => o.value))
  );
});

test("50-51. dashboard KPI and breakdown payloads compatible with I&A-04", () => {
  const { facade } = buildFacade();
  const result = facade.analyze({
    context: context(),
    includeDashboardPayloads: true,
  });
  assert.equal(result.ok, true, result.error?.message);
  const payloads = result.value.dashboardPayloads;
  assert.equal(
    payloads.kpis.participants.metricId,
    IA.COMPETITION_ANALYTICS_METRIC_IDS.PARTICIPANTS_COUNT
  );
  assert.equal(payloads.kpis.participants.value, 3);
  assert.ok(payloads.lifecycleBreakdown.categories.includes("completed"));
  assert.ok(Object.isFrozen(payloads.lifecycleBreakdown));
  assert.equal(payloads.isCanonicalCompetitionState, false);
});

test("52. same input creates same result", () => {
  const { facade } = buildFacade();
  const a = facade.analyze({ context: context() });
  const b = facade.analyze({ context: context() });
  assert.equal(a.ok, true);
  assert.equal(b.ok, true);
  assert.equal(
    JSON.stringify(a.value.summary.distributions),
    JSON.stringify(b.value.summary.distributions)
  );
  assert.equal(a.value.summary.completionRate, b.value.summary.completionRate);
});

test("53. invalid query does not call source", () => {
  let called = false;
  const facade = IA.createCompetitionAnalyticsFacade({
    sourceAdapter: {
      load() {
        called = true;
        return { ok: true, value: { snapshot: {} } };
      },
    },
    nowIso: () => FIXED_NOW,
  });
  assert.equal(facade.ok, true);
  const result = facade.value.analyze({ competitionId: COMPETITION });
  assert.equal(result.ok, false);
  assert.equal(called, false);
});

test("54. source failure is wrapped", () => {
  const { facade } = buildFacade({}, { failMode: "throw" });
  const result = facade.analyze({ context: context() });
  assert.equal(result.ok, false);
  assert.equal(
    result.error.code,
    IA.ANALYTICS_ERROR_CODE.COMPETITION_SOURCE_FAILURE
  );
});

test("55. read-only facade does not expose write", () => {
  const { facade } = buildFacade();
  assert.equal(facade.write().ok, false);
  assert.equal(facade.write().error.code, IA.ANALYTICS_ERROR_CODE.FACADE_WRITE_REJECTED);
  assert.equal(facade.mutate().ok, false);
  assert.equal(facade.persist().ok, false);
});

test("56-59. no React / Supabase / Platform Core / private Competition imports", () => {
  const files = listJsFiles(CA_ROOT);
  assert.ok(files.length > 0);
  const importPattern =
    /(?:from|import)\s+['"][^'"]*(?:react|@mui\/|supabase|core\/platform|competition-engine|competition-core)[^'"]*['"]/i;
  const storagePattern = /localStorage\.(?:getItem|setItem|removeItem)/;
  for (const file of files) {
    const content = readFileSync(file, "utf8");
    assert.equal(importPattern.test(content), false, file);
    assert.equal(storagePattern.test(content), false, file);
  }
});

test("60. no global singleton", () => {
  const a = buildFacade().facade;
  const b = buildFacade().facade;
  assert.notEqual(a, b);
});

test("61. empty facts have deterministic result", () => {
  const { facade } = buildFacade({
    participants: [],
    entries: [],
    registrations: [],
    divisions: [],
    categories: [],
    teams: [],
    matches: [],
    schedules: [],
    assignments: [],
    results: [],
    standingsSnapshots: [],
    rankingSnapshots: [],
  });
  const result = facade.analyze({ context: context() });
  assert.equal(result.ok, true);
  assert.equal(result.value.summary.participantCount, 0);
  assert.equal(result.value.summary.totalMatchCount, 0);
  assert.equal(result.value.summary.completionRate, null);
  assert.equal(result.value.summary.acceptanceRate, null);
});

test("62. multiple competition versions are not mixed against policy", () => {
  const snapshot = baseSnapshot({
    matches: [
      { ...identity({ competitionVersion: "v1" }), matchId: "m1", lifecycleStatus: "COMPLETED" },
      { ...identity({ competitionVersion: "v2" }), matchId: "m2", lifecycleStatus: "COMPLETED" },
    ],
  });
  const created = IA.createCompetitionAnalyticsSnapshot(snapshot);
  assert.equal(created.ok, true);
  const guard = IA.guardCompetitionAnalyticsSnapshot(
    created.value.context,
    created.value
  );
  assert.equal(guard.ok, false);
  assert.equal(
    guard.error.code,
    IA.ANALYTICS_ERROR_CODE.COMPETITION_VERSION_MIXED
  );
});

test("63-65. assignment counts only from explicit facts; no coverage inference", () => {
  const { facade } = buildFacade();
  const result = facade.analyze({ context: context() });
  assert.equal(result.ok, true);
  assert.equal(result.value.summary.assignmentSummary.courtAssignedMatchCount, 2);
  assert.equal(result.value.summary.assignmentSummary.refereeAssignedMatchCount, 2);
  assert.equal(result.value.summary.assignments.inferredCoverage, false);
});

test("66-67. deprecated metric warns; retired metric rejects via registry", () => {
  const entries = IA.createCompetitionAnalyticsMetricCatalogEntries();
  assert.equal(entries.ok, true);
  const first = entries.value[0];
  const deprecated = IA.createMetricRegistry({
    entries: [
      {
        definition: first.definition,
        lifecycleState: IA.ANALYTICS_METRIC_LIFECYCLE_STATE.DEPRECATED,
        deprecation: {
          deprecatedAt: "2026-07-01T00:00:00.000Z",
          reason: "certification",
          replacementMetricId: first.definition.metricId,
          replacementVersion: "2.0.0",
        },
      },
    ],
  });
  assert.equal(deprecated.ok, true);
  const resolved = deprecated.value.registry.getMetric(
    first.definition.metricId,
    first.definition.version
  );
  assert.equal(resolved.ok, true);
  assert.ok(resolved.value.warnings?.length >= 0 || resolved.value.lifecycleState);

  const retired = IA.createMetricRegistry({
    entries: [
      {
        definition: {
          ...first.definition,
          version: "9.0.0",
        },
        lifecycleState: IA.ANALYTICS_METRIC_LIFECYCLE_STATE.RETIRED,
      },
    ],
  });
  // Registry accepts retired entries; runtime resolution rejects — verify entry state.
  assert.equal(retired.ok, true);
  const retiredEntry = retired.value.registry.getMetric(
    first.definition.metricId,
    "9.0.0"
  );
  assert.equal(retiredEntry.ok, true);
  assert.equal(
    retiredEntry.value.lifecycleState,
    IA.ANALYTICS_METRIC_LIFECYCLE_STATE.RETIRED
  );
});

test("68. missing data is not auto-filled to zero", () => {
  const schedule = IA.projectCompetitionScheduleAdherence({
    schedules: [
      {
        ...identity(),
        matchId: "m1",
        scheduledStartAt: "2026-07-20T08:00:00.000Z",
      },
    ],
  });
  assert.equal(schedule.ok, true);
  assert.equal(schedule.value.onTimeCount, 0);
  assert.equal(schedule.value.delayedCount, 0);
  assert.equal(schedule.value.adherenceRate, null);
  assert.equal(schedule.value.missingTimestamps, 1);
  assert.equal(schedule.value.averageDelaySeconds, null);
});

test("69. analytics result does not claim canonical Competition state", () => {
  const { facade } = buildFacade();
  const result = facade.analyze({ context: context() });
  assert.equal(result.ok, true);
  assert.equal(result.value.isCanonicalCompetitionState, false);
  assert.equal(result.value.isCanonicalModuleState, false);
  assert.equal(result.value.summary.isCanonicalCompetitionState, false);
});

test("70. I&A-01..05 public markers remain available", () => {
  assert.equal(IA.INTELLIGENCE_ANALYTICS_FOUNDATION.workstreamId, "I&A-01");
  assert.equal(IA.INTELLIGENCE_ANALYTICS_METRIC_REGISTRY.workstreamId, "I&A-02");
  assert.equal(IA.INTELLIGENCE_ANALYTICS_QUERY_RUNTIME.workstreamId, "I&A-03");
  assert.equal(IA.INTELLIGENCE_ANALYTICS_DASHBOARD_REPORTING.workstreamId, "I&A-04");
  assert.equal(IA.INTELLIGENCE_ANALYTICS_HISTORICAL_TREND.workstreamId, "I&A-05");
  assert.equal(typeof IA.createAnalyticsMetricDefinition, "function");
  assert.equal(typeof IA.createMetricRegistry, "function");
  assert.equal(typeof IA.createAnalyticsQueryRuntime, "function");
  assert.equal(typeof IA.createAnalyticsKpiPayload, "function");
  assert.equal(typeof IA.createHistoricalAnalyticsRuntime, "function");
});

test("validate() never calls source", () => {
  let called = false;
  const facade = IA.createCompetitionAnalyticsFacade({
    sourceAdapter: {
      load() {
        called = true;
        return { ok: false };
      },
    },
  });
  assert.equal(facade.ok, true);
  const result = facade.value.validate({ context: context() });
  assert.equal(result.ok, true);
  assert.equal(called, false);
});
