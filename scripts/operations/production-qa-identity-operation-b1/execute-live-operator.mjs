#!/usr/bin/env node
/**
 * Operation B1A — approved live operator execute entry.
 * Dry-run default. Mutation adapters constructed only after all static guards pass.
 * PRODUCTION GO remains NO until a future exact Owner authorization in a later pass.
 *
 * Credentials: process.env SUPABASE_URL + SUPABASE_SECRET_KEY
 * (fallback SUPABASE_SERVICE_ROLE_KEY). Never CLI argv / VITE_* / Git.
 */
import fs from "node:fs";
import path from "node:path";
import {
  evaluateAuthorization,
  mutationAllowed,
  loadAndValidateAllowlistFile,
  EXPECTED_PRODUCTION_PROJECT_REF,
} from "./lib/index.js";
import { runExecute } from "./execute-reversible-quarantine.mjs";
import { runPostcheck } from "./postcheck.mjs";
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
    ALLOWLIST_PATH: process.env.ALLOWLIST_PATH,
    ALLOWLIST_SHA256: process.env.ALLOWLIST_SHA256,
    OWNER_PRODUCTION_GO: process.env.OWNER_PRODUCTION_GO,
    EXPLICIT_EXECUTE_CONFIRMATION: process.env.EXPLICIT_EXECUTE_CONFIRMATION,
    SNAPSHOT_PATH: process.env.SNAPSHOT_PATH || process.env.RECOVERY_SNAPSHOT_PATH,
    SNAPSHOT_SHA256:
      process.env.SNAPSHOT_SHA256 || process.env.RECOVERY_SNAPSHOT_SHA256,
    mode: "execute",
  };
}

function requireRecoverySnapshot(input) {
  const snapPath = String(input.SNAPSHOT_PATH || "").trim();
  const snapSha = String(input.SNAPSHOT_SHA256 || "")
    .trim()
    .toLowerCase();
  if (!snapPath || !/^[0-9a-f]{64}$/.test(snapSha)) {
    return { ok: false, reasons: ["missing_or_invalid_recovery_snapshot"] };
  }
  if (!fs.existsSync(snapPath)) {
    return { ok: false, reasons: ["recovery_snapshot_missing"] };
  }
  return { ok: true, snapPath, snapSha };
}

/**
 * Dry-run adapters: allowlist-backed reads only — no network, no secrets.
 */
function createDryRunAdapters(identities) {
  const byId = new Map(identities.map((r) => [r.profile_id, r]));
  const emailOverrides = Object.fromEntries(
    identities.map((r) => [r.auth_user_id, r.expected_email])
  );
  return {
    emailOverrides,
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

export async function runLiveOperatorExecute(input = envInput(), deps = {}) {
  const report = {
    operation: "OPERATION_B1A_LIVE_OPERATOR_EXECUTE",
    production_project_ref: EXPECTED_PRODUCTION_PROJECT_REF,
    ok: false,
    dryRun: true,
    mutationClientConstructed: false,
    mutationCalls: 0,
    reasons: [],
    execute: null,
    postcheck: null,
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

    const auth = evaluateAuthorization({ ...input, mode: "execute" });
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

    const snap = requireRecoverySnapshot(input);
    if (!snap.ok) {
      report.reasons.push(...snap.reasons);
      report.failReason = "recovery_snapshot_required";
      return report;
    }

    const repoRoots = deps.repoRoots || [
      process.cwd(),
      path.resolve(process.cwd()),
    ];
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

    let adapters;
    if (auth.dryRun || !mutationAllowed(auth)) {
      adapters = {
        ...createDryRunAdapters(loaded.identities),
        repoRoots,
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
      adapters = { ...createAdapters({ admin }), repoRoots };
    }

    const execute = await runExecute(input, adapters);
    report.execute = redactSecrets({
      ok: execute.ok,
      dryRun: execute.dryRun,
      mutationCalls: execute.mutationCalls,
      failReason: execute.failReason || null,
      results: (execute.results || []).map((r) => ({
        label: r.label,
        ok: r.ok,
        aborted: r.aborted,
        abortReason: r.abortReason,
        profile: r.profile,
        ban: r.ban,
        compensated: r.compensated,
        mutations: r.mutations,
        auth_user_id: r.auth_user_id,
        email: r.email,
      })),
    });
    report.mutationCalls = execute.mutationCalls || 0;

    if (!execute.ok) {
      report.failReason = execute.failReason || "execute_failed";
      return report;
    }

    // Dry-run: allowlist structural postcheck only (no live quarantine assertion).
    if (auth.dryRun) {
      const postcheck = await runPostcheck(input, { repoRoots });
      report.postcheck = redactSecrets({
        ok: postcheck.ok,
        mode: postcheck.mode || "allowlist_only",
        checked: postcheck.checked,
        failures: postcheck.failures,
        mutationCalls: 0,
      });
      if (!postcheck.ok) {
        report.failReason = "postcheck_failed";
        return report;
      }
      report.ok = true;
      return report;
    }

    const postcheck = await runPostcheck(input, adapters);
    report.postcheck = redactSecrets({
      ok: postcheck.ok,
      checked: postcheck.checked,
      failures: postcheck.failures,
      mutationCalls: postcheck.mutationCalls,
    });
    if (!postcheck.ok) {
      report.failReason = "postcheck_failed";
      return report;
    }

    report.ok = true;
    return report;
  } catch (err) {
    report.reasons.push(redactSecrets(String(err?.message || err)));
    report.failReason = "unhandled_error";
    return report;
  }
}

const isMain =
  process.argv[1] &&
  process.argv[1].replace(/\\/g, "/").endsWith("execute-live-operator.mjs");
if (isMain) {
  runLiveOperatorExecute()
    .then((report) => {
      console.log(JSON.stringify(redactSecrets(report), null, 2));
      process.exit(report.ok ? 0 : 2);
    })
    .catch((err) => {
      console.error(redactSecrets(String(err?.message || err)));
      process.exit(1);
    });
}
