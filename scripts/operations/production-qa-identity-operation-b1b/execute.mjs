#!/usr/bin/env node
/**
 * Operation B1B — live execute entry (WP4 + WP6A staging rehearsal mode).
 * Dry-run default. No Production GO issued in this package.
 * Fresh authorization binding required for live mutation (WP7 / Staging Owner GO).
 *
 * PRODUCTION_GO=NO
 * STAGING_APPLY_GO=NO
 *
 * Staging rehearsal requires explicit:
 *   OPERATION_TARGET_MODE=staging_rehearsal
 * Never auto-detect from URL / env project fallback.
 */

import {
  evaluateAuthorization,
  mutationAllowed,
  presentLiveAuthority,
  loadAndValidateAllowlistFile,
  verifySnapshotBytes,
  EXPECTED_PRODUCTION_PROJECT_REF,
  EXPECTED_STAGING_PROJECT_REF,
  EXPECTED_B1B_COUNT,
  OPERATION_TARGET_MODE,
  runBatchQuarantineB1B,
  RETIRED_OWNER_PRODUCTION_GO,
  RETIRED_OPERATION_B1_BATCH_IDS,
  hashExactEightUuidSet,
  buildPrepareContractBindings,
} from "./lib/index.js";

function envInput() {
  return {
    DRY_RUN: process.env.DRY_RUN,
    OPERATION_TARGET_MODE: process.env.OPERATION_TARGET_MODE,
    PRODUCTION_PROJECT_REF: process.env.PRODUCTION_PROJECT_REF,
    STAGING_PROJECT_REF: process.env.STAGING_PROJECT_REF,
    TARGET_PROJECT_REF: process.env.TARGET_PROJECT_REF,
    OPERATION_B1B_BATCH_ID: process.env.OPERATION_B1B_BATCH_ID,
    ALLOWLIST_PATH: process.env.ALLOWLIST_PATH,
    ALLOWLIST_SHA256: process.env.ALLOWLIST_SHA256,
    RECOVERY_SNAPSHOT_PATH:
      process.env.RECOVERY_SNAPSHOT_PATH || process.env.SNAPSHOT_PATH,
    SNAPSHOT_SHA256:
      process.env.SNAPSHOT_SHA256 || process.env.RECOVERY_SNAPSHOT_SHA256,
    OWNER_PRODUCTION_GO: process.env.OWNER_PRODUCTION_GO,
    OWNER_STAGING_GO: process.env.OWNER_STAGING_GO,
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
 *   claimOneTimeLiveAuthority?: Function,
 *   executionVersion?: string|null,
 * }} [deps]
 */
export async function runB1BExecute(input = envInput(), deps = {}) {
  const report = {
    operation: "OPERATION_B1B_QA_QUARANTINE_AUTHORITY_EXECUTE",
    production_project_ref: EXPECTED_PRODUCTION_PROJECT_REF,
    staging_project_ref: EXPECTED_STAGING_PROJECT_REF,
    operation_target_mode: null,
    ok: false,
    dryRun: true,
    mutationCalls: 0,
    reasons: [],
    authorityConsumed: false,
    durableAuthorityClaimed: false,
    newProductionGoIssued: false,
    newStagingGoIssued: false,
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
  report.operation_target_mode = auth.operationTargetMode;
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
    {
      repoRoots,
      operationTargetMode:
        auth.operationTargetMode || OPERATION_TARGET_MODE.PRODUCTION,
    }
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

  // Exact-eight UUID set hash is attached ONLY after allowlist validation.
  // Durable claim must not run for invalid packages (ordering barrier).
  auth.exactEightUuidSetHash = hashExactEightUuidSet(loaded.identities);
  auth.executionVersion =
    input.executionVersion ??
    deps.executionVersion ??
    input.OPERATION_B1B_EXECUTION_VERSION ??
    null;

  let adapters = deps.adapters;
  if (!adapters) {
    if (auth.dryRun || !mutationAllowed(auth)) {
      adapters = createDryRunAdapters(loaded.identities);
    } else {
      report.failReason = "live_adapters_required_via_deps_in_wp4";
      report.reasons.push(
        "live_adapters_not_constructed_without_explicit_injection"
      );
      return report;
    }
  }

  // READ-ONLY DB label/email + trusted DB environment compatibility gate
  // MUST run before durable claim. Never call qa_quarantine_prepare here.
  if (mutationAllowed(auth)) {
    if (typeof adapters.validateQaPrepareContract !== "function") {
      report.failReason = "prepare_contract_validator_unavailable";
      report.reasons.push("prepare_contract_validator_unavailable");
      return report;
    }
    const compat = await adapters.validateQaPrepareContract({
      bindings: buildPrepareContractBindings(loaded.identities),
    });
    if (!compat?.ok) {
      report.reasons.push(
        compat?.reason || compat?.code || "prepare_contract_incompatible"
      );
      report.failReason = "prepare_contract_preclaim_failed";
      report.authorityConsumed = false;
      report.durableAuthorityClaimed = false;
      report.mutationCalls = 0;
      return report;
    }

    // Layer agreement: runner mode/ref must match trusted DB binding.
    const compatPayload =
      compat.data && typeof compat.data === "object" ? compat.data : compat;
    const dbMode = String(
      compatPayload.operation_target_mode || compatPayload.environment || ""
    )
      .trim()
      .toLowerCase();
    const dbProjectRef = String(compatPayload.project_ref || "").trim();
    const runnerMode = String(auth.operationTargetMode || "")
      .trim()
      .toLowerCase();
    const runnerProjectRef = String(auth.projectRef || "").trim();

    if (!dbMode || dbMode !== runnerMode) {
      report.reasons.push("db_env_runner_mode_mismatch");
      report.failReason = "db_env_runner_mode_mismatch";
      report.authorityConsumed = false;
      report.durableAuthorityClaimed = false;
      report.mutationCalls = 0;
      return report;
    }
    if (!dbProjectRef || dbProjectRef !== runnerProjectRef) {
      report.reasons.push("db_env_runner_project_ref_mismatch");
      report.failReason = "db_env_runner_project_ref_mismatch";
      report.authorityConsumed = false;
      report.durableAuthorityClaimed = false;
      report.mutationCalls = 0;
      return report;
    }
    report.dbEnvRunnerModeMatch = true;
    report.dbEnvRunnerProjectRefMatch = true;
    report.databaseOperationTargetMode = dbMode;
    report.databaseProjectRef = dbProjectRef;

    // Durable claim is the FINAL authorization barrier immediately before live mutation.
    const presented = await presentLiveAuthority(
      auth,
      deps.claimOneTimeLiveAuthority
    );
    report.authorityConsumed = presented.consumed === true;
    report.durableAuthorityClaimed =
      presented.ok === true && presented.durable === true;
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
      console.error(err);
      process.exit(1);
    });
}
