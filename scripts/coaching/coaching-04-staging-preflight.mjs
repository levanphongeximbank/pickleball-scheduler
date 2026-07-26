#!/usr/bin/env node
/**
 * COACHING-04 — Staging read-only preflight (no SQL apply).
 *
 * Modes:
 *   (default)         offline static checks
 *   --live-readonly   remote catalog probe with BEGIN READ ONLY … ROLLBACK
 *
 * Refuses --execute / --apply / --apply-staging.
 * Never prints secrets. Never connects to Production.
 * databaseWrites must remain 0.
 */

import { writeFileSync, mkdirSync, existsSync, readFileSync } from "node:fs";
import path from "node:path";

import {
  COACHING_03_ENVIRONMENT_LABEL,
  COACHING_03_STAGING_PROJECT_REF,
  COACHING_03_PRODUCTION_PROJECT_REF_BLOCKLIST,
  assertCatalogQueryReadOnly,
  buildCoaching04ReadOnlyCatalogProbeSql,
  getCoaching03RepoRoot,
  inspectCoaching03EnvironmentIdentity,
  loadCoaching03StagingEnv,
  redactSecrets,
} from "../../src/features/coaching/staging/index.js";
import {
  COACHING_DURABLE_RUNTIME_DEFAULT,
  LOCALSTORAGE_RETIRED,
  COACHING_04_PLAYER_SELF_SCOPE_STATUS,
} from "../../src/features/coaching/runtime/constants.js";

const COACHING_04_EVIDENCE_DIR =
  "docs/coaching-training/coaching-04/evidence";

const COACHING_04_VERDICTS = Object.freeze({
  PREFLIGHT_PASS: "COACHING_04_PREFLIGHT_PASS",
  PREFLIGHT_FAIL: "COACHING_04_PREFLIGHT_FAIL",
  REMOTE_READ_ONLY_PREFLIGHT_BLOCKED:
    "COACHING_04_REMOTE_READ_ONLY_PREFLIGHT_BLOCKED",
  OFFLINE_PASS: "COACHING_04_OFFLINE_PREFLIGHT_PASS",
});

const REQUIRED_PACK = [
  "00_COACHING_04_SCOPE_AND_SECURITY_MODEL.md",
  "01_COACHING_04_ASSIGNMENT_MAPPING.md",
  "02_COACHING_04_PLAYER_SELF_SCOPE_MAPPING.md",
  "03_COACHING_04_UI_CUTOVER_PLAN.md",
  "04_COACHING_04_LOCALSTORAGE_RETIREMENT_PLAN.md",
  "05_COACHING_04_ACCESS_MATRIX.md",
  "10_COACHING_04_ASSIGNMENT_HELPERS.sql",
  "11_COACHING_04_PLAYER_SELF_SCOPE_HELPERS.sql",
  "20_COACHING_04_ASSIGNMENT_RLS.sql",
  "21_COACHING_04_PLAYER_SELF_SCOPE_RLS.sql",
  "30_COACHING_04_SCOPED_RPCS.sql",
  "40_COACHING_04_PERMISSION_SEED_AND_GRANTS.proposal.sql",
  "90_COACHING_04_ROLLBACK.sql",
  "99_COACHING_04_VERIFICATION.sql",
  "sql-migration-manifest.json",
];

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
  const dir = path.join(repoRoot, COACHING_04_EVIDENCE_DIR);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const target = path.join(dir, filename);
  writeFileSync(target, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  return target;
}

function runOfflineStatic(repoRoot) {
  const packDir = path.join(repoRoot, "docs/coaching-training/coaching-04");
  /** @type {string[]} */
  const errors = [];
  for (const file of REQUIRED_PACK) {
    if (!existsSync(path.join(packDir, file))) {
      errors.push(`Missing pack file: ${file}`);
    }
  }
  const playerDoc = existsSync(
    path.join(packDir, "02_COACHING_04_PLAYER_SELF_SCOPE_MAPPING.md")
  )
    ? readFileSync(
        path.join(packDir, "02_COACHING_04_PLAYER_SELF_SCOPE_MAPPING.md"),
        "utf8"
      )
    : "";
  if (!playerDoc.includes(COACHING_04_PLAYER_SELF_SCOPE_STATUS)) {
    errors.push("PLAYER self-scope status marker missing from docs");
  }
  if (COACHING_DURABLE_RUNTIME_DEFAULT !== false) {
    errors.push("COACHING_DURABLE_RUNTIME_DEFAULT must be false");
  }
  if (LOCALSTORAGE_RETIRED !== false) {
    errors.push("LOCALSTORAGE_RETIRED must be false");
  }

  const probeSql = buildCoaching04ReadOnlyCatalogProbeSql();
  const safety = assertCatalogQueryReadOnly(probeSql);
  if (!safety.ok) {
    errors.push(...safety.errors);
  }

  return {
    ok: errors.length === 0,
    errors,
    probeReadOnlyOk: safety.ok,
    stagingProjectRef: COACHING_03_STAGING_PROJECT_REF,
    playerSelfScopeStatus: COACHING_04_PLAYER_SELF_SCOPE_STATUS,
    durableRuntimeDefault: COACHING_DURABLE_RUNTIME_DEFAULT,
    localStorageRetired: LOCALSTORAGE_RETIRED,
  };
}

async function runLiveReadonlyProbe(accessToken) {
  const sql = buildCoaching04ReadOnlyCatalogProbeSql();
  const safety = assertCatalogQueryReadOnly(sql);
  if (!safety.ok) {
    return {
      ok: false,
      verdict: COACHING_04_VERDICTS.REMOTE_READ_ONLY_PREFLIGHT_BLOCKED,
      message: "Read-only enforcement failed before network.",
      errors: safety.errors,
      sqlApplied: false,
      databaseWrites: 0,
      roleGrantsApplied: false,
      uiCutoverActivated: false,
      localStorageRetired: false,
      productionTouched: false,
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
      verdict: COACHING_04_VERDICTS.PREFLIGHT_FAIL,
      message: redactSecrets(
        body?.message || body?.error || `HTTP ${res.status}`
      ),
      sqlApplied: false,
      databaseWrites: 0,
      roleGrantsApplied: false,
      uiCutoverActivated: false,
      localStorageRetired: false,
      productionTouched: false,
      readOnlyTransaction: true,
      secretsPrinted: false,
    };
  }

  return {
    ok: true,
    verdict: COACHING_04_VERDICTS.PREFLIGHT_PASS,
    stagingProjectRef: COACHING_03_STAGING_PROJECT_REF,
    readOnlyTransaction: true,
    beginReadOnly: true,
    rollback: true,
    sqlApplied: false,
    databaseWrites: 0,
    roleGrantsApplied: false,
    uiCutoverActivated: false,
    localStorageRetired: false,
    productionTouched: false,
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
      phase: "COACHING-04",
      ok: false,
      verdict: "COACHING_04_APPLY_REFUSED",
      message:
        "COACHING-04 preflight refuses --execute/--apply. Owner GO required separately.",
      sqlApplied: false,
      databaseWrites: 0,
      roleGrantsApplied: false,
      uiCutoverActivated: false,
      localStorageRetired: false,
      productionTouched: false,
    };
    writeEvidence(repoRoot, "APPLY_REFUSED.json", refused);
    console.log(JSON.stringify(refused, null, 2));
    process.exitCode = 2;
    return;
  }

  if (args.environment !== "staging") {
    const blocked = {
      phase: "COACHING-04",
      ok: false,
      verdict: COACHING_04_VERDICTS.PREFLIGHT_FAIL,
      message: `Environment must be staging; got ${args.environment}`,
      sqlApplied: false,
      databaseWrites: 0,
      productionTouched: false,
    };
    writeEvidence(repoRoot, "PREFLIGHT_OFFLINE.json", blocked);
    console.log(JSON.stringify(blocked, null, 2));
    process.exitCode = 1;
    return;
  }

  const offline = runOfflineStatic(repoRoot);
  const identity = inspectCoaching03EnvironmentIdentity(process.env);

  if (
    identity?.resolvedProjectRef &&
    COACHING_03_PRODUCTION_PROJECT_REF_BLOCKLIST.includes(identity.resolvedProjectRef)
  ) {
    const blocked = {
      phase: "COACHING-04",
      ok: false,
      verdict: COACHING_04_VERDICTS.PREFLIGHT_FAIL,
      message: "Production project ref blocked.",
      sqlApplied: false,
      databaseWrites: 0,
      productionTouched: false,
    };
    writeEvidence(repoRoot, "PREFLIGHT_OFFLINE.json", blocked);
    console.log(JSON.stringify(blocked, null, 2));
    process.exitCode = 1;
    return;
  }

  if (!args.liveReadonly) {
    const payload = {
      phase: "COACHING-04",
      mode: "offline",
      environmentLabel: COACHING_03_ENVIRONMENT_LABEL,
      verdict: offline.ok
        ? COACHING_04_VERDICTS.OFFLINE_PASS
        : COACHING_04_VERDICTS.PREFLIGHT_FAIL,
      ok: offline.ok,
      ...offline,
      envLoadedFrom: loadInfo.loadedFrom,
      secretsPrinted: false,
      sqlApplied: false,
      databaseWrites: 0,
      roleGrantsApplied: false,
      uiCutoverActivated: false,
      localStorageRetired: false,
      productionTouched: false,
    };
    writeEvidence(repoRoot, "PREFLIGHT_OFFLINE.json", payload);
    console.log(JSON.stringify(payload, null, 2));
    process.exitCode = offline.ok ? 0 : 1;
    return;
  }

  const accessToken = String(process.env.SUPABASE_ACCESS_TOKEN || "").trim();
  if (!accessToken) {
    const blocked = {
      phase: "COACHING-04",
      ok: false,
      verdict: COACHING_04_VERDICTS.REMOTE_READ_ONLY_PREFLIGHT_BLOCKED,
      message:
        "SUPABASE_ACCESS_TOKEN missing — cannot guarantee read-only remote probe auth.",
      sqlApplied: false,
      databaseWrites: 0,
      roleGrantsApplied: false,
      uiCutoverActivated: false,
      localStorageRetired: false,
      productionTouched: false,
      secretsPrinted: false,
    };
    writeEvidence(repoRoot, "PREFLIGHT_LIVE_READONLY.json", blocked);
    console.log(JSON.stringify(blocked, null, 2));
    process.exitCode = 1;
    return;
  }

  if (!offline.ok) {
    const blocked = {
      phase: "COACHING-04",
      ok: false,
      verdict: COACHING_04_VERDICTS.PREFLIGHT_FAIL,
      message: "Offline static preflight failed before live probe.",
      errors: offline.errors,
      sqlApplied: false,
      databaseWrites: 0,
      productionTouched: false,
    };
    writeEvidence(repoRoot, "PREFLIGHT_LIVE_READONLY.json", blocked);
    console.log(JSON.stringify(blocked, null, 2));
    process.exitCode = 1;
    return;
  }

  const live = await runLiveReadonlyProbe(accessToken);
  const payload = {
    phase: "COACHING-04",
    mode: "live-readonly",
    environmentLabel: COACHING_03_ENVIRONMENT_LABEL,
    offlineOk: offline.ok,
    playerSelfScopeStatus: COACHING_04_PLAYER_SELF_SCOPE_STATUS,
    durableRuntimeDefault: COACHING_DURABLE_RUNTIME_DEFAULT,
    ...live,
  };
  writeEvidence(repoRoot, "PREFLIGHT_LIVE_READONLY.json", payload);
  console.log(JSON.stringify(payload, null, 2));
  process.exitCode = live.ok ? 0 : 1;
}

main().catch((err) => {
  const payload = {
    phase: "COACHING-04",
    ok: false,
    verdict: COACHING_04_VERDICTS.PREFLIGHT_FAIL,
    message: redactSecrets(err?.message || String(err)),
    sqlApplied: false,
    databaseWrites: 0,
    productionTouched: false,
    secretsPrinted: false,
  };
  try {
    writeEvidence(getCoaching03RepoRoot(), "PREFLIGHT_LIVE_READONLY.json", payload);
  } catch {
    // ignore evidence write failures in fatal path
  }
  console.log(JSON.stringify(payload, null, 2));
  process.exitCode = 1;
});
