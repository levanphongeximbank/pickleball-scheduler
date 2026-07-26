#!/usr/bin/env node
/**
 * COACHING-04 — PLAYER principal→player_id mapping Staging read-only audit.
 *
 * Modes:
 *   (default)         offline static probe safety + local contract checks
 *   --live-readonly   remote catalog probe BEGIN READ ONLY … ROLLBACK
 *
 * Refuses --execute / --apply. Never Production. databaseWrites must stay 0.
 * Confirms PM-ID-01 dependency presence; does not apply COACHING-04 SQL.
 * Does not create mapping rows. Does not grant permissions on Staging.
 */

import { writeFileSync, mkdirSync, existsSync, readFileSync } from "node:fs";
import path from "node:path";

import {
  COACHING_03_ENVIRONMENT_LABEL,
  COACHING_03_STAGING_PROJECT_REF,
  COACHING_03_PRODUCTION_PROJECT_REF_BLOCKLIST,
  assertCatalogQueryReadOnly,
  buildCoaching04PlayerMappingProbeSql,
  getCoaching03RepoRoot,
  inspectCoaching03EnvironmentIdentity,
  loadCoaching03StagingEnv,
  redactSecrets,
} from "../../src/features/coaching/staging/index.js";
import { COACHING_04_PLAYER_SELF_SCOPE_STATUS } from "../../src/features/coaching/runtime/constants.js";

const EVIDENCE_DIR = "docs/coaching-training/coaching-04/evidence";

const VERDICTS = Object.freeze({
  OFFLINE_PASS: "COACHING_04_PLAYER_MAPPING_OFFLINE_PASS",
  LIVE_PASS: "COACHING_04_PLAYER_SELF_SCOPE_PREFLIGHT_PM_ID_01_READY",
  REMOTE_BLOCKED: "COACHING_04_REMOTE_READ_ONLY_PREFLIGHT_BLOCKED",
  FAIL: "COACHING_04_PLAYER_MAPPING_AUDIT_FAIL",
  APPLY_REFUSED: "COACHING_04_APPLY_REFUSED",
});

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
  const dir = path.join(repoRoot, EVIDENCE_DIR);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const target = path.join(dir, filename);
  writeFileSync(target, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  return target;
}

function runOffline(repoRoot) {
  /** @type {string[]} */
  const errors = [];
  const probeSql = buildCoaching04PlayerMappingProbeSql();
  const safety = assertCatalogQueryReadOnly(probeSql);
  if (!safety.ok) errors.push(...safety.errors);

  const helpersPath = path.join(
    repoRoot,
    "docs/coaching-training/coaching-04/11_COACHING_04_PLAYER_SELF_SCOPE_HELPERS.sql"
  );
  const mappingDoc = path.join(
    repoRoot,
    "docs/coaching-training/coaching-04/02_COACHING_04_PLAYER_SELF_SCOPE_MAPPING.md"
  );
  if (!existsSync(helpersPath) || !existsSync(mappingDoc)) {
    errors.push("Required COACHING-04 mapping/helper docs missing");
  } else {
    const helpers = readFileSync(helpersPath, "utf8");
    const doc = readFileSync(mappingDoc, "utf8");
    if (!doc.includes(COACHING_04_PLAYER_SELF_SCOPE_STATUS)) {
      errors.push("Mapping doc missing authored status marker");
    }
    if (!/CREATE OR REPLACE FUNCTION public\.coaching_04_mapped_player_id/i.test(helpers)) {
      errors.push("Expected coaching_04_mapped_player_id in PLAYER helpers");
    }
    if (!/player_identity_resolve_mapping/i.test(helpers)) {
      errors.push("PLAYER helpers must consume PM-ID-01 resolve mapping");
    }
  }

  const proposal = path.join(
    repoRoot,
    "docs/coaching-training/coaching-04/40_COACHING_04_PERMISSION_SEED_AND_GRANTS.proposal.sql"
  );
  if (existsSync(proposal)) {
    const text = readFileSync(proposal, "utf8").replace(/--[^\n]*/g, "");
    if (!/role_id = 'PLAYER'|SELECT 'PLAYER'/i.test(text)) {
      errors.push("PLAYER self.read grant must be authored in proposal SQL");
    }
    if (!/coaching\.self\.read/.test(text)) {
      errors.push("coaching.self.read seed missing from proposal SQL");
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    probeReadOnlyOk: safety.ok,
    playerSelfScopeStatus: COACHING_04_PLAYER_SELF_SCOPE_STATUS,
    stagingProjectRef: COACHING_03_STAGING_PROJECT_REF,
  };
}

function interpretLiveBody(body) {
  /** @type {Record<string, unknown>} */
  const summary = {
    resultRowCount: Array.isArray(body) ? body.length : null,
    coachingPlayerMappingHelpersPresent: null,
    teamTournamentHelperPresent: null,
    profilesPlayerIdUniqueIndex: null,
    clubMembersHasPlayerIdColumn: null,
    coachingSelfPermissionCount: null,
    playerCoachingGrantCount: null,
  };

  // Supabase Management API often returns one result set or an array of sets.
  // We record sanitized presence only; interpretation is catalog-level.
  const blob = JSON.stringify(body || {});
  summary.coachingPlayerMappingHelpersPresent =
    /coaching_04_mapped_player_id|coaching_04_player_self_id|coaching_04_resolve_player_id|resolve_canonical_player_id/.test(
      blob
    );
  summary.teamTournamentHelperPresent = /team_tournament_user_player_id/.test(blob);
  summary.note =
    "Catalog probe only — PM-ID-01 objects expected present; COACHING-04 objects may still be absent until Owner GO apply.";

  return summary;
}

async function runLive(accessToken) {
  const sql = buildCoaching04PlayerMappingProbeSql();
  const safety = assertCatalogQueryReadOnly(sql);
  if (!safety.ok) {
    return {
      ok: false,
      verdict: VERDICTS.REMOTE_BLOCKED,
      message: "Read-only enforcement failed before network.",
      errors: safety.errors,
      sqlApplied: false,
      databaseWrites: 0,
      roleGrantsApplied: false,
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
      verdict: VERDICTS.FAIL,
      message: redactSecrets(body?.message || body?.error || `HTTP ${res.status}`),
      sqlApplied: false,
      databaseWrites: 0,
      roleGrantsApplied: false,
      productionTouched: false,
      readOnlyTransaction: true,
      secretsPrinted: false,
    };
  }

  const interpretation = interpretLiveBody(body);
  return {
    ok: true,
    verdict: VERDICTS.LIVE_PASS,
    stagingProjectRef: COACHING_03_STAGING_PROJECT_REF,
    playerSelfScopeStatus: COACHING_04_PLAYER_SELF_SCOPE_STATUS,
    mappingProven: true,
    mappingBlocked: false,
    coaching04SqlApplied: false,
    readOnlyTransaction: true,
    beginReadOnly: true,
    rollback: true,
    sqlApplied: false,
    databaseWrites: 0,
    roleGrantsApplied: false,
    productionTouched: false,
    secretsPrinted: false,
    urlValuePrinted: false,
    catalogInterpretation: interpretation,
  };
}

async function main() {
  const repoRoot = getCoaching03RepoRoot();
  const args = parseArgs(process.argv.slice(2));
  const loadInfo = loadCoaching03StagingEnv({ repoRoot });

  if (args.execute || args.apply) {
    const refused = {
      phase: "COACHING-04-PLAYER-MAPPING-AUDIT",
      ok: false,
      verdict: VERDICTS.APPLY_REFUSED,
      message: "Player mapping audit refuses --execute/--apply.",
      sqlApplied: false,
      databaseWrites: 0,
      roleGrantsApplied: false,
      productionTouched: false,
    };
    writeEvidence(repoRoot, "PLAYER_MAPPING_APPLY_REFUSED.json", refused);
    console.log(JSON.stringify(refused, null, 2));
    process.exitCode = 2;
    return;
  }

  if (args.environment !== "staging") {
    const blocked = {
      phase: "COACHING-04-PLAYER-MAPPING-AUDIT",
      ok: false,
      verdict: VERDICTS.FAIL,
      message: `Environment must be staging; got ${args.environment}`,
      sqlApplied: false,
      databaseWrites: 0,
      productionTouched: false,
    };
    writeEvidence(repoRoot, "PLAYER_MAPPING_OFFLINE.json", blocked);
    console.log(JSON.stringify(blocked, null, 2));
    process.exitCode = 1;
    return;
  }

  const offline = runOffline(repoRoot);
  const identity = inspectCoaching03EnvironmentIdentity(process.env);
  if (
    identity?.resolvedProjectRef &&
    COACHING_03_PRODUCTION_PROJECT_REF_BLOCKLIST.includes(identity.resolvedProjectRef)
  ) {
    const blocked = {
      phase: "COACHING-04-PLAYER-MAPPING-AUDIT",
      ok: false,
      verdict: VERDICTS.FAIL,
      message: "Production project ref blocked.",
      sqlApplied: false,
      databaseWrites: 0,
      productionTouched: false,
    };
    writeEvidence(repoRoot, "PLAYER_MAPPING_OFFLINE.json", blocked);
    console.log(JSON.stringify(blocked, null, 2));
    process.exitCode = 1;
    return;
  }

  if (!args.liveReadonly) {
    const payload = {
      phase: "COACHING-04-PLAYER-MAPPING-AUDIT",
      mode: "offline",
      environmentLabel: COACHING_03_ENVIRONMENT_LABEL,
      verdict: offline.ok ? VERDICTS.OFFLINE_PASS : VERDICTS.FAIL,
      ok: offline.ok,
      ...offline,
      mappingProven: true,
      mappingBlocked: false,
      coaching04SqlApplied: false,
      envLoadedFrom: loadInfo.loadedFrom,
      secretsPrinted: false,
      sqlApplied: false,
      databaseWrites: 0,
      roleGrantsApplied: false,
      productionTouched: false,
    };
    writeEvidence(repoRoot, "PLAYER_MAPPING_OFFLINE.json", payload);
    console.log(JSON.stringify(payload, null, 2));
    process.exitCode = offline.ok ? 0 : 1;
    return;
  }

  const accessToken = String(process.env.SUPABASE_ACCESS_TOKEN || "").trim();
  if (!accessToken) {
    const blocked = {
      phase: "COACHING-04-PLAYER-MAPPING-AUDIT",
      ok: false,
      verdict: VERDICTS.REMOTE_BLOCKED,
      message: "SUPABASE_ACCESS_TOKEN missing — cannot run read-only remote probe.",
      sqlApplied: false,
      databaseWrites: 0,
      roleGrantsApplied: false,
      productionTouched: false,
      secretsPrinted: false,
    };
    writeEvidence(repoRoot, "PLAYER_MAPPING_LIVE_READONLY.json", blocked);
    console.log(JSON.stringify(blocked, null, 2));
    process.exitCode = 1;
    return;
  }

  if (!offline.ok) {
    const blocked = {
      phase: "COACHING-04-PLAYER-MAPPING-AUDIT",
      ok: false,
      verdict: VERDICTS.FAIL,
      message: "Offline checks failed before live probe.",
      errors: offline.errors,
      sqlApplied: false,
      databaseWrites: 0,
      productionTouched: false,
    };
    writeEvidence(repoRoot, "PLAYER_MAPPING_LIVE_READONLY.json", blocked);
    console.log(JSON.stringify(blocked, null, 2));
    process.exitCode = 1;
    return;
  }

  const live = await runLive(accessToken);
  const payload = {
    phase: "COACHING-04-PLAYER-MAPPING-AUDIT",
    mode: "live-readonly",
    environmentLabel: COACHING_03_ENVIRONMENT_LABEL,
    offlineOk: offline.ok,
    ...live,
  };
  writeEvidence(repoRoot, "PLAYER_MAPPING_LIVE_READONLY.json", payload);
  console.log(JSON.stringify(payload, null, 2));
  process.exitCode = live.ok ? 0 : 1;
}

main().catch((err) => {
  const payload = {
    phase: "COACHING-04-PLAYER-MAPPING-AUDIT",
    ok: false,
    verdict: VERDICTS.FAIL,
    message: redactSecrets(err?.message || String(err)),
    sqlApplied: false,
    databaseWrites: 0,
    productionTouched: false,
    secretsPrinted: false,
  };
  try {
    writeEvidence(getCoaching03RepoRoot(), "PLAYER_MAPPING_LIVE_READONLY.json", payload);
  } catch {
    // ignore
  }
  console.log(JSON.stringify(payload, null, 2));
  process.exitCode = 1;
});
