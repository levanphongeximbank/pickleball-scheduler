#!/usr/bin/env node
/**
 * Operation B1B — live execute entry (WP4).
 * Dry-run default. No Production GO issued in this package.
 * Fresh authorization binding required for live mutation (WP7).
 *
 * PRODUCTION_GO=NO
 * STAGING_APPLY_GO=NO
 */

import {
  evaluateAuthorization,
  mutationAllowed,
  presentLiveAuthority,
  loadAndValidateAllowlistFile,
  verifySnapshotBytes,
  EXPECTED_PRODUCTION_PROJECT_REF,
  EXPECTED_B1B_COUNT,
  runBatchQuarantineB1B,
  RETIRED_OWNER_PRODUCTION_GO,
  RETIRED_OPERATION_B1_BATCH_IDS,
} from "./lib/index.js";

function envInput() {
  return {
    DRY_RUN: process.env.DRY_RUN,
    PRODUCTION_PROJECT_REF: process.env.PRODUCTION_PROJECT_REF,
    OPERATION_B1B_BATCH_ID: process.env.OPERATION_B1B_BATCH_ID,
    ALLOWLIST_PATH: process.env.ALLOWLIST_PATH,
    ALLOWLIST_SHA256: process.env.ALLOWLIST_SHA256,
    RECOVERY_SNAPSHOT_PATH:
      process.env.RECOVERY_SNAPSHOT_PATH || process.env.SNAPSHOT_PATH,
    SNAPSHOT_SHA256:
      process.env.SNAPSHOT_SHA256 || process.env.RECOVERY_SNAPSHOT_SHA256,
    OWNER_PRODUCTION_GO: process.env.OWNER_PRODUCTION_GO,
    EXPLICIT_EXECUTE_CONFIRMATION: process.env.EXPLICIT_EXECUTE_CONFIRMATION,
    freshAuthorizationBinding: null,
  };
}

/**
 * @param {Record<string, unknown>} input
 * @param {{
 *   repoRoots?: string[],
 *   adapters?: object,
 *   freshAuthorizationBinding?: object|null,
 * }} [deps]
 */
export async function runB1BExecute(input = envInput(), deps = {}) {
  const report = {
    operation: "OPERATION_B1B_QA_QUARANTINE_AUTHORITY_EXECUTE",
    production_project_ref: EXPECTED_PRODUCTION_PROJECT_REF,
    ok: false,
    dryRun: true,
    mutationCalls: 0,
    reasons: [],
    authorityConsumed: false,
    newProductionGoIssued: false,
    oldOwnerGoReusable: false,
    oldBatchReusable: false,
    retiredOwnerGo: RETIRED_OWNER_PRODUCTION_GO,
    retiredBatches: [...RETIRED_OPERATION_B1_BATCH_IDS],
    execute: null,
  };

  const merged = {
    ...input,
    freshAuthorizationBinding:
      input.freshAuthorizationBinding ??
      deps.freshAuthorizationBinding ??
      null,
  };

  const auth = evaluateAuthorization(merged);
  report.dryRun = auth.dryRun;
  report.reasons.push(...auth.reasons);

  if (!auth.ok) {
    report.failReason = "authorization_or_structural_guards";
    return report;
  }

  const snap = verifySnapshotBytes(auth.snapshotPath, auth.snapshotSha);
  if (!snap.ok) {
    report.reasons.push(...(snap.reasons || []));
    report.failReason = "recovery_snapshot_required";
    return report;
  }

  const repoRoots = deps.repoRoots || [process.cwd()];
  const loaded = loadAndValidateAllowlistFile(
    auth.allowlistPath,
    auth.allowlistSha,
    { repoRoots }
  );
  if (!loaded.ok) {
    report.reasons.push(...(loaded.errors || []));
    report.failReason = "allowlist_validation_failed";
    return report;
  }
  if (loaded.identities.length !== EXPECTED_B1B_COUNT) {
    report.reasons.push("target_count_not_eight");
    report.failReason = "exact_eight_scope_guard";
    return report;
  }

  let adapters = deps.adapters;
  if (!adapters) {
    if (auth.dryRun || !mutationAllowed(auth)) {
      // Dry-run / unauthorized: no network adapters.
      adapters = createDryRunAdapters(loaded.identities);
    } else {
      report.failReason = "live_adapters_required_via_deps_in_wp4";
      report.reasons.push("live_adapters_not_constructed_without_explicit_injection");
      return report;
    }
  }

  if (mutationAllowed(auth)) {
    const presented = presentLiveAuthority(auth);
    report.authorityConsumed = presented.consumed === true;
    if (!presented.ok) {
      report.reasons.push(presented.reason);
      report.failReason = presented.reason;
      return report;
    }
  }

  const batch = await runBatchQuarantineB1B({
    identities: loaded.identities,
    adapters,
    authResult: auth,
    batchId: auth.batchId,
    allowlistSha256: auth.allowlistSha,
    snapshotSha256: auth.snapshotSha,
  });

  report.execute = {
    ok: batch.ok,
    dryRun: batch.dryRun,
    mutationCalls: batch.mutationCalls,
    integrityIncident: batch.integrityIncident,
    profileStatusWriterPresent: batch.profileStatusWriterPresent,
    results: batch.results,
    callLog: batch.callLog,
  };
  report.mutationCalls = batch.mutationCalls || 0;
  report.ok = batch.ok;
  if (!batch.ok) {
    report.failReason = batch.integrityIncident
      ? "integrity_incident"
      : "execute_failed";
  }
  return report;
}

function createDryRunAdapters(identities) {
  const byId = new Map(identities.map((r) => [r.profile_id, r]));
  return {
    emailOverrides: Object.fromEntries(
      identities.map((r) => [r.auth_user_id, r.expected_email])
    ),
    fetchAuthUser: async (id) => {
      const row = byId.get(id);
      return row
        ? { id: row.auth_user_id, email: row.expected_email, banned_until: null }
        : null;
    },
    fetchProfile: async (id) => {
      const row = byId.get(id);
      return row
        ? {
            id: row.profile_id,
            email: row.expected_email,
            status: row.profile_status,
          }
        : null;
    },
    fetchReferenceCounts: async (id) => byId.get(id)?.reference_counts || {},
    fetchAuthBanState: async (id) => byId.get(id)?.auth_banned === true,
  };
}

const isMain =
  process.argv[1] &&
  process.argv[1].replace(/\\/g, "/").endsWith("execute.mjs");
if (isMain) {
  runB1BExecute()
    .then((report) => {
      console.log(JSON.stringify(report, null, 2));
      process.exit(report.ok ? 0 : 2);
    })
    .catch((err) => {
      console.error(String(err?.message || err));
      process.exit(1);
    });
}
