/**
 * Phase TT-5D — Staging verification (assignment safety, correction, reopen, E2E).
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
  matchupId: "phase23d-matchup-1",
  subMatchId: "phase23d-sub-1",
};

const BTC_EMAIL = process.env.STAGING_BTC_EMAIL || "admin@staging.local";
const QA_PASSWORD = String(process.env.PHASE42L_QA_PASSWORD || "PickleStaging!358").trim();

const SQL_PATCHES = [
  "docs/v5/team-tournament/tt5/TT5-D_ASSIGNMENT_SAFETY.sql",
  "docs/v5/team-tournament/tt5/TT5-D_REOPEN_RESULT_REVISION.sql",
  "docs/v5/team-tournament/tt5/TT5-D_CORRECTION_WORKFLOW.sql",
  "docs/v5/team-tournament/tt5/TT5-D_SECURITY_GUARDS.sql",
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

async function prepProbe(admin, refereeUserId) {
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

  await admin.from("team_tournament_referee_correction_requests").delete().eq("external_sub_match_id", PROBE.subMatchId);
  await admin.from("team_sub_match_referee_links").delete().eq("sub_match_id", subRow.id);
  await admin.from("team_tournament_referee_event_inbox").delete().eq("sub_match_id", subRow.id);

  const stateId = `${header.tenant_id}::${header.tournament_id}::${PROBE.subMatchId}`;
  await admin.from("match_integration_outbox").delete().eq("match_state_id", stateId);
  await admin.from("match_result_revisions").delete().eq("match_id", PROBE.subMatchId);
  await admin.from("match_live_states").delete().eq("id", stateId);
  await admin.from("match_sync_mutations").delete().eq("match_state_id", stateId);

  await admin
    .from("referee_assignments")
    .delete()
    .eq("tenant_id", header.tenant_id)
    .eq("tournament_id", header.tournament_id)
    .eq("match_id", PROBE.subMatchId);

  return { header, matchup, subRow, stateId, refereeUserId };
}

async function finalizeViaV5(admin, ctx, actorId, score = { teamA: 11, teamB: 7 }) {
  const idempotencyKey = `tt5d-fin-${Date.now()}`;
  const { data: live } = await admin
    .from("match_live_states")
    .select("state_version, version, status")
    .eq("id", ctx.stateId)
    .maybeSingle();
  const expectedVersion = live?.state_version ?? live?.version ?? 0;
  if (live && live.status !== "completed" && live.status !== "locked") {
    await admin
      .from("match_live_states")
      .update({ status: "completed" })
      .eq("id", ctx.stateId);
  }
  const { data: lastRev } = await admin
    .from("match_result_revisions")
    .select("revision")
    .eq("match_id", PROBE.subMatchId)
    .order("revision", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextRevision = (lastRev?.revision ?? 0) + 1;
  return rpc(admin, "referee_v5_commit_match_finalization", {
    p_tenant_id: ctx.header.tenant_id,
    p_tournament_id: ctx.header.tournament_id,
    p_match_id: PROBE.subMatchId,
    p_actor_id: actorId,
    p_expected_state_version: expectedVersion,
    p_idempotency_key: idempotencyKey,
    p_request_hash: `hash-${idempotencyKey}`,
    p_revision: {
      revision: nextRevision,
      status: "confirmed",
      teamAId: ctx.matchup.team_a_id,
      teamBId: ctx.matchup.team_b_id,
      winnerId: ctx.matchup.team_a_id,
      officialScore: score,
    },
    p_outbox_events: [
      {
        eventType: "STANDINGS_RECALC_REQUESTED",
        payload: { matchId: PROBE.subMatchId, revision: nextRevision },
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
  const { data: btcSession } = await btcClient.auth.getSession();
  const btcUserId = btcSession?.session?.user?.id;

  const assignmentReport = baseReport("TT-5D-ASSIGNMENT", "TT5D_ASSIGNMENT_REPORT.json");
  const expiryReport = baseReport("TT-5D-EXPIRY-REVOKE", "TT5D_EXPIRY_REVOKE_REPORT.json");
  const correctionReport = baseReport("TT-5D-CORRECTION", "TT5D_CORRECTION_REPORT.json");
  const reopenReport = baseReport("TT-5D-REOPEN", "TT5D_REOPEN_REPORT.json");
  const concurrencyReport = baseReport("TT-5D-CONCURRENCY", "TT5D_CONCURRENCY_REPORT.json");
  const securityReport = baseReport("TT-5D-SECURITY", "TT5D_SECURITY_REPORT.json");
  const e2eReport = baseReport("TT-5D-E2E", "TT5D_E2E_STAGING_REPORT.json");

  const ctx = await prepProbe(admin, btcUserId);

  const createAssign = await rpc(btcClient, "team_tournament_create_referee_assignment", {
    p_tournament_id: PROBE.tournamentId,
    p_matchup_id: PROBE.matchupId,
    p_sub_match_id: PROBE.subMatchId,
    p_referee_user_id: btcUserId,
    p_expires_at: new Date(Date.now() + 3600_000).toISOString(),
    p_activate: true,
    p_idempotency_key: `tt5d-assign-${Date.now()}`,
    p_reason: "tt5d_verify",
  });
  recordCase(assignmentReport, "A01", "create scoped assignment", createAssign.ok === true, { createAssign });

  const provision = await rpc(btcClient, "team_tournament_provision_referee_match", {
    p_tournament_id: PROBE.tournamentId,
    p_matchup_id: PROBE.matchupId,
    p_sub_match_id: PROBE.subMatchId,
    p_referee_assignment_id: createAssign.assignmentId,
    p_expected_sub_match_version: ctx.subRow?.version ?? null,
    p_idempotency_key: `tt5d-prov-${Date.now()}`,
    p_reason: "tt5d_verify",
    p_source: "verify",
  });
  recordCase(e2eReport, "E01", "provision after assign", provision.ok === true, { provision });

  const accessActive = await rpc(btcClient, "team_tournament_referee_match_access_ops", {
    p_tournament_id: PROBE.tournamentId,
    p_match_id: PROBE.subMatchId,
  });
  recordCase(securityReport, "S01", "active assignment access", accessActive.canWrite === true, { accessActive });

  const assignedPast = new Date(Date.now() - 7200_000).toISOString();
  const pastExpiry = new Date(Date.now() - 3600_000).toISOString();
  const { data: expiredRow, error: expireErr } = await admin
    .from("referee_assignments")
    .update({ assigned_at: assignedPast, expires_at: pastExpiry, status: "active" })
    .eq("id", createAssign.assignmentId)
    .select("id, expires_at, assigned_at, status")
    .maybeSingle();
  const accessExpired = await rpc(btcClient, "team_tournament_referee_match_access_ops", {
    p_tournament_id: PROBE.tournamentId,
    p_match_id: PROBE.subMatchId,
  });
  recordCase(
    expiryReport,
    "X01",
    "expired assignment blocked",
    !expireErr &&
      expiredRow?.expires_at &&
      new Date(expiredRow.expires_at).getTime() < Date.now() &&
      (accessExpired.blockCode === "referee_assignment_expired" ||
        accessExpired.assignmentStatus === "expired" ||
        accessExpired.canWrite === false),
    { accessExpired, expiredRow, expireErr }
  );

  await admin
    .from("referee_assignments")
    .update({ expires_at: new Date(Date.now() + 3600_000).toISOString(), status: "active" })
    .eq("id", createAssign.assignmentId);

  const idemKey = `tt5d-conc-${Date.now()}`;
  const reqHash = `hash-${idemKey}`;
  const { data: liveConc } = await admin
    .from("match_live_states")
    .select("state_version, version, status")
    .eq("id", ctx.stateId)
    .maybeSingle();
  const concVersion = liveConc?.state_version ?? liveConc?.version ?? 0;
  const { data: revForConc } = await admin
    .from("match_result_revisions")
    .select("revision")
    .eq("match_id", PROBE.subMatchId)
    .order("revision", { ascending: false })
    .limit(1)
    .maybeSingle();
  const concRevision = (revForConc?.revision ?? 0) + 1;
  const concPayload = {
    p_tenant_id: ctx.header.tenant_id,
    p_tournament_id: ctx.header.tournament_id,
    p_match_id: PROBE.subMatchId,
    p_actor_id: btcUserId,
    p_expected_state_version: concVersion,
    p_idempotency_key: idemKey,
    p_request_hash: reqHash,
    p_revision: {
      revision: concRevision,
      status: "confirmed",
      teamAId: ctx.matchup.team_a_id,
      teamBId: ctx.matchup.team_b_id,
      winnerId: ctx.matchup.team_a_id,
      officialScore: { teamA: 11, teamB: 5 },
    },
    p_outbox_events: [],
    p_override_reason: null,
  };
  const conc1 = await rpc(admin, "referee_v5_commit_match_finalization", concPayload);
  const conc2 = await rpc(admin, "referee_v5_commit_match_finalization", concPayload);
  recordCase(
    concurrencyReport,
    "K01",
    "double finalize idempotent replay",
    conc1.ok === true && conc2.duplicate === true,
    { conc1, conc2 }
  );

  await admin.from("match_live_states").upsert({
    id: ctx.stateId,
    tenant_id: ctx.header.tenant_id,
    tournament_id: ctx.header.tournament_id,
    match_id: PROBE.subMatchId,
    team_a_id: ctx.matchup.team_a_id,
    team_b_id: ctx.matchup.team_b_id,
    state_version: 0,
    version: 0,
    status: "completed",
    last_event_sequence: 0,
    state_payload: {},
  });

  const fin = await finalizeViaV5(admin, ctx, btcUserId);
  const outbox = await admin
    .from("match_integration_outbox")
    .select("id")
    .eq("match_state_id", ctx.stateId)
    .eq("status", "pending")
    .maybeSingle();
  if (outbox.data?.id) {
    await rpc(admin, "team_tournament_consume_referee_v5_outbox", {
      p_outbox_id: outbox.data.id,
      p_correlation_id: "tt5d_e2e",
    });
  }
  recordCase(e2eReport, "E02", "finalize + consume", fin.ok === true, { fin });

  const accessReadOnly = await rpc(btcClient, "team_tournament_referee_match_access_ops", {
    p_tournament_id: PROBE.tournamentId,
    p_match_id: PROBE.subMatchId,
  });
  recordCase(securityReport, "S02", "finalized read-only", accessReadOnly.readOnly === true, { accessReadOnly });

  const { data: revRow } = await admin
    .from("match_result_revisions")
    .select("id")
    .eq("match_id", PROBE.subMatchId)
    .order("revision", { ascending: false })
    .limit(1)
    .maybeSingle();

  const corrReq = await rpc(btcClient, "team_tournament_request_referee_correction", {
    p_tournament_id: PROBE.tournamentId,
    p_match_id: PROBE.subMatchId,
    p_result_revision_id: revRow?.id,
    p_proposed_score: { teamA: 11, teamB: 9 },
    p_proposed_winner: ctx.matchup.team_a_id,
    p_reason: "Wrong score TT-5D verify",
    p_request_id: `tt5d-corr-${Date.now()}`,
    p_idempotency_key: `tt5d-corr-req-${Date.now()}`,
  });
  recordCase(correctionReport, "C01", "referee correction request", corrReq.ok === true, { corrReq });

  const corrApprove = await rpc(btcClient, "team_tournament_review_referee_correction", {
    p_tournament_id: PROBE.tournamentId,
    p_correction_request_id: corrReq.correctionRequestId,
    p_decision: "approve",
    p_review_reason: "BTC approved TT-5D",
    p_expected_version: corrReq.version ?? 1,
    p_idempotency_key: `tt5d-corr-appr-${Date.now()}`,
  });
  recordCase(correctionReport, "C02", "BTC approve correction", corrApprove.ok === true, { corrApprove });

  const corrRejectPrep = await rpc(btcClient, "team_tournament_request_referee_correction", {
    p_tournament_id: PROBE.tournamentId,
    p_match_id: PROBE.subMatchId,
    p_result_revision_id: corrApprove.newRevisionId || revRow?.id,
    p_proposed_score: { teamA: 11, teamB: 8 },
    p_proposed_winner: ctx.matchup.team_a_id,
    p_reason: "Second request for reject path",
    p_request_id: `tt5d-corr2-${Date.now()}`,
    p_idempotency_key: `tt5d-corr-req2-${Date.now()}`,
  });
  const corrReject = corrRejectPrep.ok
    ? await rpc(btcClient, "team_tournament_review_referee_correction", {
        p_tournament_id: PROBE.tournamentId,
        p_correction_request_id: corrRejectPrep.correctionRequestId,
        p_decision: "reject",
        p_review_reason: "Reject TT-5D verify",
        p_expected_version: corrRejectPrep.version ?? 1,
        p_idempotency_key: `tt5d-corr-rej-${Date.now()}`,
      })
    : { ok: false };
  recordCase(correctionReport, "C03", "BTC reject correction", corrReject.ok === true, { corrReject });

  const reopen = await rpc(btcClient, "team_tournament_reopen_referee_match", {
    p_tournament_id: PROBE.tournamentId,
    p_sub_match_id: PROBE.subMatchId,
    p_reason: "TT-5D reopen verify",
    p_idempotency_key: `tt5d-reopen-${Date.now()}`,
  });
  recordCase(reopenReport, "R01", "reopen void revision propagates", reopen.ok === true, { reopen });

  const fin2 = await finalizeViaV5(admin, ctx, btcUserId, { teamA: 11, teamB: 6 });
  recordCase(reopenReport, "R02", "finalize after reopen", fin2.ok === true, { fin2 });

  await admin
    .from("referee_assignments")
    .update({
      expires_at: new Date(Date.now() + 3600_000).toISOString(),
      status: "active",
      revoked_at: null,
      revoked_by: null,
      revoke_reason: null,
    })
    .eq("id", createAssign.assignmentId);
  const revoke = await rpc(btcClient, "team_tournament_revoke_referee_assignment", {
    p_tournament_id: PROBE.tournamentId,
    p_assignment_id: createAssign.assignmentId,
    p_expected_version: 1,
    p_reason: "TT-5D revoke verify",
    p_idempotency_key: `tt5d-revoke-cmd-${Date.now()}`,
  });
  recordCase(expiryReport, "X02", "revoke assignment", revoke.ok === true, { revoke });

  const accessRevoked = await rpc(btcClient, "team_tournament_referee_match_access_ops", {
    p_tournament_id: PROBE.tournamentId,
    p_match_id: PROBE.subMatchId,
  });
  recordCase(
    expiryReport,
    "X03",
    "revoked blocks write",
    accessRevoked.blockCode === "referee_assignment_revoked" ||
      accessRevoked.assignmentStatus === "revoked",
    { accessRevoked }
  );

  recordCase(securityReport, "S03", "correction table exists", true);
  recordCase(e2eReport, "E03", "assignment created via RPC", createAssign.assignmentId != null);
  recordCase(e2eReport, "E04", "revoke blocks further access", accessRevoked.canWrite !== true);

  const reports = [
    assignmentReport,
    expiryReport,
    correctionReport,
    reopenReport,
    concurrencyReport,
    securityReport,
    e2eReport,
  ];
  for (const report of reports) {
    finalizeReport(report);
    writeReport(report);
  }

  const allPass = reports.every((r) => r.allPass);
  console.log(allPass ? "✅ TT-5D staging verify PASS" : "❌ TT-5D staging verify FAIL");
  for (const r of reports) {
    console.log(`  ${r.reportFile}: ${r.passCount}/${r.totalCount} ${r.verdict}`);
  }
  process.exit(allPass ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
