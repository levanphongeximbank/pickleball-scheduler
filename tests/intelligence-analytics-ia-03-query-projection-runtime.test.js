/**
 * I&A-03 — Analytics Query and Projection Runtime certification tests.
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
const RUNTIME_ROOT = path.join(MODULE_ROOT, "runtime");

const SOURCE = Object.freeze({
  sourceId: "explicit-observations",
  sourceKind: "explicit_input",
  ownerModule: "intelligence-analytics",
  reference: "caller-supplied",
});

const PROVENANCE = Object.freeze({
  source: SOURCE,
  observedAt: "2026-07-01T12:00:00.000Z",
  ingestedAt: "2026-07-01T12:05:00.000Z",
  transformer: "in-memory-adapter",
});

const FIXED_NOW = "2026-07-24T00:00:00.000Z";

function baseDefinition(overrides = {}) {
  return {
    metricId: "ia.demo.observation_sum",
    version: "1.0.0",
    definition: "Sum of caller-supplied observation values for runtime certification.",
    unit: IA.ANALYTICS_METRIC_UNIT.COUNT,
    aggregationKind: IA.ANALYTICS_AGGREGATION_KIND.SUM,
    metricKind: IA.ANALYTICS_METRIC_KIND.OBSERVATIONAL,
    source: SOURCE,
    supportedTenantScopeKinds: [IA.ANALYTICS_TENANT_SCOPE_KIND.TENANT],
    supportedGranularities: [IA.ANALYTICS_GRANULARITY.WINDOW],
    allowedDimensions: [{ key: "segment" }, { key: "court" }],
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
  const request = {
    definition: baseDefinition(defOverrides),
  };
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
    metricId: "ia.demo.observation_sum",
    metricVersion: "1.0.0",
    tenantScope: tenantScope(),
    observedAt: "2026-07-10T10:00:00.000Z",
    dimensions: { segment: "A", court: "1" },
    value: 10,
    missing: false,
    provenance: PROVENANCE,
    freshness: IA.ANALYTICS_FRESHNESS_STATE.FRESH,
    ...overrides,
  };
}

function queryInput(overrides = {}) {
  return {
    metricId: "ia.demo.observation_sum",
    metricVersion: "1.0.0",
    tenantScope: tenantScope(),
    timeWindow: {
      startAt: "2026-07-01T00:00:00.000Z",
      endAt: "2026-07-31T23:59:59.000Z",
      inclusive: true,
    },
    aggregationKind: IA.ANALYTICS_AGGREGATION_KIND.SUM,
    granularity: IA.ANALYTICS_GRANULARITY.WINDOW,
    filters: [],
    ...overrides,
  };
}

function buildRegistry(entries) {
  const created = IA.createMetricRegistry({ entries });
  assert.equal(created.ok, true);
  return created.value.registry;
}

function buildRuntime(observations, registryEntries, adapterExtras = {}) {
  const registry = buildRegistry(registryEntries || [registrationRequest()]);
  const adapter = IA.createInMemoryAnalyticsSourceAdapter({
    observations,
    provenance: PROVENANCE,
    freshness: IA.ANALYTICS_FRESHNESS_STATE.FRESH,
    ...adapterExtras,
  });
  assert.equal(adapter.ok, true);
  const runtime = IA.createAnalyticsQueryRuntime({
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

test("public exports include I&A-03 runtime API", () => {
  for (const name of IA.INTELLIGENCE_ANALYTICS_PUBLIC_EXPORTS) {
    assert.ok(name in IA, `missing export: ${name}`);
  }
  assert.equal(IA.INTELLIGENCE_ANALYTICS_QUERY_RUNTIME.workstreamId, "I&A-03");
  assert.equal(typeof IA.createAnalyticsQueryRuntime, "function");
  assert.equal(typeof IA.createInMemoryAnalyticsSourceAdapter, "function");
  assert.equal(typeof IA.normalizeAnalyticsQuery, "function");
  assert.equal(typeof IA.executeAnalyticsProjection, "function");
});

test("1. runtime creates from explicit registry and source adapter", () => {
  const { runtime } = buildRuntime([observation()]);
  assert.equal(typeof runtime.execute, "function");
  assert.equal(typeof runtime.validate, "function");
});

test("2. query metric not found returns typed error", () => {
  const { runtime } = buildRuntime([observation()]);
  const result = runtime.execute(
    queryInput({ metricId: "ia.demo.missing", metricVersion: "1.0.0" }),
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

test("3. exact metric version is resolved", () => {
  const registry = buildRegistry([
    registrationRequest({ version: "1.0.0" }),
    registrationRequest({
      version: "2.0.0",
      aggregationKind: IA.ANALYTICS_AGGREGATION_KIND.SUM,
    }),
  ]);
  const adapter = IA.createInMemoryAnalyticsSourceAdapter({
    observations: [
      observation({ metricVersion: "2.0.0", value: 5 }),
      observation({ metricVersion: "1.0.0", value: 99 }),
    ],
    provenance: PROVENANCE,
  });
  assert.equal(adapter.ok, true);
  const runtime = IA.createAnalyticsQueryRuntime({
    registry,
    sourceAdapter: adapter.value,
    nowIso: () => FIXED_NOW,
  });
  assert.equal(runtime.ok, true);
  const result = runtime.value.execute(queryInput({ metricVersion: "2.0.0" }), {
    tenantId: "tenant-a",
  });
  assert.equal(result.ok, true);
  assert.equal(result.value.resolvedMetric.version, "2.0.0");
  assert.equal(result.value.result.dataPoints[0].value, 5);
});

test("4. missing tenant context fails closed", () => {
  const { runtime } = buildRuntime([observation()]);
  const result = runtime.execute(
    queryInput({
      tenantScope: { kind: IA.ANALYTICS_TENANT_SCOPE_KIND.TENANT },
    })
  );
  assert.equal(result.ok, false);
  assert.equal(result.error.code, IA.ANALYTICS_ERROR_CODE.TENANT_CONTEXT_REQUIRED);
});

test("5. tenant mismatch is rejected", () => {
  const { runtime } = buildRuntime([observation()]);
  const result = runtime.execute(queryInput(), { tenantId: "tenant-b" });
  assert.equal(result.ok, false);
  assert.equal(result.error.code, IA.ANALYTICS_ERROR_CODE.TENANT_SCOPE_MISMATCH);
});

test("6. query descriptor is not mutated", () => {
  const { runtime } = buildRuntime([observation()]);
  const input = queryInput({
    filters: [{ field: "segment", operator: "eq", value: "A" }],
  });
  const before = JSON.stringify(input);
  const result = runtime.execute(input, { tenantId: "tenant-a" });
  assert.equal(result.ok, true);
  assert.equal(JSON.stringify(input), before);
});

test("7. observation input is not mutated", () => {
  const obs = observation();
  const before = JSON.stringify(obs);
  const { runtime } = buildRuntime([obs]);
  const result = runtime.execute(queryInput(), { tenantId: "tenant-a" });
  assert.equal(result.ok, true);
  assert.equal(JSON.stringify(obs), before);
});

test("8. output does not expose mutable internal state", () => {
  const { runtime } = buildRuntime([observation()]);
  const result = runtime.execute(queryInput(), { tenantId: "tenant-a" });
  assert.equal(result.ok, true);
  assert.ok(Object.isFrozen(result.value));
  assert.ok(Object.isFrozen(result.value.result));
  assert.throws(() => {
    /** @type {any} */ (result.value).executionId = "hacked";
  });
});

test("9. time-window filtering respects boundaries", () => {
  const { runtime } = buildRuntime([
    observation({ observedAt: "2026-06-30T23:59:59.000Z", value: 1 }),
    observation({ observedAt: "2026-07-01T00:00:00.000Z", value: 2 }),
    observation({ observedAt: "2026-07-31T23:59:59.000Z", value: 3 }),
    observation({ observedAt: "2026-08-01T00:00:00.000Z", value: 4 }),
  ]);
  const result = runtime.execute(queryInput(), { tenantId: "tenant-a" });
  assert.equal(result.ok, true);
  assert.equal(result.value.result.dataPoints[0].value, 5);
});

test("10. dimension filtering is deterministic", () => {
  const { runtime } = buildRuntime([
    observation({ dimensions: { segment: "A", court: "1" }, value: 10 }),
    observation({ dimensions: { segment: "B", court: "1" }, value: 20 }),
  ]);
  const result = runtime.execute(
    queryInput({
      filters: [{ field: "segment", operator: "eq", value: "A" }],
    }),
    { tenantId: "tenant-a" }
  );
  assert.equal(result.ok, true);
  assert.equal(result.value.result.dataPoints[0].value, 10);
});

test("11. unsupported dimension is rejected", () => {
  const { runtime } = buildRuntime([observation()]);
  const result = runtime.execute(
    queryInput({
      filters: [{ field: "unknown_dim", operator: "eq", value: "x" }],
    }),
    { tenantId: "tenant-a" }
  );
  assert.equal(result.ok, false);
  assert.equal(result.error.code, IA.ANALYTICS_ERROR_CODE.UNSUPPORTED_DIMENSION);
});

test("12. grouping creates stable groups", () => {
  const { runtime } = buildRuntime([
    observation({ dimensions: { segment: "B", court: "1" }, value: 2 }),
    observation({ dimensions: { segment: "A", court: "1" }, value: 1 }),
    observation({ dimensions: { segment: "A", court: "1" }, value: 3 }),
  ]);
  const result = runtime.execute(
    queryInput({
      grouping: { dimensions: [{ key: "segment" }] },
      ordering: [{ field: "key", direction: "asc" }],
    }),
    { tenantId: "tenant-a" }
  );
  assert.equal(result.ok, true);
  assert.equal(result.value.result.dataPoints.length, 2);
  assert.equal(result.value.result.dataPoints[0].key, "segment=A");
  assert.equal(result.value.result.dataPoints[0].value, 4);
  assert.equal(result.value.result.dataPoints[1].key, "segment=B");
});

test("13. missing dimension uses explicit sentinel behavior", () => {
  const { runtime } = buildRuntime([
    observation({ dimensions: { court: "1" }, value: 7 }),
  ]);
  const result = runtime.execute(
    queryInput({
      grouping: { dimensions: [{ key: "segment" }] },
    }),
    { tenantId: "tenant-a" }
  );
  assert.equal(result.ok, true);
  assert.equal(result.value.result.dataPoints[0].key, "segment=__missing__");
  assert.equal(result.value.result.dataPoints[0].dimensions.segment, "__missing__");
});

test("14-17. count/sum/average/rate aggregations are correct", () => {
  const cases = [
    {
      kind: IA.ANALYTICS_AGGREGATION_KIND.COUNT,
      values: [1, 2, 3],
      expected: 3,
    },
    {
      kind: IA.ANALYTICS_AGGREGATION_KIND.SUM,
      values: [1, 2, 3],
      expected: 6,
    },
    {
      kind: IA.ANALYTICS_AGGREGATION_KIND.AVERAGE,
      values: [2, 4, 6],
      expected: 4,
    },
    {
      kind: IA.ANALYTICS_AGGREGATION_KIND.RATE,
      values: [1, 1, 0],
      expected: 2 / 3,
    },
  ];

  for (const c of cases) {
    const metricId = `ia.demo.agg_${c.kind}`;
    const { runtime } = buildRuntime(
      c.values.map((value, i) =>
        observation({
          metricId,
          value,
          observedAt: `2026-07-10T10:0${i}:00.000Z`,
        })
      ),
      [
        registrationRequest({
          metricId,
          aggregationKind: c.kind,
          unit:
            c.kind === IA.ANALYTICS_AGGREGATION_KIND.RATE
              ? IA.ANALYTICS_METRIC_UNIT.RATIO
              : IA.ANALYTICS_METRIC_UNIT.COUNT,
        }),
      ]
    );
    const result = runtime.execute(
      queryInput({
        metricId,
        aggregationKind: c.kind,
      }),
      { tenantId: "tenant-a" }
    );
    assert.equal(result.ok, true, `${c.kind}: ${result.ok ? "" : result.error.message}`);
    assert.equal(result.value.result.dataPoints[0].value, c.expected);
  }
});

test("18. missing value is not auto-coerced to zero", () => {
  const { runtime } = buildRuntime([
    observation({ value: null, missing: true }),
  ]);
  const result = runtime.execute(queryInput(), { tenantId: "tenant-a" });
  assert.equal(result.ok, true);
  assert.equal(result.value.result.dataPoints[0].value, null);
  assert.equal(result.value.result.dataPoints[0].missing, true);
});

test("19. invalid numeric observation is typed error", () => {
  const bad = observation();
  // Bypass contract by forcing invalid raw into adapter construction path.
  const created = IA.createAnalyticsObservation({
    ...bad,
    value: Number.NaN,
  });
  assert.equal(created.ok, false);
  assert.equal(created.error.code, IA.ANALYTICS_ERROR_CODE.INVALID_OBSERVATION);
});

test("20-21. ordering and tie-break are deterministic", () => {
  const { runtime } = buildRuntime([
    observation({
      dimensions: { segment: "A", court: "1" },
      value: 5,
      observedAt: "2026-07-10T10:00:00.000Z",
    }),
    observation({
      dimensions: { segment: "B", court: "1" },
      value: 5,
      observedAt: "2026-07-10T11:00:00.000Z",
    }),
  ]);
  const q = queryInput({
    grouping: { dimensions: [{ key: "segment" }] },
    ordering: [
      { field: "value", direction: "desc" },
      { field: "key", direction: "asc" },
    ],
  });
  const a = runtime.execute(q, { tenantId: "tenant-a" });
  const b = runtime.execute(q, { tenantId: "tenant-a" });
  assert.equal(a.ok, true);
  assert.deepEqual(
    a.value.result.dataPoints.map((p) => p.key),
    b.value.result.dataPoints.map((p) => p.key)
  );
  assert.deepEqual(
    a.value.result.dataPoints.map((p) => p.key),
    ["segment=A", "segment=B"]
  );
});

test("22. result limit is applied", () => {
  const { runtime } = buildRuntime([
    observation({ dimensions: { segment: "A", court: "1" }, value: 1 }),
    observation({ dimensions: { segment: "B", court: "1" }, value: 2 }),
    observation({ dimensions: { segment: "C", court: "1" }, value: 3 }),
  ]);
  const result = runtime.execute(
    {
      ...queryInput({
        grouping: { dimensions: [{ key: "segment" }] },
        ordering: [{ field: "key", direction: "asc" }],
      }),
      resultLimit: 2,
    },
    { tenantId: "tenant-a" }
  );
  assert.equal(result.ok, true);
  assert.equal(result.value.result.dataPoints.length, 2);
  assert.equal(result.value.projection.truncated, true);
  assert.ok(
    result.value.result.warnings.some((w) => w.code === "ANALYTICS_RESULT_TRUNCATED")
  );
});

test("23. retired metric is rejected", () => {
  const { runtime } = buildRuntime(
    [observation()],
    [registrationRequest({ lifecycleState: IA.ANALYTICS_METRIC_LIFECYCLE_STATE.RETIRED })]
  );
  const result = runtime.execute(queryInput(), { tenantId: "tenant-a" });
  assert.equal(result.ok, false);
  assert.equal(result.error.code, IA.ANALYTICS_ERROR_CODE.METRIC_RETIRED);
});

test("24. deprecated metric returns warning and replacement metadata", () => {
  const { runtime } = buildRuntime(
    [observation()],
    [
      registrationRequest({
        lifecycleState: IA.ANALYTICS_METRIC_LIFECYCLE_STATE.DEPRECATED,
        deprecation: {
          reason: "superseded",
          replacement: {
            metricId: "ia.demo.observation_sum",
            version: "2.0.0",
          },
        },
      }),
    ]
  );
  const result = runtime.execute(queryInput(), { tenantId: "tenant-a" });
  assert.equal(result.ok, true);
  assert.ok(
    result.value.result.warnings.some((w) => w.code === "ANALYTICS_METRIC_DEPRECATED")
  );
  assert.ok(
    result.value.result.warnings.some((w) => w.code === "ANALYTICS_METRIC_REPLACEMENT")
  );
  assert.equal(
    result.value.resolvedMetric.deprecation.replacement.version,
    "2.0.0"
  );
});

test("25-26. provenance and freshness are preserved", () => {
  const { runtime } = buildRuntime([observation()], undefined, {
    freshness: IA.ANALYTICS_FRESHNESS_STATE.FRESH,
    sourceTimestamp: "2026-07-10T12:00:00.000Z",
  });
  const result = runtime.execute(queryInput(), { tenantId: "tenant-a" });
  assert.equal(result.ok, true);
  assert.equal(result.value.result.provenance.source.sourceId, SOURCE.sourceId);
  assert.equal(result.value.result.freshness, IA.ANALYTICS_FRESHNESS_STATE.FRESH);
  assert.equal(result.value.projection.sourceTimestamp, "2026-07-10T12:00:00.000Z");
});

test("27. stale source creates warning", () => {
  const { runtime } = buildRuntime([observation()], undefined, {
    freshness: IA.ANALYTICS_FRESHNESS_STATE.STALE,
  });
  const result = runtime.execute(queryInput(), { tenantId: "tenant-a" });
  assert.equal(result.ok, true);
  assert.equal(result.value.result.freshness, IA.ANALYTICS_FRESHNESS_STATE.STALE);
  assert.ok(
    result.value.result.warnings.some((w) => w.code === "ANALYTICS_SOURCE_STALE")
  );
});

test("28. source failure is wrapped as typed runtime error", () => {
  const { runtime } = buildRuntime([observation()], undefined, {
    failMode: "failure",
  });
  const result = runtime.execute(queryInput(), { tenantId: "tenant-a" });
  assert.equal(result.ok, false);
  assert.equal(result.error.code, IA.ANALYTICS_ERROR_CODE.SOURCE_FAILURE);
});

test("29. same input/query produces same output", () => {
  const { runtime } = buildRuntime([
    observation({ value: 3 }),
    observation({
      value: 4,
      observedAt: "2026-07-11T10:00:00.000Z",
      dimensions: { segment: "A", court: "2" },
    }),
  ]);
  const q = queryInput();
  const a = runtime.execute(q, { tenantId: "tenant-a" });
  const b = runtime.execute(q, { tenantId: "tenant-a" });
  assert.equal(a.ok, true);
  assert.deepEqual(
    JSON.parse(JSON.stringify(a.value.result.dataPoints)),
    JSON.parse(JSON.stringify(b.value.result.dataPoints))
  );
});

test("30. read-only facade does not expose write operations", () => {
  const { runtime } = buildRuntime([observation()]);
  assert.equal(runtime.write().ok, false);
  assert.equal(runtime.write().error.code, IA.ANALYTICS_ERROR_CODE.FACADE_WRITE_REJECTED);
  assert.equal(runtime.command().ok, false);
  assert.equal(runtime.mutate().ok, false);
});

test("31-34. runtime does not import forbidden modules", () => {
  const files = listJsFiles(RUNTIME_ROOT);
  assert.ok(files.length > 0);
  const forbidden = [
    /from\s+['"]react['"]/,
    /from\s+['"]@supabase\//,
    /createClient\s*\(/,
    /src\/core\/platform/,
    /features\/competition/,
    /features\/finance/,
    /features\/crm/,
    /features\/player/,
    /\blocalStorage\b/,
  ];
  for (const file of files) {
    const text = readFileSync(file, "utf8");
    for (const pattern of forbidden) {
      assert.equal(
        pattern.test(text),
        false,
        `${path.relative(MODULE_ROOT, file)} matched ${pattern}`
      );
    }
  }
});

test("35. empty observation input yields deterministic result", () => {
  const { runtime } = buildRuntime([]);
  const result = runtime.execute(queryInput(), { tenantId: "tenant-a" });
  assert.equal(result.ok, true);
  assert.equal(result.value.result.dataPoints.length, 1);
  assert.equal(result.value.result.dataPoints[0].value, null);
});

test("36. invalid query does not call source adapter", () => {
  let called = 0;
  const registry = buildRegistry([registrationRequest()]);
  const runtime = IA.createAnalyticsQueryRuntime({
    registry,
    sourceAdapter: {
      query() {
        called += 1;
        return { ok: true, value: { observations: [], provenance: PROVENANCE, freshness: "fresh" } };
      },
    },
    nowIso: () => FIXED_NOW,
  });
  assert.equal(runtime.ok, true);
  const result = runtime.value.execute(
    queryInput({ aggregationKind: "not-a-kind" }),
    { tenantId: "tenant-a" }
  );
  assert.equal(result.ok, false);
  assert.equal(called, 0);
});

test("37. exact source request contains only required fields", () => {
  const { runtime } = buildRuntime([observation()]);
  const result = runtime.execute(
    queryInput({
      filters: [{ field: "segment", operator: "eq", value: "A" }],
    }),
    { tenantId: "tenant-a" }
  );
  assert.equal(result.ok, true);
  const keys = Object.keys(result.value.sourceRequest).sort();
  assert.deepEqual(keys, [
    "dimensions",
    "executionId",
    "metricId",
    "metricVersion",
    "tenantScope",
    "timeWindow",
  ]);
});

test("38. multiple metric versions are not mixed", () => {
  const registry = buildRegistry([
    registrationRequest({ version: "1.0.0" }),
    registrationRequest({ version: "2.0.0" }),
  ]);
  const adapter = IA.createInMemoryAnalyticsSourceAdapter({
    observations: [
      observation({ metricVersion: "1.0.0", value: 10 }),
      observation({ metricVersion: "2.0.0", value: 100 }),
    ],
    provenance: PROVENANCE,
  });
  assert.equal(adapter.ok, true);
  const runtime = IA.createAnalyticsQueryRuntime({
    registry,
    sourceAdapter: adapter.value,
    nowIso: () => FIXED_NOW,
  });
  const result = runtime.value.execute(queryInput({ metricVersion: "1.0.0" }), {
    tenantId: "tenant-a",
  });
  assert.equal(result.ok, true);
  assert.equal(result.value.result.dataPoints[0].value, 10);
});

test("39. registry input remains immutable", () => {
  const def = baseDefinition();
  const before = JSON.stringify(def);
  const created = IA.createMetricRegistry({
    entries: [{ definition: def }],
  });
  assert.equal(created.ok, true);
  const { runtime } = buildRuntime([observation()], [{ definition: def }]);
  runtime.execute(queryInput(), { tenantId: "tenant-a" });
  assert.equal(JSON.stringify(def), before);
});

test("40. runtime does not use a global singleton", () => {
  const a = buildRuntime([observation({ value: 1 })]);
  const b = buildRuntime([observation({ value: 2 })]);
  assert.notEqual(a.runtime, b.runtime);
  const ra = a.runtime.execute(queryInput(), { tenantId: "tenant-a" });
  const rb = b.runtime.execute(queryInput(), { tenantId: "tenant-a" });
  assert.equal(ra.value.result.dataPoints[0].value, 1);
  assert.equal(rb.value.result.dataPoints[0].value, 2);
});

test("source unavailable is typed", () => {
  const { runtime } = buildRuntime([observation()], undefined, {
    failMode: "unavailable",
  });
  const result = runtime.execute(queryInput(), { tenantId: "tenant-a" });
  assert.equal(result.ok, false);
  assert.equal(result.error.code, IA.ANALYTICS_ERROR_CODE.SOURCE_UNAVAILABLE);
});

test("validate path never fetches source", () => {
  let called = 0;
  const registry = buildRegistry([registrationRequest()]);
  const runtime = IA.createAnalyticsQueryRuntime({
    registry,
    sourceAdapter: {
      query() {
        called += 1;
        throw new Error("should not be called");
      },
    },
    nowIso: () => FIXED_NOW,
  });
  const result = runtime.value.validate(queryInput(), { tenantId: "tenant-a" });
  assert.equal(result.ok, true);
  assert.equal(called, 0);
});

test("in-memory source adapter rejects write commands", () => {
  const adapter = IA.createInMemoryAnalyticsSourceAdapter({
    observations: [observation()],
    provenance: PROVENANCE,
  });
  assert.equal(adapter.ok, true);
  assert.equal(adapter.value.write().ok, false);
  assert.equal(
    adapter.value.write().error.code,
    IA.ANALYTICS_ERROR_CODE.FACADE_WRITE_REJECTED
  );
});

test("resultLimit above hard bound fails with RESULT_LIMIT_EXCEEDED", () => {
  const normalized = IA.normalizeAnalyticsQuery({
    ...queryInput(),
    resultLimit: 100_001,
  });
  assert.equal(normalized.ok, false);
  assert.equal(
    normalized.error.code,
    IA.ANALYTICS_ERROR_CODE.RESULT_LIMIT_EXCEEDED
  );
});
