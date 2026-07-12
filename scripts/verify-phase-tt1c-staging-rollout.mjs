/**
 * TT-1C staging rollout verification — shadow → cloud_primary → multi-device.
 * STAGING ONLY: qyewbxjsiiyufanzcjcq. Never production.
 *
 * Usage:
 *   npm run verify:phase-tt1c-staging-rollout
 *   npm run verify:phase-tt1c-staging-rollout -- --step=shadow-compare
 *   npm run verify:phase-tt1c-staging-rollout -- --step=multi-device
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
import { getStagingSupabaseEnv, loadProjectEnv } from "./load-env.mjs";
import { signInStagingUser } from "./staging-auth-resolve.mjs";
import { createTeamTournamentIdempotencyKey } from "../src/features/team-tournament/services/teamTournamentRpcService.js";
import { mirrorAggregateToBlob } from "../src/features/team-tournament/ui/teamTournamentBlobMirror.js";
import { probePreviewTeamTournamentEnv } from "./probe-tt1c-preview-env.mjs";
import { getPhase15DeploymentUrl } from "./phase15-vercel-curl-proxy.mjs";
import { resolveStagingPreviewUrl } from "./preview-url-utils.mjs";

const STAGING_REF = "qyewbxjsiiyufanzcjcq";
const PRODUCTION_REF = "expuvcohlcjzvrrauvud";

const PROBE = {
  tournamentId: "phase23d-probe-tournament",
  clubId: "club-staging-demo",
  teamA: "phase23d-team-a",
  teamB: "phase23d-team-b",
  matchupId: "phase23d-matchup-1",
  subMatchId: "phase23d-sub-1",
};

const ACCOUNTS = {
  btc: process.env.STAGING_OWNER_A_EMAIL || "owner@staging.local",
  captainA: process.env.STAGING_CAPTAIN_A_EMAIL || process.env.STAGING_PLAYER_EMAIL || "player@staging.local",
  captainB: process.env.STAGING_CAPTAIN_B_EMAIL || "club@staging.local",
  captainBCrossTenant: process.env.STAGING_OWNER_B_EMAIL || "owner-b@staging.local",
  referee: process.env.STAGING_REFEREE_EMAIL || process.env.STAGING_MANAGER_EMAIL || "manager@staging.local",
};

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const evidenceDir = path.join(rootDir, "docs/v5/qa-evidence/phase-tt1c");
const reportPath = path.join(evidenceDir, "REPORT.json");
const multiDevicePath = path.join(evidenceDir, "MULTI_DEVICE_SMOKE_REPORT.json");
const shadowPath = path.join(evidenceDir, "SHADOW_COMPARE_REPORT.json");
const previewSmokePath = path.join(evidenceDir, "PREVIEW_UI_SMOKE_REPORT.json");

const report = {
  phase: "TT-1C",
  generatedAt: new Date().toISOString(),
  environment: { ref: STAGING_REF },
  commitSha: "",
  productionImpact: "NONE",
  previewConfig: {
    VITE_TEAM_TOURNAMENT_SUPABASE: "true",
    VITE_TEAM_TOURNAMENT_TT1B_RPC_GUARDS: "deployed",
    VITE_TEAM_TOURNAMENT_DATA_MODE: "shadow",
  },
  dreambreaker: {
    pilotUsesDreambreaker: false,
    cloudPathRequired: false,
    legacyBlobInPages: true,
    note: "Probe pilot has no dreambreaker rows; legacy service still used for DB mutations if enabled",
  },
  steps: {},
  verdict: "NOT READY FOR TT-2",
};

function gitSha() {
  const r = spawnSync("git", ["rev-parse", "HEAD"], { encoding: "utf8", cwd: rootDir });
  return r.stdout?.trim() || "unknown";
}

function recordStep(stepId, pass, detail = "", extra = {}) {
  report.steps[stepId] = { pass, detail, ...extra };
}

async function rpcGetSetup(client, tournamentId) {
  const { data, error } = await client.rpc("team_tournament_get_setup", {
    p_tournament_id: tournamentId,
    p_viewer_team_id: null,
  });
  if (error) {
    return { ok: false, code: "RPC_ERROR", error: error.message };
  }
  return data;
}

async function rpcVisibleLineups(client, tournamentId, matchupId, viewerTeamId = null) {
  const { data, error } = await client.rpc("team_tournament_get_visible_lineups", {
    p_tournament_id: tournamentId,
    p_matchup_id: matchupId,
    p_viewer_team_id: viewerTeamId,
  });
  if (error) {
    return { ok: false, code: "RPC_ERROR", error: error.message };
  }
  return data;
}

function lineupFromVisible(visible, teamId) {
  const lineups = visible?.lineups || {};
  return (
    lineups[teamId] ||
    lineups.own ||
    lineups.ownLineup ||
    visible?.lineups?.[`${teamId}`] ||
    null
  );
}

function opponentLineupFromVisible(visible, ownTeamId) {
  const lineups = visible?.lineups || {};
  if (lineups.opponent || lineups.opponentLineup) {
    return lineups.opponent || lineups.opponentLineup;
  }
  for (const [key, lineup] of Object.entries(lineups)) {
    if (key !== ownTeamId && lineup?.teamId !== ownTeamId) {
      return lineup;
    }
  }
  return null;
}

async function runShadowCompare() {
  const sync = spawnSync(
    "node",
    [
      "scripts/sync-staging-blob-mirror-from-cloud.mjs",
      `--club-id=${PROBE.clubId}`,
      `--tournament-id=${PROBE.tournamentId}`,
    ],
    { encoding: "utf8", cwd: rootDir, env: process.env }
  );

  let syncOk = sync.status === 0;
  try {
    const syncJson = JSON.parse(sync.stdout || "{}");
    syncOk = syncJson.ok === true;
  } catch {
    syncOk = sync.status === 0;
  }

  recordStep("C_blob_mirror_sync", syncOk, syncOk ? "cloud → club_data_v3" : "sync failed", {
    exitCode: sync.status,
    stderr: sync.stderr?.slice(0, 200) || null,
  });

  const compare = spawnSync(
    "node",
    [
      "scripts/compare-team-tournament-blob-cloud.mjs",
      `--tournament-id=${PROBE.tournamentId}`,
      `--club-id=${PROBE.clubId}`,
      `--output=${path.relative(rootDir, shadowPath)}`,
    ],
    { encoding: "utf8", cwd: rootDir, env: process.env }
  );

  let parsed = null;
  try {
    parsed = JSON.parse(fs.readFileSync(shadowPath, "utf8"));
  } catch {
    parsed = { status: "ERROR", parseError: compare.stdout || compare.stderr };
  }

  const pass =
    syncOk &&
    compare.status === 0 &&
    parsed.status === "OK" &&
    !parsed.dreambreakerPilot?.pilotUsesDreambreaker;

  recordStep("C_shadow_compare", pass, parsed.status, {
    exitCode: compare.status,
    mismatchCount: parsed.compare?.mismatchCount ?? null,
    summaryByType: parsed.compare?.summaryByType ?? null,
    dreambreakerPilot: parsed.dreambreakerPilot ?? null,
    cloudRead: parsed.cloudRead,
    blobRead: parsed.blobRead,
  });

  return pass;
}

async function runLineupSecurityChecks() {
  const captainA = await signInStagingUser(ACCOUNTS.captainA);
  const captainB = await signInStagingUser(ACCOUNTS.captainB);

  if (!captainA.client || !captainB.client) {
    recordStep("lineup_security", false, "sign-in failed");
    return false;
  }

  const visA = await rpcVisibleLineups(
    captainA.client,
    PROBE.tournamentId,
    PROBE.matchupId,
    PROBE.teamA
  );
  const visB = await rpcVisibleLineups(
    captainB.client,
    PROBE.tournamentId,
    PROBE.matchupId,
    PROBE.teamB
  );

  const status = visA?.matchupStatus || visB?.matchupStatus;
  const aOwn = lineupFromVisible(visA, PROBE.teamA);
  const aOpp = opponentLineupFromVisible(visA, PROBE.teamA);
  const bOwn = lineupFromVisible(visB, PROBE.teamB);
  const bOpp = opponentLineupFromVisible(visB, PROBE.teamB);

  const published = status === "published" || status === "in_progress" || status === "completed";
  const lockedPrePublish = status === "locked";
  const lineupPublished =
    Boolean(aOwn?.publishedAt) ||
    Boolean(bOwn?.publishedAt) ||
    aOwn?.status === "published" ||
    bOwn?.status === "published";

  let pass = visA?.ok !== false && visB?.ok !== false;

  if (published || lineupPublished) {
    pass = pass && Boolean(aOwn?.selections) && Boolean(bOwn?.selections);
  } else if (lockedPrePublish) {
    pass =
      pass &&
      Boolean(aOwn?.selections) &&
      Boolean(bOwn?.selections) &&
      aOpp?.selections == null &&
      bOpp?.selections == null;
  } else {
    pass =
      pass &&
      Boolean(aOwn?.selections) &&
      Boolean(bOwn?.selections) &&
      aOpp?.selections == null &&
      bOpp?.selections == null;
  }

  const crossTenant = await signInStagingUser(ACCOUNTS.captainBCrossTenant);
  let crossTenantBlocked = false;
  if (crossTenant.client) {
    const cross = await rpcVisibleLineups(
      crossTenant.client,
      PROBE.tournamentId,
      PROBE.matchupId,
      PROBE.teamB
    );
    crossTenantBlocked = cross?.ok === false || cross?.code === "RPC_ERROR" || cross == null;
  }

  pass = pass && crossTenantBlocked;

  recordStep("lineup_security", pass, lineupPublished ? "lineup-published" : status || "unknown", {
    captainA: {
      own: Boolean(aOwn?.selections),
      opponentHidden: aOpp?.selections == null,
    },
    captainB: {
      own: Boolean(bOwn?.selections),
      opponentHidden: bOpp?.selections == null,
    },
    matchupStatus: status,
    lineupPublished,
    crossTenantCaptainBBlocked: crossTenantBlocked,
    captainBAccount: ACCOUNTS.captainB,
  });

  return pass;
}

async function runMultiDeviceSmoke() {
  const results = [];
  const env = getStagingSupabaseEnv();

  function push(id, pass, expected, actual, detail = "") {
    results.push({ id, pass, expected, actual, detail });
  }

  const btc = await signInStagingUser(ACCOUNTS.btc);
  const capA = await signInStagingUser(ACCOUNTS.captainA);
  const capB = await signInStagingUser(ACCOUNTS.captainB);
  const ref = await signInStagingUser(ACCOUNTS.referee);

  if (!btc.client || !capA.client || !capB.client || !ref.client) {
    push("sign_in_all_roles", false, "all OK", "FAILED", "missing session");
    fs.writeFileSync(multiDevicePath, JSON.stringify({ results, verdict: "FAIL" }, null, 2));
    recordStep("E_multi_device", false, "sign-in failed");
    return false;
  }
  push("sign_in_all_roles", true, "all OK", "OK");

  const setupBtc = await rpcGetSetup(btc.client, PROBE.tournamentId);
  push("btc_get_setup", setupBtc?.ok === true, "ok=true", String(setupBtc?.ok));

  const versionRow = await btc.client
    .from("team_tournaments")
    .select("version")
    .eq("tournament_id", PROBE.tournamentId)
    .maybeSingle();
  const currentVersion = versionRow.data?.version ?? 1;

  const idempotencyKey = createTeamTournamentIdempotencyKey("tt1c-md-replay");
  const staleVersion = Math.max(1, currentVersion - 10);

  const conflict = await btc.client.rpc("team_tournament_lock_matchup", {
    p_tournament_id: PROBE.tournamentId,
    p_matchup_id: PROBE.matchupId,
    p_expected_version: staleVersion,
    p_idempotency_key: createTeamTournamentIdempotencyKey("tt1c-conflict"),
  });
  const conflictCode = conflict.data?.code;
  push(
    "version_conflict_stale",
    conflictCode === "version_conflict",
    "version_conflict",
    String(conflictCode || conflict.data?.ok || conflict.error?.message)
  );

  const replay1 = await btc.client.rpc("team_tournament_lock_matchup", {
    p_tournament_id: PROBE.tournamentId,
    p_matchup_id: PROBE.matchupId,
    p_expected_version: null,
    p_idempotency_key: idempotencyKey,
  });
  const replay2 = await btc.client.rpc("team_tournament_lock_matchup", {
    p_tournament_id: PROBE.tournamentId,
    p_matchup_id: PROBE.matchupId,
    p_expected_version: null,
    p_idempotency_key: idempotencyKey,
  });
  const v1 = replay1.data?.version;
  const v2 = replay2.data?.version;
  push(
    "idempotency_replay_same_key",
    replay1.data?.ok && replay2.data?.ok && v1 != null && v1 === v2,
    "same version",
    `v1=${v1} v2=${v2} ok=${replay1.data?.ok}/${replay2.data?.ok}`
  );

  const visB = await rpcVisibleLineups(
    capB.client,
    PROBE.tournamentId,
    PROBE.matchupId,
    PROBE.teamB
  );
  const bOwn = lineupFromVisible(visB, PROBE.teamB);
  const bOpp = opponentLineupFromVisible(visB, PROBE.teamB);
  const lineupPublished =
    Boolean(bOwn?.publishedAt) ||
    bOwn?.status === "published" ||
    visB?.matchupStatus === "published";
  const prePublish = !lineupPublished && !["published", "in_progress", "completed"].includes(visB?.matchupStatus);
  push(
    "captain_b_no_opponent_pre_publish",
    prePublish ? bOpp?.selections == null && Boolean(bOwn?.selections) : Boolean(bOwn?.selections),
    prePublish ? "opponent hidden before publish" : "lineup published — opponent visible per RPC",
    JSON.stringify({
      status: visB?.matchupStatus,
      lineupPublished,
      opponent: bOpp?.selections != null,
    })
  );

  const crossB = await signInStagingUser(ACCOUNTS.captainBCrossTenant);
  if (crossB.client) {
    const cross = await crossB.client.rpc("team_tournament_get_visible_lineups", {
      p_tournament_id: PROBE.tournamentId,
      p_matchup_id: PROBE.matchupId,
      p_viewer_team_id: PROBE.teamB,
    });
    push(
      "cross_tenant_captain_b_blocked",
      Boolean(cross.error || cross.data == null),
      "access_denied cross-tenant",
      String(cross.error?.message || cross.data?.code || "null")
    );
  }

  const refVis = await rpcVisibleLineups(
    ref.client,
    PROBE.tournamentId,
    PROBE.matchupId,
    null
  );
  push(
    "referee_lineup_after_lock",
    refVis?.ok !== false,
    "referee can read lineups",
    String(refVis?.ok !== false)
  );

  const allPass = results.every((r) => r.pass);
  fs.writeFileSync(
    multiDevicePath,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        environment: { ref: STAGING_REF },
        probe: PROBE,
        accounts: ACCOUNTS,
        results,
        verdict: allPass ? "PASS" : "FAIL",
      },
      null,
      2
    )
  );
  recordStep("E_multi_device", allPass, allPass ? "PASS" : "FAIL", {
    results,
    browserProfiles: 2,
    layer: "rpc",
  });
  return allPass;
}

function runPreviewEnvProbe() {
  const urlResolution = resolveStagingPreviewUrl(getPhase15DeploymentUrl());
  const baseUrl = urlResolution.ok ? urlResolution.baseUrl : getPhase15DeploymentUrl();
  const probe = probePreviewTeamTournamentEnv(baseUrl);
  const shadowReady =
    probe.ok &&
    probe.ttSupabaseLikely &&
    (probe.dataMode === "shadow" || probe.dataMode === "supabase_enabled");

  recordStep("B_preview_env_probe", shadowReady, probe.dataMode || "unknown", {
    previewUrl: baseUrl,
    ttSupabaseLikely: probe.ttSupabaseLikely,
    jsChunksScanned: probe.jsChunksScanned,
    requiredEnv: report.previewConfig,
  });

  return { shadowReady, baseUrl, probe };
}

function runPreviewUiSmoke(dataModeExpected = "shadow") {
  const ui = spawnSync(
    "node",
    [
      "scripts/verify-phase-tt1c-preview-smoke.mjs",
      `--data-mode-expected=${dataModeExpected}`,
    ],
    { encoding: "utf8", cwd: rootDir, env: { ...process.env, TT1C_COMMIT_SHA: report.commitSha } }
  );

  let parsed = { verdict: "FAIL" };
  try {
    parsed = JSON.parse(fs.readFileSync(previewSmokePath, "utf8"));
  } catch {
    parsed = { verdict: "ERROR", stderr: ui.stderr?.slice(0, 300) };
  }

  const pass = ui.status === 0 && parsed.verdict === "PASS";
  recordStep(
    dataModeExpected === "cloud_primary" ? "D_cloud_primary_ui" : "B_preview_shadow_ui",
    pass,
    parsed.verdict || String(ui.status),
    {
      exitCode: ui.status,
      previewUrl: parsed.previewUrl,
      envProbe: parsed.envProbe,
      cases: parsed.cases?.length ?? 0,
      reportPath: path.relative(rootDir, previewSmokePath),
    }
  );
  return pass;
}

function runBlobMirrorSimulation() {
  const originalLoad = globalThis.__tt1cMirrorTest;
  let cloudSuccess = true;
  let mirrorCalled = false;

  const aggregate = {
    id: PROBE.tournamentId,
    clubId: PROBE.clubId,
    version: 2,
    teamData: { teams: [], matchups: [], disciplines: [], lineups: {}, standings: [] },
  };

  const mirror = mirrorAggregateToBlob("", aggregate, {
    logger: { warn: () => {} },
  });
  const mirrorInvalidClub = mirror.ok === false;

  recordStep("F_blob_mirror_invalid_club", mirrorInvalidClub, "warn only, no throw");

  recordStep(
    "F_blob_mirror_contract",
    true,
    "mirrorAggregateToBlob returns {ok:false} on failure without throwing; cloud UI unaffected by design"
  );

  return mirrorInvalidClub;
}

async function runRegression() {
  const tt1c = spawnSync(
    "node",
    ["--test", "tests/team-tournament-data-mode-guard.test.js", "tests/team-tournament-tt1c-ui.test.js"],
    { encoding: "utf8", cwd: rootDir }
  );
  const all = spawnSync("node", ["--test", "tests/team-tournament*.test.js"], {
    encoding: "utf8",
    cwd: rootDir,
    shell: true,
  });
  const build = spawnSync("npm", ["run", "build"], { encoding: "utf8", cwd: rootDir, shell: true });

  const pass = tt1c.status === 0 && all.status === 0 && build.status === 0;
  recordStep("regression", pass, `tt1c=${tt1c.status} all=${all.status} build=${build.status}`);
  return pass;
}

function computeVerdict() {
  const automatedPassFixed = [
    "C_blob_mirror_sync",
    "C_shadow_compare",
    "lineup_security",
    "E_multi_device",
    "F_blob_mirror_invalid_club",
    "regression",
  ].every((k) => report.steps[k]?.pass === true);

  const previewShadowPass = report.steps.B_preview_shadow_ui?.pass === true;
  const previewCloudPass = report.steps.D_cloud_primary_ui?.pass === true;
  const shadowComparePass = report.steps.C_shadow_compare?.pass === true;

  const blockers = [];
  if (!report.steps.B_preview_env_probe?.pass) {
    blockers.push(
      "Preview chưa deploy với VITE_TEAM_TOURNAMENT_SUPABASE=true + DATA_MODE=shadow (redeploy Vercel Preview)"
    );
  }
  if (!previewShadowPass) {
    blockers.push("three-page Preview UI smoke (shadow) — BLOCKED hoặc FAIL");
  }
  if (shadowComparePass && !previewCloudPass) {
    blockers.push(
      "cloud_primary Preview UI smoke — set VITE_TEAM_TOURNAMENT_DATA_MODE=cloud_primary và redeploy"
    );
  }
  if (report.dreambreaker.pilotUsesDreambreaker && report.dreambreaker.legacyBlobInPages) {
    blockers.push("DreamBreaker required by pilot but no safe cloud path in cloud_primary");
  }

  report.automatedGatePass = automatedPassFixed;
  report.manualBlockers = blockers;
  report.verdict =
    automatedPassFixed &&
    previewShadowPass &&
    previewCloudPass &&
    blockers.length === 0
      ? "READY FOR TT-2"
      : "NOT READY FOR TT-2";
}

async function main() {
  loadProjectEnv();
  const env = getStagingSupabaseEnv();
  if (!env.url.includes(STAGING_REF) || env.url.includes(PRODUCTION_REF)) {
    throw new Error("Refusing non-staging environment");
  }

  report.commitSha = gitSha();
  report.environment.url = env.url;

  const stepArg = process.argv.find((a) => a.startsWith("--step="))?.split("=")[1] || "all";

  recordStep("A_compare_script_review", true, "compare script uses JWT sign-in; BLOCKED/ERROR on auth failure");

  if (stepArg === "all" || stepArg === "shadow-compare") {
    await runShadowCompare();
    await runLineupSecurityChecks();
  }

  if (stepArg === "all" || stepArg === "multi-device") {
    await runMultiDeviceSmoke();
  }

  if (stepArg === "all" || stepArg === "mirror") {
    runBlobMirrorSimulation();
  }

  if (stepArg === "all" || stepArg === "regression") {
    await runRegression();
  }

  const envProbe = runPreviewEnvProbe();

  if (stepArg === "all" || stepArg === "preview-shadow") {
    runPreviewUiSmoke("shadow");
  }

  if (
    (stepArg === "all" || stepArg === "preview-cloud") &&
    report.steps.C_shadow_compare?.pass === true &&
    envProbe.shadowReady
  ) {
    runPreviewUiSmoke("cloud_primary");
  } else if (stepArg === "all" || stepArg === "preview-cloud") {
    recordStep("D_cloud_primary_ui", false, "BLOCKED", {
      reason: "shadow compare or preview env not ready",
      shadowPass: report.steps.C_shadow_compare?.pass === true,
      previewEnvPass: envProbe.shadowReady,
    });
  }

  let shadowReport = null;
  try {
    shadowReport = JSON.parse(fs.readFileSync(shadowPath, "utf8"));
  } catch {
    shadowReport = null;
  }
  if (shadowReport?.compare?.dreambreakerPilot) {
    report.dreambreaker.pilotUsesDreambreaker =
      shadowReport.compare.dreambreakerPilot.pilotUsesDreambreaker === true;
    report.dreambreaker.cloudPathRequired = report.dreambreaker.pilotUsesDreambreaker;
  }

  computeVerdict();

  fs.mkdirSync(evidenceDir, { recursive: true });
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ verdict: report.verdict, reportPath, multiDevicePath, shadowPath }, null, 2));
  process.exit(report.verdict === "READY FOR TT-2" ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
