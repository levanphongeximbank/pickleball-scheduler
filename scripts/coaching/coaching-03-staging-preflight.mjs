#!/usr/bin/env node
/**
 * COACHING-03 — Staging preflight (no SQL apply).
 *
 * Modes:
 *   (default)         offline static + Gate A
 *   --live-readonly   remote catalog probe with BEGIN READ ONLY … ROLLBACK
 *
 * Refuses --execute / --apply / --apply-staging.
 * Never prints secrets. Never connects to Production.
 */

import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import path from "node:path";

import {
  COACHING_03_ENVIRONMENT_LABEL,
  COACHING_03_EVIDENCE_DIR,
  COACHING_03_STAGING_PROJECT_REF,
  COACHING_03_VERDICTS,
  assertCatalogQueryReadOnly,
  buildCoaching03ReadOnlyCatalogProbeSql,
  getCoaching03RepoRoot,
  inspectCoaching03EnvironmentIdentity,
  loadCoaching03ApprovalTemplateDefaults,
  loadCoaching03StagingEnv,
  redactSecrets,
  verifyCoaching03MigrationManifest,
  verifyCoaching03RoleMatrixCompleteness,
} from "../../src/features/coaching/staging/index.js";

function parseArgs(argv) {
  const args = {
    liveReadonly: false,
    environment: "staging",
    execute: false,
    apply: false,
  };
  for (const raw of argv) {
    if (raw === "--live-readonly") args.liveReadonly = true;
    else if (raw.startsWith("--environment=")) {
      args.environment = String(raw.slice("--environment=".length)).toLowerCase();
    } else if (raw === "--execute") args.execute = true;
    else if (raw === "--apply" || raw === "--apply-staging") args.apply = true;
  }
  return args;
}

function writeEvidence(repoRoot, filename, payload) {
  const dir = path.join(repoRoot, COACHING_03_EVIDENCE_DIR);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const target = path.join(dir, filename);
  writeFileSync(target, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  return target;
}

async function runLiveReadonlyProbe(accessToken) {
  const sql = buildCoaching03ReadOnlyCatalogProbeSql();
  const safety = assertCatalogQueryReadOnly(sql);
  if (!safety.ok) {
    return {
      ok: false,
      verdict: COACHING_03_VERDICTS.REMOTE_READ_ONLY_PREFLIGHT_BLOCKED,
      message: "Read-only enforcement failed before network.",
      errors: safety.errors,
      sqlApplied: false,
      databaseWrites: 0,
      secretsPrinted: false,
    };
  }

  const res = await fetch(
    `https://api.supabase.com/v1/projects/${COACHING_03_STAGING_PROJECT_REF}/database/query`,
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
    return {
      ok: false,
      verdict: COACHING_03_VERDICTS.PREFLIGHT_FAIL,
      message: redactSecrets(
        body?.message || body?.error || `HTTP ${res.status}`
      ),
      sqlApplied: false,
      databaseWrites: 0,
      readOnlyTransaction: true,
      secretsPrinted: false,
    };
  }

  return {
    ok: true,
    verdict: COACHING_03_VERDICTS.PREFLIGHT_PASS,
    stagingProjectRef: COACHING_03_STAGING_PROJECT_REF,
    readOnlyTransaction: true,
    beginReadOnly: true,
    rollback: true,
    sqlApplied: false,
    databaseWrites: 0,
    resultRowCount: Array.isArray(body) ? body.length : null,
    secretsPrinted: false,
    urlValuePrinted: false,
  };
}

async function main() {
  const repoRoot = getCoaching03RepoRoot();
  const args = parseArgs(process.argv.slice(2));
  const loadInfo = loadCoaching03StagingEnv({ repoRoot });

  if (args.execute || args.apply) {
    const refused = {
      phase: "COACHING-03",
      script: "coaching-03-staging-preflight",
      ok: false,
      verdict: COACHING_03_VERDICTS.BLOCKED,
      message:
        "Preflight refuses apply/execute. Use coaching-03-staging-apply.mjs only after Owner GO.",
      APPLY_MODE: "REFUSED",
      sqlApplied: false,
      databaseWrites: 0,
      secretsPrinted: false,
    };
    console.log(JSON.stringify(refused, null, 2));
    process.exit(1);
  }

  if (args.environment !== COACHING_03_ENVIRONMENT_LABEL) {
    const refused = {
      phase: "COACHING-03",
      ok: false,
      verdict: COACHING_03_VERDICTS.BLOCKED,
      message: `Environment must be staging (got ${args.environment}).`,
      sqlApplied: false,
      databaseWrites: 0,
    };
    console.log(JSON.stringify(refused, null, 2));
    process.exit(1);
  }

  const manifest = verifyCoaching03MigrationManifest({ repoRoot });
  const approval = loadCoaching03ApprovalTemplateDefaults(repoRoot);
  const roleMatrix = verifyCoaching03RoleMatrixCompleteness();
  const probeSql = buildCoaching03ReadOnlyCatalogProbeSql();
  const probeSafety = assertCatalogQueryReadOnly(probeSql);
  const identityOffline = inspectCoaching03EnvironmentIdentity(process.env);

  const offline = {
    phase: "COACHING-03",
    script: "coaching-03-staging-preflight",
    mode: "offline",
    gate: "GATE_A_LOCAL_PACKAGE_CERTIFICATION",
    ok: manifest.ok && approval.ok && roleMatrix.ok && probeSafety.ok,
    manifest,
    approvalDefaultsOk: approval.ok,
    roleMatrix,
    readOnlyProbeStaticOk: probeSafety.ok,
    readOnlyProbeErrors: probeSafety.errors,
    identityOffline: {
      ok: identityOffline.ok,
      resolvedProjectRef: identityOffline.resolvedProjectRef,
      errors: identityOffline.errors,
      urlValuePrinted: false,
      secretsPrinted: false,
    },
    envLoad: {
      loadedFrom: loadInfo.loadedFrom,
      keysLoadedCount: loadInfo.keysLoaded.length,
      // Never list secret-bearing key names in tracked evidence.
      secretsPrinted: false,
    },
    sqlApplied: false,
    databaseWrites: 0,
    ownerGoGranted: false,
    secretsPrinted: false,
    finishedAt: new Date().toISOString(),
  };

  writeEvidence(repoRoot, "PREFLIGHT_OFFLINE.json", offline);

  if (!offline.ok) {
    console.log(JSON.stringify(offline, null, 2));
    process.exit(1);
  }

  if (!args.liveReadonly) {
    const report = {
      ...offline,
      liveReadonly: false,
      remotePreflight: "NOT_RUN",
      message:
        "Gate A PASS (offline). Gate B requires --live-readonly with read-only enforcement.",
    };
    console.log(JSON.stringify(report, null, 2));
    process.exit(0);
  }

  // Gate B — live read-only
  const accessToken = String(process.env.SUPABASE_ACCESS_TOKEN || "").trim();
  if (!accessToken) {
    const blocked = {
      phase: "COACHING-03",
      mode: "live-readonly",
      gate: "GATE_B_REMOTE_READ_ONLY_STAGING_PREFLIGHT",
      ok: false,
      verdict: COACHING_03_VERDICTS.REMOTE_READ_ONLY_PREFLIGHT_BLOCKED,
      message:
        "SUPABASE_ACCESS_TOKEN missing — cannot prove remote read-only session; local package complete.",
      localPackageOk: true,
      sqlApplied: false,
      databaseWrites: 0,
      secretsPrinted: false,
    };
    writeEvidence(repoRoot, "PREFLIGHT_LIVE_READONLY.json", blocked);
    console.log(JSON.stringify(blocked, null, 2));
    process.exit(1);
  }

  if (!identityOffline.ok) {
    const blocked = {
      phase: "COACHING-03",
      mode: "live-readonly",
      ok: false,
      verdict: COACHING_03_VERDICTS.REMOTE_READ_ONLY_PREFLIGHT_BLOCKED,
      message: "Staging identity gate failed before remote connect.",
      identity: identityOffline,
      sqlApplied: false,
      databaseWrites: 0,
      secretsPrinted: false,
    };
    writeEvidence(repoRoot, "PREFLIGHT_LIVE_READONLY.json", blocked);
    console.log(JSON.stringify(blocked, null, 2));
    process.exit(1);
  }

  const live = await runLiveReadonlyProbe(accessToken);
  const report = {
    phase: "COACHING-03",
    script: "coaching-03-staging-preflight",
    mode: "live-readonly",
    gate: "GATE_B_REMOTE_READ_ONLY_STAGING_PREFLIGHT",
    localPackageOk: true,
    ...live,
    ownerGoGranted: false,
    finishedAt: new Date().toISOString(),
  };
  writeEvidence(repoRoot, "PREFLIGHT_LIVE_READONLY.json", report);
  console.log(JSON.stringify(report, null, 2));
  process.exit(live.ok ? 0 : 1);
}

main().catch((err) => {
  console.error(
    JSON.stringify(
      {
        ok: false,
        verdict: COACHING_03_VERDICTS.BLOCKED,
        error: redactSecrets(err?.message || String(err)),
        sqlApplied: false,
        databaseWrites: 0,
        secretsPrinted: false,
      },
      null,
      2
    )
  );
  process.exit(1);
});
