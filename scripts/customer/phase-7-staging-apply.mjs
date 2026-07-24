#!/usr/bin/env node
/**
 * CUSTOMER-07 — Controlled Staging apply for CUSTOMER-03 → 06.
 *
 * DEFAULT: dry-run (no SQL write).
 *
 * Live apply requires:
 *   --apply-staging
 *   --environment=staging
 *   Environment identity gate PASS
 *   Backup/rollback gate PASS (after pre-apply probe)
 *   Credentials gate PASS
 *   Manifest SHA re-verify PASS
 *
 * Stop on first error. No Production. No secret logging. No auto-rollback.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import path from "node:path";

import {
  CUSTOMER_07_EVIDENCE_DIR,
  CUSTOMER_07_ENVIRONMENT_LABEL,
  CUSTOMER_07_STAGING_PROJECT_REF,
  CUSTOMER_07_VERDICTS,
  evaluateCustomer07PreWriteGates,
  loadCustomer07StagingEnv,
  getCustomer07RepoRoot,
  loadCustomer07MigrationManifest,
  verifyCustomer07MigrationManifest,
  sha256File,
} from "../../src/features/customer/staging/index.js";

function parseArgs(argv) {
  const args = {
    applyStaging: false,
    dryRun: true,
    environment: null,
  };
  for (const raw of argv) {
    if (raw === "--apply-staging") {
      args.applyStaging = true;
      args.dryRun = false;
    } else if (raw === "--dry-run") {
      args.dryRun = true;
      args.applyStaging = false;
    } else if (raw.startsWith("--environment=")) {
      args.environment = String(raw.slice("--environment=".length)).toLowerCase();
    }
  }
  return args;
}

async function executeStagingSql(accessToken, sql, label) {
  const res = await fetch(
    `https://api.supabase.com/v1/projects/${CUSTOMER_07_STAGING_PROJECT_REF}/database/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query: sql }),
    }
  );
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg =
      body?.message || body?.error || `HTTP ${res.status}` || res.statusText;
    throw new Error(`${label}: ${msg}`);
  }
  return { ok: true, label };
}

async function probePreApplyObjectState(accessToken) {
  const presenceSql = `
SELECT to_regclass('public.customers') IS NOT NULL AS customers_present;
`;
  const presenceRes = await fetch(
    `https://api.supabase.com/v1/projects/${CUSTOMER_07_STAGING_PROJECT_REF}/database/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query: presenceSql }),
    }
  );
  const presenceBody = await presenceRes.json().catch(() => ({}));
  if (!presenceRes.ok) {
    throw new Error(
      `Pre-apply probe failed: ${presenceBody?.message || presenceBody?.error || presenceRes.status}`
    );
  }
  const presenceRow = Array.isArray(presenceBody)
    ? presenceBody[0]
    : presenceBody?.[0] || presenceBody;
  const customerTablesPresent = Boolean(presenceRow?.customers_present);
  if (!customerTablesPresent) {
    return {
      queried: true,
      customerTablesPresent: false,
      customerRowCount: 0,
      nonTestCustomerRowCount: 0,
      importantDataPresent: false,
    };
  }

  const countSql = `
SELECT
  count(*)::int AS customer_row_count,
  count(*) FILTER (
    WHERE customer_id NOT LIKE 'CUSTOMER07_TEST_%'
      AND customer_number NOT LIKE 'CUSTOMER07_TEST_%'
      AND coalesce(display_name, '') NOT LIKE 'CUSTOMER07_TEST_%'
  )::int AS non_test_customer_row_count
FROM public.customers;
`;
  const res = await fetch(
    `https://api.supabase.com/v1/projects/${CUSTOMER_07_STAGING_PROJECT_REF}/database/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query: countSql }),
    }
  );
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      `Pre-apply count probe failed: ${body?.message || body?.error || res.status}`
    );
  }
  const row = Array.isArray(body) ? body[0] : body?.[0] || body;
  const customerRowCount = Number(row?.customer_row_count || 0);
  const nonTestCustomerRowCount = Number(row?.non_test_customer_row_count || 0);
  return {
    queried: true,
    customerTablesPresent: true,
    customerRowCount,
    nonTestCustomerRowCount,
    importantDataPresent: nonTestCustomerRowCount > 0,
  };
}

function writeEvidence(repoRoot, filename, payload) {
  const dir = path.join(repoRoot, CUSTOMER_07_EVIDENCE_DIR);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const target = path.join(dir, filename);
  writeFileSync(target, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  return target;
}

async function main() {
  const repoRoot = getCustomer07RepoRoot();
  loadCustomer07StagingEnv({ repoRoot });
  const args = parseArgs(process.argv.slice(2));
  const manifest = loadCustomer07MigrationManifest(repoRoot);
  const verify = verifyCustomer07MigrationManifest({ repoRoot, manifest });

  if (args.environment && args.environment !== CUSTOMER_07_ENVIRONMENT_LABEL) {
    const blocked = {
      phase: "CUSTOMER-07",
      script: "phase-7-staging-apply",
      ok: false,
      verdict: CUSTOMER_07_VERDICTS.BLOCKED_ENVIRONMENT_IDENTITY,
      sqlApplied: false,
      message: `Environment must be staging (got ${args.environment}).`,
      secretsPrinted: false,
    };
    writeEvidence(repoRoot, "APPLY_GATE_REFUSAL.json", blocked);
    console.log(JSON.stringify(blocked, null, 2));
    process.exit(1);
  }

  // Dry-run: report plan only.
  if (!args.applyStaging || args.dryRun) {
    const report = {
      phase: "CUSTOMER-07",
      script: "phase-7-staging-apply",
      mode: "dry-run",
      ok: verify.ok,
      sqlApplied: false,
      stagingConnected: false,
      productionConnected: false,
      deploy: false,
      automaticRollback: false,
      credentialsLogged: false,
      stopOnFirstError: true,
      stagingProjectRef: CUSTOMER_07_STAGING_PROJECT_REF,
      manifestOk: verify.ok,
      manifestErrors: verify.errors || [],
      migrationsWouldApply: (manifest.migrations || []).map((m) => ({
        order: m.order,
        path: m.path,
        phase: m.phase,
        sha256: m.sha256,
      })),
      evidence:
        "Dry-run only. Live apply requires --apply-staging --environment=staging plus all gates.",
      finishedAt: new Date().toISOString(),
    };
    writeEvidence(repoRoot, "APPLY_DRY_RUN.json", report);
    console.log(JSON.stringify(report, null, 2));
    process.exit(verify.ok ? 0 : 1);
  }

  // Live apply path.
  const accessToken = String(process.env.SUPABASE_ACCESS_TOKEN || "").trim();
  let preApplyObjectState;
  try {
    preApplyObjectState = await probePreApplyObjectState(accessToken);
  } catch (err) {
    const blocked = {
      phase: "CUSTOMER-07",
      mode: "apply-refused",
      ok: false,
      verdict: CUSTOMER_07_VERDICTS.BLOCKED,
      sqlApplied: false,
      error: err?.message || String(err),
      secretsPrinted: false,
    };
    writeEvidence(repoRoot, "APPLY_GATE_REFUSAL.json", blocked);
    console.log(JSON.stringify(blocked, null, 2));
    process.exit(1);
  }

  writeEvidence(repoRoot, "PRE_APPLY_OBJECT_STATE.json", {
    ...preApplyObjectState,
    stagingProjectRef: CUSTOMER_07_STAGING_PROJECT_REF,
    probedAt: new Date().toISOString(),
    secretsPrinted: false,
  });

  const gates = evaluateCustomer07PreWriteGates({
    env: process.env,
    repoRoot,
    preApplyObjectState,
    requireCleanTree: false,
  });

  if (!gates.canWrite) {
    const refused = {
      phase: "CUSTOMER-07",
      script: "phase-7-staging-apply",
      mode: "apply-refused",
      ok: false,
      verdict: gates.verdict || CUSTOMER_07_VERDICTS.BLOCKED,
      sqlApplied: false,
      stagingConnected: true,
      productionConnected: false,
      deploy: false,
      automaticRollback: false,
      credentialsLogged: false,
      gates: {
        identityOk: gates.identity.ok,
        identityErrors: gates.identity.errors,
        backupOk: gates.backup.ok,
        backupErrors: gates.backup.errors,
        credentialsOk: gates.credentials.ok,
        credentialsErrors: gates.credentials.errors,
        manifestOk: gates.manifestVerify.ok,
        manifestErrors: gates.manifestVerify.errors,
        safetyHardOk: gates.safety.hardOk,
        safetyErrors: gates.safety.errors,
      },
      preApplyObjectState,
      finishedAt: new Date().toISOString(),
    };
    writeEvidence(repoRoot, "APPLY_GATE_REFUSAL.json", refused);
    console.log(JSON.stringify(refused, null, 2));
    process.exit(1);
  }

  const reverify = verifyCustomer07MigrationManifest({
    repoRoot,
    manifest,
  });
  if (!reverify.ok) {
    const failed = {
      phase: "CUSTOMER-07",
      mode: "apply-refused",
      ok: false,
      verdict: CUSTOMER_07_VERDICTS.BLOCKED,
      sqlApplied: false,
      errors: reverify.errors,
      secretsPrinted: false,
    };
    writeEvidence(repoRoot, "APPLY_GATE_REFUSAL.json", failed);
    console.log(JSON.stringify(failed, null, 2));
    process.exit(1);
  }

  const ordered = [...manifest.migrations].sort(
    (a, b) => Number(a.order) - Number(b.order)
  );
  const applied = [];
  const startedAt = new Date().toISOString();

  try {
    for (const entry of ordered) {
      const abs = path.join(repoRoot, entry.path);
      const actualSha = sha256File(abs);
      if (actualSha.toLowerCase() !== String(entry.sha256).toLowerCase()) {
        throw new Error(
          `SHA-256 mismatch immediately before apply for ${entry.path}`
        );
      }
      const sql = readFileSync(abs, "utf8");
      await executeStagingSql(
        accessToken,
        sql,
        `migration-order-${entry.order}-${path.basename(entry.path)}`
      );
      applied.push({
        order: entry.order,
        path: entry.path,
        phase: entry.phase,
        sha256: actualSha,
        status: "applied",
        appliedAt: new Date().toISOString(),
      });
    }

    const success = {
      phase: "CUSTOMER-07",
      script: "phase-7-staging-apply",
      mode: "applied",
      ok: true,
      verdict: null,
      sqlApplied: true,
      stagingConnected: true,
      stagingProjectRef: CUSTOMER_07_STAGING_PROJECT_REF,
      productionConnected: false,
      deploy: false,
      automaticRollback: false,
      credentialsLogged: false,
      stopOnFirstError: true,
      preApplyObjectState,
      migrationsApplied: applied,
      startedAt,
      finishedAt: new Date().toISOString(),
    };
    writeEvidence(repoRoot, "APPLY_RESULT.json", success);
    console.log(JSON.stringify(success, null, 2));
    process.exit(0);
  } catch (err) {
    const failed = {
      phase: "CUSTOMER-07",
      script: "phase-7-staging-apply",
      mode: "apply-failed",
      ok: false,
      verdict:
        applied.length > 0
          ? CUSTOMER_07_VERDICTS.PARTIAL_APPLY_STOPPED
          : CUSTOMER_07_VERDICTS.BLOCKED,
      sqlApplied: applied.length > 0,
      stagingConnected: true,
      stagingProjectRef: CUSTOMER_07_STAGING_PROJECT_REF,
      productionConnected: false,
      deploy: false,
      automaticRollback: false,
      credentialsLogged: false,
      migrationsApplied: applied,
      stoppedOn: applied.length + 1,
      error: err?.message || String(err),
      startedAt,
      finishedAt: new Date().toISOString(),
      ownerAction:
        applied.length > 0
          ? "Evaluate rollback of applied Customer objects; do not continue later migrations until resolved."
          : "Fix apply error and re-run from dry-run.",
    };
    writeEvidence(repoRoot, "APPLY_RESULT.json", failed);
    console.log(JSON.stringify(failed, null, 2));
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(
    JSON.stringify(
      {
        ok: false,
        verdict: CUSTOMER_07_VERDICTS.BLOCKED,
        error: err?.message || String(err),
        secretsPrinted: false,
      },
      null,
      2
    )
  );
  process.exit(1);
});
