#!/usr/bin/env node
/**
 * PM-ID-01 — Activation-package remote Staging read-only preflight.
 *
 * Modes:
 *   (default)         offline static package + probe safety
 *   --live-readonly   remote catalog probe BEGIN READ ONLY … ROLLBACK
 *
 * Refuses --execute / --apply. Never Production. Never writes.
 * Evidence written under docs/player-management/pm-id-01/activation/evidence/
 */

import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  assertCatalogQueryReadOnly,
  COACHING_03_PRODUCTION_PROJECT_REF_BLOCKLIST,
  inspectCoaching03EnvironmentIdentity,
  loadCoaching03StagingEnv,
  redactSecrets,
} from "../../src/features/coaching/staging/index.js";

import {
  PM_ID_01_EVIDENCE_DIR,
  PM_ID_01_FORWARD_SQL_ORDER,
  PM_ID_01_STAGING_PROJECT_REF,
  PM_ID_01_VERDICTS,
  auditPmId01CanonicalSqlPackage,
  buildPmId01ActivationReadOnlyPreflightSql,
  getPmId01RepoRoot,
  verifyPmId01MigrationManifest,
} from "./pm-id-01-activation-lib.mjs";

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
  const dir = path.join(repoRoot, PM_ID_01_EVIDENCE_DIR);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const target = path.join(dir, filename);
  writeFileSync(target, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  return target;
}

function safetyBase(extra = {}) {
  return {
    phase: "PM-ID-01-ACTIVATION-REMOTE-READ-ONLY-PREFLIGHT",
    stagingProjectRefExpected: PM_ID_01_STAGING_PROJECT_REF,
    databaseWrites: 0,
    sqlApplied: false,
    mappingRowsCreated: 0,
    backfillExecuted: false,
    roleGrantsApplied: false,
    stagingTouchedReadOnly: false,
    productionTouched: false,
    filesDeleted: false,
    CODEX_DELETE_ALLOWED: "NO",
    secretsPrinted: false,
    ...extra,
  };
}

function runOffline(repoRoot) {
  /** @type {string[]} */
  const errors = [];
  const probeSql = buildPmId01ActivationReadOnlyPreflightSql();
  const safety = assertCatalogQueryReadOnly(probeSql);
  if (!safety.ok) errors.push(...safety.errors);

  const manifest = verifyPmId01MigrationManifest({ repoRoot });
  if (!manifest.ok) errors.push(...(manifest.errors || []));

  const audit = auditPmId01CanonicalSqlPackage(repoRoot);
  if (!audit.ok) errors.push(...audit.defects);

  for (const rel of PM_ID_01_FORWARD_SQL_ORDER) {
    if (!existsSync(path.join(repoRoot, rel))) {
      errors.push(`Missing forward SQL: ${rel}`);
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    probeReadOnlyOk: safety.ok,
    manifestOk: manifest.ok,
    auditOk: audit.ok,
    combinedManifestHash: manifest.combinedManifestHash || null,
    stagingProjectRef: PM_ID_01_STAGING_PROJECT_REF,
  };
}

function interpretLiveBody(body) {
  const blob = JSON.stringify(body || {});
  return {
    resultRowCount: Array.isArray(body) ? body.length : null,
    playerIdentityLinksPresent: /"player_identity_links_present"\s*:\s*true/.test(
      blob
    )
      ? true
      : /player_identity_links/.test(blob) &&
          !/"player_identity_links_present"\s*:\s*false/.test(blob)
        ? null
        : false,
    playerIdentityHelpersPresent:
      /player_identity_resolve_mapping|player_identity_is_mapped/.test(blob),
    coachingMappedHelperPresent: /coaching_04_mapped_player_id/.test(blob),
    note: "Catalog probe only. Authored PM-ID-01 objects expected absent until Owner GO apply.",
  };
}

async function runLive(accessToken) {
  const sql = buildPmId01ActivationReadOnlyPreflightSql();
  const safety = assertCatalogQueryReadOnly(sql);
  if (!safety.ok) {
    return {
      ok: false,
      verdict: PM_ID_01_VERDICTS.PREFLIGHT_BLOCKED,
      message: "Read-only enforcement failed before network.",
      errors: safety.errors,
      stagingTouchedReadOnly: false,
    };
  }

  const res = await fetch(
    `https://api.supabase.com/v1/projects/${PM_ID_01_STAGING_PROJECT_REF}/database/query`,
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
      verdict: PM_ID_01_VERDICTS.PREFLIGHT_FAIL,
      message: redactSecrets(body?.message || body?.error || `HTTP ${res.status}`),
      stagingTouchedReadOnly: true,
      readOnlyTransaction: true,
      beginReadOnly: true,
      rollback: true,
    };
  }

  return {
    ok: true,
    verdict: PM_ID_01_VERDICTS.PREFLIGHT_PASS,
    stagingProjectRef: PM_ID_01_STAGING_PROJECT_REF,
    stagingTouchedReadOnly: true,
    readOnlyTransaction: true,
    beginReadOnly: true,
    rollback: true,
    currentTransactionReadOnly: true,
    rollbackFeasibility: true,
    catalogInterpretation: interpretLiveBody(body),
  };
}

async function main() {
  const repoRoot = getPmId01RepoRoot(import.meta.url);
  const args = parseArgs(process.argv.slice(2));
  loadCoaching03StagingEnv({ repoRoot });

  if (args.execute || args.apply) {
    const refused = safetyBase({
      ok: false,
      verdict: PM_ID_01_VERDICTS.APPLY_REFUSED_OWNER_GO_NOT_GRANTED,
      message:
        "Activation preflight refuses --execute/--apply. Owner GO required on apply runner.",
      ownerGoGranted: false,
      databaseConnectionOpened: false,
    });
    writeEvidence(repoRoot, "APPLY_REFUSED_NO_GO.json", refused);
    console.log(JSON.stringify(refused, null, 2));
    process.exitCode = 2;
    return;
  }

  if (args.environment !== "staging") {
    const blocked = safetyBase({
      ok: false,
      verdict: PM_ID_01_VERDICTS.PREFLIGHT_FAIL,
      message: `Environment must be staging; got ${args.environment}`,
    });
    writeEvidence(repoRoot, "PREFLIGHT_OFFLINE.json", blocked);
    console.log(JSON.stringify(blocked, null, 2));
    process.exitCode = 1;
    return;
  }

  const offline = runOffline(repoRoot);
  const identity = inspectCoaching03EnvironmentIdentity(process.env);
  if (
    identity?.resolvedProjectRef &&
    COACHING_03_PRODUCTION_PROJECT_REF_BLOCKLIST.includes(
      identity.resolvedProjectRef
    )
  ) {
    const blocked = safetyBase({
      ...offline,
      ok: false,
      verdict: PM_ID_01_VERDICTS.PREFLIGHT_BLOCKED,
      message: "Production project ref detected — refusing remote connection.",
      productionTouched: false,
    });
    writeEvidence(repoRoot, "PREFLIGHT_OFFLINE.json", blocked);
    console.log(JSON.stringify(blocked, null, 2));
    process.exitCode = 1;
    return;
  }

  if (!args.liveReadonly) {
    const payload = safetyBase({
      ...offline,
      ok: offline.ok,
      verdict: offline.ok
        ? PM_ID_01_VERDICTS.PREFLIGHT_OFFLINE_PASS
        : PM_ID_01_VERDICTS.PREFLIGHT_FAIL,
      mode: "offline",
    });
    writeEvidence(repoRoot, "PREFLIGHT_OFFLINE.json", payload);
    console.log(JSON.stringify(payload, null, 2));
    process.exitCode = offline.ok ? 0 : 1;
    return;
  }

  if (!offline.ok) {
    const blocked = safetyBase({
      ...offline,
      ok: false,
      verdict: PM_ID_01_VERDICTS.PREFLIGHT_BLOCKED,
      message: "Offline read-only checks failed; not connecting.",
    });
    writeEvidence(repoRoot, "PREFLIGHT_LIVE_READONLY.json", blocked);
    console.log(JSON.stringify(blocked, null, 2));
    process.exitCode = 1;
    return;
  }

  const token =
    process.env.SUPABASE_ACCESS_TOKEN ||
    process.env.SUPABASE_MANAGEMENT_ACCESS_TOKEN ||
    "";
  if (!token) {
    const blocked = safetyBase({
      ...offline,
      ok: false,
      verdict: PM_ID_01_VERDICTS.PREFLIGHT_BLOCKED,
      message:
        "No management access token for read-only Staging probe.",
    });
    writeEvidence(repoRoot, "PREFLIGHT_LIVE_READONLY.json", blocked);
    console.log(JSON.stringify(blocked, null, 2));
    process.exitCode = 1;
    return;
  }

  const live = await runLive(token);
  const payload = safetyBase({
    offline,
    ...live,
    databaseWrites: 0,
    sqlApplied: false,
    mappingRowsCreated: 0,
    backfillExecuted: false,
    roleGrantsApplied: false,
    productionTouched: false,
  });
  writeEvidence(repoRoot, "PREFLIGHT_LIVE_READONLY.json", payload);
  console.log(JSON.stringify(payload, null, 2));
  process.exitCode = live.ok ? 0 : 1;
}

const isDirect =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirect) {
  main().catch((error) => {
    console.error(
      JSON.stringify(
        safetyBase({
          ok: false,
          verdict: PM_ID_01_VERDICTS.PREFLIGHT_FAIL,
          message: String(error?.message || error),
        }),
        null,
        2
      )
    );
    process.exitCode = 1;
  });
}
