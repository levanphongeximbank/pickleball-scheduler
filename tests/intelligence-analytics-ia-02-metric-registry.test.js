/**
 * I&A-02 — Metric Registry and Definition Governance certification tests.
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
const REGISTRY_ROOT = path.join(MODULE_ROOT, "registry");

const SOURCE = Object.freeze({
  sourceId: "explicit-observations",
  sourceKind: "explicit_input",
  ownerModule: "intelligence-analytics",
  reference: "caller-supplied",
});

function baseDefinition(overrides = {}) {
  return {
    metricId: "ia.demo.observation_sum",
    version: "1.0.0",
    definition:
      "Sum of caller-supplied observation values for registry certification.",
    unit: IA.ANALYTICS_METRIC_UNIT.COUNT,
    aggregationKind: IA.ANALYTICS_AGGREGATION_KIND.SUM,
    metricKind: IA.ANALYTICS_METRIC_KIND.OBSERVATIONAL,
    source: SOURCE,
    supportedTenantScopeKinds: [IA.ANALYTICS_TENANT_SCOPE_KIND.TENANT],
    supportedGranularities: [IA.ANALYTICS_GRANULARITY.WINDOW],
    allowedDimensions: [{ key: "segment" }],
    missingDataSemantics: IA.ANALYTICS_MISSING_DATA_SEMANTICS.PRESERVE_NULL,
    ...overrides,
  };
}

function registrationRequest(overrides = {}) {
  const { lifecycleState, displayName, deprecation, registeredAt, ...defOverrides } =
    overrides;
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

test("public exports include I&A-02 registry API", () => {
  for (const name of IA.INTELLIGENCE_ANALYTICS_PUBLIC_EXPORTS) {
    assert.ok(name in IA, `missing export: ${name}`);
  }
  assert.equal(IA.INTELLIGENCE_ANALYTICS_FOUNDATION.workstreamId, "I&A-01");
  assert.equal(
    IA.INTELLIGENCE_ANALYTICS_METRIC_REGISTRY.workstreamId,
    "I&A-02"
  );
  assert.equal(typeof IA.createMetricRegistry, "function");
  assert.equal(typeof IA.createReadOnlyMetricRegistry, "function");
  assert.equal(typeof IA.validateMetricDefinition, "function");
  assert.equal(typeof IA.compareMetricDefinitions, "function");
});

test("1. valid metric definition registers successfully", () => {
  const created = IA.createMetricRegistry({
    entries: [registrationRequest()],
  });
  assert.equal(created.ok, true);
  assert.equal(created.value.size, 1);
  assert.equal(created.value.registrations[0].ok, true);
  assert.equal(
    created.value.registrations[0].value.status,
    IA.ANALYTICS_METRIC_REGISTRATION_STATUS.REGISTERED
  );

  const lookup = created.value.registry.getMetric(
    "ia.demo.observation_sum",
    "1.0.0"
  );
  assert.equal(lookup.ok, true);
  assert.equal(lookup.value.definition.source.sourceId, SOURCE.sourceId);
  assert.equal(
    lookup.value.lifecycleState,
    IA.ANALYTICS_METRIC_LIFECYCLE_STATE.ACTIVE
  );
});

test("2. invalid definition is rejected with typed error", () => {
  const invalid = IA.validateMetricDefinition({
    metricId: "ia.demo.bad",
    version: "1.0.0",
    // missing definition / unit / aggregation / source
  });
  assert.equal(invalid.ok, false);
  assert.ok(
    [
      IA.ANALYTICS_ERROR_CODE.DEFINITION_INVALID,
      IA.ANALYTICS_ERROR_CODE.SOURCE_REQUIRED,
    ].includes(invalid.error.code)
  );

  const created = IA.createMetricRegistry({
    entries: [
      {
        definition: {
          metricId: "ia.demo.bad",
          version: "1.0.0",
          definition: "incomplete",
          unit: "not-a-unit",
          aggregationKind: IA.ANALYTICS_AGGREGATION_KIND.SUM,
          metricKind: IA.ANALYTICS_METRIC_KIND.OBSERVATIONAL,
          source: SOURCE,
        },
      },
    ],
  });
  assert.equal(created.ok, true);
  assert.equal(created.value.size, 0);
  assert.equal(created.value.registrations[0].ok, false);
  assert.equal(
    created.value.registrations[0].error.code,
    IA.ANALYTICS_ERROR_CODE.DEFINITION_INVALID
  );
});

test("3. same ID/version and same definition is idempotent", () => {
  const req = registrationRequest();
  const created = IA.createMetricRegistry({
    entries: [req, structuredClone(req)],
  });
  assert.equal(created.ok, true);
  assert.equal(created.value.size, 1);
  assert.equal(created.value.registrations[0].ok, true);
  assert.equal(
    created.value.registrations[0].value.status,
    IA.ANALYTICS_METRIC_REGISTRATION_STATUS.REGISTERED
  );
  assert.equal(created.value.registrations[1].ok, true);
  assert.equal(
    created.value.registrations[1].value.status,
    IA.ANALYTICS_METRIC_REGISTRATION_STATUS.IDEMPOTENT
  );
});

test("4. same ID/version but different definition conflicts", () => {
  const created = IA.createMetricRegistry({
    entries: [
      registrationRequest(),
      registrationRequest({
        unit: IA.ANALYTICS_METRIC_UNIT.RATIO,
      }),
    ],
  });
  assert.equal(created.ok, true);
  assert.equal(created.value.size, 1);
  assert.equal(created.value.registrations[1].ok, false);
  assert.equal(
    created.value.registrations[1].error.code,
    IA.ANALYTICS_ERROR_CODE.REGISTRY_CONFLICT
  );
});

test("5. two versions of the same metric coexist", () => {
  const created = IA.createMetricRegistry({
    entries: [
      registrationRequest({ version: "1.0.0" }),
      registrationRequest({
        version: "2.0.0",
        allowedDimensions: [{ key: "segment" }, { key: "court" }],
      }),
    ],
  });
  assert.equal(created.ok, true);
  assert.equal(created.value.size, 2);
  assert.equal(
    created.value.registry.hasMetric("ia.demo.observation_sum", "1.0.0"),
    true
  );
  assert.equal(
    created.value.registry.hasMetric("ia.demo.observation_sum", "2.0.0"),
    true
  );
});

test("6. exact lookup requires correct ID and version", () => {
  const created = IA.createMetricRegistry({
    entries: [registrationRequest({ version: "1.0.0" })],
  });
  const registry = created.value.registry;

  const missingVersion = registry.getMetric("ia.demo.observation_sum", "9.9.9");
  assert.equal(missingVersion.ok, false);
  assert.equal(
    missingVersion.error.code,
    IA.ANALYTICS_ERROR_CODE.REGISTRY_NOT_FOUND
  );

  const missingId = registry.getMetric("ia.demo.unknown", "1.0.0");
  assert.equal(missingId.ok, false);

  const missingArgs = registry.getMetric("ia.demo.observation_sum");
  assert.equal(missingArgs.ok, false);
  assert.equal(
    missingArgs.error.code,
    IA.ANALYTICS_ERROR_CODE.METRIC_VERSION_REQUIRED
  );
});

test("7. registry is not mutated by external input objects", () => {
  const mutable = registrationRequest();
  const created = IA.createMetricRegistry({ entries: [mutable] });
  assert.equal(created.ok, true);

  mutable.definition.metricId = "mutated-after-create";
  mutable.definition.unit = IA.ANALYTICS_METRIC_UNIT.CURRENCY;

  const lookup = created.value.registry.getMetric(
    "ia.demo.observation_sum",
    "1.0.0"
  );
  assert.equal(lookup.ok, true);
  assert.equal(lookup.value.metricId, "ia.demo.observation_sum");
  assert.equal(lookup.value.definition.unit, IA.ANALYTICS_METRIC_UNIT.COUNT);
});

test("8. registry output is not mutated by consumer", () => {
  const created = IA.createMetricRegistry({
    entries: [registrationRequest()],
  });
  const listed = created.value.registry.listMetrics();
  assert.equal(listed.ok, true);

  assert.throws(() => {
    listed.value.push(/** @type {*} */ ({}));
  }, TypeError);

  const entry = listed.value[0];
  assert.throws(() => {
    entry.metricId = "mutated";
  }, TypeError);

  const again = created.value.registry.getMetric(
    "ia.demo.observation_sum",
    "1.0.0"
  );
  assert.equal(again.value.metricId, "ia.demo.observation_sum");
});

test("9. lifecycle filter is deterministic", () => {
  const created = IA.createMetricRegistry({
    entries: [
      registrationRequest({
        metricId: "ia.demo.a",
        lifecycleState: IA.ANALYTICS_METRIC_LIFECYCLE_STATE.ACTIVE,
      }),
      registrationRequest({
        metricId: "ia.demo.b",
        lifecycleState: IA.ANALYTICS_METRIC_LIFECYCLE_STATE.DRAFT,
      }),
      registrationRequest({
        metricId: "ia.demo.c",
        lifecycleState: IA.ANALYTICS_METRIC_LIFECYCLE_STATE.DEPRECATED,
        deprecation: {
          reason: "superseded",
          deprecatedAt: "2026-07-01T00:00:00.000Z",
          replacement: { metricId: "ia.demo.a", version: "1.0.0" },
        },
      }),
      registrationRequest({
        metricId: "ia.demo.d",
        lifecycleState: IA.ANALYTICS_METRIC_LIFECYCLE_STATE.RETIRED,
        deprecation: { reason: "retired permanently" },
      }),
    ],
  });

  const active = created.value.registry.listByLifecycle(
    IA.ANALYTICS_METRIC_LIFECYCLE_STATE.ACTIVE
  );
  assert.equal(active.ok, true);
  assert.deepEqual(
    active.value.map((e) => e.metricId),
    ["ia.demo.a"]
  );

  const draft = created.value.registry.listByLifecycle(
    IA.ANALYTICS_METRIC_LIFECYCLE_STATE.DRAFT
  );
  assert.deepEqual(
    draft.value.map((e) => e.metricId),
    ["ia.demo.b"]
  );
});

test("10. DEPRECATED keeps replacement metadata", () => {
  const created = IA.createMetricRegistry({
    entries: [
      registrationRequest({
        lifecycleState: IA.ANALYTICS_METRIC_LIFECYCLE_STATE.DEPRECATED,
        deprecation: {
          reason: "replaced by v2",
          deprecatedAt: "2026-07-10T00:00:00.000Z",
          replacement: {
            metricId: "ia.demo.observation_sum",
            version: "2.0.0",
          },
        },
      }),
    ],
  });
  assert.equal(created.ok, true);
  const entry = created.value.registry.getMetric(
    "ia.demo.observation_sum",
    "1.0.0"
  );
  assert.equal(entry.ok, true);
  assert.equal(
    entry.value.lifecycleState,
    IA.ANALYTICS_METRIC_LIFECYCLE_STATE.DEPRECATED
  );
  assert.equal(entry.value.deprecation.reason, "replaced by v2");
  assert.equal(entry.value.deprecation.replacement.version, "2.0.0");
});

test("11. replacement self-reference is rejected", () => {
  const created = IA.createMetricRegistry({
    entries: [
      registrationRequest({
        lifecycleState: IA.ANALYTICS_METRIC_LIFECYCLE_STATE.DEPRECATED,
        deprecation: {
          reason: "self",
          replacement: {
            metricId: "ia.demo.observation_sum",
            version: "1.0.0",
          },
        },
      }),
    ],
  });
  assert.equal(created.value.size, 0);
  assert.equal(created.value.registrations[0].ok, false);
  assert.equal(
    created.value.registrations[0].error.code,
    IA.ANALYTICS_ERROR_CODE.REGISTRY_REPLACEMENT_SELF_REFERENCE
  );
});

test("12. ACTIVE and RETIRED are not mixed by lifecycle filter", () => {
  const created = IA.createMetricRegistry({
    entries: [
      registrationRequest({
        metricId: "ia.demo.active",
        lifecycleState: IA.ANALYTICS_METRIC_LIFECYCLE_STATE.ACTIVE,
      }),
      registrationRequest({
        metricId: "ia.demo.retired",
        lifecycleState: IA.ANALYTICS_METRIC_LIFECYCLE_STATE.RETIRED,
        deprecation: { reason: "end of life" },
      }),
    ],
  });

  const active = created.value.registry.listByLifecycle(
    IA.ANALYTICS_METRIC_LIFECYCLE_STATE.ACTIVE
  );
  assert.equal(active.value.length, 1);
  assert.equal(active.value[0].metricId, "ia.demo.active");
  assert.equal(
    active.value.some(
      (e) => e.lifecycleState === IA.ANALYTICS_METRIC_LIFECYCLE_STATE.RETIRED
    ),
    false
  );

  const retired = created.value.registry.listByLifecycle(
    IA.ANALYTICS_METRIC_LIFECYCLE_STATE.RETIRED
  );
  assert.equal(retired.value.length, 1);
  assert.equal(retired.value[0].metricId, "ia.demo.retired");
});

test("13. tenant applicability filter works", () => {
  const created = IA.createMetricRegistry({
    entries: [
      registrationRequest({
        metricId: "ia.demo.tenant",
        supportedTenantScopeKinds: [IA.ANALYTICS_TENANT_SCOPE_KIND.TENANT],
      }),
      registrationRequest({
        metricId: "ia.demo.club",
        supportedTenantScopeKinds: [IA.ANALYTICS_TENANT_SCOPE_KIND.CLUB],
      }),
    ],
  });

  const tenantOnly = created.value.registry.listByTenantScopeKind(
    IA.ANALYTICS_TENANT_SCOPE_KIND.TENANT
  );
  assert.equal(tenantOnly.ok, true);
  assert.deepEqual(
    tenantOnly.value.map((e) => e.metricId),
    ["ia.demo.tenant"]
  );
});

test("14. provenance/source is preserved on registry entries", () => {
  const created = IA.createMetricRegistry({
    entries: [registrationRequest()],
  });
  const entry = created.value.registry.getMetric(
    "ia.demo.observation_sum",
    "1.0.0"
  );
  assert.equal(entry.value.definition.source.sourceId, SOURCE.sourceId);
  assert.equal(entry.value.definition.source.sourceKind, SOURCE.sourceKind);
  assert.equal(entry.value.definition.source.ownerModule, SOURCE.ownerModule);
  assert.equal(entry.value.definition.source.reference, SOURCE.reference);

  const byOwner = created.value.registry.listByOwnerModule(
    "intelligence-analytics"
  );
  assert.equal(byOwner.ok, true);
  assert.equal(byOwner.value.length, 1);
});

test("15. compatibility IDENTICAL", () => {
  const a = baseDefinition();
  const b = baseDefinition();
  const result = IA.compareMetricDefinitions(a, b);
  assert.equal(result.ok, true);
  assert.equal(
    result.value.classification,
    IA.ANALYTICS_METRIC_COMPATIBILITY.IDENTICAL
  );
});

test("16. unit or aggregation change is BREAKING", () => {
  const unitChange = IA.compareMetricDefinitions(
    baseDefinition(),
    baseDefinition({ unit: IA.ANALYTICS_METRIC_UNIT.RATIO })
  );
  assert.equal(
    unitChange.value.classification,
    IA.ANALYTICS_METRIC_COMPATIBILITY.BREAKING
  );
  assert.ok(unitChange.value.reasons.includes("unit_changed"));

  const aggChange = IA.compareMetricDefinitions(
    baseDefinition(),
    baseDefinition({ aggregationKind: IA.ANALYTICS_AGGREGATION_KIND.AVERAGE })
  );
  assert.equal(
    aggChange.value.classification,
    IA.ANALYTICS_METRIC_COMPATIBILITY.BREAKING
  );
  assert.ok(aggChange.value.reasons.includes("aggregation_kind_changed"));
});

test("17. dimension addition/removal classification is deterministic", () => {
  const added = IA.compareMetricDefinitions(
    baseDefinition({ allowedDimensions: [{ key: "segment" }] }),
    baseDefinition({
      allowedDimensions: [{ key: "segment" }, { key: "court" }],
    })
  );
  assert.equal(
    added.value.classification,
    IA.ANALYTICS_METRIC_COMPATIBILITY.BACKWARD_COMPATIBLE
  );
  assert.ok(added.value.reasons.includes("dimension_added"));

  const removed = IA.compareMetricDefinitions(
    baseDefinition({
      allowedDimensions: [{ key: "segment" }, { key: "court" }],
    }),
    baseDefinition({ allowedDimensions: [{ key: "segment" }] })
  );
  assert.equal(
    removed.value.classification,
    IA.ANALYTICS_METRIC_COMPATIBILITY.BREAKING
  );
  assert.ok(removed.value.reasons.includes("dimension_removed"));
});

test("18. read-only facade does not expose register/write commands", () => {
  const created = IA.createMetricRegistry({
    entries: [registrationRequest()],
  });
  const registry = created.value.registry;

  for (const writeName of [
    "register",
    "write",
    "command",
    "mutate",
    "insert",
    "update",
    "delete",
    "save",
  ]) {
    const rejected = /** @type {Function} */ (registry[writeName])();
    assert.equal(rejected.ok, false);
    assert.equal(
      rejected.error.code,
      IA.ANALYTICS_ERROR_CODE.FACADE_WRITE_REJECTED
    );
  }

  const readOnly = IA.createReadOnlyMetricRegistry({
    entries: [registrationRequest({ metricId: "ia.demo.readonly" })],
  });
  assert.equal(readOnly.ok, true);
  assert.equal(typeof readOnly.value.register, "function");
  assert.equal(readOnly.value.register().ok, false);
});

test("19. empty registry behavior is clear", () => {
  const created = IA.createMetricRegistry({});
  assert.equal(created.ok, true);
  assert.equal(created.value.size, 0);
  assert.equal(created.value.registry.isEmpty, true);
  assert.equal(created.value.registry.size, 0);

  const listed = created.value.registry.listMetrics();
  assert.equal(listed.ok, true);
  assert.deepEqual(listed.value, []);

  const missing = created.value.registry.getMetric("any", "1.0.0");
  assert.equal(missing.ok, false);
  assert.equal(missing.error.code, IA.ANALYTICS_ERROR_CODE.REGISTRY_NOT_FOUND);
});

test("20. registry module does not import Supabase, React, Platform Core, or business logic", () => {
  const forbidden = [
    /from\s+["'].*core\/platform/,
    /from\s+["']@supabase/,
    /from\s+["']react["']/,
    /from\s+["']react-dom["']/,
    /createClient\s*\(/,
    /from\s+["'].*features\/finance/,
    /from\s+["'].*features\/crm/,
    /from\s+["'].*features\/customer/,
    /from\s+["'].*features\/player-rating/,
    /from\s+["'].*features\/vpr-ranking/,
    /from\s+["'].*features\/competition/,
  ];

  const files = listJsFiles(REGISTRY_ROOT);
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

  const sqlish = IA.validateMetricDefinition(
    baseDefinition({
      source: {
        sourceId: "bookings",
        sourceKind: "sql",
        ownerModule: "intelligence-analytics",
      },
    })
  );
  assert.equal(sqlish.ok, false);
  assert.equal(
    sqlish.error.code,
    IA.ANALYTICS_ERROR_CODE.REGISTRY_FORBIDDEN_CONTRACT
  );
});
