/**
 * TT-1B §11 staging RPC smoke — save_lineup_draft + upsert_standings guards.
 * STAGING ONLY (qyewbxjsiiyufanzcjcq). Never run against production.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { getStagingSupabaseEnv, loadProjectEnv } from "./load-env.mjs";
import {
  __resetTeamTournamentRpcGuardsForTests,
  __setTeamTournamentRpcGuardsForTests,
} from "../src/features/team-tournament/repositories/teamTournamentRpcGuards.js";
import {
  __resetTeamTournamentRpcClientForTests,
  __setTeamTournamentRpcClientForTests,
} from "../src/features/team-tournament/services/teamTournamentRpcService.js";
import { createCloudTeamTournamentRepository } from "../src/features/team-tournament/repositories/cloudTeamTournamentRepository.js";
import { REPOSITORY_ERROR_CODES } from "../src/features/team-tournament/repositories/teamTournamentRepositoryTypes.js";

const STAGING_REF = "qyewbxjsiiyufanzcjcq";
const PRODUCTION_REF = "expuvcohlcjzvrrauvud";
const QA_PASSWORD = String(process.env.PHASE42L_QA_PASSWORD || "PickleStaging!358").trim();

const PROBE = {
  tournamentId: "phase23d-probe-tournament",
  teamA: "phase23d-team-a",
  matchupId: "phase23d-matchup-1",
  clubId: "club-staging-demo",
};

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const evidenceDir = path.join(rootDir, "docs/v5/qa-evidence/phase-tt1b5-staging");
const reportPath = path.join(evidenceDir, "SECTION11_SMOKE_REPORT.json");

const results = {
  generatedAt: new Date().toISOString(),
  environment: { ref: STAGING_REF },
  rpcSignatureAudit: null,
  saveLineupDraft: [],
  upsertStandings: [],
  repositoryGuard: [],
  verdict: "NOT READY FOR TT-1C",
};

function record(section, id, pass, expected, actual, detail = "") {
  section.push({ id, pass, expected, actual, detail });
}

function assertStagingUrl(url) {
  if (!url.includes(STAGING_REF)) {
    throw new Error(`Refusing non-staging URL (expected ${STAGING_REF}, got ${url})`);
  }
  if (url.includes(PRODUCTION_REF)) {
    throw new Error("Refusing production Supabase URL");
  }
}

async function signInAs(email, env) {
  const apiKey = env.anonKey?.length > 20 ? env.anonKey : env.serviceKey;
  const client = createClient(env.url, apiKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.auth.signInWithPassword({ email, password: QA_PASSWORD });
  if (error) {
    throw new Error(`${email}: ${error.message}`);
  }
  return client;
}

async function fetchLineupVersion(admin) {
  const { data } = await admin
    .from("team_tournament_lineups")
    .select("version, selections, status, locked_at, team_external_id, matchup_id")
    .eq("team_external_id", PROBE.teamA)
    .limit(5);
  const row = (data || []).find((r) => r.team_external_id === PROBE.teamA);
  return row;
}

async function prepareDraftSmoke(admin) {
  const { data: tt } = await admin
    .from("team_tournaments")
    .select("id")
    .eq("tournament_id", PROBE.tournamentId)
    .maybeSingle();
  if (!tt?.id) {
    throw new Error("Probe tournament missing on staging");
  }

  const { data: lineups } = await admin
    .from("team_tournament_lineups")
    .select("id, version, selections, status, locked_at, team_external_id")
    .eq("team_external_id", PROBE.teamA);

  const lineup = lineups?.[0];
  if (!lineup) {
    throw new Error("Probe lineup missing");
  }

  const backup = {
    lineupId: lineup.id,
    version: lineup.version,
    status: lineup.status,
    locked_at: lineup.locked_at,
    selections: lineup.selections,
  };

  await admin
    .from("team_tournament_lineups")
    .update({ locked_at: null, status: "draft" })
    .eq("id", lineup.id);

  return { backup, version: lineup.version, selections: lineup.selections || {} };
}

async function restoreDraftSmoke(admin, backup) {
  if (!backup?.lineupId) {
    return;
  }
  await admin.from("team_tournament_lineups").update({
    locked_at: backup.locked_at,
    status: backup.status,
    selections: backup.selections,
    version: backup.version,
  }).eq("id", backup.lineupId);
}

async function fetchStandingsVersion(admin) {
  const { data: tt } = await admin
    .from("team_tournaments")
    .select("id")
    .eq("tournament_id", PROBE.tournamentId)
    .maybeSingle();
  const { data } = await admin
    .from("team_tournament_standings")
    .select("version, team_external_id, rank, played, wins, losses, sub_match_wins, sub_match_losses, sub_match_diff, points_scored, points_conceded, ranking_points")
    .eq("team_tournament_id", tt.id);
  const version = Math.max(1, ...(data || []).map((r) => Number(r.version) || 1));
  const standings = (data || []).map((row) => ({
    teamId: row.team_external_id,
    rank: row.rank,
    played: row.played,
    wins: row.wins,
    losses: row.losses,
    subMatchWins: row.sub_match_wins,
    subMatchLosses: row.sub_match_losses,
    subMatchDiff: row.sub_match_diff,
    pointsScored: row.points_scored,
    pointsConceded: row.points_conceded,
    rankingPoints: row.ranking_points,
  }));
  return { version, standings };
}

async function runSaveDraftSmoke(captain, admin, ctx) {
  const basePayload = {
    p_tournament_id: PROBE.tournamentId,
    p_matchup_id: PROBE.matchupId,
    p_team_id: PROBE.teamA,
    p_selections: ctx.selections,
  };

  const okKey = `tt1b11-draft-ok-${Date.now()}`;
  const ok = await captain.rpc("team_tournament_save_lineup_draft", {
    ...basePayload,
    p_expected_version: ctx.version,
    p_idempotency_key: okKey,
  });
  record(
    results.saveLineupDraft,
    "expected_version_match",
    ok.data?.ok === true,
    "ok=true",
    JSON.stringify(ok.data || ok.error),
    `version=${ok.data?.version}`
  );

  const stale = await captain.rpc("team_tournament_save_lineup_draft", {
    ...basePayload,
    p_expected_version: 1,
    p_idempotency_key: `tt1b11-draft-stale-${Date.now()}`,
  });
  record(
    results.saveLineupDraft,
    "expected_version_stale",
    stale.data?.code === "version_conflict",
    "version_conflict",
    String(stale.data?.code || stale.data?.ok)
  );

  const replay1 = await captain.rpc("team_tournament_save_lineup_draft", {
    ...basePayload,
    p_expected_version: ok.data?.version ? ok.data.version - 1 : ctx.version,
    p_idempotency_key: okKey,
  });
  const replay2 = await captain.rpc("team_tournament_save_lineup_draft", {
    ...basePayload,
    p_expected_version: ok.data?.version ? ok.data.version - 1 : ctx.version,
    p_idempotency_key: okKey,
  });
  const replayPass =
    replay1.data?.ok === true &&
    replay2.data?.ok === true &&
    replay2.data?.version === replay1.data?.version;
  record(
    results.saveLineupDraft,
    "idempotency_replay",
    replayPass,
    "same version on replay",
    `v1=${replay1.data?.version} v2=${replay2.data?.version}`
  );

  const mismatch = await captain.rpc("team_tournament_save_lineup_draft", {
    ...basePayload,
    p_selections: { "disc-men": ["player-staging-a-1", "player-staging-a-2"] },
    p_expected_version: ok.data?.version ? ok.data.version - 1 : ctx.version,
    p_idempotency_key: okKey,
  });
  record(
    results.saveLineupDraft,
    "idempotency_payload_mismatch",
    mismatch.data?.code === "idempotency_payload_mismatch",
    "idempotency_payload_mismatch",
    String(mismatch.data?.code || mismatch.data?.ok)
  );
}

async function runUpsertSmoke(owner, ctx) {
  const base = {
    p_tournament_id: PROBE.tournamentId,
    p_standings: ctx.standings,
  };

  const okKey = `tt1b11-standings-ok-${Date.now()}`;
  const ok = await owner.rpc("team_tournament_upsert_standings", {
    ...base,
    p_expected_version: ctx.version,
    p_idempotency_key: okKey,
  });
  record(
    results.upsertStandings,
    "expected_version_match",
    ok.data?.ok === true,
    "ok=true",
    JSON.stringify(ok.data || ok.error),
    `version=${ok.data?.version}`
  );

  const stale = await owner.rpc("team_tournament_upsert_standings", {
    ...base,
    p_expected_version: 1,
    p_idempotency_key: `tt1b11-standings-stale-${Date.now()}`,
  });
  record(
    results.upsertStandings,
    "expected_version_stale",
    stale.data?.code === "version_conflict",
    "version_conflict",
    String(stale.data?.code || stale.data?.ok)
  );

  const replay1 = await owner.rpc("team_tournament_upsert_standings", {
    ...base,
    p_expected_version: ok.data?.version ? ok.data.version - 1 : ctx.version,
    p_idempotency_key: okKey,
  });
  const replay2 = await owner.rpc("team_tournament_upsert_standings", {
    ...base,
    p_expected_version: ok.data?.version ? ok.data.version - 1 : ctx.version,
    p_idempotency_key: okKey,
  });
  const replayPass =
    replay1.data?.ok === true &&
    replay2.data?.ok === true &&
    replay2.data?.version === replay1.data?.version;
  record(
    results.upsertStandings,
    "idempotency_replay",
    replayPass,
    "same version on replay",
    `v1=${replay1.data?.version} v2=${replay2.data?.version}`
  );

  const mismatch = await owner.rpc("team_tournament_upsert_standings", {
    ...base,
    p_standings: [...ctx.standings].reverse(),
    p_expected_version: ok.data?.version ? ok.data.version - 1 : ctx.version,
    p_idempotency_key: okKey,
  });
  record(
    results.upsertStandings,
    "idempotency_payload_mismatch",
    mismatch.data?.code === "idempotency_payload_mismatch",
    "idempotency_payload_mismatch",
    String(mismatch.data?.code || mismatch.data?.ok)
  );
}

async function runRepositoryGuardSmoke(ownerClient, env) {
  process.env.VITE_TEAM_TOURNAMENT_TT1B_RPC_GUARDS = "deployed";
  process.env.VITE_SUPABASE_URL = env.url;
  process.env.VITE_SUPABASE_ANON_KEY = env.serviceKey || env.anonKey;
  __setTeamTournamentRpcGuardsForTests({
    saveDraftLineup: true,
    recalculateStandings: true,
  });
  __setTeamTournamentRpcClientForTests(ownerClient);

  const repo = createCloudTeamTournamentRepository();

  const draft = await repo.saveDraftLineup(
    PROBE.clubId,
    PROBE.tournamentId,
    { matchupId: PROBE.matchupId, teamId: PROBE.teamA, selections: { "disc-men": ["player-staging-a-1", "player-staging-a-3"] } },
    { expectedVersion: 999, idempotencyKey: `repo-guard-draft-${Date.now()}` }
  );
  record(
    results.repositoryGuard,
    "saveDraftLineup_not_guard_blocked",
    draft.code !== REPOSITORY_ERROR_CODES.RPC_GUARD_NOT_DEPLOYED,
    "not RPC_GUARD_NOT_DEPLOYED",
    String(draft.code || draft.ok)
  );

  const recalc = await repo.recalculateStandings(PROBE.clubId, PROBE.tournamentId, {
    expectedVersion: 1,
    idempotencyKey: `repo-guard-recalc-${Date.now()}`,
  });
  record(
    results.repositoryGuard,
    "recalculateStandings_not_guard_blocked",
    recalc.code !== REPOSITORY_ERROR_CODES.RPC_GUARD_NOT_DEPLOYED,
    "not RPC_GUARD_NOT_DEPLOYED",
    String(recalc.code || recalc.ok)
  );

  __resetTeamTournamentRpcGuardsForTests();
  __resetTeamTournamentRpcClientForTests();
}

async function main() {
  loadProjectEnv();
  const env = getStagingSupabaseEnv();
  assertStagingUrl(env.url);

  if (!env.serviceKey) {
    throw new Error("Missing STAGING_SUPABASE_SERVICE_ROLE_KEY");
  }

  const admin = createClient(env.url, env.serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let backup = null;
  try {
    const draftCtx = await prepareDraftSmoke(admin);
    backup = draftCtx.backup;
    const owner = await signInAs("owner@staging.local", env);
    await runSaveDraftSmoke(owner, admin, draftCtx);

    const standingsCtx = await fetchStandingsVersion(admin);
    await runUpsertSmoke(owner, standingsCtx);

    await runRepositoryGuardSmoke(owner, env);
  } finally {
    await restoreDraftSmoke(admin, backup);
  }

  const allPass = [
    ...results.saveLineupDraft,
    ...results.upsertStandings,
    ...results.repositoryGuard,
  ].every((row) => row.pass);

  results.verdict = allPass ? "READY FOR TT-1C" : "NOT READY FOR TT-1C";

  fs.mkdirSync(evidenceDir, { recursive: true });
  fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results, null, 2));
  process.exit(allPass ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
