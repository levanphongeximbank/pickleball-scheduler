import test from "node:test";
import assert from "node:assert/strict";

import {
  RUNTIME_AUTHORITY_MATRIX,
  RUNTIME_AUTHORITY_DOMAIN_COUNT,
  listRuntimeAuthorityDomains,
  getRuntimeAuthorityEntry,
  HARD_CUTOVER_FLAG,
} from "../src/features/platform-hard-cutover/runtimeAuthorityMatrix.js";
import {
  assertCoachingLegacyAuthorityAllowed,
  assertMessagingDemoAuthorityAllowed,
  assertDashboardAnalyticsMockAllowed,
  assertDashboardAnalyticsLocalStorageAllowed,
  assertBillingLocalAuthorityAllowed,
  assertFinanceLocalStorageAuthorityAllowed,
  assertFinanceDemoClubFallbackAllowed,
  assertCrmLocalStorageAuthorityAllowed,
  assertCrmDemoClubFallbackAllowed,
  LEGACY_AUTHORITY_ERROR,
} from "../src/features/platform-hard-cutover/legacyAuthorityPolicy.js";

const REQUIRED_EXPANDED_DOMAINS = [
  "identity_auth",
  "rbac_catalog",
  "tenant_binding",
  "club_governance",
  "customer",
  "finance",
  "crm",
  "reporting",
  "coaching",
  "vpr_ranking",
  "notifications",
  "team_tournament",
  "referee",
  "public_catalog",
  "billing_subscription",
  "marketplace",
  "messaging",
  "ai_assistant",
  "dashboard_analytics",
];

const REQUIRED_FIELDS = [
  "domain",
  "productionAdapter",
  "canonicalReader",
  "canonicalWriter",
  "forbiddenFallback",
  "expectedBackend",
  "failClosedError",
  "reseedRequirement",
  "stagingAcceptanceTest",
  "productionReadiness",
  "verificationTest",
];

test("pre-staging: matrix expanded beyond original 7 domains", () => {
  assert.ok(RUNTIME_AUTHORITY_DOMAIN_COUNT >= 26);
  assert.equal(RUNTIME_AUTHORITY_MATRIX.length, RUNTIME_AUTHORITY_DOMAIN_COUNT);
  assert.equal(new Set(listRuntimeAuthorityDomains()).size, RUNTIME_AUTHORITY_DOMAIN_COUNT);
});

test("pre-staging: required expanded domains present with full contracts", () => {
  for (const domain of REQUIRED_EXPANDED_DOMAINS) {
    const row = getRuntimeAuthorityEntry(domain);
    assert.ok(row, `missing domain ${domain}`);
    for (const field of REQUIRED_FIELDS) {
      assert.ok(row[field] != null && row[field] !== "", `${domain}.${field}`);
    }
    assert.ok(Array.isArray(row.forbiddenFallback));
    assert.ok(row.forbiddenFallback.length >= 1);
  }
});

test("pre-staging: every matrix row has expanded contract fields", () => {
  for (const row of RUNTIME_AUTHORITY_MATRIX) {
    for (const field of REQUIRED_FIELDS) {
      assert.ok(row[field] != null && row[field] !== "", `${row.domain}.${field}`);
    }
  }
});

test("pre-staging: coaching/messaging/dashboard/billing/finance/crm legacy asserts under HC", () => {
  const env = { [HARD_CUTOVER_FLAG]: "true" };
  assert.equal(assertCoachingLegacyAuthorityAllowed(env).ok, false);
  assert.equal(
    assertCoachingLegacyAuthorityAllowed(env).code,
    LEGACY_AUTHORITY_ERROR.COACHING_LOCALSTORAGE_AUTHORITY_FORBIDDEN
  );
  assert.equal(assertMessagingDemoAuthorityAllowed(env).ok, false);
  assert.equal(
    assertMessagingDemoAuthorityAllowed(env).code,
    LEGACY_AUTHORITY_ERROR.MESSAGING_DEMO_AUTHORITY_FORBIDDEN
  );
  assert.equal(assertDashboardAnalyticsMockAllowed(env).ok, false);
  assert.equal(assertDashboardAnalyticsLocalStorageAllowed(env).ok, false);
  assert.equal(assertBillingLocalAuthorityAllowed(env).ok, false);
  assert.equal(
    assertBillingLocalAuthorityAllowed(env).code,
    LEGACY_AUTHORITY_ERROR.BILLING_LOCALSTORAGE_AUTHORITY_FORBIDDEN
  );
  assert.equal(assertFinanceLocalStorageAuthorityAllowed(env).ok, false);
  assert.equal(
    assertFinanceLocalStorageAuthorityAllowed(env).code,
    LEGACY_AUTHORITY_ERROR.FINANCE_LOCALSTORAGE_AUTHORITY_FORBIDDEN
  );
  assert.equal(assertCrmLocalStorageAuthorityAllowed(env).ok, false);
  assert.equal(
    assertCrmLocalStorageAuthorityAllowed(env).code,
    LEGACY_AUTHORITY_ERROR.CRM_LOCALSTORAGE_AUTHORITY_FORBIDDEN
  );
  assert.equal(assertFinanceDemoClubFallbackAllowed("demo-club", env).ok, false);
  assert.equal(assertCrmDemoClubFallbackAllowed("demo-club", env).ok, false);
});

test("pre-staging: legacy asserts open when hard cutover off", () => {
  const env = { [HARD_CUTOVER_FLAG]: "false" };
  assert.equal(assertCoachingLegacyAuthorityAllowed(env).ok, true);
  assert.equal(assertMessagingDemoAuthorityAllowed(env).ok, true);
  assert.equal(assertDashboardAnalyticsMockAllowed(env).ok, true);
  assert.equal(assertDashboardAnalyticsLocalStorageAllowed(env).ok, true);
  assert.equal(assertBillingLocalAuthorityAllowed(env).ok, true);
  assert.equal(assertFinanceLocalStorageAuthorityAllowed(env).ok, true);
  assert.equal(assertCrmLocalStorageAuthorityAllowed(env).ok, true);
});
