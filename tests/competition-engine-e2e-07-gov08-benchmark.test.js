/**
 * E2E-07 — GOV-08 benchmark gate tests.
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  GOV08_MVP_LOCAL_BUDGETS,
  computeCertificationFingerprint,
  runGov08PerformanceBenchmark,
} from "../src/features/competition-engine/index.js";

test("gov08 budgets — versioned MVP local thresholds", () => {
  assert.equal(GOV08_MVP_LOCAL_BUDGETS.budgetVersion, "e2e07-gov08-mvp-local-v1");
  assert.equal(GOV08_MVP_LOCAL_BUDGETS.productionSlaClaimForbidden, true);
  assert.deepEqual([...GOV08_MVP_LOCAL_BUDGETS.sizes], [8, 16, 32]);
  assert.equal(GOV08_MVP_LOCAL_BUDGETS.thresholdsMs.poolCompositionMedian[8], 500);
});

test("gov08 benchmark — gate passes locally for 8/16/32", async () => {
  const a = await runGov08PerformanceBenchmark();
  const b = await runGov08PerformanceBenchmark();
  assert.equal(a.ok, true);
  assert.equal(a.performanceResults.regressionDetected, false);
  assert.equal(a.performanceResults.gatePassed, true);
  assert.equal(a.deterministicFingerprint, b.deterministicFingerprint);
  assert.ok(a.performanceResults.environment.nodeVersion);
  assert.ok(a.performanceResults.environment.platform);
  assert.equal("hostname" in a.performanceResults.environment, false);
});

test("gov08 benchmark — wall clock excluded from deterministic fingerprint", async () => {
  const result = await runGov08PerformanceBenchmark();
  const fpPayload = {
    kind: "performance-certification",
    gatePassed: result.ok,
    budgetVersion: GOV08_MVP_LOCAL_BUDGETS.budgetVersion,
  };
  const recomputed = computeCertificationFingerprint(fpPayload);
  assert.notEqual(result.deterministicFingerprint, recomputed);
  const fpStr = JSON.stringify(result.deterministicFingerprint);
  for (const row of result.performanceResults.sizes) {
    assert.equal(fpStr.includes(String(row.poolCompositionMedianMs)), false);
    assert.equal(fpStr.includes(String(row.knockoutCompositionMedianMs)), false);
  }
});
