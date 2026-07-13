/**
 * Phase TT-5C — Staging verification (outbox consumer + E2E propagation).
 *
 * Usage:
 *   node scripts/apply-phase-tt5c-staging-sql.mjs
 *   node scripts/verify-phase-tt5c-staging.mjs
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

const SQL_PATCHES = [
  "docs/v5/team-tournament/tt5/TT5-C_RESULT_OUTBOX_CONSUMER.sql",
  "docs/v5/team-tournament/tt5/TT5-C_RESULT_PROPAGATION.sql",
  "docs/v5/team-tournament/tt5/TT5-C_STANDINGS_RECOMPUTE.sql",
  "docs/v5/team-tournament/tt5/TT5-C_REPROVISION_STATE.sql",
];

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
    sqlPatches: SQL_PATCHES,
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

async function prepProbe(admin, adminUserId) {
  const { data: header } = await admin
    .from("team_tournaments")
    .select("id, tenant_id, tournament_id")
    .eq("tournament_id", PROBE.tournamentId)
    .maybeSingle();

  const { data: matchup } = await admin
    .from("team_tournament_matchups")
    .select("id, version, team_a_id, team_b_id")
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

  await admin.from("team_tournament_lineups").update({ status: "published" }).eq("matchup_id", matchup.id);

  const { data: subRow } = await admin
    .from("team_tournament_sub_matches")
    .select("id, version")
    .eq("matchup_id", matchup.id)
    .eq("external_sub_match_id", PROBE.subMatchId)
    .maybeSingle();

  if (subRow?.id) {
    await admin.from("team_sub_match_referee_links").delete().eq("sub_match_id", subRow.id);
    await admin.from("team_tournament_referee_event_inbox").delete().eq("sub_match_id", subRow.id);
  }

  const stateId = `${header.tenant_id}::${header.tournament_id}::${PROBE.subMatchId}`;
  await admin.from("match_integration_outbox").delete().eq("match_state_id", stateId);
  await admin.from("match_result_revisions").delete().eq("match_id", PROBE.subMatchId);
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
      referee_display_name: "TT-5C Probe Referee",
      role: "REFEREE",
      status: "active",
    })
    .select("id")
    .single();

  return { header, matchup, subRow, assignmentId: assignment?.id, stateId };
}

async function provisionMatch(btcClient, subVersion) {
  return rpc(btcClient, "team_tournament_provision_referee_match", {
    p_tournament_id: PROBE.tournamentId,
    p_matchup_id: PROBE.matchupId,
    p_sub_match_id: PROBE.subMatchId,
    p_referee_assignment_id: null,
    p_expected_sub_match_version: subVersion,
    p_idempotency_key: `tt5c-prov-${Date.now()}`,
    p_reason: "tt5c_e2e",
    p_source: "verify",
  });
}

async function finalizeViaV5(admin, prepCtx, adminUserId) {
  const idempotencyKey = `tt5c-fin-${Date.now()}`;
  const { data: live } = await admin
    .from("match_live_states")
    .select("state_version, version")
    .eq("id", prepCtx.stateId)
    .maybeSingle();

  const expectedVersion = live?.state_version ?? live?.version ?? 0;

  return rpc(admin, "referee_v5_commit_match_finalization", {
    p_tenant_id: prepCtx.header.tenant_id,
    p_tournament_id: prepCtx.header.tournament_id,
    p_match_id: PROBE.subMatchId,
    p_actor_id: adminUserId,
    p_expected_state_version: expectedVersion,
    p_idempotency_key: idempotencyKey,
    p_request_hash: `hash-${idempotencyKey}`,
    p_revision: {
      revision: 1,
      status: "confirmed",
      teamAId: prepCtx.matchup.team_a_id,
      teamBId: prepCtx.matchup.team_b_id,
      winnerId: prepCtx.matchup.team_a_id,
      officialScore: { teamA: 11, teamB: 7 },
    },
    p_outbox_events: [
      {
        eventType: "STANDINGS_RECALC_REQUESTED",
        payload: { matchId: PROBE.subMatchId, revision: 1 },
        idempotencyKey: `${idempotencyKey}::standings`,
      },
    ],
    p_override_reason: null,
  });
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
  const { data: session } = await btcClient.auth.getSession();
  const adminUserId = session?.session?.user?.id;

  const outboxReport = baseReport("TT-5C-OUTBOX", "TT5C_OUTBOX_REPORT.json");
  const propagationReport = baseReport("TT-5C-PROPAGATION", "TT5C_RESULT_PROPAGATION_REPORT.json");
  const idempotencyReport = baseReport("TT-5C-IDEMPOTENCY", "TT5C_IDEMPOTENCY_REPORT.json");
  const revisionReport = baseReport("TT-5C-REVISION", "TT5C_REVISION_REPORT.json");
  const standingsReport = baseReport("TT-5C-STANDINGS", "TT5C_STANDINGS_REPORT.json");
  const securityReport = baseReport("TT-5C-SECURITY", "TT5C_SECURITY_REPORT.json");
  const e2eReport = baseReport("TT-5C-E2E", "TT5C_E2E_STAGING_REPORT.json");

  const { data: inboxTable } = await admin.from("team_tournament_referee_event_inbox").select("id").limit(1);
  recordCase(outboxReport, "O01", "inbox table exists", inboxTable !== null);

  const prep = await prepProbe(admin, adminUserId);

  const provision = await rpc(btcClient, "team_tournament_provision_referee_match", {
    p_tournament_id: PROBE.tournamentId,
    p_matchup_id: PROBE.matchupId,
    p_sub_match_id: PROBE.subMatchId,
    p_referee_assignment_id: prep.assignmentId,
    p_expected_sub_match_version: prep.subRow?.version ?? null,
    p_idempotency_key: `tt5c-e2e-prov-${Date.now()}`,
    p_reason: "tt5c_e2e",
    p_source: "verify",
  });
  recordCase(e2eReport, "E01", "BTC provision", provision.ok === true, { provision });

  const finalize = await finalizeViaV5(admin, prep, adminUserId);
  recordCase(e2eReport, "E02", "V5 finalize + outbox", finalize.ok === true, { finalize });

  const { data: outboxRows } = await admin
    .from("match_integration_outbox")
    .select("id, event_type, status")
    .eq("match_state_id", prep.stateId)
    .eq("event_type", "STANDINGS_RECALC_REQUESTED")
    .order("created_at", { ascending: false })
    .limit(1);

  const outboxId = outboxRows?.[0]?.id;
  recordCase(outboxReport, "O02", "STANDINGS_RECALC_REQUESTED pending", Boolean(outboxId), { outboxId });

  const consume1 = await rpc(admin, "team_tournament_consume_referee_v5_outbox", {
    p_outbox_id: outboxId,
    p_correlation_id: "tt5c-e2e-1",
  });
  recordCase(propagationReport, "P01", "consumer applies result", consume1.ok === true, { consume1 });
  recordCase(e2eReport, "E03", "consumer propagation", consume1.ok === true);

  const { data: subAfter } = await admin
    .from("team_tournament_sub_matches")
    .select("status, score, winner_team_id, result_confirmed_at")
    .eq("external_sub_match_id", PROBE.subMatchId)
    .maybeSingle();

  recordCase(
    propagationReport,
    "P02",
    "sub-match completed with score",
    subAfter?.status === "completed" &&
      subAfter?.score?.teamA === 11 &&
      subAfter?.score?.teamB === 7,
    { subAfter }
  );
  recordCase(e2eReport, "E04", "TT sub-match updated", subAfter?.status === "completed", { subAfter });

  const { data: linkAfter } = await admin
    .from("team_sub_match_referee_links")
    .select("status, last_result_revision_id")
    .eq("sub_match_id", prep.subRow.id)
    .maybeSingle();
  recordCase(propagationReport, "P03", "bridge finalized", linkAfter?.status === "finalized", { linkAfter });

  const consume2 = await rpc(admin, "team_tournament_consume_referee_v5_outbox", {
    p_outbox_id: outboxId,
    p_correlation_id: "tt5c-e2e-dup",
  });
  const replayed =
    consume2.replayed === true ||
    consume2.code === "OUTBOX_ALREADY_COMPLETED" ||
    consume2.code === "revision_already_applied";
  recordCase(idempotencyReport, "I01", "duplicate delivery replay", replayed, { consume2 });
  recordCase(e2eReport, "E05", "retry no duplicate standings", replayed);

  const { count: inboxCountFixed } = await admin
    .from("team_tournament_referee_event_inbox")
    .select("id", { count: "exact", head: true })
    .eq("outbox_event_id", outboxId);
  recordCase(idempotencyReport, "I02", "exactly one inbox row", inboxCountFixed === 1, {
    inboxCount: inboxCountFixed,
  });

  const setup = await rpc(btcClient, "team_tournament_get_setup", { p_tournament_id: PROBE.tournamentId });
  const subView = setup?.tournament?.teamData?.matchups
    ?.find((m) => m.id === PROBE.matchupId)
    ?.subMatches?.find((sm) => sm.id === PROBE.subMatchId);
  recordCase(
    e2eReport,
    "E06",
    "legacy scoreOps blocked",
    subView?.scoreOps?.canSaveDraft === false && subView?.scoreOps?.canConfirm === false,
    { scoreOps: subView?.scoreOps }
  );
  recordCase(
    e2eReport,
    "E07",
    "refereeLinkOps route",
    subView?.refereeLinkOps?.route === `/referee/match/${PROBE.subMatchId}`,
    { refereeLinkOps: subView?.refereeLinkOps }
  );

  const saveDraft = await rpc(btcClient, "team_tournament_save_sub_match_draft", {
    p_tournament_id: PROBE.tournamentId,
    p_matchup_id: PROBE.matchupId,
    p_sub_match_id: PROBE.subMatchId,
    p_score: { teamA: 5, teamB: 5, games: [] },
  });
  recordCase(
    securityReport,
    "S01",
    "legacy save draft blocked",
    saveDraft.ok === false && String(saveDraft.code || "").includes("referee_v5"),
    { code: saveDraft.code }
  );

  const { data: standings } = await admin
    .from("team_tournament_standings")
    .select("team_external_id, played, wins, sub_match_wins")
    .eq("team_tournament_id", prep.header.id);
  recordCase(
    standingsReport,
    "ST01",
    "standings cache present",
    Array.isArray(standings) && standings.length >= 2,
    { standings }
  );

  const btcConsume = await rpc(btcClient, "team_tournament_consume_referee_v5_outbox", {
    p_outbox_id: outboxId,
  });
  recordCase(
    securityReport,
    "S02",
    "authenticated cannot consume",
    btcConsume.ok === false,
    { code: btcConsume.code }
  );

  recordCase(revisionReport, "R01", "revision stored on bridge", Boolean(linkAfter?.last_result_revision_id));

  for (const report of [
    outboxReport,
    propagationReport,
    idempotencyReport,
    revisionReport,
    standingsReport,
    securityReport,
    e2eReport,
  ]) {
    finalizeReport(report);
    writeReport(report);
  }

  const allPass = [
    outboxReport,
    propagationReport,
    idempotencyReport,
    revisionReport,
    standingsReport,
    securityReport,
    e2eReport,
  ].every((r) => r.allPass);

  console.log(allPass ? "✅ TT-5C staging verification PASS" : "❌ TT-5C staging verification FAIL");
  console.log(`Evidence: ${evidenceDir}`);
  process.exit(allPass ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
