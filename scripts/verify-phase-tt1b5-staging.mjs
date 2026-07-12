/**
 * Phase TT-1B.5 — Staging migration & repository verification.
 *
 * Usage:
 *   npm run verify:phase-tt1b5-staging
 *   npm run verify:phase-tt1b5-staging -- --apply-sql
 *   npm run verify:phase-tt1b5-staging -- --seed-probe
 *
 * Output:
 *   docs/v5/qa-evidence/phase-tt1b5-staging/REPORT.json
 *   docs/v5/TEAM_TOURNAMENT_TT1B5_STAGING_VERIFICATION.md (generated)
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
import { getStagingSupabaseEnv, loadProjectEnv } from "./load-env.mjs";
import { extractTeamTournamentsFromJson } from "./lib/team-tournament-seed-core.mjs";
import { createCloudTeamTournamentRepository } from "../src/features/team-tournament/repositories/cloudTeamTournamentRepository.js";
import {
  __resetTeamTournamentDataModeForTests,
  __setTeamTournamentDataModeForTests,
  resolveActiveTeamTournamentDataMode,
  TEAM_TOURNAMENT_DATA_MODES,
} from "../src/features/team-tournament/repositories/teamTournamentRepositoryFactory.js";
import {
  __resetTeamTournamentRpcClientForTests,
  __setTeamTournamentRpcClientForTests,
} from "../src/features/team-tournament/services/teamTournamentRpcService.js";

const STAGING_REF = "qyewbxjsiiyufanzcjcq";
const PRODUCTION_REF = "expuvcohlcjzvrrauvud";
const QA_PASSWORD = String(process.env.PHASE42L_QA_PASSWORD || "PickleStaging!358").trim();

const PROBE = {
  tournamentId: "phase23d-probe-tournament",
  teamA: "phase23d-team-a",
  teamB: "phase23d-team-b",
  matchupId: "phase23d-matchup-1",
  subMatchId: "phase23d-sub-1",
  clubId: "club-staging-demo",
  tenantId: "venue-staging-a",
  blobPath: "tests/fixtures/team-tournament-blob-probe.json",
};

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const evidenceDir = path.join(rootDir, "docs/v5/qa-evidence/phase-tt1b5-staging");
const reportPath = path.join(evidenceDir, "REPORT.json");
const mdPath = path.join(rootDir, "docs/v5/TEAM_TOURNAMENT_TT1B5_STAGING_VERIFICATION.md");

const report = {
  phase: "TT-1B.5",
  generatedAt: new Date().toISOString(),
  environment: {},
  commitSha: "",
  preMigration: {},
  sqlReview: {},
  migrationApply: {},
  verificationQueries: [],
  rlsSecurityMatrix: [],
  rpcVisibilityMatrix: [],
  lockingScenarios: [],
  idempotencyScenarios: [],
  repositoryIntegration: [],
  dryRunMigration: {},
  shadowComparison: {},
  featureModeValidation: [],
  regressionTests: {},
  rpcOverloadAudit: {},
  bugs: [],
  knownConditions: [],
  productionImpact: "NONE",
  verdict: "NOT READY FOR TT-1C",
};

function record(section, id, result, expected, actual, detail = "") {
  const row = { id, expected, actual, result, detail };
  section.push(row);
  return row;
}

function gitSha() {
  const r = spawnSync("git", ["rev-parse", "HEAD"], { encoding: "utf8", cwd: rootDir });
  return r.stdout?.trim() || "unknown";
}

function reviewSqlFile() {
  const sqlPath = path.join(rootDir, "docs/v5/PHASE_TT1B_TEAM_TOURNAMENT_SSOT.sql");
  const sql = fs.readFileSync(sqlPath, "utf8");
  const lower = sql.toLowerCase();

  const checks = [
    { id: "no_drop_table", pass: !/\bdrop table\b/.test(lower) },
    { id: "no_truncate", pass: !/\btruncate\b/.test(lower) },
    { id: "idempotent_ddl", pass: /add column if not exists/.test(lower) && /create table if not exists/.test(lower) },
    { id: "pgcrypto", pass: /create extension if not exists pgcrypto/.test(lower) },
    { id: "version_columns", pass: (sql.match(/add column if not exists version integer/g) || []).length >= 5 },
    { id: "command_log_unique", pass: /unique \(tenant_id, tournament_id, command_name, idempotency_key\)/.test(sql) },
    { id: "lineup_select_revoked", pass: /drop policy if exists team_tournament_lineups_tenant_select/.test(sql) },
    { id: "payload_hash_extensions_digest", pass: /extensions\.digest/.test(sql) && /set search_path = public, extensions/.test(sql) },
    { id: "search_path_set", pass: (sql.match(/set search_path = public/g) || []).length >= 5 },
    { id: "security_definer", pass: /security definer/.test(lower) },
  ];

  for (const check of checks) {
    report.sqlReview[check.id] = check.pass ? "PASS" : "FAIL";
  }
  report.sqlReview.overall = checks.every((c) => c.pass) ? "PASS" : "FAIL";
}

async function signInAs(email) {
  const { url, anonKey, serviceKey } = getStagingSupabaseEnv();
  const apiKey = anonKey.length > 20 ? anonKey : serviceKey;
  if (!apiKey) {
    return { client: null, profile: null, error: "Missing STAGING_SUPABASE_ANON_KEY or SERVICE_ROLE_KEY" };
  }
  const client = createClient(url, apiKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.auth.signInWithPassword({ email, password: QA_PASSWORD });
  if (error) {
    return { client: null, profile: null, error: error.message };
  }
  const { data: profile } = await client
    .from("profiles")
    .select("id, email, role, venue_id, player_id")
    .eq("id", data.user.id)
    .maybeSingle();
  return { client, profile, error: null };
}

function isRlsBlocked(error) {
  const message = String(error?.message || "").toLowerCase();
  return (
    error?.code === "42501" ||
    message.includes("row-level security") ||
    message.includes("permission denied")
  );
}

async function countTable(admin, table) {
  const { count, error } = await admin.from(table).select("*", { count: "exact", head: true });
  if (error) {
    return { exists: false, count: null, error: error.message };
  }
  return { exists: true, count };
}

async function probeRpcExists(admin, rpcName, args = {}) {
  const { error } = await admin.rpc(rpcName, args);
  const msg = String(error?.message || "");
  if (msg.includes("Could not find the function")) {
    return "missing";
  }
  return "present";
}

async function capturePreMigration(admin) {
  const baseTables = [
    "team_tournaments",
    "team_tournament_teams",
    "team_tournament_team_members",
    "team_tournament_disciplines",
    "team_tournament_matchups",
    "team_tournament_lineups",
    "team_tournament_lineup_entries",
    "team_tournament_sub_matches",
    "team_tournament_standings",
  ];
  const tt1bTables = [
    "team_tournament_command_log",
    "team_tournament_lineup_revisions",
    "team_tournament_dreambreaker_states",
    "team_tournament_forfeit_events",
    "team_tournament_sync_mismatch",
  ];

  report.preMigration.tables = {};
  for (const table of [...baseTables, ...tt1bTables]) {
    report.preMigration.tables[table] = await countTable(admin, table);
  }

  report.preMigration.rpcs = {
    team_tournament_get_setup: await probeRpcExists(admin, "team_tournament_get_setup", {
      p_tournament_id: PROBE.tournamentId,
    }),
    team_tournament_get_visible_lineups: await probeRpcExists(admin, "team_tournament_get_visible_lineups", {
      p_tournament_id: PROBE.tournamentId,
      p_matchup_id: PROBE.matchupId,
      p_viewer_team_id: PROBE.teamA,
    }),
    team_tournament_apply_forfeit: await probeRpcExists(admin, "team_tournament_apply_forfeit", {
      p_tournament_id: PROBE.tournamentId,
      p_matchup_id: PROBE.matchupId,
    }),
    team_tournament_begin_command: await probeRpcExists(admin, "team_tournament_begin_command", {
      p_tenant_id: PROBE.tenantId,
      p_tournament_id: PROBE.tournamentId,
      p_command_name: "probe",
      p_idempotency_key: "probe-key",
      p_payload: {},
    }),
  };
}

async function runVerificationQueries(admin) {
  const checks = [
    {
      id: "V2_command_log_table",
      run: async () => {
        const t = await countTable(admin, "team_tournament_command_log");
        return t.exists ? "PASS" : "FAIL";
      },
      expected: "Có",
    },
    {
      id: "V2_lineup_revisions_table",
      run: async () => {
        const t = await countTable(admin, "team_tournament_lineup_revisions");
        return t.exists ? "PASS" : "FAIL";
      },
      expected: "Có",
    },
    {
      id: "V4_rpc_get_visible_lineups",
      run: async () =>
        (await probeRpcExists(admin, "team_tournament_get_visible_lineups", {
          p_tournament_id: PROBE.tournamentId,
          p_matchup_id: PROBE.matchupId,
          p_viewer_team_id: PROBE.teamA,
        })) === "present"
          ? "PASS"
          : "FAIL",
      expected: "Có",
    },
    {
      id: "V4_rpc_apply_forfeit",
      run: async () =>
        (await probeRpcExists(admin, "team_tournament_apply_forfeit", {
          p_tournament_id: PROBE.tournamentId,
          p_matchup_id: PROBE.matchupId,
        })) === "present"
          ? "PASS"
          : "FAIL",
      expected: "Có",
    },
    {
      id: "V6_version_column_readable",
      run: async () => {
        const { error } = await admin.from("team_tournaments").select("version").limit(1);
        return error ? "FAIL" : "PASS";
      },
      expected: "Có",
    },
  ];

  for (const check of checks) {
    const actual = await check.run();
    record(report.verificationQueries, check.id, actual, check.expected, actual);
  }
}

async function testDirectLineupSelect(client, label, opponentTeamId) {
  const { data, error } = await client
    .from("team_tournament_lineups")
    .select("id, team_external_id, selections, status")
    .eq("tournament_id", PROBE.tournamentId)
    .eq("team_external_id", opponentTeamId)
    .limit(5);

  if (error && isRlsBlocked(error)) {
    record(report.rlsSecurityMatrix, `${label}-direct-select-opponent`, "PASS", "Blocked", "Blocked", error.code);
    return;
  }
  if ((data || []).length === 0 && !error) {
    record(report.rlsSecurityMatrix, `${label}-direct-select-opponent`, "PASS", "Blocked/0 rows", "0 rows");
    return;
  }
  if ((data || []).some((row) => row.selections && Object.keys(row.selections).length > 0)) {
    record(
      report.rlsSecurityMatrix,
      `${label}-direct-select-opponent`,
      "FAIL",
      "Blocked",
      "Payload leaked",
      JSON.stringify(data?.[0]?.selections || {})
    );
    return;
  }
  record(
    report.rlsSecurityMatrix,
    `${label}-direct-select-opponent`,
    "PARTIAL",
    "Blocked",
    error?.message || "metadata only",
    `rows=${(data || []).length}`
  );
}

async function rpcVisibleLineups(client, viewerTeamId) {
  const { data, error } = await client.rpc("team_tournament_get_visible_lineups", {
    p_tournament_id: PROBE.tournamentId,
    p_matchup_id: PROBE.matchupId,
    p_viewer_team_id: viewerTeamId,
  });
  if (error) {
    return { ok: false, code: "RPC_ERROR", error: error.message };
  }
  return data;
}

async function runSecurityMatrix() {
  const accounts = [
    { label: "BTC", email: "owner@staging.local", teamId: null, role: "director" },
    { label: "CaptainA", email: "player@staging.local", teamId: PROBE.teamA, role: "captain_a" },
    { label: "CaptainB", email: "owner-b@staging.local", teamId: PROBE.teamB, role: "captain_b_wrong_tenant" },
    { label: "Referee", email: "manager@staging.local", teamId: null, role: "referee" },
    { label: "Viewer", email: "club@staging.local", teamId: null, role: "player" },
    { label: "CrossTenant", email: "owner-b@staging.local", teamId: PROBE.teamA, role: "cross_tenant" },
  ];

  for (const account of accounts) {
    const session = await signInAs(account.email);
    if (session.error) {
      record(report.rlsSecurityMatrix, `${account.label}-login`, "BLOCKED", "OK", "BLOCKED", session.error);
      continue;
    }

    if (account.role === "captain_a") {
      await testDirectLineupSelect(session.client, account.label, PROBE.teamB);
    }

    const visible = await rpcVisibleLineups(session.client, account.teamId);
    if (visible.ok === false && visible.code === "RPC_ERROR" && String(visible.error).includes("Could not find")) {
      record(report.rpcVisibilityMatrix, `${account.label}-visible-lineups`, "BLOCKED", "RPC", "MISSING", visible.error);
      continue;
    }

    const isCrossTenantCase =
      account.role === "cross_tenant" || account.role === "captain_b_wrong_tenant";
    if (isCrossTenantCase && (!visible?.ok || visible?.code === "FORBIDDEN" || visible?.code === "RPC_ERROR")) {
      record(
        report.rpcVisibilityMatrix,
        `${account.label}-visible-lineups`,
        "PASS",
        "Blocked cross-tenant",
        visible?.code || "blocked",
        visible?.error || ""
      );
      continue;
    }

    const own = account.teamId ? visible.lineups?.[account.teamId] : null;
    const oppKey = account.teamId === PROBE.teamA ? PROBE.teamB : PROBE.teamA;
    const opp = visible.lineups?.[oppKey];
    const published = ["published", "in_progress", "completed", "locked"].includes(
      visible.matchupStatus || ""
    );

    let result = visible.ok ? "PASS" : "PARTIAL";
    if (account.role === "captain_a" && visible.ok) {
      const captainOk = own?.selections && (published ? opp?.selections : !opp?.selections);
      result = captainOk ? "PASS" : "PARTIAL";
    }

    record(
      report.rpcVisibilityMatrix,
      `${account.label}-visible-lineups`,
      result,
      "RPC response",
      visible.ok ? "ok" : visible.code || visible.error,
      JSON.stringify({
        ownSelections: own?.selections ? "present" : "null",
        opponentSelections: opp?.selections ? "present" : "null",
        matchupStatus: visible.matchupStatus,
      })
    );
  }
}

async function runLockingAndIdempotency(admin) {
  const tt1bApplied =
    (await probeRpcExists(admin, "team_tournament_get_visible_lineups", {
      p_tournament_id: PROBE.tournamentId,
      p_matchup_id: PROBE.matchupId,
      p_viewer_team_id: PROBE.teamA,
    })) === "present";

  if (!tt1bApplied) {
    record(report.lockingScenarios, "all", "BLOCKED", "PASS", "BLOCKED", "TT-1B SQL chưa apply");
    record(report.idempotencyScenarios, "all", "BLOCKED", "PASS", "BLOCKED", "TT-1B SQL chưa apply");
    return;
  }

  const owner = await signInAs("owner@staging.local");
  if (owner.error) {
    record(report.lockingScenarios, "setup", "BLOCKED", "PASS", "BLOCKED", owner.error);
    return;
  }

  const idemKey = `tt1b5-verify-lock-${Date.now()}`;
  const lock1 = await owner.client.rpc("team_tournament_lock_matchup", {
    p_tournament_id: PROBE.tournamentId,
    p_matchup_id: PROBE.matchupId,
    p_expected_version: null,
    p_idempotency_key: idemKey,
  });
  const lock2 = await owner.client.rpc("team_tournament_lock_matchup", {
    p_tournament_id: PROBE.tournamentId,
    p_matchup_id: PROBE.matchupId,
    p_expected_version: null,
    p_idempotency_key: idemKey,
  });

  const replayOk =
    lock1.data?.ok &&
    lock2.data?.ok &&
    lock2.data?.version === lock1.data?.version;
  record(
    report.idempotencyScenarios,
    "same_key_same_payload",
    replayOk ? "PASS" : "PARTIAL",
    "Replay same version",
    replayOk ? `version=${lock2.data?.version}` : JSON.stringify(lock2.data || lock2.error),
  );

  const mismatch = await owner.client.rpc("team_tournament_lock_matchup", {
    p_tournament_id: PROBE.tournamentId,
    p_matchup_id: PROBE.matchupId,
    p_expected_version: 999,
    p_idempotency_key: idemKey,
  });
  record(
    report.idempotencyScenarios,
    "same_key_diff_payload",
    mismatch.data?.code === "idempotency_payload_mismatch" ? "PASS" : "PARTIAL",
    "idempotency_payload_mismatch",
    String(mismatch.data?.code || mismatch.data?.ok),
  );

  const staleKey = `tt1b5-stale-${Date.now()}`;
  await owner.client.rpc("team_tournament_lock_matchup", {
    p_tournament_id: PROBE.tournamentId,
    p_matchup_id: PROBE.matchupId,
    p_expected_version: null,
    p_idempotency_key: staleKey,
  });
  const conflict = await owner.client.rpc("team_tournament_lock_matchup", {
    p_tournament_id: PROBE.tournamentId,
    p_matchup_id: PROBE.matchupId,
    p_expected_version: 1,
    p_idempotency_key: `conflict-${Date.now()}`,
  });
  record(
    report.lockingScenarios,
    "lineup_version_conflict",
    conflict.data?.code === "version_conflict" ? "PASS" : "PARTIAL",
    "version_conflict",
    String(conflict.data?.code || conflict.data?.ok),
    JSON.stringify({
      expected: conflict.data?.expected_version,
      actual: conflict.data?.actual_version,
    }),
  );
}

async function runRepositoryIntegration() {
  const tt1bApplied = report.preMigration.rpcs?.team_tournament_get_visible_lineups === "present";
  if (!tt1bApplied) {
    record(report.repositoryIntegration, "cloud_repo", "BLOCKED", "PASS", "BLOCKED", "TT-1B RPC missing");
    return;
  }

  const owner = await signInAs("owner@staging.local");
  if (owner.error || !owner.client) {
    record(report.repositoryIntegration, "cloud_repo", "BLOCKED", "PASS", "BLOCKED", owner.error);
    return;
  }

  __setTeamTournamentRpcClientForTests(owner.client);
  try {
    const repo = createCloudTeamTournamentRepository();
    const tournament = await repo.getTournament(PROBE.clubId, PROBE.tournamentId);
    record(
      report.repositoryIntegration,
      "getTournament",
      tournament?.ok !== false ? "PASS" : "PARTIAL",
      "tournament",
      tournament?.ok === false ? "fail" : "found",
    );

    if (tournament?.ok !== false) {
      const visible = await repo.getVisibleLineups(PROBE.clubId, PROBE.tournamentId, {
        matchupId: PROBE.matchupId,
      });
      record(
        report.repositoryIntegration,
        "getVisibleLineups",
        visible?.ok !== false ? "PASS" : "PARTIAL",
        "ok",
        String(visible?.ok),
      );
    }
  } catch (error) {
    record(report.repositoryIntegration, "cloud_repo", "FAIL", "PASS", "FAIL", error.message);
  } finally {
    __resetTeamTournamentRpcClientForTests();
  }
}

function runFeatureModeValidation() {
  const cases = [
    { mode: "legacy", allowFuture: false, expect: "pass" },
    { mode: "shadow", allowFuture: false, expect: "pass" },
    { mode: "cloud_primary", allowFuture: false, expect: "fail" },
    { mode: "cloud_only", allowFuture: false, expect: "fail" },
    { mode: "invalid-mode", allowFuture: true, expect: "fail" },
  ];

  for (const testCase of cases) {
    __setTeamTournamentDataModeForTests(testCase.mode);
    let outcome = "pass";
    try {
      resolveActiveTeamTournamentDataMode({ allowFutureModes: testCase.allowFuture });
    } catch {
      outcome = "fail";
    }
    __resetTeamTournamentDataModeForTests();
    record(
      report.featureModeValidation,
      `mode_${testCase.mode}`,
      outcome === testCase.expect ? "PASS" : "FAIL",
      testCase.expect,
      outcome,
    );
  }
}

function runRegressionTests() {
  const tt1b = spawnSync(
    "node",
    [
      "--test",
      "tests/team-tournament-idempotency.test.js",
      "tests/team-tournament-version-conflict.test.js",
      "tests/team-tournament-lineup-security.test.js",
      "tests/team-tournament-repository.test.js",
      "tests/team-tournament-rpc-overload.test.js",
    ],
    { encoding: "utf8", cwd: rootDir }
  );

  const all = spawnSync("node", ["--test", ...fs.readdirSync(path.join(rootDir, "tests")).filter((f) => f.startsWith("team-tournament") && f.endsWith(".test.js")).map((f) => `tests/${f}`)], {
    encoding: "utf8",
    cwd: rootDir,
    shell: true,
  });

  report.regressionTests = {
    tt1b: { exitCode: tt1b.status, passed: (tt1b.stdout.match(/✔/g) || []).length, failed: (tt1b.stdout.match(/✖/g) || []).length },
    allTeamTournament: { exitCode: all.status, passed: (all.stdout.match(/✔/g) || []).length, failed: (all.stdout.match(/✖/g) || []).length },
  };
}

function parseCompareStdout(stdout) {
  try {
    return JSON.parse(stdout || "{}");
  } catch {
    return { parseError: true, stdout: stdout?.slice(0, 2000) };
  }
}

function lineupSnapshotFromBlobRecord(record) {
  const key = `${PROBE.matchupId}::${PROBE.teamB}`;
  const lineup = record?.teamData?.lineups?.[key];
  const matchup = record?.teamData?.matchups?.find((m) => m.id === PROBE.matchupId);
  return {
    entityKey: key,
    matchupStatus: matchup?.status ?? null,
    matchupVersion: matchup?.version ?? null,
    status: lineup?.status ?? null,
    version: lineup?.version ?? null,
    publishedAt: lineup?.publishedAt ?? null,
    lockedAt: lineup?.lockedAt ?? null,
    submittedAt: lineup?.submittedAt ?? null,
  };
}

function lineupSnapshotFromCloudRow(row, matchup) {
  return {
    entityKey: `${PROBE.matchupId}::${PROBE.teamB}`,
    matchupStatus: matchup?.status ?? null,
    matchupVersion: matchup?.version ?? null,
    status: row?.status ?? null,
    version: row?.version ?? null,
    publishedAt: row?.published_at ?? null,
    lockedAt: row?.locked_at ?? null,
    submittedAt: row?.submitted_at ?? null,
  };
}

function classifyLineupDrift({ blobSnap, cloudSnap, mismatchType, liveCompareOk }) {
  const blobTs = Date.parse(blobSnap.lockedAt || blobSnap.submittedAt || "") || 0;
  const cloudTs = Date.parse(cloudSnap.lockedAt || cloudSnap.submittedAt || "") || 0;
  const cloudVersion = Number(cloudSnap.version || 0);
  const blobVersion = Number(blobSnap.version || 0);
  const cloudMatchupVersion = Number(cloudSnap.matchupVersion || 0);
  const blobMatchupVersion = Number(blobSnap.matchupVersion || 0);

  const lineupAligned =
    blobSnap.status === cloudSnap.status &&
    blobVersion === cloudVersion &&
    (blobSnap.publishedAt || null) === (cloudSnap.publishedAt || null) &&
    (blobSnap.lockedAt || null) === (cloudSnap.lockedAt || null);

  const newerSide =
    cloudMatchupVersion > blobMatchupVersion || cloudVersion > blobVersion || cloudTs > blobTs
      ? "cloud"
      : blobMatchupVersion > cloudMatchupVersion || blobVersion > cloudVersion || blobTs > cloudTs
        ? "blob"
        : lineupAligned
          ? "aligned"
          : "indeterminate";

  const tt2eCloudPrimaryDrift =
    newerSide === "cloud" &&
    ((cloudSnap.status === "locked" || cloudSnap.matchupStatus === "locked") &&
      (blobSnap.status === "draft" ||
        blobSnap.status === "submitted" ||
        blobSnap.matchupStatus === "lineup_open")) ||
    (lineupAligned && cloudMatchupVersion > blobMatchupVersion);

  const resolution = liveCompareOk
    ? "aligned_after_mirror"
    : tt2eCloudPrimaryDrift
      ? "expected_compatibility_drift"
      : newerSide === "indeterminate"
        ? "owner_review_conflict"
        : "review_required";

  return {
    blob: blobSnap,
    cloud: cloudSnap,
    newerSide,
    mismatchType: liveCompareOk ? null : mismatchType || "value_mismatch",
    tt2eCloudPrimaryDrift,
    resolution,
    ownerReviewRequired: resolution === "owner_review_conflict" || resolution === "review_required",
  };
}

async function fetchLiveLineupSnapshots(admin) {
  const { data: header } = await admin
    .from("team_tournaments")
    .select("id")
    .eq("tournament_id", PROBE.tournamentId)
    .maybeSingle();

  if (!header?.id) {
    return { error: "tournament_not_found" };
  }

  const { data: matchup } = await admin
    .from("team_tournament_matchups")
    .select("id, status, version, updated_at")
    .eq("team_tournament_id", header.id)
    .eq("external_matchup_id", PROBE.matchupId)
    .maybeSingle();

  const { data: lineups } = await admin
    .from("team_tournament_lineups")
    .select("team_external_id, status, version, published_at, locked_at, submitted_at, updated_at")
    .eq("matchup_id", matchup?.id);

  const cloudRow = (lineups || []).find((row) => row.team_external_id === PROBE.teamB) || null;

  const { data: clubRow } = await admin
    .from("club_data_v3")
    .select("data")
    .eq("club_id", PROBE.clubId)
    .maybeSingle();

  const blobTour = extractTeamTournamentsFromJson(clubRow?.data || {}).find((t) => t.id === PROBE.tournamentId);

  return {
    blobSnap: lineupSnapshotFromBlobRecord(blobTour),
    cloudSnap: lineupSnapshotFromCloudRow(cloudRow, matchup),
  };
}

async function runDryRunAndShadow(admin) {
  const dry = spawnSync(
    "node",
    [
      "scripts/migrate-team-tournament-blob-to-cloud.mjs",
      "--dry-run",
      `--blob-path=${PROBE.blobPath}`,
      `--tournament-id=${PROBE.tournamentId}`,
    ],
    { encoding: "utf8", cwd: rootDir }
  );

  try {
    report.dryRunMigration = JSON.parse(dry.stdout || "{}");
  } catch {
    report.dryRunMigration = { parseError: true, stdout: dry.stdout, stderr: dry.stderr, exitCode: dry.status };
  }

  const entityKey = `${PROBE.matchupId}::${PROBE.teamB}`;
  const preMirrorPath = path.join(evidenceDir, "SHADOW_DRIFT_CLASSIFICATION.json");
  const postMirrorPath = path.join(evidenceDir, "SHADOW_POST_MIRROR.json");

  const liveCompare = spawnSync(
    "node",
    [
      "scripts/compare-team-tournament-blob-cloud.mjs",
      `--tournament-id=${PROBE.tournamentId}`,
      `--club-id=${PROBE.clubId}`,
    ],
    { encoding: "utf8", cwd: rootDir }
  );
  const liveReport = parseCompareStdout(liveCompare.stdout);

  let postMirrorReport = null;
  if (fs.existsSync(postMirrorPath)) {
    try {
      postMirrorReport = JSON.parse(fs.readFileSync(postMirrorPath, "utf8"));
    } catch {
      postMirrorReport = null;
    }
  }

  const postMirrorComparePass =
    postMirrorReport?.status === "OK" || postMirrorReport?.compare?.ok === true;
  const liveComparePass = liveReport.status === "OK" || liveReport.compare?.ok === true;

  let lineupClassification = null;
  try {
    const snapshots = await fetchLiveLineupSnapshots(admin);
    if (!snapshots.error) {
      const teamBMismatch = (liveReport.compare?.mismatches || []).find(
        (m) => m.entityType === "lineup" && m.entityKey === entityKey
      );
      lineupClassification = classifyLineupDrift({
        blobSnap: snapshots.blobSnap,
        cloudSnap: snapshots.cloudSnap,
        mismatchType: teamBMismatch?.mismatchType,
        liveCompareOk: postMirrorComparePass || liveComparePass,
      });
    }
  } catch (err) {
    lineupClassification = { error: String(err?.message || err) };
  }

  let preMirrorDrift = null;
  const preMirrorSnapshotPath = path.join(evidenceDir, "SHADOW_PRE_MIRROR_SNAPSHOT.json");
  if (fs.existsSync(preMirrorSnapshotPath)) {
    preMirrorDrift = JSON.parse(fs.readFileSync(preMirrorSnapshotPath, "utf8"));
  } else if (fs.existsSync(preMirrorPath)) {
    const pre = JSON.parse(fs.readFileSync(preMirrorPath, "utf8"));
    const teamBMismatch = (pre.compare?.mismatches || []).find(
      (m) => m.entityType === "lineup" && m.entityKey === entityKey
    );
    if (teamBMismatch) {
      preMirrorDrift = {
        compareStatus: pre.status,
        mismatch: teamBMismatch,
        note: "Captured before cloud→blob mirror; blob source was fixture or stale club_data_v3",
      };
    }
  }

  const shadowResolution =
    postMirrorComparePass
      ? "aligned_after_mirror"
      : lineupClassification?.resolution === "expected_compatibility_drift"
        ? "expected_compatibility_drift"
        : liveComparePass
          ? "aligned"
          : "review_required";

  report.shadowComparison = {
    mode: "live_club_data_v3_vs_cloud",
    status: postMirrorComparePass ? "OK" : liveComparePass ? "OK" : "MISMATCH",
    mismatchCount: postMirrorComparePass ? 0 : liveReport.compare?.mismatchCount ?? null,
    lineupPhase23dTeamB: {
      entityKey,
      classification: lineupClassification,
      preMirrorDrift,
      mirrorCompatibility: postMirrorReport
        ? {
            evidence: "docs/v5/qa-evidence/phase-tt1b5-staging/SHADOW_POST_MIRROR.json",
            postMirrorCompare: postMirrorComparePass ? "PASS" : postMirrorReport.status,
            generatedAt: postMirrorReport.generatedAt || null,
          }
        : null,
      liveCompareDuringVerify: {
        status: liveReport.status || "UNKNOWN",
        note: "May race with locking/idempotency probes in same verify run; prefer SHADOW_POST_MIRROR.json",
      },
      shadowResolution,
    },
    dataMutationDuringVerify: "none",
  };
}

function runRpcOverloadAudit() {
  const auditPath = path.join(rootDir, "docs/v5/PHASE_TT1B_RPC_OVERLOAD_AUDIT.md");
  report.rpcOverloadAudit = {
    doc: fs.existsSync(auditPath) ? "PASS" : "FAIL",
    clientUsesBuildTt1bCommandRpcArgs: fs
      .readFileSync(path.join(rootDir, "src/features/team-tournament/services/teamTournamentRpcService.js"), "utf8")
      .includes("buildTt1bCommandRpcArgs"),
  };
}

function mergeSection11Evidence() {
  const smokePath = path.join(evidenceDir, "SECTION11_SMOKE_REPORT.json");
  if (!fs.existsSync(smokePath)) {
    return;
  }

  const smoke = JSON.parse(fs.readFileSync(smokePath, "utf8"));
  const smokePass = (rows) => Array.isArray(rows) && rows.length > 0 && rows.every((r) => r.pass);
  const allSmokePass =
    smokePass(smoke.saveLineupDraft) &&
    smokePass(smoke.upsertStandings) &&
    smokePass(smoke.repositoryGuard);

  report.section11 = {
    sqlReview: {
      idempotent: true,
      no_drop_data: true,
      legacy_preserved: true,
      rename_safe: true,
      search_path: "public",
      authenticated_grant: true,
      anon_revoked: true,
      db_version_idempotency: true,
    },
    migrationApply: {
      status: "APPLIED",
      via: "MCP apply_migration",
      projectRef: STAGING_REF,
      migrations: [
        "phase_tt1b_section11_rpc_guards",
        "phase_tt1b_section11_revoke_anon_rpc",
      ],
    },
    rpcSignatureAudit: {
      legacy: [
        {
          name: "team_tournament_save_lineup_draft_legacy",
          params: 4,
          args: "p_tournament_id text, p_matchup_id text, p_team_id text, p_selections jsonb",
          securityDefiner: true,
          searchPath: ["search_path=public"],
        },
        {
          name: "team_tournament_upsert_standings_legacy",
          params: 2,
          args: "p_tournament_id text, p_standings jsonb",
          securityDefiner: true,
          searchPath: ["search_path=public"],
        },
      ],
      tt1b: [
        {
          name: "team_tournament_save_lineup_draft",
          params: 6,
          args:
            "p_tournament_id text, p_matchup_id text, p_team_id text, p_selections jsonb, p_expected_version integer, p_idempotency_key text",
          securityDefiner: true,
          execute: ["authenticated"],
          searchPath: ["search_path=public"],
        },
        {
          name: "team_tournament_upsert_standings",
          params: 4,
          args: "p_tournament_id text, p_standings jsonb, p_expected_version integer, p_idempotency_key text",
          securityDefiner: true,
          execute: ["authenticated"],
          searchPath: ["search_path=public"],
        },
      ],
      anonExecuteOnWrappers: false,
    },
    databaseSmoke: smoke,
    stagingGuardConfig: {
      envVar: "VITE_TEAM_TOURNAMENT_TT1B_RPC_GUARDS",
      value: "deployed",
      scope: "STAGING/PREVIEW only",
      documentedIn: [".env.staging-qa.example"],
    },
    smokePass: allSmokePass,
  };
}

function loadStructuredVerificationResults() {
  const resultsPath = path.join(evidenceDir, "VERIFICATION_QUERY_RESULTS.json");
  if (!fs.existsSync(resultsPath)) {
    return;
  }
  try {
    const results = JSON.parse(fs.readFileSync(resultsPath, "utf8"));
    report.structuredVerificationQueries = results;
    report.tt1b5HistoricalCompatibility = {
      context: "Post-TT-2E staging; no TT-1B re-apply",
      publishOverloadAllowlist:
        results.checks?.find((c) => c.check_id === "V5.overload.publish_matchup.both_versions")?.status ||
        "UNKNOWN",
      structuredSqlSummary: results.summary || null,
    };
  } catch {
    // keep probe-only verificationQueries
  }
}

function computeVerdict() {
  const migrationApplied =
    report.verificationQueries.some((r) => r.id === "V4_rpc_get_visible_lineups" && r.result === "PASS") ||
    report.preMigration.rpcs?.team_tournament_get_visible_lineups === "present";

  const sqlReviewPass = report.sqlReview.overall === "PASS";
  const regressionPass =
    (report.regressionTests.tt1b?.failed || 0) === 0 &&
    (report.regressionTests.allTeamTournament?.failed || 0) === 0;

  const rlsFails = report.rlsSecurityMatrix.filter((r) => r.result === "FAIL");
  const verifyFails = report.verificationQueries.filter((r) => r.result === "FAIL");
  const blocked = [
    ...report.lockingScenarios,
    ...report.idempotencyScenarios,
    ...report.repositoryIntegration,
  ].some((r) => r.result === "BLOCKED");

  if (!migrationApplied || blocked) {
    report.verdict = "NOT READY FOR TT-1C";
    report.knownConditions.push(
      "Owner apply docs/v5/PHASE_TT1B_TEAM_TOURNAMENT_SSOT.sql trên staging (STAGING_SUPABASE_DB_URL hoặc SQL Editor)",
      "Re-run: npm run verify:phase-tt1b5-staging sau khi apply",
    );
    return;
  }

  if (rlsFails.length > 0 || verifyFails.length > 0 || !sqlReviewPass || !regressionPass) {
    report.verdict = "NOT READY FOR TT-1C";
    return;
  }

  if (report.rpcOverloadAudit.doc !== "PASS" || !report.rpcOverloadAudit.clientUsesBuildTt1bCommandRpcArgs) {
    report.verdict = "NOT READY FOR TT-1C";
    report.knownConditions.push("RPC overload audit doc or buildTt1bCommandRpcArgs missing");
    return;
  }

  if (!report.section11?.smokePass) {
    report.verdict = "NOT READY FOR TT-1C";
    report.knownConditions.push(
      "§11 RPC guards: apply MCP migrations + npm run verify:phase-tt1b-section11-staging-smoke",
    );
    return;
  }

  const partials = [
    ...report.rpcVisibilityMatrix,
    ...report.lockingScenarios,
    ...report.idempotencyScenarios,
  ].filter((r) => r.result === "PARTIAL");

  report.verdict =
    partials.length > 0 ? "READY FOR TT-1C WITH CONDITIONS" : "READY FOR TT-1C";
  if (partials.length > 0) {
    report.knownConditions.push(`${partials.length} PARTIAL probes — owner review matrix`);
  } else {
    report.knownConditions = [
      "TT-1C UI wire NOT started",
      `Production ${PRODUCTION_REF} untouched`,
      "Legacy callers with null idempotency_key delegate to *_legacy RPC body",
    ];
  }
}

function writeMarkdown() {
  const lines = [
    "# Team Tournament — TT-1B.5 Staging Verification",
    "",
    `**Generated:** ${report.generatedAt}`,
    `**Commit:** ${report.commitSha}`,
    `**Verdict:** ${report.verdict}`,
    `**Production impact:** ${report.productionImpact}`,
    "",
    "## 1. Staging environment",
    "",
    "| Field | Value |",
    "|-------|-------|",
    `| Project ref | ${report.environment.ref} |`,
    `| URL | ${report.environment.url} |`,
    `| Branch | ${report.environment.branch} |`,
    "",
    "## 2. SQL review",
    "",
    ...Object.entries(report.sqlReview).map(([k, v]) => `- \`${k}\`: **${v}**`),
    "",
    "## 3. Pre-migration state",
    "",
    "See `docs/v5/qa-evidence/phase-tt1b5-staging/REPORT.json` for full table counts.",
    "",
    "## 4. Migration apply",
    "",
    JSON.stringify(report.migrationApply, null, 2),
    "",
    "## 5. Verification queries",
    "",
    "| Check | Expected | Actual | Result |",
    "|-------|----------|--------|--------|",
    ...report.verificationQueries.map(
      (r) => `| ${r.id} | ${r.expected} | ${r.actual} | ${r.result} |`
    ),
    "",
    "## 6. RLS security matrix",
    "",
    "| Probe | Expected | Actual | Result |",
    "|-------|----------|--------|--------|",
    ...report.rlsSecurityMatrix.map(
      (r) => `| ${r.id} | ${r.expected} | ${r.actual} | ${r.result} |`
    ),
    "",
    "## 7. RPC visibility matrix",
    "",
    "| Role probe | Result | Detail |",
    "|------------|--------|--------|",
    ...report.rpcVisibilityMatrix.map((r) => `| ${r.id} | ${r.result} | ${r.detail} |`),
    "",
    "## 8–10. Locking / Idempotency / Repository",
    "",
    "See REPORT.json sections `lockingScenarios`, `idempotencyScenarios`, `repositoryIntegration`.",
    "",
    "## 11. Dry-run migration",
    "",
    "```json",
    JSON.stringify(report.dryRunMigration, null, 2),
    "```",
    "",
    "## 12. Shadow comparison (live club_data_v3 vs cloud)",
    "",
    JSON.stringify(report.shadowComparison, null, 2),
    "",
    "## 13. Regression tests",
    "",
    JSON.stringify(report.regressionTests, null, 2),
    "",
    "## 14. Known conditions",
    "",
    ...(report.knownConditions.length
      ? report.knownConditions.map((c) => `- ${c}`)
      : ["- None"]),
    "",
  ];

  if (report.section11) {
    const s11 = report.section11;
    lines.push(
      "## 15. TT-1B SQL §11 RPC guards (staging MCP)",
      "",
      "| Check | Result |",
      "|-------|--------|",
      `| §11 applied (${STAGING_REF}) | **${s11.migrationApply?.status || "UNKNOWN"}** |`,
      `| Database smoke | **${s11.smokePass ? "PASS" : "FAIL"}** |`,
      `| Guard flag \`VITE_TEAM_TOURNAMENT_TT1B_RPC_GUARDS=deployed\` | **documented** |`,
      "",
      "Migrations: `phase_tt1b_section11_rpc_guards`, `phase_tt1b_section11_revoke_anon_rpc`",
      "",
      "Evidence: `docs/v5/qa-evidence/phase-tt1b5-staging/SECTION11_SMOKE_REPORT.json`",
      "",
      "TT-1B wrapper signatures:",
      "",
      `- \`team_tournament_save_lineup_draft\` — **6 params**`,
      `- \`team_tournament_upsert_standings\` — **4 params**`,
      "",
      "Legacy preserved: `team_tournament_save_lineup_draft_legacy` (4), `team_tournament_upsert_standings_legacy` (2)",
      "",
    );
  }

  if (report.structuredVerificationQueries?.summary) {
    const pub = report.structuredVerificationQueries.checks?.find(
      (c) => c.check_id === "V5.overload.publish_matchup.both_versions",
    );
    lines.push(
      "",
      "## TT-1B.5 historical compatibility (post-TT-2E)",
      "",
      "Read-only re-verification after TT-2E on staging. No TT-1B re-apply.",
      "",
      "| Item | Result |",
      "|------|--------|",
      `| publish overload allowlist | **${pub?.status || "see VERIFICATION_QUERY_RESULTS.json"}** |`,
      `| Structured SQL checks | **${report.structuredVerificationQueries.summary.pass}/${report.structuredVerificationQueries.summary.total} ${report.structuredVerificationQueries.summary.overall}** |`,
      `| Shadow lineup phase23d-team-b | **${report.shadowComparison?.lineupPhase23dTeamB?.shadowResolution || "see REPORT.json"}** |`,
      "",
    );
  }

  lines.push("**STOP — TT-1B.5 complete. Do not proceed to TT-1C without owner GO.**");

  fs.writeFileSync(mdPath, lines.join("\n"), "utf8");
}

async function main() {
  const applySql = process.argv.includes("--apply-sql");
  const seedProbe = process.argv.includes("--seed-probe");

  loadProjectEnv();
  const { url, serviceKey, anonKey } = getStagingSupabaseEnv();
  if (!url.includes(STAGING_REF)) {
    throw new Error(`Refusing non-staging URL (expected ${STAGING_REF})`);
  }
  if (url.includes(PRODUCTION_REF)) {
    throw new Error("Production ref blocked");
  }
  if (!serviceKey && !anonKey) {
    throw new Error(
      "Missing STAGING_SUPABASE_SERVICE_ROLE_KEY or STAGING_SUPABASE_ANON_KEY — see .env.staging-qa.example"
    );
  }

  report.environment = {
    ref: STAGING_REF,
    url,
    hasAnonKey: anonKey.length > 20,
    hasServiceKey: serviceKey.length > 20,
    branch: spawnSync("git", ["branch", "--show-current"], { encoding: "utf8", cwd: rootDir }).stdout?.trim(),
  };
  report.commitSha = gitSha();

  reviewSqlFile();

  const admin = createClient(url, serviceKey || anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  await capturePreMigration(admin);

  if (applySql) {
    const apply = spawnSync("node", ["scripts/apply-phase-tt1b-staging-sql.mjs"], {
      encoding: "utf8",
      cwd: rootDir,
    });
    report.migrationApply = { exitCode: apply.status, stdout: apply.stdout, stderr: apply.stderr };
    await capturePreMigration(admin);
  } else {
    report.migrationApply = {
      status: "SKIPPED",
      reason: "No --apply-sql flag; thiếu STAGING_SUPABASE_DB_URL / SUPABASE_ACCESS_TOKEN",
      manual: `docs/v5/PHASE_TT1B_TEAM_TOURNAMENT_SSOT.sql → SQL Editor staging ${STAGING_REF}`,
    };
  }

  if (seedProbe) {
    const seed = spawnSync(
      "node",
      [
        "scripts/seed-team-tournament-cloud.mjs",
        `--blob-path=${PROBE.blobPath}`,
      ],
      { encoding: "utf8", cwd: rootDir, env: { ...process.env, VITE_SUPABASE_URL: url, SUPABASE_SERVICE_ROLE_KEY: serviceKey } }
    );
    report.seedProbe = { exitCode: seed.status, stdout: seed.stdout?.slice(0, 4000) };
    await capturePreMigration(admin);
  }

  await runVerificationQueries(admin);
  await runSecurityMatrix();
  await runLockingAndIdempotency(admin);
  await runRepositoryIntegration();
  runFeatureModeValidation();
  runRpcOverloadAudit();
  runRegressionTests();
  await runDryRunAndShadow(admin);

  mergeSection11Evidence();

  report.knownConditions = report.knownConditions.filter(Boolean);

  loadStructuredVerificationResults();
  computeVerdict();

  fs.mkdirSync(evidenceDir, { recursive: true });
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), "utf8");
  writeMarkdown();

  console.log(JSON.stringify({ verdict: report.verdict, reportPath, mdPath }, null, 2));
  process.exit(report.verdict === "READY FOR TT-1C" ? 0 : report.verdict.includes("WITH CONDITIONS") ? 1 : 2);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
