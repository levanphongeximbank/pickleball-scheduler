#!/usr/bin/env node
/**
 * Operation B1 — preflight (package default: dry validation only).
 * Does not mutate Production. Requires external allowlist path + sha.
 */
import {
  evaluateAuthorization,
  loadAndValidateAllowlistFile,
  evaluateAllowlistEligibility,
  EXPECTED_B1_COUNT,
  EXPECTED_PRODUCTION_PROJECT_REF,
  summarizeIdentity,
} from "./lib/index.js";

function envInput() {
  return {
    DRY_RUN: process.env.DRY_RUN,
    PRODUCTION_PROJECT_REF: process.env.PRODUCTION_PROJECT_REF,
    OPERATION_B1_BATCH_ID: process.env.OPERATION_B1_BATCH_ID,
    ALLOWLIST_PATH: process.env.ALLOWLIST_PATH,
    ALLOWLIST_SHA256: process.env.ALLOWLIST_SHA256,
    OWNER_PRODUCTION_GO: process.env.OWNER_PRODUCTION_GO,
    EXPLICIT_EXECUTE_CONFIRMATION: process.env.EXPLICIT_EXECUTE_CONFIRMATION,
  };
}

export async function runPreflight(input = envInput(), adapters = {}) {
  const auth = evaluateAuthorization({ ...input, DRY_RUN: input.DRY_RUN ?? "true" });
  const report = {
    operation: "OPERATION_B1_PREFLIGHT",
    production_project_ref: EXPECTED_PRODUCTION_PROJECT_REF,
    dryRun: true,
    ok: false,
    authorization: {
      ok: auth.ok,
      reasons: auth.reasons,
    },
    allowlist: null,
    eligibility: null,
    mutationCalls: 0,
  };

  if (!auth.ok) {
    report.failReason = "authorization_or_structural_guards";
    return report;
  }

  const repoRoots = adapters.repoRoots || [
    process.cwd(),
  ];
  const loaded = loadAndValidateAllowlistFile(
    auth.allowlistPath,
    auth.allowlistSha,
    { repoRoots }
  );
  report.allowlist = {
    ok: loaded.ok,
    errors: loaded.errors || [],
    count: loaded.identities?.length || 0,
    expectedCount: EXPECTED_B1_COUNT,
  };
  if (!loaded.ok) {
    report.failReason = "allowlist_validation_failed";
    return report;
  }

  if (typeof adapters.fetchProfile !== "function") {
    // Structural package preflight without live adapters still validates allowlist.
    report.eligibility = {
      ok: true,
      mode: "allowlist_only_no_live_adapters",
      results: loaded.identities.map((row) => ({
        ...summarizeIdentity(row),
        note: "live_eligibility_deferred_to_execution_preflight",
      })),
    };
    report.ok = true;
    return report;
  }

  const eligibility = await evaluateAllowlistEligibility(
    loaded.identities,
    adapters
  );
  report.eligibility = {
    ok: eligibility.ok,
    failedCount: eligibility.failedCount,
    results: eligibility.results.map((r) => ({
      label: r.label,
      ok: r.ok,
      reasons: r.reasons,
      email: r.email ? summarizeIdentity({ expected_email: r.email }).email : null,
    })),
  };
  report.ok = eligibility.ok;
  report.mutationCalls = 0;
  return report;
}

const isMain = process.argv[1] && process.argv[1].replace(/\\/g, "/").endsWith(
  "preflight.mjs"
);
if (isMain) {
  runPreflight()
    .then((report) => {
      console.log(JSON.stringify(report, null, 2));
      process.exit(report.ok ? 0 : 2);
    })
    .catch((err) => {
      console.error(String(err?.message || err));
      process.exit(1);
    });
}
