/**
 * I&A-10 — Operational Alerts and Insights certification tests.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import * as IA from "../src/features/intelligence-analytics/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const MODULE_ROOT = join(__dirname, "../src/features/intelligence-analytics");
const OAI_ROOT = join(MODULE_ROOT, "operational-alerts-insights");

const SOURCE = Object.freeze({
  sourceId: "operational-alerts-insights-explicit",
  sourceKind: "explicit_input",
  ownerModule: "intelligence-analytics",
  reference: "ia-10-certification",
});

const PROVENANCE = Object.freeze({
  source: SOURCE,
  observedAt: "2026-07-20T12:00:00.000Z",
  ingestedAt: "2026-07-20T12:05:00.000Z",
  transformer: "in-memory-operational-alerts-insights",
});

const FIXED_NOW = "2026-07-25T00:00:00.000Z";
const TENANT = "tenant-a";

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

function buildSignal(overrides = {}) {
  return {
    tenantId: TENANT,
    signalId: "court.availability_rate",
    signalVersion: "1.0.0",
    metricId: IA.VENUE_COURT_CLUB_ANALYTICS_METRIC_IDS.COURT_AVAILABILITY_RATE,
    metricVersion: "1.0.0",
    domain: IA.OPERATIONAL_SIGNAL_DOMAIN.VENUE_COURT,
    valueKind: IA.OPERATIONAL_SIGNAL_VALUE_KIND.PERCENTAGE,
    value: 0.2,
    unit: "ratio",
    entityScope: { venueId: "venue-1" },
    freshness: IA.ANALYTICS_FRESHNESS_STATE.FRESH,
    completeness: IA.OPERATIONAL_ALERTS_INSIGHTS_COMPLETENESS.COMPLETE,
    provenance: PROVENANCE,
    sourceTimestamp: "2026-07-20T12:00:00.000Z",
    observedAt: "2026-07-20T12:00:00.000Z",
    ...overrides,
  };
}

function buildSnapshot(signals = [buildSignal()], overrides = {}) {
  return {
    context: context(),
    provenance: PROVENANCE,
    freshness: IA.ANALYTICS_FRESHNESS_STATE.FRESH,
    completeness: IA.OPERATIONAL_ALERTS_INSIGHTS_COMPLETENESS.COMPLETE,
    sourceTimestamp: "2026-07-20T12:00:00.000Z",
    signals,
    ...overrides,
  };
}

function buildSource(snapshot = buildSnapshot(), failMode) {
  const input = { snapshot };
  if (failMode) input.failMode = failMode;
  const source = IA.createInMemoryOperationalSignalsSource(input);
  assert.equal(source.ok, true, source.error?.message);
  return source.value;
}

function buildFacade(opts = {}) {
  const sourceAdapter = buildSource(opts.snapshot ?? buildSnapshot(), opts.failMode);
  const facadeResult = IA.createOperationalAlertsInsightsFacade({
    sourceAdapter,
    nowIso: opts.nowIso ?? (() => FIXED_NOW),
  });
  assert.equal(facadeResult.ok, true, facadeResult.error?.message);
  return { facade: facadeResult.value, sourceAdapter };
}

/**
 * Direct evaluation helper bypassing the facade/source layer — builds a
 * validated context + snapshot and calls evaluateOperationalAlertsInsights.
 */
function evaluate(input = {}) {
  const snapshotInput =
    input.snapshot ?? buildSnapshot(input.signals ?? [buildSignal()], input.snapshotOverrides ?? {});
  const snapshotResult = IA.createOperationalSignalsSnapshot(snapshotInput);
  assert.equal(snapshotResult.ok, true, snapshotResult.error?.message);
  const contextResult = IA.createAlertEvaluationContext(input.context ?? context());
  assert.equal(contextResult.ok, true, contextResult.error?.message);
  return IA.evaluateOperationalAlertsInsights({
    context: contextResult.value,
    snapshot: snapshotResult.value,
    evaluatedAt: input.evaluatedAt ?? FIXED_NOW,
    ruleIds: input.ruleIds,
    catalog: input.catalog,
    priorAlerts: input.priorAlerts,
    acknowledgements: input.acknowledgements,
    includeNotificationCandidates: input.includeNotificationCandidates,
    timeWindow: input.timeWindow,
  });
}

function guard(contextInput, snapshotInput) {
  const contextResult = IA.createAlertEvaluationContext(contextInput);
  assert.equal(contextResult.ok, true, contextResult.error?.message);
  const snapshotResult = IA.createOperationalSignalsSnapshot(snapshotInput);
  assert.equal(snapshotResult.ok, true, snapshotResult.error?.message);
  return IA.guardOperationalSignalsSnapshot(contextResult.value, snapshotResult.value);
}

function listJsFiles(dir) {
  /** @type {string[]} */
  const files = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) files.push(...listJsFiles(full));
    else if (entry.endsWith(".js")) files.push(full);
  }
  return files;
}

// ---------------------------------------------------------------------------
// 1. Public surface
// ---------------------------------------------------------------------------

test("1. public exports include I&A-10 operational alerts/insights API; marker present", () => {
  for (const name of IA.INTELLIGENCE_ANALYTICS_PUBLIC_EXPORTS) {
    assert.ok(name in IA, `missing export: ${name}`);
  }
  assert.equal(IA.INTELLIGENCE_ANALYTICS_OPERATIONAL_ALERTS_INSIGHTS.workstreamId, "I&A-10");
  assert.equal(typeof IA.createOperationalAlertsInsightsFacade, "function");
  assert.equal(typeof IA.evaluateOperationalAlertsInsights, "function");
  assert.equal(typeof IA.createOperationalSignal, "function");
  assert.equal(typeof IA.createOperationalAlertRule, "function");
  assert.equal(typeof IA.getFoundationOperationalAlertRuleCatalog, "function");
});

test("validate does not call source", () => {
  let loadCalls = 0;
  const sourceAdapter = {
    load() {
      loadCalls += 1;
      return { ok: true, value: { snapshot: {} } };
    },
  };
  const facade = IA.createOperationalAlertsInsightsFacade({ sourceAdapter });
  assert.equal(facade.ok, true);
  const validated = facade.value.validate({ context: context() });
  assert.equal(validated.ok, true);
  assert.equal(loadCalls, 0);
});

// ---------------------------------------------------------------------------
// 2-6. Context / tenant / entity isolation
// ---------------------------------------------------------------------------

test("2. valid evaluation context is created", () => {
  const result = IA.createAlertEvaluationContext(context({ venueId: "venue-1" }));
  assert.equal(result.ok, true);
  assert.equal(result.value.tenantScope.tenantId, TENANT);
  assert.equal(result.value.venueId, "venue-1");
  assert.ok(Object.isFrozen(result.value));
});

test("3. missing tenant is rejected", () => {
  const result = IA.createAlertEvaluationContext({});
  assert.equal(result.ok, false);
  assert.equal(result.error.code, IA.ANALYTICS_ERROR_CODE.TENANT_CONTEXT_REQUIRED);
});

test("4. source tenant mismatch is rejected", () => {
  const { facade } = buildFacade();
  const result = facade.evaluate({
    context: context({
      tenantScope: { kind: IA.ANALYTICS_TENANT_SCOPE_KIND.TENANT, tenantId: "tenant-b" },
    }),
  });
  assert.equal(result.ok, false);
  assert.equal(result.error.code, IA.ANALYTICS_ERROR_CODE.OPERATIONAL_ALERTS_TENANT_MISMATCH);
});

test("5. mixed-tenant signals are rejected (fail closed, never silently filtered)", () => {
  const result = guard(
    context(),
    buildSnapshot([
      buildSignal({ tenantId: TENANT }),
      buildSignal({ tenantId: "tenant-b" }),
    ])
  );
  assert.equal(result.ok, false);
  assert.equal(result.error.code, IA.ANALYTICS_ERROR_CODE.OPERATIONAL_ALERTS_TENANT_MISMATCH);
});

test("6. entity scope mismatch is rejected", () => {
  const result = guard(
    context({ venueId: "venue-1" }),
    buildSnapshot([buildSignal({ entityScope: { venueId: "venue-2" } })])
  );
  assert.equal(result.ok, false);
  assert.equal(result.error.code, IA.ANALYTICS_ERROR_CODE.OPERATIONAL_ALERTS_ENTITY_MISMATCH);
});

// ---------------------------------------------------------------------------
// 7. Metric version mismatch
// ---------------------------------------------------------------------------

test("7. metric version mismatch between signal and rule is rejected", () => {
  const result = evaluate({
    signals: [buildSignal({ metricVersion: "2.0.0" })],
    ruleIds: ["operational.court.availability_low"],
  });
  assert.equal(result.ok, false);
  assert.equal(
    result.error.code,
    IA.ANALYTICS_ERROR_CODE.OPERATIONAL_ALERTS_METRIC_VERSION_MISMATCH
  );
});

// ---------------------------------------------------------------------------
// 8-9. Input immutability / frozen output
// ---------------------------------------------------------------------------

test("8. input is not mutated", () => {
  const query = { context: context(), ruleIds: ["operational.court.availability_low"] };
  const before = JSON.stringify(query);
  const { facade } = buildFacade();
  const result = facade.evaluate(query);
  assert.equal(result.ok, true);
  assert.equal(JSON.stringify(query), before);
});

test("9. output is frozen and does not leak mutable state", () => {
  const { facade } = buildFacade();
  const result = facade.evaluate({
    context: context(),
    ruleIds: ["operational.court.availability_low"],
  });
  assert.equal(result.ok, true);
  assert.ok(Object.isFrozen(result.value));
  assert.ok(Object.isFrozen(result.value.evaluation));
  assert.ok(Object.isFrozen(result.value.evaluation.alerts));
  assert.throws(() => {
    result.value.evaluation.alerts[0].status = "TAMPERED";
  });
});

// ---------------------------------------------------------------------------
// 10-12. Rule catalog governance
// ---------------------------------------------------------------------------

test("10. rule definitions have stable ruleId/ruleVersion across builds", () => {
  const first = IA.getFoundationOperationalAlertRuleCatalog();
  const second = IA.getFoundationOperationalAlertRuleCatalog();
  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  const idsA = first.value.list().map((r) => `${r.ruleId}@${r.ruleVersion}`);
  const idsB = second.value.list().map((r) => `${r.ruleId}@${r.ruleVersion}`);
  assert.deepEqual(idsA, idsB);
  for (const rule of first.value.list()) {
    assert.ok(rule.ruleId);
    assert.ok(rule.ruleVersion);
    assert.ok(Object.isFrozen(rule));
  }
});

test("11. rule catalog registers validly", () => {
  const catalog = IA.createOperationalAlertRuleCatalog();
  assert.equal(catalog.ok, true);
  assert.equal(catalog.value.size, catalog.value.alertRules.length + catalog.value.insightRules.length);
  const found = catalog.value.getById("operational.court.availability_low", "1.0.0");
  assert.ok(found);
  assert.equal(found.metricId, IA.VENUE_COURT_CLUB_ANALYTICS_METRIC_IDS.COURT_AVAILABILITY_RATE);
});

test("12. duplicate rule registration conflict is deterministic", () => {
  const duplicateRule = {
    ruleId: "operational.court.availability_low",
    ruleVersion: "1.0.0",
    title: "Duplicate court availability rule",
    evaluationType: IA.ALERT_EVALUATION_TYPE.THRESHOLD,
    severity: IA.ALERT_SEVERITY.HIGH,
    domain: IA.OPERATIONAL_SIGNAL_DOMAIN.VENUE_COURT,
    metricId: IA.VENUE_COURT_CLUB_ANALYTICS_METRIC_IDS.COURT_AVAILABILITY_RATE,
    metricVersion: "1.0.0",
    condition: {
      operator: IA.ALERT_THRESHOLD_OPERATOR.LT,
      threshold: 0.5,
      valueKind: IA.OPERATIONAL_SIGNAL_VALUE_KIND.PERCENTAGE,
    },
  };
  const first = IA.createOperationalAlertRuleCatalog({ extraAlertRules: [duplicateRule] });
  const second = IA.createOperationalAlertRuleCatalog({ extraAlertRules: [duplicateRule] });
  assert.equal(first.ok, false);
  assert.equal(second.ok, false);
  assert.equal(first.error.code, IA.ANALYTICS_ERROR_CODE.OPERATIONAL_ALERTS_RULE_CONFLICT);
  assert.equal(second.error.code, IA.ANALYTICS_ERROR_CODE.OPERATIONAL_ALERTS_RULE_CONFLICT);
});

// ---------------------------------------------------------------------------
// 13-16. Threshold evaluator operators
// ---------------------------------------------------------------------------

test("13. threshold GT operator is strict (not inclusive)", () => {
  const condition = IA.createAlertThresholdCondition({
    operator: IA.ALERT_THRESHOLD_OPERATOR.GT,
    threshold: 0.9,
    valueKind: IA.OPERATIONAL_SIGNAL_VALUE_KIND.PERCENTAGE,
  }).value;
  const above = IA.evaluateThresholdCondition({ value: 0.95 }, condition);
  const equal = IA.evaluateThresholdCondition({ value: 0.9 }, condition);
  assert.equal(above.ok, true);
  assert.equal(above.value.matched, true);
  assert.equal(equal.ok, true);
  assert.equal(equal.value.matched, false);
});

test("14. threshold LT operator is strict (not inclusive)", () => {
  const condition = IA.createAlertThresholdCondition({
    operator: IA.ALERT_THRESHOLD_OPERATOR.LT,
    threshold: 0.4,
    valueKind: IA.OPERATIONAL_SIGNAL_VALUE_KIND.PERCENTAGE,
  }).value;
  const below = IA.evaluateThresholdCondition({ value: 0.2 }, condition);
  const equal = IA.evaluateThresholdCondition({ value: 0.4 }, condition);
  assert.equal(below.value.matched, true);
  assert.equal(equal.value.matched, false);
});

test("15. threshold GTE/LTE operators are inclusive", () => {
  const gte = IA.createAlertThresholdCondition({
    operator: IA.ALERT_THRESHOLD_OPERATOR.GTE,
    threshold: 0.25,
    valueKind: IA.OPERATIONAL_SIGNAL_VALUE_KIND.PERCENTAGE,
  }).value;
  const lte = IA.createAlertThresholdCondition({
    operator: IA.ALERT_THRESHOLD_OPERATOR.LTE,
    threshold: 0.6,
    valueKind: IA.OPERATIONAL_SIGNAL_VALUE_KIND.PERCENTAGE,
  }).value;
  assert.equal(IA.evaluateThresholdCondition({ value: 0.25 }, gte).value.matched, true);
  assert.equal(IA.evaluateThresholdCondition({ value: 0.6 }, lte).value.matched, true);
  assert.equal(IA.evaluateThresholdCondition({ value: 0.61 }, lte).value.matched, false);
});

test("16. range threshold (inside_range) is inclusive on both bounds", () => {
  const condition = IA.createAlertThresholdCondition({
    operator: IA.ALERT_THRESHOLD_OPERATOR.INSIDE_RANGE,
    min: 10,
    max: 20,
  });
  assert.equal(condition.ok, true);
  assert.equal(IA.evaluateThresholdCondition({ value: 10 }, condition.value).value.matched, true);
  assert.equal(IA.evaluateThresholdCondition({ value: 15 }, condition.value).value.matched, true);
  assert.equal(IA.evaluateThresholdCondition({ value: 20 }, condition.value).value.matched, true);
  assert.equal(IA.evaluateThresholdCondition({ value: 21 }, condition.value).value.matched, false);
});

// ---------------------------------------------------------------------------
// 17-20. Threshold / signal validation boundaries
// ---------------------------------------------------------------------------

test("17. unit mismatch between signal and condition is rejected", () => {
  const condition = IA.createAlertThresholdCondition({
    operator: IA.ALERT_THRESHOLD_OPERATOR.GT,
    threshold: 0.4,
    valueKind: IA.OPERATIONAL_SIGNAL_VALUE_KIND.PERCENTAGE,
    unit: "ratio",
  }).value;
  const result = IA.evaluateThresholdCondition({ value: 0.5, unit: "percent" }, condition);
  assert.equal(result.ok, false);
  assert.equal(result.error.code, IA.ANALYTICS_ERROR_CODE.OPERATIONAL_ALERTS_UNIT_MISMATCH);
});

test("18. currency mismatch between money signal and threshold is rejected", () => {
  const condition = IA.createAlertThresholdCondition({
    operator: IA.ALERT_THRESHOLD_OPERATOR.GT,
    valueKind: IA.OPERATIONAL_SIGNAL_VALUE_KIND.MONEY,
    threshold: { currencyCode: "USD", amountMinor: 1000 },
  }).value;
  const result = IA.evaluateThresholdCondition(
    { value: { currencyCode: "VND", amountMinor: 1500 } },
    condition
  );
  assert.equal(result.ok, false);
  assert.equal(result.error.code, IA.ANALYTICS_ERROR_CODE.OPERATIONAL_ALERTS_CURRENCY_MISMATCH);

  const sameCurrency = IA.evaluateThresholdCondition(
    { value: { currencyCode: "USD", amountMinor: 1500 } },
    condition
  );
  assert.equal(sameCurrency.ok, true);
  assert.equal(sameCurrency.value.matched, true);
});

test("19. percentage value/threshold outside [0,1] is rejected", () => {
  const baseSignal = {
    tenantId: TENANT,
    signalId: "test.metric",
    signalVersion: "1.0.0",
    metricId: "test.metric",
    metricVersion: "1.0.0",
    domain: IA.OPERATIONAL_SIGNAL_DOMAIN.DATA_QUALITY,
  };
  const signalOverflow = IA.createOperationalSignal({
    ...baseSignal,
    valueKind: IA.OPERATIONAL_SIGNAL_VALUE_KIND.PERCENTAGE,
    value: 1.5,
  });
  assert.equal(signalOverflow.ok, false);
  assert.equal(signalOverflow.error.code, IA.ANALYTICS_ERROR_CODE.OPERATIONAL_ALERTS_THRESHOLD_INVALID);

  const conditionOverflow = IA.createAlertThresholdCondition({
    operator: IA.ALERT_THRESHOLD_OPERATOR.GT,
    valueKind: IA.OPERATIONAL_SIGNAL_VALUE_KIND.PERCENTAGE,
    threshold: 1.5,
  });
  assert.equal(conditionOverflow.ok, false);
  assert.equal(
    conditionOverflow.error.code,
    IA.ANALYTICS_ERROR_CODE.OPERATIONAL_ALERTS_THRESHOLD_INVALID
  );
});

test("20. NaN/Infinity values are rejected for signals and thresholds", () => {
  const baseSignal = {
    tenantId: TENANT,
    signalId: "test.metric",
    signalVersion: "1.0.0",
    metricId: "test.metric",
    metricVersion: "1.0.0",
    domain: IA.OPERATIONAL_SIGNAL_DOMAIN.DATA_QUALITY,
    valueKind: IA.OPERATIONAL_SIGNAL_VALUE_KIND.NUMBER,
  };
  const nanSignal = IA.createOperationalSignal({ ...baseSignal, value: NaN });
  assert.equal(nanSignal.ok, false);
  assert.equal(nanSignal.error.code, IA.ANALYTICS_ERROR_CODE.OPERATIONAL_ALERTS_THRESHOLD_INVALID);
  const infSignal = IA.createOperationalSignal({ ...baseSignal, value: Infinity });
  assert.equal(infSignal.ok, false);

  const nanThreshold = IA.createAlertThresholdCondition({
    operator: IA.ALERT_THRESHOLD_OPERATOR.GT,
    threshold: NaN,
  });
  assert.equal(nanThreshold.ok, false);
  const infThreshold = IA.createAlertThresholdCondition({
    operator: IA.ALERT_THRESHOLD_OPERATOR.GT,
    threshold: Infinity,
  });
  assert.equal(infThreshold.ok, false);
});

// ---------------------------------------------------------------------------
// 21-22. Missing / stale signal policy determinism
// ---------------------------------------------------------------------------

test("21. missing signal policy is deterministic: ALERT synthesizes an alert, SKIP stays silent", () => {
  const alertPolicy = evaluate({ signals: [], ruleIds: ["operational.data.missing"] });
  assert.equal(alertPolicy.ok, true);
  assert.equal(alertPolicy.value.alerts.length, 1);
  assert.equal(alertPolicy.value.alerts[0].ruleId, "operational.data.missing");
  assert.equal(alertPolicy.value.alerts[0].severity, IA.ALERT_SEVERITY.HIGH);

  const skipPolicy = evaluate({ signals: [], ruleIds: ["operational.court.availability_low"] });
  assert.equal(skipPolicy.ok, true);
  assert.equal(skipPolicy.value.alerts.length, 0);
  assert.equal(skipPolicy.value.warnings.length, 0);
});

test("22. stale signal policy is deterministic across ALERT/WARN/SKIP/FAIL", () => {
  const staleFreshnessSignal = {
    tenantId: TENANT,
    signalId: "operational.data.freshness",
    signalVersion: "1.0.0",
    metricId: "operational.data.freshness",
    metricVersion: "1.0.0",
    domain: IA.OPERATIONAL_SIGNAL_DOMAIN.DATA_QUALITY,
    freshness: IA.ANALYTICS_FRESHNESS_STATE.STALE,
    completeness: IA.OPERATIONAL_ALERTS_INSIGHTS_COMPLETENESS.COMPLETE,
    provenance: PROVENANCE,
    sourceTimestamp: "2026-07-20T12:00:00.000Z",
  };
  // ALERT: freshness rule fires a matched alert on a stale signal.
  const alertResult = evaluate({
    signals: [staleFreshnessSignal],
    ruleIds: ["operational.data.stale"],
  });
  assert.equal(alertResult.ok, true);
  assert.equal(alertResult.value.alerts.length, 1);
  assert.equal(alertResult.value.alerts[0].evidence.evaluation.reason, "stale_signal");

  // WARN: a threshold rule with a stale (but otherwise matching) signal still
  // alerts, and additionally records a warning — never silently dropped.
  const warnResult = evaluate({
    signals: [buildSignal({ freshness: IA.ANALYTICS_FRESHNESS_STATE.STALE })],
    ruleIds: ["operational.court.availability_low"],
  });
  assert.equal(warnResult.ok, true);
  assert.equal(warnResult.value.alerts.length, 1);
  assert.ok(warnResult.value.warnings.some((w) => w.code === "STALE_SIGNAL"));
  assert.ok(warnResult.value.alerts[0].warnings.some((w) => w.code === "STALE_SOURCE"));

  // FAIL: an explicit staleDataPolicy: FAIL rule rejects the whole evaluation.
  const failRule = {
    ruleId: "test.stale.fail",
    ruleVersion: "1.0.0",
    title: "Stale fail rule",
    evaluationType: IA.ALERT_EVALUATION_TYPE.THRESHOLD,
    severity: IA.ALERT_SEVERITY.LOW,
    domain: IA.OPERATIONAL_SIGNAL_DOMAIN.VENUE_COURT,
    metricId: IA.VENUE_COURT_CLUB_ANALYTICS_METRIC_IDS.COURT_AVAILABILITY_RATE,
    metricVersion: "1.0.0",
    staleDataPolicy: IA.STALE_SIGNAL_POLICY.FAIL,
    condition: {
      operator: IA.ALERT_THRESHOLD_OPERATOR.LT,
      threshold: 0.4,
      valueKind: IA.OPERATIONAL_SIGNAL_VALUE_KIND.PERCENTAGE,
    },
  };
  const failCatalog = IA.createOperationalAlertRuleCatalog({ extraAlertRules: [failRule] });
  assert.equal(failCatalog.ok, true);
  const failResult = evaluate({
    signals: [buildSignal({ freshness: IA.ANALYTICS_FRESHNESS_STATE.STALE })],
    ruleIds: ["test.stale.fail"],
    catalog: failCatalog.value,
  });
  assert.equal(failResult.ok, false);
  assert.equal(failResult.error.code, IA.ANALYTICS_ERROR_CODE.OPERATIONAL_ALERTS_EVALUATION_INVALID);

  // SKIP: an explicit staleDataPolicy: SKIP threshold rule stays silent.
  const skipRule = { ...failRule, ruleId: "test.stale.skip", staleDataPolicy: IA.STALE_SIGNAL_POLICY.SKIP };
  const skipCatalog = IA.createOperationalAlertRuleCatalog({ extraAlertRules: [skipRule] });
  assert.equal(skipCatalog.ok, true);
  const skipResult = evaluate({
    signals: [buildSignal({ freshness: IA.ANALYTICS_FRESHNESS_STATE.STALE })],
    ruleIds: ["test.stale.skip"],
    catalog: skipCatalog.value,
  });
  assert.equal(skipResult.ok, true);
  assert.equal(skipResult.value.alerts.length, 0);
});

// ---------------------------------------------------------------------------
// 23-24. State condition evaluator
// ---------------------------------------------------------------------------

test("23. state condition matches on equals/inSet", () => {
  const equalsCondition = IA.createAlertStateCondition({ equals: "OPEN" }).value;
  const matched = IA.evaluateStateCondition({ state: "OPEN" }, equalsCondition);
  assert.equal(matched.ok, true);
  assert.equal(matched.value.matched, true);
  const notMatched = IA.evaluateStateCondition({ state: "CLOSED" }, equalsCondition);
  assert.equal(notMatched.value.matched, false);

  const inSetCondition = IA.createAlertStateCondition({ inSet: ["DEGRADED", "DOWN"] }).value;
  assert.equal(IA.evaluateStateCondition({ state: "DOWN" }, inSetCondition).value.matched, true);
  assert.equal(IA.evaluateStateCondition({ state: "UP" }, inSetCondition).value.matched, false);
});

test("24. disallowed-state alert uses notInSet semantics", () => {
  const condition = IA.createAlertStateCondition({ notInSet: ["ACTIVE", "IDLE"] }).value;
  const disallowed = IA.evaluateStateCondition({ state: "SUSPENDED" }, condition);
  assert.equal(disallowed.ok, true);
  assert.equal(disallowed.value.matched, true);
  const allowed = IA.evaluateStateCondition({ state: "ACTIVE" }, condition);
  assert.equal(allowed.value.matched, false);
});

// ---------------------------------------------------------------------------
// 25-29. Trend condition evaluator
// ---------------------------------------------------------------------------

test("25. trend increasing condition matches an increasing trend signal", () => {
  const condition = IA.createAlertTrendCondition({
    expectedDirection: "increasing",
    minimumPeriods: 2,
    minimumCoverage: 0.5,
  }).value;
  const result = IA.evaluateTrendCondition(
    { trend: { direction: "increasing", usablePointCount: 3, coverageRate: 0.8 } },
    condition
  );
  assert.equal(result.ok, true);
  assert.equal(result.value.matched, true);
});

test("26. trend decreasing condition matches a decreasing trend signal", () => {
  const condition = IA.createAlertTrendCondition({
    expectedDirection: "decreasing",
    minimumPeriods: 2,
    minimumCoverage: 0.5,
  }).value;
  const result = IA.evaluateTrendCondition(
    { trend: { direction: "decreasing", usablePointCount: 4, coverageRate: 0.9 } },
    condition
  );
  assert.equal(result.value.matched, true);
});

test("27. flat/stable trend never matches a rule expecting decreasing", () => {
  const condition = IA.createAlertTrendCondition({
    expectedDirection: "decreasing",
    minimumPeriods: 2,
    minimumCoverage: 0.5,
  }).value;
  const result = IA.evaluateTrendCondition(
    { trend: { direction: "stable", usablePointCount: 4, coverageRate: 0.9 } },
    condition
  );
  assert.equal(result.ok, true);
  assert.equal(result.value.matched, false);
  assert.equal(result.value.skipped, undefined);
});

test("28. insufficient periods produces a skip warning, never an alert", () => {
  const condition = IA.createAlertTrendCondition({
    expectedDirection: "decreasing",
    minimumPeriods: 3,
    minimumCoverage: 0.5,
  }).value;
  const result = IA.evaluateTrendCondition(
    { trend: { direction: "decreasing", usablePointCount: 1, coverageRate: 0.9 } },
    condition
  );
  assert.equal(result.ok, true);
  assert.equal(result.value.matched, false);
  assert.equal(result.value.skipped, true);
  assert.equal(result.value.reason, "insufficient_periods");
  assert.equal(result.value.warningCode, "INSUFFICIENT_TREND_PERIODS");
});

test("29. insufficient coverage produces a skip warning, no valid trend alert", () => {
  const condition = IA.createAlertTrendCondition({
    expectedDirection: "decreasing",
    minimumPeriods: 2,
    minimumCoverage: 0.6,
  }).value;
  const result = IA.evaluateTrendCondition(
    { trend: { direction: "decreasing", usablePointCount: 4, coverageRate: 0.1 } },
    condition
  );
  assert.equal(result.value.matched, false);
  assert.equal(result.value.skipped, true);
  assert.equal(result.value.reason, "insufficient_coverage");
  assert.equal(result.value.warningCode, "INSUFFICIENT_TREND_COVERAGE");
});

// ---------------------------------------------------------------------------
// 30-32. Data missing / stale / source-failure alerts (full evaluation)
// ---------------------------------------------------------------------------

test("30. missing operational data produces a HIGH severity alert (never filled as zero)", () => {
  const result = evaluate({ signals: [], ruleIds: ["operational.data.missing"] });
  assert.equal(result.ok, true);
  assert.equal(result.value.alerts.length, 1);
  const alert = result.value.alerts[0];
  assert.equal(alert.severity, IA.ALERT_SEVERITY.HIGH);
  assert.equal(alert.evidence.evaluation.filledAsZero, false);
  assert.equal(alert.evidence.evaluation.neverFillZero, true);
});

test("31. stale operational data produces a MEDIUM severity freshness alert", () => {
  const staleSignal = {
    tenantId: TENANT,
    signalId: "operational.data.freshness",
    signalVersion: "1.0.0",
    metricId: "operational.data.freshness",
    metricVersion: "1.0.0",
    domain: IA.OPERATIONAL_SIGNAL_DOMAIN.DATA_QUALITY,
    freshness: IA.ANALYTICS_FRESHNESS_STATE.STALE,
    provenance: PROVENANCE,
    sourceTimestamp: "2026-07-20T12:00:00.000Z",
  };
  const result = evaluate({ signals: [staleSignal], ruleIds: ["operational.data.stale"] });
  assert.equal(result.ok, true);
  assert.equal(result.value.alerts.length, 1);
  assert.equal(result.value.alerts[0].severity, IA.ALERT_SEVERITY.MEDIUM);
  assert.equal(result.value.alerts[0].evidence.freshness, IA.ANALYTICS_FRESHNESS_STATE.STALE);
});

test("32. explicit source-failure signal produces a CRITICAL alert", () => {
  const failureSignal = {
    tenantId: TENANT,
    signalId: "operational.source.status",
    signalVersion: "1.0.0",
    metricId: "operational.source.status",
    metricVersion: "1.0.0",
    domain: IA.OPERATIONAL_SIGNAL_DOMAIN.DATA_QUALITY,
    valueKind: IA.OPERATIONAL_SIGNAL_VALUE_KIND.BOOLEAN,
    value: false,
    sourceFailure: true,
    provenance: PROVENANCE,
    sourceTimestamp: "2026-07-20T12:00:00.000Z",
  };
  const result = evaluate({ signals: [failureSignal], ruleIds: ["operational.source.failure"] });
  assert.equal(result.ok, true);
  assert.equal(result.value.alerts.length, 1);
  assert.equal(result.value.alerts[0].severity, IA.ALERT_SEVERITY.CRITICAL);
  assert.equal(result.value.alerts[0].evidence.evaluation.reason, "source_failure");
});

// ---------------------------------------------------------------------------
// 33-34. Severity preserved / mapping deterministic
// ---------------------------------------------------------------------------

test("33. alert severity is preserved verbatim from the matched rule", () => {
  const result = evaluate({ ruleIds: ["operational.court.availability_low"] });
  assert.equal(result.ok, true);
  assert.equal(result.value.alerts[0].severity, IA.ALERT_SEVERITY.HIGH);
});

test("34. severity mapping is deterministic across repeated evaluations", () => {
  const a = evaluate({ ruleIds: ["operational.court.availability_low"] });
  const b = evaluate({ ruleIds: ["operational.court.availability_low"] });
  assert.equal(a.value.alerts[0].severity, b.value.alerts[0].severity);
  assert.equal(a.value.alerts[0].ruleId, b.value.alerts[0].ruleId);
});

// ---------------------------------------------------------------------------
// 35-39. Alert lifecycle projection
// ---------------------------------------------------------------------------

test("35. a fresh matched alert starts in OPEN lifecycle state", () => {
  const result = evaluate({ ruleIds: ["operational.court.availability_low"] });
  assert.equal(result.ok, true);
  assert.equal(result.value.alerts[0].status, IA.ALERT_LIFECYCLE_STATE.OPEN);
  assert.equal(result.value.alerts[0].acknowledgement, null);
});

test("36. ACKNOWLEDGED is only projected from explicit acknowledgements keyed by dedup key", () => {
  const first = evaluate({ ruleIds: ["operational.court.availability_low"] });
  assert.equal(first.ok, true);
  const dedupKey = first.value.alerts[0].deduplicationKey;

  const unacknowledged = evaluate({ ruleIds: ["operational.court.availability_low"] });
  assert.equal(unacknowledged.value.alerts[0].status, IA.ALERT_LIFECYCLE_STATE.OPEN);

  const acknowledged = evaluate({
    ruleIds: ["operational.court.availability_low"],
    acknowledgements: { [dedupKey]: { acknowledgedAt: FIXED_NOW, actorRef: "ops-1" } },
  });
  assert.equal(acknowledged.value.alerts[0].status, IA.ALERT_LIFECYCLE_STATE.ACKNOWLEDGED);
  assert.equal(acknowledged.value.alerts[0].acknowledgement.actorRef, "ops-1");
  assert.equal(acknowledged.value.alerts[0].acknowledgement.explicit, true);
});

test("37. RESOLVED requires explicit resolutionPolicy.resolveWhenConditionClears + cleared (never automatic)", () => {
  const explicitPolicy = IA.createAlertResolutionPolicy({
    resolveWhenConditionClears: true,
    expireAfterMs: 5000,
  });
  assert.equal(explicitPolicy.ok, true);
  assert.equal(explicitPolicy.value.resolveWhenConditionClears, true);

  const defaultPolicy = IA.createAlertResolutionPolicy({});
  assert.equal(defaultPolicy.ok, true);
  assert.equal(defaultPolicy.value.resolveWhenConditionClears, false);
  assert.equal(defaultPolicy.value.requireExplicitAcknowledgement, true);

  const result = evaluate({ ruleIds: ["operational.court.availability_low"] });
  assert.equal(result.value.alerts[0].status, IA.ALERT_LIFECYCLE_STATE.OPEN);
  assert.equal(result.value.alerts[0].resolution, null);
});

test("38. EXPIRED is projected once expireAfterMs elapses since the signal was observed", () => {
  const expireRule = {
    ruleId: "test.expire.metric",
    ruleVersion: "1.0.0",
    title: "Expiring test rule",
    evaluationType: IA.ALERT_EVALUATION_TYPE.THRESHOLD,
    severity: IA.ALERT_SEVERITY.LOW,
    domain: IA.OPERATIONAL_SIGNAL_DOMAIN.DATA_QUALITY,
    metricId: "test.expire.metric",
    metricVersion: "1.0.0",
    resolutionPolicy: { expireAfterMs: 1000 },
    condition: {
      operator: IA.ALERT_THRESHOLD_OPERATOR.GT,
      threshold: 10,
      valueKind: IA.OPERATIONAL_SIGNAL_VALUE_KIND.NUMBER,
    },
  };
  const catalog = IA.createOperationalAlertRuleCatalog({ extraAlertRules: [expireRule] });
  assert.equal(catalog.ok, true);

  const oldSignal = {
    tenantId: TENANT,
    signalId: "test.expire.metric",
    signalVersion: "1.0.0",
    metricId: "test.expire.metric",
    metricVersion: "1.0.0",
    domain: IA.OPERATIONAL_SIGNAL_DOMAIN.DATA_QUALITY,
    valueKind: IA.OPERATIONAL_SIGNAL_VALUE_KIND.NUMBER,
    value: 20,
    provenance: PROVENANCE,
    sourceTimestamp: "2020-01-01T00:00:00.000Z",
    observedAt: "2020-01-01T00:00:00.000Z",
  };
  const result = evaluate({
    signals: [oldSignal],
    ruleIds: ["test.expire.metric"],
    catalog: catalog.value,
    evaluatedAt: FIXED_NOW,
  });
  assert.equal(result.ok, true);
  assert.equal(result.value.alerts.length, 1);
  assert.equal(result.value.alerts[0].status, IA.ALERT_LIFECYCLE_STATE.EXPIRED);
  assert.equal(result.value.alerts[0].expiration.expired, true);
  assert.equal(result.value.alerts[0].expiration.expireAfterMs, 1000);
});

test("39. SUPPRESSED is projected when a prior alert with the same dedup key is inside cooldown", () => {
  const first = evaluate({ ruleIds: ["operational.court.availability_low"] });
  assert.equal(first.ok, true);
  assert.equal(first.value.alerts[0].status, IA.ALERT_LIFECYCLE_STATE.OPEN);

  const second = evaluate({
    ruleIds: ["operational.court.availability_low"],
    priorAlerts: first.value.alerts,
  });
  assert.equal(second.ok, true);
  assert.equal(second.value.alerts[0].status, IA.ALERT_LIFECYCLE_STATE.SUPPRESSED);
  assert.equal(second.value.alerts[0].suppression.suppressed, true);
});

// ---------------------------------------------------------------------------
// 40-44. Deterministic deduplication / correlation keys
// ---------------------------------------------------------------------------

const DEDUP_BASE = Object.freeze({
  tenantId: TENANT,
  ruleId: "operational.court.availability_low",
  ruleVersion: "1.0.0",
  entityScope: { venueId: "venue-1" },
  metricId: IA.VENUE_COURT_CLUB_ANALYTICS_METRIC_IDS.COURT_AVAILABILITY_RATE,
  metricVersion: "1.0.0",
});

test("40. deduplication key is deterministic for identical input", () => {
  const a = IA.createAlertDeduplicationKey(DEDUP_BASE);
  const b = IA.createAlertDeduplicationKey(DEDUP_BASE);
  assert.equal(a.ok, true);
  assert.equal(b.ok, true);
  assert.equal(a.value.deduplicationKey, b.value.deduplicationKey);
});

test("41. deduplication key differs for a different tenant", () => {
  const a = IA.createAlertDeduplicationKey(DEDUP_BASE);
  const b = IA.createAlertDeduplicationKey({ ...DEDUP_BASE, tenantId: "tenant-b" });
  assert.notEqual(a.value.deduplicationKey, b.value.deduplicationKey);
});

test("42. deduplication key differs for a different entity scope", () => {
  const a = IA.createAlertDeduplicationKey(DEDUP_BASE);
  const b = IA.createAlertDeduplicationKey({ ...DEDUP_BASE, entityScope: { venueId: "venue-2" } });
  assert.notEqual(a.value.deduplicationKey, b.value.deduplicationKey);
});

test("43. deduplication key differs for a different rule version", () => {
  const a = IA.createAlertDeduplicationKey(DEDUP_BASE);
  const b = IA.createAlertDeduplicationKey({ ...DEDUP_BASE, ruleVersion: "2.0.0" });
  assert.notEqual(a.value.deduplicationKey, b.value.deduplicationKey);
});

test("44. correlation key is deterministic for identical input", () => {
  const input = {
    tenantId: TENANT,
    domain: IA.OPERATIONAL_SIGNAL_DOMAIN.VENUE_COURT,
    entityScope: { venueId: "venue-1" },
    metricId: IA.VENUE_COURT_CLUB_ANALYTICS_METRIC_IDS.COURT_AVAILABILITY_RATE,
    correlationGroup: "venue_court",
  };
  const a = IA.createAlertCorrelationKey(input);
  const b = IA.createAlertCorrelationKey(input);
  assert.equal(a.ok, true);
  assert.equal(a.value.correlationKey, b.value.correlationKey);
});

// ---------------------------------------------------------------------------
// 45-47. Cooldown suppression semantics
// ---------------------------------------------------------------------------

test("45. cooldown suppresses a duplicate matched alert within the same window", () => {
  const first = evaluate({ ruleIds: ["operational.court.availability_low"] });
  const second = evaluate({
    ruleIds: ["operational.court.availability_low"],
    priorAlerts: first.value.alerts,
  });
  assert.equal(second.value.alerts[0].status, IA.ALERT_LIFECYCLE_STATE.SUPPRESSED);
});

test("46. cooldown does not suppress across a different tenant or a different entity scope", () => {
  const first = evaluate({ ruleIds: ["operational.court.availability_low"] });
  const priorAlert = first.value.alerts[0];

  const otherTenantPrior = {
    ...priorAlert,
    tenantId: "tenant-b",
  };
  const notSuppressedByTenant = evaluate({
    ruleIds: ["operational.court.availability_low"],
    priorAlerts: [otherTenantPrior],
  });
  assert.equal(notSuppressedByTenant.value.alerts[0].status, IA.ALERT_LIFECYCLE_STATE.OPEN);

  const otherEntitySecond = evaluate({
    signals: [buildSignal({ entityScope: { venueId: "venue-2" } })],
    ruleIds: ["operational.court.availability_low"],
    priorAlerts: first.value.alerts,
  });
  assert.equal(otherEntitySecond.value.alerts[0].status, IA.ALERT_LIFECYCLE_STATE.OPEN);
});

test("47. suppression reason is retained on the projected alert", () => {
  const first = evaluate({ ruleIds: ["operational.court.availability_low"] });
  const second = evaluate({
    ruleIds: ["operational.court.availability_low"],
    priorAlerts: first.value.alerts,
  });
  assert.equal(second.value.alerts[0].suppression.reason, "cooldown_active");
});

// ---------------------------------------------------------------------------
// 48-49. Explanation and evidence
// ---------------------------------------------------------------------------

test("48. alert explanation is rendered from evidence, not invented", () => {
  const result = evaluate({ ruleIds: ["operational.court.availability_low"] });
  assert.equal(result.ok, true);
  const alert = result.value.alerts[0];
  assert.ok(alert.explanation.includes("0.2"));
  assert.ok(alert.explanation.includes("0.4"));
  assert.equal(alert.evidence.observedValue, 0.2);
  assert.equal(alert.evidence.threshold, 0.4);
});

test("49. insight explanation rejects causality claims ('because')", () => {
  const result = IA.createOperationalInsight({
    insightId: "insight-1",
    tenantId: TENANT,
    ruleId: "test.insight",
    ruleVersion: "1.0.0",
    title: "Customer drop",
    explanation: "customers are leaving because prices increased",
    severity: IA.ALERT_SEVERITY.INFO,
    domain: IA.OPERATIONAL_SIGNAL_DOMAIN.CUSTOMER_PLAYER,
    metricId: "customer.activities.count",
    metricVersion: "1.0.0",
  });
  assert.equal(result.ok, false);
  assert.equal(result.error.code, IA.ANALYTICS_ERROR_CODE.OPERATIONAL_ALERTS_EVALUATION_INVALID);

  const causalityFree = IA.createOperationalInsight({
    insightId: "insight-2",
    tenantId: TENANT,
    ruleId: "test.insight",
    ruleVersion: "1.0.0",
    title: "Customer drop",
    explanation: "Customer activity declined over the selected window",
    severity: IA.ALERT_SEVERITY.INFO,
    domain: IA.OPERATIONAL_SIGNAL_DOMAIN.CUSTOMER_PLAYER,
    metricId: "customer.activities.count",
    metricVersion: "1.0.0",
  });
  assert.equal(causalityFree.ok, true);
});

// ---------------------------------------------------------------------------
// 50-53. Provenance / freshness / completeness preservation
// ---------------------------------------------------------------------------

test("50. provenance is preserved from the source signal onto the alert", () => {
  const result = evaluate({ ruleIds: ["operational.court.availability_low"] });
  assert.equal(result.ok, true);
  assert.equal(result.value.alerts[0].provenance.source.sourceId, SOURCE.sourceId);
});

test("51. freshness is preserved from the source signal onto the alert", () => {
  const result = evaluate({ ruleIds: ["operational.court.availability_low"] });
  assert.equal(result.value.alerts[0].freshness, IA.ANALYTICS_FRESHNESS_STATE.FRESH);
});

test("52. completeness is preserved from the source signal onto the alert", () => {
  const result = evaluate({ ruleIds: ["operational.court.availability_low"] });
  assert.equal(
    result.value.alerts[0].completeness,
    IA.OPERATIONAL_ALERTS_INSIGHTS_COMPLETENESS.COMPLETE
  );
});

test("53. a stale source raises a warning and flags the facade result as stale", () => {
  const { facade } = buildFacade({
    snapshot: buildSnapshot([buildSignal({ freshness: IA.ANALYTICS_FRESHNESS_STATE.STALE })], {
      freshness: IA.ANALYTICS_FRESHNESS_STATE.STALE,
    }),
  });
  const result = facade.evaluate({
    context: context(),
    ruleIds: ["operational.court.availability_low"],
  });
  assert.equal(result.ok, true);
  assert.equal(result.value.stale, true);
});

// ---------------------------------------------------------------------------
// 54-55. Incomplete data is never assumed complete / never filled as zero
// ---------------------------------------------------------------------------

test("54. incomplete/unknown signal completeness is never assumed complete", () => {
  const condition = IA.createAlertMissingDataCondition({ alertOnIncomplete: true }).value;
  const partial = IA.evaluateMissingDataCondition(
    { completeness: IA.OPERATIONAL_ALERTS_INSIGHTS_COMPLETENESS.PARTIAL },
    condition
  );
  assert.equal(partial.ok, true);
  assert.equal(partial.value.matched, true);
  assert.equal(partial.value.incomplete, true);

  const unknown = IA.evaluateMissingDataCondition(
    { completeness: IA.OPERATIONAL_ALERTS_INSIGHTS_COMPLETENESS.UNKNOWN },
    condition
  );
  assert.equal(unknown.value.matched, true);

  const complete = IA.evaluateMissingDataCondition(
    { completeness: IA.OPERATIONAL_ALERTS_INSIGHTS_COMPLETENESS.COMPLETE },
    condition
  );
  assert.equal(complete.value.matched, false);
  assert.equal(complete.value.incomplete, false);
});

test("55. missing data is never filled as zero", () => {
  const condition = IA.createAlertMissingDataCondition({ alertOnMissing: true }).value;
  const result = IA.evaluateMissingDataCondition({ missing: true }, condition);
  assert.equal(result.ok, true);
  assert.equal(result.value.filledAsZero, false);
  assert.equal(result.value.neverFillZero, true);
});

// ---------------------------------------------------------------------------
// 56-59. Domain-scoped alerts use stable merged I&A metric IDs
// ---------------------------------------------------------------------------

test("56. court alert uses the I&A-07 court.availability_rate metric under venue_court domain", () => {
  const result = evaluate({ ruleIds: ["operational.court.availability_low"] });
  assert.equal(result.ok, true);
  assert.equal(result.value.alerts[0].metricId, IA.VENUE_COURT_CLUB_ANALYTICS_METRIC_IDS.COURT_AVAILABILITY_RATE);
  assert.equal(result.value.alerts[0].domain, IA.OPERATIONAL_SIGNAL_DOMAIN.VENUE_COURT);
});

test("57. competition alert uses an I&A-06 competition analytics metric", () => {
  const signal = {
    tenantId: TENANT,
    signalId: IA.COMPETITION_ANALYTICS_METRIC_IDS.SCHEDULE_DELAYED_START_COUNT,
    signalVersion: "1.0.0",
    metricId: IA.COMPETITION_ANALYTICS_METRIC_IDS.SCHEDULE_DELAYED_START_COUNT,
    metricVersion: "1.0.0",
    domain: IA.OPERATIONAL_SIGNAL_DOMAIN.COMPETITION,
    valueKind: IA.OPERATIONAL_SIGNAL_VALUE_KIND.NUMBER,
    value: 6,
    unit: "count",
    provenance: PROVENANCE,
    sourceTimestamp: "2026-07-20T12:00:00.000Z",
  };
  const result = evaluate({
    signals: [signal],
    ruleIds: ["operational.competition.schedule_delay_high"],
  });
  assert.equal(result.ok, true);
  assert.equal(result.value.alerts.length, 1);
  assert.equal(result.value.alerts[0].metricId, IA.COMPETITION_ANALYTICS_METRIC_IDS.SCHEDULE_DELAYED_START_COUNT);
  assert.equal(result.value.alerts[0].domain, IA.OPERATIONAL_SIGNAL_DOMAIN.COMPETITION);
});

test("58. customer/player alert uses an I&A-08 customer/player analytics metric", () => {
  const signal = {
    tenantId: TENANT,
    signalId: IA.CUSTOMER_PLAYER_ANALYTICS_METRIC_IDS.CUSTOMER_PLAYER_LINKAGE_RATE,
    signalVersion: "1.0.0",
    metricId: IA.CUSTOMER_PLAYER_ANALYTICS_METRIC_IDS.CUSTOMER_PLAYER_LINKAGE_RATE,
    metricVersion: "1.0.0",
    domain: IA.OPERATIONAL_SIGNAL_DOMAIN.CUSTOMER_PLAYER,
    valueKind: IA.OPERATIONAL_SIGNAL_VALUE_KIND.PERCENTAGE,
    value: 0.3,
    unit: "ratio",
    provenance: PROVENANCE,
    sourceTimestamp: "2026-07-20T12:00:00.000Z",
  };
  const result = evaluate({
    signals: [signal],
    ruleIds: ["operational.customer.player_linkage_low"],
  });
  assert.equal(result.ok, true);
  assert.equal(result.value.alerts.length, 1);
  assert.equal(
    result.value.alerts[0].metricId,
    IA.CUSTOMER_PLAYER_ANALYTICS_METRIC_IDS.CUSTOMER_PLAYER_LINKAGE_RATE
  );
  assert.equal(result.value.alerts[0].domain, IA.OPERATIONAL_SIGNAL_DOMAIN.CUSTOMER_PLAYER);
});

test("59. finance/ranking alert uses an I&A-09 finance analytics metric", () => {
  const signal = {
    tenantId: TENANT,
    signalId: IA.FINANCE_RANKING_PERFORMANCE_ANALYTICS_METRIC_IDS.FINANCE_RECEIVABLES_OVERDUE_COUNT,
    signalVersion: "1.0.0",
    metricId: IA.FINANCE_RANKING_PERFORMANCE_ANALYTICS_METRIC_IDS.FINANCE_RECEIVABLES_OVERDUE_COUNT,
    metricVersion: "1.0.0",
    domain: IA.OPERATIONAL_SIGNAL_DOMAIN.FINANCE,
    valueKind: IA.OPERATIONAL_SIGNAL_VALUE_KIND.NUMBER,
    value: 2,
    unit: "count",
    provenance: PROVENANCE,
    sourceTimestamp: "2026-07-20T12:00:00.000Z",
  };
  const result = evaluate({
    signals: [signal],
    ruleIds: ["operational.finance.receivables_overdue_high"],
  });
  assert.equal(result.ok, true);
  assert.equal(result.value.alerts.length, 1);
  assert.equal(
    result.value.alerts[0].metricId,
    IA.FINANCE_RANKING_PERFORMANCE_ANALYTICS_METRIC_IDS.FINANCE_RECEIVABLES_OVERDUE_COUNT
  );
  assert.equal(result.value.alerts[0].domain, IA.OPERATIONAL_SIGNAL_DOMAIN.FINANCE);
});

// ---------------------------------------------------------------------------
// 60-64. No recalculation — signals consumed as-is
// ---------------------------------------------------------------------------

test("60-64. evaluation never recalculates availability/progress/churn/accounting/ranking metrics", () => {
  const forbiddenExportNames = [
    "recalculateAvailability",
    "recalculateProgress",
    "recalculateChurn",
    "recalculateAccounting",
    "recalculateRanking",
    "computeAvailabilityRate",
    "computeChurnRate",
    "postLedgerEntry",
    "recalculateScore",
  ];
  for (const name of forbiddenExportNames) {
    assert.equal(name in IA, false, `unexpected recalculation export: ${name}`);
  }

  const result = evaluate({ ruleIds: ["operational.court.availability_low"] });
  assert.equal(result.ok, true);
  // The raw signal value (0.2) flows through untouched into the alert evidence.
  assert.equal(result.value.alerts[0].evidence.observedValue, 0.2);
});

// ---------------------------------------------------------------------------
// 65-68. Notification candidates are transport-neutral / undelivered
// ---------------------------------------------------------------------------

test("65-66. notification candidate carries no recipient/email/phone/deviceToken fields", () => {
  const result = evaluate({
    ruleIds: ["operational.court.availability_low"],
    includeNotificationCandidates: true,
  });
  assert.equal(result.ok, true);
  assert.equal(result.value.notificationCandidates.length, 1);
  const candidate = result.value.notificationCandidates[0];
  for (const key of IA.FORBIDDEN_OPERATIONAL_ALERT_KEYS) {
    assert.equal(Object.prototype.hasOwnProperty.call(candidate, key), false, key);
  }
  assert.equal(candidate.isDeliveredNotification, false);
  assert.equal(candidate.deliveryCoupled, false);
});

test("67-68. facade rejects deliver/send/notify/write and other command operations", () => {
  const { facade } = buildFacade();
  for (const op of [
    "write",
    "deliver",
    "send",
    "notify",
    "dispatch",
    "retry",
    "escalate",
    "acknowledge",
    "resolve",
    "command",
    "mutate",
    "insert",
    "update",
    "upsert",
    "delete",
    "save",
    "persist",
    "register",
  ]) {
    const rejected = facade[op]();
    assert.equal(rejected.ok, false, op);
    assert.equal(rejected.error.code, IA.ANALYTICS_ERROR_CODE.FACADE_WRITE_REJECTED, op);
  }
});

// ---------------------------------------------------------------------------
// 69-70. Facade query validation / source failure wrapping
// ---------------------------------------------------------------------------

test("69. invalid query does not call the source adapter", () => {
  let loadCalls = 0;
  const sourceAdapter = {
    load() {
      loadCalls += 1;
      return { ok: true, value: { snapshot: {} } };
    },
  };
  const facade = IA.createOperationalAlertsInsightsFacade({ sourceAdapter });
  assert.equal(facade.ok, true);
  const result = facade.value.evaluate({ notAContext: true });
  assert.equal(result.ok, false);
  assert.equal(loadCalls, 0);
});

test("70. source failure (adapter throw) is wrapped deterministically", () => {
  const { facade } = buildFacade({ failMode: "throw" });
  const result = facade.evaluate({ context: context() });
  assert.equal(result.ok, false);
  assert.equal(result.error.code, IA.ANALYTICS_ERROR_CODE.OPERATIONAL_ALERTS_SOURCE_FAILURE);
});

// ---------------------------------------------------------------------------
// 71-75. Import boundary scan
// ---------------------------------------------------------------------------

test("71-75. no React / MUI / Supabase / Platform Core / notification / private business-module imports, no localStorage", () => {
  const files = listJsFiles(OAI_ROOT);
  assert.ok(files.length > 0);
  const importPattern =
    /(?:from|import)\s+['"][^'"]*(?:react|@mui\/|@supabase|supabase|core\/platform|features\/finance\/|features\/notification\/|features\/vpr-ranking\/|features\/player-rating\/|features\/competition-|features\/player\/|features\/customer\/)[^'"]*['"]/i;
  const storagePattern = /localStorage\.(?:getItem|setItem|removeItem)/;
  for (const file of files) {
    const content = readFileSync(file, "utf8");
    assert.equal(importPattern.test(content), false, file);
    assert.equal(storagePattern.test(content), false, file);
  }
});

// ---------------------------------------------------------------------------
// 76-78. Facade independence / determinism
// ---------------------------------------------------------------------------

test("76. no global singleton — independent facade instances with independent execution counters", () => {
  const a = buildFacade();
  const b = buildFacade();
  assert.notEqual(a.facade, b.facade);
  const resultA = a.facade.evaluate({
    context: context(),
    ruleIds: ["operational.court.availability_low"],
  });
  const resultB = b.facade.evaluate({
    context: context(),
    ruleIds: ["operational.court.availability_low"],
  });
  assert.equal(resultA.value.executionId, `ia10-1-${TENANT}`);
  assert.equal(resultB.value.executionId, `ia10-1-${TENANT}`);
});

test("77. empty signals evaluate deterministically (no rules fire, evaluation is empty)", () => {
  const a = evaluate({ signals: [], ruleIds: [] });
  const b = evaluate({ signals: [], ruleIds: [] });
  assert.equal(a.ok, true);
  assert.equal(b.ok, true);
  assert.equal(a.value.emptySignals, true);
  assert.deepEqual(a.value.alerts, []);
  assert.deepEqual(a.value.alerts, b.value.alerts);
  assert.deepEqual(a.value.warnings, b.value.warnings);
});

test("78. same input produces the same result (deterministic)", () => {
  const a = evaluate({ ruleIds: ["operational.court.availability_low"] });
  const b = evaluate({ ruleIds: ["operational.court.availability_low"] });
  assert.equal(a.ok, true);
  assert.deepEqual(a.value.alerts, b.value.alerts);
});

// ---------------------------------------------------------------------------
// 79-81. Cross-tenant / entity / currency isolation fails closed
// ---------------------------------------------------------------------------

test("79. cross-tenant signals are never mixed into a guarded result", () => {
  const result = guard(
    context(),
    buildSnapshot([buildSignal({ tenantId: "tenant-b" })])
  );
  assert.equal(result.ok, false);
  assert.equal(result.error.code, IA.ANALYTICS_ERROR_CODE.OPERATIONAL_ALERTS_TENANT_MISMATCH);
});

test("80. cross-entity signals are never mixed into a guarded result", () => {
  const result = guard(
    context({ courtId: "court-1" }),
    buildSnapshot([buildSignal({ entityScope: { courtId: "court-2" } })])
  );
  assert.equal(result.ok, false);
  assert.equal(result.error.code, IA.ANALYTICS_ERROR_CODE.OPERATIONAL_ALERTS_ENTITY_MISMATCH);
});

test("81. cross-currency signals are never mixed into a currency-scoped context", () => {
  const result = guard(
    context({ currencyCode: "USD" }),
    buildSnapshot([buildSignal({ currencyCode: "VND" })])
  );
  assert.equal(result.ok, false);
  assert.equal(result.error.code, IA.ANALYTICS_ERROR_CODE.OPERATIONAL_ALERTS_CURRENCY_MISMATCH);
});

// ---------------------------------------------------------------------------
// 82-83. Canonical-state / delivery flags
// ---------------------------------------------------------------------------

test("82. isCanonicalDomainState is always false on signals, snapshots, alerts and evaluation results", () => {
  const signalResult = IA.createOperationalSignal(buildSignal());
  assert.equal(signalResult.ok, true);
  assert.equal(signalResult.value.isCanonicalDomainState, false);

  const snapshotResult = IA.createOperationalSignalsSnapshot(buildSnapshot());
  assert.equal(snapshotResult.value.isCanonicalDomainState, false);

  const evaluation = evaluate({ ruleIds: ["operational.court.availability_low"] });
  assert.equal(evaluation.value.isCanonicalDomainState, false);
  assert.equal(evaluation.value.alerts[0].isCanonicalDomainState, false);
});

test("83. isDeliveredNotification is always false on signals, alerts, and notification candidates", () => {
  const signalResult = IA.createOperationalSignal(buildSignal());
  assert.equal(signalResult.value.isDeliveredNotification, false);

  const evaluation = evaluate({
    ruleIds: ["operational.court.availability_low"],
    includeNotificationCandidates: true,
  });
  assert.equal(evaluation.value.alerts[0].isDeliveredNotification, false);
  assert.equal(evaluation.value.notificationCandidates[0].isDeliveredNotification, false);
});

// ---------------------------------------------------------------------------
// 84. No PII keys in facts
// ---------------------------------------------------------------------------

test("84. no PII/sensitive keys are present in fixtures or accepted by contracts", () => {
  const signal = buildSignal();
  for (const key of IA.FORBIDDEN_OPERATIONAL_ALERT_KEYS) {
    assert.equal(Object.prototype.hasOwnProperty.call(signal, key), false, key);
  }

  const emailRejected = IA.createOperationalSignal({ ...buildSignal(), email: "x@y.com" });
  assert.equal(emailRejected.ok, false);
  assert.equal(emailRejected.error.code, IA.ANALYTICS_ERROR_CODE.OPERATIONAL_ALERTS_PRIVACY_VIOLATION);
  assert.equal(emailRejected.error.message.includes("x@y.com"), false);

  const phoneRejected = IA.createAlertEvaluationContext({ ...context(), phone: "0123456789" });
  assert.equal(phoneRejected.ok, false);
  assert.equal(phoneRejected.error.code, IA.ANALYTICS_ERROR_CODE.OPERATIONAL_ALERTS_PRIVACY_VIOLATION);
});

// ---------------------------------------------------------------------------
// 85. Backward compatibility markers
// ---------------------------------------------------------------------------

test("85. I&A-01 through I&A-09 markers remain exported alongside the new I&A-10 marker", () => {
  assert.equal(IA.INTELLIGENCE_ANALYTICS_FOUNDATION.workstreamId, "I&A-01");
  assert.equal(IA.INTELLIGENCE_ANALYTICS_METRIC_REGISTRY.workstreamId, "I&A-02");
  assert.equal(IA.INTELLIGENCE_ANALYTICS_QUERY_RUNTIME.workstreamId, "I&A-03");
  assert.equal(IA.INTELLIGENCE_ANALYTICS_DASHBOARD_REPORTING.workstreamId, "I&A-04");
  assert.equal(IA.INTELLIGENCE_ANALYTICS_HISTORICAL_TREND.workstreamId, "I&A-05");
  assert.equal(IA.INTELLIGENCE_ANALYTICS_COMPETITION_ANALYTICS.workstreamId, "I&A-06");
  assert.equal(IA.INTELLIGENCE_ANALYTICS_VENUE_COURT_CLUB_ANALYTICS.workstreamId, "I&A-07");
  assert.equal(IA.INTELLIGENCE_ANALYTICS_CUSTOMER_PLAYER_ANALYTICS.workstreamId, "I&A-08");
  assert.equal(IA.INTELLIGENCE_ANALYTICS_FINANCE_RANKING_PERFORMANCE_ANALYTICS.workstreamId, "I&A-09");
  assert.equal(IA.INTELLIGENCE_ANALYTICS_OPERATIONAL_ALERTS_INSIGHTS.workstreamId, "I&A-10");
  assert.equal(typeof IA.createCustomerPlayerAnalyticsFacade, "function");
  assert.equal(typeof IA.createCompetitionAnalyticsFacade, "function");
  assert.equal(typeof IA.createVenueCourtClubAnalyticsFacade, "function");
  assert.equal(typeof IA.createFinanceRankingPerformanceAnalyticsFacade, "function");
  assert.equal(typeof IA.createMetricRegistry, "function");
  assert.equal(typeof IA.createAnalyticsHistoricalObservation, "function");
  assert.equal(typeof IA.createAnalyticsKpiPayload, "function");
});

// ---------------------------------------------------------------------------
// Bonus: dashboard payloads (I&A-04 compatible) and read-only facade shape
// ---------------------------------------------------------------------------

test("bonus. dashboard payloads are I&A-04 compatible (kpis/breakdowns/dataState) when no alert/insight rows are present", () => {
  const { facade } = buildFacade();
  const result = facade.evaluate({
    context: context(),
    ruleIds: [],
    includeDashboardPayloads: true,
  });
  assert.equal(result.ok, true);
  const dash = result.value.dashboardPayloads;
  assert.ok(dash.kpis.openAlerts);
  assert.ok(dash.alertsBySeverityBreakdown);
  assert.ok(dash.dataState);
  assert.equal(dash.isCanonicalModuleState, false);
});

test("bonus. dashboard payloads succeed with alert and insight table rows (I&A-04 rowId/cells)", () => {
  const { facade } = buildFacade();
  const result = facade.evaluate({
    context: context(),
    ruleIds: ["operational.court.availability_low"],
    includeDashboardPayloads: true,
  });
  assert.equal(result.ok, true, result.error && result.error.message);
  const dash = result.value.dashboardPayloads;
  assert.ok(dash.kpis.openAlerts);
  assert.ok(dash.dataQualityAlertsTable);
  assert.ok(dash.insightFeedTable);
  assert.ok(dash.unresolvedHighCriticalTable);
  assert.equal(dash.isCanonicalModuleState, false);
  for (const row of dash.unresolvedHighCriticalTable.rows || []) {
    assert.ok(row.rowId);
    assert.ok(row.cells);
  }
});

test("bonus. read-only facade exposes only evaluate/validate/read helpers, none of which persist", () => {
  const { facade } = buildFacade();
  assert.equal(typeof facade.evaluate, "function");
  assert.equal(typeof facade.analyze, "function");
  assert.equal(typeof facade.validate, "function");
  assert.equal(typeof facade.createRuleCatalog, "function");
  assert.equal(typeof facade.getFoundationCatalog, "function");
});
