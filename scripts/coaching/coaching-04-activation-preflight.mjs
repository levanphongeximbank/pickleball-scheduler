#!/usr/bin/env node
/**
 * COACHING-04 — Activation-package remote Staging read-only preflight.
 *
 * Modes:
 *   (default)         offline static package + probe safety
 *   --live-readonly   remote catalog probe BEGIN READ ONLY … ROLLBACK
 *
 * Refuses --execute / --apply. Never Production. Never writes.
 * Never creates mapping rows. Never applies SQL.
 * CODEX_DELETE_ALLOWED=NO.
 */

import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import path from "node:path";

import {
  assertCatalogQueryReadOnly,
  loadCoaching03StagingEnv,
  redactSecrets,
} from "../../src/features/coaching/staging/index.js";
import {
  COACHING_DURABLE_RUNTIME_DEFAULT,
  LOCALSTORAGE_RETIRED,
} from "../../src/features/coaching/runtime/constants.js";

import {
  COACHING_04_EVIDENCE_DIR,
  COACHING_04_FORWARD_SQL_ORDER,
  COACHING_04_PRODUCTION_PROJECT_REF_BLOCKLIST,
  COACHING_04_PROPOSED_FUNCTION_NAMES,
  COACHING_04_STAGING_PROJECT_REF,
  COACHING_04_VERDICTS,
  auditCoaching04CanonicalSqlPackage,
  buildCoaching04ActivationReadOnlyPreflightSql,
  getCoaching04RepoRoot,
  inspectCoaching04EnvironmentIdentity,
  verifyCoaching04MigrationManifest,
} from "./coaching-04-activation-lib.mjs";
import { resolveStagingEvidenceDir } from "../shared/resolve-staging-evidence-dir.mjs";

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
  const dir = resolveStagingEvidenceDir({
    repoRoot,
    canonicalRelativeDir: COACHING_04_EVIDENCE_DIR,
  });
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const target = path.join(dir, filename);
  writeFileSync(target, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  return target;
}

function safetyBase(extra = {}) {
  return {
    phase: "COACHING-04-ACTIVATION-REMOTE-READ-ONLY-PREFLIGHT",
    stagingProjectRefExpected: COACHING_04_STAGING_PROJECT_REF,
    targetProject: COACHING_04_STAGING_PROJECT_REF,
    databaseWrites: 0,
    sqlApplied: false,
    mappingRowsCreated: 0,
    backfillExecuted: false,
    runtimeActivated: false,
    localStorageRetired: LOCALSTORAGE_RETIRED === true,
    durableRuntimeDefault: COACHING_DURABLE_RUNTIME_DEFAULT,
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
  const probeSql = buildCoaching04ActivationReadOnlyPreflightSql();
  const safety = assertCatalogQueryReadOnly(probeSql);
  if (!safety.ok) errors.push(...safety.errors);

  const manifest = verifyCoaching04MigrationManifest({ repoRoot });
  if (!manifest.ok) errors.push(...(manifest.errors || []));

  const audit = auditCoaching04CanonicalSqlPackage(repoRoot);
  if (!audit.ok) errors.push(...audit.defects);

  for (const rel of COACHING_04_FORWARD_SQL_ORDER) {
    if (!existsSync(path.join(repoRoot, rel))) {
      errors.push(`Missing forward SQL: ${rel}`);
    }
  }

  if (COACHING_DURABLE_RUNTIME_DEFAULT !== false) {
    errors.push("COACHING_DURABLE_RUNTIME_DEFAULT must be false");
  }
  if (LOCALSTORAGE_RETIRED !== false) {
    errors.push("LOCALSTORAGE_RETIRED must be false");
  }

  return {
    ok: errors.length === 0,
    errors,
    probeReadOnlyOk: safety.ok,
    manifestOk: manifest.ok,
    auditOk: audit.ok,
    combinedManifestHash: manifest.combinedManifestHash || null,
    aggregateSha256Forward: manifest.aggregateSha256Forward || null,
    stagingProjectRef: COACHING_04_STAGING_PROJECT_REF,
    proposedFunctionNames: [...COACHING_04_PROPOSED_FUNCTION_NAMES],
  };
}

/**
 * Interpret Management API JSON body (single summary row preferred).
 * @param {unknown} body
 */
function extractSummaryRow(body) {
  if (Array.isArray(body) && body.length > 0) {
    const first = body[0];
    if (first && typeof first === "object" && !Array.isArray(first)) {
      if (
        "player_identity_links_present" in first ||
        "player_identity_links_row_count" in first
      ) {
        return first;
      }
    }
    if (Array.isArray(first) && first.length > 0 && typeof first[0] === "object") {
      return first[0];
    }
  }
  if (body && typeof body === "object" && !Array.isArray(body)) {
    if (
      "player_identity_links_present" in body ||
      "player_identity_links_row_count" in body
    ) {
      return body;
    }
  }
  return null;
}

function asBool(value) {
  if (value === true || value === "t" || value === "true" || value === 1) return true;
  if (value === false || value === "f" || value === "false" || value === 0) return false;
  return null;
}

function asInt(value) {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/**
 * @param {unknown} body
 */
function interpretLiveBody(body) {
  const row = extractSummaryRow(body);
  if (!row) {
    return {
      resultRowCount: Array.isArray(body) ? body.length : null,
      parseOk: false,
      playerIdentityLinksPresent: false,
      playerIdentityLinksRowCount: null,
      pmId01HelpersPresent: false,
      coachingBaseTablesPresent: false,
      coaching04ObjectsAlreadyPresent: false,
      objectNameCollisionDetected: false,
      requiredRolesLikelyPresent: false,
      coachRoleMissingSoftWarning: false,
      rlsPrerequisitesPresent: false,
      additiveApplyFeasible: false,
      note: "Unable to parse Management API summary row.",
    };
  }

  const playerIdentityLinksPresent = asBool(row.player_identity_links_present) === true;
  const mappingRowCount = asInt(row.player_identity_links_row_count);
  const pmId01HelpersPresent =
    asBool(row.player_identity_resolve_mapping_present) === true &&
    asBool(row.player_identity_is_mapped_present) === true;
  const coachingBasePresent =
    asBool(row.coaching_programs_present) === true &&
    asBool(row.coaching_enrollments_present) === true &&
    asBool(row.coaching_coach_references_present) === true;
  const functionCollisions = asInt(row.coaching_04_function_collision_count) || 0;
  const policyCollisions = asInt(row.coaching_04_policy_collision_count) || 0;
  const collision = functionCollisions > 0 || policyCollisions > 0;
  const playerRolePresent = asInt(row.player_role_count) === 1;
  const coachRolePresent = asInt(row.coach_role_count) === 1;
  const requiredRolesPresent = playerRolePresent;
  const rlsPrerequisitesPresent = asBool(row.rls_prerequisites_present) === true;
  const permissionSeedCount = asInt(row.coaching_04_permission_seed_count) || 0;

  return {
    resultRowCount: Array.isArray(body) ? body.length : 1,
    parseOk: true,
    playerIdentityLinksPresent,
    playerIdentityLinksRowCount: mappingRowCount,
    pmId01HelpersPresent,
    coachingBaseTablesPresent: coachingBasePresent,
    coaching04ObjectsAlreadyPresent: collision || permissionSeedCount > 0,
    objectNameCollisionDetected: collision,
    coaching04FunctionCollisionCount: functionCollisions,
    coaching04PolicyCollisionCount: policyCollisions,
    coaching04PermissionSeedCount: permissionSeedCount,
    playerRolePresent,
    coachRolePresent,
    requiredRolesLikelyPresent: requiredRolesPresent,
    coachRoleMissingSoftWarning: playerRolePresent && !coachRolePresent,
    rlsPrerequisitesPresent,
    additiveApplyFeasible:
      playerIdentityLinksPresent &&
      pmId01HelpersPresent &&
      coachingBasePresent &&
      rlsPrerequisitesPresent &&
      requiredRolesPresent &&
      !collision &&
      permissionSeedCount === 0,
    note: "Catalog probe only. COACHING-04 forward objects expected absent until Owner GO apply. Mapping rows are counted, never created. COACH role absence is warned (grant SQL is EXISTS-guarded); PLAYER role is required.",
  };
}

async function runLive(accessToken) {
  const sql = buildCoaching04ActivationReadOnlyPreflightSql();
  const safety = assertCatalogQueryReadOnly(sql);
  if (!safety.ok) {
    return {
      ok: false,
      verdict: COACHING_04_VERDICTS.PREFLIGHT_BLOCKED,
      message: "Read-only enforcement failed before network.",
      errors: safety.errors,
      stagingTouchedReadOnly: false,
    };
  }

  const res = await fetch(
    `https://api.supabase.com/v1/projects/${COACHING_04_STAGING_PROJECT_REF}/database/query`,
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
      message: redactSecrets(body?.message || body?.error || `HTTP ${res.status}`),
      stagingTouchedReadOnly: true,
      readOnlyTransaction: true,
      beginReadOnly: true,
      rollback: true,
    };
  }

  const catalogInterpretation = interpretLiveBody(body);
  /** @type {string[]} */
  const liveErrors = [];
  if (!catalogInterpretation.parseOk) {
    liveErrors.push("Unable to parse Staging catalog summary row.");
  }
  if (!catalogInterpretation.playerIdentityLinksPresent) {
    liveErrors.push("PM-ID-01 player_identity_links table missing on Staging.");
  }
  if (!catalogInterpretation.pmId01HelpersPresent) {
    liveErrors.push("PM-ID-01 resolve helpers missing on Staging.");
  }
  if (!catalogInterpretation.coachingBaseTablesPresent) {
    liveErrors.push("Coaching base tables missing on Staging.");
  }
  if (!catalogInterpretation.rlsPrerequisitesPresent) {
    liveErrors.push("RLS prerequisites (identity/coaching_02 helpers) missing on Staging.");
  }
  if (!catalogInterpretation.requiredRolesLikelyPresent) {
    liveErrors.push("Required role PLAYER missing on Staging.");
  }
  if (catalogInterpretation.objectNameCollisionDetected) {
    liveErrors.push(
      "COACHING-04 object-name collision detected (coaching_04_* already present)."
    );
  }
  if ((catalogInterpretation.coaching04PermissionSeedCount || 0) > 0) {
    liveErrors.push(
      "COACHING-04 permission seeds already present (forward package appears applied)."
    );
  }

  const ok = liveErrors.length === 0;
  return {
    ok,
    verdict: ok
      ? COACHING_04_VERDICTS.PREFLIGHT_PASS
      : COACHING_04_VERDICTS.PREFLIGHT_FAIL,
    errors: liveErrors,
    warnings: catalogInterpretation.coachRoleMissingSoftWarning
      ? [
          "COACH role absent on Staging — COACH grant inserts are EXISTS-guarded and will no-op until COACH is seeded (e.g. PHASE_V52_PRODUCTION_RBAC_ROLES).",
        ]
      : [],
    stagingProjectRef: COACHING_04_STAGING_PROJECT_REF,
    stagingTouchedReadOnly: true,
    readOnlyTransaction: true,
    beginReadOnly: true,
    rollback: true,
    currentTransactionReadOnly: true,
    rollbackFeasibility: true,
    mappingRowCount: catalogInterpretation.playerIdentityLinksRowCount,
    catalogInterpretation,
  };
}

async function main() {
  const repoRoot = getCoaching04RepoRoot(import.meta.url);
  const args = parseArgs(process.argv.slice(2));
  loadCoaching03StagingEnv({ repoRoot });
  const startedAt = new Date().toISOString();

  if (args.execute || args.apply) {
    const refused = safetyBase({
      ok: false,
      verdict: COACHING_04_VERDICTS.APPLY_REFUSED_OWNER_GO_NOT_GRANTED,
      message:
        "Activation preflight refuses --execute/--apply. Owner GO required on apply runner.",
      ownerGoGranted: false,
      databaseConnectionOpened: false,
      startedAt,
      finishedAt: new Date().toISOString(),
      finalVerdict: COACHING_04_VERDICTS.APPLY_REFUSED_OWNER_GO_NOT_GRANTED,
    });
    writeEvidence(repoRoot, "APPLY_REFUSED_NO_GO.json", refused);
    console.log(JSON.stringify(refused, null, 2));
    process.exitCode = 2;
    return;
  }

  if (args.environment !== "staging") {
    const blocked = safetyBase({
      ok: false,
      verdict: COACHING_04_VERDICTS.PREFLIGHT_FAIL,
      message: `Environment must be staging; got ${args.environment}`,
      startedAt,
      finishedAt: new Date().toISOString(),
      finalVerdict: COACHING_04_VERDICTS.PREFLIGHT_FAIL,
    });
    writeEvidence(repoRoot, "ACTIVATION_PREFLIGHT_OFFLINE.json", blocked);
    console.log(JSON.stringify(blocked, null, 2));
    process.exitCode = 1;
    return;
  }

  const offline = runOffline(repoRoot);
  const identity = inspectCoaching04EnvironmentIdentity(process.env);

  if (
    identity?.resolvedProjectRef &&
    COACHING_04_PRODUCTION_PROJECT_REF_BLOCKLIST.includes(
      identity.resolvedProjectRef
    )
  ) {
    const blocked = safetyBase({
      ok: false,
      verdict: COACHING_04_VERDICTS.PRODUCTION_TARGET_REFUSED,
      message: "Production project ref blocked.",
      startedAt,
      finishedAt: new Date().toISOString(),
      finalVerdict: COACHING_04_VERDICTS.PRODUCTION_TARGET_REFUSED,
    });
    writeEvidence(repoRoot, "ACTIVATION_PREFLIGHT_OFFLINE.json", blocked);
    console.log(JSON.stringify(blocked, null, 2));
    process.exitCode = 1;
    return;
  }

  if (!args.liveReadonly) {
    const payload = safetyBase({
      mode: "offline",
      ok: offline.ok,
      verdict: offline.ok
        ? COACHING_04_VERDICTS.PREFLIGHT_OFFLINE_PASS
        : COACHING_04_VERDICTS.PREFLIGHT_FAIL,
      ...offline,
      startedAt,
      finishedAt: new Date().toISOString(),
      finalVerdict: offline.ok
        ? COACHING_04_VERDICTS.PREFLIGHT_OFFLINE_PASS
        : COACHING_04_VERDICTS.PREFLIGHT_FAIL,
    });
    writeEvidence(repoRoot, "ACTIVATION_PREFLIGHT_OFFLINE.json", payload);
    console.log(JSON.stringify(payload, null, 2));
    process.exitCode = offline.ok ? 0 : 1;
    return;
  }

  const accessToken = String(process.env.SUPABASE_ACCESS_TOKEN || "").trim();
  if (!accessToken) {
    const blocked = safetyBase({
      ok: false,
      verdict: COACHING_04_VERDICTS.MISSING_CREDENTIALS_REFUSED,
      message:
        "SUPABASE_ACCESS_TOKEN missing — cannot run live read-only Staging preflight.",
      startedAt,
      finishedAt: new Date().toISOString(),
      finalVerdict: COACHING_04_VERDICTS.MISSING_CREDENTIALS_REFUSED,
    });
    writeEvidence(repoRoot, "ACTIVATION_PREFLIGHT_LIVE_READONLY.json", blocked);
    console.log(JSON.stringify(blocked, null, 2));
    process.exitCode = 1;
    return;
  }

  if (!offline.ok) {
    const blocked = safetyBase({
      ok: false,
      verdict: COACHING_04_VERDICTS.PREFLIGHT_FAIL,
      message: "Offline static preflight failed before live probe.",
      errors: offline.errors,
      ...offline,
      startedAt,
      finishedAt: new Date().toISOString(),
      finalVerdict: COACHING_04_VERDICTS.PREFLIGHT_FAIL,
    });
    writeEvidence(repoRoot, "ACTIVATION_PREFLIGHT_LIVE_READONLY.json", blocked);
    console.log(JSON.stringify(blocked, null, 2));
    process.exitCode = 1;
    return;
  }

  const live = await runLive(accessToken);
  const payload = safetyBase({
    mode: "live-readonly",
    offlineOk: offline.ok,
    combinedManifestHash: offline.combinedManifestHash,
    aggregateSha256Forward: offline.aggregateSha256Forward,
    ...live,
    startedAt,
    finishedAt: new Date().toISOString(),
    finalVerdict: live.verdict,
  });
  writeEvidence(repoRoot, "ACTIVATION_PREFLIGHT_LIVE_READONLY.json", payload);
  console.log(JSON.stringify(payload, null, 2));
  process.exitCode = live.ok ? 0 : 1;
}

main().catch((err) => {
  const payload = safetyBase({
    ok: false,
    verdict: COACHING_04_VERDICTS.PREFLIGHT_FAIL,
    message: redactSecrets(err?.message || String(err)),
    finishedAt: new Date().toISOString(),
    finalVerdict: COACHING_04_VERDICTS.PREFLIGHT_FAIL,
  });
  try {
    writeEvidence(
      getCoaching04RepoRoot(import.meta.url),
      "ACTIVATION_PREFLIGHT_LIVE_READONLY.json",
      payload
    );
  } catch {
    // ignore evidence write failures in fatal path
  }
  console.log(JSON.stringify(payload, null, 2));
  process.exitCode = 1;
});
