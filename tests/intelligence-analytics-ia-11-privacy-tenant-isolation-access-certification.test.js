/**
 * I&A-11 — Privacy, Tenant Isolation and Access Certification tests.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import * as IA from "../src/features/intelligence-analytics/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const MODULE_ROOT = join(__dirname, "../src/features/intelligence-analytics");
const PRIVACY_ROOT = join(MODULE_ROOT, "privacy-access-certification");

const FIXED_NOW = "2026-07-25T00:00:00.000Z";
const TENANT = "tenant-a";
const OTHER_TENANT = "tenant-b";

function policy(overrides = {}) {
  return {
    policyId: "ia-11-cert-policy",
    policyVersion: "1.0.0",
    smallCohortThreshold: 5,
    suppressBelowThreshold: true,
    redactFields: ["displayLabel"],
    omitFields: ["internalNote"],
    redactionPlaceholder: "[REDACTED]",
    preservePayloadShape: true,
    ...overrides,
  };
}

function trustedContext(overrides = {}) {
  return {
    trustedSource: true,
    tenantId: TENANT,
    privacyPolicy: {
      policyId: "ia-11-cert-policy",
      policyVersion: "1.0.0",
    },
    issuedAt: FIXED_NOW,
    maxClassification: IA.ANALYTICS_DATA_CLASSIFICATION.PRIVILEGED_OPERATIONAL,
    metricGrants: [
      {
        metricId: "metric.public.count",
        classification: IA.ANALYTICS_DATA_CLASSIFICATION.PUBLIC,
      },
      {
        metricId: "metric.finance.revenue",
        metricVersion: "1.0.0",
        classification: IA.ANALYTICS_DATA_CLASSIFICATION.SENSITIVE_FINANCIAL,
      },
      {
        metricId: "metric.customer.activity",
        classification: IA.ANALYTICS_DATA_CLASSIFICATION.SENSITIVE_PERSONAL,
      },
      {
        metricId: "metric.ranking.position",
        classification: IA.ANALYTICS_DATA_CLASSIFICATION.RESTRICTED,
      },
      {
        metricId: "metric.rating.snapshot",
        classification: IA.ANALYTICS_DATA_CLASSIFICATION.RESTRICTED,
      },
      {
        metricId: "metric.competition.progress",
        classification: IA.ANALYTICS_DATA_CLASSIFICATION.INTERNAL,
      },
      {
        metricId: "metric.venue.utilization",
        classification: IA.ANALYTICS_DATA_CLASSIFICATION.INTERNAL,
      },
      {
        metricId: "metric.ops.insight",
        classification: IA.ANALYTICS_DATA_CLASSIFICATION.PRIVILEGED_OPERATIONAL,
      },
    ],
    dimensionGrants: [
      {
        dimensionId: "day",
        classification: IA.ANALYTICS_DATA_CLASSIFICATION.PUBLIC,
      },
      {
        dimensionId: "venueId",
        classification: IA.ANALYTICS_DATA_CLASSIFICATION.INTERNAL,
      },
    ],
    ...overrides,
  };
}

function buildContext(overrides = {}) {
  const result = IA.createAnalyticsPrivacyAccessContext(
    trustedContext(overrides)
  );
  assert.equal(result.ok, true, result.error?.message);
  return result.value;
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

test("I&A-11 marker and public exports", () => {
  assert.equal(
    IA.INTELLIGENCE_ANALYTICS_PRIVACY_ACCESS_CERTIFICATION.workstreamId,
    "I&A-11"
  );
  for (const name of IA.INTELLIGENCE_ANALYTICS_PUBLIC_EXPORTS) {
    assert.equal(
      name in IA,
      true,
      `missing public export: ${name}`
    );
  }
});

test("1. Valid trusted access context accepted", () => {
  const ctx = buildContext();
  assert.equal(ctx.trustedSource, true);
  assert.equal(ctx.tenantScope.tenantId, TENANT);
  assert.equal(ctx.isCanonicalAuthorizationState, false);
});

test("2. Missing tenant rejected", () => {
  const result = IA.createAnalyticsPrivacyAccessContext({
    trustedSource: true,
    privacyPolicy: { policyId: "p", policyVersion: "1.0.0" },
    issuedAt: FIXED_NOW,
  });
  assert.equal(result.ok, false);
  assert.equal(result.error.code, IA.ANALYTICS_ERROR_CODE.TENANT_CONTEXT_REQUIRED);
});

test("3. Missing trusted-source marker rejected", () => {
  const result = IA.createAnalyticsPrivacyAccessContext({
    tenantId: TENANT,
    privacyPolicy: { policyId: "p", policyVersion: "1.0.0" },
    issuedAt: FIXED_NOW,
  });
  assert.equal(result.ok, false);
  assert.equal(
    result.error.code,
    IA.ANALYTICS_ERROR_CODE.PRIVACY_TRUSTED_SOURCE_REQUIRED
  );
});

test("4. Malformed policy version rejected", () => {
  const result = IA.createAnalyticsPrivacyAccessContext({
    trustedSource: true,
    tenantId: TENANT,
    privacyPolicy: { policyId: "p", policyVersion: "v1" },
    issuedAt: FIXED_NOW,
  });
  assert.equal(result.ok, false);
  assert.equal(
    result.error.code,
    IA.ANALYTICS_ERROR_CODE.PRIVACY_POLICY_VERSION_INVALID
  );
});

test("5. Input immutable", () => {
  const input = trustedContext();
  const before = JSON.stringify(input);
  buildContext(input);
  assert.equal(JSON.stringify(input), before);
});

test("6. Output immutable", () => {
  const ctx = buildContext();
  assert.ok(Object.isFrozen(ctx));
  assert.throws(() => {
    // @ts-expect-error intentional mutation attempt
    ctx.trustedSource = false;
  });
});

test("7. Unknown classification fail closed", () => {
  const result = IA.validateDataClassification("TOP_SECRET");
  assert.equal(result.ok, false);
  assert.equal(
    result.error.code,
    IA.ANALYTICS_ERROR_CODE.PRIVACY_CLASSIFICATION_UNKNOWN
  );
});

test("8. Most-restrictive classification deterministic", () => {
  const a = IA.resolveMostRestrictiveClassification([
    IA.ANALYTICS_DATA_CLASSIFICATION.PUBLIC,
    IA.ANALYTICS_DATA_CLASSIFICATION.SENSITIVE_FINANCIAL,
    IA.ANALYTICS_DATA_CLASSIFICATION.INTERNAL,
  ]);
  const b = IA.resolveMostRestrictiveClassification([
    IA.ANALYTICS_DATA_CLASSIFICATION.INTERNAL,
    IA.ANALYTICS_DATA_CLASSIFICATION.PUBLIC,
    IA.ANALYTICS_DATA_CLASSIFICATION.SENSITIVE_FINANCIAL,
  ]);
  assert.equal(a.ok, true);
  assert.equal(b.ok, true);
  assert.equal(a.value, IA.ANALYTICS_DATA_CLASSIFICATION.SENSITIVE_FINANCIAL);
  assert.equal(a.value, b.value);
});

test("9. PUBLIC metric allowed by matching policy", () => {
  const ctx = buildContext({ metricGrants: [] });
  const decision = IA.evaluateMetricAccess(ctx, {
    metricId: "metric.public.orphan",
    classification: IA.ANALYTICS_DATA_CLASSIFICATION.PUBLIC,
  });
  assert.equal(decision.ok, true);
  assert.equal(decision.value.decision, IA.ANALYTICS_ACCESS_DECISION.ALLOW);
});

test("10. Restricted metric denied without grant", () => {
  const ctx = buildContext({ metricGrants: [] });
  const decision = IA.evaluateMetricAccess(ctx, {
    metricId: "metric.restricted.secret",
    classification: IA.ANALYTICS_DATA_CLASSIFICATION.RESTRICTED,
  });
  assert.equal(decision.ok, true);
  assert.equal(decision.value.decision, IA.ANALYTICS_ACCESS_DECISION.DENY);
  assert.equal(decision.value.isEmpty, false);
});

test("11. Metric version-specific grant enforced", () => {
  const ctx = buildContext();
  const denied = IA.evaluateMetricAccess(ctx, {
    metricId: "metric.finance.revenue",
    metricVersion: "2.0.0",
    classification: IA.ANALYTICS_DATA_CLASSIFICATION.SENSITIVE_FINANCIAL,
  });
  assert.equal(denied.ok, true);
  assert.equal(denied.value.decision, IA.ANALYTICS_ACCESS_DECISION.DENY);

  const allowed = IA.evaluateMetricAccess(ctx, {
    metricId: "metric.finance.revenue",
    metricVersion: "1.0.0",
    classification: IA.ANALYTICS_DATA_CLASSIFICATION.SENSITIVE_FINANCIAL,
  });
  assert.equal(allowed.ok, true);
  assert.equal(allowed.value.decision, IA.ANALYTICS_ACCESS_DECISION.ALLOW);
});

test("12. Restricted dimension denied independently", () => {
  const ctx = buildContext();
  const decision = IA.evaluateDimensionAccess(ctx, {
    dimensionId: "playerId",
    classification: IA.ANALYTICS_DATA_CLASSIFICATION.SENSITIVE_PERSONAL,
  });
  assert.equal(decision.ok, true);
  assert.equal(decision.value.decision, IA.ANALYTICS_ACCESS_DECISION.DENY);
  assert.equal(decision.value.evidence.independentOfMetric, true);
});

test("13. Metric discovery hides denied metric", () => {
  const ctx = buildContext();
  const result = IA.filterMetricDiscovery(ctx, [
    {
      metricId: "metric.public.count",
      classification: IA.ANALYTICS_DATA_CLASSIFICATION.PUBLIC,
    },
    {
      metricId: "metric.hidden.restricted",
      classification: IA.ANALYTICS_DATA_CLASSIFICATION.RESTRICTED,
    },
  ]);
  assert.equal(result.ok, true);
  assert.equal(result.value.metrics.length, 1);
  assert.equal(result.value.metrics[0].metricId, "metric.public.count");
  assert.equal(result.value.hiddenCount, 1);
});

test("14. Unknown metric classification denied", () => {
  const ctx = buildContext();
  const result = IA.evaluateMetricAccess(ctx, {
    metricId: "metric.unknown.class",
  });
  assert.equal(result.ok, false);
  assert.equal(
    result.error.code,
    IA.ANALYTICS_ERROR_CODE.PRIVACY_CLASSIFICATION_UNKNOWN
  );
});

test("15. Unknown dimension classification denied", () => {
  const ctx = buildContext();
  const result = IA.evaluateDimensionAccess(ctx, {
    dimensionId: "dim.unknown",
  });
  assert.equal(result.ok, false);
  assert.equal(
    result.error.code,
    IA.ANALYTICS_ERROR_CODE.PRIVACY_CLASSIFICATION_UNKNOWN
  );
});

test("16. Source tenant mismatch rejected", () => {
  const ctx = buildContext();
  const result = IA.certifyTenantIsolation(ctx, [
    { tenantId: OTHER_TENANT, factId: "f1" },
  ]);
  assert.equal(result.ok, false);
  assert.equal(result.error.code, IA.ANALYTICS_ERROR_CODE.PRIVACY_TENANT_MISMATCH);
  assert.equal(result.error.details?.fact, undefined);
});

test("17. Mixed-tenant facts rejected", () => {
  const ctx = buildContext();
  // First fact matches, second differs → mismatch on second.
  const result = IA.certifyTenantIsolation(ctx, [
    { tenantId: TENANT, factId: "f1" },
    { tenantId: OTHER_TENANT, factId: "f2" },
  ]);
  assert.equal(result.ok, false);
  assert.ok(
    result.error.code === IA.ANALYTICS_ERROR_CODE.PRIVACY_TENANT_MISMATCH ||
      result.error.code === IA.ANALYTICS_ERROR_CODE.PRIVACY_TENANT_CONTAMINATION
  );
});

test("18. Cross-tenant historical series rejected", () => {
  const ctx = buildContext();
  const result = IA.projectHistoricalResultPrivacy(ctx, {
    series: [
      { tenantId: TENANT, bucketStart: "2026-07-01", value: 1 },
      { tenantId: OTHER_TENANT, bucketStart: "2026-07-02", value: 2 },
    ],
  });
  assert.equal(result.ok, false);
  assert.ok(String(result.error.code).includes("TENANT"));
});

test("19. Cross-tenant dashboard payload rejected", () => {
  const ctx = buildContext();
  const result = IA.projectDashboardReportPrivacy(ctx, {
    widgets: [
      { tenantId: TENANT, widgetId: "w1", value: 1 },
      { tenantId: OTHER_TENANT, widgetId: "w2", value: 2 },
    ],
  });
  assert.equal(result.ok, false);
});

test("20. Cross-tenant alert rejected", () => {
  const ctx = buildContext();
  const result = IA.projectAlertInsightPrivacy(ctx, {
    tenantId: OTHER_TENANT,
    alertId: "a1",
    metricId: "metric.ops.insight",
    classification: IA.ANALYTICS_DATA_CLASSIFICATION.PRIVILEGED_OPERATIONAL,
  });
  assert.equal(result.ok, false);
});

function entityMismatchCase(field, value, wrong) {
  test(`entity scope mismatch rejected: ${field}`, () => {
    const ctx = buildContext();
    const result = IA.certifyEntityIsolation(
      ctx,
      { [field]: value },
      [{ tenantId: TENANT, [field]: wrong }]
    );
    assert.equal(result.ok, false);
    assert.equal(result.error.code, IA.ANALYTICS_ERROR_CODE.PRIVACY_ENTITY_MISMATCH);
  });
}

entityMismatchCase("competitionId", "comp-1", "comp-2"); // 21
entityMismatchCase("venueId", "venue-1", "venue-2"); // 22
entityMismatchCase("courtId", "court-1", "court-2"); // 23
entityMismatchCase("clubId", "club-1", "club-2"); // 24
entityMismatchCase("customerId", "cust-1", "cust-2"); // 25
entityMismatchCase("playerId", "player-1", "player-2"); // 26
entityMismatchCase("teamId", "team-1", "team-2"); // 27
entityMismatchCase("financeScopeId", "fin-1", "fin-2"); // 28
entityMismatchCase("rankingSystemId", "rank-1", "rank-2"); // 29
entityMismatchCase("ratingSystemId", "rating-1", "rating-2"); // 30

test("31. Parent-child entity mismatch rejected", () => {
  const ctx = buildContext();
  const result = IA.certifyEntityIsolation(
    ctx,
    { courtId: "court-1", parentVenueId: "venue-1" },
    [{ tenantId: TENANT, courtId: "court-1", parentVenueId: "venue-other" }]
  );
  assert.equal(result.ok, false);
  assert.equal(
    result.error.code,
    IA.ANALYTICS_ERROR_CODE.PRIVACY_PARENT_CHILD_MISMATCH
  );
});

test("32. No first-entity fallback", () => {
  const ctx = buildContext();
  const result = IA.certifyEntityIsolation(ctx, {}, [
    { tenantId: TENANT, venueId: "venue-1" },
  ]);
  assert.equal(result.ok, false);
  assert.equal(result.error.details?.reasonCode, "NO_ENTITY_FALLBACK");
});

test("33. DENY differs from EMPTY", () => {
  const ctx = buildContext({ metricGrants: [] });
  const decision = IA.evaluateMetricAccess(ctx, {
    metricId: "metric.restricted.secret",
    classification: IA.ANALYTICS_DATA_CLASSIFICATION.RESTRICTED,
  });
  assert.equal(decision.value.decision, IA.ANALYTICS_ACCESS_DECISION.DENY);
  assert.equal(decision.value.isEmpty, false);
  assert.notEqual(decision.value.decision, "EMPTY");
});

test("34. SUPPRESS differs from ZERO", () => {
  const ctx = buildContext();
  const decision = IA.evaluateSmallCohortSuppression(
    ctx,
    { eligibleCohortCount: 2, metricId: "metric.public.count" },
    policy()
  );
  assert.equal(decision.ok, true);
  assert.equal(decision.value.decision, IA.ANALYTICS_ACCESS_DECISION.SUPPRESS);
  assert.equal(decision.value.isZero, false);
});

test("35. REDACT differs from MISSING", () => {
  const ctx = buildContext();
  const result = IA.evaluateRedactionAndOmission(
    ctx,
    { displayLabel: "secret-label", keep: 1 },
    policy()
  );
  assert.equal(result.ok, true);
  const redact = result.value.decisions.find(
    (d) => d.decision === IA.ANALYTICS_ACCESS_DECISION.REDACT
  );
  assert.ok(redact);
  assert.equal(redact.isMissing, false);
  assert.equal(result.value.payload.displayLabel, "[REDACTED]");
});

test("36. OMIT differs from REDACT", () => {
  const ctx = buildContext();
  const result = IA.evaluateRedactionAndOmission(
    ctx,
    { internalNote: "hidden", displayLabel: "x" },
    policy()
  );
  assert.equal(result.ok, true);
  assert.equal(Object.prototype.hasOwnProperty.call(result.value.payload, "internalNote"), false);
  assert.equal(Object.prototype.hasOwnProperty.call(result.value.payload, "displayLabel"), true);
  const omit = result.value.decisions.find(
    (d) => d.decision === IA.ANALYTICS_ACCESS_DECISION.OMIT
  );
  const redact = result.value.decisions.find(
    (d) => d.decision === IA.ANALYTICS_ACCESS_DECISION.REDACT
  );
  assert.ok(omit);
  assert.ok(redact);
  assert.notEqual(omit.decision, redact.decision);
});

test("37. Small cohort below threshold suppressed", () => {
  const ctx = buildContext();
  const decision = IA.evaluateSmallCohortSuppression(
    ctx,
    { eligibleCohortCount: 4 },
    policy({ smallCohortThreshold: 5 })
  );
  assert.equal(decision.value.decision, IA.ANALYTICS_ACCESS_DECISION.SUPPRESS);
});

test("38. Cohort equal threshold deterministic", () => {
  const ctx = buildContext();
  const a = IA.evaluateSmallCohortSuppression(
    ctx,
    { eligibleCohortCount: 5 },
    policy({ smallCohortThreshold: 5 })
  );
  const b = IA.evaluateSmallCohortSuppression(
    ctx,
    { eligibleCohortCount: 5 },
    policy({ smallCohortThreshold: 5 })
  );
  assert.equal(a.value.decision, IA.ANALYTICS_ACCESS_DECISION.ALLOW);
  assert.equal(a.value.decision, b.value.decision);
  assert.equal(a.value.evidence.equalThreshold, true);
});

test("39. Cohort above threshold allowed", () => {
  const ctx = buildContext();
  const decision = IA.evaluateSmallCohortSuppression(
    ctx,
    { eligibleCohortCount: 6 },
    policy({ smallCohortThreshold: 5 })
  );
  assert.equal(decision.value.decision, IA.ANALYTICS_ACCESS_DECISION.ALLOW);
});

test("40. Suppressed raw count not leaked", () => {
  const ctx = buildContext();
  const decision = IA.evaluateSmallCohortSuppression(
    ctx,
    { eligibleCohortCount: 2 },
    policy()
  );
  const json = JSON.stringify(decision.value);
  assert.equal(json.includes("eligibleCohortCount"), false);
  assert.equal(json.includes('"cohortCount"'), false);
  assert.equal(decision.value.evidence.eligibleCount, undefined);
});

test("41. Threshold comes from policy", () => {
  const ctx = buildContext();
  const decision = IA.evaluateSmallCohortSuppression(
    ctx,
    { eligibleCohortCount: 3 },
    policy({ policyId: "threshold-policy", policyVersion: "2.1.0", smallCohortThreshold: 10 })
  );
  assert.equal(decision.value.privacyPolicy.policyId, "threshold-policy");
  assert.equal(decision.value.privacyPolicy.policyVersion, "2.1.0");
  assert.equal(decision.value.evidence.thresholdConfigured, true);
});

test("42. Same input/policy same decision", () => {
  const ctx = buildContext();
  const input = { eligibleCohortCount: 2, metricId: "m1" };
  const pol = policy();
  const a = IA.evaluateSmallCohortSuppression(ctx, input, pol, {
    evaluatedAt: FIXED_NOW,
  });
  const b = IA.evaluateSmallCohortSuppression(ctx, input, pol, {
    evaluatedAt: FIXED_NOW,
  });
  assert.deepEqual(a.value, b.value);
});

test("43. Redacted original value not exposed", () => {
  const ctx = buildContext();
  const result = IA.evaluateRedactionAndOmission(
    ctx,
    { displayLabel: "Alice Secret" },
    policy()
  );
  const json = JSON.stringify(result.value);
  assert.equal(json.includes("Alice Secret"), false);
  assert.equal(result.value.payload.displayLabel, "[REDACTED]");
});

test("44. Omitted field absent", () => {
  const ctx = buildContext();
  const result = IA.evaluateRedactionAndOmission(
    ctx,
    { internalNote: "n", keep: true },
    policy()
  );
  assert.equal("internalNote" in result.value.payload, false);
  assert.equal(result.value.payload.keep, true);
});

test("45. Redaction provenance preserved", () => {
  const ctx = buildContext();
  const result = IA.evaluateRedactionAndOmission(
    ctx,
    { displayLabel: "x" },
    policy()
  );
  assert.equal(result.value.provenance.policyId, "ia-11-cert-policy");
  assert.equal(result.value.provenance.policyVersion, "1.0.0");
});

test("46. Error sanitizer removes email", () => {
  const result = IA.sanitizePrivacySafeError({
    code: "X",
    message: "failed for user@example.com",
  });
  assert.equal(result.value.message.includes("user@example.com"), false);
  assert.ok(result.value.message.includes("[REDACTED_EMAIL]"));
});

test("47. Error sanitizer removes phone", () => {
  const result = IA.sanitizePrivacySafeError({
    code: "X",
    message: "call +1 555 123 4567 now",
  });
  assert.equal(result.value.message.includes("555 123 4567"), false);
});

test("48. Error sanitizer removes financial credential", () => {
  const result = IA.sanitizePrivacySafeError({
    code: "X",
    message: "card 4111 1111 1111 1111 cvv:123 rejected",
  });
  assert.equal(result.value.message.includes("4111"), false);
  assert.ok(result.value.message.includes("[REDACTED"));
});

test("49. Error sanitizer removes raw fact object", () => {
  const result = IA.sanitizePrivacySafeError({
    code: "X",
    message: "fact failed",
    details: {
      fact: { email: "a@b.com", value: 99 },
      reasonCode: "TENANT_MISMATCH",
    },
  });
  assert.equal(result.value.details.fact, undefined);
  assert.equal(result.value.details.reasonCode, "TENANT_MISMATCH");
});

test("50. Safe error code preserved", () => {
  const result = IA.sanitizePrivacySafeError({
    code: IA.ANALYTICS_ERROR_CODE.PRIVACY_ACCESS_DENIED,
    message: "denied",
  });
  assert.equal(
    result.value.code,
    IA.ANALYTICS_ERROR_CODE.PRIVACY_ACCESS_DENIED
  );
});

test("51. Historical denied dimension not grouped", () => {
  const ctx = buildContext();
  const result = IA.projectHistoricalResultPrivacy(ctx, {
    groupBy: [
      { dimensionId: "day", classification: IA.ANALYTICS_DATA_CLASSIFICATION.PUBLIC },
      {
        dimensionId: "playerId",
        classification: IA.ANALYTICS_DATA_CLASSIFICATION.SENSITIVE_PERSONAL,
      },
    ],
    series: [
      {
        tenantId: TENANT,
        bucketStart: "2026-07-01",
        value: 1,
        dimensions: { day: "2026-07-01", playerId: "p1" },
      },
    ],
  });
  assert.equal(result.ok, true);
  assert.ok(result.value.deniedGroupDimensions.includes("playerId"));
  assert.equal(result.value.buckets[0].dimensions.playerId, undefined);
});

test("52. Historical suppression persists by bucket", () => {
  const ctx = buildContext();
  const result = IA.projectHistoricalResultPrivacy(
    ctx,
    {
      series: [
        {
          tenantId: TENANT,
          bucketStart: "2026-07-01",
          value: 3,
          eligibleCohortCount: 2,
        },
        {
          tenantId: TENANT,
          bucketStart: "2026-07-02",
          value: 9,
          eligibleCohortCount: 2,
        },
      ],
    },
    { policy: policy() }
  );
  assert.equal(result.ok, true);
  assert.equal(result.value.buckets[0].privacyState, IA.ANALYTICS_PRIVACY_PAYLOAD_STATE.SUPPRESSED);
  assert.equal(result.value.buckets[1].privacyState, IA.ANALYTICS_PRIVACY_PAYLOAD_STATE.SUPPRESSED);
  assert.equal(result.value.buckets[0].value.isZero, false);
});

test("53. Dashboard restricted widget handled explicitly", () => {
  const ctx = buildContext();
  const result = IA.projectDashboardReportPrivacy(ctx, {
    widgets: [
      { tenantId: TENANT, widgetId: "w-restricted", restricted: true },
    ],
  });
  assert.equal(result.ok, true);
  assert.equal(result.value.widgets[0].privacyState, IA.ANALYTICS_PRIVACY_PAYLOAD_STATE.OMITTED);
  assert.equal(result.value.widgets[0].handledExplicitly, true);
});

test("54. Dashboard denied state not empty state", () => {
  const ctx = buildContext({ metricGrants: [] });
  const result = IA.projectDashboardReportPrivacy(ctx, {
    widgets: [
      {
        tenantId: TENANT,
        widgetId: "w1",
        metricId: "metric.restricted.secret",
        classification: IA.ANALYTICS_DATA_CLASSIFICATION.RESTRICTED,
      },
    ],
  });
  assert.equal(result.ok, true);
  assert.equal(result.value.widgets[0].privacyState, IA.ANALYTICS_PRIVACY_PAYLOAD_STATE.DENIED);
  assert.equal(result.value.widgets[0].isEmpty, false);
  assert.notEqual(
    result.value.widgets[0].dataState,
    IA.ANALYTICS_PRIVACY_PAYLOAD_STATE.EMPTY
  );
});

test("55. Dashboard suppressed state not zero", () => {
  const ctx = buildContext();
  const result = IA.projectDashboardReportPrivacy(
    ctx,
    {
      widgets: [
        {
          tenantId: TENANT,
          widgetId: "w1",
          metricId: "metric.public.count",
          classification: IA.ANALYTICS_DATA_CLASSIFICATION.PUBLIC,
          eligibleCohortCount: 1,
          value: 1,
        },
      ],
    },
    { policy: policy() }
  );
  assert.equal(result.ok, true);
  assert.equal(
    result.value.widgets[0].privacyState,
    IA.ANALYTICS_PRIVACY_PAYLOAD_STATE.SUPPRESSED
  );
  assert.equal(result.value.widgets[0].isZero, false);
});

test("56. Report export metadata respects access", () => {
  const ctx = buildContext();
  const result = IA.projectDashboardReportPrivacy(ctx, {
    widgets: [{ tenantId: TENANT, widgetId: "w1", value: 1 }],
    exportMetadata: { includeRestricted: true, format: "CSV" },
  });
  assert.equal(result.ok, true);
  assert.equal(result.value.exportMetadata.includeRestricted, false);
  assert.equal(result.value.exportMetadata.accessPolicyRespected, true);
});

test("57. Alert denied metric cannot create success insight", () => {
  const ctx = buildContext({ metricGrants: [] });
  const result = IA.projectAlertInsightPrivacy(ctx, {
    tenantId: TENANT,
    kind: "insight",
    insight: true,
    metricId: "metric.restricted.secret",
    classification: IA.ANALYTICS_DATA_CLASSIFICATION.RESTRICTED,
  });
  assert.equal(result.ok, true);
  assert.equal(result.value.success, false);
  assert.equal(result.value.insightCreated, false);
});

test("58. Alert evidence does not leak raw values", () => {
  const ctx = buildContext();
  const result = IA.projectAlertInsightPrivacy(ctx, {
    tenantId: TENANT,
    alertId: "a1",
    metricId: "metric.ops.insight",
    classification: IA.ANALYTICS_DATA_CLASSIFICATION.PRIVILEGED_OPERATIONAL,
    evidence: { rawValue: 42, reason: "threshold" },
  });
  assert.equal(result.ok, true);
  assert.equal(result.value.evidence.rawValue, undefined);
  assert.equal(result.value.evidence.reason, "threshold");
});

test("59. Suppressed metric alert does not leak threshold count", () => {
  const ctx = buildContext();
  const result = IA.projectAlertInsightPrivacy(
    ctx,
    {
      tenantId: TENANT,
      alertId: "a2",
      metricId: "metric.public.count",
      classification: IA.ANALYTICS_DATA_CLASSIFICATION.PUBLIC,
      eligibleCohortCount: 1,
    },
    { policy: policy() }
  );
  assert.equal(result.ok, true);
  assert.equal(result.value.privacyState, IA.ANALYTICS_PRIVACY_PAYLOAD_STATE.SUPPRESSED);
  const json = JSON.stringify(result.value);
  assert.equal(json.includes("eligibleCohortCount"), false);
  assert.equal(json.includes('"1"'), false);
});

test("60. Sensitive finance metric requires matching grant", () => {
  const ctx = buildContext({
    metricGrants: [],
    maxClassification: IA.ANALYTICS_DATA_CLASSIFICATION.SENSITIVE_FINANCIAL,
  });
  const denied = IA.evaluateMetricAccess(ctx, {
    metricId: "metric.finance.revenue",
    metricVersion: "1.0.0",
    classification: IA.ANALYTICS_DATA_CLASSIFICATION.SENSITIVE_FINANCIAL,
  });
  assert.equal(denied.value.decision, IA.ANALYTICS_ACCESS_DECISION.DENY);

  const ctxGranted = buildContext();
  const allowed = IA.evaluateMetricAccess(ctxGranted, {
    metricId: "metric.finance.revenue",
    metricVersion: "1.0.0",
    classification: IA.ANALYTICS_DATA_CLASSIFICATION.SENSITIVE_FINANCIAL,
  });
  assert.equal(allowed.value.decision, IA.ANALYTICS_ACCESS_DECISION.ALLOW);
});

test("61. Customer/player privacy classifications enforced", () => {
  const ctx = buildContext();
  const allowed = IA.evaluateMetricAccess(ctx, {
    metricId: "metric.customer.activity",
    classification: IA.ANALYTICS_DATA_CLASSIFICATION.SENSITIVE_PERSONAL,
  });
  assert.equal(allowed.value.decision, IA.ANALYTICS_ACCESS_DECISION.ALLOW);

  const denied = IA.evaluateMetricAccess(ctx, {
    metricId: "metric.customer.private",
    classification: IA.ANALYTICS_DATA_CLASSIFICATION.SENSITIVE_PERSONAL,
  });
  assert.equal(denied.value.decision, IA.ANALYTICS_ACCESS_DECISION.DENY);
});

test("62. Ranking/rating privacy classifications enforced", () => {
  const ctx = buildContext();
  assert.equal(
    IA.evaluateMetricAccess(ctx, {
      metricId: "metric.ranking.position",
      classification: IA.ANALYTICS_DATA_CLASSIFICATION.RESTRICTED,
    }).value.decision,
    IA.ANALYTICS_ACCESS_DECISION.ALLOW
  );
  assert.equal(
    IA.evaluateMetricAccess(ctx, {
      metricId: "metric.rating.snapshot",
      classification: IA.ANALYTICS_DATA_CLASSIFICATION.RESTRICTED,
    }).value.decision,
    IA.ANALYTICS_ACCESS_DECISION.ALLOW
  );
  assert.equal(
    IA.evaluateMetricAccess(ctx, {
      metricId: "metric.ranking.other",
      classification: IA.ANALYTICS_DATA_CLASSIFICATION.RESTRICTED,
    }).value.decision,
    IA.ANALYTICS_ACCESS_DECISION.DENY
  );
});

test("63. Competition analytics scope remains isolated", () => {
  const ctx = buildContext();
  const okResult = IA.certifyEntityIsolation(
    ctx,
    { competitionId: "comp-1" },
    [{ tenantId: TENANT, competitionId: "comp-1" }],
    { surface: "competition" }
  );
  assert.equal(okResult.ok, true);
  const bad = IA.certifyEntityIsolation(
    ctx,
    { competitionId: "comp-1" },
    [{ tenantId: TENANT, competitionId: "comp-x" }],
    { surface: "competition" }
  );
  assert.equal(bad.ok, false);
});

test("64. Venue/court/club analytics scope remains isolated", () => {
  const ctx = buildContext();
  for (const [field, id] of [
    ["venueId", "v1"],
    ["courtId", "c1"],
    ["clubId", "cl1"],
  ]) {
    assert.equal(
      IA.certifyEntityIsolation(
        ctx,
        { [field]: id },
        [{ tenantId: TENANT, [field]: id }],
        { surface: "venue-court-club" }
      ).ok,
      true
    );
  }
});

test("65. Operational insight scope remains isolated", () => {
  const ctx = buildContext();
  const result = IA.projectAlertInsightPrivacy(ctx, {
    tenantId: TENANT,
    alertId: "ops-1",
    metricId: "metric.ops.insight",
    classification: IA.ANALYTICS_DATA_CLASSIFICATION.PRIVILEGED_OPERATIONAL,
    severity: "HIGH",
  });
  assert.equal(result.ok, true);
  assert.equal(result.value.success, true);
  assert.equal(result.value.isCanonicalAuthorizationState, false);
});

test("66. Access evaluator is read-only", () => {
  const ctx = buildContext();
  const before = JSON.stringify(ctx);
  IA.evaluateMetricAccess(ctx, {
    metricId: "metric.public.count",
    classification: IA.ANALYTICS_DATA_CLASSIFICATION.PUBLIC,
  });
  assert.equal(JSON.stringify(ctx), before);
});

test("67. Certification facade exposes no write method", () => {
  const facadeResult = IA.createReadOnlyPrivacyAccessCertificationFacade();
  assert.equal(facadeResult.ok, true);
  const facade = facadeResult.value;
  assert.equal(Object.keys(facade).includes("write"), false);
  assert.equal(Object.keys(facade).includes("assignRole"), false);
  for (const op of ["write", "save", "assignRole", "grantPermission", "persist"]) {
    const rejected = facade[op]();
    assert.equal(rejected.ok, false, op);
    assert.equal(
      rejected.error.code,
      IA.ANALYTICS_ERROR_CODE.PRIVACY_FACADE_WRITE_REJECTED,
      op
    );
  }
});

test("68. Invalid request does not invoke source", () => {
  let invoked = false;
  const source = {
    load() {
      invoked = true;
      return { ok: true, value: policy() };
    },
  };
  const facade = IA.createPrivacyAccessCertificationFacade({
    policySource: source,
  }).value;
  const result = facade.certify(
    { trustedSource: false, tenantId: TENANT },
    { kind: "metric", metricRef: { metricId: "m1", classification: "PUBLIC" } }
  );
  assert.equal(result.ok, false);
  assert.equal(invoked, false);
});

test("69. Policy source failure wrapped safely", () => {
  const sourceResult = IA.createInMemoryPrivacyPolicySource({
    failMode: "failure",
  });
  assert.equal(sourceResult.ok, true);
  const loaded = sourceResult.value.load({
    policyId: "p",
    policyVersion: "1.0.0",
  });
  assert.equal(loaded.ok, false);
  assert.equal(
    loaded.error.code,
    IA.ANALYTICS_ERROR_CODE.PRIVACY_POLICY_SOURCE_FAILURE
  );
});

test("70-73. Architecture import boundaries", () => {
  const files = listJsFiles(PRIVACY_ROOT);
  assert.ok(files.length > 0);
  for (const file of files) {
    const text = readFileSync(file, "utf8");
    assert.equal(/from ['"]react['"]/.test(text), false, file);
    assert.equal(/from ['"]@mui\//.test(text), false, file);
    assert.equal(/supabase/i.test(text), false, file);
    assert.equal(/src\/core\/platform/.test(text), false, file);
    assert.equal(/features\/(customer|player|finance|competition)\//.test(text), false, file);
    assert.equal(/localStorage/.test(text), false, file);
  }
});

test("74. No global singleton", () => {
  const a = IA.createPrivacyAccessCertificationFacade().value;
  const b = IA.createPrivacyAccessCertificationFacade().value;
  assert.notEqual(a, b);
});

test("75-76. No auth token or PII in fixtures/docs", () => {
  const docs = readFileSync(
    join(__dirname, "../docs/intelligence-analytics/ia-11/00_ARCHITECTURE_AND_CERTIFICATION.md"),
    "utf8"
  );
  assert.equal(/Bearer |eyJ[a-zA-Z0-9_-]+\.|password\s*=/.test(docs), false);
  assert.equal(/user@example\.com|\+1-555/.test(docs), false);
  const thisFile = readFileSync(fileURLToPath(import.meta.url), "utf8");
  // Sanitizer tests intentionally include patterns inside string literals for redaction proofs.
  assert.equal(/accessToken\s*:/.test(thisFile), false);
});

test("77. Same certification scenario same report", () => {
  const suite = {
    reportId: "ia-11-report",
    generatedAt: FIXED_NOW,
    scenarios: [
      {
        scenarioId: "s-pass",
        title: "pass",
        surface: "tenant",
        passed: true,
      },
      {
        scenarioId: "s-fail",
        title: "fail",
        surface: "tenant",
        passed: false,
      },
    ],
  };
  const a = IA.runPrivacyCertificationSuite(suite);
  const b = IA.runPrivacyCertificationSuite(suite);
  assert.equal(a.ok, true);
  assert.deepEqual(a.value, b.value);
});

test("78. Failed scenario represented explicitly", () => {
  const report = IA.runPrivacyCertificationSuite({
    reportId: "ia-11-report-fail",
    generatedAt: FIXED_NOW,
    scenarios: [
      {
        scenarioId: "fail-1",
        title: "explicit fail",
        surface: "metric",
        passed: false,
      },
    ],
  });
  assert.equal(report.ok, true);
  assert.equal(report.value.failedCount, 1);
  assert.deepEqual(report.value.failedScenarioIds, ["fail-1"]);
  assert.equal(report.value.evidence[0].passed, false);
});

test("79. Certification report completeness deterministic", () => {
  const report = IA.createPrivacyCertificationReport({
    reportId: "r1",
    generatedAt: FIXED_NOW,
    evidence: [
      {
        scenarioId: "b",
        passed: true,
        evaluatedAt: FIXED_NOW,
      },
      {
        scenarioId: "a",
        passed: false,
        evaluatedAt: FIXED_NOW,
      },
    ],
  });
  assert.equal(report.ok, true);
  assert.equal(report.value.evidence[0].scenarioId, "a");
  assert.equal(report.value.evidence[1].scenarioId, "b");
  assert.equal(
    report.value.completeness,
    IA.PRIVACY_ACCESS_CERTIFICATION_COMPLETENESS.PARTIAL
  );
});

test("80. Analytics output does not claim canonical authorization state", () => {
  const ctx = buildContext();
  assert.equal(ctx.isCanonicalAuthorizationState, false);
  const projected = IA.projectDashboardReportPrivacy(ctx, {
    widgets: [{ tenantId: TENANT, widgetId: "w1", value: 1 }],
  });
  assert.equal(projected.value.isCanonicalAuthorizationState, false);
});

test("I&A-01 through I&A-10 markers still exported", () => {
  assert.equal(IA.INTELLIGENCE_ANALYTICS_FOUNDATION.workstreamId, "I&A-01");
  assert.equal(IA.INTELLIGENCE_ANALYTICS_METRIC_REGISTRY.workstreamId, "I&A-02");
  assert.equal(IA.INTELLIGENCE_ANALYTICS_QUERY_RUNTIME.workstreamId, "I&A-03");
  assert.equal(IA.INTELLIGENCE_ANALYTICS_DASHBOARD_REPORTING.workstreamId, "I&A-04");
  assert.equal(IA.INTELLIGENCE_ANALYTICS_HISTORICAL_TREND.workstreamId, "I&A-05");
  assert.equal(IA.INTELLIGENCE_ANALYTICS_COMPETITION_ANALYTICS.workstreamId, "I&A-06");
  assert.equal(IA.INTELLIGENCE_ANALYTICS_VENUE_COURT_CLUB_ANALYTICS.workstreamId, "I&A-07");
  assert.equal(IA.INTELLIGENCE_ANALYTICS_CUSTOMER_PLAYER_ANALYTICS.workstreamId, "I&A-08");
  assert.equal(
    IA.INTELLIGENCE_ANALYTICS_FINANCE_RANKING_PERFORMANCE_ANALYTICS.workstreamId,
    "I&A-09"
  );
  assert.equal(
    IA.INTELLIGENCE_ANALYTICS_OPERATIONAL_ALERTS_INSIGHTS.workstreamId,
    "I&A-10"
  );
});
