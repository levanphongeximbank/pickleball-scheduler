/**
 * I&A-05 — Historical and Trend Analysis certification tests.
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
const HT_ROOT = path.join(MODULE_ROOT, "historical-trend");

const SOURCE = Object.freeze({
  sourceId: "explicit-historical",
  sourceKind: "explicit_input",
  ownerModule: "intelligence-analytics",
  reference: "ia-05-certification",
});

const PROVENANCE = Object.freeze({
  source: SOURCE,
  observedAt: "2026-07-01T12:00:00.000Z",
  ingestedAt: "2026-07-01T12:05:00.000Z",
  transformer: "in-memory-historical",
});

const FIXED_NOW = "2026-07-25T00:00:00.000Z";

function baseDefinition(overrides = {}) {
  return {
    metricId: "ia.demo.historical_sum",
    version: "1.0.0",
    definition: "Sum of caller-supplied historical observations for I&A-05 certification.",
    unit: IA.ANALYTICS_METRIC_UNIT.COUNT,
    aggregationKind: IA.ANALYTICS_AGGREGATION_KIND.SUM,
    metricKind: IA.ANALYTICS_METRIC_KIND.OBSERVATIONAL,
    source: SOURCE,
    supportedTenantScopeKinds: [IA.ANALYTICS_TENANT_SCOPE_KIND.TENANT],
    supportedGranularities: [
      IA.ANALYTICS_GRANULARITY.HOUR,
      IA.ANALYTICS_GRANULARITY.DAY,
      IA.ANALYTICS_GRANULARITY.WEEK,
      IA.ANALYTICS_GRANULARITY.MONTH,
    ],
    allowedDimensions: [{ key: "segment" }],
    missingDataSemantics: IA.ANALYTICS_MISSING_DATA_SEMANTICS.PRESERVE_NULL,
    ...overrides,
  };
}

function registrationRequest(overrides = {}) {
  const {
    lifecycleState,
    displayName,
    deprecation,
    registeredAt,
    ...defOverrides
  } = overrides;
  /** @type {Record<string, unknown>} */
  const request = { definition: baseDefinition(defOverrides) };
  if (lifecycleState !== undefined) request.lifecycleState = lifecycleState;
  if (displayName !== undefined) request.displayName = displayName;
  if (deprecation !== undefined) request.deprecation = deprecation;
  if (registeredAt !== undefined) request.registeredAt = registeredAt;
  return request;
}

function tenantScope(overrides = {}) {
  return {
    kind: IA.ANALYTICS_TENANT_SCOPE_KIND.TENANT,
    tenantId: "tenant-a",
    ...overrides,
  };
}

function observation(overrides = {}) {
  return {
    metricId: "ia.demo.historical_sum",
    metricVersion: "1.0.0",
    tenantScope: tenantScope(),
    observedAt: "2026-07-02T10:00:00.000Z",
    dimensions: { segment: "A" },
    value: 10,
    missing: false,
    provenance: PROVENANCE,
    freshness: IA.ANALYTICS_FRESHNESS_STATE.FRESH,
    ...overrides,
  };
}

function historicalQuery(overrides = {}) {
  return {
    metricId: "ia.demo.historical_sum",
    metricVersion: "1.0.0",
    tenantScope: tenantScope(),
    timeWindow: {
      startAt: "2026-07-01T00:00:00.000Z",
      endAt: "2026-07-05T23:59:59.999Z",
      inclusive: true,
      timezone: "UTC",
    },
    granularity: IA.ANALYTICS_GRANULARITY.DAY,
    aggregationKind: IA.ANALYTICS_AGGREGATION_KIND.SUM,
    missingPeriodPolicy: IA.ANALYTICS_MISSING_PERIOD_POLICY.PRESERVE_MISSING,
    timezone: "UTC",
    ...overrides,
  };
}

function buildRegistry(entries) {
  const created = IA.createMetricRegistry({ entries });
  assert.equal(created.ok, true);
  return created.value.registry;
}

function buildFacade(observations, registryEntries, adapterExtras = {}) {
  const registry = buildRegistry(registryEntries || [registrationRequest()]);
  const adapter = IA.createInMemoryHistoricalSourceAdapter({
    observations,
    provenance: PROVENANCE,
    freshness: IA.ANALYTICS_FRESHNESS_STATE.FRESH,
    ...adapterExtras,
  });
  assert.equal(adapter.ok, true);
  const runtime = IA.createHistoricalAnalyticsRuntime({
    registry,
    sourceAdapter: adapter.value,
    nowIso: () => FIXED_NOW,
  });
  assert.equal(runtime.ok, true);
  return { runtime: runtime.value, registry, adapter: adapter.value };
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

test("public exports include I&A-05 historical API", () => {
  for (const name of IA.INTELLIGENCE_ANALYTICS_PUBLIC_EXPORTS) {
    assert.ok(name in IA, `missing export: ${name}`);
  }
  assert.equal(IA.INTELLIGENCE_ANALYTICS_HISTORICAL_TREND.workstreamId, "I&A-05");
  assert.equal(typeof IA.createHistoricalAnalyticsRuntime, "function");
  assert.equal(typeof IA.normalizeHistoricalQuery, "function");
  assert.equal(typeof IA.bucketHistoricalObservations, "function");
  assert.equal(typeof IA.analyzeTrend, "function");
});

test("1. valid historical query is created", () => {
  const result = IA.createAnalyticsHistoricalQuery(historicalQuery());
  assert.equal(result.ok, true);
  assert.equal(result.value.metricId, "ia.demo.historical_sum");
  assert.equal(result.value.granularity, IA.ANALYTICS_GRANULARITY.DAY);
  assert.equal(
    result.value.missingPeriodPolicy,
    IA.ANALYTICS_MISSING_PERIOD_POLICY.PRESERVE_MISSING
  );
  assert.ok(Object.isFrozen(result.value));
});

test("2. missing metric ID/version is rejected", () => {
  const noId = IA.createAnalyticsHistoricalQuery(
    historicalQuery({ metricId: "" })
  );
  assert.equal(noId.ok, false);
  assert.equal(noId.error.code, IA.ANALYTICS_ERROR_CODE.METRIC_ID_REQUIRED);

  const noVersion = IA.createAnalyticsHistoricalQuery(
    historicalQuery({ metricVersion: "" })
  );
  assert.equal(noVersion.ok, false);
  assert.equal(noVersion.error.code, IA.ANALYTICS_ERROR_CODE.METRIC_VERSION_REQUIRED);
});

test("3. missing tenant context fails closed", () => {
  const result = IA.createAnalyticsHistoricalQuery(
    historicalQuery({ tenantScope: undefined })
  );
  assert.equal(result.ok, false);
  assert.equal(result.error.code, IA.ANALYTICS_ERROR_CODE.TENANT_CONTEXT_REQUIRED);
});

test("4. tenant mismatch is rejected", () => {
  const { runtime } = buildFacade([observation()]);
  const result = runtime.analyze(historicalQuery(), { tenantId: "tenant-b" });
  assert.equal(result.ok, false);
  assert.equal(result.error.code, IA.ANALYTICS_ERROR_CODE.TENANT_SCOPE_MISMATCH);
});

test("5. query input is not mutated", () => {
  const input = historicalQuery();
  const snapshot = JSON.stringify(input);
  const result = IA.normalizeHistoricalQuery(input);
  assert.equal(result.ok, true);
  assert.equal(JSON.stringify(input), snapshot);
});

test("6. observation input is not mutated during bucketing", () => {
  const query = IA.createAnalyticsHistoricalQuery(historicalQuery());
  assert.equal(query.ok, true);
  const observations = [observation(), observation({ observedAt: "2026-07-04T08:00:00.000Z", value: 3 })];
  const snapshot = JSON.stringify(observations);
  const result = IA.bucketHistoricalObservations(observations, query.value);
  assert.equal(result.ok, true);
  assert.equal(JSON.stringify(observations), snapshot);
});

test("7. output does not expose mutable shared state", () => {
  const { runtime } = buildFacade([
    observation({ observedAt: "2026-07-01T10:00:00.000Z", value: 1 }),
    observation({ observedAt: "2026-07-02T10:00:00.000Z", value: 2 }),
  ]);
  const result = runtime.analyze(historicalQuery(), { tenantId: "tenant-a" });
  assert.equal(result.ok, true);
  assert.ok(Object.isFrozen(result.value));
  assert.ok(Object.isFrozen(result.value.series));
  assert.throws(() => {
    /** @type {any} */ (result.value).series = null;
  });
});

test("8. exact metric version is resolved", () => {
  const registry = buildRegistry([
    registrationRequest({ version: "1.0.0" }),
    registrationRequest({ version: "2.0.0" }),
  ]);
  const adapter = IA.createInMemoryHistoricalSourceAdapter({
    observations: [
      observation({ metricVersion: "2.0.0", value: 5 }),
      observation({ metricVersion: "1.0.0", value: 99 }),
    ],
    provenance: PROVENANCE,
  });
  assert.equal(adapter.ok, true);
  const runtime = IA.createHistoricalAnalyticsRuntime({
    registry,
    sourceAdapter: adapter.value,
    nowIso: () => FIXED_NOW,
  });
  assert.equal(runtime.ok, true);
  const result = runtime.value.analyze(
    historicalQuery({ metricVersion: "2.0.0" }),
    { tenantId: "tenant-a" }
  );
  assert.equal(result.ok, true);
  assert.equal(result.value.metricVersion, "2.0.0");
  assert.equal(result.value.resolvedMetric.version, "2.0.0");
  const observed = result.value.series.points.filter((p) => p.origin === "observed");
  assert.equal(observed.length, 1);
  assert.equal(observed[0].value, 5);
});

test("9. missing metric returns typed error", () => {
  const { runtime } = buildFacade([observation()]);
  const result = runtime.analyze(
    historicalQuery({ metricId: "ia.demo.missing" }),
    { tenantId: "tenant-a" }
  );
  assert.equal(result.ok, false);
  assert.ok(
    [
      IA.ANALYTICS_ERROR_CODE.METRIC_NOT_FOUND,
      IA.ANALYTICS_ERROR_CODE.METRIC_VERSION_NOT_FOUND,
    ].includes(result.error.code)
  );
});

test("10. retired metric is rejected", () => {
  const { runtime } = buildFacade(
    [observation()],
    [registrationRequest({ lifecycleState: IA.ANALYTICS_METRIC_LIFECYCLE_STATE.RETIRED })]
  );
  const result = runtime.analyze(historicalQuery(), { tenantId: "tenant-a" });
  assert.equal(result.ok, false);
  assert.equal(result.error.code, IA.ANALYTICS_ERROR_CODE.METRIC_RETIRED);
});

test("11. deprecated metric returns warning", () => {
  const { runtime } = buildFacade(
    [observation({ observedAt: "2026-07-01T10:00:00.000Z" })],
    [
      registrationRequest({
        lifecycleState: IA.ANALYTICS_METRIC_LIFECYCLE_STATE.DEPRECATED,
        deprecation: {
          deprecatedAt: "2026-06-01T00:00:00.000Z",
          reason: "replaced",
          replacement: { metricId: "ia.demo.historical_sum", version: "2.0.0" },
        },
      }),
    ]
  );
  const result = runtime.analyze(historicalQuery(), { tenantId: "tenant-a" });
  assert.equal(result.ok, true);
  assert.ok(
    result.value.warnings.some((w) => w.code === "ANALYTICS_METRIC_DEPRECATED")
  );
});

test("12-13. time-window boundaries and out-of-window exclusion", () => {
  const query = IA.createAnalyticsHistoricalQuery(historicalQuery());
  assert.equal(query.ok, true);
  const result = IA.bucketHistoricalObservations(
    [
      observation({ observedAt: "2026-06-30T23:59:59.000Z", value: 100 }),
      observation({ observedAt: "2026-07-01T00:00:00.000Z", value: 1 }),
      observation({ observedAt: "2026-07-05T23:59:59.999Z", value: 2 }),
      observation({ observedAt: "2026-07-06T00:00:00.000Z", value: 200 }),
    ],
    query.value
  );
  assert.equal(result.ok, true);
  const observedValues = result.value.series.points
    .filter((p) => p.origin === "observed")
    .map((p) => p.value)
    .sort((a, b) => a - b);
  assert.deepEqual(observedValues, [1, 2]);
});

test("14. invalid timestamp is rejected", () => {
  const query = IA.createAnalyticsHistoricalQuery(historicalQuery());
  assert.equal(query.ok, true);
  const result = IA.bucketHistoricalObservations(
    [observation({ observedAt: "not-a-timestamp" })],
    query.value
  );
  assert.equal(result.ok, false);
  assert.equal(result.error.code, IA.ANALYTICS_ERROR_CODE.HISTORICAL_OBSERVATION_INVALID);
});

test("15-17. daily/weekly/monthly bucketing deterministic and ordered", () => {
  const dayQuery = IA.createAnalyticsHistoricalQuery(historicalQuery());
  assert.equal(dayQuery.ok, true);
  const day = IA.bucketHistoricalObservations(
    [
      observation({ observedAt: "2026-07-03T15:00:00.000Z", value: 3 }),
      observation({ observedAt: "2026-07-01T09:00:00.000Z", value: 1 }),
      observation({ observedAt: "2026-07-01T18:00:00.000Z", value: 4 }),
    ],
    dayQuery.value
  );
  assert.equal(day.ok, true);
  const keys = day.value.series.points.map((p) => p.bucket.key);
  const sorted = [...keys].sort((a, b) => a.localeCompare(b));
  assert.deepEqual(keys, sorted);
  assert.equal(day.value.series.points[0].bucket.key, "2026-07-01T00:00:00.000Z");
  assert.equal(day.value.series.points[0].value, 5);

  const weekQuery = IA.createAnalyticsHistoricalQuery(
    historicalQuery({
      granularity: IA.ANALYTICS_GRANULARITY.WEEK,
      timeWindow: {
        startAt: "2026-06-29T00:00:00.000Z",
        endAt: "2026-07-19T23:59:59.999Z",
        inclusive: true,
        timezone: "UTC",
      },
    })
  );
  assert.equal(weekQuery.ok, true);
  const week = IA.bucketHistoricalObservations(
    [observation({ observedAt: "2026-07-01T10:00:00.000Z", value: 7 })],
    weekQuery.value
  );
  assert.equal(week.ok, true);
  assert.ok(week.value.series.points.some((p) => p.value === 7));

  const monthQuery = IA.createAnalyticsHistoricalQuery(
    historicalQuery({
      granularity: IA.ANALYTICS_GRANULARITY.MONTH,
      timeWindow: {
        startAt: "2026-01-01T00:00:00.000Z",
        endAt: "2026-03-31T23:59:59.999Z",
        inclusive: true,
        timezone: "UTC",
      },
    })
  );
  assert.equal(monthQuery.ok, true);
  const month = IA.bucketHistoricalObservations(
    [observation({ observedAt: "2026-02-15T10:00:00.000Z", value: 9 })],
    monthQuery.value
  );
  assert.equal(month.ok, true);
  assert.equal(month.value.series.coverage.expectedBucketCount, 3);
  assert.equal(
    month.value.series.points.find((p) => p.bucket.key.startsWith("2026-02"))
      ?.value,
    9
  );
});

test("18. empty input has deterministic result", () => {
  const query = IA.createAnalyticsHistoricalQuery(historicalQuery());
  assert.equal(query.ok, true);
  const a = IA.bucketHistoricalObservations([], query.value);
  const b = IA.bucketHistoricalObservations([], query.value);
  assert.equal(a.ok, true);
  assert.equal(b.ok, true);
  assert.equal(JSON.stringify(a.value.series), JSON.stringify(b.value.series));
  assert.equal(a.value.series.coverage.observedBucketCount, 0);
  assert.equal(
    a.value.series.coverage.completeness,
    IA.ANALYTICS_COMPLETENESS_STATE.EMPTY
  );
});

test("19-22. missing periods, default no zero-fill, fill-zero only when allowed, synthetic marker", () => {
  const preserveQuery = IA.createAnalyticsHistoricalQuery(historicalQuery());
  assert.equal(preserveQuery.ok, true);
  const preserve = IA.bucketHistoricalObservations(
    [observation({ observedAt: "2026-07-01T10:00:00.000Z", value: 1 })],
    preserveQuery.value
  );
  assert.equal(preserve.ok, true);
  assert.ok(preserve.value.series.missingPeriods.length > 0);
  const missingPoint = preserve.value.series.points.find(
    (p) => p.origin === IA.ANALYTICS_POINT_ORIGIN.MISSING
  );
  assert.ok(missingPoint);
  assert.equal(missingPoint.value, null);
  assert.equal(missingPoint.synthetic, false);

  const denied = IA.bucketHistoricalObservations(
    [observation({ observedAt: "2026-07-01T10:00:00.000Z", value: 1 })],
    IA.createAnalyticsHistoricalQuery(
      historicalQuery({
        missingPeriodPolicy: IA.ANALYTICS_MISSING_PERIOD_POLICY.FILL_ZERO_WHEN_ALLOWED,
      })
    ).value,
    { missingDataSemantics: IA.ANALYTICS_MISSING_DATA_SEMANTICS.PRESERVE_NULL }
  );
  assert.equal(denied.ok, true);
  assert.ok(
    denied.value.series.points.some(
      (p) => p.origin === IA.ANALYTICS_POINT_ORIGIN.MISSING && p.value === null
    )
  );

  const allowed = IA.bucketHistoricalObservations(
    [observation({ observedAt: "2026-07-01T10:00:00.000Z", value: 1 })],
    IA.createAnalyticsHistoricalQuery(
      historicalQuery({
        missingPeriodPolicy: IA.ANALYTICS_MISSING_PERIOD_POLICY.FILL_ZERO_WHEN_ALLOWED,
      })
    ).value,
    { missingDataSemantics: IA.ANALYTICS_MISSING_DATA_SEMANTICS.COALESCE_ZERO }
  );
  assert.equal(allowed.ok, true);
  const filled = allowed.value.series.points.find(
    (p) => p.origin === IA.ANALYTICS_POINT_ORIGIN.SYNTHETIC_FILLED
  );
  assert.ok(filled);
  assert.equal(filled.value, 0);
  assert.equal(filled.synthetic, true);
});

test("23-24. coverage ratio correct and partial not complete", () => {
  const query = IA.createAnalyticsHistoricalQuery(historicalQuery());
  assert.equal(query.ok, true);
  const result = IA.bucketHistoricalObservations(
    [observation({ observedAt: "2026-07-01T10:00:00.000Z", value: 1 })],
    query.value
  );
  assert.equal(result.ok, true);
  const { coverage } = result.value.series;
  assert.equal(coverage.expectedBucketCount, 5);
  assert.equal(coverage.observedBucketCount, 1);
  assert.equal(coverage.missingBucketCount, 4);
  assert.equal(coverage.coverageRatio, 0.2);
  assert.equal(coverage.completeness, IA.ANALYTICS_COMPLETENESS_STATE.PARTIAL);
  assert.notEqual(coverage.completeness, IA.ANALYTICS_COMPLETENESS_STATE.COMPLETE);
});

test("25-26. stale source keeps stale; provenance retained", () => {
  const { runtime } = buildFacade(
    [observation({ observedAt: "2026-07-01T10:00:00.000Z", value: 1 })],
    [registrationRequest()],
    {
      freshness: IA.ANALYTICS_FRESHNESS_STATE.STALE,
      sourceTimestamp: "2026-07-20T00:00:00.000Z",
    }
  );
  const result = runtime.analyze(historicalQuery(), { tenantId: "tenant-a" });
  assert.equal(result.ok, true);
  assert.equal(result.value.freshness, IA.ANALYTICS_FRESHNESS_STATE.STALE);
  assert.equal(result.value.stale, true);
  assert.equal(result.value.provenance.source.sourceId, SOURCE.sourceId);
  assert.equal(result.value.sourceTimestamp, "2026-07-20T00:00:00.000Z");
  assert.equal(result.value.generatedAt, FIXED_NOW);
});

test("27-32. previous-period / baseline comparison and change math", () => {
  const absolute = IA.createAnalyticsChange(120, 100);
  assert.equal(absolute.ok, true);
  assert.equal(absolute.value.absolute, 20);
  assert.equal(absolute.value.relative, 0.2);
  assert.equal(absolute.value.percentage, 20);
  assert.equal(absolute.value.direction, IA.ANALYTICS_CHANGE_DIRECTION.INCREASE);

  const zeroBase = IA.createAnalyticsChange(5, 0);
  assert.equal(zeroBase.ok, true);
  assert.equal(zeroBase.value.absolute, 5);
  assert.equal(zeroBase.value.relative, null);
  assert.equal(zeroBase.value.percentage, null);
  assert.notEqual(zeroBase.value.relative, Infinity);

  const missingBase = IA.createAnalyticsChange(5, null);
  assert.equal(missingBase.ok, true);
  assert.equal(missingBase.value.direction, IA.ANALYTICS_CHANGE_DIRECTION.INDETERMINATE);
  assert.equal(missingBase.value.available, false);

  const { runtime } = buildFacade([
    observation({ observedAt: "2026-07-02T10:00:00.000Z", value: 30 }),
    observation({ observedAt: "2026-06-27T10:00:00.000Z", value: 10 }),
  ]);
  const previous = runtime.analyze(
    historicalQuery({
      timeWindow: {
        startAt: "2026-07-01T00:00:00.000Z",
        endAt: "2026-07-05T23:59:59.999Z",
        inclusive: true,
        timezone: "UTC",
      },
      comparison: { kind: IA.ANALYTICS_COMPARISON_KIND.PREVIOUS_EQUIVALENT_PERIOD },
    }),
    { tenantId: "tenant-a" }
  );
  assert.equal(previous.ok, true);
  assert.ok(previous.value.comparison);
  assert.equal(
    previous.value.comparison.kind,
    IA.ANALYTICS_COMPARISON_KIND.PREVIOUS_EQUIVALENT_PERIOD
  );
  assert.equal(previous.value.comparison.currentValue, 30);
  assert.equal(previous.value.comparison.baselineValue, 10);
  assert.equal(previous.value.comparison.change.absolute, 20);

  const baseline = runtime.analyze(
    historicalQuery({
      baseline: {
        label: "june-window",
        timeWindow: {
          startAt: "2026-06-25T00:00:00.000Z",
          endAt: "2026-06-29T23:59:59.999Z",
          inclusive: true,
          timezone: "UTC",
        },
      },
    }),
    { tenantId: "tenant-a" }
  );
  assert.equal(baseline.ok, true);
  assert.equal(
    baseline.value.comparison.kind,
    IA.ANALYTICS_COMPARISON_KIND.EXPLICIT_BASELINE
  );
  assert.equal(baseline.value.comparison.baselineLabel, "june-window");
  assert.equal(baseline.value.comparison.baselineValue, 10);
});

test("33-37. trend classifications", () => {
  const increasing = IA.analyzeTrend({ values: [1, 2, 3, 4, 5] });
  assert.equal(increasing.ok, true);
  assert.equal(increasing.value.direction, IA.ANALYTICS_TREND_DIRECTION.INCREASING);

  const decreasing = IA.analyzeTrend({ values: [10, 8, 6, 4, 2] });
  assert.equal(decreasing.ok, true);
  assert.equal(decreasing.value.direction, IA.ANALYTICS_TREND_DIRECTION.DECREASING);

  const stable = IA.analyzeTrend({ values: [5, 5, 5, 5] });
  assert.equal(stable.ok, true);
  assert.equal(stable.value.direction, IA.ANALYTICS_TREND_DIRECTION.STABLE);

  const insufficient = IA.analyzeTrend({ values: [1] });
  assert.equal(insufficient.ok, true);
  assert.equal(
    insufficient.value.direction,
    IA.ANALYTICS_TREND_DIRECTION.INSUFFICIENT_DATA
  );

  const volatile = IA.analyzeTrend({
    values: [1, 20, 2, 25, 1, 30],
    volatileCvThreshold: 0.2,
  });
  assert.equal(volatile.ok, true);
  assert.equal(volatile.value.direction, IA.ANALYTICS_TREND_DIRECTION.VOLATILE);
});

test("38. same input produces same result", () => {
  const { runtime } = buildFacade([
    observation({ observedAt: "2026-07-01T10:00:00.000Z", value: 1 }),
    observation({ observedAt: "2026-07-02T10:00:00.000Z", value: 4 }),
    observation({ observedAt: "2026-07-03T10:00:00.000Z", value: 9 }),
  ]);
  const a = runtime.analyze(historicalQuery(), { tenantId: "tenant-a" });
  const b = runtime.analyze(historicalQuery(), { tenantId: "tenant-a" });
  assert.equal(a.ok, true);
  assert.equal(b.ok, true);
  assert.equal(JSON.stringify(a.value.series), JSON.stringify(b.value.series));
  assert.equal(JSON.stringify(a.value.trend), JSON.stringify(b.value.trend));
  assert.equal(a.value.generatedAt, FIXED_NOW);
});

test("39-41. moving average/sum and invalid window", () => {
  const query = IA.createAnalyticsHistoricalQuery(
    historicalQuery({
      missingPeriodPolicy: IA.ANALYTICS_MISSING_PERIOD_POLICY.OMIT,
      timeWindow: {
        startAt: "2026-07-01T00:00:00.000Z",
        endAt: "2026-07-03T23:59:59.999Z",
        inclusive: true,
        timezone: "UTC",
      },
    })
  );
  assert.equal(query.ok, true);
  const bucketed = IA.bucketHistoricalObservations(
    [
      observation({ observedAt: "2026-07-01T10:00:00.000Z", value: 2 }),
      observation({ observedAt: "2026-07-02T10:00:00.000Z", value: 4 }),
      observation({ observedAt: "2026-07-03T10:00:00.000Z", value: 6 }),
    ],
    query.value
  );
  assert.equal(bucketed.ok, true);

  const avg = IA.applyMovingWindow(bucketed.value.series, {
    kind: IA.ANALYTICS_MOVING_WINDOW_KIND.AVERAGE,
    size: 2,
  });
  assert.equal(avg.ok, true);
  assert.equal(avg.value.points[0].value, null);
  assert.equal(avg.value.points[1].value, 3);
  assert.equal(avg.value.points[2].value, 5);

  const sum = IA.applyMovingWindow(bucketed.value.series, {
    kind: IA.ANALYTICS_MOVING_WINDOW_KIND.SUM,
    size: 2,
  });
  assert.equal(sum.ok, true);
  assert.equal(sum.value.points[2].value, 10);

  const invalid = IA.applyMovingWindow(bucketed.value.series, {
    kind: IA.ANALYTICS_MOVING_WINDOW_KIND.AVERAGE,
    size: 0,
  });
  assert.equal(invalid.ok, false);
  assert.equal(
    invalid.error.code,
    IA.ANALYTICS_ERROR_CODE.HISTORICAL_MOVING_WINDOW_INVALID
  );
});

test("42-44. cumulative sum/count and unsupported average reject", () => {
  const query = IA.createAnalyticsHistoricalQuery(
    historicalQuery({
      missingPeriodPolicy: IA.ANALYTICS_MISSING_PERIOD_POLICY.OMIT,
      timeWindow: {
        startAt: "2026-07-01T00:00:00.000Z",
        endAt: "2026-07-03T23:59:59.999Z",
        inclusive: true,
        timezone: "UTC",
      },
    })
  );
  assert.equal(query.ok, true);
  const bucketed = IA.bucketHistoricalObservations(
    [
      observation({ observedAt: "2026-07-01T10:00:00.000Z", value: 2 }),
      observation({ observedAt: "2026-07-02T10:00:00.000Z", value: 4 }),
      observation({ observedAt: "2026-07-03T10:00:00.000Z", value: 6 }),
    ],
    query.value
  );
  assert.equal(bucketed.ok, true);

  const cumSum = IA.applyCumulative(bucketed.value.series, { kind: "sum" });
  assert.equal(cumSum.ok, true);
  assert.deepEqual(
    cumSum.value.points.map((p) => p.value),
    [2, 6, 12]
  );

  const cumCount = IA.applyCumulative(bucketed.value.series, { kind: "count" });
  assert.equal(cumCount.ok, true);
  assert.deepEqual(
    cumCount.value.points.map((p) => p.value),
    [1, 2, 3]
  );

  const rejected = IA.applyCumulative(bucketed.value.series, {
    kind: "sum",
    aggregationKind: IA.ANALYTICS_AGGREGATION_KIND.AVERAGE,
  });
  assert.equal(rejected.ok, false);
  assert.equal(
    rejected.error.code,
    IA.ANALYTICS_ERROR_CODE.HISTORICAL_CUMULATIVE_INVALID
  );
});

test("45-46. missing value not coerced to zero; invalid numeric typed", () => {
  const query = IA.createAnalyticsHistoricalQuery(historicalQuery());
  assert.equal(query.ok, true);
  const missing = IA.bucketHistoricalObservations(
    [observation({ observedAt: "2026-07-01T10:00:00.000Z", value: null, missing: true })],
    query.value
  );
  assert.equal(missing.ok, true);
  const observed = missing.value.series.points.find((p) => p.origin === "observed");
  assert.ok(observed);
  assert.equal(observed.value, null);

  const invalid = IA.bucketHistoricalObservations(
    [observation({ value: Number.NaN })],
    query.value
  );
  assert.equal(invalid.ok, false);
  assert.equal(invalid.error.code, IA.ANALYTICS_ERROR_CODE.INVALID_NUMERIC_INPUT);
});

test("47-48. source failure wrapped; invalid query does not call source", () => {
  let called = 0;
  const registry = buildRegistry([registrationRequest()]);
  const adapter = {
    query() {
      called += 1;
      throw new Error("boom");
    },
  };
  const runtime = IA.createHistoricalAnalyticsRuntime({
    registry,
    sourceAdapter: adapter,
    nowIso: () => FIXED_NOW,
  });
  assert.equal(runtime.ok, true);

  const invalid = runtime.value.analyze(
    historicalQuery({ metricId: "" }),
    { tenantId: "tenant-a" }
  );
  assert.equal(invalid.ok, false);
  assert.equal(called, 0);

  const failed = runtime.value.analyze(historicalQuery(), { tenantId: "tenant-a" });
  assert.equal(failed.ok, false);
  assert.equal(failed.error.code, IA.ANALYTICS_ERROR_CODE.SOURCE_FAILURE);
  assert.equal(called, 1);
});

test("49. read-only facade does not expose write", () => {
  const { runtime } = buildFacade([observation()]);
  const write = /** @type {any} */ (runtime).write();
  assert.equal(write.ok, false);
  assert.equal(write.error.code, IA.ANALYTICS_ERROR_CODE.FACADE_WRITE_REJECTED);
  const persist = /** @type {any} */ (runtime).persist();
  assert.equal(persist.ok, false);
});

test("50-53. no React / Platform Core / Supabase / business-module imports", () => {
  const files = listJsFiles(HT_ROOT);
  assert.ok(files.length > 0);
  const forbidden = [
    /from\s+['"]react['"]/,
    /from\s+['"]@mui\//,
    /from\s+['"].*core\/platform/,
    /from\s+['"]@supabase\//,
    /createClient/,
    /from\s+['"].*features\/finance/,
    /from\s+['"].*features\/competition-engine/,
    /from\s+['"].*features\/customer/,
    /from\s+['"].*features\/player-rating/,
    /from\s+['"].*features\/vpr-ranking/,
    /localStorage/,
  ];
  for (const file of files) {
    const text = readFileSync(file, "utf8");
    for (const pattern of forbidden) {
      assert.equal(pattern.test(text), false, `${file} matched ${pattern}`);
    }
  }
});

test("54. no global singleton historical runtime", () => {
  const a = buildFacade([observation()]);
  const b = buildFacade([observation()]);
  assert.notEqual(a.runtime, b.runtime);
});

test("55-56. metric versions and tenants are not mixed", () => {
  const query = IA.createAnalyticsHistoricalQuery(historicalQuery());
  assert.equal(query.ok, true);
  const result = IA.bucketHistoricalObservations(
    [
      observation({ metricVersion: "1.0.0", value: 1, observedAt: "2026-07-01T10:00:00.000Z" }),
      observation({ metricVersion: "2.0.0", value: 99, observedAt: "2026-07-01T11:00:00.000Z" }),
      observation({
        tenantScope: tenantScope({ tenantId: "tenant-b" }),
        value: 77,
        observedAt: "2026-07-01T12:00:00.000Z",
      }),
    ],
    query.value
  );
  assert.equal(result.ok, true);
  const observed = result.value.series.points.filter((p) => p.origin === "observed");
  assert.equal(observed.length, 1);
  assert.equal(observed[0].value, 1);
});

test("57-58. effective window retained; generated timestamp injectable", () => {
  const { runtime } = buildFacade([
    observation({ observedAt: "2026-07-01T10:00:00.000Z", value: 1 }),
  ]);
  const result = runtime.analyze(historicalQuery(), { tenantId: "tenant-a" });
  assert.equal(result.ok, true);
  assert.equal(result.value.requestedWindow.startAt, "2026-07-01T00:00:00.000Z");
  assert.equal(result.value.effectiveWindow.startAt, "2026-07-01T00:00:00.000Z");
  assert.equal(result.value.generatedAt, FIXED_NOW);
});

test("59. I&A-04 time-series payload compatibility not broken", () => {
  const payload = IA.createAnalyticsTimeSeriesPayload({
    metricId: "ia.demo.historical_sum",
    metricVersion: "1.0.0",
    seriesId: "compat",
    granularity: IA.ANALYTICS_GRANULARITY.DAY,
    effectiveWindow: {
      startAt: "2026-07-01T00:00:00.000Z",
      endAt: "2026-07-05T23:59:59.999Z",
    },
    points: [
      { key: "2026-07-02T00:00:00.000Z", value: 2 },
      { key: "2026-07-01T00:00:00.000Z", value: 1 },
    ],
    dataState: {
      state: IA.ANALYTICS_DATA_STATE.READY,
      provenance: PROVENANCE,
      freshness: IA.ANALYTICS_FRESHNESS_STATE.FRESH,
    },
    provenance: PROVENANCE,
  });
  assert.equal(payload.ok, true);
  assert.equal(payload.value.points[0].key, "2026-07-01T00:00:00.000Z");
});

test("60. facade cumulative path and validate-only path", () => {
  const { runtime } = buildFacade([
    observation({ observedAt: "2026-07-01T10:00:00.000Z", value: 2 }),
    observation({ observedAt: "2026-07-02T10:00:00.000Z", value: 3 }),
  ]);
  const validated = runtime.validate(historicalQuery(), { tenantId: "tenant-a" });
  assert.equal(validated.ok, true);

  const analyzed = runtime.analyze(
    historicalQuery({
      includeCumulative: true,
      movingWindow: { kind: IA.ANALYTICS_MOVING_WINDOW_KIND.SUM, size: 2 },
      missingPeriodPolicy: IA.ANALYTICS_MISSING_PERIOD_POLICY.OMIT,
      timeWindow: {
        startAt: "2026-07-01T00:00:00.000Z",
        endAt: "2026-07-02T23:59:59.999Z",
        inclusive: true,
        timezone: "UTC",
      },
    }),
    { tenantId: "tenant-a" }
  );
  assert.equal(analyzed.ok, true);
  assert.ok(analyzed.value.cumulative);
  assert.ok(analyzed.value.movingWindow);
  assert.equal(analyzed.value.cumulative.finalValue, 5);
});
