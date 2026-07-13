/**
 * Phase TT-5B — Staging verification (bridge, provision, legacy lock).
 *
 * Usage:
 *   node scripts/apply-phase-tt5b-staging-sql.mjs
 *   node scripts/verify-phase-tt5b-staging.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
import { getStagingSupabaseEnv, loadProjectEnv } from "./load-env.mjs";

const STAGING_REF = "qyewbxjsiiyufanzcjcq";
const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const evidenceDir = path.join(rootDir, "docs/v5/qa-evidence/phase-tt5");

const PROBE = {
  tournamentId: "phase23d-probe-tournament",
  teamA: "phase23d-team-a",
  teamB: "phase23d-team-b",
  matchupId: "phase23d-matchup-1",
  subMatchId: "phase23d-sub-1",
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
      "docs/v5/team-tournament/tt5/TT5-B_BRIDGE_SCHEMA.sql",
      "docs/v5/team-tournament/tt5/TT5-B_PROVISION_RPC.sql",
      "docs/v5/team-tournament/tt5/TT5-B_LEGACY_LOCK_GUARD.sql",
      "docs/v5/team-tournament/tt5/TT5-B_GET_SETUP_PATCH.sql",
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
  report.passCount = report.cases.filter((c) => c.pass).length;
  report.totalCount = report.cases.length;
  report.allPass = report.passCount === report.totalCount;
  report.verdict = report.allPass ? "PASS" : "FAIL";
  return report;
}

function writeReport(report) {
  fs.mkdirSync(evidenceDir, { recursive: true });
  fs.writeFileSync(path.join(evidenceDir, report.reportFile), JSON.stringify(report, null, 2));
}

async function signIn(client, email) {
  const { data, error } = await client.auth.signInWithPassword({ email, password: QA_PASSWORD });
  if (error) throw new Error(`Sign-in failed (${email}): ${error.message}`);
  return data.session;
}

async function rpc(client, fn, args) {
  const { data, error } = await client.rpc(fn, args);
  if (error) {
    return { ok: false, code: error.code, error: error.message, raw: error };
  }
  return typeof data === "object" && data ? data : { ok: true, data };
}

function findSubMatch(setup) {
  const matchups = setup?.tournament?.teamData?.matchups || setup?.matchups || [];
  const matchup = matchups.find((m) => m.id === PROBE.matchupId);
  return matchup?.subMatches?.find((sm) => sm.id === PROBE.subMatchId) || null;
}

async function prepProbe(admin, adminUserId) {
  const { data: header } = await admin
    .from("team_tournaments")
    .select("id, tenant_id, tournament_id")
    .eq("tournament_id", PROBE.tournamentId)
    .maybeSingle();

  const { data: matchup } = await admin
    .from("team_tournament_matchups")
    .select("id, version")
    .eq("team_tournament_id", header.id)
    .eq("external_matchup_id", PROBE.matchupId)
    .maybeSingle();

  await admin
    .from("team_tournament_sub_matches")
    .update({
      status: "waiting",
      winner_team_id: null,
      score: { teamA: 0, teamB: 0, games: [] },
      result_confirmed_at: null,
    })
    .eq("matchup_id", matchup.id);

  await admin
    .from("team_tournament_matchups")
    .update({ status: "published", requires_republish: false, result: null })
    .eq("id", matchup.id);

  await admin
    .from("team_tournament_lineups")
    .update({ status: "published" })
    .eq("matchup_id", matchup.id);

  const { data: subRow } = await admin
    .from("team_tournament_sub_matches")
    .select("id")
    .eq("matchup_id", matchup.id)
    .eq("external_sub_match_id", PROBE.subMatchId)
    .maybeSingle();

  if (subRow?.id) {
    await admin.from("team_sub_match_referee_links").delete().eq("sub_match_id", subRow.id);
  }

  const stateId = `${header.tenant_id}::${header.tournament_id}::${PROBE.subMatchId}`;
  await admin.from("match_live_states").delete().eq("id", stateId);
  await admin
    .from("referee_assignments")
    .delete()
    .eq("tenant_id", header.tenant_id)
    .eq("tournament_id", header.tournament_id)
    .eq("match_id", PROBE.subMatchId);

  const { data: assignment } = await admin
    .from("referee_assignments")
    .insert({
      tenant_id: header.tenant_id,
      tournament_id: header.tournament_id,
      match_id: PROBE.subMatchId,
      referee_user_id: adminUserId,
      referee_display_name: "TT-5B Probe Referee",
      role: "REFEREE",
      status: "active",
    })
    .select("id")
    .single();

  return { header, matchup, assignmentId: assignment?.id, adminUserId };
}

async function main() {
  loadProjectEnv();
  const env = getStagingSupabaseEnv();
  if (!env.serviceKey) throw new Error("Missing STAGING_SUPABASE_SERVICE_ROLE_KEY");

  const admin = createClient(env.url, env.serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const btcClient = createClient(env.url, env.anonKey || env.serviceKey, {
    auth: { persistSession: false },
  });
  await signIn(btcClient, BTC_EMAIL);

  const schemaReport = baseReport("TT-5B-SCHEMA", "TT5B_BRIDGE_SCHEMA_REPORT.json");
  const provisionReport = baseReport("TT-5B-PROVISION", "TT5B_PROVISION_REPORT.json");
  const concurrencyReport = baseReport("TT-5B-CONCURRENCY", "TT5B_CONCURRENCY_REPORT.json");
  const securityReport = baseReport("TT-5B-SECURITY", "TT5B_SECURITY_RLS_REPORT.json");
  const legacyReport = baseReport("TT-5B-LEGACY-LOCK", "TT5B_LEGACY_LOCK_REPORT.json");
  const smokeReport = baseReport("TT-5B-SMOKE", "TT5B_STAGING_SMOKE_REPORT.json");

  const { data: tableCheck } = await admin
    .from("team_sub_match_referee_links")
    .select("id")
    .limit(1);
  recordCase(schemaReport, "S01", "bridge table exists", tableCheck !== null);

  const { data: session } = await btcClient.auth.getSession();
  const adminUserId = session?.session?.user?.id;

  const prep = await prepProbe(admin, adminUserId);
  recordCase(provisionReport, "P00", "probe prep + assignment", Boolean(prep.assignmentId), {
    assignmentId: prep.assignmentId,
  });

  const setupBefore = await rpc(btcClient, "team_tournament_get_setup", {
    p_tournament_id: PROBE.tournamentId,
  });
  const subBefore = findSubMatch(setupBefore);
  recordCase(smokeReport, "SM01", "scoreOps exposed", Boolean(subBefore?.scoreOps));
  recordCase(smokeReport, "SM02", "refereeLinkOps exposed", Boolean(subBefore?.refereeLinkOps));

  const noAssignment = await rpc(btcClient, "team_tournament_provision_referee_match", {
    p_tournament_id: PROBE.tournamentId,
    p_matchup_id: PROBE.matchupId,
    p_sub_match_id: PROBE.subMatchId,
    p_referee_assignment_id: "00000000-0000-4000-8000-000000000099",
    p_expected_sub_match_version: subBefore?.version ?? 1,
    p_idempotency_key: `tt5b-bad-assign-${Date.now()}`,
  });
  recordCase(securityReport, "SEC01", "invalid assignment denied", noAssignment.ok === false);

  const idemKey = `tt5b-provision-${Date.now()}`;
  const provisionArgs = {
    p_tournament_id: PROBE.tournamentId,
    p_matchup_id: PROBE.matchupId,
    p_sub_match_id: PROBE.subMatchId,
    p_referee_assignment_id: prep.assignmentId,
    p_expected_sub_match_version: subBefore?.version ?? 1,
    p_idempotency_key: idemKey,
    p_reason: "TT-5B staging provision",
    p_source: "verify_script",
  };

  const prov1 = await rpc(btcClient, "team_tournament_provision_referee_match", provisionArgs);
  recordCase(
    provisionReport,
    "P01",
    "valid provision",
    prov1.ok === true && prov1.route === `/referee/match/${PROBE.subMatchId}`,
    { result: prov1 }
  );
  recordCase(
    concurrencyReport,
    "C01",
    "provision returns linkId",
    Boolean(prov1.ok && prov1.linkId),
    { linkId: prov1.linkId }
  );

  const provReplay = await rpc(btcClient, "team_tournament_provision_referee_match", provisionArgs);
  recordCase(
    concurrencyReport,
    "C02",
    "idempotency replay",
    provReplay.ok === true && provReplay.linkId === prov1.linkId,
    { replayLinkId: provReplay.linkId }
  );

  const setupLinked = await rpc(btcClient, "team_tournament_get_setup", {
    p_tournament_id: PROBE.tournamentId,
  });
  const subLinked = findSubMatch(setupLinked);
  recordCase(
    legacyReport,
    "L01",
    "scoreOps blocks legacy draft",
    subLinked?.scoreOps?.canSaveDraft === false &&
      String(subLinked?.scoreOps?.blockCode || "").includes("referee_v5"),
    { scoreOps: subLinked?.scoreOps }
  );

  const draftBlocked = await rpc(btcClient, "team_tournament_save_sub_match_draft", {
    p_tournament_id: PROBE.tournamentId,
    p_matchup_id: PROBE.matchupId,
    p_sub_match_id: PROBE.subMatchId,
    p_score: { teamA: 5, teamB: 3, games: [] },
  });
  recordCase(
    legacyReport,
    "L02",
    "save draft RPC blocked",
    draftBlocked.ok === false,
    { code: draftBlocked.code || draftBlocked.error }
  );

  const confirmBlocked = await rpc(btcClient, "team_tournament_confirm_sub_match", {
    p_tournament_id: PROBE.tournamentId,
    p_matchup_id: PROBE.matchupId,
    p_sub_match_id: PROBE.subMatchId,
    p_score: { teamA: 11, teamB: 0, games: [] },
    p_expected_version: subLinked?.version ?? subBefore?.version ?? 1,
    p_idempotency_key: `tt5b-confirm-block-${Date.now()}`,
  });
  recordCase(
    legacyReport,
    "L03",
    "confirm RPC blocked",
    confirmBlocked.ok === false,
    { code: confirmBlocked.code || confirmBlocked.error }
  );

  const stateId = `${prep.header.tenant_id}::${prep.header.tournament_id}::${PROBE.subMatchId}`;
  const { data: liveState } = await admin
    .from("match_live_states")
    .select("id, match_id, status")
    .eq("id", stateId)
    .maybeSingle();
  recordCase(
    provisionReport,
    "P02",
    "match_live_states created",
    liveState?.match_id === PROBE.subMatchId,
    { liveState }
  );

  const revoke = await rpc(btcClient, "team_tournament_revoke_referee_link", {
    p_tournament_id: PROBE.tournamentId,
    p_sub_match_id: PROBE.subMatchId,
    p_reason: "TT-5B verify revoke",
    p_expected_link_version: prov1.version ?? 1,
    p_idempotency_key: `tt5b-revoke-${Date.now()}`,
  });
  recordCase(provisionReport, "P03", "revoke before active", revoke.ok === true, { revoke });

  const revokeFinalized = await rpc(btcClient, "team_tournament_revoke_referee_link", {
    p_tournament_id: PROBE.tournamentId,
    p_sub_match_id: PROBE.subMatchId,
    p_reason: "should fail",
    p_idempotency_key: `tt5b-revoke2-${Date.now()}`,
  });
  recordCase(
    provisionReport,
    "P04",
    "revoke after revoked blocked",
    revokeFinalized.ok === false,
    { code: revokeFinalized.code || revokeFinalized.error }
  );

  recordCase(
    smokeReport,
    "SM03",
    "route contract",
    prov1.route === `/referee/match/${PROBE.subMatchId}`
  );

  const reports = [
    schemaReport,
    provisionReport,
    concurrencyReport,
    securityReport,
    legacyReport,
    smokeReport,
  ].map(finalizeReport);

  reports.forEach(writeReport);

  const allPass = reports.every((r) => r.allPass);
  if (allPass) {
    console.log("✅ TT-5B staging verification PASS");
    console.log(`Evidence: ${evidenceDir}`);
    process.exit(0);
  }

  console.error("❌ TT-5B staging verification FAIL");
  reports.filter((r) => !r.allPass).forEach((r) => {
    console.error(`  ${r.reportFile}: ${r.passCount}/${r.totalCount}`);
  });
  process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
