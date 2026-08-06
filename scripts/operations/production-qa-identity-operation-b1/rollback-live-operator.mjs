#!/usr/bin/env node
/**
 * Operation B1A — approved live operator rollback entry.
 * Requires separate rollback Owner GO (forward GO cannot authorize).
 * Dry-run default. No hard delete / account recreation.
 */
import fs from "node:fs";
import {
  evaluateAuthorization,
  mutationAllowed,
  EXPECTED_PRODUCTION_PROJECT_REF,
} from "./lib/index.js";
import { runRollback } from "./rollback-unquarantine.mjs";
import {
  assertNodeOperatorRuntime,
  assertNoViteSecrets,
  loadOperatorCredentials,
  createOperationB1AdminClient,
  createOperationB1LiveAdapters,
  redactSecrets,
  RETIRED_OPERATION_B1_BATCH_IDS,
} from "./lib/liveOperator/index.js";

function envInput() {
  return {
    DRY_RUN: process.env.DRY_RUN,
    PRODUCTION_PROJECT_REF: process.env.PRODUCTION_PROJECT_REF,
    OPERATION_B1_BATCH_ID: process.env.OPERATION_B1_BATCH_ID,
    ALLOWLIST_PATH:
      process.env.SNAPSHOT_PATH ||
      process.env.RECOVERY_SNAPSHOT_PATH ||
      process.env.ALLOWLIST_PATH,
    ALLOWLIST_SHA256:
      process.env.SNAPSHOT_SHA256 ||
      process.env.RECOVERY_SNAPSHOT_SHA256 ||
      process.env.ALLOWLIST_SHA256,
    OWNER_PRODUCTION_GO: process.env.OWNER_PRODUCTION_GO,
    EXPLICIT_EXECUTE_CONFIRMATION: process.env.EXPLICIT_EXECUTE_CONFIRMATION,
    mode: "rollback",
  };
}

/**
 * Dry-run: snapshot-backed reads only — no network, no secrets.
 * Assumes post-quarantine state for rollback preview.
 */
function createDryRunRollbackAdapters(snapshotPath) {
  const bytes = fs.readFileSync(snapshotPath);
  const doc = JSON.parse(bytes.toString("utf8"));
  const rows = doc.identities || doc.rows || [];
  const byId = new Map(rows.map((r) => [String(r.profile_id), r]));
  return {
    emailOverrides: Object.fromEntries(
      rows.map((r) => [r.auth_user_id, r.email || r.expected_email])
    ),
    fetchProfile: async (id) => {
      const row = byId.get(String(id));
      if (!row) return null;
      return {
        id: row.profile_id,
        email: row.email || row.expected_email,
        status: "quarantined",
      };
    },
    fetchAuthBanState: async () => true,
    fetchReferenceCounts: async (id) =>
      byId.get(String(id))?.reference_counts || {},
  };
}

export async function runLiveOperatorRollback(input = envInput(), deps = {}) {
  const report = {
    operation: "OPERATION_B1A_LIVE_OPERATOR_ROLLBACK",
    production_project_ref: EXPECTED_PRODUCTION_PROJECT_REF,
    ok: false,
    dryRun: true,
    mutationClientConstructed: false,
    mutationCalls: 0,
    reasons: [],
    rollback: null,
  };

  try {
    const runtime = assertNodeOperatorRuntime();
    if (!runtime.ok) {
      report.reasons.push(runtime.reason);
      return report;
    }
    const vite = assertNoViteSecrets();
    if (!vite.ok) {
      report.reasons.push(vite.reason);
      return report;
    }

    const auth = evaluateAuthorization({ ...input, mode: "rollback" });
    report.dryRun = auth.dryRun;
    report.reasons.push(...auth.reasons);
    if (!auth.ok) {
      report.failReason = "authorization_or_structural_guards";
      return report;
    }
    if (RETIRED_OPERATION_B1_BATCH_IDS.includes(auth.batchId)) {
      report.reasons.push("retired_batch_id_not_reusable");
      report.failReason = "retired_batch";
      return report;
    }
    if (!fs.existsSync(auth.allowlistPath)) {
      report.reasons.push("snapshot_missing");
      return report;
    }

    let adapters = { repoRoots: deps.repoRoots || [process.cwd()] };
    if (auth.dryRun || !mutationAllowed(auth)) {
      adapters = {
        ...createDryRunRollbackAdapters(auth.allowlistPath),
        ...adapters,
      };
    } else {
      const credsLoader = deps.loadOperatorCredentials || loadOperatorCredentials;
      const creds = credsLoader(deps.env || process.env);
      if (!creds.ok) {
        report.reasons.push(...(creds.reasons || ["credentials_missing"]));
        report.failReason = "credentials_missing_before_adapter";
        return report;
      }
      const createAdmin =
        deps.createOperationB1AdminClient || createOperationB1AdminClient;
      const admin = await createAdmin({
        url: creds.url,
        secretKey: creds.secretKey,
        createClientImpl: deps.createClientImpl,
      });
      report.mutationClientConstructed = true;
      const createAdapters =
        deps.createOperationB1LiveAdapters || createOperationB1LiveAdapters;
      adapters = { ...createAdapters({ admin }), ...adapters };
    }

    const rollback = await runRollback(input, adapters);
    report.rollback = redactSecrets({
      ok: rollback.ok,
      dryRun: rollback.dryRun,
      mutationCalls: rollback.mutationCalls,
      unresolved: (rollback.unresolved || []).map((u) => ({
        label: u.label,
        abortReason: u.abortReason,
        auth_user_id: u.auth_user_id,
      })),
      results: (rollback.results || []).map((r) => ({
        label: r.label,
        ok: r.ok,
        aborted: r.aborted,
        abortReason: r.abortReason,
        profile: r.profile,
        ban: r.ban,
        mutations: r.mutations,
      })),
    });
    report.mutationCalls = rollback.mutationCalls || 0;
    report.ok = Boolean(rollback.ok);
    if (!rollback.ok) report.failReason = rollback.failReason || "rollback_failed";
    return report;
  } catch (err) {
    report.reasons.push(redactSecrets(String(err?.message || err)));
    report.failReason = "unhandled_error";
    return report;
  }
}

const isMain =
  process.argv[1] &&
  process.argv[1].replace(/\\/g, "/").endsWith("rollback-live-operator.mjs");
if (isMain) {
  runLiveOperatorRollback()
    .then((report) => {
      console.log(JSON.stringify(redactSecrets(report), null, 2));
      process.exit(report.ok ? 0 : 2);
    })
    .catch((err) => {
      console.error(redactSecrets(String(err?.message || err)));
      process.exit(1);
    });
}
