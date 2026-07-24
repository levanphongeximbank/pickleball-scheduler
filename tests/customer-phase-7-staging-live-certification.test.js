/**
 * CUSTOMER-07 — Staging apply & live integration certification (static + gates).
 * No Production credentials. Live apply is a separate gated script.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import * as Customer from "../src/features/customer/index.js";
import * as Staging from "../src/features/customer/staging/index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

test("CUSTOMER-07 staging module exports gate helpers without secrets", () => {
  assert.equal(Staging.CUSTOMER_07_STAGING_PROJECT_REF, "qyewbxjsiiyufanzcjcq");
  assert.ok(
    Staging.CUSTOMER_07_PRODUCTION_PROJECT_REF_BLOCKLIST.includes(
      "expuvcohlcjzvrrauvud"
    )
  );
  assert.equal(typeof Staging.evaluateCustomer07PreWriteGates, "function");
  assert.equal(typeof Staging.verifyCustomer07MigrationManifest, "function");
  assert.equal(typeof Staging.createSupabaseCustomerDatabaseClient, "function");
  assert.equal(Staging.CUSTOMER_07_TEST_PREFIX, "CUSTOMER07_TEST_");
});

test("migration manifest pins CUSTOMER-03→06 in order with matching SHA", () => {
  const verify = Staging.verifyCustomer07MigrationManifest({ repoRoot: root });
  assert.equal(verify.ok, true, (verify.errors || []).join(" | "));
  assert.equal(verify.checked, 24);
  const manifest = Staging.loadCustomer07MigrationManifest(root);
  assert.equal(manifest.environmentTarget, "staging");
  assert.equal(manifest.productionApplyApproved, false);
  const phases = manifest.migrations.map((m) => m.phase);
  assert.deepEqual([...new Set(phases)].sort((a, b) => a - b), [3, 4, 5, 6, 7]);
  for (let i = 1; i < manifest.migrations.length; i += 1) {
    assert.ok(
      manifest.migrations[i].phase >= manifest.migrations[i - 1].phase
    );
  }
});

test("rollback and soft-disable scripts exist for CUSTOMER-03→06", () => {
  for (const rel of Staging.CUSTOMER_07_ROLLBACK_PATHS) {
    assert.equal(existsSync(path.join(root, rel)), true, rel);
  }
});

test("static migration audit: no USING(true), no anon grants, no auth write grants", () => {
  const dirs = [3, 4, 5, 6].map((n) =>
    path.join(root, `docs/customer-management/phase-${n}`)
  );
  for (const dir of dirs) {
    for (const name of readdirSync(dir)) {
      if (!name.endsWith(".sql")) continue;
      if (/90_|99_/.test(name)) continue;
      const sql = readFileSync(path.join(dir, name), "utf8");
      assert.doesNotMatch(sql, /USING\s*\(\s*true\s*\)/i, name);
      assert.doesNotMatch(sql, /TO\s+anon\b/i, name);
      assert.doesNotMatch(
        sql,
        /GRANT\s+(INSERT|UPDATE|DELETE)[\s\S]{0,120}TO\s+authenticated/i,
        name
      );
      if (/30_.*_RLS\.sql$/i.test(name)) {
        assert.doesNotMatch(sql, /FOR\s+INSERT/i, name);
        assert.doesNotMatch(sql, /FOR\s+UPDATE/i, name);
        assert.doesNotMatch(sql, /FOR\s+DELETE/i, name);
      }
    }
  }
});

test("environment identity gate fails closed without staging URL", () => {
  const identity = Staging.inspectCustomer07EnvironmentIdentity({});
  assert.equal(identity.ok, false);
  assert.equal(identity.urlValuePrinted, false);
});

test("environment identity gate rejects Production ref", () => {
  const identity = Staging.inspectCustomer07EnvironmentIdentity({
    STAGING_SUPABASE_URL: "https://expuvcohlcjzvrrauvud.supabase.co",
  });
  assert.equal(identity.ok, false);
  assert.equal(identity.containsProductionRef, true);
});

test("environment identity gate accepts Staging allowlist", () => {
  const identity = Staging.inspectCustomer07EnvironmentIdentity({
    STAGING_SUPABASE_URL: "https://qyewbxjsiiyufanzcjcq.supabase.co",
    STAGING_SUPABASE_SERVICE_ROLE_KEY: "staging-service-role-placeholder",
  });
  assert.equal(identity.ok, true);
  assert.equal(identity.projectRefHint, "qyewbxjsiiyufanzcjcq");
});

test("backup gate requires queried state or Owner evidence", () => {
  const blocked = Staging.evaluateCustomer07BackupRollbackGate({
    repoRoot: root,
    env: {},
    preApplyObjectState: null,
  });
  assert.equal(blocked.ok, false);

  const firstApply = Staging.evaluateCustomer07BackupRollbackGate({
    repoRoot: root,
    env: {},
    preApplyObjectState: {
      queried: true,
      customerTablesPresent: false,
      customerRowCount: 0,
      nonTestCustomerRowCount: 0,
      importantDataPresent: false,
    },
  });
  assert.equal(firstApply.ok, true);

  const importantWithoutBackup = Staging.evaluateCustomer07BackupRollbackGate({
    repoRoot: root,
    env: {},
    preApplyObjectState: {
      queried: true,
      customerTablesPresent: true,
      customerRowCount: 5,
      nonTestCustomerRowCount: 5,
      importantDataPresent: true,
    },
  });
  assert.equal(importantWithoutBackup.ok, false);
});

test("Production memory runtime remains rejected", () => {
  assert.throws(
    () =>
      Customer.createCustomerRuntime({
        enabled: true,
        mode: Customer.CUSTOMER_RUNTIME_MODE.MEMORY,
        environment: Customer.CUSTOMER_RUNTIME_ENVIRONMENT.PRODUCTION,
      }),
    (err) => err instanceof Customer.CustomerError
  );
});

test("durable runtime without db fail-closed", () => {
  assert.throws(
    () =>
      Customer.createCustomerRuntime({
        enabled: true,
        mode: Customer.CUSTOMER_RUNTIME_MODE.DURABLE,
        environment: Customer.CUSTOMER_RUNTIME_ENVIRONMENT.STAGING,
      }),
    (err) =>
      err instanceof Customer.CustomerError &&
      err.code === Customer.CUSTOMER_ERROR_CODES.RUNTIME_NOT_CONFIGURED
  );
});

test("safety baseline hard checks include CRM stash markers and CUSTOMER-06 ancestry", () => {
  const safety = Staging.evaluateCustomer07SafetyBaseline({ repoRoot: root });
  assert.equal(safety.facts.customer06InHistory, true);
  assert.equal(safety.facts.crmSafetyStashPresent, true);
  assert.equal(safety.facts.packageJsonUnchanged, true);
  assert.equal(safety.facts.lockfileUnchanged, true);
  assert.equal(
    safety.facts.branch,
    "feature/customer-management-phase-7-staging-live-certification"
  );
});

test("phase-7 docs and scripts exist", () => {
  const required = [
    "docs/customer-management/phase-7/staging-migration-manifest.json",
    "docs/customer-management/phase-7/90_CUSTOMER_07_SOFT_DISABLE.sql",
    "docs/customer-management/phase-7/99_CUSTOMER_07_LIVE_VERIFICATION.sql",
    "docs/customer-management/phase-7/15_PRE_APPLY_OBJECT_STATE_CHECK.sql",
    "scripts/customer/phase-7-staging-preflight.mjs",
    "scripts/customer/phase-7-staging-apply.mjs",
    "scripts/customer/phase-7-staging-live-certify.mjs",
    "scripts/customer/phase-7-staging-cleanup.mjs",
  ];
  for (const rel of required) {
    assert.equal(existsSync(path.join(root, rel)), true, rel);
  }
});
