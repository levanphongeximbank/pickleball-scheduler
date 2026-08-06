#!/usr/bin/env node
/**
 * Operation B1 — execute reversible quarantine.
 * Default DRY_RUN=true. Mutation requires exact Owner GO + confirmation.
 * PACKAGE HARDENING PASS: do not supply Owner GO.
 */
import {
  evaluateAuthorization,
  mutationAllowed,
  loadAndValidateAllowlistFile,
  runBatchQuarantine,
  EXPECTED_PRODUCTION_PROJECT_REF,
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

export async function runExecute(input = envInput(), adapters = {}) {
  const auth = evaluateAuthorization(input);
  const report = {
    operation: "OPERATION_B1_EXECUTE",
    production_project_ref: EXPECTED_PRODUCTION_PROJECT_REF,
    dryRun: auth.dryRun,
    authorized: auth.authorized,
    ok: false,
    reasons: auth.reasons,
    mutationCalls: 0,
    results: [],
  };

  if (!auth.ok && auth.dryRun) {
    report.failReason = "structural_guards_failed";
    return report;
  }
  if (!auth.dryRun && !mutationAllowed(auth)) {
    report.failReason = "mutation_blocked_missing_authorization";
    report.mutationCalls = 0;
    return report;
  }

  const loaded = loadAndValidateAllowlistFile(
    auth.allowlistPath,
    auth.allowlistSha,
    { repoRoots: adapters.repoRoots || [process.cwd()] }
  );
  if (!loaded.ok) {
    report.failReason = "allowlist_validation_failed";
    report.allowlistErrors = loaded.errors;
    return report;
  }

  const batch = await runBatchQuarantine({
    identities: loaded.identities,
    adapters,
    authResult: auth,
  });
  report.dryRun = batch.dryRun;
  report.results = batch.results;
  report.mutationCalls = batch.mutationCalls;
  report.hardDelete = batch.hardDelete;
  report.ok = batch.ok;
  return report;
}

const isMain = process.argv[1] && process.argv[1].replace(/\\/g, "/").endsWith(
  "execute-reversible-quarantine.mjs"
);
if (isMain) {
  runExecute()
    .then((report) => {
      console.log(JSON.stringify(report, null, 2));
      process.exit(report.ok ? 0 : 2);
    })
    .catch((err) => {
      console.error(String(err?.message || err));
      process.exit(1);
    });
}
