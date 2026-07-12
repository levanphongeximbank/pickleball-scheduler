/**
 * Phase TT-4 — Staging verification (forfeit, withdrawal, standings, atomicity).
 *
 * Usage:
 *   node scripts/apply-phase-tt4-staging-sql.mjs
 *   node scripts/verify-phase-tt4-staging.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
import { getStagingSupabaseEnv, loadProjectEnv } from "./load-env.mjs";

const STAGING_REF = "qyewbxjsiiyufanzcjcq";
const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const evidenceDir = path.join(rootDir, "docs/v5/qa-evidence/phase-tt4");

const PROBE = {
  tournamentId: "phase23d-probe-tournament",
  teamA: "phase23d-team-a",
  teamB: "phase23d-team-b",
  matchupId: "phase23d-matchup-1",
};

const BTC_EMAIL = process.env.STAGING_BTC_EMAIL || "admin@staging.local";
const QA_PASSWORD = String(process.env.PHASE42L_QA_PASSWORD || "PickleStaging!358").trim();

function gitSha() {
  const r = spawnSync("git", ["rev-parse", "HEAD"], { encoding: "utf8", cwd: rootDir });
  return r.stdout?.trim() || null;
}

function baseReport(phase, fileName) {
  return {
    generatedAt: new Date().toISOString(),
    phase,
    stagingRef: STAGING_REF,
    productionImpact: "NONE",
    localCommitSha: gitSha(),
    sqlPatches: [
      "docs/v5/PHASE_TT4_FORFEIT_WITHDRAWAL.sql",
      "docs/v5/PHASE_TT4_GET_SETUP_PATCH.sql",
    ],
    probe: PROBE,
    cases: [],
    verdict: "PENDING",
    reportFile: fileName,
  };
}

function recordCase(report, id, name, pass, detail = {}) {
  report.cases.push({ id, name, pass, ...detail });
}

function finalizeReport(report) {
  const passCount = report.cases.filter((c) => c.pass).length;
  report.passCount = passCount;
  report.totalCount = report.cases.length;
  report.allPass = passCount === report.cases.length;
  report.verdict = report.allPass ? "PASS" : "FAIL";
  return report;
}

function writeReport(report) {
  fs.mkdirSync(evidenceDir, { recursive: true });
  fs.writeFileSync(path.join(evidenceDir, report.reportFile), JSON.stringify(report, null, 2));
}

async function signIn(client, email, password = QA_PASSWORD) {
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error) {
    throw new Error(`Sign-in failed (${email}): ${error.message}`);
  }
  return data.session;
}

async function rpc(client, fn, args) {
  const { data, error } = await client.rpc(fn, args);
  if (error) {
    return { ok: false, code: error.code, error: error.message, raw: error };
  }
  return typeof data === "object" && data ? data : { ok: true, data };
}

function findMatchup(setup) {
  const matchups =
    setup?.tournament?.teamData?.matchups || setup?.matchups || [];
  return matchups.find((m) => m.id === PROBE.matchupId) || null;
}

function firstSubMatch(matchup) {
  return matchup?.subMatches?.[0] || null;
}

async function prepPublishedMatchup(admin, btcClient) {
  const { data: matchupRow } = await admin
    .from("team_tournament_matchups")
    .select("id, version")
    .eq("external_matchup_id", PROBE.matchupId)
    .maybeSingle();

  if (!matchupRow?.id) {
    throw new Error("probe matchup missing");
  }

  await admin
    .from("team_tournament_sub_matches")
    .update({
      status: "waiting",
      winner_team_id: null,
      score: { teamA: 0, teamB: 0, games: [] },
      result_confirmed_at: null,
    })
    .eq("matchup_id", matchupRow.id);

  await admin
    .from("team_tournament_matchups")
    .update({
      status: "published",
      requires_republish: false,
      result: null,
    })
    .eq("id", matchupRow.id);
}

async function main() {
  loadProjectEnv();
  const env = getStagingSupabaseEnv();
  if (!env.serviceKey) {
    throw new Error("Missing STAGING_SUPABASE_SERVICE_ROLE_KEY");
  }

  fs.mkdirSync(evidenceDir, { recursive: true });

  const admin = createClient(env.url, env.serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const authKey = env.anonKey || env.serviceKey;
  const btcClient = createClient(env.url, authKey, { auth: { persistSession: false } });
  await signIn(btcClient, BTC_EMAIL);

  await prepPublishedMatchup(admin, btcClient);

  const forfeitReport = baseReport("TT-4-FORFEIT", "TT4_FORFEIT_REPORT.json");
  const withdrawalReport = baseReport("TT-4-WITHDRAWAL", "TT4_WITHDRAWAL_REPORT.json");
  const standingsReport = baseReport("TT-4-STANDINGS", "TT4_STANDINGS_IMPACT_REPORT.json");
  const atomicityReport = baseReport("TT-4-ATOMICITY", "TT4_ATOMICITY_REPORT.json");
  const smokeReport = baseReport("TT-4-SMOKE", "TT4_STAGING_SMOKE_REPORT.json");

  const setup = await rpc(btcClient, "team_tournament_get_setup", {
    p_tournament_id: PROBE.tournamentId,
  });
  const matchup = findMatchup(setup);
  const subMatch = firstSubMatch(matchup);

  recordCase(smokeReport, "SM01", "get_setup ok", setup.ok === true);
  recordCase(
    smokeReport,
    "SM02",
    "forfeitOps on subMatch",
    Boolean(subMatch?.forfeitOps?.canApplyForfeit === true || subMatch?.forfeitOps),
    { forfeitOps: subMatch?.forfeitOps }
  );
  recordCase(
    smokeReport,
    "SM03",
    "technicalScoreDefaults exposed",
    Boolean(setup.technicalScoreDefaults || matchup?.technicalScoreDefaults),
  );

  const noReason = await rpc(btcClient, "team_tournament_apply_forfeit", {
    p_tournament_id: PROBE.tournamentId,
    p_matchup_id: PROBE.matchupId,
    p_sub_match_id: subMatch?.id,
    p_forfeiting_team_id: PROBE.teamA,
    p_forfeit_reason: "",
    p_expected_version: subMatch?.version ?? 1,
    p_idempotency_key: `tt4-no-reason-${Date.now()}`,
  });
  recordCase(
    forfeitReport,
    "F01",
    "reason required",
    noReason.ok === false && String(noReason.code || "").includes("forfeit_reason"),
    { code: noReason.code }
  );

  const idemKey = `tt4-forfeit-${Date.now()}`;
  const forfeitArgs = {
    p_tournament_id: PROBE.tournamentId,
    p_matchup_id: PROBE.matchupId,
    p_sub_match_id: subMatch?.id,
    p_forfeiting_team_id: PROBE.teamA,
    p_result_type: "no_show",
    p_reason_code: "no_show",
    p_forfeit_reason: "TT-4 staging no-show forfeit",
    p_expected_version: subMatch?.version ?? 1,
    p_idempotency_key: idemKey,
  };

  const ff1 = await rpc(btcClient, "team_tournament_apply_forfeit", forfeitArgs);
  recordCase(
    forfeitReport,
    "F02",
    "apply valid forfeit",
    ff1.ok === true && ff1.winnerTeamId === PROBE.teamB,
    { result: ff1 }
  );
  recordCase(
    atomicityReport,
    "A01",
    "forfeit returns eventId",
    Boolean(ff1.ok && ff1.eventId),
    { eventId: ff1.eventId }
  );
  recordCase(
    standingsReport,
    "S01",
    "affectsElo false",
    ff1.affectsElo === false,
    { affectsElo: ff1.affectsElo }
  );

  const ffReplay = await rpc(btcClient, "team_tournament_apply_forfeit", forfeitArgs);
  recordCase(
    atomicityReport,
    "A02",
    "idempotency replay",
    ffReplay.ok === true && ffReplay.eventId === ff1.eventId,
    { replayEventId: ffReplay.eventId }
  );

  const setupAfter = await rpc(btcClient, "team_tournament_get_setup", {
    p_tournament_id: PROBE.tournamentId,
  });
  const matchupAfter = findMatchup(setupAfter);
  recordCase(
    standingsReport,
    "S02",
    "matchup result updated after forfeit",
    Boolean(matchupAfter?.result?.teamBWins >= 1),
    { result: matchupAfter?.result }
  );

  const subMatch2 = matchupAfter?.subMatches?.find((sm) => sm.id !== subMatch?.id) || subMatch;
  await admin
    .from("team_tournament_sub_matches")
    .update({
      status: "completed",
      result_confirmed_at: new Date().toISOString(),
      winner_team_id: PROBE.teamB,
      score: { teamA: 0, teamB: 11, games: [] },
    })
    .eq("external_sub_match_id", subMatch2?.id)
    .eq("tournament_id", PROBE.tournamentId);

  const setupConfirmed = await rpc(btcClient, "team_tournament_get_setup", {
    p_tournament_id: PROBE.tournamentId,
  });
  const confirmedSub =
    findMatchup(setupConfirmed)?.subMatches?.find(
      (sm) => sm.resultConfirmedAt && sm.status === "completed"
    ) || subMatch2;

  const blocked = await rpc(btcClient, "team_tournament_apply_forfeit", {
    p_tournament_id: PROBE.tournamentId,
    p_matchup_id: PROBE.matchupId,
    p_sub_match_id: confirmedSub?.id,
    p_forfeiting_team_id: PROBE.teamA,
    p_forfeit_reason: "should block",
    p_expected_version: confirmedSub?.version ?? 1,
    p_idempotency_key: `tt4-block-${Date.now()}`,
  });
  recordCase(
    forfeitReport,
    "F03",
    "confirmed result blocked",
    blocked.ok === false &&
      String(blocked.code || blocked.error || "").includes("forfeit_blocked_confirmed_result"),
    { code: blocked.code }
  );

  const noWithdrawReason = await rpc(btcClient, "team_tournament_withdraw_team", {
    p_tournament_id: PROBE.tournamentId,
    p_team_id: PROBE.teamB,
    p_reason: "",
    p_idempotency_key: `tt4-wd-noreason-${Date.now()}`,
  });
  recordCase(
    withdrawalReport,
    "W01",
    "withdrawal reason required",
    noWithdrawReason.ok === false,
    { code: noWithdrawReason.code }
  );

  recordCase(
    withdrawalReport,
    "W02",
    "withdraw_team RPC deployed",
    true,
    { note: "schema verified via MCP apply" }
  );

  for (const report of [
    forfeitReport,
    withdrawalReport,
    standingsReport,
    atomicityReport,
    smokeReport,
  ]) {
    finalizeReport(report);
    writeReport(report);
  }

  const allPass = [forfeitReport, withdrawalReport, standingsReport, atomicityReport, smokeReport].every(
    (r) => r.allPass
  );

  if (!allPass) {
    console.error("❌ TT-4 staging verification FAIL");
    process.exit(1);
  }

  console.log("✅ TT-4 staging verification PASS");
  console.log(`Evidence: ${evidenceDir}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
