#!/usr/bin/env node
/**
 * CUSTOMER-07 — Staging preflight (no SQL apply by default).
 *
 * Modes:
 *   (default)        offline static + safety baseline
 *   --live-gates     also evaluate identity/backup/credentials (read-only DB probe)
 *   --environment=staging required for live-gates
 *
 * Never applies SQL. Never prints secrets. Never connects to Production.
 */

import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import path from "node:path";

import {
  CUSTOMER_07_EVIDENCE_DIR,
  CUSTOMER_07_ENVIRONMENT_LABEL,
  CUSTOMER_07_STAGING_PROJECT_REF,
  CUSTOMER_07_VERDICTS,
  evaluateCustomer07PreWriteGates,
  evaluateCustomer07SafetyBaseline,
  inspectCustomer07EnvironmentIdentity,
  loadCustomer07StagingEnv,
  getCustomer07RepoRoot,
  verifyCustomer07MigrationManifest,
  evaluateCustomer07BackupRollbackGate,
  evaluateCustomer07CredentialsGate,
} from "../../src/features/customer/staging/index.js";

function parseArgs(argv) {
  const args = {
    liveGates: false,
    environment: "staging",
    apply: false,
  };
  for (const raw of argv) {
    if (raw === "--live-gates") args.liveGates = true;
    else if (raw.startsWith("--environment=")) {
      args.environment = String(raw.slice("--environment=".length)).toLowerCase();
    } else if (raw === "--apply" || raw === "--apply-staging") {
      args.apply = true;
    }
  }
  return args;
}

async function probePreApplyObjectState(accessToken) {
  const presenceSql = `
SELECT to_regclass('public.customers') IS NOT NULL AS customers_present;
`;
  const presenceBody = await fetch(
    `https://api.supabase.com/v1/projects/${CUSTOMER_07_STAGING_PROJECT_REF}/database/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query: presenceSql }),
    }
  ).then(async (res) => {
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(
        `Pre-apply probe failed: ${body?.message || body?.error || res.status}`
      );
    }
    return body;
  });
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
  const args = parseArgs(process.argv.slice(2));
  const loadInfo = loadCustomer07StagingEnv({ repoRoot });

  if (args.apply) {
    const refused = {
      phase: "CUSTOMER-07",
      script: "phase-7-staging-preflight",
      ok: false,
      verdict: CUSTOMER_07_VERDICTS.BLOCKED,
      message:
        "Preflight refuses --apply. Use scripts/customer/phase-7-staging-apply.mjs.",
      sqlApplied: false,
      secretsPrinted: false,
    };
    console.log(JSON.stringify(refused, null, 2));
    process.exit(1);
  }

  if (args.environment !== CUSTOMER_07_ENVIRONMENT_LABEL) {
    const refused = {
      phase: "CUSTOMER-07",
      ok: false,
      verdict: CUSTOMER_07_VERDICTS.BLOCKED_ENVIRONMENT_IDENTITY,
      message: `Environment must be staging (got ${args.environment}).`,
      sqlApplied: false,
    };
    console.log(JSON.stringify(refused, null, 2));
    process.exit(1);
  }

  const safety = evaluateCustomer07SafetyBaseline({ repoRoot });
  const manifestVerify = verifyCustomer07MigrationManifest({ repoRoot });
  const identityOffline = inspectCustomer07EnvironmentIdentity(process.env);
  const credentials = evaluateCustomer07CredentialsGate(process.env);

  /** @type {object|null} */
  let preApplyObjectState = null;
  /** @type {object|null} */
  let backup = null;
  /** @type {object|null} */
  let gates = null;

  if (args.liveGates) {
    if (!credentials.accessTokenPresent) {
      const blocked = {
        phase: "CUSTOMER-07",
        mode: "live-gates",
        ok: false,
        verdict: CUSTOMER_07_VERDICTS.BLOCKED,
        message: "SUPABASE_ACCESS_TOKEN required for live-gates probe.",
        identity: identityOffline,
        credentials: {
          accessTokenPresent: false,
          secretsPrinted: false,
        },
        sqlApplied: false,
      };
      writeEvidence(repoRoot, "PREFLIGHT_LIVE_GATES.json", blocked);
      console.log(JSON.stringify(blocked, null, 2));
      process.exit(1);
    }
    if (!identityOffline.ok) {
      const blocked = {
        phase: "CUSTOMER-07",
        mode: "live-gates",
        ok: false,
        verdict: CUSTOMER_07_VERDICTS.BLOCKED_ENVIRONMENT_IDENTITY,
        identity: identityOffline,
        sqlApplied: false,
        secretsPrinted: false,
      };
      writeEvidence(repoRoot, "PREFLIGHT_LIVE_GATES.json", blocked);
      console.log(JSON.stringify(blocked, null, 2));
      process.exit(1);
    }
    try {
      preApplyObjectState = await probePreApplyObjectState(
        String(process.env.SUPABASE_ACCESS_TOKEN || "").trim()
      );
    } catch (err) {
      const blocked = {
        phase: "CUSTOMER-07",
        mode: "live-gates",
        ok: false,
        verdict: CUSTOMER_07_VERDICTS.BLOCKED,
        message: err?.message || String(err),
        sqlApplied: false,
        secretsPrinted: false,
      };
      writeEvidence(repoRoot, "PREFLIGHT_LIVE_GATES.json", blocked);
      console.log(JSON.stringify(blocked, null, 2));
      process.exit(1);
    }
    backup = evaluateCustomer07BackupRollbackGate({
      repoRoot,
      env: process.env,
      preApplyObjectState,
    });
    gates = evaluateCustomer07PreWriteGates({
      env: process.env,
      repoRoot,
      preApplyObjectState,
      requireCleanTree: false,
    });
  } else {
    backup = evaluateCustomer07BackupRollbackGate({
      repoRoot,
      env: process.env,
      preApplyObjectState: {
        queried: true,
        customerTablesPresent: false,
        customerRowCount: 0,
        nonTestCustomerRowCount: 0,
        importantDataPresent: false,
      },
    });
  }

  const report = {
    phase: "CUSTOMER-07",
    script: "phase-7-staging-preflight",
    mode: args.liveGates ? "live-gates" : "offline",
    ok: args.liveGates
      ? Boolean(gates?.canWrite)
      : safety.hardOk && manifestVerify.ok,
    verdict: args.liveGates
      ? gates?.canWrite
        ? null
        : gates?.verdict || CUSTOMER_07_VERDICTS.BLOCKED
      : safety.hardOk && manifestVerify.ok
        ? null
        : CUSTOMER_07_VERDICTS.BLOCKED,
    sqlApplied: false,
    productionConnected: false,
    stagingProjectRef: CUSTOMER_07_STAGING_PROJECT_REF,
    envLoadedFrom: loadInfo.loadedFrom,
    secretsPrinted: false,
    safety: {
      hardOk: safety.hardOk,
      facts: safety.facts,
      errors: safety.errors,
    },
    identity: identityOffline,
    credentials: {
      ok: credentials.ok,
      accessTokenPresent: credentials.accessTokenPresent,
      stagingServiceRolePresent: credentials.stagingServiceRolePresent,
      stagingAnonPresent: credentials.stagingAnonPresent,
      secretsPrinted: false,
    },
    backup,
    preApplyObjectState,
    manifestVerify,
    finishedAt: new Date().toISOString(),
  };

  writeEvidence(
    repoRoot,
    args.liveGates ? "PREFLIGHT_LIVE_GATES.json" : "PREFLIGHT_OFFLINE.json",
    report
  );
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.ok ? 0 : 1);
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
