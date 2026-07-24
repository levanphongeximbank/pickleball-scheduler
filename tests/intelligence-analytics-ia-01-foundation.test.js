/**
 * I&A-01 — Canonical Analytics Contracts Foundation certification tests.
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

const WINDOW = Object.freeze({
  startAt: "2026-07-01T00:00:00.000Z",
  endAt: "2026-07-07T23:59:59.999Z",
  timezone: "UTC",
});

const SOURCE = Object.freeze({
  sourceId: "explicit-observations",
  sourceKind: "explicit_input",
  ownerModule: "intelligence-analytics",
  reference: "caller-supplied",
});

const PROVENANCE = Object.freeze({
  source: SOURCE,
  observedAt: "2026-07-07T12:00:00.000Z",
  ingestedAt: "2026-07-07T12:00:01.000Z",
  transformer: "aggregateExplicit",
});

function baseQuery(overrides = {}) {
  return {
    metricId: "ia.demo.observation_sum",
    metricVersion: "1.0.0",
    tenantScope: {
      kind: IA.ANALYTICS_TENANT_SCOPE_KIND.TENANT,
      tenantId: "tenant-a",
    },
    timeWindow: WINDOW,
    aggregationKind: IA.ANALYTICS_AGGREGATION_KIND.SUM,
    granularity: IA.ANALYTICS_GRANULARITY.WINDOW,
    filters: [],
    ...overrides,
  };
}

function listJsFiles(dir) {
  /** @type {string[]} */
  const files = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      files.push(...listJsFiles(full));
    } else if (entry.endsWith(".js")) {
      files.push(full);
    }
  }
  return files;
}

test("public facade exports foundation API", () => {
  for (const name of IA.INTELLIGENCE_ANALYTICS_PUBLIC_EXPORTS) {
    assert.ok(name in IA, `missing export: ${name}`);
  }
  assert.equal(IA.INTELLIGENCE_ANALYTICS_FOUNDATION.workstreamId, "I&A-01");
  assert.equal(typeof IA.createReadOnlyAnalyticsFacade, "function");
  assert.equal(typeof IA.aggregateExplicit, "function");
});

test("metric ID and version are mandatory", () => {
  const idFail = IA.createAnalyticsMetricId("");
  assert.equal(idFail.ok, false);
  assert.equal(idFail.error.code, IA.ANALYTICS_ERROR_CODE.METRIC_ID_REQUIRED);

  const versionFail = IA.createAnalyticsMetricVersion("   ");
  assert.equal(versionFail.ok, false);
  assert.equal(
    versionFail.error.code,
    IA.ANALYTICS_ERROR_CODE.METRIC_VERSION_REQUIRED
  );

  const queryFail = IA.createAnalyticsQueryDescriptor({
    ...baseQuery(),
    metricId: "",
    metricVersion: "",
  });
  assert.equal(queryFail.ok, false);
});

test("tenant-scoped query without tenant context fails closed", () => {
  const missingTenant = IA.createAnalyticsQueryDescriptor(
    baseQuery({
      tenantScope: { kind: IA.ANALYTICS_TENANT_SCOPE_KIND.TENANT },
    })
  );
  assert.equal(missingTenant.ok, false);
  assert.equal(
    missingTenant.error.code,
    IA.ANALYTICS_ERROR_CODE.TENANT_CONTEXT_REQUIRED
  );

  const missingClub = IA.createAnalyticsTenantScope({
    kind: IA.ANALYTICS_TENANT_SCOPE_KIND.CLUB,
    tenantId: "tenant-a",
  });
  assert.equal(missingClub.ok, false);
  assert.equal(
    missingClub.error.code,
    IA.ANALYTICS_ERROR_CODE.TENANT_CONTEXT_REQUIRED
  );
});

test("query descriptor is immutable / frozen", () => {
  const created = IA.createAnalyticsQueryDescriptor(baseQuery());
  assert.equal(created.ok, true);
  assert.ok(Object.isFrozen(created.value));
  assert.ok(Object.isFrozen(created.value.tenantScope));
  assert.ok(Object.isFrozen(created.value.timeWindow));
  assert.ok(Object.isFrozen(created.value.filters));

  assert.throws(() => {
    /** @type {{ metricId: string }} */ (created.value).metricId = "mutated";
  }, TypeError);

  const clone = IA.cloneAnalyticsQueryDescriptor(created.value);
  assert.notEqual(clone, created.value);
  assert.deepEqual(clone, created.value);
  assert.ok(Object.isFrozen(clone));
});

test("analytics result preserves provenance and is not canonical module state", () => {
  const result = IA.createAnalyticsResult({
    metricId: "ia.demo.observation_sum",
    metricVersion: "1.0.0",
    tenantScope: {
      kind: IA.ANALYTICS_TENANT_SCOPE_KIND.TENANT,
      tenantId: "tenant-a",
    },
    requestedWindow: WINDOW,
    generatedAt: "2026-07-07T12:05:00.000Z",
    provenance: PROVENANCE,
    freshness: IA.ANALYTICS_FRESHNESS_STATE.FRESH,
    dataPoints: [{ key: "aggregate", value: 10 }],
  });
  assert.equal(result.ok, true);
  assert.equal(result.value.isCanonicalModuleState, false);
  assert.equal(result.value.provenance.source.sourceId, "explicit-observations");
  assert.equal(result.value.provenance.transformer, "aggregateExplicit");
  assert.deepEqual(result.value.requestedWindow, result.value.effectiveWindow);
});

test("identical explicit input yields identical aggregation output", () => {
  const observations = [1, 2, 3, 4];
  const options = {
    aggregationKind: IA.ANALYTICS_AGGREGATION_KIND.SUM,
  };
  const a = IA.aggregateExplicit(observations, options);
  const b = IA.aggregateExplicit(observations, options);
  assert.equal(a.ok, true);
  assert.equal(b.ok, true);
  assert.deepEqual(a.value, b.value);
  assert.equal(a.value.value, 10);
});

test("empty input has defined behavior", () => {
  const empty = IA.aggregateExplicit([], {
    aggregationKind: IA.ANALYTICS_AGGREGATION_KIND.AVERAGE,
  });
  assert.equal(empty.ok, true);
  assert.equal(empty.value.value, null);
  assert.equal(empty.value.observationCount, 0);
  assert.equal(empty.value.includedCount, 0);
});

test("invalid numeric input returns typed error", () => {
  const invalid = IA.aggregateExplicit([1, Number.NaN, 3], {
    aggregationKind: IA.ANALYTICS_AGGREGATION_KIND.SUM,
  });
  assert.equal(invalid.ok, false);
  assert.equal(
    invalid.error.code,
    IA.ANALYTICS_ERROR_CODE.INVALID_NUMERIC_INPUT
  );

  const infinity = IA.aggregateExplicit([1, Number.POSITIVE_INFINITY], {
    aggregationKind: IA.ANALYTICS_AGGREGATION_KIND.SUM,
  });
  assert.equal(infinity.ok, false);
});

test("missing data is not coerced to zero under PRESERVE_NULL", () => {
  const preserved = IA.aggregateExplicit([1, null, 3], {
    aggregationKind: IA.ANALYTICS_AGGREGATION_KIND.SUM,
    missingDataSemantics: IA.ANALYTICS_MISSING_DATA_SEMANTICS.PRESERVE_NULL,
  });
  assert.equal(preserved.ok, true);
  assert.equal(preserved.value.value, 4);
  assert.equal(preserved.value.missingCount, 1);
  assert.notEqual(preserved.value.value, 0);

  const allMissing = IA.aggregateExplicit([null, undefined], {
    aggregationKind: IA.ANALYTICS_AGGREGATION_KIND.SUM,
    missingDataSemantics: IA.ANALYTICS_MISSING_DATA_SEMANTICS.PRESERVE_NULL,
  });
  assert.equal(allMissing.ok, true);
  assert.equal(allMissing.value.value, null);

  const coalesce = IA.aggregateExplicit([null, null], {
    aggregationKind: IA.ANALYTICS_AGGREGATION_KIND.SUM,
    missingDataSemantics: IA.ANALYTICS_MISSING_DATA_SEMANTICS.COALESCE_ZERO,
  });
  assert.equal(coalesce.ok, true);
  assert.equal(coalesce.value.value, 0);
});

test("unsupported aggregation and invalid descriptor return typed errors", () => {
  const unsupported = IA.aggregateExplicit([1, 2], {
    aggregationKind: "median",
  });
  assert.equal(unsupported.ok, false);
  assert.equal(
    unsupported.error.code,
    IA.ANALYTICS_ERROR_CODE.UNSUPPORTED_AGGREGATION
  );

  const badQuery = IA.createAnalyticsQueryDescriptor(
    baseQuery({ aggregationKind: "percentile" })
  );
  assert.equal(badQuery.ok, false);
  assert.equal(
    badQuery.error.code,
    IA.ANALYTICS_ERROR_CODE.UNSUPPORTED_AGGREGATION
  );
});

test("read-only facade does not expose write commands", () => {
  const facade = IA.createReadOnlyAnalyticsFacade({
    nowIso: () => "2026-07-07T12:05:00.000Z",
  });

  assert.equal(typeof facade.query, "function");
  assert.equal(typeof facade.aggregate, "function");
  assert.equal(typeof facade.validateQuery, "function");
  assert.equal(typeof facade.describeMetric, "function");

  for (const writeName of ["write", "command", "mutate", "insert", "update", "delete", "save"]) {
    const rejected = /** @type {Function} */ (facade[writeName])();
    assert.equal(rejected.ok, false);
    assert.equal(
      rejected.error.code,
      IA.ANALYTICS_ERROR_CODE.FACADE_WRITE_REJECTED
    );
  }

  const aggregate = facade.aggregate(baseQuery(), [2, 3, 5], {
    provenance: PROVENANCE,
    missingDataSemantics: IA.ANALYTICS_MISSING_DATA_SEMANTICS.OMIT,
  });
  assert.equal(aggregate.ok, true);
  assert.equal(aggregate.value.aggregation.value, 10);
  assert.equal(aggregate.value.result.provenance.source.sourceId, SOURCE.sourceId);
  assert.equal(aggregate.value.result.isCanonicalModuleState, false);
});

test("contract module does not import database/Supabase/React/Platform Core", () => {
  const forbidden = [
    /from\s+["'].*core\/platform/,
    /from\s+["']@supabase/,
    /from\s+["']react["']/,
    /from\s+["']react-dom["']/,
    /createClient\s*\(/,
    /\.from\s*\(\s*["'][a-z0-9_]+["']\s*\)/,
  ];

  const files = listJsFiles(MODULE_ROOT);
  assert.ok(files.length > 0);

  for (const file of files) {
    const content = readFileSync(file, "utf8");
    for (const pattern of forbidden) {
      assert.equal(
        pattern.test(content),
        false,
        `${path.relative(MODULE_ROOT, file)} matched forbidden pattern ${pattern}`
      );
    }
  }
});

test("module-neutral projection does not encode domain business rules", () => {
  const point = IA.projectAnalyticsDataPoint({
    key: "count",
    value: 3,
    dimensions: { segment: "A" },
  });
  assert.equal(point.ok, true);
  assert.equal(point.value.value, 3);

  const series = IA.projectAnalyticsSeries({
    seriesId: "s1",
    points: [
      { key: "d1", value: 1 },
      { key: "d2", value: null, missing: true },
    ],
  });
  assert.equal(series.ok, true);
  assert.equal(series.value.points.length, 2);
  assert.equal(series.value.points[1].value, null);

  // Projection API must not accept / invent standings/tie-break style fields as required.
  const files = listJsFiles(path.join(MODULE_ROOT, "projections"));
  for (const file of files) {
    const content = readFileSync(file, "utf8");
    assert.equal(/tieBreak|standings|eloDelta|feePolicy/i.test(content), false);
  }
});

test("metric definition requires identity, source, and semantics", () => {
  const def = IA.createAnalyticsMetricDefinition({
    metricId: "ia.demo.observation_sum",
    version: "1.0.0",
    definition: "Sum of caller-supplied observation values for foundation certification.",
    unit: IA.ANALYTICS_METRIC_UNIT.COUNT,
    aggregationKind: IA.ANALYTICS_AGGREGATION_KIND.SUM,
    metricKind: IA.ANALYTICS_METRIC_KIND.OBSERVATIONAL,
    source: SOURCE,
    supportedTenantScopeKinds: [IA.ANALYTICS_TENANT_SCOPE_KIND.TENANT],
    supportedGranularities: [IA.ANALYTICS_GRANULARITY.WINDOW],
    allowedDimensions: [{ key: "segment" }],
    missingDataSemantics: IA.ANALYTICS_MISSING_DATA_SEMANTICS.PRESERVE_NULL,
  });
  assert.equal(def.ok, true);
  assert.equal(def.value.metricId, "ia.demo.observation_sum");
  assert.ok(Object.isFrozen(def.value));
});

test("average and rate aggregations are deterministic", () => {
  const average = IA.aggregateExplicit([2, 4, 6], {
    aggregationKind: IA.ANALYTICS_AGGREGATION_KIND.AVERAGE,
  });
  assert.equal(average.ok, true);
  assert.equal(average.value.value, 4);

  const rate = IA.aggregateExplicit([1, 1, 0, 1], {
    aggregationKind: IA.ANALYTICS_AGGREGATION_KIND.RATE,
    rateDenominator: 4,
  });
  assert.equal(rate.ok, true);
  assert.equal(rate.value.value, 0.75);
});
